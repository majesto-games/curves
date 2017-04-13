import { Point, Player, TICK_RATE, Powerup } from "./player"
import { ClientTail, TailStorage } from "./tail"
import {
  ServerConnection,
  LocalServerConnection,
  NetworkClientConnection,
  NetworkServerConnection,
  LocalClientConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount,
} from "server/connections"
import {
  PlayerUpdate,
  PlayerInit,
  GAP,
  TAIL,
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

function createPlayer(name: string, startPoint: Point, color: number,
  rotation: number, isOwner: boolean, id: number) {
  let keys: ClientKeys | undefined

  if (isOwner) {
    keys = keyCombos.pop()
  }

  const player = new Player(name, startPoint, color, rotation, id, keys)

  const graphics = new Graphics()
  graphics.beginFill(color)
  graphics.drawCircle(0, 0, 1)
  graphics.endFill()

  player.graphics = graphics

  return player
}

export interface ClientKeys {
  left: KEYS
  right: KEYS
}

export class Client {

  public players: Player[] = []
  public id: number
  private powerupSprites: { [id: number]: Sprite | undefined } = {}
  private tails = new TailStorage((i) => this.newTail(i))

  constructor(private connection: ServerConnection, private game: Game) {
  }

  public updatePlayers = (playerUpdates: PlayerUpdate[]) => {
    for (let i = 0; i < playerUpdates.length; i++) {
      const update = playerUpdates[i]
      // TODO fix ids
      const player = this.players[i]

      player.x = update.x
      player.y = update.y
      player.rotation = update.rotation
      player.alive = update.alive
      player.fatness = update.fatness
      this.game.updatePlayer(player)

      if (update.tail.type === TAIL) {
        this.tails.add(update.tail.payload)
      }
    }
  }

  public start = (players: PlayerInit[]) => {
    console.log("starting with", players)
    this.players = players.map((player) => createPlayer(player.name, player.startPoint,
      player.color, player.rotation, player.isOwner, player.id))
    this.players.forEach(player => {
      this.game.addPlayer(player)
      this.tails.initPlayer(player)
    })
  }

  public rotateLeft = (id: number) => {
    this.connection.rotateLeft(id)
  }

  public rotateRight = (id: number) => {
    this.connection.rotateRight(id)
  }

  public playerById(id: number): Player | undefined {
    return this.players.find(p => p.id === id)
  }

  public resetCombos() {
    // TODO: Migrate combos to live in the client
    resetCombos()
  }

  public end = (winnerId?: number) => {
    if (winnerId != null) {
      this.game.end(this.playerById(winnerId))
    } else {
      this.game.end()
    }
  }

  public spawnPowerup(powerup: Powerup) {
    this.powerupSprites[powerup.id] = this.game.addPowerup(powerup)
  }

  public fetchPowerup(id: number) {
    const powerupSprite = this.powerupSprites[id]!
    this.game.removePowerup(powerupSprite)
    this.powerupSprites[id] = undefined

    // play cool sound
  }

  private newTail(playerId: number) {
    const tail = new ClientTail(this.playerById(playerId)!.color)
    this.game.addTail(tail)

    return tail
  }
}
