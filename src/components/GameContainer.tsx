import * as React from "react"

import history from "./history"

import { Score, Lobby as LobbyI } from "server/actions"

import { Game, GameEvent } from "game/game"
import { connect, connectLocal } from "game/room"
import { ClientConnectionState, Client } from "game/client"

import never from "utils/never"

import Spinner from "components/Spinner"
import PhoneControls from "components/PhoneControls"
import RunningGame from "components/RunningGame"
import Lobby from "components/Lobby"

interface GameContainerProps {
  room: string
}

interface GameContainerState {
  scores: Score[]
  colors: string[]
  lobby: LobbyI
  overlay: string | undefined
  state: ClientConnectionState
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
    state: ClientConnectionState.UNCONNECTED,
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
    window.removeEventListener("keydown", this.logRenderState)
  }

  public componentDidMount() {
    window.addEventListener("keydown", this.logRenderState)
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

    if (state === ClientConnectionState.LOBBY) {
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

    if (state === ClientConnectionState.UNCONNECTED) {
      return (
        <Spinner />
      )
    }

    if (state === ClientConnectionState.CLOSED) {
      return (
        <div />
      )
    }

    return (
      <RunningGame
        colors={colors}
        scores={scores}
        overlay={overlay}
        view={this.client!.game.getView()}
        players={lobby.players} />
    )
  }

  private logRenderState = (e: KeyboardEvent) => {
    if (e.keyCode === 83 && e.altKey) { // Alt-S
      console.log((this.client!.game as any).render.dehydrate())
    }
  }

  private onStart = () => {
    this.client!.start()
  }

  private addPlayer = () => {
    if (this.localPlayers < window.UserConfig.playerKeys.length) {
      this.localPlayers++
      this.client!.addPlayer()
    }
  }

  private getRoom = (roomName: string) => {
    const client = roomName === "" ? connectLocal() : connect(roomName)

    this.subscriptions.push(
      client.game.event.subscribe(e => {
        switch (e) {
          case GameEvent.END: {
            this.client = undefined
            this.setState({
              colors: [],
              state: ClientConnectionState.CLOSED,
            })
            break
          }
          case GameEvent.ROUND_END:
          case GameEvent.START: {
            this.setState((prevState, props) => ({
              colors: client.game.colors,
              state: client.connectionState,
            }))
            break
          }
          default:
            never("GameContainer didn't handle", e)
        }
      }),
      client.connectionState.subscribe(state => {
        this.setState({
          state,
          isServer: client.isServer,
        })
      }),
      client.lobby.subscribe(lobby => this.setState({ lobby })),
      client.game.store.subscribe(() => {
        const state = client.game.store.getState()
        this.setState({
          overlay: state.overlay,
        })
      }),
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
