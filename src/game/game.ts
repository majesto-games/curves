import { Sprite, Graphics, autoDetectRenderer, Container, CanvasRenderer, WebGLRenderer } from "pixi.js"
import { Point, Player, Snake, TICK_RATE, Powerup, PowerupType } from "./player"
import { ClientTail, TailStorage } from "./tail"
import Overlay from "./overlay"
import {
  PlayerUpdate,
  PlayerInit,
  GAP,
  TAIL,
  Score,
} from "../server/actions"

import {
  Server,
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "server/main"

import {
  ServerConnection,
  LocalServerConnection,
  NetworkClientConnection,
  NetworkServerConnection,
  LocalClientConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount,
  DataChannel,
} from "server/connections"

import * as quickconnect from "rtc-quickconnect"

import {
  mapServerActions,
  mapClientActions,
} from "server/reducers"

import { Client } from "./client"

import pressedKeys, { KEYS, registerKeys } from "./keys"

import * as sizeupImage from "icons/sizeup.svg"
import * as ghostImage from "icons/ghost.svg"

export enum GameEvent {
  START, END, ROUND_END,
}

export class Game {
  public scores: Score[] = []
  public readonly container = new Container()
  public readonly graphics = new Graphics()
  public readonly overlay: Overlay
  private server: ServerConnection
  private roomConnection: quickconnect.connection | undefined
  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent) => void)[] = []
  private drawListeners: (() => void)[] = []
  private snakes: Snake[] = []

  constructor(public readonly room: string) {
    this.overlay = new Overlay(this.graphics)
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })
    this.container.addChild(this.graphics)
    this.preConnect()
  }

  public connect() {
    connectAndCount(this.room).then(([rc, memberCount]) => {
      this.roomConnection = rc

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

    return () =>
      this.eventListeners = this.eventListeners.filter(g => g !== f)
  }

  public onDraw = (f: () => void) => {
    this.drawListeners.push(f)

    return () =>
      this.drawListeners = this.drawListeners.filter(g => g !== f)
  }

  public close() {
    this.closed = true

    if (this.roomConnection != null) {
      this.roomConnection.close()
      this.roomConnection = undefined
    }

    if (this.renderer != null) {
      this.renderer.destroy()
      this.renderer = undefined as any
    }
  }

  public getView() {
    return this.renderer.view
  }

  public newRound(snakes: Snake[]) {
    this.overlay.removeOverlay()
    this.graphics.removeChildren()

    this.snakes = snakes

    for (let snake of snakes) {
      this.graphics.addChild(snake.graphics)
    }
  }

  public roundEnd(scores: Score[]) {
    this.scores = scores
    this.sendEvent(GameEvent.ROUND_END)
  }

  public updatePlayer({ graphics, x, y, fatness }: Snake) {
    graphics.position.set(x, y)
    graphics.scale.set(fatness, fatness)
  }

  public addTail({ graphics }: ClientTail) {
    this.graphics.addChild(graphics)
  }

  public removeTail({ graphics }: ClientTail) {
    this.graphics.removeChild(graphics)
  }

  public addPowerup({ location, type }: Powerup) {
    const powerupSprite = Sprite.fromImage(this.getPowerupImage(type), undefined, undefined)
    powerupSprite.position.set(location.x, location.y)
    powerupSprite.anchor.set(0.5)

    this.graphics.addChild(powerupSprite)

    return powerupSprite
  }

  public removePowerup(powerupSprite: Sprite) {
    if (powerupSprite != null) {
      this.graphics.removeChild(powerupSprite)
    }
  }

  private getPowerupImage(powerupType: PowerupType): string {
    switch (powerupType) {
      case "UPSIZE": return sizeupImage
      case "GHOST": return ghostImage
      default: return "" // TODO: add never
    }
  }

  private connectAsClient(rc: any) {
    console.log("Not server")

    return clientDataChannel(rc).then((dc: DataChannel) => {
      this.server = new NetworkServerConnection(dc)
      const client = new Client(this.server, this)

      const m = mapClientActions(client)

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
    const client = new Client(this.server, this)

    server.addConnection(new LocalClientConnection(client, id))

    serverDataChannel(rc, this.handleClientConnections(server))

    this.server.addPlayer()
  }

  private handleClientConnections(server: Server) {
    const m = mapServerActions(server)

    return (dc: DataChannel) => {
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

  private drawPlayers() {
    for (let snake of this.snakes) {
      this.updatePlayer(snake)
    }
  }

  private draw = () => {
    if (this.closed) {
      this.close()
      return
    }

    this.drawListeners.forEach(f => f())
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

    // TODO: Remove haxxor
    if (this.snakes.length > 0)  { // Game has started
      this.overlay.removeOverlay()
      this.draw()
      this.scores = this.snakes.map(({ id }) => ({ id, score: 0 }))
      this.sendEvent(GameEvent.START)
      return
    }

    // TODO: Remove haxxor
    if (pressedKeys[KEYS.RETURN]) {
      this.server.addPlayer()
    }

    this.repaint(this.preGame)
  }

  private sendEvent (e: GameEvent) {
    this.eventListeners.forEach(f => f(e))
  }
}
