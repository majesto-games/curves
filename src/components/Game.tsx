import * as React from "react"
import history from "./history"
import { Game, GameEvent } from "../game/game"
import { Score, Lobby as LobbyI } from "server/actions"
import Canvas from "components/Canvas"
import { connect } from "game/room"
import Overlay from "components/Overlay"
import { ClientState, Client } from "game/client"
import { hexToString } from "game/util"
import never from "utils/never"
import Spinner from "components/Spinner"
import { KEYS } from "game/keys"

interface RunningGameProps {
  view: HTMLCanvasElement
  scores: Score[]
  colors: string[]
  overlay: string | undefined
}

/* tslint:disable: no-namespace */
declare global {
  interface Window {
    PhoneControls: { left: boolean, right: boolean }
  }
}
/* tslint:enable: no-namespace */
window.PhoneControls = { left: false, right: false }

class PhoneControls extends React.Component<{}, {}> {

  public constructor(props: {}) {
    super(props)
  }

  public render() {
    return (
      <div className="PhoneControls" onContextMenu={(e) => e.preventDefault()}>
        <div
          onTouchStart={(e) => this.onTouchStart(e, "left")}
          onTouchEnd={(e) => this.onTouchEnd(e, "left")} />
        <div
          onTouchStart={(e) => this.onTouchStart(e, "right")}
          onTouchEnd={(e) => this.onTouchEnd(e, "right")} />
      </div>
    )
  }

  private onTouchStart = (e: React.TouchEvent<HTMLElement>, direction: "left" | "right") => {
    window.PhoneControls[direction] = true
  }

  private onTouchEnd = (e: React.TouchEvent<HTMLElement>, direction: "left" | "right") => {
    window.PhoneControls[direction] = false
  }
}

class RunningGame extends React.Component<RunningGameProps, {}> {
  public render() {
    const {
      scores,
      colors,
      overlay,
      view,
    } = this.props

    return (
      <div className="container-fluid Game">
        <div className="col-md-3" id="scores">{scores.map(({ score, id }, i) =>
          <h1 key={id} style={{ color: colors[i] }}>Player {id}: {score}</h1>)}
        </div>
        <div className="col-md-6 GameContainer" id="GameContainer">
          <PhoneControls />
          <Overlay text={overlay} />
          <Canvas view={view} />
        </div>
        <div className="col-md-3" id="ads">Ads here or something</div>
      </div>
    )
  }
}

// TODO: We need Players, which should be accessible from the room somehow
interface LobbyProps {
  lobby: LobbyI
  room: string
  onStart: () => void
  addPlayer: () => void
  isServer: boolean
}

class Lobby extends React.Component<LobbyProps, void> {
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
            <h1>Lobby: {room}</h1>
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

interface GameContainerProps {
  room: string
}

interface GameContainerState {
  scores: Score[]
  colors: string[]
  lobby: LobbyI
  overlay: string | undefined
  state: ClientState
  isServer: boolean
}

/*
Scenarios:

# Player is first to connect
  * Becomes server
  * Can add 1 extra local player
  * Can start the game

# Player is not first to connect
## The game is not yet started
  * Can add 1 extra local player
## The game is started
  * Become observer

*/

export default class GameContainer extends React.Component<GameContainerProps, GameContainerState> {
  public state: GameContainerState = {
    scores: [],
    colors: [],
    lobby: { players: [] },
    overlay: undefined,
    state: ClientState.UNCONNECTED,
    isServer: false,
  }

  private div: HTMLDivElement | null = null
  private client: Client | undefined
  private localPlayers = 0
  private subscriptions: (() => void)[] = []

  public constructor(props: GameContainerProps) {
    super(props)

    this.getRoom(props.room)
  }

  public componentWillReceiveProps(nextProps: GameContainerProps) {
    if (this.client != null) {
      if (this.props.room === nextProps.room) {
        return
      }
      this.client.close()
    }
    this.getRoom(nextProps.room)
  }

  public componentWillUnmount() {
    this.subscriptions.forEach(f => f())
    if (this.client) {
      this.client.close()
    }
  }

  public render() {
    const {
      scores,
      colors,
      overlay,
      state,
      lobby,
      isServer,
    } = this.state

    if (state === ClientState.LOBBY) {
      return (
        <Lobby
          lobby={lobby}
          onStart={this.onStart}
          addPlayer={this.addPlayer}
          room={this.props.room}
          isServer={isServer}
        />
      )
    }

    if (state === ClientState.UNCONNECTED) {
      return (
        <Spinner />
      )
    }

    if (state === ClientState.CLOSED) {
      return (
        <div />
      )
    }

    return (
      <RunningGame
        colors={colors}
        scores={scores}
        overlay={overlay}
        view={this.client!.game.getView()} />
    )
  }

  private onStart = () => {
    this.client!.start()
  }

  private addPlayer = () => {
    console.log(this.localPlayers, window.UserConfig.playerKeys.length)
    if (this.localPlayers < window.UserConfig.playerKeys.length) {
      this.localPlayers++
      this.client!.addPlayer()
    }
  }

  private getRoom = (roomName: string) => {
    const client = connect(roomName)
    this.subscriptions.push(
      client.game.event.subscribe(e => {
        switch (e) {
          case GameEvent.END: {
            this.client = undefined
            this.setState({
              colors: [],
              state: ClientState.CLOSED,
            })
            break
          }
          case GameEvent.ROUND_END:
          case GameEvent.START: {
            this.setState((prevState, props) => ({
              colors: client.game.colors,
              state: client.state,
            }))
            break
          }
          default:
            never("GameContainer didn't handle", e)
        }
      }),
      client.state.subscribe(state => {
        this.setState({
          state,
          isServer: client.isServer,
        })
      }),
      client.lobby.subscribe(lobby => this.setState({ lobby })),
      client.game.overlay.subscribe(overlay => this.setState({ overlay })),
      client.scores.subscribe(scores => {
        scores.sort((a, b) => b.score - a.score)
        this.setState({ scores })
      }),
    )

    this.client = client
    this.localPlayers = 1
    return client
  }
}
