import { Server } from "./main"
import { Client } from "../game/main"

import {
  LEFT,
  ClientAction,
  ServerAction,
  ADD_PLAYER,
  ROTATE,
  START,
  UPDATE_PLAYERS,
  END,
} from "./actions"

export function mapServerActions(server: Server) {
  return (action: ServerAction) => {
    switch (action.type) {
      case ADD_PLAYER: {
        server.addPlayer()
        break
      }
      case ROTATE: {
        const { payload } = action
        payload.direction === LEFT ? server.rotateLeft(payload.index) : server.rotateRight(payload.index)
        break
      }
      default:
        console.log("Server didn't handle", action)
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
      default:
        console.log("Client didn't handle", action)
    }
  }
}
