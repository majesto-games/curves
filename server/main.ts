import { getColors } from "../game/util"
import { Point, Player, containsPoint, ROTATION_SPEED } from "../game/game"
import { Client, PlayerInit } from "../game/main"

interface PlayerUpdate {
  x: number
  y: number
  rotation: number
  tailPart: number[]
  alive: boolean
}

interface Server {
  rotateLeft(index: number): void
  rotateRight(index: number): void
}

export default Server

export class LocalServer implements Server {

public players: Player[]

private clients: Client[]
private pauseDelta: number
private paused: boolean
private tickRate: number
private lastUpdate: number

  constructor(clients: Client[], tickRate: number) {
    this.clients = clients
    this.pauseDelta = 0
    this.paused = true
    this.tickRate = tickRate

    const players = this.createPlayers()
    this.clients.forEach(client => client.init(players, this))

    this.players = players.map(obj => new Player(obj.name, obj.startPoint, obj.color, obj.rotation))
  }

  public createPlayers(): PlayerInit[] {
    let colors = getColors(this.clients.length)

    return this.clients.map(client => {
      const name = `${client.index}`
      const startPoint: Point = { x: window.innerWidth / 2 + 300 * (client.index ? 1 : -1), y: window.innerHeight / 2 }
      const color = colors.pop()
      const rotation = Math.random() * Math.PI * 2

      return { name, startPoint, color, rotation }
    })
  }

  public start() {
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

  public pause() {
    this.pauseDelta = Date.now() - this.lastUpdate
    this.paused = true
  }

  public serverTick() {
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

  public rotateLeft(index: number) {
    const player = this.players[index]
    player.rotate(-(ROTATION_SPEED / player.fatness))
  }

  public rotateRight(index: number) {
    const player = this.players[index]
    player.rotate((ROTATION_SPEED / player.fatness))
  }

  protected sendUpdates(playerUpdates: any[]) {
    this.clients.map(client => client.updatePlayers(playerUpdates))
  }
}

export class PingSimServer extends LocalServer {

  private rtt: number

  constructor(clients: Client[], tickRate: number, rtt: number) {
    super(clients, tickRate)
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
    super(clients, tickRate)
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
    super(clients, tickRate)
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
