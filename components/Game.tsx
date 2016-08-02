import * as React from "react"

import { createGame } from "../game/main"

export interface GameProps {
  location: {
    query?: {
      room: string
    }
  }
}

export default class Game extends React.Component<GameProps, any> {
  private div: any = null

  public componentDidMount() {
    const { query } = this.props.location
    console.log("Room:", query && query.room)
    createGame(query && query.room).then(view => {
      this.div.appendChild(view)
    })
  }

  public render() {
    return (
      <div ref={n => this.div = n} />
    )
  }
}
