import { Container, Graphics, Text, Sprite, Texture } from "pixi.js"
import { diffArray } from "utils/diff"
import never from "utils/never"

import { MeshPart as TailMesh } from "./tail"

export interface KeyText {
  x: number,
  y: number,
  rotation: number,
  text: string,
  color: number,
}

export interface PowerupSprite {
  x: number
  y: number
  image: string
  id: number
}

export interface RenderState {
  keytexts: KeyText[]
  powerups: PowerupSprite[]
  tails: TailMesh[]
}

function neverDiff(x: never) {
  return never("Unexpected diff type in", x)
}

export function emptyState(): RenderState {
  return {
    keytexts: [],
    powerups: [],
    tails: [],
  }
}

export default class Render {
  private state: RenderState = emptyState()

  private readonly keysLayer = new Graphics()
  private readonly powerupLayer = new Graphics()
  private readonly tailLayer = new Graphics()

  constructor(private container: Container) {
    // The order of these actually matters
    // Order is back to front
    this.container.addChild(this.keysLayer)
    this.container.addChild(this.powerupLayer)
    this.container.addChild(this.tailLayer)
  }

  public setState(state: RenderState) {
    if (state === this.state) {
      return
    }

    const keytextsdiff = diffArray(this.state.keytexts, state.keytexts)

    keytextsdiff.forEach(diff => {
      switch (diff.type) {
        case "add": {
          diff.vals.forEach((v, i) => {
            const text = new Text(v.text, {
              fontFamily: "Courier New",
              fill: v.color,
              fontSize: 24,
            })

            text.anchor.set(0.5, 1.5)
            text.x = v.x
            text.y = v.y
            text.rotation = v.rotation
            this.keysLayer.addChildAt(text, diff.index + i)

          })
          break
        }
        case "rm": {
          this.keysLayer.removeChildren(diff.index, diff.index + diff.num)
          break
        }
        case "set": {

          break
        }
        case "mod": {
          break
        }
        default:
          neverDiff(diff)
      }
    })

    const powerupsdiff = diffArray(this.state.powerups, state.powerups)

    powerupsdiff.forEach(diff => {
      switch (diff.type) {
        case "add": {
          diff.vals.forEach((v, i) => {
            const powerupSprite = Sprite.fromImage(v.image, undefined, undefined)
            powerupSprite.position.set(v.x, v.y)
            powerupSprite.anchor.set(0.5)

            this.powerupLayer.addChildAt(powerupSprite, diff.index + i)
          })
          break
        }
        case "rm": {
          this.powerupLayer.removeChildren(diff.index, diff.index + diff.num)
          break
        }
        case "set": {
          const index = diff.path[0] as number
          const sprite = this.powerupLayer.getChildAt(index) as Sprite
          const value = diff.val

          sprite.position.set(value.x, value.y)
          sprite.texture = Texture.fromImage(value.image)
          break
        }
        case "mod": {
          break
        }
        default:
          neverDiff(diff)
      }
    })

    const tailsdiff = diffArray(this.state.tails, state.tails)

    tailsdiff.forEach(diff => {
      switch (diff.type) {
        case "add": {
          diff.vals.forEach((v, i) => {
            const mesh = new PIXI.mesh.Mesh(
              Texture.from(v.textureCacheKey),
              v.vertices,
              v.uvs,
              v.indices)

            this.tailLayer.addChildAt(mesh, diff.index + i)
          })
          break
        }
        case "rm": {
          this.tailLayer.removeChildren(diff.index, diff.index + diff.num)
          break
        }
        case "set": {
          const index = diff.path[0] as number
          const mesh = this.tailLayer.getChildAt(index) as PIXI.mesh.Mesh
          const value = diff.val

          mesh.texture = Texture.from(value.textureCacheKey)
          mesh.vertices = value.vertices
          mesh.uvs = value.uvs
          mesh.indices = value.indices

          mesh.dirty++
          mesh.indexDirty++
          const meshy = mesh as any
          meshy.refresh()
          mesh.updateTransform()
          break
        }
        case "mod": {
          break
        }
        default:
          neverDiff(diff)
      }
    })

    this.state = state
  }
}
