import { Point, Powerup } from "game/player"
import { TailPart, NotRemoved } from "game/tail"

export interface Action {
  readonly type: string
  payload?: any
}

export const ADD_PLAYER: "ADD_PLAYER" = "ADD_PLAYER"
export interface AddPlayer extends Action {
  type: "ADD_PLAYER"
}
export function addPlayer(): AddPlayer {
  return {
    type: ADD_PLAYER,
  }
}

export const ROTATE: "ROTATE" = "ROTATE"
export interface Rotate extends Action {
  type: "ROTATE"
  payload: {
    direction: number
    index: number,
  }
}

export function rotate(direction: number, index: number): Rotate {
  return {
    type: ROTATE,
    payload: {
      direction,
      index,
    },
  }
}

export const TAIL: "TAIL" = "TAIL"
export interface Tail extends Action {
  type: "TAIL"
  payload: TailPart & NotRemoved
}

export const GAP: "GAP" = "GAP"
export interface Gap extends Action {
  type: "GAP"
}

export const POWERUP_SPAWN: "POWERUP_SPAWN" = "POWERUP_SPAWN"
export interface PowerupSpawn extends Action {
  type: "POWERUP_SPAWN",
  payload: Powerup
}

export function spawnPowerup(powerup: Powerup): PowerupSpawn {
  return {
    type: POWERUP_SPAWN,
    payload: powerup,
  }
}

export const POWERUP_FETCH: "POWERUP_FETCH" = "POWERUP_FETCH"
export interface PowerupFetch extends Action {
  type: "POWERUP_FETCH",
  payload: number
}

export function fetchPowerup(id: number): PowerupFetch {
  return {
    type: POWERUP_FETCH,
    payload: id,
  }
}

export interface PlayerUpdate {
  x: number
  y: number
  rotation: number
  alive: boolean
  tail: Tail | Gap
  fatness: number
}
export const UPDATE_PLAYERS: "UPDATE_PLAYERS" = "UPDATE_PLAYERS"
export interface UpdatePlayers extends Action {
  type: "UPDATE_PLAYERS"
  payload: PlayerUpdate[]
}
export function updatePlayers(updates: PlayerUpdate[]): UpdatePlayers {
  return {
    type: UPDATE_PLAYERS,
    payload: updates,
  }
}

export interface PlayerInit {
  name: string
  color: number
  isOwner: boolean
  id: number
}
export const START: "START" = "START"
export interface Start extends Action {
  type: "START"
  payload: PlayerInit[]
}
export function start(playerInits: PlayerInit[]): Start {
  return {
    type: START,
    payload: playerInits,
  }
}

export interface SnakeInit {
  startPoint: Point,
  rotation: number,
  id: number,
}

export const ROUND: "ROUND" = "ROUND"
export interface Round extends Action {
  type: "ROUND"
  payload: SnakeInit[]
}
export function round(snakeInits: SnakeInit[]): Round {
  return {
    type: ROUND,
    payload: snakeInits,
  }
}

export interface Score {
  score: number
  id: number
}

export const ROUND_END: "ROUND_END" = "ROUND_END"
export interface RoundEnd extends Action {
  type: "ROUND_END"
  payload: {
    scores: Score[],
    winners: number[],
  }
}
export function roundEnd(scores: Score[], winners: number[]): RoundEnd {
  return {
    type: ROUND_END,
    payload: {
      scores,
      winners,
    },
  }
}

export const END: "END" = "END"
export interface End extends Action {
  type: "END"
  payload?: number
}
export function end(winnerId?: number): End {
  return {
    type: END,
    payload: winnerId,
  }
}

export const LEFT = -1
export const RIGHT = 1

export type ServerAction = AddPlayer | Rotate
export type ClientAction = UpdatePlayers | Start | End | PowerupSpawn | PowerupFetch | Round | RoundEnd
