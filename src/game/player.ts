import { newTailPart, TailPart } from "./tail"

import {
  Animation,
  TweenResult,
  newAnimation,
  add,
  tick as animationTick,
  values,
  numberTweenProviders,
  undefinedTweenProviders,
  booleanTrue,
  linearAttackDecay,
  LinearInOutParams,
} from "utils/animation"
import { linear } from "tween-functions"
import { ConnectionId } from "server/connections"
import { Signal } from "utils/observable"
import { Texture } from "pixi.js"
import { SERVER_WIDTH, SERVER_HEIGHT } from "server/main"
import { DehydratedTexture } from "game/texture"
import { Record, List, Map as MapIm } from "immutable"

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
  | "SWAP_ME"
  | "SWAP_THEM"
  | "REVERSE_THEM"

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

export interface Player {
  name: string
  id: number
  color: number
}

export class ServerPlayer {
  public steeringLeft = false
  public steeringRight = false
  constructor(
    public name: string,
    public id: number,
    public color: number,
    public owner: ConnectionId,
    public snake?: Snake,
  ) {

  }
}

interface ClientPlayerI {
  steeringLeft: boolean
  steeringRight: boolean
  name: string
  id: number
  color: number
  texture: DehydratedTexture
  localIndex: number | undefined
  isOwner: boolean
  snake: Snake | undefined
}

export type ClientPlayer = Record.Instance<ClientPlayerI>

// tslint:disable-next-line:variable-name
export const ClientPlayerClass: Record.Class<ClientPlayerI> = Record({
  steeringLeft: false,
  steeringRight: false,
  name: "",
  id: 0,
  color: 0,
  texture: undefined as any,
  localIndex: undefined,
  isOwner: false,
  snake: undefined,
})

export function newClientPlayer(
  name: string,
  id: number,
  color: number,
  texture: DehydratedTexture,
  localIndex: number | undefined,
  isOwner: boolean,
  snake?: Snake,
) {
  return new ClientPlayerClass({
    name,
    id,
    color,
    texture,
    localIndex,
    isOwner,
    snake,
  })
}

interface PowerupProgress {
  order: number
  progress: number
}

interface AnimationProgress<T> {
  value: T
  progress: number
  order: number
}

function fatnessAnimationReducer(snake: Snake, values: TweenResult<number>[]): Snake {
  const sum = values.reduce((prev, curr) => prev + curr.value, window.getGlobal("FATNESS_BASE"))
  return snake
    .set("fatnessProgress", List(values))
    .set("fatness", sum)
}

function speedAnimationReducer(snake: Snake, values: TweenResult<number>[]): Snake {
  const sum = values.reduce((prev, curr) => prev + curr.value, 0) * 64 / window.getGlobal("TICK_RATE")
  return snake
    .set("speedProgress", List(values))
    .set("speed", window.getGlobal("MOVE_SPEED_BASE") + Math.max(sum, - 1))
}

function ghostAnimationReducer(snake: Snake, values: TweenResult<undefined>[]): Snake {
  if (values.length > 0) {
    return snake
      .set("ghost", true)
      .set("ghostProgress", List([values[values.length - 1]]))
  } else {
    return snake
      .set("ghost", false)
      .set("ghostProgress", List())
  }
}

function reversedAnimationReducer(snake: Snake, values: TweenResult<undefined>[]): Snake {
  if (values.length > 0) {
    return snake
      .set("reversed", true)
      .set("reversedProgress", List([values[values.length - 1]]))
  } else {
    return snake
      .set("reversed", false)
      .set("reversedProgress", List())
  }
}

function wrapEdge(snake: Snake): Snake {
  if (snake.x > SERVER_WIDTH + snake.fatness) {
    snake = stopTail(snake
      .set("x", -snake.fatness)
      .set("lastX", -snake.fatness - 1))
  }

  if (snake.y > SERVER_HEIGHT + snake.fatness) {
    snake = stopTail(snake
      .set("y", -snake.fatness)
      .set("lastY", -snake.fatness - 1))
  }

  if (snake.x < -snake.fatness) {
    snake = stopTail(snake
      .set("x", SERVER_WIDTH + snake.fatness)
      .set("lastX", SERVER_WIDTH + snake.fatness + 1))
  }

  if (snake.y < -snake.fatness) {
    snake = stopTail(snake
      .set("y", SERVER_HEIGHT + snake.fatness)
      .set("lastY", SERVER_HEIGHT + snake.fatness + 1))
  }

  return snake
}

