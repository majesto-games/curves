import { getColors, frequency } from "game/util"
import { Point, Player, ROTATION_SPEED, Powerup, ActivePowerup, PowerupType } from "game/player"
import { containsPoint, ServerTail, TailStorage } from "game/tail"
import PriorityQueue = require("fastpriorityqueue")
import {
  PlayerUpdate,
  Gap,
  GAP,
  TAIL,
  Tail,
} from "./actions"

import { ClientConnection } from "./connections"

export const SERVER_WIDTH = 1280
export const SERVER_HEIGHT = 720

const POWERUP_CHANCE_BASE = 0.0005
const POWERUP_CHANCE_INCREASE = 0.00001

interface AlmostPlayerInit {
  name: string
  startPoint: Point
  color: number
  rotation: number
  connectionId: any
  id: number
}

function fastDistance(x1: number, y1: number, x2: number, y2: number) {
  const a = x1 - x2
  const b = y1 - y2
  return (a * a) + (b * b)
}

function rotationSpeed(fatness: number) {
  return ROTATION_SPEED / (10 + fatness) - 0.02
}

class RoundState {
  public tails = new TailStorage(() => new ServerTail())
  public activePowerups = new PriorityQueue<ActivePowerup>((a, b) => a.activeTo < b.activeTo)
  public placedPowerups: Powerup[] = []
  public nextPowerupId = 0
  public powerupChance = POWERUP_CHANCE_BASE
  public lastUpdate: number
}

export class Server {
  // TODO: How to reset the players?
  public players: Player[] = []
  private playerInits: AlmostPlayerInit[] = []

  private clientConnections: ClientConnection[] = []
  private pauseDelta: number = 0
  private paused: boolean = true
  private colors: number[] = getColors(7)
  private round: RoundState

  constructor(private tickRate: number) {
    this.round = new RoundState()
  }

  public addConnection(conn: ClientConnection) {
    this.clientConnections.push(conn)
    console.log("connection added, total: ", this.clientConnections.length)
  }

  public addPlayer(connectionId: any) {
    if (this.playerInits.length > 2) {
      return
    }

    const id = this.players.length + 1
    const name = `${id}`
    const startPoint: Point = {
      x: SERVER_WIDTH / 2 + (SERVER_WIDTH / 4) * (this.players.length ? 1 : -1),
      y: SERVER_HEIGHT / 2,
    }
    const color = this.colors.pop() as number
    const rotation = Math.random() * Math.PI * 2

    const playerInit: AlmostPlayerInit = { name, startPoint, color, rotation, connectionId, id }
    const player = new Player(name, startPoint, color, rotation, id, undefined, connectionId)
    this.round.tails.initPlayer(player)
    console.log("Added player with connection id:", connectionId)

    this.playerInits.push(playerInit)
    this.players.push(player)

    if (this.playerInits.length > 1) {
      this.send(c => {
        const playerInits = this.playerInits.map(v => {
          return {
            name: v.name,
            startPoint: v.startPoint,
            color: v.color,
            rotation: v.rotation,
            isOwner: v.connectionId === c.id,
            id: v.id,
          }
        })
        c.start(playerInits)
      })
      console.log("starting server")
      this.start()
    }
  }

  public rotateLeft(id: number, connectionId: any) {
    const player = this.playerById(id)
    if (player != null && player.owner === connectionId) {
      player.rotate(-rotationSpeed(player.fatness))
    }
  }

  public rotateRight(id: number, connectionId: any) {
    const player = this.playerById(id)
    if (player != null && player.owner === connectionId) {
      player.rotate(rotationSpeed(player.fatness))
    }
  }

  private send(f: (client: ClientConnection) => void) {
    this.clientConnections.forEach(f)
  }

  private pause() {
    this.pauseDelta = Date.now() - this.round.lastUpdate
    this.paused = true
  }

  private playerById(id: number): Player | undefined {
    return this.players.find(p => p.id === id)
  }

  private moveTick(player: Player) {
    player.x += Math.sin(player.rotation) * player.speed
    player.y -= Math.cos(player.rotation) * player.speed
  }

