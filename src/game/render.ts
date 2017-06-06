import { Container, Graphics, Text, Sprite, Texture } from "pixi.js"
import { diffArray } from "utils/diff"
import never from "utils/never"

import { MeshPart as TailMesh } from "./tail"
import { fillSquare } from "game/client"
import { getTexture, AnyDehydratedTexture } from "game/texture"

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
  texture: AnyDehydratedTexture
  id: number
}

export interface SnakeGraphics {
  x: number
  y: number
  rotation: number
  fatness: number
  texture: AnyDehydratedTexture
  powerupProgress: number[]
}

export interface RenderState {
  keytexts: KeyText[]
  powerups: PowerupSprite[]
  tails: TailMesh[]
  snakes: SnakeGraphics[]
}

function neverDiff(x: never) {
  return never("Unexpected diff type in", x)
}

export function emptyState(): RenderState {
  return {
    keytexts: [],
    powerups: [],
    tails: [],
    snakes: [],
  }
}

interface Dehydrated {
  keytexts: KeyText[]
  powerups: PowerupSprite[]
  tails: TailMesh[]
  snakes: SnakeGraphics[]
}

export default class Render {
  private state: RenderState = emptyState()

  private readonly keysLayer = new Graphics()
  private readonly powerupLayer = new Graphics()
  private readonly tailLayer = new Graphics()
  private readonly playerLayer = new Graphics()

  constructor(private container: Container) {
    // The order of these actually matters
    // Order is back to front
    this.container.addChild(this.keysLayer)
    this.container.addChild(this.powerupLayer)
    this.container.addChild(this.tailLayer)
    this.container.addChild(this.playerLayer)
  }

  public dehydrate() {
    const {
      keytexts,
      powerups,
      tails,
      snakes,
    } = this.state

    const obj = {
      keytexts,
      powerups,
      tails: tails.map(tail => ({
        vertices: Array.from(tail.vertices),
        uvs: Array.from(tail.uvs),
        indices: Array.from(tail.indices),
        texture: tail.texture,
      })),
      snakes,
    }

    return JSON.stringify(obj)
  }

  public rehydrate(s: string) {
    const obj: Dehydrated = JSON.parse(s)

    const {
      keytexts,
      powerups,
      tails,
      snakes,
    } = obj

    const state: RenderState = {
      keytexts,
      powerups,
      tails: tails.map(tail => ({
        vertices: new Float32Array(tail.vertices),
        uvs: new Float32Array(tail.uvs),
        indices: new Uint16Array(tail.indices),
        texture: tail.texture,
      })),
      snakes,
    }

    console.log(state)

    this.setState(state)

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
          throw new Error(`unhandled diff ${diff.type}`)
        }
        case "mod": {
          throw new Error(`unhandled diff ${diff.type}`)
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
            const powerupSprite = new Sprite(getTexture(v.texture))
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
          sprite.texture = getTexture(value.texture)
          break
        }
        case "mod": {
          throw new Error(`unhandled diff ${diff.type}`)
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
              getTexture(v.texture),
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

          mesh.texture = getTexture(value.texture)
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
          throw new Error(`unhandled diff ${diff.type}`)
        }
        default:
          neverDiff(diff)
      }
    })

    const snakesdiff = diffArray(this.state.snakes, state.snakes)

    function moveSnake(container: Graphics, snake: SnakeGraphics) {
      const graphics = container.getChildAt(0) as PIXI.mesh.Mesh
      const powerupGraphics = container.getChildAt(1) as PIXI.Graphics
      const {
        x, y,
        fatness,
        rotation,
        powerupProgress,
        texture,
      } = snake

      container.position.set(x, y)
      graphics.texture = getTexture(texture)
      graphics.vertices.set(fillSquare(fatness * 2, fatness * 2))
      graphics.uvs.set(fillSquare(fatness * 2 / graphics.texture.width, fatness * 2 / graphics.texture.height))
      graphics.rotation = rotation
      graphics.children[0].scale.set(fatness, fatness)

      graphics.dirty++
      graphics.indexDirty++
      const meshy = graphics as any
      meshy.refresh()
      graphics.updateTransform()

      powerupGraphics.clear()
      let i = 1
      for (const progress of powerupProgress) {
        powerupGraphics.beginFill(0x000000, 0)
        const lineWidth = 5
        powerupGraphics.lineStyle(lineWidth, 0xffffff)

        const r = fatness + (lineWidth * i)
        i += 1.5
        const startAngle = - Math.PI / 2
        const endAngle = startAngle + Math.PI * 2 - Math.PI * 2 * progress % (Math.PI * 2)
        const startX = Math.cos(startAngle) * r
        const startY = Math.sin(startAngle) * r

        // Perform moveTo so that no line is drawn between arcs
        powerupGraphics.moveTo(startX, startY)
        powerupGraphics.arc(0, 0, r, startAngle, endAngle)
        powerupGraphics.endFill()
      }
    }

    snakesdiff.forEach(diff => {
      switch (diff.type) {
        case "add": {
          diff.vals.forEach((v, i) => {
            const container = new Graphics()
            const graphics = new PIXI.mesh.Mesh(
              getTexture(v.texture),
              fillSquare(1, 1),
              fillSquare(1, 1),
              new Uint16Array([0, 1, 2, 3]))
            const mask = new Graphics()
            mask.beginFill(0x000000)

            mask.drawCircle(0, 0, 1)
            mask.endFill()
            // adding the mask as child makes it follow the snake position
            graphics.addChild(mask)
            // also sets mask.renderable to false :)
            graphics.mask = mask
            graphics.rotation = v.rotation

            container.addChild(graphics)
            container.addChild(new Graphics())

            this.playerLayer.addChildAt(container, diff.index + i)
            moveSnake(container, v)
          })
          break
        }
        case "rm": {
          this.playerLayer.removeChildren(diff.index, diff.index + diff.num)
          break
        }
        case "set": {
          const index = diff.path[0] as number
          const container = this.playerLayer.getChildAt(index) as Graphics
          moveSnake(container, diff.val)

          break
        }
        case "mod": {
          const index = diff.path[0] as number
          const container = this.playerLayer.getChildAt(index) as Graphics
          moveSnake(container, diff.to)
          break
        }
        default:
          neverDiff(diff)
      }
    })

    this.state = state
  }
}
