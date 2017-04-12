import * as React from "react"
import history from "./history"
import * as qs from "query-string"
import { Game, GameEvent } from "../game/game"

export default class GameC extends React.Component<void, any> {
  private div: HTMLDivElement | null = null
  private games: {[key: string]: HTMLCanvasElement | undefined} = {}

  public componentDidMount() {
    const room = qs.parse(history.location.search).room || "leif"
    console.log("Room:", room)
    this.showGame(room)
  }

  public render() {
    return (
      <div ref={n => this.div = n} />
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
      })
      const view = game.getView()
      this.games[room] = view
      game.connect()
      return view
    }

    return this.games[room] || newGame()
  }

  private showGame = (room: string) => {
    const game = this.getGame(room)

    if (this.div) {
      while (this.div.firstChild) {
        this.div.removeChild(this.div.firstChild)
      }
      this.div.appendChild(game)
      document.body.focus()
    }
  }

}
