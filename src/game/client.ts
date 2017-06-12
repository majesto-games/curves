import { Point, ClientPlayer, Snake, Powerup, newSnake, newClientPlayer } from "./player"
import {
  ClientTail, TailStorage, addToServerTail, addToClientTail, newClientTail,
  tailStorageModule, TailPart,
} from "./tail"
import {
  ServerConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount,
} from "server/connections"
import {
  PlayerUpdate,
  PlayerInit,
  GAP,
  TAIL,
  SnakeInit,
  Score,
  ClientAction,
  LEFT,
  Action as CommAction,
  ServerAction,
  ADD_PLAYER,
  ROTATE,
  STARTED,
  UPDATE_PLAYERS,
  END,
  POWERUP_SPAWN,
  POWERUP_FETCH,
  ROUND,
  ROUND_END,
  rotate,
  RIGHT,
  LOBBY,
  Lobby,
  addPlayer,
  start,
} from "server/actions"

import {
  Sprite,
  Graphics,
  autoDetectRenderer,
  Container,
  CanvasRenderer,
  WebGLRenderer,
  BaseTexture,
  Texture,
} from "pixi.js"

import { KEYS } from "./keys"

import { Game } from "./game"
import { Observable } from "utils/observable"
import never from "utils/never"
import { hexToString, luminosity } from "game/util"
import { registerTextureProvider, stripeColorTexture, textureProviders } from "./texture"
import createModule, { Action, Module } from "redux-typescript-module/lib"
import { createStore, Store } from "redux"
import { List, Record } from "immutable"

export enum ClientConnectionState {
  UNCONNECTED,
  LOBBY,
  GAME,
  CLOSED,
}

export interface ClientStateI {
  lobby: Lobby
  scores: Score[]
  connectionState: ClientConnectionState
}

export type ClientState = Record.Instance<ClientStateI>

// tslint:disable-next-line:variable-name
export const ClientStateClass: Record.Class<ClientStateI> = Record({
  lobby: {
    players: [],
  },
  scores: [],
  connectionState: ClientConnectionState.UNCONNECTED,
})

const clientModule = createModule(new ClientStateClass(), {
  SET_LOBBY: (state: ClientState, action: Action<Lobby>) => state.set("lobby", action.payload),
  SET_SCORES: (state: ClientState, action: Action<Score[]>) => {
    const scores = action.payload.slice().sort((a, b) => b.score - a.score)
    return state.set("scores", scores)
  },
  SET_CONNECTION_STATE: (state: ClientState, action: Action<ClientConnectionState>) =>
    state.set("connectionState", action.payload),
})

export function fillSquare(width: number, height: number) {
  return new Float32Array([-width, height, -width, -height, width, height, width, -height])
}

export class Client {
  // TODO: Join players, lobby, and game.colors
  public store: Store<ClientState>
  public players: (ClientPlayer | undefined)[] = []
  public game = new Game()
  public isServer = false
  private roundPowerupSprites: { [id: number]: Sprite | undefined } = {}
  private tailStorageMod = tailStorageModule(
    (id) => this.newTail(id),
    (tail, part) => {
      return addToClientTail(tail, part)
    },
  )
  private tailStore: Store<TailStorage<ClientTail>>
  private localIndex = 0
  private textureIndex = 0
  private connection: ServerConnection
  private _close: () => void

  constructor(serverPromise: Promise<[ServerConnection, () => void]>) {
    this.store = createStore(clientModule.reducer)
    this.tailStore = createStore(this.tailStorageMod.reducer)
    this.game.onDraw.subscribe(() => this.handleKeys())
    serverPromise.then(([connection, close]) => {
      this.connection = connection
      this._close = close
      this.store.dispatch(clientModule.actions.SET_CONNECTION_STATE(ClientConnectionState.LOBBY))
    }).catch(e => {
      console.error(e)
      this.close()
    })

  }

  public receive(action: ClientAction) {
    switch (action.type) {
      case STARTED: {
        const { payload } = action
        this.started(payload)
        break
      }
      case UPDATE_PLAYERS: {
        const { payload } = action
        this.updatePlayers(payload)
        break
      }
      case END: {
        const { payload } = action
        this.end(payload)
        break
      }
      case POWERUP_SPAWN: {
        const { payload } = action
        this.spawnPowerup(payload)
        break
      }
      case POWERUP_FETCH: {
        const { payload } = action
        this.fetchPowerup(payload.snakeId, payload.powerupId)
        break
      }
      case ROUND: {
        const { payload } = action
        this.round(payload.snakes, payload.delay)
        break
      }
      case ROUND_END: {
        const { payload } = action
        this.roundEnd(payload.scores, payload.winnerId)
        break
      }
      case LOBBY: {
        const { payload } = action
        this.store.dispatch(clientModule.actions.SET_LOBBY(payload))
        break
      }
      default:
        never("Client didn't handle", action)
    }
  }

  public close() {
    if (this._close) {
      this._close()
    }
    this.store.dispatch(clientModule.actions.SET_CONNECTION_STATE(ClientConnectionState.CLOSED))
  }

