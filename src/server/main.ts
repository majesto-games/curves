import { getColors } from "game/util"
import { frequency, shuffle } from "utils/array"
import never from "utils/never"
import {
  Point, ServerPlayer, Snake, Powerup, ActivePowerup,
  PowerupType, tick, rotate, createTailPolygon, fatify,
  ghostify, speeddown, speedup, swapWith, reversify, newSnake, newServerPlayer,
} from "game/player"
import {
  ServerTail, TailStorage, newServerTail, addToServerTail,
  serverTailContainsPoint, containsPointExcludeLatest,
  tailStorageModule, tailsForPlayer, TailStorageI, TailPart, getDefaultTailStorage,
} from "game/tail"

import {
  PlayerUpdate,
  Gap,
  GAP,
  TAIL,
  Tail,
  Score,
  started,
  roundEnd,
  updatePlayers,
  spawnPowerup,
  fetchPowerup,
  round,
  ServerAction,
  ServerGameAction,
  ServerRoundAction,
  ADD_PLAYER,
  ROTATE,
  LEFT,
  ClientAction,
  START,
  lobby,
} from "./actions"

import configureStore from "configureStore"
import showDevtools from "showDevtools"

import { ClientConnection, ConnectionId } from "./connections"
import { createStore, Store } from "redux"
import { List, Record, Map as IMap } from "immutable"
import createModule, { Action } from "redux-typescript-module"

export const SERVER_WIDTH = 960
export const SERVER_HEIGHT = 960

interface AlmostPlayerInit {
  name: string
  color: number
  connectionId: ConnectionId
  id: number
}

function fastDistance(x1: number, y1: number, x2: number, y2: number) {
  const a = x1 - x2
  const b = y1 - y2
  return (a * a) + (b * b)
}

function rotationSpeed(fatness: number) {
  return window.getGlobal("ROTATION_SPEED") / (10 + fatness) - (0.02 * 64 / window.getGlobal("TICK_RATE"))
}

const tailsModule = tailStorageModule<ServerTail>(
  () => newServerTail(),
  (tail, part) => {
    return addToServerTail(tail, part)
  },
)

export interface RoundStateI {
  placedPowerups: Powerup[]
  losers: ServerPlayer[]
  nextPowerupId: number
  powerupChance: number
  sent: List<ClientAction>
  incoming: List<[ServerRoundAction, ConnectionId]>,
  outgoing: List<ClientAction>,
  paused: boolean
  pauseDelta: number
  lastUpdate: number
}

export type RoundState = Record.Instance<RoundStateI>

// tslint:disable-next-line:variable-name
export const RoundStateClass: Record.Class<RoundStateI> = Record<RoundStateI>({
  placedPowerups: [],
  losers: [],
  nextPowerupId: 0,
  powerupChance: window.getGlobal("POWERUP_CHANCE_BASE"),
  sent: List(),
  incoming: List(),
  outgoing: List(),
  paused: true,
  pauseDelta: 0,
  lastUpdate: 0,
})

const roundModule = createModule(new RoundStateClass(), {
  SERVER_RESET_POWERUP_CHANCE: (state: RoundState, action: Action<undefined>) => state.remove("powerupChance"),
  SERVER_INCREASE_POWERUP_CHANCE: (state: RoundState, action: Action<undefined>) =>
    state.set("powerupChance", state.get("powerupChance") + window.getGlobal("POWERUP_CHANCE_INCREASE")),
  SERVER_NEXT_POWERUP_ID: (state: RoundState, action: Action<undefined>) =>
    state.set("nextPowerupId", state.get("nextPowerupId") + 1),
  SERVER_TICK: (state: RoundState, action: Action<number>) => {
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = action.payload
    return state.set("lastUpdate", state.lastUpdate + ticksNeeded * 1000 / tickRate)
  },
  SERVER_PAUSE: (state: RoundState, action: Action<number>) => {
    const date = action.payload

    return state
      .set("pauseDelta", date - state.lastUpdate)
      .set("paused", true)
  },
  SERVER_START: (state: RoundState, action: Action<number>) => {
    const date = action.payload

    return state
      .set("lastUpdate", date - state.pauseDelta)
      .set("paused", false)
  },
  SERVER_SET_LAST_UPDATED: (state: RoundState, action: Action<number>) => state.set("lastUpdate", action.payload),
  SERVER_ADD_LOSER: (state: RoundState, action: Action<ServerPlayer>) =>
    state.set("losers", state.get("losers").concat(action.payload)),
  SERVER_SET_PLACED_POWERUPS: (state: RoundState, action: Action<Powerup[]>) =>
    state.set("placedPowerups", action.payload),
  SERVER_ADD_POWERUPS: (state: RoundState, action: Action<Powerup[]>): RoundState => {
    const newPowerups = action.payload
    const s2 = state.set("placedPowerups", state.get("placedPowerups").concat(newPowerups))

    const actions = newPowerups.map(spawnPowerup)
    // TODO: Nicer way of composing this?
    return roundModule.reducer(s2, roundModule.actions.ROUND_ADD_OUTGOING(actions))
  },
  SERVER_RESET_ROUND: (state: RoundState, action: Action<undefined>) => state.clear(),
  ROUND_ADD_INCOMING: (state: RoundState, action: Action<[ServerRoundAction, ConnectionId]>) =>
    state.set("incoming", state.incoming.push(action.payload)),
  ROUND_ADD_OUTGOING: (state: RoundState, action: Action<ClientAction[]>) =>
    state.set("outgoing", state.outgoing.concat(action.payload)),
  ROUND_PROCESSED_OUTGOING: (state: RoundState, action: Action<undefined>) =>
    state
      .set("sent", state.sent.concat(state.outgoing))
      .delete("outgoing"),
})

