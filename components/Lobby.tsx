import * as React from "react"
import { Link, withRouter, IRouter } from "react-router"
import * as axios from "axios"
import { SERVER_URL } from "../config"

interface Room {
  name: string
  memberCount: number
}

const axi = axios.create({
  baseURL: SERVER_URL
});

function getRooms() {
  console.log("getting rooms")
  return axi.get<Room[]>("/")
}



class NewRoomClass extends React.Component<{ router: IRouter }, {}> {
  private roomInput: HTMLInputElement

  public render() {
    return (
      <form onSubmit={this.onSubmit}>
        <input type="text" placeholder="Room name" defaultValue="leif" ref={n => this.roomInput = n} />
        <button type="submit">Join room</button>
      </form>
    )
  }

  private onSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    this.props.router.push({
      pathname: "/game",
      query: { room: this.roomInput.value },
    })
  }
}

const NewRoom = withRouter(NewRoomClass) as any


export default class Lobby extends React.Component<{}, { rooms: Room[] }> {
  public state: { rooms: Room[] } = {
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
        <Link to={{ pathname: "/game", query: {room: room.name} }}>{room.name}</Link>
      </li>
    )

    )
    return (
      <ul>
      {
        [<li key="new" ><NewRoom /></li>].concat(existingRooms)
      }
      </ul>
    )
  }
}

