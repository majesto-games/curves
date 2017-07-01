import * as React from "react"

import { Lobby as LobbyI } from "server/actions"

import { KEYS } from "game/keys"

import { hexToString } from "game/util"

// TODO: We need Players, which should be accessible from the room somehow
interface LobbyProps {
  lobby: LobbyI
  room: string
  onStart: () => void
  addPlayer: () => void
  isServer: boolean
}

export default class Lobby extends React.Component<LobbyProps, void> {
  public render() {
    const {
      lobby,
      room,
      isServer,
    } = this.props

    return (
      <div className="container-fluid Lobby">
        <div className="col-md-6 col-md-offset-3">
          <div className="header">
            <h1>{this.lobbyTitle()}</h1>
            <button className="btn btn-lg btn-success" onClick={this.addPlayer}
              disabled={lobby.players.length >= window.UserConfig.playerKeys.length}>Add local player</button>
            {isServer && <button className="btn btn-lg btn-primary" onClick={this.onStart}
              disabled={lobby.players.length < 2}>Start</button>}
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Color</th>
                <th>Name</th>
                <th>Keys</th>
              </tr>
            </thead>
            <tbody>
              {lobby.players.map(({ id, color, name }, index) => (
                <tr key={id}>
                  <td><span className="ball" style={{ backgroundColor: hexToString(color) }} /></td>
                  <td>Player {name}</td>
                  <td>{this.drawKeys(index)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  private lobbyTitle() {
    return this.props.room === "" ? "Local game" : `Lobby: ${this.props.room}`
  }

  private drawKeys = (index: number) => (
    <span className="keys">
      <button className="btn btn-info btn-xs">{KEYS[window.UserConfig.playerKeys[index].left]}</button>{" "}
      <button className="btn btn-info btn-xs">{KEYS[window.UserConfig.playerKeys[index].right]}</button>
    </span>
  )

  private onStart = () => {
    // TODO: Should check number of players...
    this.props.onStart()
  }

  private addPlayer = () => {
    this.props.addPlayer()
  }
}
