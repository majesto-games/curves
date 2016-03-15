import { getColors, createPolygon, createConnectedPolygon, chunk } from "../game/util.js"
import { Player, containsPoint, ROTATION_SPEED } from "../game/game"

export default class Server {
  constructor(clients) {
    this.clients = clients

    const players = this.createPlayers()
    this.clients.forEach(client => client.init(players, this))

    this.players = players.map(obj => new Player(obj.name, obj.start_point, obj.color, obj.rotation))
  }

  createPlayers = () => {
    let colors = getColors(this.clients.length)

    return this.clients.map(client => {
      const name = `${client.index}`
      const start_point = { x: window.innerWidth / 2 + 300 * (client.index ? 1 : -1), y: window.innerHeight / 2 }
      const color = colors.pop()
      const rotation = Math.PI / 4//Math.random() * Math.PI * 2

      return { name, start_point, color, rotation }
    })
  };

  serverTick = () => {
    let player_updates = []
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
        const collides = collider => {
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

    this.clients.map(client => client.updatePlayers(player_updates))
  };

  rotateLeft = (index) => {
    const player = this.players[index]
    player.rotate((ROTATION_SPEED / player.fatness))
  };

  rotateRight = (index) => {
    const player = this.players[index]
    player.rotate(-(ROTATION_SPEED / player.fatness))
  };
}
