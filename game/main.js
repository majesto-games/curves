import { Graphics, autoDetectRenderer, Container, utils } from "pixi.js"
import generateName from "sillyname"

import { getColors, createPolygon, createConnectedPolygon, chunk } from "./util.js"
import { Player, containsPoint, TICK_RATE } from "./game"
import Server from "../server/main"
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
      player.alive = update.alive

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

class Overlay {
  constructor(graphics) {
    this.graphics = graphics
    this.overlayText = new PIXI.Text("", { font: "64px Impact", fill: "white" })
    this.overlayText.anchor = { x: 0.5, y: 0.5 }
    this.overlayText.x = window.innerWidth / 2
    this.overlayText.y = window.innerHeight / 2

    this.overlay = new Graphics()
    this.overlay.beginFill(0x000000, 0.5)
    this.overlay.drawRect(0, 0, window.innerWidth, window.innerHeight)
    this.overlay.endFill()
    this.overlay.addChild(this.overlayText)
  }

  added = false

  addOverlay = text => {
    this.overlayText.text = text
    if (!this.added) {
      this.graphics.addChild(this.overlay)
      this.added = true
    }
  };

  removeOverlay = () => {
    this.graphics.removeChild(this.overlay)
    this.added = false
  }
}

const overlay = new Overlay(graphics)

// Set a freeze time of 2 seconds
const timer = setInterval(() => {
  pause_timer--
  overlay.addOverlay(`GAME STARTS IN ${pause_timer}`)

  if (pause_timer <= 0) {
    clearInterval(timer)
    overlay.removeOverlay()
    setInterval(server.serverTick, 1000 / TICK_RATE)
  }
}, 1000)


const renderer = autoDetectRenderer(window.innerWidth, window.innerHeight, { backgroundColor: 0x000000 })

// Remove pesky pixi.js banner from console
utils._saidHello = true

let running = true

const draw = function () {

  if (!running) {
    return
  }

  // Just render the players from client #0
  // The other client has keyboard control though.
  const players = clients[0].players

  const players_alive = players.filter(p => p.alive)

  if (players_alive.length < 2) {
    overlay.addOverlay(`GAME OVER. Winner is ${players_alive[0].name}`)
    running = false
  } else {
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
