import { Sprite, Graphics, autoDetectRenderer, Container, CanvasRenderer, WebGLRenderer } from "pixi.js"
import { Point, Player, TICK_RATE, Powerup } from "./player"
import { ClientTail, TailStorage } from "./tail"
import Overlay from "./overlay"
import {
  PlayerUpdate,
  PlayerInit,
  GAP,
  TAIL,
} from "../server/actions"

import {
  Server,
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "../server/main"

import {
  ServerConnection,
  LocalServerConnection,
  NetworkClientConnection,
  NetworkServerConnection,
  LocalClientConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount,
} from "../server/connections"

import {
  mapServerActions,
  mapClientActions,
} from "../server/reducers"

import { Client } from "./client"

import pressedKeys, { KEYS, registerKeys } from "./keys"

import * as sizeupImage from "../sizeup.svg"

export enum GameEvent {
  START, END,
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
    connectAndCount(this.room).then(([rc, memberCount]) => {
    this.rc = rc
    if (this.closed) {
      this.close()
      return
    }
    if (memberCount > 1) {
      return this.connectAsClient(rc)
    } else {
      return this.connectAsServer(rc)
    }
  }).then(() => {
    this.preGame()
    this.sendEvent(GameEvent.START)
  })
  }

  public end(player?: Player) {
    if (player != null) {
      this.overlay.setOverlay(`Winner: Player ${player.id}`)
    } else {
      this.overlay.setOverlay(`No winner!`)
    }
    this.paint()
    setTimeout(() => {
      this.sendEvent(GameEvent.END)
      this.close()
    }, 3000)
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
      this.client.resetCombos()
      this.client = undefined as any
    }
  }

  public getView() {
    return this.renderer.view
  }

  public addPlayer(player: Player) {
    this.container.addChild(player.graphics)
  }

  public updatePlayer(player: Player) {
    player.graphics.x = player.x
    player.graphics.y = player.y
    player.graphics.scale.set(player.fatness, player.fatness)
  }

  public addTail(tail: ClientTail) {
    this.graphics.addChild(tail.graphics)
  }

  public removeTail(tail: ClientTail) {
    this.graphics.removeChild(tail.graphics)
  }

  public addPowerup(powerup: Powerup) {
    const powerupG = Sprite.fromImage(sizeupImage, undefined, undefined)
    powerupG.anchor.set(0.5)
    this.graphics.addChild(powerupG)

    const { location } = powerup

    powerupG.position.set(location.x, location.y)

    return powerupG
  }

  public removePowerup(powerupG: Sprite) {
    if (powerupG != null) {
      this.graphics.removeChild(powerupG)
    }
  }

  private connectAsClient(rc: any) {
    console.log("Not server")
    return clientDataChannel(rc).then((dc) => {
      this.server = new NetworkServerConnection(dc)
      this.client = new Client(this.server, this)

      const m = mapClientActions(this.client)
      dc.onmessage = (evt: any) => {
        m(JSON.parse(evt.data))
      }
      this.server.addPlayer()
      return
    })
  }

  private connectAsServer(rc: any) {
    console.log("Server")
    this.overlay.setOverlay(`Wating for players...\nJoin room ${this.room} or\npress ENTER to add player`)
    const server = new Server(TICK_RATE)
    const id = {}
    this.server = new LocalServerConnection(server, id)
    this.client = new Client(this.server, this)
    server.addConnection(new LocalClientConnection(this.client, id))

    serverDataChannel(rc, this.handleClientConnections(server))

    this.server.addPlayer()
  }

  private handleClientConnections(server: Server) {
    const m = mapServerActions(server)
    return (dc: any) => {
      const netconn = new NetworkClientConnection(dc)
      server.addConnection(netconn)

      dc.onmessage = (evt: any) => {
        const data = JSON.parse(evt.data)
        m(data, dc)
      }
    }
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
      this.updatePlayer(player)
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
