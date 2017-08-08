import { getColors } from "game/util"
import { frequency, shuffle } from "utils/array"
import never from "utils/never"
import {
  Point, ServerPlayer, Snake, Powerup, ActivePowerup,
  PowerupType, tick, rotate, createTailPolygon, fatify,
  ghostify, speeddown, speedup, swapWith, reversify, newSnake,
} from "game/player"
import {
  ServerTail, TailStorage, newServerTail, addToServerTail,
  serverTailContainsPoint, containsPointExcludeLatest,
  tailStorageModule, tailsForPlayer, TailStorageI, TailPart,
} from "game/tail"

import {
  PlayerUpdate,
  Gap,
  GAP,
  TAIL,
  Tail,
  Score,
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
import { createStore, combineReducers, Store } from "redux"
import { List, Record } from "immutable"
import createModule, { Action } from "redux-typescript-module"

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

const tailsModule = tailStorageModule<ServerTail>(
  () => newServerTail(),
  (tail, part) => {
    return addToServerTail(tail, part)
  },
)

export interface RoundStateI {
  placedPowerups: Powerup[]
  losers: ServerPlayer[]
  nextPowerupId: number
  powerupChance: number
  lastUpdate: number
  sentActions: ClientAction[]
}

export type RoundState = Record.Instance<RoundStateI>

// tslint:disable-next-line:variable-name
export const RoundStateClass: Record.Class<RoundStateI> = Record({
  placedPowerups: [],
  losers: [],
  nextPowerupId: 0,
  powerupChance: window.getGlobal("POWERUP_CHANCE_BASE"),
  lastUpdate: 0,
  sentActions: [],
})

const roundModule = createModule(new RoundStateClass(), {
  SERVER_RESET_SENT_ACTIONS: (state: RoundState, action: Action<undefined>) => state.remove("sentActions"),
  SERVER_ADD_SENT_ACTIONS: (state: RoundState, action: Action<ClientAction[]>) =>
    state.set("sentActions", state.get("sentActions").concat(action.payload)),
  SERVER_RESET_POWERUP_CHANCE: (state: RoundState, action: Action<undefined>) => state.remove("powerupChance"),
  SERVER_INCREASE_POWERUP_CHANCE: (state: RoundState, action: Action<undefined>) =>
    state.set("powerupChance", state.get("powerupChance") + window.getGlobal("POWERUP_CHANCE_INCREASE")),
  SERVER_NEXT_POWERUP_ID: (state: RoundState, action: Action<undefined>) =>
    state.set("nextPowerupId", state.get("nextPowerupId") + 1),
  SERVER_TICK: (state: RoundState, action: Action<number>) => {
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = action.payload
    return state.set("lastUpdate", state.get("lastUpdate") + ticksNeeded * 1000 / tickRate)
  },
  SERVER_SET_LAST_UPDATED: (state: RoundState, action: Action<number>) => state.set("lastUpdate", action.payload),
  SERVER_ADD_LOSER: (state: RoundState, action: Action<ServerPlayer>) =>
    state.set("losers", state.get("losers").concat(action.payload)),
  SERVER_SET_PLACED_POWERUPS: (state: RoundState, action: Action<Powerup[]>) =>
    state.set("placedPowerups", action.payload),
  SERVER_ADD_POWERUPS: (state: RoundState, action: Action<Powerup[]>) =>
    state.set("placedPowerups", state.get("placedPowerups").concat(action.payload)),
  SERVER_RESET_ROUND: (state: RoundState, action: Action<undefined>) => state.clear(),
})

const reducers = {
  tails: tailsModule.reducer,
  rest: roundModule.reducer,
}

interface RoundAndTailState {
  tails: TailStorage<ServerTail>,
  rest: RoundState,
}

const roundReducer = combineReducers<RoundAndTailState>(reducers)

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
  private roundStore: Store<RoundAndTailState>
  private joinable = true

  constructor(private owner: ConnectionId) {
    this.roundStore = createStore(roundReducer)
  }

  public receive(action: ServerAction, connectionId: ConnectionId) {
    switch (action.type) {
      case ADD_PLAYER: {
        this.addPlayer(connectionId)
        break
      }
      case START: {
        if (connectionId === this.owner) {
          this.startGame()
        }
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
    console.log(`resending ${this.roundStore.getState().rest.sentActions.length} actions`)
    this.roundStore.getState().rest.sentActions.forEach(conn)
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
    this.sentActions = this.roundStore.getState().rest.sentActions
    this.roundStore.dispatch(roundModule.actions.SERVER_RESET_SENT_ACTIONS(undefined))

    console.log("starting server")
    this.startRound()
  }

  private send(actions: ClientAction[]) {
    this.roundStore.dispatch(roundModule.actions.SERVER_ADD_SENT_ACTIONS(actions))
    this.clientConnections.forEach(c => {
      actions.forEach(a => c(a))
    })
  }

  private pause() {
    this.pauseDelta = Date.now() - this.roundStore.getState().rest.lastUpdate
    this.paused = true
  }

  private playerById(id: number): ServerPlayer | undefined {
    return this.players.find(p => p.id === id)
  }

  private rotateTick(player: ServerPlayer) {
    const rotSpeed = rotationSpeed(player.snake!.fatness)
    if (player.steeringLeft) {
      player.snake = rotate(player.snake!, -rotSpeed)
    }
    if (player.steeringRight) {
      player.snake = rotate(player.snake!, rotSpeed)
    }
  }

  private collides(p: number[], player: Snake) {
    return (collider: Snake) => {
      let tails = tailsForPlayer(this.roundStore.getState().tails, collider)

      // Special case for last tail for this player
      if (collider === player && tails.size > 0) {
        const last = tails.get(-1)!
        // Modify tails not not contain last part
        tails = tails.slice(0, -1)

        for (let i = 0; i < p.length; i += 2) {
          const x = p[i]
          const y = p[i + 1]

          if (containsPointExcludeLatest(last, x, y)) {
            return true
          }
        }
      }

      for (let i = 0; i < p.length; i += 2) {
        const x = p[i]
        const y = p[i + 1]

        if (tails.some(tail => serverTailContainsPoint(tail, x, y))) {
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
    if (Math.random() < this.roundStore.getState().rest.powerupChance) {
      this.roundStore.dispatch(roundModule.actions.SERVER_RESET_POWERUP_CHANCE(undefined))
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
        id: this.roundStore.getState().rest.nextPowerupId,
        location: {
          x,
          y,
        },
      })

      this.roundStore.dispatch(roundModule.actions.SERVER_NEXT_POWERUP_ID(undefined))
    } else {
      this.roundStore.dispatch(roundModule.actions.SERVER_INCREASE_POWERUP_CHANCE(undefined))
    }

    return powerups
  }

  private serverTick() {
    if (this.paused) {
      return
    }
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = Math.floor((Date.now() - this.roundStore.getState().rest.lastUpdate) * tickRate / 1000)

    this.roundStore.dispatch(roundModule.actions.SERVER_TICK(ticksNeeded))

    for (let i = 0; i < ticksNeeded; i++) {
      const playersAlive = this.players.filter(player => player.snake!.alive)

      if (playersAlive.length < 2) {
        const playerOrder = this.roundStore.getState().rest.losers.concat(playersAlive)
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
      const playersWithTail: [ServerPlayer, Tail | Gap][] = []
      for (const player of playersAlive) {
        this.rotateTick(player)
        let snake = player.snake!
        snake = tick(snake)

        // Create tail polygon, this returns undefined if it's supposed to be a hole
        const [snake2, poly] = createTailPolygon(snake)
        snake = snake2

        let tailAction: Tail | Gap = { type: GAP }

        if (poly != null) {
          if (this.players.map(p => p.snake).some(this.collides(poly.vertices, snake))) {
            snake = snake.set("alive", false)
            // TODO: randomize order
            this.roundStore.dispatch(roundModule.actions.SERVER_ADD_LOSER(player))
          }

          tailAction = {
            type: TAIL,
            payload: poly,
          }

          this.roundStore.dispatch(tailsModule.actions.ADD_TAIL(poly))
        }

        // TODO: remove order bug (e.g. by first pickingup all power ups, then applying them)
        player.snake = snake

        const filteredPlacedPowerups = this.roundStore.getState().rest.placedPowerups.filter(powerup => {
          if (this.collidesPowerup(snake, powerup)) {
            collidedPowerups.push(this.powerupPickup(player, powerup, playersAlive))
            return false
          }
          return true
        })

        this.roundStore.dispatch(roundModule.actions.SERVER_SET_PLACED_POWERUPS(filteredPlacedPowerups))

        playersWithTail.push([player, tailAction])
      }

      // collect player updates after all actions are performed
      const playerUpdates: PlayerUpdate[] = [] = playersWithTail.map(([p, t]) => {
        const snake = p.snake!

        return {
          alive: snake.alive,
          rotation: snake.rotation,
          tail: t,
          x: snake.x,
          y: snake.y,
          fatness: snake.fatness,
          id: p.id,
          powerupProgress: snake.powerupProgress.toJS(),
        }
      })

      const newPowerups = this.spawnPowerups()
      this.roundStore.dispatch(roundModule.actions.SERVER_ADD_POWERUPS(newPowerups))

      const actions = [
        updatePlayers(playerUpdates),
        ...newPowerups.map(spawnPowerup),
        ...collidedPowerups.map(({ snake, powerup }) => fetchPowerup(snake.id, powerup.id)),
      ]

      this.send(actions)
    }

    setTimeout(() => this.serverTick(), (this.roundStore.getState().rest.lastUpdate + (1000 / tickRate)) - Date.now())
  }

  private powerupPickup(player: ServerPlayer, powerup: Powerup, playersAlive: ServerPlayer[]) {

    switch (powerup.type) {
      case "UPSIZE": {
        playersAlive
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake = fatify(p.snake!, powerup))
        break
      }
      case "GHOST": {
        player.snake = ghostify(player.snake!, powerup)
        break
      }
      case "SPEEDDOWN_ME": {
        player.snake = speeddown(player.snake!, powerup)
        break
      }
      case "SPEEDDOWN_THEM": {
        playersAlive
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake = speeddown(p.snake!, powerup))
        break
      }
      case "SPEEDUP_ME": {
        player.snake = speedup(player.snake!, powerup)
        break
      }
      case "SPEEDUP_THEM": {
        playersAlive
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake = speedup(p.snake!, powerup))
        break
      }
      case "SWAP_ME": {
        const others = playersAlive
          .filter(p => player.id !== p.id)
        const swapIndex = Math.floor(Math.random() * others.length)
        const [snake1, snake2] = swapWith(player.snake!, others[swapIndex].snake!)
        player.snake = snake1
        others[swapIndex].snake = snake2
        break
      }
      case "SWAP_THEM": {
        const others = shuffle(playersAlive
          .filter(p => player.id !== p.id))
        if (others.length >= 2) {
          const [snake1, snake2] = swapWith(others[0].snake!, others[1].snake!)
          others[0].snake = snake1
          others[1].snake = snake2
        }
        break
      }
      case "REVERSE_THEM": {
        this.players
          .filter(p => player.id !== p.id)
          .forEach(p => p.snake = reversify(p.snake!, powerup))
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
        this.roundStore.dispatch(roundModule.actions.SERVER_SET_LAST_UPDATED(Date.now() - this.pauseDelta))
      } else {
        this.roundStore.dispatch(
          roundModule.actions.SERVER_SET_LAST_UPDATED(Date.now() - (1000 / window.getGlobal("TICK_RATE"))),
        )
      }
      this.paused = false
      this.serverTick()
    }
  }

  private startRound() {
    this.roundStore.dispatch(roundModule.actions.SERVER_RESET_ROUND(undefined))
    this.roundStore.dispatch(tailsModule.actions.RESET_TAILS(undefined))
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

      const snake = newSnake(startPoint, rotation, p.id, undefined as any)
      // WARNING: Modifies player even though this is a .map
      p.snake = snake

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
