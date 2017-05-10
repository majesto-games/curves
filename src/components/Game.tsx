import * as React from "react"
import history from "./history"
import { Game, GameEvent } from "../game/game"
import { Score, Lobby as LobbyI } from "server/actions"
import Canvas from "components/Canvas"
import Room, { RoomState } from "game/room"
import Overlay from "components/Overlay"

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
          <h1 key={id}
            style={{ color: colors[i] }}>Player {id}: {score}</h1>)}
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
  room: Room
  onStart: () => void
  addPlayer: () => void
}

class Lobby extends React.Component<LobbyProps, void> {
  public render() {
    const {
      lobby,
    } = this.props

    return (
      <div>
        <button onClick={this.addPlayer}>Add player</button>
        <button onClick={this.onStart}>Start</button>
        {lobby.names}
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
  state: RoomState
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
    lobby: { names: [] },
    overlay: undefined,
    state: RoomState.UNCONNECTED,
  }

  private div: HTMLDivElement | null = null
  private room: Room | undefined
  private localPlayers = 0

  public constructor(props: GameContainerProps) {
    super(props)

    this.getRoom(props.room)
  }

  public componentWillReceiveProps(nextProps: GameContainerProps) {
    if (this.room != null) {
      if (this.room.name === nextProps.room) {
        return
      }
      this.room.close()
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

    console.log("RENDER", RoomState[state], this.room)

    if (state === RoomState.LOBBY_CLIENT || state === RoomState.LOBBY_SERVER) {
      return (
        <Lobby
          lobby={lobby}
          room={this.room!}
          onStart={this.onStart}
          addPlayer={this.addPlayer}
        />
      )
    }

    if (state === RoomState.UNCONNECTED) {
      return (
        <button onClick={this.readState} >Refresh room state</button>
      )
    }

    if (state === RoomState.CLOSED) {
      return (
        <div />
      )
    }

    return (
      <RunningGame
        colors={colors}
        scores={scores}
        overlay={overlay}
        view={this.room!.game.getView()} />
    )
  }

  private readState = () => {
    const room = this.room!
    this.setState((prevState, props) => ({
      scores: room.game.scores,
      colors: room.game.colors,
      state: room.state,
    }))
  }

  private onStart = () => {
    this.room!.start()
  }

  private addPlayer = () => {
    if (this.localPlayers < 2) {
      this.localPlayers++
      this.room!.addPlayer()
    }
  }

  private getRoom = (roomName: string) => {
    const room = new Room(roomName)
    room.game.onEvent((e, data?: any) => {
      switch (e) {
        case GameEvent.END: {
          this.room = undefined
          this.setState({
            scores: [],
            colors: [],
            state: RoomState.CLOSED,
          })
          break
        }
        case GameEvent.ROUND_END:
        case GameEvent.START: {
          this.setState((prevState, props) => ({
            scores: room.game.scores,
            colors: room.game.colors,
            state: room.state,
          }))
          break
        }
        case GameEvent.OVERLAY: {
          this.setState((prevState, props) => ({
            overlay: data,
          }))
          break
        }
        case GameEvent.LOBBY_CHANGED: {
          this.setState({
            lobby: data,
          })
          break
        }
        default:
          failedToHandle(e)
      }
    })
    room.onNewState(state => {
      this.setState({
        state,
      })
    })
    this.room = room
    room.connect()
    this.localPlayers = 1
    return room
  }
}
