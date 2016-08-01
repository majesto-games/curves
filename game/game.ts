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

export class Player {

  public graphics: PIXI.Graphics
  public polygonTail: any[]
  public rotation: number
  public fatness: number
  public alive: boolean
  public color: number
  public lastX: number
  public lastY: number
  public speed: number
  public lastEnd: any
  public x: number
  public y: number
  public keys?: ClientKeys | null
  public id: number

  private name: string
  private lfatness: number
  private holeChance: number
  private tailTicker: number
  private skipTailTicker: number

  constructor(name: string, startPoint: Point, color: number, rotation: number, keys: ClientKeys | null, id: number) {
    this.name = name
    this.color = color
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
    this.rotation = rotation
    this.polygonTail = []
    this.skipTailTicker = 0
    this.alive = true
    this.keys = keys
    this.id = id
  }

  public rotate = (amount: number) => {
    this.rotation = (this.rotation + amount) % (2 * Math.PI)
  }

  public createTail = () => {
    let r = Math.random()
    let pol: number[] | null = null

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
