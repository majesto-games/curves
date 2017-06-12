import { Record } from "immutable"
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
import Render, { RenderState, emptyState, KeyText } from "game/render"

import { flatten } from "utils/array"
import { fromImageTexture, textureProviders } from "game/texture"
import createModule, { Action } from "redux-typescript-module"

export enum GameEvent {
  START, END, ROUND_END,
}

enum RoundState {
  PRE, IN, POST,
}

interface RoundPreState {
  type: RoundState.PRE
  roundStartsAt: number | undefined
}

interface RoundInState {
  type: RoundState.IN
}

interface RoundPostState {
  type: RoundState.POST
}

type GameRound = RoundPreState | RoundInState | RoundPostState

export interface GameStateI {
  colors: string[]
  overlay: string | undefined
  round: GameRound
}

export type GameState = Record.Instance<GameStateI>

const roundStart: RoundPreState = {
  type: RoundState.PRE,
  roundStartsAt: undefined,
}

// tslint:disable-next-line:variable-name
export const GameStateClass: Record.Class<GameStateI> = Record({
  colors: [],
  overlay: undefined,
  round: roundStart,
})

const gameModule = createModule(new GameStateClass(), {
  SET_OVERLAY: (state: GameState, action: Action<string | undefined>) => state.set("overlay", action.payload),
  SET_ROUND: (state: GameState, action: Action<GameRound>) => state.set("round", action.payload),
  SET_COLORS: (state: GameState, action: Action<string[]>) => state.set("colors", action.payload),
})

const ratio = SERVER_WIDTH / SERVER_HEIGHT

export class Game {
  public onDraw = new SimpleEvent<undefined>()
  public event = new SimpleEvent<GameEvent>()
  public store: Store<GameState>
  private readonly container = new Container()

  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent, data?: any) => void)[] = []

  private tailStorage: Store<TailStorage<ClientTail>>
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
    tailStorage: Store<TailStorage<ClientTail>>,
    getKeyTextAndColor: (snake: Snake) => [string, string, number] | undefined) {
    this.removeOverlay()
    this.renderState = this.renderState.set("powerups", [])

    // TODO: this is dirty
    this.tailStorage = tailStorage

    this.renderState = this.renderState.set("snakes", snakes)

    for (const snake of snakes) {
      const keysAndColor = getKeyTextAndColor(snake)
      if (keysAndColor != null) {
        const [left, right, color] = keysAndColor
        const [leftP, rightP] = padEqual(left, right)
        const text = `${leftP} ▲ ${rightP}`

        this.renderState = this.renderState.set("keytexts",
          this.renderState.keytexts.concat({
            x: snake.x,
            y: snake.y,
            rotation: snake.rotation,
            text,
            color,
          }))
      }
    }

    this.store.dispatch(gameModule.actions.SET_ROUND({
      type: RoundState.PRE,
      roundStartsAt: Date.now() + delay,
    }))
    this.store.dispatch(gameModule.actions.SET_COLORS(colors.map(hexToString)))
  }

  public setSnakes(snakes: Snake[]) {
    // TODO: Very bad
    this.renderState = this.renderState.set("snakes", snakes)
  }

  public inRound() {
    const state = this.store.getState()
    if (state.round.type !== RoundState.IN) {
      this.store.dispatch(gameModule.actions.SET_ROUND({
        type: RoundState.IN,
      }))
      this.removeOverlay()
      this.renderState = this.renderState.set("keytexts", [])
      this.event.send(GameEvent.START)
    }
  }

  public roundEnd(winner: ClientPlayer) {
    this.setOverlay(`Winner this round: Player ${winner.id}`)
    this.store.dispatch(gameModule.actions.SET_ROUND({
      type: RoundState.POST,
    }))
    this.store.dispatch(gameModule.actions.SET_COLORS([]))
    this.event.send(GameEvent.ROUND_END)
  }

  public addPowerup({ location, type, id }: Powerup) {
    const powerupSprite = Sprite.fromImage(this.getPowerupImage(type), undefined, undefined)
    powerupSprite.position.set(location.x, location.y)
    powerupSprite.anchor.set(0.5)

    const texture = textureProviders.dehydrate(fromImageTexture, this.getPowerupImage(type))

    this.renderState = this.renderState.set("powerups",
      this.renderState.powerups.concat({
        x: location.x,
        y: location.y,
        texture,
        id,
      }))
  }

  public removePowerup(snakeId: number, powerupId: number) {
    this.renderState = this.renderState.set("powerups",
      this.renderState.powerups.filter(t => t.id !== powerupId))
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

  private getMeshes() {
    if (this.tailStorage != null) {
      const meshes: MeshPart[] = []
      const state = this.tailStorage.getState()
      state.perTail.forEach(v => v.forEach(x => meshes.push(...x.meshes.toJS())))

      return meshes
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
        break
      }
      case RoundState.POST: {
        break
      }
      default:
    }

    this.renderState = this.renderState.set("tails", this.getMeshes())

    this.render.setState(this.renderState)

    this.repaint(this.draw)
  }
}
