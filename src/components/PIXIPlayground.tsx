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

const TEXTURE_WIDTH = 1024
const TEXTURE_HEIGHT = 128

export default class PIXIPlayground extends React.Component<void, void> {
  private renderer: WebGLRenderer | CanvasRenderer
  private readonly container = new Container()
  private mesh: PIXI.mesh.Mesh
  private i = 0

  constructor() {
    super()
    this.renderer = autoDetectRenderer(1200, 800, { antialias: true, backgroundColor: 0x000000 })
    const vertices = new Float32Array([
      0, 32,
      0, 0,
      32, 32,
      32, 0,
    ])
    const uvs = new Float32Array([
      0, 32 / TEXTURE_HEIGHT,
      0, 0,
      32 / TEXTURE_WIDTH, 32 / TEXTURE_HEIGHT,
      32 / TEXTURE_WIDTH, 0,
    ])

    const indicies = new Uint16Array([0, 1])
    this.mesh = new PIXI.mesh.Mesh(createTexture(), vertices, uvs, indicies)
    this.mesh.x = 10
    this.mesh.y = 200
    this.container.addChild(this.mesh)

    this.renderer.render(this.container)
    setInterval(() => this.update(), 16)

    this.update()
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

  private getNewArrays(vertices: Float32Array, uvs: Float32Array, indices: Uint16Array):
    [Float32Array, Float32Array, Uint16Array] {
    // time to add a quad to the end of the tail
    // our usage of triangle_strip should make that very easy

    // let's start by calculating the lower vertice
    const lx = 32 + this.i * 2
    const ly = 32

    // then the upper one
    const hx = 32 + this.i * 2
    const hy = 0

    // now adding both vertices
    const newVerts = new Float32Array([lx, ly, hx, hy])

    // Add normalized UV-coordinated
    const newUvs = new Float32Array([
      lx / TEXTURE_WIDTH, ly / TEXTURE_HEIGHT,
      hx / TEXTURE_WIDTH, hy / TEXTURE_HEIGHT,
    ])

    // Add indices referencing the new vertices
    const index = 4 + this.i * 2
    const newIndices = new Uint16Array([index, index + 1])

    return [
      mergeFloat32(vertices, newVerts),
      mergeFloat32(uvs, newUvs),
      mergeUint16(indices, newIndices),
    ]
  }

  private update() {
    if (this.i < (1024 - 32) / 2) {
      const mesh = this.mesh;
      [mesh.vertices, mesh.uvs, mesh.indices] = this.getNewArrays(mesh.vertices, mesh.uvs, mesh.indices)
      this.i++
      mesh.dirty++
      mesh.indexDirty++
      const meshy = mesh as any
      meshy.refresh()
      mesh.updateTransform()

      this.renderer.render(this.container)
    }
  }
}

function mergeFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const c = new Float32Array(a.length + b.length)
  c.set(a)
  c.set(b, a.length)

  return c
}

function mergeUint16(a: Uint16Array, b: Uint16Array): Uint16Array {
  const c = new Uint16Array(a.length + b.length)
  c.set(a)
  c.set(b, a.length)

  return c
}

// template for drawing a 32x32 part of a texture
// should be tileable in all directions
// x, y is the top of the current area
function textureTemplate(x: number, y: number, context: CanvasRenderingContext2D) {
  context.fillStyle = "red"
  context.fillRect(x, y, 32, 8)
  context.fillStyle = "green"
  context.fillRect(x, y + 8, 32, 8)
  context.fillStyle = "blue"
  context.fillRect(x, y + 16, 32, 8)
  context.fillStyle = "white"
  context.fillRect(x, y + 24, 32, 8)
}

function createTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT

  const context = canvas.getContext("2d")!

  for (let x = 0; x < TEXTURE_WIDTH; x += 32) {
    for (let y = 0; y < TEXTURE_HEIGHT; y += 32) {
      textureTemplate(x, y, context)
    }
  }
  document.body.appendChild(canvas)
  return new Texture(new BaseTexture(canvas))
}
