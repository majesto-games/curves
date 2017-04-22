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
  start,
  end,
  POWERUP_SPAWN,
  spawnPowerup,
  fetchPowerup,
  Score,
} from "./actions"

export type ConnectionId = string | Object

export interface ServerConnection {
  id: ConnectionId
  addPlayer(): void
  rotateLeft(index: number): void
  rotateRight(index: number): void
  close(): void
}

export interface ClientConnection {
  id: ConnectionId
  updatePlayers(playerUpdates: PlayerUpdate[]): void
  start(playerInits: PlayerInit[]): void
  round(snakeInits: SnakeInit[]): void
  end(winnerId?: number): void
  roundEnd(scores: Score[]): void
  close(): void
  spawnPowerup(powerup: Powerup): void
  fetchPowerup(powerup: Powerup): void
}

export class LocalServerConnection implements ServerConnection {

  constructor(private server: Server, public id: ConnectionId) {
  }

  public addPlayer() {
    this.server.addPlayer(this.id)
  }

  public rotateLeft(id: number) {
    this.server.rotateLeft(id, this.id)
  }

  public rotateRight(id: number) {
    this.server.rotateRight(id, this.id)
  }

  public close() {
    return
  }
}

export class LocalClientConnection implements ClientConnection {

  private client: Client

  constructor(client: Client, public id: ConnectionId) {
    this.client = client
  }

  public updatePlayers(playerUpdates: PlayerUpdate[]) {
    this.client.updatePlayers(playerUpdates)
  }

  public start(playerInits: PlayerInit[]) {
    this.client.start(playerInits)
  }

  public round(snakeInits: SnakeInit[]): void {
    this.client.round(snakeInits)
  }

  public roundEnd(scores: Score[]) {
    this.client.roundEnd(scores)
  }

  public end(winnerId?: number) {
    this.client.end(winnerId)
  }

  public spawnPowerup(powerup: Powerup) {
    this.client.spawnPowerup(powerup)
  }

  public fetchPowerup(powerup: Powerup) {
    this.client.fetchPowerup(powerup.id)
  }

  public close() {
    return
  }
}

export class NetworkServerConnection implements ServerConnection {
  constructor(private dataChannel: DataChannel, public id: ConnectionId) { }

  public addPlayer() {
    this.send(addPlayer())
  }

  public rotateLeft(index: number) {
    this.send(rotate(LEFT, index))
  }

  public rotateRight(index: number) {
    this.send(rotate(RIGHT, index))
  }

  public close() {
    this.dataChannel.close()
  }

  private send(a: Action) {
    this.dataChannel.send(JSON.stringify(a))
  }
}

export class NetworkClientConnection implements ClientConnection {
  public sentActions: Action[] = []

  constructor(private dataChannel: DataChannel, public id: string) {
  }

  public updatePlayers(playerUpdates: PlayerUpdate[]) {
    this.send(updatePlayers(playerUpdates))
  }

  public start(playerInits: PlayerInit[]) {
    this.send(start(playerInits))
  }

  public round(snakeInits: SnakeInit[]): void {
    this.send(round(snakeInits))
  }

  public roundEnd(scores: Score[]) {
    this.send(roundEnd(scores))
  }

  public end(winnerId?: number) {
    this.send(end(winnerId))
  }

  public close() {
    this.dataChannel.close()
  }

  public spawnPowerup(powerup: Powerup) {
    this.send(spawnPowerup(powerup))
  }

  public fetchPowerup(powerup: Powerup) {
    this.send(fetchPowerup(powerup.id))
  }

  public send(a: Action) {
    this.sentActions.push(a)
    this.dataChannel.send(JSON.stringify(a))
  }
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

        dc.send(JSON.stringify({
          type: "CONNECT",
          id: getId(),
        }))

        dc.onmessage = (evt) => {
          if (evt.data === "WELCOME") {
            console.log("got WELCOME from ", peerId)
            resolve({ dc, id: peerId })
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
          console.log("sending WELCOME to ", peerId)
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