export interface ServerStateI {
  scores: IMap<number, Score>,
  players: IMap<number, ServerPlayer>,
  colors: List<number>,
  joinable: boolean,
  sent: List<ClientAction>,
  incoming: List<[ServerGameAction, ConnectionId]>,
  outgoing: List<ClientAction>,
  round: RoundState,
  tails: TailStorage<ServerTail>,
}

export type ServerState = Record.Instance<ServerStateI>

// tslint:disable-next-line:variable-name
export const ServerStateClass: Record.Class<ServerStateI> = Record({
  scores: IMap<number, Score>(),
  players: IMap<number, ServerPlayer>(),
  colors: List(getColors(7)),
  joinable: true,
  sent: List(),
  incoming: List(),
  outgoing: List(),
  round: new RoundStateClass(),
  tails: getDefaultTailStorage<ServerTail>(),
})

interface PowerupPickup {
  player: ServerPlayer
  powerup: Powerup
  playersAlive: number[]
}

interface PolygonAdd {
  poly: TailPart,
  playerId: number,
}

const serverModule = createModule(new ServerStateClass(), {
  SERVER_ADD_PLAYER: (state: ServerState, action: Action<AlmostPlayerInit>) => {
    const {
      id,
      name,
      color,
      connectionId,
    } = action.payload

    const player = newServerPlayer(name, id, color, connectionId)
    const score = {
      score: 0,
      id,
    }

    return state
      .set("scores", state.scores.set(id, score))
      .set("players", state.players.set(id, player))
  },
  SERVER_SET_PLAYER: (state: ServerState, action: Action<ServerPlayer>) => {
    const player = action.payload

    return state
      .set("players", state.players.set(player.id, player))
  },
  SERVER_GIVE_POINTS: (state: ServerState, action: Action<Score>) => {
    const points = action.payload
    const scores = state.scores
    const currentScore = scores.get(points.id)!
    const nextScore = {
      id: points.id,
      score: currentScore.score + points.score,
    }

    return state.set("scores", scores.set(points.id, nextScore))
  },
  SERVER_COLOR_POP: (state: ServerState, action: Action<undefined>) => state.set("colors", state.colors.pop()),
  SERVER_GAME_START: (state: ServerState, action: Action<undefined>) =>
    state.set("joinable", false),
  SERVER_ADD_INCOMING: (state: ServerState, action: Action<[ServerGameAction, ConnectionId]>) =>
    state.set("incoming", state.incoming.push(action.payload)),
  SERVER_PROCESSED_INCOMING: (state: ServerState, action: Action<undefined>) => state.delete("incoming"),
  SERVER_ADD_OUTGOING: (state: ServerState, action: Action<ClientAction[]>) =>
    state.set("outgoing", state.outgoing.concat(action.payload)),
  SERVER_PROCESSED_OUTGOING: (state: ServerState, action: Action<undefined>) =>
    state
      .set("sent", state.sent.concat(state.outgoing))
      .delete("outgoing"),
  ROUND_PROCESS_INCOMING: (state: ServerState, _action: Action<undefined>) => {
    state.round.incoming.forEach(([action, connectionId]) => {
      switch (action.type) {
        case ROTATE:
          const { payload } = action
          const player = state.players.get(payload.index)
          if (player != null && player.owner === connectionId) {
            let direction: "steeringRight" | "steeringLeft" = "steeringRight"
            if (payload.direction === LEFT) {
              direction = "steeringLeft"
            }
            state = state
              .set("players", state.players.set(player.id, player.set(direction, payload.value)))

          }
          break
        default:
        // https://github.com/Microsoft/TypeScript/issues/16976
        // never("Server didn't handle", action)
      }
    })

    let r = state.round
    r = r.delete("incoming")
    return state.set("round", r)
  },
  ROUND_POWERUP_PICKUP: (state: ServerState, action: Action<PowerupPickup>) => {
    const { player, powerup, playersAlive } = action.payload

    switch (powerup.type) {
      case "UPSIZE": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = state.players.get(pid)!
            state = serverModule.reducer(
              state,
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", fatify(p.snake!, powerup))),
            )
          })
        break
      }
      case "GHOST": {
        state = serverModule.reducer(
          state,
          serverModule.actions.SERVER_SET_PLAYER(player.set("snake", ghostify(player.snake!, powerup))),
        )
        break
      }
      case "SPEEDDOWN_ME": {
        state = serverModule.reducer(
          state,
          serverModule.actions.SERVER_SET_PLAYER(player.set("snake", speeddown(player.snake!, powerup))),
        )
        break
      }
      case "SPEEDDOWN_THEM": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = state.players.get(pid)!
            state = serverModule.reducer(
              state,
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", speeddown(p.snake!, powerup))),
            )
          })
        break
      }
      case "SPEEDUP_ME": {
        state = serverModule.reducer(
          state,
          serverModule.actions.SERVER_SET_PLAYER(player.set("snake", speedup(player.snake!, powerup))),
        )
        break
      }
      case "SPEEDUP_THEM": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = state.players.get(pid)!
            state = serverModule.reducer(
              state,
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", speedup(p.snake!, powerup))),
            )
          })
        break
      }
      case "SWAP_ME": {
        const others = playersAlive
          .filter(pid => player.id !== pid)
        const swapIndex = Math.floor(Math.random() * others.length)
        const other = state.players.get(others[swapIndex])!
        const [snake1, snake2] = swapWith(player.snake!, other.snake!)
        const playerNew = player.set("snake", snake1)
        const otherNew = other.set("snake", snake2)
        state = serverModule.reducer(
          state,
          serverModule.actions.SERVER_SET_PLAYER(playerNew),
        )
        state = serverModule.reducer(
          state,
          serverModule.actions.SERVER_SET_PLAYER(otherNew),
        )

        break
      }
      case "SWAP_THEM": {
        const others = shuffle(playersAlive
          .filter(pid => player.id !== pid))
        if (others.length >= 2) {
          const other1 = state.players.get(others[0])!
          const other2 = state.players.get(others[1])!
          const [snake1, snake2] = swapWith(other1.snake!, other2.snake!)
          const other1New = player.set("snake", snake1)
          const other2New = player.set("snake", snake2)
          state = serverModule.reducer(
            state,
            serverModule.actions.SERVER_SET_PLAYER(other1New),
          )
          state = serverModule.reducer(
            state,
            serverModule.actions.SERVER_SET_PLAYER(other2New),
          )
        }
        break
      }
      case "REVERSE_THEM": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = state.players.get(pid)!
            state = serverModule.reducer(
              state,
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", reversify(p.snake!, powerup))),
            )
          })
        break
      }
      default:
        never("Picked up unknown powerup", powerup.type)
    }

    const fetchAction = fetchPowerup(player.snake!.id, powerup.id)

    state = state.set("round", roundModule.reducer(state.round, roundModule.actions.ROUND_ADD_OUTGOING([fetchAction])))

    return state
  },
  ROUND_ADD_POLY: (state: ServerState, action: Action<PolygonAdd>) => {

    const { poly, playerId } = action.payload
    const player = state.players.get(playerId)!
    const snake = player.snake!

    if (state.players.toArray()
      .map(p => p.snake).some(collides(state.tails, poly.vertices, snake))) {
      const deadSnake = snake.set("alive", false)
      // TODO: randomize order
      // TODO: SERVER_ADD_LOSER should set the snake to dead automatically
      state = state.set("round", roundModule.reducer(
        state.round,
        roundModule.actions.SERVER_ADD_LOSER(player),
      ))
      // TODO: snake should live in round
      state = serverModule.reducer(
        state,
        serverModule.actions.SERVER_SET_PLAYER(player.set("snake", deadSnake)))
    }

    state = state.set("tails", tailsModule.reducer(state.tails, tailsModule.actions.ADD_TAIL(poly)))

    return state
  },
})

