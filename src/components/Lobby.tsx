import * as React from "react"
import axios from "axios"
import { SERVER_URL } from "../config"
import history from "./history"
import Link from "./Link"

interface Room {
  name: string
  memberCount: number
}

const axi = axios.create({
  baseURL: SERVER_URL,
})

function getRooms() {
  return axi.get("/")
}

class NewRoom extends React.Component<void, void> {
  private roomInput: HTMLInputElement

  public render() {
    return (
      <form onSubmit={this.onSubmit} className="NewRoom">
        <input type="text" placeholder="Room name" defaultValue="leif" ref={n => this.roomInput = n} />
        <button type="submit">Join room</button>
      </form>
    )
  }

  private onSubmit = (e: React.FormEvent<any>) => {
    e.preventDefault()

    history.push({
      pathname: `/game/${this.roomInput.value}`,
    })
  }
}

interface LobbyState {
  rooms: Room[],
}

export default class Lobby extends React.Component<any, LobbyState> {
  public state: LobbyState = {
    rooms: [],
  }

  public componentDidMount() {
    getRooms().then(rooms => {
      this.setState({
        rooms: rooms.data,
      })
    })
  }

  public render() {
    const existingRooms = this.state.rooms.map(room => (
      <li key={`room_${room.name}`}>
        <Link to={`game?room=${room.name}`}>{room.name}</Link>
      </li>
    ))

    return (
      <div className="Lobby">
        <NewRoom />
        <ul className="rooms">{existingRooms}</ul>
      </div>
    )
  }
}
