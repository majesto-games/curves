import * as React from "react"
import history from "./history"
import { Game, GameEvent } from "../game/game"
import { Score } from "server/actions"
import Canvas from "components/Canvas"
import Room from "game/room"
import Overlay from "components/Overlay"

interface GameState {
  scores: Score[]
  colors: string[]
  overlay: string | undefined
}

interface GameProp {
  room: string
}

export default class GameC extends React.Component<GameProp, GameState> {
  public state: GameState = {
    scores: [],
    colors: [],
    overlay: undefined,
  }

  private div: HTMLDivElement | null = null
  private games: { [key: string]: HTMLCanvasElement | undefined } = {}

  public render() {

    const { scores } = this.state

    return (
      <div className="container-fluid Game">
        <div className="col-md-3" id="scores">{scores.map(({ score, id }, i) =>
          <h1 key={id}
            style={{ color: this.state.colors[i] }}>Player {id}: {score}</h1>)}
        </div>
        <div className="col-md-6 GameContainer" id="GameContainer">
          <Overlay text={this.state.overlay} />
          <Canvas view={this.getGame(this.props.room)} />
        </div>
        <div className="col-md-3" id="ads">Ads here or something</div>
      </div>
    )
  }

  private getGame = (roomName: string) => {
    const newGame = () => {
      const room = new Room(roomName)
      room.game.onEvent((e, data?: any) => {
        if (e === GameEvent.END) {
          this.games[roomName] = undefined
          history.goBack()
        }

        if (e === GameEvent.ROUND_END || e === GameEvent.START) {
          this.setState((prevState, props) => ({
            scores: room.game.scores,
            colors: room.game.colors,
          }))
        }

        if (e === GameEvent.OVERLAY) {
          this.setState((prevState, props) => ({
            overlay: data,
          }))
        }
      })
      const view = room.game.getView()
      this.games[roomName] = view
      room.connect()
      return view
    }

    return this.games[roomName] || newGame()
  }
}
