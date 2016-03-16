import { chunk } from "./util.js"

export const TICK_RATE = 64
export const SKIP_TAIL_FATNESS_MULTIPLIER = 0.03 * TICK_RATE
export const ROTATION_SPEED = 0.5
export const MOVE_SPEED_BASE = 100 / TICK_RATE
export const HOLE_CHANCE_BASE = -0.002 / TICK_RATE
export const HOLE_CHANCE_INCREASE = 0.0018 / TICK_RATE
export const FATNESS_BASE = 10


function createConnectedPolygon (point, thickness, last_points, point2) {
  const angle = Math.atan2(point2.y - point.y, point2.x - point.x)
  const angle_perp = angle + Math.PI / 2

  return [
    point.x + (Math.cos(angle_perp) * thickness / 2),
    point.y + (Math.sin(angle_perp) * thickness / 2),
  ].concat(last_points).concat([
    point.x - (Math.cos(angle_perp) * thickness / 2),
    point.y - (Math.sin(angle_perp) * thickness / 2),
  ])
}

function createPolygon (point1, point2, thickness1, thickness2) {
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x)
  const angle_perp = angle + Math.PI / 2

  return [
    point1.x + (Math.cos(angle_perp) * thickness1 / 2),
    point1.y + (Math.sin(angle_perp) * thickness1 / 2),

    point2.x + (Math.cos(angle_perp) * thickness2 / 2),
    point2.y + (Math.sin(angle_perp) * thickness2 / 2),

    point2.x - (Math.cos(angle_perp) * thickness2 / 2),
    point2.y - (Math.sin(angle_perp) * thickness2 / 2),

    point1.x - (Math.cos(angle_perp) * thickness1 / 2),
    point1.y - (Math.sin(angle_perp) * thickness1 / 2),
  ]
}

export function containsPoint (points, x, y) {
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
  constructor(name, start_point, color, rotation) {
    this.name = name
    this.color = color
    this.x = start_point.x
    this.y = start_point.y
    this.last_x = this.x
    this.last_y = this.y
    this.fatness = FATNESS_BASE
    this.lfatness = FATNESS_BASE
    this.last_end = null
    this.hole_chance = HOLE_CHANCE_BASE
    this.tail_ticker = 0
    this.speed = MOVE_SPEED_BASE
    this.rotation = rotation
    this.polygon_tail = []
    this.skip_tail_ticker = 0
    this.alive = true
  }

  rotate = (amount) => {
    this.rotation = (this.rotation + amount) % (2 * Math.PI)
  };

  createTail = () => {
    let r = Math.random()
    let pol = null

    if (this.skip_tail_ticker <= 0) {
      if (r > this.hole_chance) {
        if (this.last_end == null) {
          pol = createPolygon({ x: this.x, y: this.y }, { x: this.last_x, y: this.last_y }, this.fatness, this.lfatness)
        } else {
          pol = createConnectedPolygon({ x: this.x, y: this.y }, this.fatness, this.last_end, { x: this.last_x, y: this.last_y })
        }

        this.last_end = pol.slice(0, 2).concat(pol.slice(-2))
        this.hole_chance += HOLE_CHANCE_INCREASE
      } else {
        this.skip_tail_ticker = this.fatness * SKIP_TAIL_FATNESS_MULTIPLIER
        this.last_end = null
        this.hole_chance = HOLE_CHANCE_BASE
      }
    } else {
      this.skip_tail_ticker--
    }

    this.last_x = this.x
    this.last_y = this.y
    this.lfatness = this.fatness

    return pol
  };
}
