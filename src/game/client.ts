import { Point, Player, Snake, Powerup } from "./player"
import { ClientTail, TailStorage } from "./tail"
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
  Action,
  ServerAction,
  ADD_PLAYER,
  ROTATE,
  START,
  UPDATE_PLAYERS,
  END,
  POWERUP_SPAWN,
  POWERUP_FETCH,
  ROUND,
  ROUND_END,
  rotate,
  RIGHT,
} from "server/actions"

import { Sprite, Graphics, autoDetectRenderer, Container, CanvasRenderer, WebGLRenderer } from "pixi.js"

import pressedKeys, { KEYS, registerKeys } from "./keys"

import { Game } from "./game"

let keyCombos: { left: KEYS, right: KEYS }[] = []

function resetCombos() {
  keyCombos = [{ left: KEYS.LEFT, right: KEYS.RIGHT }, { left: KEYS.A, right: KEYS.D }]
}
resetCombos()
registerKeys(Array.prototype.concat.apply([], keyCombos.map(n => [n.left, n.right])))
registerKeys([KEYS.RETURN])

function createPlayer(name: string, color: number, isOwner: boolean, id: number) {
  let keys: ClientKeys | undefined

  if (isOwner) {
    keys = keyCombos.pop()
  }

  const player = new Player(undefined, name, id, color, keys)

  return player
}

export interface ClientKeys {
  left: KEYS
  right: KEYS
}

class RoundState {
  public powerupSprites: { [id: number]: Sprite | undefined } = {}
  public tails: TailStorage<ClientTail>

  constructor(createTail: (playerId: number) => ClientTail) {
    this.tails = new TailStorage(createTail)
  }
}

function failedToHandle(x: never): never {
  throw new Error(`Client didn't handle ${x}`)
}

export class Client {
  public players: Player[] = []
  private currentRound: RoundState

  constructor(private connection: ServerConnection, private game: Game) {
    this.currentRound = new RoundState((id) => this.newTail(id))
    this.game.onDraw(() => this.handleKeys())
  }

  public receive(action: ClientAction) {
    switch (action.type) {
      case START: {
        const { payload } = action
        this.start(payload)
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
        this.fetchPowerup(payload)
        break
      }
      case ROUND: {
        const { payload } = action
        this.round(payload)
        break
      }
      case ROUND_END: {
        const { payload } = action
        this.roundEnd(payload.scores, payload.winner)
        break
      }
      default:
        failedToHandle(action)
    }
  }

  private updatePlayers = (playerUpdates: PlayerUpdate[]) => {
    for (let i = 0; i < playerUpdates.length; i++) {
      const update = playerUpdates[i]
      // TODO fix ids
      const player = this.players[i]

      player.snake!.x = update.x
      player.snake!.y = update.y
      player.snake!.rotation = update.rotation
      player.snake!.alive = update.alive
      player.snake!.fatness = update.fatness
      this.game.updatePlayer(player.snake!)

      if (update.tail.type === TAIL) {
        this.currentRound.tails.add(update.tail.payload)
      }
    }
  }

  private start = (players: PlayerInit[]) => {
    console.log("starting with", players)
    this.players = players.map((player) => createPlayer(player.name,
      player.color, player.owner === this.connection.id, player.id))
  }

  private round = (snakeInits: SnakeInit[]) => {
    snakeInits.forEach(({ startPoint, rotation, id }) => {
      const snake = new Snake(startPoint, rotation, id)
      const player = this.playerById(id)!

      player.snake = snake

      const graphics = new Graphics()
      graphics.beginFill(player.color)
      graphics.drawCircle(0, 0, 1)
      graphics.endFill()

      player.snake!.graphics = graphics
    })

    this.players.forEach(player => {
      this.currentRound.tails.initPlayer(player.snake!)
    })

    this.game.newRound(this.players.map(p => p.snake!))
  }

  private roundEnd = (scores: Score[], winner: number) => {

    this.game.roundEnd(scores, this.playerById(winner)!)
  }

  private rotateLeft = (id: number) => {
    this.connection(rotate(LEFT, id))
  }

  private rotateRight = (id: number) => {
    this.connection(rotate(RIGHT, id))
  }

  private playerById(id: number): Player | undefined {
    return this.players.find(p => p.id === id)
  }

  private end = (winnerId?: number) => {
    if (winnerId != null) {
      this.game.end(this.playerById(winnerId))
    } else {
      this.game.end()
    }

    resetCombos()
  }

  private spawnPowerup(powerup: Powerup) {
    this.currentRound.powerupSprites[powerup.id] = this.game.addPowerup(powerup)
  }

  private fetchPowerup(id: number) {
    const powerupSprite = this.currentRound.powerupSprites[id]!
    this.game.removePowerup(powerupSprite)
    this.currentRound.powerupSprites[id] = undefined

    // play cool sound
  }

  private newTail(playerId: number) {
    const tail = new ClientTail(this.playerById(playerId)!.color)
    this.game.addTail(tail)

    return tail
  }

  private handleKeys() {
    this.players.forEach(p => {
      if (!p.keys) {
        return
      }

      if (pressedKeys[p.keys.left]) {
        this.rotateLeft(p.id)
      }

      if (pressedKeys[p.keys.right]) {
        this.rotateRight(p.id)
      }
    })
  }
}
