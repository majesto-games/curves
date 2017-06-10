import {
  Sprite,
  Graphics,
  autoDetectRenderer,
  Container,
  CanvasRenderer,
  WebGLRenderer,
  Point as PPoint,
  ObservablePoint,
  Text,
} from "pixi.js"
import { createStore, Store } from "redux"
import { Point, ClientPlayer, Snake, Powerup, PowerupType } from "./player"
import { ClientTail, TailStorage, MeshPart } from "./tail"
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

import { KEYS } from "./keys"

import * as Icons from "icons"
import { Observable, SimpleEvent, Signal } from "utils/observable"
import { padEqual } from "utils/string"
import never from "utils/never"
import { fillSquare } from "game/client"
import Render, { RenderState, emptyState, KeyText, SnakeGraphics } from "game/render"

import iassign from "immutable-assign"
import { flatten } from "utils/array"
import { fromImageTexture } from "game/texture"
import createModule, { Action } from "redux-typescript-module"

export enum GameEvent {
  START, END, ROUND_END,
}

enum RoundState {
  PRE, IN, POST,
}

interface RoundPreState {
  type: RoundState.PRE,
  roundStartsAt: number | undefined
}

interface RoundInState {
  type: RoundState.IN,
}

interface RoundPostState {
  type: RoundState.POST,
}

type GameRound = RoundPreState | RoundInState | RoundPostState

export interface GameState {
  overlay: string | undefined
  round: GameRound
}

const initialGameState: GameState = {
  overlay: undefined,
  round: {
    type: RoundState.PRE,
    roundStartsAt: undefined,
  },
}

const gameModule = createModule(initialGameState, {
  SET_OVERLAY: (state: GameState, action: Action<string | undefined>) =>
    iassign(state, s => s.overlay, () => action.payload),
  SET_ROUND: (state: GameState, action: Action<GameRound>) =>
    iassign(state, s => s.round, () => action.payload),
})

const ratio = SERVER_WIDTH / SERVER_HEIGHT

