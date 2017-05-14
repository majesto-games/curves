import { Point, Powerup, Player } from "game/player"
import { TailPart, NotRemoved } from "game/tail"
import { ConnectionId } from "server/connections"

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

export const START: "START" = "START"
export interface Start extends Action {
  type: "START"
}
export function start(): Start {
  return {
    type: START,
  }
}

export interface Lobby {
    players: Player[]
}

export const LOBBY: "LOBBY" = "LOBBY"
export interface LobbyAction extends Action {
  type: "LOBBY"
  payload: Lobby
}
export function lobby(players: Player[]): LobbyAction {
  return {
    type: LOBBY,
    payload: {
      players,
    },
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
  id: number
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
  owner: ConnectionId
  id: number
}
export const STARTED: "STARTED" = "STARTED"
export interface Started extends Action {
  type: "STARTED"
  payload: PlayerInit[]
}
export function started(playerInits: PlayerInit[]): Started {
  return {
    type: STARTED,
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
  payload: {
    snakes: SnakeInit[],
    delay: number,
  }
}
export function round(snakes: SnakeInit[], delay: number): Round {
  return {
    type: ROUND,
    payload: {
      snakes,
      delay,
    },
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
    winner: number,
  }
}
export function roundEnd(scores: Score[], winner: number): RoundEnd {
  return {
    type: ROUND_END,
    payload: {
      scores,
      winner,
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

export type ServerAction = AddPlayer | Rotate | Start
export type ClientAction = UpdatePlayers | Started | End | PowerupSpawn | PowerupFetch | Round | RoundEnd | LobbyAction
