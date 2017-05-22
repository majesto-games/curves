import { getColors } from "game/util"
import { frequency, shuffle } from "utils/array"
import never from "utils/never"
import { Point, ServerPlayer, Snake, Powerup, ActivePowerup, PowerupType } from "game/player"
import { containsPoint, ServerTail, TailStorage } from "game/tail"
import {
  PlayerUpdate,
  Gap,
  GAP,
  TAIL,
  Tail,
  Score,
  Action,
  started,
  roundEnd,
  updatePlayers,
  spawnPowerup,
  fetchPowerup,
  round,
  ServerAction,
  ADD_PLAYER,
  ROTATE,
  LEFT,
  ClientAction,
  START,
  lobby,
} from "./actions"

import { ClientConnection, ConnectionId } from "./connections"

export const SERVER_WIDTH = 960
export const SERVER_HEIGHT = 960

interface AlmostPlayerInit {
  name: string
  color: number
  connectionId: ConnectionId
  id: number
}

function fastDistance(x1: number, y1: number, x2: number, y2: number) {
  const a = x1 - x2
  const b = y1 - y2
  return (a * a) + (b * b)
}

function rotationSpeed(fatness: number) {
  return window.getGlobal("ROTATION_SPEED") / (10 + fatness) - (0.02 * 64 / window.getGlobal("TICK_RATE"))
}

class RoundState {
  public tails = new TailStorage(() => new ServerTail())
  public placedPowerups: Powerup[] = []
  public losers: ServerPlayer[] = []
  public nextPowerupId = 0
  public powerupChance = window.getGlobal("POWERUP_CHANCE_BASE")
  public lastUpdate: number
  public sentActions: ClientAction[] = []
}

export class Server {
  public players: ServerPlayer[] = []
  private playerInits: AlmostPlayerInit[] = []
  // TODO: playerInits and these sentActions should not be like this
  private sentActions: ClientAction[] = []
  private scores: Score[] = []

  private clientConnections: ClientConnection[] = []
  private pauseDelta: number = 0
  private paused: boolean = true
  private colors: number[] = getColors(7)
  private round: RoundState
  private joinable = true

  constructor() {
    this.round = new RoundState()
  }

  public receive(action: ServerAction, connectionId: ConnectionId) {
    switch (action.type) {
      case ADD_PLAYER: {
        this.addPlayer(connectionId)
        break
      }
      case START: {
        this.startGame()
        break
      }
      case ROTATE: {
        const { payload } = action
        const player = this.playerById(payload.index)
        if (player != null && player.owner === connectionId) {
          if (payload.direction === LEFT) {
            player.steeringLeft = payload.value
          } else {
            player.steeringRight = payload.value
          }

        }

        break
      }
      default:
        never("Server didn't handle", action)
    }
  }

  public addConnection(conn: ClientConnection) {
    this.clientConnections = this.clientConnections.concat(conn)
    console.log("connection added to: ", conn.id, " total: ", this.clientConnections.length)

    this.sentActions.forEach(conn)
    console.log(`resending ${this.round.sentActions.length} actions`)
    this.round.sentActions.forEach(conn)
  }

  public removeConnection(conn: ClientConnection) {
    console.log("removing connection", conn)
    this.clientConnections = this.clientConnections.filter(v => v.id !== conn.id)
  }

  private addPlayer(connectionId: ConnectionId) {
    if (!this.joinable) {
      return
    }

    const id = this.players.length + 1
    const name = `${id}`
    const color = this.colors.pop() as number

    const playerInit: AlmostPlayerInit = { name, color, connectionId, id }
    const player = new ServerPlayer(name, id, color, connectionId)
    console.log("Added player with connection id:", connectionId)

    this.playerInits.push(playerInit)
    this.players.push(player)
    this.scores.push({
      score: 0,
      id,
    })

    this.send([lobby(this.players)])
  }

  private startGame() {
    this.joinable = false

    const playerInits = this.playerInits.map(v => {
      return {
        name: v.name,
        color: v.color,
        owner: v.connectionId,
        id: v.id,
      }
    })
    this.send([started(playerInits)])
    // TODO: Remove this hack by figuring out a better way of doing playerInits
    this.sentActions = this.round.sentActions
    this.round.sentActions = []

    console.log("starting server")
    this.startRound()
  }

  private send(actions: ClientAction[]) {
    this.round.sentActions.push(...actions)
    this.clientConnections.forEach(c => {
      actions.forEach(a => c(a))
    })
  }

  private pause() {
    this.pauseDelta = Date.now() - this.round.lastUpdate
    this.paused = true
  }

  private playerById(id: number): ServerPlayer | undefined {
    return this.players.find(p => p.id === id)
  }

