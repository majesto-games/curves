import { Graphics, autoDetectRenderer, Container } from "pixi.js"
import { Point, Player, TICK_RATE } from "./game"
import {
  PlayerUpdate,
  PlayerInit,
} from "../server/actions"

import {
  Server,
} from "../server/main"

import {
  ServerConnection,
  LocalServerConnection,
  NetworkClientConnection,
  NetworkServerConnection,
  LocalClientConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount
} from "../server/connections"

import {
  mapServerActions,
  mapClientActions,
} from "../server/reducers"

import pressedKeys, { KEYS } from "./keys"

import * as R from "ramda"

// const middle = { x: (window.innerWidth) / 2, y: (window.innerHeight) / 2 }

// Remove pesky pixi.js banner from console
// utils._saidHello = true

const keyCombos = [{ left: KEYS.LEFT, right: KEYS.RIGHT }, { left: KEYS.A, right: KEYS.D }]

const container = new Container()
const graphics = new Graphics()

export interface ClientKeys {
  left: KEYS
  right: KEYS
}

export class Client {

  public players: Player[] = []
  public id: number

  private connection: ServerConnection

  constructor(connection: ServerConnection) {
    this.connection = connection
  }

  public updatePlayers = (playerUpdates: PlayerUpdate[]) => {
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

  public start = (players: PlayerInit[]) => {
    console.log("starting with", players)
    this.players = players.map((player, i) => createPlayer(player.name, player.startPoint,
      player.color, player.rotation, player.isOwner, i))
  }

  public rotateLeft = (id: number) => {
    this.connection.rotateLeft(id)
  }

  public rotateRight = (id: number) => {
    this.connection.rotateRight(id)
  }

  public end = (winnerId: number | null) => {
    alert(winnerId)
  }
}

function createPlayer(name: string, startPoint: Point, color: number,
  rotation: number, isOwner: boolean, id: number) {
  let keys: ClientKeys | null = null

  if (isOwner) {
    keys = keyCombos.pop() || null
  }

  const player = new Player(name, startPoint, color, rotation, keys, id)

  const graphics = new Graphics()
  graphics.beginFill(color)
  graphics.drawCircle(0, 0, 0.5)
  graphics.endFill()

  player.graphics = graphics
  updatePlayerGraphics(player)

  return player
}

function updatePlayerGraphics(player: Player) {
  player.graphics.x = player.x
  player.graphics.y = player.y
  player.graphics.scale = new PIXI.Point(player.fatness, player.fatness)
}

export function createGame(room?: string) {
  return connectAndCount(room).then(([rc, memberCount]) => {
    if (memberCount > 1) { // not server
      console.log("Not server")
      return clientDataChannel(rc).then((dc) => {
        const conn = new NetworkServerConnection(dc)
        const client = new Client(conn)
        const m = mapClientActions(client)
        dc.onmessage = (evt: any) => {
          console.log(evt)
          m(JSON.parse(evt.data))
        }
        conn.addPlayer()
        return client
      })
    } else {
      console.log("Server")
      const server = new Server(TICK_RATE)
      const conn = new LocalServerConnection(server)
      const client = new Client(conn)
      server.addConnection(new LocalClientConnection(client))
      const m = mapServerActions(server)

      serverDataChannel(rc, dc => {
        server.addConnection(new NetworkClientConnection(dc))

        dc.onmessage = (evt: any) => {
          m(JSON.parse(evt.data))
        }
      })
      conn.addPlayer()
      return client
    }
  }).then((client: Client) => {
// Browser renderer stuff below

client.players.forEach(player => container.addChild(player.graphics))

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

const renderer = autoDetectRenderer(window.innerWidth, window.innerHeight,
  { antialias: true, backgroundColor: 0x000000 })

function draw() {

  const players = client.players

  players.forEach(p => {
    if (!p.keys) {
      return
    }

    if (pressedKeys[p.keys.left]) {
      client.rotateLeft(p.id)
    }

    if (pressedKeys[p.keys.right]) {
      client.rotateRight(p.id)
    }
  })

  for (let player of players) {
    updatePlayerGraphics(player)
  }

  renderer.render(container)
  requestAnimationFrame(draw)
}

window.onresize = (e) => {
  renderer.view.style.width = window.innerWidth + "px"
  renderer.view.style.height = window.innerHeight + "px"

  renderer.resize(window.innerWidth, window.innerHeight)
}

draw()
return renderer.view
})
}