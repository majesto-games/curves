import * as React from "react"
import axios from "axios"
import { SERVER_URL } from "../config"
import history from "./history"
import Link from "./Link"

import { randomAdjective, randomNoun } from "sillyname"

import { ControlGroup, Button, InputGroup } from "@blueprintjs/core"

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

interface NewRoomProps {
  onUpdateRooms: () => void,
}

interface NewRoomState {
  roomName: string,
}

class NewRoom extends React.Component<NewRoomProps, NewRoomState> {

  public state: NewRoomState = {
    roomName: (`${randomAdjective()}${randomNoun()}-${randomNoun()}`).toLowerCase(),
  }

  public render() {
    return (
      <form onSubmit={this.onSubmit} className="NewRoom">
        <ControlGroup>
          <InputGroup type="text" placeholder="Room name" value={this.state.roomName} onChange={this.onChangeRoomName}
            rightElement={<Button onClick={this.newRandomName} className="pt-minimal" iconName="refresh" />} />
          <Button iconName="log-in" type="submit" value="join">Host/join game</Button>
          <Button iconName="offline" type="submit" value="local">Play offline</Button>
        </ControlGroup>
      </form>
    )
  }

  private newRandomName = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()

    this.setState({ roomName: (`${randomAdjective()}${randomNoun()}-${randomNoun()}`).toLowerCase() })
  }

  // private onUpdateClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  //   e.preventDefault()

  //   this.props.onUpdateRooms()
  // }

  private onChangeRoomName = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ roomName: event.target.value })
  }

  private onSubmit = (e: React.FormEvent<any>) => {
    e.preventDefault()

    const choice = (document.activeElement as HTMLButtonElement).value

    if (choice === "join") {
      history.push({
        pathname: `/game/${this.state.roomName}`,
      })
    } else if (choice === "local") {
      history.push({
        pathname: "/offline",
      })
    }
  }
}

interface RoomBrowserState {
  rooms: Room[],
  loading: boolean,
}

export default class RoomBrowser extends React.Component<any, RoomBrowserState> {
  public state: RoomBrowserState = {
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
        <td style={{ textAlign: "right" }}>{room.memberCount}</td>
      </tr>
    ))

    return (
      <div className="RoomBrowser">
        <h1>Curves</h1>
        <NewRoom onUpdateRooms={() => this.fetchRooms()} />
        {!this.state.loading && this.state.rooms.length > 0 && <table className="pt-table rooms">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Room</th>
              <th style={{ textAlign: "right" }}>Member count</th>
            </tr>
          </thead>
          <tbody>{!this.state.loading && existingRooms}</tbody>
        </table>}
        {this.state.loading && <div>
          <span className="glyphicon glyphicon-refresh spinning" /> Loading rooms...
        </div>}
        {!this.state.loading && this.state.rooms.length === 0 &&
          <div>
            <span className="glyphicon glyphicon-tower" /> No rooms found
          </div>}
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
