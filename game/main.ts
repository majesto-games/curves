import { Graphics, autoDetectRenderer, Container } from "pixi.js"
import { Point, Player, TICK_RATE } from "./game"
import {
  PlayerUpdate,
  PlayerInit,
} from "../server/actions"

import {
  Server,
  SERVER_WIDTH,
  SERVER_HEIGHT
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

import pressedKeys, { KEYS, registerKeys } from "./keys"

import * as R from "ramda"

// const middle = { x: (window.innerWidth) / 2, y: (window.innerHeight) / 2 }

// Remove pesky pixi.js banner from console
// utils._saidHello = true

let keyCombos: { left: KEYS, right: KEYS }[] = []

function resetCombos() {
  keyCombos = [{ left: KEYS.LEFT, right: KEYS.RIGHT }, { left: KEYS.A, right: KEYS.D }]
}
resetCombos()
registerKeys(Array.prototype.concat.apply([], keyCombos.map(n => [n.left, n.right])))



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
    this.overlayText.x = SERVER_WIDTH / 2
    this.overlayText.y = SERVER_HEIGHT / 3

    this.overlay = new Graphics()
    this.overlay.beginFill(0x000000, 0.5)
    this.overlay.drawRect(0, 0, SERVER_WIDTH, SERVER_HEIGHT)
    this.overlay.endFill()
    this.overlay.addChild(this.overlayText)

    this.startPos = new Graphics()
    this.overlay.addChild(this.startPos)
  }

  public addOverlay = (text: string) => {
    this.overlayText.text = text
    this.graphics.addChild(this.overlay)
    this.added = true
  }

  public removeOverlay = () => {
    this.graphics.removeChild(this.overlay)
    this.startPos.removeChildren()
    this.added = false
  }
}

export interface ClientKeys {
  left: KEYS
  right: KEYS
}

interface Gfx {
  container: Container
  graphics: Graphics
  overlay: Overlay
}

export class Client {

  public players: Player[] = []
  public id: number

  private endListeners: (() => void)[] = []

  constructor(private connection: ServerConnection, public gfx: Gfx) {
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
        this.gfx.graphics.beginFill(player.color)
        this.gfx.graphics.drawPolygon(update.tailPart)
        this.gfx.graphics.endFill()
      }
    }
  }

  public start = (players: PlayerInit[]) => {
    console.log("starting with", players)
    this.players = players.map((player, i) => createPlayer(player.name, player.startPoint,
      player.color, player.rotation, player.isOwner, i))
    this.players.forEach(player => this.gfx.container.addChild(player.graphics))
  }

  public rotateLeft = (id: number) => {
    this.connection.rotateLeft(id)
  }

  public rotateRight = (id: number) => {
    this.connection.rotateRight(id)
  }

  public end = (winnerId: number | null) => {
    this.gfx.overlay.addOverlay(`Winner: Player ${winnerId}`)
    this.endListeners.forEach(f => f())
  }

  public onEnd = (f: () => void) => {
    this.endListeners.push(f)
    return () => {
      this.endListeners = this.endListeners.filter(g => g !== f)
    }
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

export function createGame(room: string) {
  const container = new Container()
  const graphics = new Graphics()
  const overlay = new Overlay(graphics)
  const gfx = {container, graphics, overlay}

  console.log("createGame")

  return connectAndCount(room).then(([rc, memberCount]) => {
    const close = () => rc.close()
    if (memberCount > 1) { // not server
      console.log("Not server")
      return clientDataChannel(rc).then((dc) => {
        const conn = new NetworkServerConnection(dc)
        const client = new Client(conn, gfx)
        const m = mapClientActions(client)
        dc.onmessage = (evt: any) => {
          m(JSON.parse(evt.data))
        }
        conn.addPlayer()
        return { client, close }
      })
    } else {
      console.log("Server")
      overlay.addOverlay("Wating for players...");
      const server = new Server(TICK_RATE)
      const id = {}
      const conn = new LocalServerConnection(server, id)
      const client = new Client(conn, gfx)
      server.addConnection(new LocalClientConnection(client, id))
      const m = mapServerActions(server)

      const conns: NetworkClientConnection[] = []

      serverDataChannel(rc, dc => {
        const netconn = new NetworkClientConnection(dc)
        server.addConnection(netconn)
        conns.push(netconn)

        dc.onmessage = (evt: any) => {
          const data = JSON.parse(evt.data)

          // HACK
          if (data.type === "ADD_PLAYER") {
            overlay.removeOverlay()
          }


          m(data, dc)
        }
      })
      conn.addPlayer()
      return { client, close }
    }
  }).then((res) => {

    const client = res.client

    let closed = false

    container.addChild(graphics)

    const renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })

    function draw() {

      if (closed) {
        return
      }

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

    // window.onresize = (e) => {
    //   renderer.view.style.width = window.innerWidth + "px"
    //   renderer.view.style.height = window.innerHeight + "px"

    //   renderer.resize(window.innerWidth, window.innerHeight)
    // }

    draw()
    return { view: renderer.view, close: () => {
      res.close()
      renderer.destroy()
      closed = true
      resetCombos()
    }, onEnd: (f: () => void) => client.onEnd(f) }
  })
}
