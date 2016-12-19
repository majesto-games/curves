import { ClientKeys } from "./main"

export const TICK_RATE = 64
export const SKIP_TAIL_FATNESS_MULTIPLIER = 0.03 * TICK_RATE
export const ROTATION_SPEED = 0.5
export const MOVE_SPEED_BASE = 100 / TICK_RATE
export const HOLE_CHANCE_BASE = -0.002 / TICK_RATE
export const HOLE_CHANCE_INCREASE = 0.0018 / TICK_RATE
export const FATNESS_BASE = 10

export interface Point {
  x: number
  y: number
}

function createConnectedPolygon (point: Point, thickness: number, lastPoints: number[], point2: Point) {
  const angle = Math.atan2(point2.y - point.y, point2.x - point.x)
  const anglePerp = angle + Math.PI / 2

  return [
    point.x + (Math.cos(anglePerp) * thickness / 2),
    point.y + (Math.sin(anglePerp) * thickness / 2),
  ].concat(lastPoints).concat([
    point.x - (Math.cos(anglePerp) * thickness / 2),
    point.y - (Math.sin(anglePerp) * thickness / 2),
  ])
}

function createPolygon (point1: Point, point2: Point, thickness1: number, thickness2: number) {
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x)
  const anglePerp = angle + Math.PI / 2

  return [
    point1.x + (Math.cos(anglePerp) * thickness1 / 2),
    point1.y + (Math.sin(anglePerp) * thickness1 / 2),

    point2.x + (Math.cos(anglePerp) * thickness2 / 2),
    point2.y + (Math.sin(anglePerp) * thickness2 / 2),

    point2.x - (Math.cos(anglePerp) * thickness2 / 2),
    point2.y - (Math.sin(anglePerp) * thickness2 / 2),

    point1.x - (Math.cos(anglePerp) * thickness1 / 2),
    point1.y - (Math.sin(anglePerp) * thickness1 / 2),
  ]
}

export function containsPoint (points: number[], x: number, y: number) {
  let inside = false

  const length = points.length / 2

  for (let i = 0, j = length - 1; i < length; j = i++) {
    const xi = points[i * 2]
    const yi = points[i * 2 + 1]
    const xj = points[j * 2]
    const yj = points[j * 2 + 1]
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)

    if (intersect) {
      inside = !inside
    }
  }

  return inside
};

export interface Tail {
  addPart: (part: number[]) => void
  isNew: () => boolean
}

export class ClientTail implements Tail {
  public readonly graphics = new PIXI.Graphics()
  private isnew = true

  constructor(public color: number) {

  }

  public addPart(part: number[]) {
    this.graphics.beginFill(this.color)
    this.graphics.drawPolygon(part)
    this.graphics.endFill()
    this.isnew = false
  }

  public isNew() {
    return this.isnew
  }
}

export class ServerTail implements Tail {
  public minX: number
  public maxX: number
  public minY: number
  public maxY: number
  public parts: number[][] = []

  public isNew() {
    return this.parts.length < 1
  }

  public addPart(part: number[]) {

    if (this.isNew()) {
      this.minX = this.maxX = part[0]
      this.minY = this.maxY = part[1]
    }

    for (let i = 0; i < part.length; i += 2) {
      const x = part[i]
      const y = part[i + 1]

      this.ensureBoundsX(x)
      this.ensureBoundsY(y)
    }

    this.parts.push(part)
  }

  public containsPoint(x: number, y: number) {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) {
      return false
    }
    return this.parts.some(poly => containsPoint(poly, x, y))
  }

  private ensureBoundsX(x: number) {
    this.minX = Math.min(this.minX, x)
    this.maxX = Math.max(this.maxX, x)
  }

  private ensureBoundsY(y: number) {
    this.minY = Math.min(this.minY, y)
    this.maxY = Math.max(this.maxY, y)
  }

}


export class Player {

  public graphics: PIXI.Graphics
  public tails: Tail[]
  public fatness: number
  public alive: boolean
  public lastX: number
  public lastY: number
  public speed: number
  public lastEnd: any
  public x: number
  public y: number
  public id: number

  private lfatness: number
  private holeChance: number
  private tailTicker: number
  private skipTailTicker: number

  constructor(
      private name: string,
      startPoint: Point,
      public color: number,
      public rotation: number,
      id: number,
      public keys?: ClientKeys,
      public owner?: any) {
    this.x = startPoint.x
    this.y = startPoint.y
    this.lastX = this.x
    this.lastY = this.y
    this.fatness = FATNESS_BASE
    this.lfatness = FATNESS_BASE
    this.lastEnd = null
    this.holeChance = HOLE_CHANCE_BASE
    this.tailTicker = 0
    this.speed = MOVE_SPEED_BASE
    this.tails = []
    this.skipTailTicker = 0
    this.alive = true
    this.id = id
  }

  public rotate = (amount: number) => {
    this.rotation = (this.rotation + amount) % (2 * Math.PI)
  }

  public createTailPart = () => {
    let r = Math.random()
    let pol: number[] | undefined

    if (this.skipTailTicker <= 0) {
      if (r > this.holeChance) {
        if (this.lastEnd == null) {
          pol = createPolygon({ x: this.x, y: this.y }, { x: this.lastX, y: this.lastY }, this.fatness, this.lfatness)
        } else {
          pol = createConnectedPolygon({ x: this.x, y: this.y }, this.fatness, this.lastEnd,
            { x: this.lastX, y: this.lastY })
        }

        this.lastEnd = pol.slice(0, 2).concat(pol.slice(-2))
        this.holeChance += HOLE_CHANCE_INCREASE
      } else {
        this.skipTailTicker = this.fatness * SKIP_TAIL_FATNESS_MULTIPLIER
        this.lastEnd = null
        this.holeChance = HOLE_CHANCE_BASE
      }
    } else {
      this.skipTailTicker--
    }

    this.lastX = this.x
    this.lastY = this.y
    this.lfatness = this.fatness

    return pol
  }
}