  public addPlayer() {
    this.connection(addPlayer())
  }

  public start() {
    if (this.store.getState().connectionState !== ClientConnectionState.LOBBY || !this.connection) {
      return
    }

    this.connection(start())
  }

  private createPlayer(name: string, color: number, isOwner: boolean, id: number) {
    let localIndex: number | undefined

    if (isOwner) {
      localIndex = this.localIndex++
    }

    const stripeColor = luminosity(color, 0.75)

    const texture = textureProviders.dehydrate(stripeColorTexture, { color, stripeColor })

    const player = newClientPlayer(name, id, color, texture, localIndex, isOwner)

    return player
  }

  private updatePlayers = (playerUpdates: PlayerUpdate[]) => {
    for (const update of playerUpdates) {
      let player = this.players[update.id]
      if (player == null) {
        continue
      }

      const snake = player.snake!
      player = player.set("snake", player.snake!
        .set("x", update.x)
        .set("y", update.y)
        .set("rotation", update.rotation)
        .set("alive", update.alive)
        .set("fatness", update.fatness)
        .set("powerupProgress", List(update.powerupProgress)))

      this.players[update.id] = player

      // TODO: Remove this code smell
      this.game.inRound()

      if (update.tail.type === TAIL) {
        this.tailStore.dispatch(this.tailStorageMod.actions.ADD_TAIL(update.tail.payload))
      }
    }

    this.game.setSnakes(
      this.players.filter(player => player != null).map((player: ClientPlayer) => player.snake!),
    )
  }

  private started(players: PlayerInit[]) {
    this.store.dispatch(clientModule.actions.SET_CONNECTION_STATE(ClientConnectionState.GAME))
    for (const player of players) {
      const newPlayer = this.createPlayer(player.name, player.color, player.owner === this.connection.id, player.id)
      this.players[player.id] = newPlayer
    }

    this.store.dispatch(clientModule.actions.SET_SCORES(players.map(({ id }) => ({ id, score: 0 }))))
  }

  private round = (snakeInits: SnakeInit[], delay: number) => {
    this.tailStorageMod = tailStorageModule(
      (id) => this.newTail(id),
      (tail, part) => {
        return addToClientTail(tail, part)
      },
    )
    this.tailStore = createStore(this.tailStorageMod.reducer)
    snakeInits.forEach(({ startPoint, rotation, id }) => {
      const player = this.playerById(id)!
      const snake = newSnake(startPoint, rotation, id, player.texture)

      this.players[id] = player.set("snake", snake)
    })

    const players: ClientPlayer[] = this.players.filter(p => p != null) as ClientPlayer[]

    this.game.newRound(players.map(p => p.snake!), players.map(p => p.color), delay, this.tailStore,
      snake => {
        const player = this.playerById(snake.id)!
        if (player.localIndex != null) {
          const keys = window.UserConfig.playerKeys[player.localIndex]
          return [KEYS[keys.left], KEYS[keys.right], player.color]
        }

        return undefined
      })
  }

  private roundEnd = (scores: Score[], winnerId: number) => {
    this.store.dispatch(clientModule.actions.SET_SCORES(scores))
    this.game.roundEnd(this.playerById(winnerId)!)
  }

  private playerById(id: number): ClientPlayer | undefined {
    return this.players.find(p => p != null && p.id === id)
  }

  private end = (winnerId?: number) => {
    if (winnerId != null) {
      this.game.end(this.playerById(winnerId))
    } else {
      this.game.end()
    }
  }

  private spawnPowerup(powerup: Powerup) {
    this.game.addPowerup(powerup)
  }

  private fetchPowerup(snakeId: number, powerupId: number) {
    const powerupSprite = this.roundPowerupSprites[powerupId]!
    this.game.removePowerup(snakeId, powerupId)
    this.roundPowerupSprites[powerupId] = undefined

    // TODO: play cool sound
  }

  private newTail(playerId: number) {
    const tail = newClientTail(this.playerById(playerId)!.texture)

    return tail
  }

  private handleKeys() {
    this.players = this.players.map(p => {
      if (p == null) {
        return p
      }

      const keys = window.UserConfig.playerKeys[p.localIndex!]
      if (!keys) {
        return p
      }

      if (p.isOwner) {
        const alreadyGoingLeft = p.steeringLeft
        const wantToGoLeft = window.Keys[keys.left] || window.PhoneControls.left

        if (alreadyGoingLeft !== wantToGoLeft) {
          this.connection(rotate(LEFT, wantToGoLeft, p.id))
          p = p.set("steeringLeft", wantToGoLeft)
        }

        const alreadyGoingRight = p.steeringRight
        const wantToGoRight = window.Keys[keys.right] || window.PhoneControls.right

        if (alreadyGoingRight !== wantToGoRight) {
          this.connection(rotate(RIGHT, wantToGoRight, p.id))
          p = p.set("steeringRight", wantToGoRight)
        }
      }

      return p
    })
  }
}
