import * as React from "react"

import { Score } from "server/actions"

import { Player } from "game/player"

import Canvas from "components/Canvas"
import Overlay from "components/Overlay"
import PhoneControls from "components/PhoneControls"
import { hexToString } from "game/util"

interface RunningGameProps {
  view: HTMLCanvasElement
  scores: Score[]
  colors: string[]
  overlay: string | undefined
  players: Player[]
}

export default class RunningGame extends React.Component<RunningGameProps, {}> {
  public render() {
    const {
      scores,
      colors,
      overlay,
      view,
      players,
    } = this.props

    return (
      <div className="container-fluid Game">
        {this.renderScores(scores, players)}
        <div className="col-md-6 GameContainer" id="GameContainer">
          <PhoneControls />
          <Overlay text={overlay} />
          <Canvas view={view} />
        </div>
        <div className="col-md-3" id="ads">Ads here or something</div>
      </div>
    )
  }

  private renderScores(scores: Score[], players: Player[]) {
    // TODO: This is kinda crappy
    const colorScores = scores.map(({ id, score }) => ({
      id,
      score,
      color: players.find(p => p.id === id)!.color,
    }))

    return (
      <div className="col-md-3" id="scores">{colorScores.map(({ score, id, color }) =>
        <h1 key={id} style={{ color: hexToString(color) }}>Player {id}: {score}</h1>)}
      </div>
    )
  }
}
