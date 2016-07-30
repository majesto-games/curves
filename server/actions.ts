import { Point } from "../game/game"

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
    type: ADD_PLAYER
  }
}

export const ROTATE: "ROTATE" = "ROTATE"
export interface Rotate extends Action {
  type: "ROTATE"
  payload: {
    direction: number
    index: number
  }
}

export function rotate(direction: number, index: number): Rotate {
  return {
    type: ROTATE,
    payload: {
      direction: direction,
      index: index,
    }
  }
}

export interface PlayerUpdate {
  x: number
  y: number
  rotation: number
  tailPart: number[]
  alive: boolean
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
  startPoint: Point
  color: number
  rotation: number
  isOwner: boolean
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

export const LEFT = -1
export const RIGHT = 1

export type ServerAction = AddPlayer | Rotate
export type ClientAction  = UpdatePlayers | Start
