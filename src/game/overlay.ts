import { Graphics } from "pixi.js"
import {
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "../server/main"

export default class Overlay {

  private graphics: PIXI.Graphics
  private overlayText: PIXI.Text
  private overlay: PIXI.Graphics
  private startPos: PIXI.Graphics
  private added = false

  constructor(g: PIXI.Graphics) {
    this.graphics = g
    this.overlayText = new PIXI.Text("", { fill: "white", fontFamily: "Courier New", fontSize: "32px" })
    this.overlayText.anchor = new PIXI.ObservablePoint(() => {; }, 0.5, 0.5)
    this.overlayText.x = SERVER_WIDTH / 2
    this.overlayText.y = SERVER_HEIGHT / 3

    this.overlay = new Graphics()
    this.overlay.beginFill(0x000000, 0.5)
    this.overlay.drawRect(0, 0, SERVER_WIDTH, SERVER_HEIGHT)
    this.overlay.endFill()
    this.overlay.addChild(this.overlayText)

    this.startPos = new Graphics()
    this.overlay.addChild(this.startPos)
  }

  public setOverlay = (text: string) => {
    this.overlayText.text = text
    if (!this.added) {
      this.graphics.addChild(this.overlay)
      this.added = true
    }
  }

  public removeOverlay = () => {
    this.graphics.removeChild(this.overlay)
    this.startPos.removeChildren()
    this.added = false
  }
}
