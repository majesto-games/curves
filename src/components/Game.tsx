import * as React from "react"
import history from "./history"
import * as qs from "query-string"
import { Game, GameEvent } from "../game/game"
import { Score } from "server/actions"
import Canvas from "components/Canvas"

interface GameState {
  scores: Score[]
}

export default class GameC extends React.Component<void, GameState> {
  public state: GameState = {
    scores: [],
  }

  private div: HTMLDivElement | null = null
  private games: {[key: string]: HTMLCanvasElement | undefined} = {}

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

  private getGame = (room: string) => {
    const newGame = () => {
      const game = new Game(room)
      game.onEvent((e) => {
        if (e === GameEvent.END) {
          this.games[room] = undefined
          history.goBack()
        }

        if (e === GameEvent.ROUND_END || e === GameEvent.START) {
          this.setState((prevState, props) => ({
            scores: game.scores,
          }))
        }
      })
      const view = game.getView()
      this.games[room] = view
      game.connect()
      return view
    }

    return this.games[room] || newGame()
  }
}