  private rotateTick(player: ServerPlayer) {
    const rotSpeed = rotationSpeed(player.snake!.fatness)
    if (player.steeringLeft) {
      player.snake!.rotate(-rotSpeed)
    }
    if (player.steeringRight) {
      player.snake!.rotate(rotSpeed)
    }
  }

  private moveTick(player: Snake) {
    player.x += Math.sin(player.rotation) * player.speed
    player.y -= Math.cos(player.rotation) * player.speed
  }

  private wrapEdge(player: Snake) {
    if (player.x > SERVER_WIDTH + player.fatness) {
      player.x = -player.fatness
      player.lastX = player.x - 1
      player.lastEnd = null
    }

    if (player.y > SERVER_HEIGHT + player.fatness) {
      player.y = -player.fatness
      player.lastY = player.y - 1
      player.lastEnd = null
    }

    if (player.x < -player.fatness) {
      player.x = SERVER_WIDTH + player.fatness
      player.lastX = player.x + 1
      player.lastEnd = null
    }

    if (player.y < -player.fatness) {
      player.y = SERVER_HEIGHT + player.fatness
      player.lastY = player.y + 1
      player.lastEnd = null
    }
  }

  private collides(p: number[], player: Snake) {
    return (collider: Snake) => {
      let tails = this.round.tails.tailsForPlayer(collider)

      // Special case for last tail for this player
      if (collider === player && tails.length > 0) {
        const last = tails[tails.length - 1]
        // Modify tails not not contain last part
        tails = tails.slice(0, -1)

        for (let i = 0; i < p.length; i += 2) {
          const x = p[i]
          const y = p[i + 1]

          // Test all but the last tail part
          const mostOfLast = last.parts.slice(0, -1)

          if (mostOfLast.some(part => containsPoint(part.vertices, x, y))) {
            return true
          }
        }
      }

      for (let i = 0; i < p.length; i += 2) {
        const x = p[i]
        const y = p[i + 1]

        if (tails.some(tail => tail.containsPoint(x, y))) {
          return true
        }
      }
      return false
    }
  }

  private collidesPowerup(player: Snake, powerup: Powerup) {
    const { x, y, fatness } = player
    const { location } = powerup
    return fastDistance(x, y, location.x, location.y) < (fatness * fatness) + (16 * 16)
  }

  private spawnPowerups() {
    const powerups: Powerup[] = []
    if (Math.random() < this.round.powerupChance) {
      this.round.powerupChance = window.getGlobal("POWERUP_CHANCE_BASE")
      const x = Math.round(Math.random() * SERVER_WIDTH)
      const y = Math.round(Math.random() * SERVER_HEIGHT)

      const alivePlayerCount = this.players.filter(player => player.snake!.alive).length

      const swapThemChance = alivePlayerCount > 2 ? 0.5 : 0

      const powerupType = frequency<PowerupType>([
        [1, "SWAP_ME"],
        [swapThemChance, "SWAP_THEM"],
        [2, "GHOST"],
        [3, "UPSIZE"],
        [1, "REVERSE_THEM"],
        [1, "SPEEDUP_ME"],
        [1, "SPEEDUP_THEM"],
        [1, "SPEEDDOWN_ME"],
        [1, "SPEEDDOWN_THEM"],
      ], 11 + swapThemChance)

      powerups.push({
        type: powerupType,
        id: this.round.nextPowerupId,
        location: {
          x,
          y,
        },
      })

      this.round.nextPowerupId++
    } else {
      this.round.powerupChance += window.getGlobal("POWERUP_CHANCE_INCREASE")
    }

    return powerups
  }