function stopTail(snake: Snake): Snake {
  if (snake.lastEnd != null) {
    snake = snake
      .set("lastEnd", null)
      .set("tailId", snake.tailId + 1)
  }

  return snake
}

function createHole(
  snake: Snake,
  holeTime: number = snake.fatness * window.getGlobal("SKIP_TAIL_FATNESS_MULTIPLIER")): Snake {
  return stopTail(
    snake
      .set("skipTailTicker", holeTime)
      .set("holeChance", window.getGlobal("HOLE_CHANCE_BASE")))
}

function teleportTo(snake: Snake, x: number, y: number, rotation: number): Snake {
  snake = stopTail(snake)
  snake = snake
    .set("x", x)
    .set("lastX", x)
    .set("y", y)
    .set("lastY", y)
    .set("rotation", rotation)
  return createHole(snake, 1 * window.getGlobal("TICK_RATE")) // 1 second
}

function updatePowerupProgress(snake: Snake): Snake {
  const progress = List<PowerupProgress>().concat(
    snake.speedProgress,
    snake.ghostProgress,
    snake.fatnessProgress,
    snake.reversedProgress,
  )
  progress.sort((a, b) => a.order - b.order)
  return snake.set("powerupProgress", progress.map(v => v.progress))
}

export function tick(snake: Snake): Snake {
  snake = snake
    .set("x", snake.x + (Math.sin(snake.rotation) * snake.speed))
    .set("y", snake.y - (Math.cos(snake.rotation) * snake.speed))
  snake = wrapEdge(snake)
  snake = snake.set("fatnessAnimation", animationTick(snake.fatnessAnimation))
  snake = fatnessAnimationReducer(snake, values(numberTweenProviders, snake.fatnessAnimation))
  snake = snake.set("speedAnimation", animationTick(snake.speedAnimation))
  snake = speedAnimationReducer(snake, values(numberTweenProviders, snake.speedAnimation))
  snake = snake.set("ghostAnimation", animationTick(snake.ghostAnimation))
  snake = ghostAnimationReducer(snake, values(undefinedTweenProviders, snake.ghostAnimation))
  snake = snake.set("reversedAnimation", animationTick(snake.reversedAnimation))
  snake = reversedAnimationReducer(snake, values(undefinedTweenProviders, snake.reversedAnimation))
  return updatePowerupProgress(snake)
}

export function rotate(snake: Snake, amount: number): Snake {
  if (snake.reversed) {
    amount = -amount
  }

  return snake.set("rotation", (snake.rotation + amount) % (2 * Math.PI))
}

export function ghostify(snake: Snake, powerup: Powerup): Snake {
  const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
  stopTail(snake)

  const powerupId = powerup.id
  const tween = undefinedTweenProviders.dehydrate(booleanTrue, { duration, powerupId })
  return snake.set("ghostAnimation", add(snake.ghostAnimation, duration, tween))
}

export function speeddown(snake: Snake, powerup: Powerup): Snake {
  const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
  const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

  const tween = numberTweenProviders.dehydrate<LinearInOutParams>(linearAttackDecay, {
    duration,
    powerupId: powerup.id,
    attackDecayTime: halfSecond,
    target: -0.5,
  })
  return snake.set("speedAnimation", add(snake.speedAnimation, duration, tween))
}

export function speedup(snake: Snake, powerup: Powerup): Snake {
  const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
  const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

  const tween = numberTweenProviders.dehydrate<LinearInOutParams>(linearAttackDecay, {
    duration,
    powerupId: powerup.id,
    attackDecayTime: halfSecond,
    target: 0.5,
  })
  return snake.set("speedAnimation", add(snake.speedAnimation, duration, tween))
}

export function fatify(snake: Snake, powerup: Powerup): Snake {
  const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")
  const halfSecond = Math.floor(window.getGlobal("TICK_RATE") * 0.5)

  const tween = numberTweenProviders.dehydrate<LinearInOutParams>(linearAttackDecay, {
    duration,
    powerupId: powerup.id,
    attackDecayTime: halfSecond,
    target: 8,
  })
  return snake.set("fatnessAnimation", add(snake.fatnessAnimation, duration, tween))
}

