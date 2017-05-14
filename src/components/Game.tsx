import * as React from "react"
import history from "./history"
import { Game, GameEvent } from "../game/game"
import { Score, Lobby as LobbyI } from "server/actions"
import Canvas from "components/Canvas"
import { connect } from "game/room"
import Overlay from "components/Overlay"
import { ClientState, Client } from "game/client"
import { hexToString } from "game/util"

interface RunningGameProps {
  view: HTMLCanvasElement
  scores: Score[]
  colors: string[]
  overlay: string | undefined
}

class RunningGame extends React.Component<RunningGameProps, void> {
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
}

class Lobby extends React.Component<LobbyProps, void> {
  public render() {
    const {
      lobby,
      room,
    } = this.props

    return (
      <div className="container-fluid Lobby">
        <div className="col-md-6 col-md-offset-3">
          <div className="header">
            <h1>Lobby: {room}</h1>
            <button className="btn btn-lg btn-success" onClick={this.addPlayer}>Add local player</button>
            <button className="btn btn-lg btn-primary"onClick={this.onStart}>Start</button>
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Color</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {lobby.players.map(({ id, color, name }) => (
                <tr key={id}>
                  <td><span className="ball" style={{ backgroundColor: hexToString(color) }} /></td>
                  <td>Player {name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  private onStart = () => {
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

function failedToHandle(x: never): never {
  throw new Error(`GameContainer didn't handle ${x}`)
}

export default class GameContainer extends React.Component<GameContainerProps, GameContainerState> {
  public state: GameContainerState = {
    scores: [],
    colors: [],
    lobby: { players: [] },
    overlay: undefined,
    state: ClientState.UNCONNECTED,
  }

  private div: HTMLDivElement | null = null
  private client: Client | undefined
  private localPlayers = 0

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

  public render() {
    const {
      scores,
      colors,
      overlay,
      state,
      lobby,
    } = this.state

    if (state === ClientState.LOBBY) {
      return (
        <Lobby
          lobby={lobby}
          onStart={this.onStart}
          addPlayer={this.addPlayer}
          room={this.props.room}
        />
      )
    }

    if (state === ClientState.UNCONNECTED) {
      return (
        <button onClick={this.readState}>Refresh room state</button>
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

  private readState = () => {
    const client = this.client!
    this.setState((prevState, props) => ({
      scores: client.game.scores,
      colors: client.game.colors,
      state: client.state,
    }))
  }

  private onStart = () => {
    this.client!.start()
  }

  private addPlayer = () => {
    if (this.localPlayers < 2) {
      this.localPlayers++
      this.client!.addPlayer()
    }
  }

  private getRoom = (roomName: string) => {
    const client = connect(roomName)
    client.game.onEvent((e, data?: any) => {
      switch (e) {
        case GameEvent.END: {
          this.client = undefined
          this.setState({
            scores: [],
            colors: [],
            state: ClientState.CLOSED,
          })
          break
        }
        case GameEvent.ROUND_END:
        case GameEvent.START: {
          this.setState((prevState, props) => ({
            scores: client.game.scores,
            colors: client.game.colors,
            state: client.state,
          }))
          break
        }
        default:
          failedToHandle(e)
      }
    })
    client.state.subscribe(state => {
      this.setState({
        state,
      })
    })

    client.lobby.subscribe(lobby => this.setState({ lobby }))
    client.game.overlay.subscribe(overlay => this.setState({ overlay }))

    this.client = client
    this.localPlayers = 1
    return client
  }
}
