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
  START, END, ROUND_END, ADD_PLAYER,
}

export class Game {
  public scores: Score[] = []
  public readonly container = new Container()
  public readonly graphics = new Graphics()
  public readonly overlay: Overlay
  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent) => void)[] = []
  private drawListeners: (() => void)[] = []
  private snakes: Snake[] = []

  constructor(private readonly room: string) {
    this.overlay = new Overlay(this.graphics)
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })
    this.container.addChild(this.graphics)
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

  private getPowerupImage(powerupType: PowerupType): string {
    switch (powerupType) {
      case "UPSIZE": return sizeupImage
      case "GHOST": return ghostImage
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
