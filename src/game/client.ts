import { Point, ClientPlayer, Snake, Powerup } from "./player"
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

import pressedKeys, { KEYS, registerKeys } from "./keys"

import { Game } from "./game"
import { Observable } from "utils/observable"
import never from "utils/never"
import { hexToString } from "game/util"

const keyCombos: { left: KEYS, right: KEYS }[] = []

registerKeys([KEYS.RETURN])

class RoundState {
  public powerupSprites: { [id: number]: Sprite | undefined } = {}
  public tails: TailStorage<ClientTail>

  constructor(createTail: (playerId: number) => ClientTail) {
    this.tails = new TailStorage(createTail)
  }
}

export enum ClientState {
  UNCONNECTED,
  LOBBY,
  GAME,
  CLOSED,
}

function solidColorTemplate(baseFill: string, canvas: HTMLCanvasElement) {
  canvas.width = 2
  canvas.height = 2
  const context = canvas.getContext("2d")!
  context.fillStyle = baseFill
  context.fillRect(0, 0, 2, 2)
}

function straightStripesTemplate(stripeColor: string, width: number): TextureTemplate {
  return (baseFill, canvas) => {
    const size = width * 2
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext("2d")!

    context.fillStyle = baseFill
    context.fillRect(0, 0, size, size)
    context.fillStyle = stripeColor
    context.fillRect(width / 2, 0, width, size)
  }
}

// should be tileable in all directions
type TextureTemplate = (baseFill: string, canvas: HTMLCanvasElement) => void

function createTexture(color: number, textureTemplate: TextureTemplate) {
  const canvas = document.createElement("canvas")
  textureTemplate(hexToString(color), canvas)
  const l = new BaseTexture(canvas)
  l.wrapMode = PIXI.WRAP_MODES.REPEAT
  return new Texture(l)
}

export function fillSquare(width: number, height: number) {
  return new Float32Array([-width, height, -width, -height, width, height, width, -height])
}

export class Client {
  // TODO: Join players, lobby, and game.colors
  public players: (ClientPlayer | undefined)[] = []
  public game = new Game()
  public lobby = new Observable<Lobby>({ players: [] })
  public scores = new Observable<Score[]>([])
  public state = new Observable<ClientState>(ClientState.UNCONNECTED)
  private currentRound: RoundState
  private localIndex = 0
  private connection: ServerConnection
  private _close: () => void

  constructor(serverPromise: Promise<[ServerConnection, () => void]>) {
    this.currentRound = new RoundState((id) => this.newTail(id))
    this.game.onDraw.subscribe(() => this.handleKeys())
    serverPromise.then(([connection, close]) => {
      this.connection = connection
      this._close = close
      this.state.set(ClientState.LOBBY)
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
        this.roundEnd(payload.scores, payload.winner)
        break
      }
      case LOBBY: {
        const { payload } = action
        this.lobby.set(payload)
        break
      }
      default:
        never("Client didn't handle", action)
    }
  }

  public close() {
    this._close()
    this.state.set(ClientState.CLOSED)
  }

  public addPlayer() {
    this.connection(addPlayer())
  }

  public start() {
    // TODO: add this owner check in server as well
    // TODO: having isOwner in connection is not the right place
    console.log(this.state.value !== ClientState.LOBBY, !this.connection.isOwner)
    if (this.state.value !== ClientState.LOBBY || !this.connection.isOwner) {
      return
    }

    if (this.lobby.value.players.length < 2) {
      this.connection(addPlayer())
    }

    this.connection(start())
  }

  private createPlayer(name: string, color: number, isOwner: boolean, id: number) {
    let localIndex: number | undefined

    if (isOwner) {
      localIndex = this.localIndex++
    }

    const texture = createTexture(color, straightStripesTemplate("white", 4))
    const player = new ClientPlayer(name, id, color, texture, localIndex)

    if (isOwner) {
      player.steeringLeft.subscribe(value => {
        this.connection(rotate(LEFT, value, id))
      })
      player.steeringRight.subscribe(value => {
        this.connection(rotate(RIGHT, value, id))
      })
    }

    return player
  }

  private updatePlayers = (playerUpdates: PlayerUpdate[]) => {
    for (const update of playerUpdates) {
      const player = this.players[update.id]
      if (player == null) {
        continue
      }

      player.snake!.x = update.x
      player.snake!.y = update.y
      player.snake!.rotation = update.rotation
      player.snake!.alive = update.alive
      player.snake!.fatness = update.fatness
      player.snake!.powerupProgress = update.powerupProgress

      // TODO: Remove this code smell
      this.game.inRound()

      if (update.tail.type === TAIL) {
        this.currentRound.tails.add(update.tail.payload)
      }
    }
  }

  private started(players: PlayerInit[]) {
    this.state.set(ClientState.GAME)
    for (const player of players) {
      const newPlayer = this.createPlayer(player.name, player.color, player.owner === this.connection.id, player.id)
      this.players[player.id] = newPlayer
    }

    this.scores.set(players.map(({ id }) => ({ id, score: 0 })))
  }

  private round = (snakeInits: SnakeInit[], delay: number) => {
    snakeInits.forEach(({ startPoint, rotation, id }) => {
      const snake = new Snake(startPoint, rotation, id)
      const player = this.playerById(id)!

      // TODO: don't draw graphics in here
      const graphics = new PIXI.mesh.Mesh(
        player.texture,
        fillSquare(1, 1),
        fillSquare(1, 1),
        new Uint16Array([0, 1, 2, 3]))
      const mask = new Graphics()
      mask.beginFill(0x000000)

      mask.drawCircle(0, 0, 1)
      mask.endFill()
      // adding the mask as child makes it follow the snake position
      graphics.addChild(mask)
      // also sets mask.renderable to false :)
      graphics.mask = mask
      graphics.rotation = rotation
      snake.graphics = graphics

      snake.powerupGraphics = new Graphics()

      player.snake = snake
    })

    const players: ClientPlayer[] = this.players.filter(p => p != null) as ClientPlayer[]

    players.forEach(player => {
      this.currentRound.tails.initPlayer(player.snake!)
    })

    this.game.newRound(players.map(p => p.snake!), players.map(p => p.color), delay,
      snake => {
        const player = this.playerById(snake.id)!
        if (player.localIndex != null) {
          const keys = window.UserConfig.playerKeys[player.localIndex]
          return [KEYS[keys.left], KEYS[keys.right], player.color]
        }

        return undefined
      })
  }

  private roundEnd = (scores: Score[], winner: number) => {
    this.scores.set(scores)
    this.game.roundEnd(this.playerById(winner)!)
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
    this.currentRound.powerupSprites[powerup.id] = this.game.addPowerup(powerup)
  }

  private fetchPowerup(snakeId: number, powerupId: number) {
    const powerupSprite = this.currentRound.powerupSprites[powerupId]!
    this.game.removePowerup(powerupSprite, snakeId, powerupId)
    this.currentRound.powerupSprites[powerupId] = undefined

    // play cool sound
  }

  private newTail(playerId: number) {
    const tail = new ClientTail(this.playerById(playerId)!.texture)
    this.game.addTail(tail)

    return tail
  }

  private handleKeys() {
    this.players.forEach(p => {
      if (p == null) {
        return
      }

      const keys = window.UserConfig.playerKeys[p.localIndex!]
      if (!keys) {
        return
      }

      p.steeringLeft.set(pressedKeys[keys.left] || window.PhoneControls.left)
      p.steeringRight.set(pressedKeys[keys.right] || window.PhoneControls.right)
    })
  }
}
