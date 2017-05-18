import { Tail, TailPart, NotRemoved } from "./tail"

import { Animation } from "utils/animation"
import { linear } from "tween-functions"

export interface Point {
  x: number
  y: number
}

export type PowerupType
  = "UPSIZE"
  | "GHOST"
  | "SPEEDUP_ME"
  | "SPEEDUP_THEM"
  | "SPEEDDOWN_ME"
  | "SPEEDDOWN_THEM"

export interface Powerup {
  type: PowerupType
  id: number
  location: Point
}

export interface ActivePowerup {
  type: PowerupType
  id: number
  activator: number
  activeTo: number
}

function createConnectedPolygon(point: Point, thickness: number, lastPoints: number[], point2: Point) {
  const angle = Math.atan2(point2.y - point.y, point2.x - point.x)
  const anglePerp = angle + Math.PI / 2
  return [
    point.x + (Math.cos(anglePerp) * thickness),
    point.y + (Math.sin(anglePerp) * thickness),
  ].concat(lastPoints).concat([
    point.x - (Math.cos(anglePerp) * thickness),
    point.y - (Math.sin(anglePerp) * thickness),
  ])
}

function createPolygon(point1: Point, point2: Point, thickness1: number, thickness2: number) {
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x)
  const anglePerp = angle + Math.PI / 2

  return [
    point1.x + (Math.cos(anglePerp) * thickness1),
    point1.y + (Math.sin(anglePerp) * thickness1),

    point2.x + (Math.cos(anglePerp) * thickness2),
    point2.y + (Math.sin(anglePerp) * thickness2),

    point2.x - (Math.cos(anglePerp) * thickness2),
    point2.y - (Math.sin(anglePerp) * thickness2),

    point1.x - (Math.cos(anglePerp) * thickness1),
    point1.y - (Math.sin(anglePerp) * thickness1),
  ]
}

export class Player {
  constructor(
    public snake: Snake | undefined,
    public name: string,
    public id: number,
    public color: number,
    public localIndex?: number,
    public owner?: any,
  ) {

  }
}

export class Snake {

  public graphics: PIXI.Graphics
  public fatness: number
  public alive: boolean
  public lastX: number
  public lastY: number
  public speed: number
  public lastEnd: any
  public x: number
  public y: number

  private lfatness: number
  private holeChance: number
  private tailTicker: number
  private skipTailTicker: number
  private tailId: number
  private ghost: number

  private fatnessAnimation: Animation
  private speedAnimation: Animation

  constructor(
    startPoint: Point,
    public rotation: number,
    public id: number,
  ) {
    this.x = startPoint.x
    this.y = startPoint.y
    this.lastX = this.x
    this.lastY = this.y
    this.fatness = window.getGlobal("FATNESS_BASE")
    this.lfatness = window.getGlobal("FATNESS_BASE")
    this.lastEnd = null
    this.holeChance = window.getGlobal("HOLE_CHANCE_BASE")
    this.tailTicker = 0
    this.speed = window.getGlobal("MOVE_SPEED_BASE")
    this.tailId = 0
    this.skipTailTicker = 0
    this.ghost = 0
    this.alive = true

    this.fatnessAnimation = new Animation(values => {
        const sum = values.reduce((prev, curr) => prev + curr, window.getGlobal("FATNESS_BASE"))
        this.fatness = sum
      })

    this.speedAnimation = new Animation(values => {
        const sum = values.reduce((prev, curr) => prev + curr, window.getGlobal("MOVE_SPEED_BASE"))
        this.speed = Math.max(sum, window.getGlobal("MOVE_SPEED_BASE") - 1)
      })
  }

  public rotate = (amount: number) => {
    this.rotation = (this.rotation + amount) % (2 * Math.PI)
  }

  public ghostify() {
    this.stopTail()
    this.ghost++
  }

  public unghostify() {
    this.ghost--
  }

  public speeddown() {
    const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
    const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

    this.speedAnimation.add(duration, (step, left) => {
      if (step <= halfSecond) {
        return linear(step, 0, -0.5, halfSecond)
      } else if (left <= halfSecond) {
        return linear(halfSecond - left, -0.5, 0, halfSecond)
      }
      return -0.5
    })
  }

  public speedup() {
    const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
    const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

    this.speedAnimation.add(duration, (step, left) => {
      if (step <= halfSecond) {
        return linear(step, 0, 0.5, halfSecond)
      } else if (left <= halfSecond) {
        return linear(halfSecond - left, 0.5, 0, halfSecond)
      }
      return 0.5
    })
  }

  public fatify() {
    const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
    const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

    this.fatnessAnimation.add(duration, (step, left) => {
      if (step <= halfSecond) {
        return linear(step, 0, 8, halfSecond)
      } else if (left <= halfSecond) {
        return linear(halfSecond - left, 8, 0, halfSecond)
      }
      return 8
    })
  }

  public unfatify() {
    const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
    const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

    this.fatnessAnimation.add(duration, (step, left) => {
      if (step <= halfSecond) {
        return linear(step, 0, -8, halfSecond)
      } else if (left <= halfSecond) {
        return linear(halfSecond - left, -8, 0, halfSecond)
      }
      return -8
    })
  }

  public tick() {
    this.fatnessAnimation.tick()
    this.speedAnimation.tick()
  }

  public createTailPolygon() {
    let r = Math.random()
    let pol: number[] | undefined

    if (this.ghost > 0) {
      this.lastEnd = null
    } else if (this.skipTailTicker <= 0) {
      if (r > this.holeChance) {
        if (this.lastEnd == null) {
          pol = createPolygon({ x: this.x, y: this.y }, { x: this.lastX, y: this.lastY }, this.fatness, this.lfatness)
        } else {
          pol = createConnectedPolygon({ x: this.x, y: this.y }, this.fatness, this.lastEnd,
            { x: this.lastX, y: this.lastY })
        }

        this.lastEnd = pol.slice(0, 2).concat(pol.slice(-2))
        this.holeChance += window.getGlobal("HOLE_CHANCE_INCREASE")
      } else {
        this.skipTailTicker = this.fatness * window.getGlobal("SKIP_TAIL_FATNESS_MULTIPLIER")
        this.holeChance = window.getGlobal("HOLE_CHANCE_BASE")
        this.stopTail()
      }
    } else {
      this.skipTailTicker--
    }

    this.lastX = this.x
    this.lastY = this.y
    this.lfatness = this.fatness

    return pol && new TailPart(pol, this.id, this.tailId) as (TailPart & NotRemoved)
  }

  private stopTail() {
    if (this.lastEnd != null) {
      this.lastEnd = null
      this.tailId++
    }
  }
}