  private wrapEdge(player: Player) {
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

  private collides(p: number[], player: Player) {
    return (collider: Player) => {
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

  private collidesPowerup(player: Player, powerup: Powerup) {
    const { x, y, fatness } = player
    const { location } = powerup
    return fastDistance(x, y, location.x, location.y) < (fatness * fatness) + (16 * 16)
  }

  private spawnPowerups() {
    const powerups: Powerup[] = []
    if (Math.random() < this.round.powerupChance) {
      this.round.powerupChance = POWERUP_CHANCE_BASE
      const x = Math.round(Math.random() * SERVER_WIDTH)
      const y = Math.round(Math.random() * SERVER_HEIGHT)
      const powerupType = frequency<PowerupType>([[0.7, "UPSIZE"], [0.3, "GHOST"]])
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
      this.round.powerupChance += POWERUP_CHANCE_INCREASE
    }

    return powerups
  }

  private serverTick() {
    if (this.paused) {
      return
    }

    const ticksNeeded = Math.floor((Date.now() - this.round.lastUpdate) * this.tickRate / 1000)

    this.round.lastUpdate += ticksNeeded * 1000 / this.tickRate

    for (let i = 0; i < ticksNeeded; i++) {
      let playerUpdates: PlayerUpdate[] = []
      const playersAlive = this.players.filter(player => player.alive)

      if (playersAlive.length < 2) {
        this.send(c => c.end((playersAlive[0] && playersAlive[0].id)))
        return
      }

      let peek = this.round.activePowerups.peek()
      while (peek && peek.activeTo < Date.now()) {
        this.round.activePowerups.poll()
        switch (peek.type) {
          case "UPSIZE": {
            this.players
              .filter(p => peek!.activator !== p.id)
              .forEach(p => p.fatness -= 8)
            break
          }
          case "GHOST": {
            const player = this.playerById(peek!.activator)
            player!.unghostify()
            break
          }
          default:
        }

        peek = this.round.activePowerups.peek()
      }

      const collidedPowerups: Powerup[] = []

      for (let player of playersAlive) {

        this.moveTick(player)
        this.wrapEdge(player)

        // Create tail polygon, this returns undefined if it's supposed to be a hole
        const p = player.createTailPart()

        let tailAction: Tail | Gap = { type: GAP }

        if (p != null) {
          if (this.players.some(this.collides(p.vertices, player))) {
            player.alive = false
          }

          tailAction = {
            type: TAIL,
            payload: p,
          }

          this.round.tails.add(p)
        }

        this.round.placedPowerups = this.round.placedPowerups.filter(powerup => {
          if (this.collidesPowerup(player, powerup)) {
            collidedPowerups.push(powerup)

            switch (powerup.type) {
              case "UPSIZE": {
                this.players
                  .filter(p => player.id !== p.id)
                  .forEach(p => p.fatness += 8)
                break
              }
              case "GHOST": {
                player.ghostify()
              }
              default:
            }

            this.round.activePowerups.add({
              type: powerup.type,
              id: powerup.id,
              activator: player.id,
              activeTo: Date.now() + 10000,
            })

            return false
          }
          return true
        })

        playerUpdates.push({
          alive: player.alive,
          rotation: player.rotation,
          tail: tailAction,
          x: player.x,
          y: player.y,
          fatness: player.fatness,
        })
      }

      const newPowerups = this.spawnPowerups()
      this.round.placedPowerups = this.round.placedPowerups.concat(newPowerups)

      this.send(c => {
        c.updatePlayers(playerUpdates)
        newPowerups.forEach(p => c.spawnPowerup(p))
        collidedPowerups.forEach(p => c.fetchPowerup(p))
      })
    }

    setTimeout(() => this.serverTick(), (this.round.lastUpdate + (1000 / this.tickRate)) - Date.now())
  }

  private start() {
    if (this.paused) {
      if (this.pauseDelta) {
        this.round.lastUpdate = Date.now() - this.pauseDelta
      } else {
        this.round.lastUpdate = Date.now() - (1000 / this.tickRate)
      }
      this.paused = false
      this.serverTick()
    }
  }
}
