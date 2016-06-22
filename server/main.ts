import { getColors, chunk } from "../game/util"
import { Point, Player, containsPoint, ROTATION_SPEED } from "../game/game"
import { Client, PlayerInit } from "../game/main"

interface PlayerUpdate {
  x: number
  y: number
  rotation: number
  tail_part: number[]
  alive: boolean
}

interface Server {
  rotateLeft(index: number): void
  rotateRight(index: number): void
}

export default Server;

export class LocalServer implements Server {

  clients: Client[]
  pause_delta: number
  paused: boolean
  tick_rate: number
  players: Player[]
  last_update: number

  constructor(clients: Client[], tick_rate: number) {
    this.clients = clients
    this.pause_delta = 0
    this.paused = true
    this.tick_rate = tick_rate

    const players = this.createPlayers()
    this.clients.forEach(client => client.init(players, this))

    this.players = players.map(obj => new Player(obj.name, obj.start_point, obj.color, obj.rotation))
  }

  createPlayers(): PlayerInit[] {
    let colors = getColors(this.clients.length)

    return this.clients.map(client => {
      const name = `${client.index}`
      const start_point: Point = { x: window.innerWidth / 2 + 300 * (client.index ? 1 : -1), y: window.innerHeight / 2 }
      const color = colors.pop()
      const rotation = Math.random() * Math.PI * 2

      return { name, start_point, color, rotation }
    })
  }

  start() {
    if (this.paused) {
      if (this.pause_delta) {
        this.last_update = Date.now() - this.pause_delta
      } else {
        this.last_update = Date.now() - (1000 / this.tick_rate)
      }
      this.paused = false
      this.serverTick()
    }
  }

  pause() {
    this.pause_delta = Date.now() - this.last_update
    this.paused = true
  }


  serverTick() {
    if (this.paused) {
      return
    }

    const ticks_needed = Math.floor((Date.now() - this.last_update) * this.tick_rate / 1000)

    this.last_update += ticks_needed * 1000 / this.tick_rate

    for (let i = 0; i < ticks_needed; i++) {
      let player_updates: PlayerUpdate[] = []
      const players_alive = this.players.filter(player => player.alive)

      if (players_alive.length < 2) {
        return
      }

      for (let player of players_alive) {

        // Update player positions
        player.x += Math.sin(player.rotation) * player.speed
        player.y -= Math.cos(player.rotation) * player.speed

        // Edge wrapping
        if (player.x > window.innerWidth + player.fatness) {
          player.x = -player.fatness
          player.last_x = player.x - 1
          player.last_end = null
        }

        if (player.y > window.innerHeight + player.fatness) {
          player.y = -player.fatness
          player.last_y = player.y - 1
          player.last_end = null
        }

        if (player.x < -player.fatness) {
          player.x = window.innerWidth + player.fatness
          player.last_x = player.x + 1
          player.last_end = null
        }

        if (player.y < -player.fatness) {
          player.y = window.innerHeight + player.fatness
          player.last_y = player.y + 1
          player.last_end = null
        }

        // Create tail polygon, this returns null if it's supposed to be a hole
        let p = player.createTail()

        if (p !== null) {
          const collides = (collider: Player) => {
            let pt = collider.polygon_tail

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

          player.polygon_tail.push(p)
        }

        player_updates.push({
          x: player.x,
          y: player.y,
          rotation: player.rotation,
          tail_part: p,
          alive: player.alive
        })
      }

      this.sendUpdates(player_updates)
    }

    setTimeout(() => this.serverTick(), (this.last_update + (1000 / this.tick_rate)) - Date.now())
  }

  sendUpdates(player_updates: any[]) {
    this.clients.map(client => client.updatePlayers(player_updates))
  }

  rotateLeft(index: number) {
    const player = this.players[index]
    player.rotate(-(ROTATION_SPEED / player.fatness))
  }

  rotateRight(index: number) {
    const player = this.players[index]
    player.rotate((ROTATION_SPEED / player.fatness))
  }
}

export class PingSimServer extends LocalServer {
  rtt: number

  constructor(clients: Client[], tick_rate: number, rtt: number) {
    super(clients, tick_rate)
    this.rtt = rtt
  }

  sendUpdates(player_updates: any[]) {
    setTimeout(() => super.sendUpdates(player_updates), this.rtt / 2)
  }

  rotateLeft(index: number) {
    setTimeout(() => super.rotateLeft(index), this.rtt / 2)
  }

  rotateRight(index: number) {
    setTimeout(() => super.rotateRight(index), this.rtt / 2)
  }
}

export class RandomPackageLossSimServer extends LocalServer {
  inloss: number
  outloss: number

  constructor(clients: Client[], tick_rate: number, inloss: number, outloss: number) {
    super(clients, tick_rate)
    this.inloss = inloss
    this.outloss = outloss
  }

  sendUpdates(player_updates: any[]) {
    if (Math.random() >= this.outloss) {
      super.sendUpdates(player_updates)
    }
  }

  rotateLeft(index: number) {
    if (Math.random() >= this.inloss) {
      super.rotateLeft(index)
    }
  }

  rotateRight(index: number) {
    if (Math.random() >= this.inloss) {
      super.rotateRight(index)
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
  networkIn: NetworkSettings
  buffersIn: InPackage[][]
  networkOut: NetworkSettings
  bufferOut: any[][] = []

  constructor(clients: Client[], tick_rate: number, networkIn: NetworkSettings, networkOut: NetworkSettings) {
    super(clients, tick_rate)
    this.networkIn = networkIn
    this.networkOut = networkOut
    this.buffersIn = clients.map(() => [])
    setInterval(() => this.sendOut(), networkOut.tick_ms)
    setInterval(() => this.sendIn(), networkIn.tick_ms)
  }

  sendOut() {
    if (this.bufferOut.length > 0) {
      const outPackage = this.bufferOut.shift()
      super.sendUpdates(outPackage)
    }
  }

  sendIn() {
    this.buffersIn.forEach(buffer => {
      if (buffer.length > 0) {
      const inPackage = buffer.shift()
      if (inPackage.type == InType.LEFT) {
        super.rotateLeft(inPackage.index)
      } else if(inPackage.type == InType.RIGHT) {
        super.rotateRight(inPackage.index)
      }
    }
    })
  }

  sendUpdates(player_updates: any[]) {
    if (this.bufferOut.length < this.networkOut.buffer_size / this.players.length) {
      this.bufferOut.push(player_updates)
    } else {
      console.log("Lost package sendUpdates")
    }
  }

  rotateLeft(index: number) {
    if (this.buffersIn[index].length < this.networkIn.buffer_size) {
      this.buffersIn[index].push({index, type: InType.LEFT})
    } else {
      console.log("Lost package rotateLeft " + index)
    }
  }

  rotateRight(index: number) {
    if (this.buffersIn[index].length < this.networkIn.buffer_size) {
      this.buffersIn[index].push({index, type: InType.RIGHT})
    } else {
      console.log("Lost package rotateRight " + index)
    }
  }
}
