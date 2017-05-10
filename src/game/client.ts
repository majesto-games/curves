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
} from "server/actions"

import { Sprite, Graphics, autoDetectRenderer, Container, CanvasRenderer, WebGLRenderer } from "pixi.js"

import pressedKeys, { KEYS, registerKeys } from "./keys"

import { Game } from "./game"

let keyCombos: { left: KEYS, right: KEYS }[] = []

registerKeys([KEYS.RETURN])

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
  public players: (Player | undefined)[] = []
  private currentRound: RoundState
  private localIndex = 0

  constructor(private connection: ServerConnection, private game: Game) {
    this.currentRound = new RoundState((id) => this.newTail(id))
    this.game.onDraw(() => this.handleKeys())
  }

  public receive(action: ClientAction) {
    switch (action.type) {
      case STARTED: {
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
        const scoresWithColors = payload.scores.map(s => ({
          id: s.id,
          score: s.score,
          color: 13,
        }))

        this.roundEnd(scoresWithColors, payload.winner)
        break
      }
      case LOBBY: {
        const { payload } = action
        this.game.setLobby(payload)
        break
      }
      default:
        failedToHandle(action)
    }
  }

  private createPlayer(name: string, color: number, isOwner: boolean, id: number) {
    let localIndex: number | undefined

    if (isOwner) {
      localIndex = this.localIndex++
    }

    const player = new Player(undefined, name, id, color, localIndex)

    return player
  }

  private updatePlayers = (playerUpdates: PlayerUpdate[]) => {
    for (let update of playerUpdates) {
      const player = this.players[update.id]
      if (player == null) {
        continue
      }

      player.snake!.x = update.x
      player.snake!.y = update.y
      player.snake!.rotation = update.rotation
      player.snake!.alive = update.alive
      player.snake!.fatness = update.fatness
      this.game.updateSnakeGraphics(player.snake!)

      if (update.tail.type === TAIL) {
        this.currentRound.tails.add(update.tail.payload)
      }
    }
  }

  private start = (players: PlayerInit[]) => {
    console.log("starting with", players)
    for (let player of players) {
      const newPlayer = this.createPlayer(player.name, player.color, player.owner === this.connection.id, player.id)
      this.players[player.id] = newPlayer
    }
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

    const players: Player[] = this.players.filter(p => p != null) as Player[]

    players.forEach(player => {
      this.currentRound.tails.initPlayer(player.snake!)
    })

    this.game.newRound(players.map(p => p.snake!), players.map(p => p.color))
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
      if (p == null) {
        return
      }

      let keys = window.UserConfig.playerKeys[p.localIndex!]
      if (!keys) {
        return
      }

      if (pressedKeys[keys.left]) {
        this.rotateLeft(p.id)
      }

      if (pressedKeys[keys.right]) {
        this.rotateRight(p.id)
      }
    })
  }
}
