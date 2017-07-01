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
import { addPlayer, start, Lobby } from "server/actions"
import { Observable } from "utils/observable"

function connectAsClient(client: Client, rc: quickconnect.connection) {
  console.log("Not server")

  return clientDataChannel(rc).then(({ dc, id }) => {
    const serverConn = networkServerConnection(dc, id)

    dc.onmessage = (evt) => {
      client.receive(JSON.parse(evt.data))
    }

    serverConn(addPlayer())
    return [serverConn, () => rc.close()]
  })
}

function connectAsServer(client: Client, rc: quickconnect.connection): [ServerConnection, () => void] {
  console.log("Server")

  const id = cuid()
  const server = new Server(id)

  const serverConn = localServerConnection(server, id)

  server.addConnection(localClientConnection(client, id))

  serverDataChannel(rc, handleClientConnections(server))

  serverConn(addPlayer())
  client.isServer = true
  return [serverConn, () => rc.close()]
}

function connectAsLocal(client: Client): [ServerConnection, () => void] {
  console.log("Local server")

  const id = cuid()
  const server = new Server(id)

  const serverConn = localServerConnection(server, id)

  server.addConnection(localClientConnection(client, id))

  serverConn(addPlayer())
  client.isServer = true

  // tslint:disable-next-line:no-empty
  return [serverConn, () => console.log("wat")]
}

function handleClientConnections(server: Server) {

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

export function connect(room: string): Client {
  // [connection, close]
  let resolveConn: (v: [ServerConnection, () => void]) => void

  const serverpromise = new Promise<[ServerConnection, () => void]>((resolve, reject) => {
    resolveConn = resolve
  })

  const client = new Client(serverpromise)

  connectAndCount(room).then(([rc, memberCount]) => {

    if (memberCount > 1) {
      connectAsClient(client, rc).then(resolveConn)
    } else {
      return resolveConn(connectAsServer(client, rc))
    }
  }).catch(e => {
    // TODO: Present an error
    client.close()
  })

  return client
}

export function connectLocal(): Client {
  let resolveConn: (v: [ServerConnection, () => void]) => void

  const serverpromise = new Promise<[ServerConnection, () => void]>((resolve, reject) => {
    resolveConn = resolve
  })

  const client = new Client(serverpromise)

  // TODO: This is fucking weird. We have to wait until the client has been
  // created and runs the serverpromise to have resolveConn be the resolve
  // function of the serverpromise.
  setTimeout(() => resolveConn(connectAsLocal(client)), 0)

  return client
}
