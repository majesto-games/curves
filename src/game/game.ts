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

import * as Icons from "icons"

export enum GameEvent {
  START, END, ROUND_END, ADD_PLAYER,
}

const ratio = SERVER_WIDTH / SERVER_HEIGHT

export class Game {
  public scores: Score[] = []
  public readonly container = new Container()
  public readonly playerLayer = new Graphics()
  public readonly tailLayer = new Graphics()
  public readonly powerupLayer = new Graphics()
  public readonly overlayLayer = new Graphics()
  public readonly overlay: Overlay
  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent) => void)[] = []
  private drawListeners: (() => void)[] = []
  private snakes: Snake[] = []

  constructor(private readonly room: string) {
    this.overlay = new Overlay(this.overlayLayer)
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })

    this.resize()

    // The order of these actually matters
    // Order is back to front
    this.container.addChild(this.powerupLayer)
    this.container.addChild(this.tailLayer)
    this.container.addChild(this.playerLayer)
    this.container.addChild(this.overlayLayer)

    window.addEventListener("resize", () => this.resize())

    this.preConnect()
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

  public getView() {
    return this.renderer.view
  }

  public newRound(snakes: Snake[]) {
    this.overlay.removeOverlay()
    this.playerLayer.removeChildren()
    this.tailLayer.removeChildren()
    this.powerupLayer.removeChildren()

    this.snakes = snakes

    for (let snake of snakes) {
      this.playerLayer.addChild(snake.graphics)
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
    this.tailLayer.addChild(graphics)
  }

  public removeTail({ graphics }: ClientTail) {
    this.tailLayer.removeChild(graphics)
  }

  public addPowerup({ location, type }: Powerup) {
    const powerupSprite = Sprite.fromImage(this.getPowerupImage(type), undefined, undefined)
    powerupSprite.position.set(location.x, location.y)
    powerupSprite.anchor.set(0.5)

    this.powerupLayer.addChild(powerupSprite)

    return powerupSprite
  }

  public removePowerup(powerupSprite: Sprite) {
    if (powerupSprite != null) {
      this.powerupLayer.removeChild(powerupSprite)
    }
  }

  public waitForPlayers() {
    this.overlay.setOverlay(`Wating for players...\nJoin room ${this.room} or\npress ENTER to add player`)
  }

  public preGame = () => {
    if (this.closed) {
      this.close()
      return
    }

    // TODO: Remove haxxor
    if (this.snakes.length > 0) { // Game has started
      this.overlay.removeOverlay()
      this.draw()
      this.scores = this.snakes.map(({ id }) => ({ id, score: 0 }))
      this.sendEvent(GameEvent.START)
      return
    }

    if (pressedKeys[KEYS.RETURN]) {
      this.sendEvent(GameEvent.ADD_PLAYER)
    }

    this.repaint(this.preGame)
  }

  public close() {
    this.closed = true

    if (this.renderer != null) {
      this.renderer.destroy()
      this.renderer = undefined as any
    }
  }

  private resize() {
    let w = window.innerWidth
    let h = window.innerHeight

    if (w / h >= ratio) {
      w = h * ratio
    } else {
      h = w / ratio
    }

    this.renderer.view.style.width = `${w}px`
    this.renderer.view.style.height = `${h}px`
  }

  private getPowerupImage(powerupType: PowerupType): string {
    switch (powerupType) {
      case "UPSIZE": return Icons.sizeupThem
      case "GHOST": return Icons.ghostMe
      case "SPEEDDOWN_ME": return Icons.speeddownMe
      case "SPEEDDOWN_THEM": return Icons.speeddownThem
      case "SPEEDUP_ME": return Icons.speedupMe
      case "SPEEDUP_THEM": return Icons.speedupThem
      default: return "" // TODO: add never
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

  private sendEvent(e: GameEvent) {
    this.eventListeners.forEach(f => f(e))
  }
}
