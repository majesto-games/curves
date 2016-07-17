import { Graphics, autoDetectRenderer, Container } from "pixi.js"

import { Point, Player, TICK_RATE } from "./game"
import Server, { BandwidthSimServer as ServerImpl } from "../server/main"
import pressedKeys, { KEYS } from "./keys"
import * as quickconnect from "rtc-quickconnect"

import * as R from "ramda"

// const middle = { x: (window.innerWidth) / 2, y: (window.innerHeight) / 2 }

// Remove pesky pixi.js banner from console
// utils._saidHello = true

interface ClientKeys {
  left: KEYS
  right: KEYS
}

export interface PlayerInit {
  name: string
  startPoint: Point
  color: number
  rotation: number
}

export class Client {

  public keys: ClientKeys
  public players: Player[]
  public index: number

  private server: Server

  constructor(index: number) {
    this.index = index
    this.players = []
    this.keys = null
  }

  public updatePlayers = (playerUpdates: any[]) => {
    for (let i = 0; i < playerUpdates.length; i++) {
      const update = playerUpdates[i]
      const player = this.players[i]

      player.x = update.x
      player.y = update.y
      player.rotation = update.rotation
      player.alive = update.alive

      if (update.tailPart) {
        graphics.beginFill(player.color)
        graphics.drawPolygon(update.tailPart)
        graphics.endFill()
      }
    }
  }

  public init = (players: PlayerInit[], server: Server) => {
    this.players = players.map(player => createPlayer(player.name, player.startPoint, player.color, player.rotation))
    this.server = server
  }

  public rotateLeft = () => {
    this.server.rotateLeft(this.index)
  }

  public rotateRight = () => {
    this.server.rotateRight(this.index)
  }
}

quickconnect("http://curves-p2p.herokuapp.com/", { room: "qc-simple-demo" })
  .on("call:started", function (id, pc, data) {
    console.log("we have a new connection to: " + id);
  });

const clients = [new Client(0), new Client(1)]

clients[0].keys = { left: KEYS.A, right: KEYS.D }
clients[1].keys = { left: KEYS.LEFT, right: KEYS.RIGHT }

const server = new ServerImpl(clients, TICK_RATE, {buffer_size: 10, tick_ms: 10}, {buffer_size: 10, tick_ms: 10})

// Browser renderer stuff below

function createPlayer (name: string, startPoint: Point, color: number, rotation: number) {
  const player = new Player(name, startPoint, color, rotation)

  const graphics = new Graphics()
  graphics.beginFill(color)
  graphics.drawCircle(0, 0, 0.5)
  graphics.endFill()

  player.graphics = graphics
  updatePlayerGraphics(player)

  return player
}

function updatePlayerGraphics (player: Player) {
  player.graphics.x = player.x
  player.graphics.y = player.y
  player.graphics.scale = new PIXI.Point(player.fatness, player.fatness)
}

const container = new Container()
const graphics = new Graphics()

for (let player of clients[0].players) {
  container.addChild(player.graphics)
}

container.addChild(graphics)

let pauseTimer = 3 // Seconds

class Overlay {

  private graphics: PIXI.Graphics
  private overlayText: PIXI.Text
  private overlay: PIXI.Graphics
  private startPos: PIXI.Graphics
  private added = false

  constructor(g: PIXI.Graphics) {
    this.graphics = g
    this.overlayText = new PIXI.Text("", { fill: "white", font: "64px Courier New" })
    this.overlayText.anchor = new PIXI.Point(0.5, 0.5)
    this.overlayText.x = window.innerWidth / 2
    this.overlayText.y = window.innerHeight / 3

    this.overlay = new Graphics()
    this.overlay.beginFill(0x000000, 0.5)
    this.overlay.drawRect(0, 0, window.innerWidth, window.innerHeight)
    this.overlay.endFill()
    this.overlay.addChild(this.overlayText)

    this.startPos = new Graphics()
    this.overlay.addChild(this.startPos)
  }

  public addOverlay = (text: string, players: Player[], playersText: string[]) => {
    this.overlayText.text = text
    if (!this.added) {
      // TODO: Remove this hack
      R.zip(players, playersText).forEach(([player, pt]) => {
        const g = new PIXI.Text(pt, { fill: player.color, font: "24px Courier New" })
        g.anchor = new PIXI.Point(0.5, 1.1)
        g.rotation = player.rotation
        g.x = player.x
        g.y = player.y
        this.startPos.addChild(g)
      })
      this.graphics.addChild(this.overlay)
      this.added = true
    }
  }

  public removeOverlay = () => {
    this.graphics.removeChild(this.overlay)
    this.startPos.removeChildren()
    this.added = false
  }
}

const overlay = new Overlay(graphics)

overlay.addOverlay(`GAME STARTS IN ${pauseTimer}`, clients[0].players, ["A ^ D", "< ^ >"])

// Set a freeze time of 2 seconds
const timer = setInterval(() => {
  pauseTimer--
  overlay.addOverlay(`GAME STARTS IN ${pauseTimer}`, clients[0].players, ["A ^ D", "< ^ >"])

  if (pauseTimer <= 0) {
    clearInterval(timer)
    overlay.removeOverlay()
    server.start()
  }
}, 1000)

const renderer = autoDetectRenderer(window.innerWidth, window.innerHeight,
  { antialias: true, backgroundColor: 0x000000 })

let running = true

const draw = function () {

  if (!running) {
    return
  }

  // Just render the players from client #0
  // The other client has keyboard control though.
  const players = clients[0].players

  const playersAlive = players.filter(p => p.alive)

  if (playersAlive.length < 2) {
    overlay.addOverlay(`GAME OVER`, playersAlive, ["WINNER"])
    running = false
  } else {
    if (pauseTimer <= 0) {
      clients.forEach(client => {
        if (pressedKeys[client.keys.left]) {
          client.rotateLeft()
        }

        if (pressedKeys[client.keys.right]) {
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
