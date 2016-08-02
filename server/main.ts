import { getColors } from "../game/util"
import { Point, Player, containsPoint, ROTATION_SPEED } from "../game/game"
import { Client } from "../game/main"
import {
  PlayerUpdate,
  PlayerInit,
} from "./actions"

import { ClientConnection } from "./connections"

export const SERVER_WIDTH = 1280
export const SERVER_HEIGHT = 720

export class Server {

  public players: Player[] = []

  private playerInits: PlayerInit[] = []
  private clientConnections: ClientConnection[] = []
  private pauseDelta: number = 0
  private paused: boolean = true
  private tickRate: number
  private lastUpdate: number
  private colors: number[] = getColors(7)

  constructor(tickRate: number) {
    this.tickRate = tickRate
  }

  public addConnection(conn: ClientConnection) {
    this.clientConnections.push(conn)
    console.log("connection added, total: ", this.clientConnections.length)
  }

  public addPlayer() {
    const id = this.players.length + 1
    const name = `${id}`
    const startPoint: Point = {
      x: SERVER_WIDTH / 2 + 300 * (this.players.length ? 1 : -1),
      y: SERVER_HEIGHT / 2,
    }
    const color = this.colors.pop() as number
    const rotation = Math.random() * Math.PI * 2

    const playerInit = { name, startPoint, color, rotation, isOwner: true }
    const player = new Player(name, startPoint, color, rotation, null, id)

    this.playerInits.push(playerInit)
    this.players.push(player)

    if (this.playerInits.length > 1) {
      this.send(c => c.start(this.playerInits))
      console.log("starting server")
      this.start()
    }
  }

  public rotateLeft(index: number) {
    const player = this.players[index]
    console.log("rotateLeft", index, player)
    player.rotate(-(ROTATION_SPEED / player.fatness))
  }

  public rotateRight(index: number) {
    const player = this.players[index]
    console.log("rotateRight", index, player)
    player.rotate((ROTATION_SPEED / player.fatness))
  }

  private send(f: (client: ClientConnection) => void) {
    this.clientConnections.forEach(f)
  }

  private pause() {
    this.pauseDelta = Date.now() - this.lastUpdate
    this.paused = true
  }

  private serverTick() {
    if (this.paused) {
      return
    }

    const ticksNeeded = Math.floor((Date.now() - this.lastUpdate) * this.tickRate / 1000)

    this.lastUpdate += ticksNeeded * 1000 / this.tickRate

    for (let i = 0; i < ticksNeeded; i++) {
      let playerUpdates: PlayerUpdate[] = []
      const playersAlive = this.players.filter(player => player.alive)

      if (playersAlive.length < 2) {
        this.send(c => c.end((playersAlive[0] && playersAlive[0].id) || null))
        return
      }

      for (let player of playersAlive) {

        // Update player positions
        player.x += Math.sin(player.rotation) * player.speed
        player.y -= Math.cos(player.rotation) * player.speed

        // Edge wrapping
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

        // Create tail polygon, this returns null if it's supposed to be a hole
        const p = player.createTail()

        if (p !== null) {
          const collides = (collider: Player) => {
            let pt = collider.polygonTail

            if (collider === player) {
              pt = pt.slice(0, -1)
            }

            for (let i = 0; i < p.length; i += 2) {
              const x = p[i]
              const y = p[i + 1]

              if (pt.some(poly => containsPoint(poly, x, y))) {
                return true
              }
            }
            return false
          }

          if (this.players.some(collides)) {
            player.alive = false
          }

          player.polygonTail.push(p)
        }

        playerUpdates.push({
          alive: player.alive,
          rotation: player.rotation,
          tailPart: p,
          x: player.x,
          y: player.y,
        })
      }

      this.send(c => c.updatePlayers(playerUpdates))
    }

    setTimeout(() => this.serverTick(), (this.lastUpdate + (1000 / this.tickRate)) - Date.now())
  }

  private start() {
    if (this.paused) {
      if (this.pauseDelta) {
        this.lastUpdate = Date.now() - this.pauseDelta
      } else {
        this.lastUpdate = Date.now() - (1000 / this.tickRate)
      }
      this.paused = false
      this.serverTick()
    }
  }
}
