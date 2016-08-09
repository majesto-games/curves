import * as quickconnect from "rtc-quickconnect"
import freeice = require("freeice")
import { Server } from "./main"
import { Client } from "../game/main"
import { SERVER_URL } from "../config"

import {
  PlayerUpdate,
  PlayerInit,
  addPlayer,
  rotate,
  LEFT,
  RIGHT,
  Action,
  updatePlayers,
  start,
  END,
  end
} from "./actions"

export interface ServerConnection {
  addPlayer(): void
  rotateLeft(index: number): void
  rotateRight(index: number): void
}

export interface ClientConnection {
  updatePlayers(playerUpdates: PlayerUpdate[]): void
  start(playerInits: PlayerInit[]): void
  end(winnerId: number | null): void
}

export class LocalServerConnection implements ServerConnection {

  private server: Server

  constructor(server: Server) {
    this.server = server
  }

  public addPlayer() {
    this.server.addPlayer()
  }

  public rotateLeft(id: number) {
    this.server.rotateLeft(id)
  }

  public rotateRight(id: number) {
    this.server.rotateRight(id)
  }
}

export class LocalClientConnection implements ClientConnection {

  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  public updatePlayers(playerUpdates: PlayerUpdate[]) {
    this.client.updatePlayers(playerUpdates)
  }

  public start(playerInits: PlayerInit[]) {
    this.client.start(playerInits)
  }

  public end(winnerId: number | null) {
    this.client.end(winnerId)
  }

}


export class NetworkServerConnection implements ServerConnection {

  private dataChannel: any

  constructor(dataChannel: any) {
    this.dataChannel = dataChannel
  }

  public addPlayer() {
    this.send(addPlayer())
  }

  public rotateLeft(index: number) {
    this.send(rotate(LEFT, index))
  }

  public rotateRight(index: number) {
    this.send(rotate(RIGHT, index))
  }

  private send(a: Action) {
    this.dataChannel.send(JSON.stringify(a))
  }
}

export class NetworkClientConnection implements ClientConnection {

  private dataChannel: any

  constructor(dataChannel: any) {
    this.dataChannel = dataChannel
  }

  public updatePlayers(playerUpdates: PlayerUpdate[]) {
    this.send(updatePlayers(playerUpdates))
  }

  public start(playerInits: PlayerInit[]) {
    this.send(start(playerInits))
  }

  public end (winnerId: number | null) {
    this.send(end(winnerId))
  }

  private send(a: Action) {
    this.dataChannel.send(JSON.stringify(a))
  }
}

type RoomConnection = any
type DataChannel = any

export function clientDataChannel(rc: RoomConnection) {
  return new Promise<DataChannel>((resolve, reject) => {
    
    // tell quickconnect we want a datachannel called test
    rc.createDataChannel("test")
    .on("channel:opened:test", function (peerId: any, dc: any) {
      dc.onmessage = function (evt: any) {
        if (evt.data === "WELCOME") {
          console.log("got WELCOME from ", peerId)
          resolve(dc)
        }
      }
    })
  })
}

export function serverDataChannel(rc: RoomConnection, cb: (dc: DataChannel) => any) {
  // tell quickconnect we want a datachannel called test
  rc.createDataChannel("test")
  // when the test channel has opened a RTCDataChannel to a peer, let us know
  .on("channel:opened:test", function (peerId: any, dc: any) {
    dc.send("WELCOME")
    console.log("sending WELCOME to ", peerId)
    cb(dc)
  })
}


export function connectAndCount(room: string = "leif"): Promise<[RoomConnection, number]> {
  const rc = quickconnect(SERVER_URL, { room, iceServers: freeice() })
  return new Promise<[RoomConnection, number]>((resolve) => {
    rc.once("message:roominfo", (data: { memberCount: number }) => {
      console.log("roomInfo", data)
      resolve([rc, data.memberCount])
    })
  })
}