function serverReducer(state: ServerState | undefined, action: Action<AlmostPlayerInit>): ServerState {
  let nextGameState = serverModule.reducer(state, action)
  const roundState = nextGameState.round
  const nextRoundState = roundModule.reducer(roundState, action)
  if (nextRoundState !== roundState) {
    nextGameState = nextGameState.set("round", nextRoundState)
  }

  const tailsState = nextGameState.tails
  const nextTailsState = tailsModule.reducer(tailsState, action)
  if (nextTailsState !== tailsState) {
    nextGameState = nextGameState.set("tails", nextTailsState)
  }

  return nextGameState
}

function collides(tailsState: TailStorage<ServerTail>, p: number[], player: Snake) {
  return (collider?: Snake) => {
    if (!collider) {
      return false
    }

    let tails = tailsForPlayer(tailsState, collider)

    // Special case for last tail for this player
    if (collider === player && tails.size > 0) {
      const last = tails.get(-1)!
      // Modify tails not not contain last part
      tails = tails.slice(0, -1)

      for (let i = 0; i < p.length; i += 2) {
        const x = p[i]
        const y = p[i + 1]

        if (containsPointExcludeLatest(last, x, y)) {
          return true
        }
      }
    }

    for (let i = 0; i < p.length; i += 2) {
      const x = p[i]
      const y = p[i + 1]

      if (tails.some(tail => serverTailContainsPoint(tail, x, y))) {
        return true
      }
    }
    return false
  }
}

