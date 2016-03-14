import { Graphics, autoDetectRenderer, Container, utils } from "pixi.js"
import generateName from "sillyname"

import { getColors, createPolygon, createConnectedPolygon, chunk } from "./util.js"
import { Player, containsPoint } from "./game"
import keys from "./keys.js"

const middle = { x: (window.innerWidth) / 2, y: (window.innerHeight) / 2 }

class Client {
  constructor(index) {
    this.index = index
    this.players = []
    this.keys = null
  }

  updatePlayers = (player_updates) => {
    for (let i = 0; i < player_updates.length; i++) {
      const update = player_updates[i]
      const player = this.players[i]

      player.x = update.x
      player.y = update.y
      player.rotation = update.rotation

      if (update.tail_part) {
        graphics.beginFill(player.color)
        graphics.drawPolygon(update.tail_part)
        graphics.endFill()
      }
    }
  };

  init = (players, server) => {
    this.players = players.map(player => createPlayer(player.name, player.start_point, player.color, player.rotation))
    this.server = server
  };

  rotateLeft = () => {
    this.server.rotateLeft(this.index)
  };

  rotateRight = () => {
    this.server.rotateRight(this.index)
  };
}

class Server {
  constructor(clients) {
    this.clients = clients

    const players = this.createPlayers()
    this.clients.forEach(client => client.init(players, this))

    this.players = players.map(obj => new Player(obj.name, obj.start_point, obj.color, obj.rotation))
  }

  createPlayers = () => {
    let colors = getColors(this.clients.length)

    return this.clients.map(client => {
      const name = `#{client.index}`
      const start_point = { x: window.innerWidth / 2 + 300 * (client.index ? 1 : -1), y: window.innerHeight / 2 }
      const color = colors.pop()
      const rotation = Math.random() * Math.PI * 2

      return { name, start_point, color, rotation }
    })
  };

  serverTick = () => {
    let player_updates = []

    for (let player of this.players) {

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
        player.polygon_tail.push(p)
      }

      player_updates.push({
        x: player.x,
        y: player.y,
        rotation: player.rotation,
        tail_part: p,
      })
    }

    this.clients.map(client => client.updatePlayers(player_updates))
  };

  rotateLeft = (index) => {
    this.players[index].rotateLeft()
  };

  rotateRight = (index) => {
    this.players[index].rotateRight()
  };
}

const clients = [new Client(0), new Client(1)]

clients[0].keys = { left: keys.A, right: keys.D }
clients[1].keys = { left: keys.LEFT, right: keys.RIGHT }

const server = new Server(clients)

// Browser renderer stuff below

function createPlayer (name, start_point, color, rotation) {
  const player = new Player(name, start_point, color, rotation)

  const graphics = new Graphics()
  graphics.beginFill(color)
  graphics.drawCircle(0, 0, 0.5)
  graphics.position.x = start_point.x
  graphics.position.y = start_point.x
  graphics.endFill()

  player.graphics = graphics

  return player
}

function updatePlayerGraphics (player) {
  player.graphics.x = player.x
  player.graphics.y = player.y
  player.graphics.scale = { x: player.fatness, y: player.fatness }
}

const container = new Container()
const graphics = new Graphics()

for (let player of clients[0].players) {
  container.addChild(player.graphics)
}

container.addChild(graphics)

let pause_timer = 3 // Seconds

// Draw initial state to show the position of the players
server.serverTick()

// Set a freeze time of 2 seconds
const timer = setInterval(() => {
  pause_timer--
  pausedText.text = `GAME STARTS IN ${pause_timer}`

  if (pause_timer <= 0) {
    clearInterval(timer)
    graphics.removeChild(backdrop)
    graphics.removeChild(pausedText)
    setInterval(server.serverTick, 50)
  }
}, 1000)

const pausedText = new PIXI.Text(`GAME STARTS IN ${pause_timer}`, { font: "64px Impact", fill: "white" })
pausedText.x = window.innerWidth / 2 - pausedText.width / 2
pausedText.y = window.innerHeight / 2 - pausedText.height / 2

const backdrop = new Graphics()
backdrop.beginFill(0x000000, 0.5)
backdrop.drawRect(0, 0, window.innerWidth, window.innerHeight)
backdrop.endFill()

graphics.addChild(backdrop)
graphics.addChild(pausedText)

const renderer = autoDetectRenderer(window.innerWidth, window.innerHeight, { backgroundColor: 0x000000 })

// Remove pesky pixi.js banner from console
utils._saidHello = true

const draw = function () {

  // Just render the players from client #0
  // The other client has keyboard control though.
  const players = clients[0].players

  // const alive = players.filter(p => !p.dead)

  // if (alive.length < 2) {
  //   graphics.beginFill(0x000000, 0.85)
  //   graphics.drawRect(0, 0, window.innerWidth, window.innerHeight)
  //   graphics.endFill()
  //   graphics.addChild(winnerText(alive[0]))
  //   running = false
  // } else

  if (pause_timer === 0) {
    clients.forEach(client => {
      if (client.keys.left.pressed) {
        client.rotateLeft()
      }

      if (client.keys.right.pressed) {
        client.rotateRight()
      }
    })

    for (let player of players) {
      updatePlayerGraphics(player)
    }
  }

  renderer.render(container)
  requestAnimationFrame(draw)
}

window.onresize = (e) => {
  renderer.view.style.width = window.innerWidth + "px"
  renderer.view.style.height = window.innerHeight + "px"

  renderer.resize(window.innerWidth, window.innerHeight)
}

document.getElementById("game").appendChild(renderer.view)

draw()
