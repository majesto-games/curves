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

class NewRoom extends React.Component<{
  onUpdateRooms: () => void,
}, {}> {
  private roomInput: HTMLInputElement

  public render() {
    return (
      <form onSubmit={this.onSubmit} className="NewRoom">
        <div className="input-group">
          <input type="text" placeholder="Room name" defaultValue="leif"
            className="form-control input-lg" ref={n => this.roomInput = n} />
          <span className="input-group-btn">
            <button type="submit" className="btn-lg btn btn-primary">Join room</button>
            <button className="btn-lg btn btn-success" onClick={this.onUpdateClick}>
              <span className="glyphicon glyphicon-refresh" /> Update
            </button>
          </span>
        </div>
      </form>
    )
  }

  private onUpdateClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    this.props.onUpdateRooms()
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
  loading: boolean,
}

export default class Lobby extends React.Component<any, LobbyState> {
  public state: LobbyState = {
    rooms: [],
    loading: true,
  }

  public componentDidMount() {
    this.fetchRooms()
  }

  public render() {
    const existingRooms = this.state.rooms.map(room => (
      <tr key={`room_${room.name}`}>
        <td><Link to={`game/${room.name}`}>{room.name}</Link></td>
        <td className="text-right">{room.memberCount}</td>
      </tr>
    ))

    return (
      <div className="container-fluid Lobby">
        <div className="col-md-6 col-md-offset-3">
          <h1 className="text-center">Curves</h1>
          <NewRoom onUpdateRooms={() => this.fetchRooms()} />
          <table className="table table-striped rooms">
            <thead>
              <tr>
                <th className="col-md-4">Room</th>
                <th className="col-md-2 text-right">Member count</th>
              </tr>
            </thead>
            <tbody>{!this.state.loading && existingRooms}</tbody>
          </table>
          {this.state.loading && <div className="text-center">
            <span className="glyphicon glyphicon-refresh spinning" /> Loading rooms...
          </div>}
          {this.state.rooms.length === 0 && <div className="text-center">
            <span className="glyphicon glyphicon-tower" /> No rooms found
          </div>}
        </div>
      </div>
    )
  }

  private fetchRooms() {
    this.setState({ loading: true })
    getRooms().then(rooms => {
      this.setState({
        rooms: rooms.data,
        loading: false,
      })
    })
  }
}