export class Server {
  // TODO: playerInits and these sentActions should not be like this
  private playerInits: AlmostPlayerInit[] = []

  private clientConnections: ClientConnection[] = []
  private store: Store<ServerState>

  constructor(private owner: ConnectionId) {
    this.store = configureStore(serverReducer, undefined)
    showDevtools(this.store)
  }

  public receive(action: ServerAction, connectionId: ConnectionId) {
    switch (action.type) {
      case ADD_PLAYER:
      case START:
        this.store.dispatch(serverModule.actions.SERVER_ADD_INCOMING([action, connectionId]))
        setImmediate(() => this.processIncoming(), 0)
        break
      case ROTATE:
        this.store.dispatch(roundModule.actions.ROUND_ADD_INCOMING([action, connectionId]))
        break
      default:
        never("Server didn't handle", action)
    }
  }

  public addConnection(conn: ClientConnection) {
    this.clientConnections = this.clientConnections.concat(conn)
    console.log("connection added to: ", conn.id, " total: ", this.clientConnections.length)

    const gameActions = this.store.getState().sent
    console.log(`resending ${gameActions.size} game actions`)
    gameActions.forEach(conn)

    const roundActions = this.store.getState().round.sent
    console.log(`resending ${roundActions.size} round actions`)
    roundActions.forEach(conn)
  }

  public removeConnection(conn: ClientConnection) {
    console.log("removing connection", conn)
    this.clientConnections = this.clientConnections.filter(v => v.id !== conn.id)
  }

  private processIncoming() {
    // TODO: migrate to reducer
    this.store.getState().incoming.forEach(([action, connectionId]) => {
      switch (action.type) {
        case ADD_PLAYER: {
          this.addPlayer(connectionId)
          break
        }
        case START:
          if (connectionId === this.owner) {
            this.startGame()
          }
          break
        default:
          never("Server didn't handle", action)
      }
    })
    this.store.dispatch(serverModule.actions.SERVER_PROCESSED_INCOMING(undefined))
  }

  private addPlayer(connectionId: ConnectionId) {
    if (!this.store.getState().joinable) {
      return
    }

    const id = this.store.getState().players.size
    const color = this.store.getState().colors.last()!
    this.store.dispatch(serverModule.actions.SERVER_COLOR_POP(undefined))

    const playerInit: AlmostPlayerInit = { name, color, connectionId, id }

    this.playerInits.push(playerInit)

    this.store.dispatch(serverModule.actions.SERVER_ADD_PLAYER(playerInit))

    this.sendForGame([lobby(this.store.getState().players.toArray())])
  }

