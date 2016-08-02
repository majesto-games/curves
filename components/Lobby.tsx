import * as React from "react"
import { Link, withRouter, IRouter } from "react-router"

export interface LobbyProps {
  router: IRouter
}


class Lobby extends React.Component<LobbyProps, any> {

  roomInput: HTMLInputElement

  onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    this.props.router.push({
      pathname: "/game",
      query: { room: this.roomInput.value },
    })
  }

  render() {
    return (
      <form onSubmit={this.onSubmit}>
        <input type="text" placeholder="Room name" defaultValue="leif" ref={n => this.roomInput = n} />
        <button type="submit">Join room</button>
      </form>
    )
  }
}

export default withRouter(Lobby)
