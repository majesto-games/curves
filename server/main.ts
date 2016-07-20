import { getColors } from "../game/util"
import { Point, Player, containsPoint, ROTATION_SPEED } from "../game/game"
import { Client, PlayerInit } from "../game/main"

import * as quickconnect from "rtc-quickconnect"
import freeice = require("freeice")

export interface PlayerUpdate {
  x: number
  y: number
  rotation: number
  tailPart: number[]
  alive: boolean
}

export interface ServerConnection {
  addPlayer(): void
  rotateLeft(index: number): void
  rotateRight(index: number): void
}

export interface ClientConnection {
  updatePlayers(playerUpdates: PlayerUpdate[]): void
  start(playerInits: PlayerInit[]): void
}

export class LocalServerConnection implements ServerConnection {

  private server: LocalServer

  constructor(server: LocalServer) {
    this.server = server
  }

  public addPlayer() {
    this.server.addPlayer()
  }

  public rotateLeft(id: number) {
    this.server.rotateLeft(id)
  }

  public rotateRight(id: number) {
    this.server.rotateRight(id)
  }
}

export class LocalClientConnection implements ClientConnection {

  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  public updatePlayers(playerUpdates: PlayerUpdate[]) {
    this.client.updatePlayers(playerUpdates)
  }

  public start(playerInits: PlayerInit[]) {
    this.client.start(playerInits)
  }

}

export class NetworkConnection {

  private server: LocalServer

  constructor(server: LocalServer) {
    this.server = server
  }

  public rotateLeft(index: number) {
    this.server.rotateLeft(index)
  }

  public rotateRight(index: number) {
    this.server.rotateRight(index)
  }
}

export class LocalServer {

  public players: Player[] = []

  private playerInits: PlayerInit[] = []
  private clientConnections: LocalClientConnection[] = []
  private pauseDelta: number = 0
  private paused: boolean = true
  private tickRate: number
  private lastUpdate: number
  private colors: number[] = getColors(7)

  constructor(tickRate: number) {
    this.tickRate = tickRate
  }

  public addConnection(conn: LocalClientConnection) {
    this.clientConnections.push(conn)
  }

  public addPlayer() {
    const id = this.players.length + 1
    const name = `${id}`
    const startPoint: Point = {
      x: window.innerWidth / 2 + 300 * (this.players.length ? 1 : -1),
      y: window.innerHeight / 2,
    }
    const color = this.colors.pop()
    const rotation = Math.random() * Math.PI * 2

    const playerInit = { name, startPoint, color, rotation, isOwner: true }
    const player = new Player(name, startPoint, color, rotation, null, id)

    this.playerInits.push(playerInit)
    this.players.push(player)

    if (this.playerInits.length > 1) {
      this.clientConnections.forEach(conn => conn.start(this.playerInits))
      this.start()
    }
  }

  public rotateLeft(index: number) {
    const player = this.players[index]
    player.rotate(-(ROTATION_SPEED / player.fatness))
  }

  public rotateRight(index: number) {
    const player = this.players[index]
    player.rotate((ROTATION_SPEED / player.fatness))
  }

  protected sendUpdates(playerUpdates: any[]) {
    this.clientConnections.map(client => client.updatePlayers(playerUpdates))
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
        return
      }

      for (let player of playersAlive) {

        // Update player positions
        player.x += Math.sin(player.rotation) * player.speed
        player.y -= Math.cos(player.rotation) * player.speed

        // Edge wrapping
        if (player.x > window.innerWidth + player.fatness) {
          player.x = -player.fatness
          player.lastX = player.x - 1
          player.lastEnd = null
        }

        if (player.y > window.innerHeight + player.fatness) {
          player.y = -player.fatness
          player.lastY = player.y - 1
          player.lastEnd = null
        }

        if (player.x < -player.fatness) {
          player.x = window.innerWidth + player.fatness
          player.lastX = player.x + 1
          player.lastEnd = null
        }

        if (player.y < -player.fatness) {
          player.y = window.innerHeight + player.fatness
          player.lastY = player.y + 1
          player.lastEnd = null
        }

        // Create tail polygon, this returns null if it's supposed to be a hole
        let p = player.createTail()

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

      this.sendUpdates(playerUpdates)
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

export class NetworkServer extends LocalServer {

}

export class PingSimServer extends LocalServer {

  private rtt: number

  constructor(clients: Client[], tickRate: number, rtt: number) {
    super(tickRate)
    this.rtt = rtt
  }

  public rotateLeft(index: number) {
    setTimeout(() => super.rotateLeft(index), this.rtt / 2)
  }

  public rotateRight(index: number) {
    setTimeout(() => super.rotateRight(index), this.rtt / 2)
  }

  protected sendUpdates(playerUpdates: any[]) {
    setTimeout(() => super.sendUpdates(playerUpdates), this.rtt / 2)
  }
}

export class RandomPackageLossSimServer extends LocalServer {

  private inLoss: number
  private outLoss: number

  constructor(clients: Client[], tickRate: number, inLoss: number, outLoss: number) {
    super(tickRate)
    this.inLoss = inLoss
    this.outLoss = outLoss
  }

  public rotateLeft(index: number) {
    if (Math.random() >= this.inLoss) {
      super.rotateLeft(index)
    }
  }

  public rotateRight(index: number) {
    if (Math.random() >= this.inLoss) {
      super.rotateRight(index)
    }
  }

  protected sendUpdates(playerUpdates: any[]) {
    if (Math.random() >= this.outLoss) {
      super.sendUpdates(playerUpdates)
    }
  }
}

interface NetworkSettings {
  buffer_size: number
  tick_ms: number
}

enum InType {
  LEFT,
  RIGHT
}

interface InPackage {
  index: number
  type: InType
}

export class BandwidthSimServer extends LocalServer {

  private networkIn: NetworkSettings
  private buffersIn: InPackage[][]
  private networkOut: NetworkSettings
  private bufferOut: any[][] = []

  constructor(clients: Client[], tickRate: number, networkIn: NetworkSettings, networkOut: NetworkSettings) {
    super(tickRate)
    this.networkIn = networkIn
    this.networkOut = networkOut
    this.buffersIn = clients.map(() => [])
    setInterval(() => this.sendOut(), networkOut.tick_ms)
    setInterval(() => this.sendIn(), networkIn.tick_ms)
  }

  public rotateLeft(index: number) {
    if (this.buffersIn[index].length < this.networkIn.buffer_size) {
      this.buffersIn[index].push({index, type: InType.LEFT})
    } else {
      console.log("Lost package rotateLeft " + index)
    }
  }

  public rotateRight(index: number) {
    if (this.buffersIn[index].length < this.networkIn.buffer_size) {
      this.buffersIn[index].push({index, type: InType.RIGHT})
    } else {
      console.log("Lost package rotateRight " + index)
    }
  }

  protected sendUpdates(playerUpdates: any[]) {
    if (this.bufferOut.length < this.networkOut.buffer_size / this.players.length) {
      this.bufferOut.push(playerUpdates)
    } else {
      console.log("Lost package sendUpdates")
    }
  }

  private sendOut() {
    if (this.bufferOut.length > 0) {
      const outPackage = this.bufferOut.shift()
      super.sendUpdates(outPackage)
    }
  }

  private sendIn() {
    this.buffersIn.forEach(buffer => {
      if (buffer.length > 0) {
        const inPackage = buffer.shift()

        if (inPackage.type === InType.LEFT) {
          super.rotateLeft(inPackage.index)
        } else if (inPackage.type === InType.RIGHT) {
          super.rotateRight(inPackage.index)
        }
      }
    })
  }
}
