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
  tailStorageModule, tailsForPlayer, TailStorageI, TailPart,
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
  ADD_PLAYER,
  ROTATE,
  LEFT,
  ClientAction,
  START,
  lobby,
} from "./actions"

import { ClientConnection, ConnectionId } from "./connections"
import { createStore, combineReducers, Store } from "redux"
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
  lastUpdate: number
  sentActions: ClientAction[]
}

export type RoundState = Record.Instance<RoundStateI>

// tslint:disable-next-line:variable-name
export const RoundStateClass: Record.Class<RoundStateI> = Record({
  placedPowerups: [],
  losers: [],
  nextPowerupId: 0,
  powerupChance: window.getGlobal("POWERUP_CHANCE_BASE"),
  lastUpdate: 0,
  sentActions: [],
})

const roundModule = createModule(new RoundStateClass(), {
  SERVER_RESET_SENT_ACTIONS: (state: RoundState, action: Action<undefined>) => state.remove("sentActions"),
  SERVER_ADD_SENT_ACTIONS: (state: RoundState, action: Action<ClientAction[]>) =>
    state.set("sentActions", state.get("sentActions").concat(action.payload)),
  SERVER_RESET_POWERUP_CHANCE: (state: RoundState, action: Action<undefined>) => state.remove("powerupChance"),
  SERVER_INCREASE_POWERUP_CHANCE: (state: RoundState, action: Action<undefined>) =>
    state.set("powerupChance", state.get("powerupChance") + window.getGlobal("POWERUP_CHANCE_INCREASE")),
  SERVER_NEXT_POWERUP_ID: (state: RoundState, action: Action<undefined>) =>
    state.set("nextPowerupId", state.get("nextPowerupId") + 1),
  SERVER_TICK: (state: RoundState, action: Action<number>) => {
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = action.payload
    return state.set("lastUpdate", state.get("lastUpdate") + ticksNeeded * 1000 / tickRate)
  },
  SERVER_SET_LAST_UPDATED: (state: RoundState, action: Action<number>) => state.set("lastUpdate", action.payload),
  SERVER_ADD_LOSER: (state: RoundState, action: Action<ServerPlayer>) =>
    state.set("losers", state.get("losers").concat(action.payload)),
  SERVER_SET_PLACED_POWERUPS: (state: RoundState, action: Action<Powerup[]>) =>
    state.set("placedPowerups", action.payload),
  SERVER_ADD_POWERUPS: (state: RoundState, action: Action<Powerup[]>) =>
    state.set("placedPowerups", state.get("placedPowerups").concat(action.payload)),
  SERVER_RESET_ROUND: (state: RoundState, action: Action<undefined>) => state.clear(),
})

interface RoundAndTailState {
  tails: TailStorage<ServerTail>,
  rest: RoundState,
}

export interface ServerStateI {
  scores: IMap<number, Score>,
  players: IMap<number, ServerPlayer>,
}

export type ServerState = Record.Instance<ServerStateI>

// tslint:disable-next-line:variable-name
export const ServerStateClass: Record.Class<ServerStateI> = Record({
  scores: IMap<number, Score>(),
  players: IMap<number, ServerPlayer>(),
})

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
})

interface ServerReducerState {
  round: RoundAndTailState,
  rest: ServerState,
}

const reducers = {
  round: combineReducers({
    tails: tailsModule.reducer,
    rest: roundModule.reducer,
  }),
  rest: serverModule.reducer,
}

const reducer = combineReducers<ServerReducerState>(reducers)

export class Server {
  private playerInits: AlmostPlayerInit[] = []
  // TODO: playerInits and these sentActions should not be like this
  private sentActions: ClientAction[] = []

  private clientConnections: ClientConnection[] = []
  private pauseDelta: number = 0
  private paused: boolean = true
  private colors: number[] = getColors(7)
  private store: Store<ServerReducerState>
  private joinable = true

  constructor(private owner: ConnectionId) {
    this.store = createStore(reducer)
  }

