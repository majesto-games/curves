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
import { addPlayer } from "server/actions"

export default class Room {
  public game: Game
  private server: ServerConnection
  private closed: boolean
  private roomConnection: quickconnect.connection | undefined
  constructor(public readonly name: string) {
    this.game = new Game(name)
    this.game.onEvent(e => {
      switch (e) {
        case GameEvent.ADD_PLAYER: {
          this.server(addPlayer())
          break
        }
        default:
      }
    })
  }

  public connect() {
    connectAndCount(this.name).then(([rc, memberCount]) => {
      this.roomConnection = rc

      if (this.closed) {
        this.close()
        return
      }

      if (memberCount > 1) {
        return this.connectAsClient(rc)
      } else {
        return this.connectAsServer(rc)
      }
    }).then(() => {
      this.game.preGame()
    })
  }

  public close() {
    this.closed = true

    if (this.roomConnection != null) {
      this.roomConnection.close()
      this.roomConnection = undefined
    }
  }

  private connectAsClient(rc: quickconnect.connection) {
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
    console.log("Server")

    this.game.waitForPlayers()

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
}
