import * as React from "react"

import { Score } from "server/actions"

import { Player } from "game/player"

import Canvas from "components/Canvas"
import Overlay from "components/Overlay"
import PhoneControls from "components/PhoneControls"
import { hexToString } from "game/util"
import { Container, WebGLRenderer, CanvasRenderer, autoDetectRenderer, Point } from "pixi.js"
import { SERVER_WIDTH, SERVER_HEIGHT } from "server/main"
import Render from "game/render"

interface ReplayState {
  view: HTMLCanvasElement
}

export default class Replay extends React.Component<{}, ReplayState> {
  public state: ReplayState

  private dehydratedInput: HTMLInputElement | null = null

  private gameRender: Render
  private readonly container = new Container()
  private renderer: CanvasRenderer | WebGLRenderer

  public constructor() {
    super()
    this.renderer = autoDetectRenderer(SERVER_WIDTH, SERVER_HEIGHT,
      { antialias: true, backgroundColor: 0x000000 })

    this.gameRender = new Render(this.container)

    setTimeout(() => this.resize(), 0)

    window.addEventListener("resize", () => this.resize())

    this.state = {
      view: this.renderer.view,
    }
  }

  public render() {
    const {
      view,
    } = this.state

    return (
      <form onSubmit={this.onSubmit} className="container-fluid Game">
        <div className="GameContainer" id="GameContainer">
          <input type="text" placeholder="Dehydrated game state"
            className="form-control input-lg" ref={(n) => this.dehydratedInput = n} />
          <span className="input-group-btn">
            <button type="submit" className="btn-lg btn btn-primary">Rehydrate game state</button>
          </span>
          <Canvas view={view} />
        </div>
      </form>
    )
  }

  private onSubmit = (e: React.FormEvent<any>) => {
    e.preventDefault()

    // TODO: Dunno if this explicit non-null thing is good
    const dehydrated = this.dehydratedInput!.value
    this.gameRender.rehydrate(dehydrated)
    this.renderer.render(this.container)
  }

  private resize() {
    const scores = document.getElementById("scores")
    const ads = document.getElementById("ads")

    const scoresHeight = scores ? scores.offsetHeight : 0
    const adsHeight = ads ? ads.offsetHeight : 0

    // 992 is the breakpoint for mobile view.
    // * .5 because the game container is 50% wide in CSS.
    // 40 because 16px padding * 2 = 32 and 4px border * 2 = 8.
    // Scores height and ads height are also subtracted from the height
    // in mobile view.

    const ww = (window.innerWidth >= 992 ? window.innerWidth * .5 : window.innerWidth) - 40
    const wh = (window.innerWidth <= 992 ? window.innerHeight - scoresHeight - adsHeight : window.innerHeight) - 40
    const wscale = ww / SERVER_WIDTH
    const hscale = wh / SERVER_HEIGHT
    const scale = Math.min(wscale, hscale)
    const density = window.devicePixelRatio

    this.container.scale = new Point(scale * density, scale * density)
    this.renderer.resize(SERVER_WIDTH * scale * density, SERVER_HEIGHT * scale * density)
    this.renderer.view.style.width = `${SERVER_WIDTH * scale}px`
    this.renderer.view.style.height = `${SERVER_HEIGHT * scale}px`

    this.renderer.render(this.container)
  }
}