  private startGame() {

    const playerInits = this.playerInits.map(v => {
      return {
        name: v.name,
        color: v.color,
        owner: v.connectionId,
        id: v.id,
      }
    })
    this.store.dispatch(serverModule.actions.SERVER_GAME_START(undefined))
    this.sendForGame([started(playerInits)])

    console.log("starting server")
    this.startRound()
  }

  private sendForGame(actions: ClientAction[]) {
    this.store.dispatch(serverModule.actions.SERVER_ADD_OUTGOING(actions))
    setImmediate(() => this.send(), 0)
  }

  private sendForRound(actions: ClientAction[]) {
    this.store.dispatch(roundModule.actions.ROUND_ADD_OUTGOING(actions))
    setImmediate(() => this.send(), 0)
  }

  private send() {
    const state = this.store.getState()
    const outgoingForGame = state.outgoing
    const outgoingForRound = state.round.outgoing
    this.clientConnections.forEach(c => {
      outgoingForGame.forEach(a => c(a))
      outgoingForRound.forEach(a => c(a))
    })
    this.store.dispatch(serverModule.actions.SERVER_PROCESSED_OUTGOING(undefined))
    this.store.dispatch(roundModule.actions.ROUND_PROCESSED_OUTGOING(undefined))
  }

  private pause() {
    this.store.dispatch(roundModule.actions.SERVER_PAUSE(Date.now()))
  }

  private playerById(id: number): ServerPlayer | undefined {
    return this.store.getState().players.get(id)
  }

  private rotateTick(player: ServerPlayer) {
    const rotSpeed = rotationSpeed(player.snake!.fatness)

    if (player.steeringLeft) {
      this.store.dispatch(serverModule.actions.SERVER_SET_PLAYER(
        player.set("snake", rotate(player.snake!, -rotSpeed)),
      ))
    }

    if (player.steeringRight) {
      this.store.dispatch(serverModule.actions.SERVER_SET_PLAYER(
        player.set("snake", rotate(player.snake!, rotSpeed)),
      ))
    }

  }

  private collidesPowerup(player: Snake, powerup: Powerup) {
    const { x, y, fatness } = player
    const { location } = powerup
    return fastDistance(x, y, location.x, location.y) < (fatness * fatness) + (16 * 16)
  }

  private spawnPowerups() {
    const powerups: Powerup[] = []
    if (Math.random() < this.store.getState().round.powerupChance) {
      this.store.dispatch(roundModule.actions.SERVER_RESET_POWERUP_CHANCE(undefined))
      const x = Math.round(Math.random() * SERVER_WIDTH)
      const y = Math.round(Math.random() * SERVER_HEIGHT)

      const alivePlayerCount = this.store.getState().players.toArray().filter(player => player.snake!.alive).length

      const swapThemChance = alivePlayerCount > 2 ? 0.5 : 0

      const powerupType = frequency<PowerupType>([
        [1, "SWAP_ME"],
        [swapThemChance, "SWAP_THEM"],
        [2, "GHOST"],
        [3, "UPSIZE"],
        [1, "REVERSE_THEM"],
        [1, "SPEEDUP_ME"],
        [1, "SPEEDUP_THEM"],
        [1, "SPEEDDOWN_ME"],
        [1, "SPEEDDOWN_THEM"],
      ], 11 + swapThemChance)

      powerups.push({
        type: powerupType,
        id: this.store.getState().round.nextPowerupId,
        location: {
          x,
          y,
        },
      })

      this.store.dispatch(roundModule.actions.SERVER_NEXT_POWERUP_ID(undefined))
    } else {
      this.store.dispatch(roundModule.actions.SERVER_INCREASE_POWERUP_CHANCE(undefined))
    }

    return powerups
  }