  public receive(action: ServerAction, connectionId: ConnectionId) {
    switch (action.type) {
      case ADD_PLAYER: {
        this.addPlayer(connectionId)
        break
      }
      case START: {
        if (connectionId === this.owner) {
          this.startGame()
        }
        break
      }
      case ROTATE: {
        const { payload } = action
        const player = this.playerById(payload.index)
        if (player != null && player.owner === connectionId) {
          let direction: "steeringRight" | "steeringLeft" = "steeringRight"
          if (payload.direction === LEFT) {
            direction = "steeringLeft"
          }
          this.store.dispatch(serverModule.actions.SERVER_SET_PLAYER(
            player.set(direction, payload.value),
          ))

        }

        break
      }
      default:
        never("Server didn't handle", action)
    }
  }

  public addConnection(conn: ClientConnection) {
    this.clientConnections = this.clientConnections.concat(conn)
    console.log("connection added to: ", conn.id, " total: ", this.clientConnections.length)

    this.sentActions.forEach(conn)
    console.log(`resending ${this.store.getState().round.rest.sentActions.length} actions`)
    this.store.getState().round.rest.sentActions.forEach(conn)
  }

  public removeConnection(conn: ClientConnection) {
    console.log("removing connection", conn)
    this.clientConnections = this.clientConnections.filter(v => v.id !== conn.id)
  }

  private addPlayer(connectionId: ConnectionId) {
    if (!this.joinable) {
      return
    }

    const id = this.store.getState().rest.players.size
    const color = this.colors.pop() as number

    const playerInit: AlmostPlayerInit = { name, color, connectionId, id }

    this.playerInits.push(playerInit)

    this.store.dispatch(serverModule.actions.SERVER_ADD_PLAYER(playerInit))

    this.send([lobby(this.store.getState().rest.players.toArray())])
  }

  private startGame() {
    this.joinable = false

    const playerInits = this.playerInits.map(v => {
      return {
        name: v.name,
        color: v.color,
        owner: v.connectionId,
        id: v.id,
      }
    })
    this.send([started(playerInits)])
    // TODO: Remove this hack by figuring out a better way of doing playerInits
    this.sentActions = this.store.getState().round.rest.sentActions
    this.store.dispatch(roundModule.actions.SERVER_RESET_SENT_ACTIONS(undefined))

    console.log("starting server")
    this.startRound()
  }

  private send(actions: ClientAction[]) {
    this.store.dispatch(roundModule.actions.SERVER_ADD_SENT_ACTIONS(actions))
    this.clientConnections.forEach(c => {
      actions.forEach(a => c(a))
    })
  }

  private pause() {
    this.pauseDelta = Date.now() - this.store.getState().round.rest.lastUpdate
    this.paused = true
  }

  private playerById(id: number): ServerPlayer | undefined {
    return this.store.getState().rest.players.get(id)
  }

  private rotateTick(player: ServerPlayer) {
    const rotSpeed = rotationSpeed(player.snake!.fatness)
    let direction = 0

    if (player.steeringLeft) {
      direction -= 1
    }
    if (player.steeringRight) {
      direction += 1
    }

    this.store.dispatch(serverModule.actions.SERVER_SET_PLAYER(
      player.set("snake", rotate(player.snake!, direction * rotSpeed)),
    ))
  }