  private serverTick() {
    if (this.paused) {
      return
    }
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = Math.floor((Date.now() - this.round.lastUpdate) * tickRate / 1000)

    this.round.lastUpdate += ticksNeeded * 1000 / tickRate

    for (let i = 0; i < ticksNeeded; i++) {
      const playerUpdates: PlayerUpdate[] = []
      const playersAlive = this.players.filter(player => player.snake!.alive)

      if (playersAlive.length < 2) {
        const playerOrder = this.round.losers.concat(playersAlive)
        for (let j = 0; j < playerOrder.length; j++) {
          // TODO: Better score finding. And don't mutate?
          const score = this.scores.find(s => s.id === playerOrder[j].id)!
          score.score += j
        }
        this.send([roundEnd(this.scores, playerOrder[playerOrder.length - 1].id)])

        this.pause()
        setTimeout(() => {
          this.startRound()
        }, 3000)
        return
      }

      const collidedPowerups: { snake: Snake, powerup: Powerup }[] = []

      for (const player of playersAlive) {
        this.rotateTick(player)
        this.moveTick(player.snake!)
        this.wrapEdge(player.snake!)

        player.snake!.tick()
        // Create tail polygon, this returns undefined if it's supposed to be a hole
        const poly = player.snake!.createTailPolygon()

        let tailAction: Tail | Gap = { type: GAP }

        if (poly != null) {
          if (this.players.map(p => p.snake).some(this.collides(poly.vertices, player.snake!))) {
            player.snake!.alive = false
            // TODO: randomize order
            this.round.losers.push(player)
          }

          tailAction = {
            type: TAIL,
            payload: poly,
          }

          this.round.tails.add(poly)
        }

        this.round.placedPowerups = this.round.placedPowerups.filter(powerup => {
          if (this.collidesPowerup(player.snake!, powerup)) {
            collidedPowerups.push(this.powerupPickup(player, powerup, playersAlive))
            return false
          }
          return true
        })

        playerUpdates.push({
          alive: player.snake!.alive,
          rotation: player.snake!.rotation,
          tail: tailAction,
          x: player.snake!.x,
          y: player.snake!.y,
          fatness: player.snake!.fatness,
          id: player.id,
          powerupProgress: player.snake!.powerupProgress,
        })
      }

      const newPowerups = this.spawnPowerups()
      this.round.placedPowerups = this.round.placedPowerups.concat(newPowerups)

      const actions = [
        updatePlayers(playerUpdates),
        ...newPowerups.map(spawnPowerup),
        ...collidedPowerups.map(({ snake, powerup }) => fetchPowerup(snake.id, powerup.id)),
      ]

      this.send(actions)
    }

    setTimeout(() => this.serverTick(), (this.round.lastUpdate + (1000 / tickRate)) - Date.now())
  }

  private powerupPickup(player: ServerPlayer, powerup: Powerup, playersAlive: ServerPlayer[]) {

    switch (powerup.type) {
      case "UPSIZE": {
        playersAlive
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake!.fatify(powerup))
        break
      }
      case "GHOST": {
        player.snake!.ghostify(powerup)
        break
      }
      case "SPEEDDOWN_ME": {
        player.snake!.speeddown(powerup)
        break
      }
      case "SPEEDDOWN_THEM": {
        playersAlive
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake!.speeddown(powerup))
        break
      }
      case "SPEEDUP_ME": {
        player.snake!.speedup(powerup)
        break
      }
      case "SPEEDUP_THEM": {
        playersAlive
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake!.speedup(powerup))
        break
      }
      case "SWAP_ME": {
        const others = playersAlive
          .filter(p => player.id !== p.id)
        const swapIndex = Math.floor(Math.random() * others.length)
        player.snake!.swapWith(others[swapIndex].snake!)
        break
      }
      case "SWAP_THEM": {
        const others = shuffle(playersAlive
          .filter(p => player.id !== p.id))
        if (others.length >= 2) {
          others[0].snake!.swapWith(others[1].snake!)

        }
        break
      }
      case "REVERSE_THEM": {
        this.players
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake!.reversify(powerup))
        break
      }
      default:
        never("Picked up unknown powerup", powerup.type)
    }

    return { snake: player.snake!, powerup }
  }

  private start() {
    if (this.paused) {
      if (this.pauseDelta) {
        this.round.lastUpdate = Date.now() - this.pauseDelta
      } else {
        this.round.lastUpdate = Date.now() - (1000 / window.getGlobal("TICK_RATE"))
      }
      this.paused = false
      this.serverTick()
    }
  }

  private startRound() {
    this.round = new RoundState()
    const rx = SERVER_WIDTH * 0.3
    const ry = SERVER_HEIGHT * 0.3
    const player1Radians = Math.random() * 2 * Math.PI
    const deltaRadians = (2 * Math.PI) / this.players.length

    const shuffledPlayers = shuffle(this.players.slice())

    const snakeInits = shuffledPlayers.map((p, i) => {
      const rotation = Math.random() * Math.PI * 2

      // Place players in a circle
      const playerRadian = player1Radians + (i * deltaRadians)

      const startPoint: Point = {
        x: rx * Math.cos(playerRadian) + (SERVER_WIDTH / 2),
        y: ry * Math.sin(playerRadian) + (SERVER_HEIGHT / 2),
      }

      const snake = new Snake(startPoint, rotation, p.id)
      // WARNING: Modifies player even though this is a .map
      p.snake = snake
      this.round.tails.initPlayer(snake)

      return {
        startPoint,
        rotation,
        id: p.id,
      }
    })

    const startDelay = window.getGlobal("ROUND_START_DELAY")

    this.send([round(snakeInits, startDelay)])

    setTimeout(() => {
      this.start()
    }, startDelay)
  }

}
