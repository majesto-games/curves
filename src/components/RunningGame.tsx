import * as React from "react"

import { Score } from "server/actions"

import Canvas from "components/Canvas"
import Overlay from "components/Overlay"
import PhoneControls from "components/PhoneControls"

interface RunningGameProps {
  view: HTMLCanvasElement
  scores: Score[]
  colors: string[]
  overlay: string | undefined
}

export default class RunningGame extends React.Component<RunningGameProps, {}> {
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
          <h1 key={id} style={{ color: colors[i] }}>Player {id}: {score}</h1>)}
        </div>
        <div className="col-md-6 GameContainer" id="GameContainer">
          <PhoneControls />
          <Overlay text={overlay} />
          <Canvas view={view} />
        </div>
        <div className="col-md-3" id="ads">Ads here or something</div>
      </div>
    )
  }
}
