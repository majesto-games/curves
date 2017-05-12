import {
  Sprite,
  Graphics,
  autoDetectRenderer,
  Container,
  CanvasRenderer,
  WebGLRenderer,
  Point as PPoint,
} from "pixi.js"
import { Point, Player, Snake, Powerup, PowerupType } from "./player"
import { ClientTail, TailStorage } from "./tail"
import {
  PlayerUpdate,
  PlayerInit,
  GAP,
  TAIL,
  Score,
  Lobby,
} from "../server/actions"

import {
  Server,
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "server/main"

import {
  ServerConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount,
  DataChannel,
} from "server/connections"

import { hexToString } from "game/util"

import * as quickconnect from "rtc-quickconnect"

import pressedKeys, { KEYS, registerKeys } from "./keys"

import * as Icons from "icons"
import { Observable, SimpleEvent } from "utils/observable"

export enum GameEvent {
  START, END, ROUND_END,
}

const ratio = SERVER_WIDTH / SERVER_HEIGHT

export class Game {
  public scores: Score[] = []
  public colors: string[] = []
  public overlay = new Observable<string | undefined>("")
  public onDraw = new SimpleEvent<undefined>()
  public readonly container = new Container()
  public readonly playerLayer = new Graphics()
  public readonly tailLayer = new Graphics()
  public readonly powerupLayer = new Graphics()
  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent, data?: any) => void)[] = []
  private snakes: Snake[] = []

  constructor() {
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })

    setTimeout(() => this.resize(), 0)

    // The order of these actually matters
    // Order is back to front
    this.container.addChild(this.tailLayer)
    this.container.addChild(this.powerupLayer)
    this.container.addChild(this.playerLayer)

    window.addEventListener("resize", () => this.resize())

    this.preConnect()
  }

  public end(player?: Player) {
    if (player != null) {
      this.setOverlay(`Winner: Player ${player.id}`)
    } else {
      this.setOverlay(`No winner!`)
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

  public getView() {
    return this.renderer.view
  }

  public newRound(snakes: Snake[], colors: number[]) {
    this.removeOverlay()
    this.playerLayer.removeChildren()
    this.tailLayer.removeChildren()
    this.powerupLayer.removeChildren()

    this.snakes = snakes
    this.colors = colors.map(hexToString)

    for (let snake of snakes) {
      this.playerLayer.addChild(snake.graphics)
    }
  }

  public roundEnd(scores: Score[], winner: Player) {
    this.scores = scores
    // TODO: so so hacky yes yes
    this.setOverlay(`Winner this round: Player ${winner.id}`)
    this.sendEvent(GameEvent.ROUND_END)
  }

  public updateSnakeGraphics({ graphics, x, y, fatness }: Snake) {
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

  public preGame = () => {
    if (this.closed) {
      this.close()
      return
    }

    // TODO: Remove haxxor
    if (this.snakes.length > 0) { // Game has started
      this.removeOverlay()
      this.draw()
      this.scores = this.snakes.map(({ id }) => ({ id, score: 0 }))
      this.sendEvent(GameEvent.START)
      return
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
    const scores = document.getElementById("scores")
    const ads = document.getElementById("ads")

    const scoresHeight = scores ? scores.offsetHeight : 0
    const adsHeight = ads ? ads.offsetHeight : 0

    // 992 is the breakpoint for mobile view.
    // * .5 because the game container is 50% wide in CSS.
    // 40 because 16px padding * 2 = 32 and 4px border * 2 = 8.
    // Scores height and ads height are also subtracted from the height
    // in mobile view.

    const ww = (window.innerWidth >= 992 ? window.innerWidth * .5 : window.innerWidth) - 40
    const wh = (window.innerWidth <= 992 ? window.innerHeight - scoresHeight - adsHeight : window.innerHeight) - 40
    const wscale = ww / SERVER_WIDTH
    const hscale = wh / SERVER_HEIGHT
    const scale = Math.min(wscale, hscale)
    const density = window.devicePixelRatio

    this.container.scale = new PPoint(scale * density, scale * density)
    this.renderer.resize(SERVER_WIDTH * scale * density, SERVER_HEIGHT * scale * density)
    this.renderer.view.style.width = `${SERVER_WIDTH * scale}px`
    this.renderer.view.style.height = `${SERVER_HEIGHT * scale}px`
  }

  private setOverlay(text: string) {
    this.overlay.set(text)
  }

  private removeOverlay() {
    this.overlay.set(undefined)
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
      this.updateSnakeGraphics(snake)
    }
  }

  private draw = () => {
    if (this.closed) {
      this.close()
      return
    }

    this.onDraw.send(undefined)
    this.drawPlayers()

    this.repaint(this.draw)
  }

  private preConnect = () => {
    this.setOverlay("Connecting...")
    this.paint()
  }

  // TODO: Give data a type
  private sendEvent(e: GameEvent, data?: any) {
    this.eventListeners.forEach(f => f(e, data))
  }
}
