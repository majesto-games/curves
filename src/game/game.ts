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
import { Point, ClientPlayer, Snake, Powerup, PowerupType } from "./player"
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

import { KEYS } from "./keys"

import * as Icons from "icons"
import { Observable, SimpleEvent } from "utils/observable"
import { padEqual } from "utils/string"
import never from "utils/never"
import { fillSquare } from "game/client"

export enum GameEvent {
  START, END, ROUND_END,
}

enum RoundState {
  PRE, IN, POST,
}

const ratio = SERVER_WIDTH / SERVER_HEIGHT

export class Game {
  public colors: string[] = []
  public overlay = new Observable<string | undefined>("")
  public onDraw = new SimpleEvent<undefined>()
  public event = new SimpleEvent<GameEvent>()
  public roundState = RoundState.PRE
  private readonly container = new Container()
  private readonly playerLayer = new Graphics()
  private readonly keysLayer = new Graphics()
  private readonly tailLayer = new Graphics()
  private readonly powerupLayer = new Graphics()
  private closed = false
  private renderer: CanvasRenderer | WebGLRenderer
  private eventListeners: ((e: GameEvent, data?: any) => void)[] = []
  private snakes: Snake[] = []
  private roundStartsAt: number | undefined

  constructor() {
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })

    setTimeout(() => this.resize(), 0)

    // The order of these actually matters
    // Order is back to front
    this.container.addChild(this.tailLayer)
    this.container.addChild(this.powerupLayer)
    this.container.addChild(this.playerLayer)
    this.container.addChild(this.keysLayer)

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
    getKeyTextAndColor: (snake: Snake) => [string, string, number] | undefined) {
    this.removeOverlay()
    this.playerLayer.removeChildren()
    this.tailLayer.removeChildren()
    this.powerupLayer.removeChildren()

    this.snakes = snakes
    this.colors = colors.map(hexToString)

    for (const snake of snakes) {
      this.playerLayer.addChild(snake.graphics)
      this.playerLayer.addChild(snake.powerupGraphics)
      const keysAndColor = getKeyTextAndColor(snake)
      if (keysAndColor != null) {
        const [left, right, color] = keysAndColor
        const [leftP, rightP] = padEqual(left, right)
        const text = new Text(`${leftP} ▲ ${rightP}`, {
          fontFamily: "Courier New",
          fill: color,
          fontSize: 24,
        })

        text.anchor.set(0.5, 1.5)
        text.x = snake.x
        text.y = snake.y
        text.rotation = snake.rotation
        this.keysLayer.addChild(text)

      }
    }
    this.drawPlayers()

    this.roundStartsAt = Date.now() + delay
    this.roundState = RoundState.PRE
  }

  public inRound() {
    if (this.roundState !== RoundState.IN) {
      this.roundState = RoundState.IN
      this.removeOverlay()
      this.keysLayer.removeChildren()
      this.event.send(GameEvent.START)
    }
  }

  public roundEnd(winner: ClientPlayer) {
    this.setOverlay(`Winner this round: Player ${winner.id}`)
    this.roundState = RoundState.POST
    this.event.send(GameEvent.ROUND_END)
  }

  public addTail(tail: ClientTail) {
    tail.meshes.value.forEach(mesh => {
      this.tailLayer.addChild(mesh)
    })
    tail.meshes.subscribe((meshes, old) => {
      old.forEach(mesh => {
        this.tailLayer.removeChild(mesh)
      })

      meshes.forEach(mesh => {
        this.tailLayer.addChild(mesh)
      })
    })
  }

  public addPowerup({ location, type }: Powerup) {
    const powerupSprite = Sprite.fromImage(this.getPowerupImage(type), undefined, undefined)
    powerupSprite.position.set(location.x, location.y)
    powerupSprite.anchor.set(0.5)

    this.powerupLayer.addChild(powerupSprite)

    return powerupSprite
  }

  public removePowerup(powerupSprite: Sprite, snakeId: number, powerupId: number) {
    if (powerupSprite != null) {
      this.powerupLayer.removeChild(powerupSprite)
    }

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
    for (const snake of this.snakes) {
      this.updateSnakeGraphics(snake)
    }
  }

  private updateSnakeGraphics({ graphics, x, y, fatness, powerupProgress, powerupGraphics, rotation }: Snake) {
    graphics.position.set(x, y)
    graphics.vertices.set(fillSquare(fatness * 2, fatness * 2))
    graphics.uvs.set(fillSquare(fatness * 2 / graphics.texture.width, fatness * 2 / graphics.texture.height))
    graphics.rotation = rotation
    graphics.children[0].scale.set(fatness, fatness)

    graphics.dirty++
    graphics.indexDirty++
    const meshy = graphics as any
    meshy.refresh()
    graphics.updateTransform()

    powerupGraphics.clear()
    powerupGraphics.position.set(x, y)
    let i = 1
    for (const progress of powerupProgress) {
      powerupGraphics.beginFill(0x000000, 0)
      const lineWidth = 5
      powerupGraphics.lineStyle(lineWidth, 0xffffff)

      const r = fatness + (lineWidth * i)
      i += 1.5
      const startAngle = - Math.PI / 2
      const endAngle = startAngle + Math.PI * 2 - Math.PI * 2 * progress % (Math.PI * 2)
      const startX = Math.cos(startAngle) * r
      const startY = Math.sin(startAngle) * r

      // Perform moveTo so that no line is drawn between arcs
      powerupGraphics.moveTo(startX, startY)
      powerupGraphics.arc(0, 0, r, startAngle, endAngle)
      powerupGraphics.endFill()
    }
  }

  private draw = () => {
    if (this.closed) {
      this.close()
      return
    }

    switch (this.roundState) {
      case RoundState.PRE: {
        if (this.roundStartsAt == null) {
          this.setOverlay("Round starting...")
        } else {
          this.setOverlay(`Round starting in ${Math.ceil((this.roundStartsAt - Date.now()) / 1000)}s`)
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

    this.repaint(this.draw)
  }
}