export class Game {
  public colors: string[] = []
  public onDraw = new SimpleEvent<undefined>()
  public event = new SimpleEvent<GameEvent>()
  public store: Store<GameState>
  private readonly container = new Container()

  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent, data?: any) => void)[] = []
  private snakes: Snake[] = []

  private tailStorage: TailStorage<ClientTail>
  private render: Render
  private renderState = emptyState()

  constructor() {
    this.store = createStore(gameModule.reducer)
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })

    this.render = new Render(this.container)

    setTimeout(() => this.resize(), 0)

    window.addEventListener("resize", () => this.resize())
    this.draw()
  }

  public end(player?: ClientPlayer) {
    if (player != null) {
      this.setOverlay(`Winner: Player ${player.id}`)
    } else {
      this.setOverlay(`No winner!`)
    }

    this.paint()

    setTimeout(() => {
      this.event.send(GameEvent.END)
      this.close()
    }, 3000)
  }

  public getView() {
    return this.renderer.view
  }

  public newRound(snakes: Snake[], colors: number[], delay: number,
    tailStorage: TailStorage<ClientTail>,
    getKeyTextAndColor: (snake: Snake) => [string, string, number] | undefined) {
    this.removeOverlay()
    this.renderState = iassign(
      this.renderState,
      (o) => o.powerups, // player stuff
      () => [])

    // TODO: this is dirty
    this.tailStorage = tailStorage

    this.renderState = iassign(
      this.renderState,
      (o) => o.powerups,
      () => [])

    this.snakes = snakes
    this.colors = colors.map(hexToString)

    for (const snake of snakes) {
      const keysAndColor = getKeyTextAndColor(snake)
      if (keysAndColor != null) {
        const [left, right, color] = keysAndColor
        const [leftP, rightP] = padEqual(left, right)
        const text = `${leftP} ▲ ${rightP}`

        this.renderState = iassign(
          this.renderState,
          (o) => o.keytexts,
          (texts) => {
            texts.push({
              x: snake.x,
              y: snake.y,
              rotation: snake.rotation,
              text,
              color,
            })
            return texts
          })
      }
    }
    this.drawPlayers()

    this.store.dispatch(gameModule.actions.SET_ROUND({
      type: RoundState.PRE,
      roundStartsAt: Date.now() + delay,
    }))
  }

  public inRound() {
    const state = this.store.getState()
    if (state.round.type !== RoundState.IN) {
      this.store.dispatch(gameModule.actions.SET_ROUND({
        type: RoundState.IN,
      }))
      this.removeOverlay()
      this.renderState = iassign(
        this.renderState,
        (o) => o.keytexts,
        () => [])
      this.event.send(GameEvent.START)
    }
  }

  public roundEnd(winner: ClientPlayer) {
    this.setOverlay(`Winner this round: Player ${winner.id}`)
    this.store.dispatch(gameModule.actions.SET_ROUND({
      type: RoundState.POST,
    }))
    this.event.send(GameEvent.ROUND_END)
  }

  public addPowerup({ location, type, id }: Powerup) {
    const powerupSprite = Sprite.fromImage(this.getPowerupImage(type), undefined, undefined)
    powerupSprite.position.set(location.x, location.y)
    powerupSprite.anchor.set(0.5)

    this.renderState = iassign(
      this.renderState,
      (o) => o.powerups,
      (texts) => {
        texts.push({
          x: location.x,
          y: location.y,
          texture: fromImageTexture.getDehydrated(this.getPowerupImage(type)),
          id,
        })
        return texts
      })

  }

  public removePowerup(snakeId: number, powerupId: number) {
    this.renderState = iassign(
      this.renderState,
      (o) => o.powerups,
      (texts) => texts.filter(t => t.id !== powerupId))

    const snake = this.snakes.find(s => s.id === snakeId)!

    // const graphics = new Graphics()

    // snake.graphics.addChild(graphics)
    // snake.powerupGraphics[powerupId] = graphics
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
    this.store.dispatch(gameModule.actions.SET_OVERLAY(text))
  }

  private removeOverlay() {
    this.store.dispatch(gameModule.actions.SET_OVERLAY(undefined))
  }

  private getPowerupImage(powerupType: PowerupType): string {
    switch (powerupType) {
      case "UPSIZE": return Icons.sizeupThem
      case "GHOST": return Icons.ghostMe
      case "SPEEDDOWN_ME": return Icons.speeddownMe
      case "SPEEDDOWN_THEM": return Icons.speeddownThem
      case "SPEEDUP_ME": return Icons.speedupMe
      case "SPEEDUP_THEM": return Icons.speedupThem
      case "SWAP_ME": return Icons.swapMe
      case "SWAP_THEM": return Icons.swapThem
      case "REVERSE_THEM": return Icons.reverseThem
      default: return never("Unexpected powerup image", powerupType)
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
    this.renderState = iassign<RenderState, SnakeGraphics[], {}>(
      this.renderState,
      state => state.snakes,
      () => this.snakes.map(snake => {
        return {
          x: snake.x,
          y: snake.y,
          rotation: snake.rotation,
          fatness: snake.fatness,
          texture: snake.texture,
          powerupProgress: snake.powerupProgress,
        }
      }))
  }

  private getMeshes() {
    if (this.tailStorage != null) {
      return flatten<MeshPart>(this.tailStorage.allTails().map(v => v.map(x => x.meshes)))
    }
    return []
  }

  private draw = () => {
    if (this.closed) {
      this.close()
      return
    }

    const state = this.store.getState()

    switch (state.round.type) {
      case RoundState.PRE: {
        if (state.round.roundStartsAt == null) {
          this.setOverlay("Round starting...")
        } else {
          this.setOverlay(`Round starting in ${Math.ceil((state.round.roundStartsAt - Date.now()) / 1000)}s`)
        }
        break
      }
      case RoundState.IN: {
        this.onDraw.send(undefined)
        this.drawPlayers()
        break
      }
      case RoundState.POST: {
        break
      }
      default:
    }

    this.renderState = iassign(
      this.renderState,
      (o) => o.tails,
      () => this.getMeshes())

    this.render.setState(this.renderState)

    this.repaint(this.draw)
  }
}
