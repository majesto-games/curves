import * as React from "react"
import { Link, withRouter, IRouter } from "react-router"

import { createGame } from "../game/main"

export interface GameProps {
  location: {
    query?: {
      room?: string
    }
  }
  router: IRouter
}

class Game extends React.Component<GameProps, any> {
  private div: HTMLDivElement | null = null
  private games: {[key: string]: Promise<HTMLCanvasElement> | undefined} = {}
  private latestRoom = ""

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
      const view = createGame(room).then(game => {
        game.onEnd(() => {
          setTimeout(() => {
            game.close()
            this.games[room] = undefined
            this.props.router.goBack()
          }, 3000)
        })
        return game.view
      })
      this.games[room] = view
      return view
    }

    return this.games[room] || newGame()
  }

  private showGame = (room: string) => {
    this.latestRoom = room
    this.getGame(room).then(game => {
      if (this.latestRoom !== room) {
        return
      }

      if (this.div) {
        while (this.div.firstChild) {
          this.div.removeChild(this.div.firstChild)
        }
        this.div.appendChild(game)
      }
    })
  }

}

export default withRouter(Game)
