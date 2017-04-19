import * as React from "react"
import history from "./history"
import * as qs from "query-string"
import { Game, GameEvent } from "../game/game"
import { Score } from "server/actions"
import Canvas from "components/Canvas"
import Room from "game/room"

interface GameState {
  scores: Score[]
}

export default class GameC extends React.Component<void, GameState> {
  public state: GameState = {
    scores: [],
  }

  private div: HTMLDivElement | null = null
  private games: { [key: string]: HTMLCanvasElement | undefined } = {}

  public render() {
    const room = qs.parse(history.location.search).room || "leif"

    const { scores } = this.state

    return (
      <div>
        <Canvas view={this.getGame(room)} />
        <div>{scores.map(({ score, id }) =>
          <h1 key={id}>Player {id}: {score}</h1>)}</div>
      </div>
    )
  }

  private getGame = (roomName: string) => {
    const newGame = () => {
      const room = new Room(roomName)
      room.game.onEvent((e) => {
        if (e === GameEvent.END) {
          this.games[roomName] = undefined
          history.goBack()
        }

        if (e === GameEvent.ROUND_END || e === GameEvent.START) {
          this.setState((prevState, props) => ({
            scores: room.game.scores,
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
