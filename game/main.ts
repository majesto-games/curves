import { Graphics, autoDetectRenderer, Container, CanvasRenderer, WebGLRenderer } from "pixi.js"
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


let keyCombos: { left: KEYS, right: KEYS }[] = []

function resetCombos() {
  keyCombos = [{ left: KEYS.LEFT, right: KEYS.RIGHT }, { left: KEYS.A, right: KEYS.D }]
}
resetCombos()
registerKeys(Array.prototype.concat.apply([], keyCombos.map(n => [n.left, n.right])))
registerKeys([KEYS.RETURN])



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

  public setOverlay = (text: string) => {
    this.overlayText.text = text
    if (!this.added) {
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
    this.gfx.overlay.setOverlay(`Winner: Player ${winnerId}`)
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

export enum GameEvent {
  START, END
}

export class Game {
  public readonly container = new Container()
  public readonly graphics = new Graphics()
  public readonly overlay: Overlay
  private client: Client
  private server: ServerConnection
  private rc: any
  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent) => void)[] = []

  constructor(public readonly room: string) {
    this.overlay = new Overlay(this.graphics)
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })
    this.container.addChild(this.graphics)
    this.preConnect()
  }

  public connect() {
    const gfx = {container: this.container, graphics: this.graphics, overlay: this.overlay}
    connectAndCount(this.room).then(([rc, memberCount]) => {
    this.rc = rc
    if (this.closed) {
      this.close()
      return
    }
    if (memberCount > 1) { // not server
      console.log("Not server")
      return clientDataChannel(rc).then((dc) => {
        this.server = new NetworkServerConnection(dc)
        this.client = new Client(this.server, gfx)
        const m = mapClientActions(this.client)
        dc.onmessage = (evt: any) => {
          m(JSON.parse(evt.data))
        }
        this.server.addPlayer()
        return
      })
    } else {
      console.log("Server")
      this.overlay.setOverlay(`Wating for players...\nJoin room ${this.room} or\npress ENTER to add player`)
      const server = new Server(TICK_RATE)
      const id = {}
      this.server = new LocalServerConnection(server, id)
      this.client = new Client(this.server, gfx)
      server.addConnection(new LocalClientConnection(this.client, id))
      const m = mapServerActions(server)

      const conns: NetworkClientConnection[] = []

      serverDataChannel(rc, dc => {
        const netconn = new NetworkClientConnection(dc)
        server.addConnection(netconn)
        conns.push(netconn)

        dc.onmessage = (evt: any) => {
          const data = JSON.parse(evt.data)
          m(data, dc)
        }
      })
      this.server.addPlayer()
      return
    }
  }).then(() => {
    this.preGame()
    this.client.onEnd(() => {
      this.sendEvent(GameEvent.END)
      this.close()
    })
    this.sendEvent(GameEvent.START)
  })
  }

  public onEvent = (f: (e: GameEvent) => void) => {
    this.eventListeners.push(f)
    return () => {
      this.eventListeners = this.eventListeners.filter(g => g !== f)
    }
  }

  public close() {
    this.closed = true
    if (this.rc != null) {
      this.rc.close()
      this.rc = undefined
    }
    if (this.renderer != null) {
      this.renderer.destroy()
      this.renderer = undefined as any
    }
    if (this.server != null) {
      this.server = undefined as any
    }
    if (this.client != null) {
      this.client = undefined as any
      resetCombos()
    }
  }

  public getView() {
    return this.renderer.view
  }

  private paint() {
    this.renderer.render(this.container)
  }

  private repaint(cb: FrameRequestCallback) {
    this.paint()
    requestAnimationFrame(cb)
  }

  private handleKeys() {
    this.client.players.forEach(p => {
      if (!p.keys) {
        return
      }

      if (pressedKeys[p.keys.left]) {
        this.client.rotateLeft(p.id)
      }

      if (pressedKeys[p.keys.right]) {
        this.client.rotateRight(p.id)
      }
    })
  }

  private drawPlayers() {
    for (let player of this.client.players) {
      updatePlayerGraphics(player)
    }
  }

  private draw = () => {
    if (this.closed) {
      this.close()
      return
    }

    this.handleKeys()
    this.drawPlayers()

    this.repaint(this.draw)
  }

  private preConnect = () => {
    this.overlay.setOverlay("Connecting...")
    this.paint()
  }

  private preGame = () => {
    if (this.closed) {
      this.close()
      return
    }
    if (this.client.players.length > 0)  { // Game has started
      this.overlay.removeOverlay()
      this.draw()
      return
    }

    if (pressedKeys[KEYS.RETURN]) {
      this.server.addPlayer()
    }

    this.repaint(this.preGame)
  }

  private sendEvent (e: GameEvent) {
    this.eventListeners.forEach(f => f(e))
  }
}