  private collides(p: number[], player: Snake) {
    return (collider: Snake) => {
      let tails = tailsForPlayer(this.store.getState().round.tails, collider)

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

  private collidesPowerup(player: Snake, powerup: Powerup) {
    const { x, y, fatness } = player
    const { location } = powerup
    return fastDistance(x, y, location.x, location.y) < (fatness * fatness) + (16 * 16)
  }

  private spawnPowerups() {
    const powerups: Powerup[] = []
    if (Math.random() < this.store.getState().round.rest.powerupChance) {
      this.store.dispatch(roundModule.actions.SERVER_RESET_POWERUP_CHANCE(undefined))
      const x = Math.round(Math.random() * SERVER_WIDTH)
      const y = Math.round(Math.random() * SERVER_HEIGHT)

      const alivePlayerCount = this.store.getState().rest.players.toArray().filter(player => player.snake!.alive).length

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
        id: this.store.getState().round.rest.nextPowerupId,
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
    if (this.paused) {
      return
    }
    const tickRate = window.getGlobal("TICK_RATE")

    const ticksNeeded = Math.floor((Date.now() - this.store.getState().round.rest.lastUpdate) * tickRate / 1000)

    this.store.dispatch(roundModule.actions.SERVER_TICK(ticksNeeded))

    for (let i = 0; i < ticksNeeded; i++) {
      const playersAlive = this.store.getState().rest.players.toArray()
        .filter(player => player.snake!.alive)
        .map(p => p.id)

      if (playersAlive.length < 2) {
        const playerOrder = this.store.getState().round.rest.losers.map(p => p.id).concat(playersAlive)
        for (let j = 0; j < playerOrder.length; j++) {
          this.store.dispatch(serverModule.actions.SERVER_GIVE_POINTS({
            id: playerOrder[j],
            score: j,
          }))
        }
        this.send([roundEnd(this.store.getState().rest.scores.toArray(), playerOrder[playerOrder.length - 1])])

        this.pause()
        setTimeout(() => {
          this.startRound()
        }, 3000)
        return
      }

      const collidedPowerups: { snake: Snake, powerup: Powerup }[] = []
      const playersWithTail: [ServerPlayer, Tail | Gap][] = []
      for (const playerId of playersAlive) {
        let player = this.playerById(playerId)!
        this.rotateTick(player)
        player = this.playerById(playerId)!
        let snake = player.snake!
        snake = tick(snake)

        // Create tail polygon, this returns undefined if it's supposed to be a hole
        const [snake2, poly] = createTailPolygon(snake)
        snake = snake2

        let tailAction: Tail | Gap = { type: GAP }

        if (poly != null) {
          if (this.store.getState().rest.players.toArray()
            .map(p => p.snake).some(this.collides(poly.vertices, snake))) {
            snake = snake.set("alive", false)
            // TODO: randomize order
            this.store.dispatch(roundModule.actions.SERVER_ADD_LOSER(player))
          }

          tailAction = {
            type: TAIL,
            payload: poly,
          }

          this.store.dispatch(tailsModule.actions.ADD_TAIL(poly))
        }

        // TODO: remove order bug (e.g. by first pickingup all power ups, then applying them)
        player = player.set("snake", snake)
        this.store.dispatch(serverModule.actions.SERVER_SET_PLAYER(player))

        const filteredPlacedPowerups = this.store.getState().round.rest.placedPowerups.filter(powerup => {
          if (this.collidesPowerup(snake, powerup)) {
            collidedPowerups.push(this.powerupPickup(player, powerup, playersAlive))
            player = this.playerById(playerId)!
            return false
          }
          return true
        })

        this.store.dispatch(roundModule.actions.SERVER_SET_PLACED_POWERUPS(filteredPlacedPowerups))

        playersWithTail.push([player, tailAction])
      }

      // collect player updates after all actions are performed
      const playerUpdates: PlayerUpdate[] = [] = playersWithTail.map(([p, t]) => {
        const snake = p.snake!

        return {
          alive: snake.alive,
          rotation: snake.rotation,
          tail: t,
          x: snake.x,
          y: snake.y,
          fatness: snake.fatness,
          id: p.id,
          powerupProgress: snake.powerupProgress.toJS(),
        }
      })

      const newPowerups = this.spawnPowerups()
      this.store.dispatch(roundModule.actions.SERVER_ADD_POWERUPS(newPowerups))

      const actions = [
        updatePlayers(playerUpdates),
        ...newPowerups.map(spawnPowerup),
        ...collidedPowerups.map(({ snake, powerup }) => fetchPowerup(snake.id, powerup.id)),
      ]

      this.send(actions)
    }

    setTimeout(() => this.serverTick(), (this.store.getState().round.rest.lastUpdate + (1000 / tickRate)) - Date.now())
  }

  private powerupPickup(player: ServerPlayer, powerup: Powerup, playersAlive: number[]) {

    switch (powerup.type) {
      case "UPSIZE": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = this.playerById(pid)!
            this.store.dispatch(
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", fatify(p.snake!, powerup))),
            )
          })
        break
      }
      case "GHOST": {
        this.store.dispatch(
          serverModule.actions.SERVER_SET_PLAYER(player.set("snake", ghostify(player.snake!, powerup))),
        )
        break
      }
      case "SPEEDDOWN_ME": {
        this.store.dispatch(
          serverModule.actions.SERVER_SET_PLAYER(player.set("snake", speeddown(player.snake!, powerup))),
        )
        break
      }
      case "SPEEDDOWN_THEM": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = this.playerById(pid)!
            this.store.dispatch(
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", speeddown(p.snake!, powerup))),
            )
          })
        break
      }
      case "SPEEDUP_ME": {
        this.store.dispatch(
          serverModule.actions.SERVER_SET_PLAYER(player.set("snake", speedup(player.snake!, powerup))),
        )
        break
      }
      case "SPEEDUP_THEM": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = this.playerById(pid)!
            this.store.dispatch(
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", speedup(p.snake!, powerup))),
            )
          })
        break
      }
      case "SWAP_ME": {
        const others = playersAlive
          .filter(pid => player.id !== pid)
        const swapIndex = Math.floor(Math.random() * others.length)
        const other = this.playerById(others[swapIndex])!
        const [snake1, snake2] = swapWith(player.snake!, other.snake!)
        const playerNew = player.set("snake", snake1)
        const otherNew = player.set("snake", snake2)
        this.store.dispatch(
          serverModule.actions.SERVER_SET_PLAYER(playerNew),
        )
        this.store.dispatch(
          serverModule.actions.SERVER_SET_PLAYER(otherNew),
        )
        break
      }
      case "SWAP_THEM": {
        const others = shuffle(playersAlive
          .filter(pid => player.id !== pid))
        if (others.length >= 2) {
          const other1 = this.playerById(others[0])!
          const other2 = this.playerById(others[1])!
          const [snake1, snake2] = swapWith(other1.snake!, other2.snake!)
          const other1New = player.set("snake", snake1)
          const other2New = player.set("snake", snake2)
          this.store.dispatch(
            serverModule.actions.SERVER_SET_PLAYER(other1New),
          )
          this.store.dispatch(
            serverModule.actions.SERVER_SET_PLAYER(other2New),
          )
        }
        break
      }
      case "REVERSE_THEM": {
        playersAlive
          .filter(pid => player.id !== pid)
          .forEach(pid => {
            const p = this.playerById(pid)!
            this.store.dispatch(
              serverModule.actions.SERVER_SET_PLAYER(p.set("snake", reversify(p.snake!, powerup))),
            )
          })
        break
      }
      default:
        never("Picked up unknown powerup", powerup.type)
    }

    return { snake: player.snake!, powerup }
  }

  private start() {
    if (this.paused) {
      if (this.pauseDelta) {
        this.store.dispatch(roundModule.actions.SERVER_SET_LAST_UPDATED(Date.now() - this.pauseDelta))
      } else {
        this.store.dispatch(
          roundModule.actions.SERVER_SET_LAST_UPDATED(Date.now() - (1000 / window.getGlobal("TICK_RATE"))),
        )
      }
      this.paused = false
      this.serverTick()
    }
  }

  private startRound() {
    this.store.dispatch(roundModule.actions.SERVER_RESET_ROUND(undefined))
    this.store.dispatch(tailsModule.actions.RESET_TAILS(undefined))
    const rx = SERVER_WIDTH * 0.3
    const ry = SERVER_HEIGHT * 0.3
    const player1Radians = Math.random() * 2 * Math.PI
    const deltaRadians = (2 * Math.PI) / this.store.getState().rest.players.toArray().length

    const shuffledPlayers = shuffle(this.store.getState().rest.players.toArray().slice())

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

    this.send([round(snakeInits, startDelay)])

    setTimeout(() => {
      this.start()
    }, startDelay)
  }

}