export function reversify(snake: Snake, powerup: Powerup): Snake {
  const duration = window.getGlobal("POWERUP_ACTIVE_DURATION")

  const powerupId = powerup.id
  const tween = undefinedTweenProviders.dehydrate(booleanTrue, { duration, powerupId })
  return snake.set("reversedAnimation", add(snake.reversedAnimation, duration, tween))
}

export function swapWith(snake1: Snake, snake2: Snake): [Snake, Snake] {
  const snakeX = snake2.x
  const snakeY = snake2.y
  const snakeRot = snake2.rotation
  snake2 = teleportTo(snake2, snake1.x, snake1.y, snake1.rotation)
  snake1 = teleportTo(snake1, snakeX, snakeY, snakeRot)

  return [snake1, snake2]
}

export function createTailPolygon(snake: Snake): [Snake, TailPart | undefined] {
  const r = Math.random()
  let pol: number[] | undefined
  let isTailStart = false

  if (snake.ghost) {
    snake = stopTail(snake)
  } else if (snake.skipTailTicker <= 0) {
    if (r > snake.holeChance) {
      if (snake.lastEnd == null) {
        pol = createPolygon(
          { x: snake.x, y: snake.y },
          { x: snake.lastX, y: snake.lastY }, snake.fatness, snake.lfatness)
        isTailStart = true
      } else {
        pol = createConnectedPolygon({ x: snake.x, y: snake.y }, snake.fatness, snake.lastEnd,
          { x: snake.lastX, y: snake.lastY })
      }

      snake = snake
        .set("lastEnd", pol.slice(0, 2).concat(pol.slice(-2)))
        .set("holeChance", snake.holeChance + window.getGlobal("HOLE_CHANCE_INCREASE"))
    } else {
      snake = createHole(snake)
    }
  } else {
    snake = snake.set("skipTailTicker", snake.skipTailTicker - 1)
  }

  snake = snake
    .set("lastX", snake.x)
    .set("lastY", snake.y)
    .set("lfatness", snake.fatness)

  return [snake, pol && newTailPart(pol, snake.id, snake.tailId, isTailStart)]
}

export interface SnakeI {
  texture: DehydratedTexture
  fatness: number
  alive: boolean
  lastX: number
  lastY: number
  speed: number
  lastEnd: any
  x: number
  y: number
  rotation: number
  id: number
  powerupProgress: List<number>

  lfatness: number
  holeChance: number
  tailTicker: number
  skipTailTicker: number
  tailId: number
  ghost: boolean
  reversed: boolean

  fatnessAnimation: Animation
  fatnessProgress: List<PowerupProgress>
  speedAnimation: Animation
  speedProgress: List<PowerupProgress>
  ghostAnimation: Animation
  ghostProgress: List<PowerupProgress>
  reversedAnimation: Animation
  reversedProgress: List<PowerupProgress>
}

export type Snake = Record.Instance<SnakeI>

// tslint:disable-next-line:variable-name
export const SnakeClass: Record.Class<SnakeI> = Record({
  x: 0,
  y: 0,
  fatness: 0,
  alive: true,
  lastX: 0,
  lastY: 0,
  speed: 0,
  lastEnd: null,
  rotation: 0,
  id: 0,
  powerupProgress: List(),
  lfatness: 0,
  holeChance: 0,
  tailTicker: 0,
  skipTailTicker: 0,
  tailId: 0,
  ghost: false,
  reversed: false,
  fatnessAnimation: newAnimation(),
  fatnessProgress: List(),
  speedAnimation: newAnimation(),
  speedProgress: List(),
  ghostAnimation: newAnimation(),
  ghostProgress: List(),
  reversedAnimation: newAnimation(),
  reversedProgress: List(),
  texture: undefined as any,

})

export function newSnake(
  startPoint: Point,
  rotation: number,
  id: number,
  texture: DehydratedTexture) {
  return new SnakeClass({
    x: startPoint.x,
    y: startPoint.y,
    lastX: startPoint.x,
    lastY: startPoint.y,
    rotation,
    id,
    texture,
    fatness: window.getGlobal("FATNESS_BASE"),
    lfatness: window.getGlobal("FATNESS_BASE"),
    holeChance: window.getGlobal("HOLE_CHANCE_BASE"),
    speed: window.getGlobal("MOVE_SPEED_BASE"),
  })
}
