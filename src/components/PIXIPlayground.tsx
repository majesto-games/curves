import * as React from "react"
import {
  autoDetectRenderer,
  Container,
  CanvasRenderer,
  WebGLRenderer,
  Texture,
  BaseTexture,
} from "pixi.js"
import Canvas from "components/Canvas"

export default class PIXIPlayground extends React.Component<void, void> {
  private renderer: WebGLRenderer | CanvasRenderer
  private readonly container = new Container()

  constructor() {
    super()
    this.renderer = autoDetectRenderer(800, 800, { antialias: true, backgroundColor: 0x000000 })
    const vertices = new Float32Array([
      0, 0,
      500, 0,
      500, 500,
      0, 500,
    ])
    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ])
    const mesh = new PIXI.mesh.Mesh(createTexture(), vertices, uvs)
    mesh.x = 0
    mesh.y = 0
    this.container.addChild(mesh)

    this.renderer.render(this.container)
  }

  public render() {
    const view = this.renderer.view

    return (
      <div className="container-fluid Game">
        <div className="col-md-6 GameContainer" id="GameContainer">
          <Canvas view={view} />
        </div>
      </div>
    )
  }
}

function createTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 120
  canvas.height = 120
  const context = canvas.getContext("2d")!
  context.fillStyle = "blue"
  context.fillRect(0, 0, 120, 40)
  context.fillStyle = "green"
  context.fillRect(0, 40, 120, 40)
  context.fillStyle = "red"
  context.fillRect(0, 80, 120, 40)
  context.fillStyle = "green"
  document.body.appendChild(canvas)
  return new Texture(new BaseTexture(canvas))
}