  private serverTick() {
    if (this.store.getState().round.paused) {
      return
    }
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = Math.floor((Date.now() - this.store.getState().round.lastUpdate) * tickRate / 1000)

    this.store.dispatch(serverModule.actions.ROUND_PROCESS_INCOMING(undefined))

    this.store.dispatch(roundModule.actions.SERVER_TICK(ticksNeeded))

    for (let i = 0; i < ticksNeeded; i++) {
      const playersAlive = this.store.getState().players.toArray()
        .filter(player => player.snake!.alive)
        .map(p => p.id)

      if (playersAlive.length < 2) {
        const playerOrder = this.store.getState().round.losers.map(p => p.id).concat(playersAlive)
        for (let j = 0; j < playerOrder.length; j++) {
          this.store.dispatch(serverModule.actions.SERVER_GIVE_POINTS({
            id: playerOrder[j],
            score: j,
          }))
        }
        this.sendForGame([roundEnd(this.store.getState().scores.toArray(), playerOrder[playerOrder.length - 1])])

        this.pause()
        setTimeout(() => {
          this.startRound()
        }, 3000)
        return
      }

      const playersWithTail: [number, Tail | Gap][] = []
      for (const playerId of playersAlive) {
        this.rotateTick(this.playerById(playerId)!)
        let snake = this.playerById(playerId)!.snake!
        snake = tick(snake)

        // Create tail polygon, this returns undefined if it's supposed to be a hole
        const [snake2, poly] = createTailPolygon(snake)
        snake = snake2
        this.store.dispatch(
          serverModule.actions.SERVER_SET_PLAYER(this.playerById(playerId)!.set("snake", snake)),
        )

        let tailAction: Tail | Gap = { type: GAP }

        if (poly != null) {

          tailAction = {
            type: TAIL,
            payload: poly,
          }

          this.store.dispatch(
            serverModule.actions.ROUND_ADD_POLY({ poly, playerId }),
          )
        }

        // TODO: remove order bug (e.g. by first pickingup all power ups, then applying them)

        const filteredPlacedPowerups = this.store.getState().round.placedPowerups.filter(powerup => {
          if (this.collidesPowerup(snake, powerup)) {
            this.store.dispatch(
              serverModule.actions.ROUND_POWERUP_PICKUP({ player: this.playerById(playerId)!, powerup, playersAlive }),
            )
            return false
          }
          return true
        })

        this.store.dispatch(roundModule.actions.SERVER_SET_PLACED_POWERUPS(filteredPlacedPowerups))

        playersWithTail.push([playerId, tailAction])
      }

      // collect player updates after all actions are performed
      const playerUpdates: PlayerUpdate[] = playersWithTail.map(([pid, t]) => {
        const player = this.playerById(pid)!
        const snake = player.snake!

        return {
          alive: snake.alive,
          rotation: snake.rotation,
          tail: t,
          x: snake.x,
          y: snake.y,
          fatness: snake.fatness,
          id: pid,
          powerupProgress: snake.powerupProgress.toJS(),
        }
      })

      this.store.dispatch(roundModule.actions.SERVER_ADD_POWERUPS(this.spawnPowerups()))

      const actions = [
        updatePlayers(playerUpdates),
      ]

      this.sendForRound(actions)
    }

    setTimeout(() => this.serverTick(), (this.store.getState().round.lastUpdate + (1000 / tickRate)) - Date.now())
  }

  private start() {
    if (this.store.getState().round.paused) {
      this.store.dispatch(roundModule.actions.SERVER_START(Date.now()))
      this.serverTick()
    }
  }

  private startRound() {
    this.store.dispatch(roundModule.actions.SERVER_RESET_ROUND(undefined))
    this.store.dispatch(tailsModule.actions.RESET_TAILS(undefined))
    const rx = SERVER_WIDTH * 0.3
    const ry = SERVER_HEIGHT * 0.3
    const player1Radians = Math.random() * 2 * Math.PI
    const deltaRadians = (2 * Math.PI) / this.store.getState().players.toArray().length

    const shuffledPlayers = shuffle(this.store.getState().players.toArray().slice())

    const snakeInits = shuffledPlayers.map((p, i) => {
      const rotation = Math.random() * Math.PI * 2

      // Place players in a circle
      const playerRadian = player1Radians + (i * deltaRadians)

      const startPoint: Point = {
        x: rx * Math.cos(playerRadian) + (SERVER_WIDTH / 2),
        y: ry * Math.sin(playerRadian) + (SERVER_HEIGHT / 2),
      }

      const snake = newSnake(startPoint, rotation, p.id, undefined as any)
      // WARNING: Modifies player even though this is a .map
      this.store.dispatch(serverModule.actions.SERVER_SET_PLAYER(p.set("snake", snake)))

      return {
        startPoint,
        rotation,
        id: p.id,
      }
    })

    const startDelay = window.getGlobal("ROUND_START_DELAY")

    this.sendForRound([round(snakeInits, startDelay)])

    setTimeout(() => {
      this.start()
    }, startDelay)
  }

}
