import * as quickconnect from "rtc-quickconnect"
import freeice = require("freeice")
import { Server } from "./main"
import { Client } from "game/client"
import { Point, Powerup } from "game/player"
import { SERVER_URL } from "config"
import * as cuid from "cuid"

import {
  PlayerUpdate,
  PlayerInit,
  SnakeInit,
  round,
  roundEnd,
  addPlayer,
  rotate,
  LEFT,
  RIGHT,
  Action,
  updatePlayers,
  started,
  end,
  POWERUP_SPAWN,
  spawnPowerup,
  fetchPowerup,
  Score,
  ClientAction,
  ServerAction,
} from "./actions"

export type ConnectionId = string

export interface ServerConnection {
  id: ConnectionId
  isOwner: boolean
  close(): void
  (action: ServerAction): void
}

export interface ClientConnection {
  id: ConnectionId
  (action: ClientAction): void
}

export function networkClientConnection(
  dataChannel: DataChannel,
  id: ConnectionId,
): ClientConnection {
  return Object.assign(
    (a: ClientAction) => dataChannel.send(JSON.stringify(a)),
    { id },
  )
}

export function localClientConnection(
  client: Client,
  id: ConnectionId,
): ClientConnection {
  return Object.assign(
    (a: ClientAction) => client.receive(a),
    { id },
  )
}

export function networkServerConnection(
  dataChannel: DataChannel,
  id: ConnectionId,
): ServerConnection {
  return Object.assign(
    (a: ServerAction) => {
      if (dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(a))
      }
    },
    {
      id,
      isOwner: false,
      close: () => dataChannel.close(),
    },
  )
}

export function localServerConnection(
  server: Server,
  id: ConnectionId,
): ServerConnection {
  return Object.assign(
    (a: ServerAction) => server.receive(a, id),
    {
      id,
      isOwner: true,
      close: () => {
        // no-op
      },
    },
  )
}

export interface DataChannel {
  onmessage: (evt: {
    data: string,
  }) => void
  onclose: (evt: {
    data: string,
  }) => void
  send: (msg: string) => void
  close: () => void
  readyState: "connecting" | "open" | "closing" | "closed"
}

function getId() {
  let id = sessionStorage.getItem("id")
  if (id == null) {
    id = cuid()
    sessionStorage.setItem("id", id)
  }
  return id
}

export function clientDataChannel(rc: quickconnect.connection) {
  return new Promise<{
    dc: DataChannel,
    id: string,
  }>((resolve, reject) => {

    // tell quickconnect we want a datachannel called test
    rc.createDataChannel("test")
      .on("channel:opened:test", (peerId: string, dc: DataChannel) => {
        console.log("opened channel", peerId, dc)

        const id = getId()

        dc.send(JSON.stringify({
          type: "CONNECT",
          id,
        }))

        dc.onmessage = (evt) => {
          if (evt.data === "WELCOME") {
            console.log(`got WELCOME from peer ${peerId}`)
            resolve({ dc, id })
          }
        }
      })
      .on("channel:closed:test", (peerId: string, dc: DataChannel) => {
        console.log("closed channel", peerId, dc)
      })
      .on("peer:reconnecting", (a: any, b: any) => {
        console.log("reconnecting", a, b)
      })
      .feed((a: any) => {
        console.log("feed", a)
      })
  })
}

export function serverDataChannel(rc: quickconnect.connection, cb: (dc: DataChannel, id: string) => void) {
  // tell quickconnect we want a datachannel called test
  rc.createDataChannel("test")
    // when the test channel has opened a RTCDataChannel to a peer, let us know
    .on("channel:opened:test", function(peerId: string, dc: DataChannel) {
      console.log("opened channel", peerId, dc)
      dc.onmessage = (evt) => {
        const data = JSON.parse(evt.data)
        if (data.type === "CONNECT" && data.id != null) {
          dc.send("WELCOME")
          console.log(`sending WELCOME to peer ${peerId} with client ID ${data.id}`)
          cb(dc, data.id)
        }
      }
    })
    .on("channel:closed:test", (peerId: string, dc: DataChannel) => {
      console.log("closed channel", peerId, dc)
    })
}

export function connectAndCount(room: string): Promise<[quickconnect.connection, number]> {
  const rc = quickconnect(SERVER_URL, { room, iceServers: freeice() })
  return new Promise<[quickconnect.connection, number]>((resolve) => {
    rc.once("message:roominfo", (data: { memberCount: number }) => {
      console.log("roomInfo", data)
      resolve([rc, data.memberCount])
    })
  })
}
