import { Server } from "./main"
import { Client } from "game/client"

import {
  LEFT,
  Action,
  ClientAction,
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
} from "./actions"

export function mapServerActions(server: Server) {
  return (action: ServerAction, connectionId: any) => {
    switch (action.type) {
      case ADD_PLAYER: {
        server.addPlayer(connectionId)
        break
      }
      case ROTATE: {
        const { payload } = action
        if (payload.direction === LEFT) {
          server.rotateLeft(payload.index, connectionId)
        } else {
          server.rotateRight(payload.index, connectionId)
        }
        break
      }
      default:
        failedToHandle("Server", action)
    }
  }
}

export function mapClientActions(client: Client) {
  return (action: ClientAction) => {
    switch (action.type) {
      case START: {
        const { payload } = action
        client.start(payload)
        break
      }
      case UPDATE_PLAYERS: {
        const { payload } = action
        client.updatePlayers(payload)
        break
      }
      case END: {
        const { payload } = action
        client.end(payload)
        break
      }
      case POWERUP_SPAWN: {
        const { payload } = action
        client.spawnPowerup(payload)
        break
      }
      case POWERUP_FETCH: {
        const { payload } = action
        client.fetchPowerup(payload)
        break
      }
      case ROUND: {
        const { payload } = action
        client.round(payload)
        break
      }
      case ROUND_END: {
        const { payload } = action
        client.roundEnd(payload)
        break
      }
      default:
        failedToHandle("Client", action)
    }
  }
}

function failedToHandle(target: "Client" | "Server", x: never): never {
  throw new Error(`${target} didn't handle ${x}`)
}
