import * as quickconnect from "rtc-quickconnect"

import {
  ServerConnection,
  networkClientConnection,
  localClientConnection,
  clientDataChannel,
  serverDataChannel,
  connectAndCount,
  DataChannel,
  networkServerConnection,
  localServerConnection,
} from "server/connections"
import { Game, GameEvent } from "game/game"
import * as cuid from "cuid"

import { Server } from "server/main"
import { Client } from "game/client"
import { addPlayer, start } from "server/actions"

export enum RoomState {
  UNCONNECTED,
  LOBBY_CLIENT,
  LOBBY_SERVER,
  RUNNING,
  CLOSED,
}

export default class Room {
  public game: Game
  public state = RoomState.UNCONNECTED
  private server: ServerConnection
  private roomConnection: quickconnect.connection | undefined
  private eventListeners: ((state: RoomState) => void)[] = []
  constructor(public readonly name: string) {
    this.game = new Game(name)
    this.game.onEvent(e => {
      switch (e) {
        case GameEvent.START: {
          this.setState(RoomState.RUNNING)
          break
        }
        default:
      }
    })
  }

  public connect() {
    if (this.state !== RoomState.UNCONNECTED) {
      return
    }

    connectAndCount(this.name).then(([rc, memberCount]) => {
      this.roomConnection = rc

      if (memberCount > 1) {
        return this.connectAsClient(rc)
      } else {
        return this.connectAsServer(rc)
      }
    }).then(() => {
      this.game.preGame()
    })
  }

  public addPlayer() {
    this.server(addPlayer())
  }

  public onNewState(f: (state: RoomState) => void) {
    this.eventListeners.push(f)

    return () =>
      this.eventListeners = this.eventListeners.filter(g => g !== f)
  }

  public start() {
    if (this.state !== RoomState.LOBBY_SERVER) {
      return
    }

    if (this.game.lobby.names.length < 2) {
      this.server(addPlayer())
    }

    this.server(start())
    this.setState(RoomState.RUNNING)
  }

  public close() {
    this.setState(RoomState.CLOSED)

    if (this.roomConnection != null) {
      this.roomConnection.close()
      this.roomConnection = undefined
    }
  }

  private connectAsClient(rc: quickconnect.connection) {
    this.setState(RoomState.LOBBY_CLIENT)
    console.log("Not server")

    return clientDataChannel(rc).then(({ dc, id }) => {
      this.server = networkServerConnection(dc, id)
      const client = new Client(this.server, this.game)

      dc.onmessage = (evt) => {
        client.receive(JSON.parse(evt.data))
      }

      this.server(addPlayer())
      return
    })
  }

  private connectAsServer(rc: quickconnect.connection) {
    this.setState(RoomState.LOBBY_SERVER)
    console.log("Server")

    const server = new Server(window.getGlobal("TICK_RATE"))
    const id = cuid()

    this.server = localServerConnection(server, id)
    const client = new Client(this.server, this.game)

    server.addConnection(localClientConnection(client, id))

    serverDataChannel(rc, this.handleClientConnections(server))

    this.server(addPlayer())
  }

  private handleClientConnections(server: Server) {

    return (dc: DataChannel, id: string) => {
      const netconn = networkClientConnection(dc, id)
      server.addConnection(netconn)

      dc.onmessage = (evt) => {
        const data = JSON.parse(evt.data)
        server.receive(data, id)
      }

      dc.onclose = (evt) => {
        server.removeConnection(netconn)
      }
    }
  }

  private setState(state: RoomState) {
    this.state = state
    this.eventListeners.forEach(f => f(state))
  }
}
