import * as React from "react"
import { Link, withRouter, IRouter } from "react-router"

import { Game, GameEvent } from "../game/main"

export interface GameProps {
  location: {
    query?: {
      room?: string,
    },
  }
  router: IRouter
}

class GameC extends React.Component<GameProps, any> {
  private div: HTMLDivElement | null = null
  private games: {[key: string]: HTMLCanvasElement | undefined} = {}

  public componentDidMount() {
    const { query } = this.props.location
    const room = query && query.room || "leif"
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
          setTimeout(() => {
            this.games[room] = undefined
            this.props.router.goBack()
          }, 3000)
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
    }
  }

}

export default withRouter(GameC)
