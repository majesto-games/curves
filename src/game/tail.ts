import { Snake, Point } from "./player"
import {
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "../server/main"

import { mergeFloat32, mergeUint16 } from "utils/array"
import { Observable } from "utils/observable"

export interface Tail {
  add: (part: TailPart) => void
  clear: () => void
}

export interface NotRemoved {
  removed: false
}

export class TailPart {
  public readonly centerX: number
  public readonly centerY: number
  public removed = false

  constructor(
    public readonly vertices: number[],
    public readonly playerId: number,
    public readonly tailId: number,
    public readonly isTailStart: boolean,
  ) {
    this.centerX = 0
    this.centerY = 0

    const verticeCount = vertices.length / 2

    for (let i = 0; i < vertices.length; i += 2) {
      this.centerX += vertices[i] / verticeCount
      this.centerY += vertices[i + 1] / verticeCount
    }
  }
}

type FilteredTailParts = (TailPart & NotRemoved)[]
class TailPartArray {
  constructor(
    public unfilteredValues: TailPart[] = [],
    public dirty = false,
  ) {

  }

  public get values() {
    if (this.dirty) {
      this.unfilteredValues = this.unfilteredValues.filter(v => !v.removed)
    }
    return this.unfilteredValues as FilteredTailParts
  }
}

function allDirty(arrs: TailPartArray[]) {
  arrs.forEach(arr => arr.dirty = true)
}

class Grid {
  public readonly cols: number
  public readonly rows: number
  private cells: TailPartArray[] = []

  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly scaleX: number,
    public readonly scaleY: number,
  ) {
    this.cols = width / scaleX
    this.rows = height / scaleY

    for (let i = 0; i < this.cols * this.rows; i++) {
      this.cells[i] = new TailPartArray()
    }
  }

  public add(part: TailPart & NotRemoved) {
    const col = this.col(part.centerX)
    const row = this.row(part.centerY)
    const index = this.index(col, row)

    this.cells[index].unfilteredValues.push(part)
  }

  public allDirty() {
    allDirty(this.cells)
  }

  private boundedWidth(x: number) {
    return Math.max(0, Math.min(this.width, x))
  }

  private boundedHeight(y: number) {
    return Math.max(0, Math.min(this.height, y))
  }

  private col(x: number) {
    return Math.floor(this.boundedWidth(x) / this.scaleX)
  }

  private row(y: number) {
    return Math.floor(this.boundedHeight(y) / this.scaleY)
  }

  private index(col: number, row: number) {
    return (row * this.cols) + col
  }

}

export class TailStorage<TailT extends Tail> {
  private allLinear: TailPartArray = new TailPartArray()
  private dirty = false
  private perPlayer: TailPartArray[] = []
  private grid = new Grid(SERVER_WIDTH, SERVER_HEIGHT, 10, 10)
  private perTail: TailT[][] = []

  constructor(private createTail: (playerId: number) => TailT) {

  }

  public get all() {
    return this.allLinear
  }

  public partsForPlayer(player: Snake) {
    return this.partsForPlayerId(player.id)
  }

  public partsForPlayerId(id: number) {
    return this.perPlayer[id].values
  }

  public tailsForPlayer(player: Snake) {
    return this.tailsForPlayerId(player.id)
  }

  public tailsForPlayerId(id: number) {
    return this.perTail[id]
  }

  public initPlayer(player: Snake) {
    this.perPlayer[player.id] = new TailPartArray()
    this.perTail[player.id] = []
  }

  public add(part: TailPart & NotRemoved) {
    this.allLinear.unfilteredValues.push(part)
    this.perPlayer[part.playerId].unfilteredValues.push(part)
    const tailsForPlayer = this.perTail[part.playerId]
    if (tailsForPlayer[part.tailId] == null) {
      this.initTail(part.playerId, part.tailId)
    }
    tailsForPlayer[part.tailId].add(part)
  }

  public removeTail(playerId: number, tailId: number) {
    const tailsForPlayer = this.perTail[playerId]
    tailsForPlayer[tailId].clear()
    this.allDirty()
  }

  public allDirty() {
    this.allLinear.dirty = true
    this.grid.allDirty()
    allDirty(this.perPlayer)
    // Tails can't be dirty yet
  }

  private initTail(playerId: number, tailId: number) {
    return this.perTail[playerId][tailId] = this.createTail(playerId)
  }
}

export class ClientTail implements Tail {
  public readonly meshes = new Observable<PIXI.mesh.Mesh[]>([])
  private readonly textureWidth: number
  private readonly textureHeight: number
  private texturePosition = 0

  constructor(private readonly texture: PIXI.Texture) {
    this.textureHeight = texture.height
    this.textureWidth = texture.width
  }

  public add(part: TailPart) {
    const textureMid = this.textureHeight / 2
    // point pair order is 1H, 2H, 2L, 1L

    const [h1x, h1y, h2x, h2y, l2x, l2y, l1x, l1y] = part.vertices
    const mid1x = (l1x + h1x) / 2
    const mid1y = (l1y + l1y) / 2
    const mid2x = (l2x + h2x) / 2
    const mid2y = (l2y + l2y) / 2

    const angle = Math.atan2(mid2y - mid1y, mid2x - mid1x)
    const length = Math.sqrt(Math.pow(mid1x - mid2x, 2) + Math.pow(mid1y - mid2y, 2))
    const width1 = Math.sqrt((Math.pow(h1x - l1x, 2) + Math.pow(h1y - l1y, 2))) / 2
    const width2 = Math.sqrt((Math.pow(h2x - l2x, 2) + Math.pow(h2y - l2y, 2))) / 2

    if (part.isTailStart) {
      const initVertices = new Float32Array([
        l1x, l1y,
        h1x, h1y,
      ])
      const initUvs = new Float32Array([
        this.texturePosition / this.textureWidth, width1 / this.textureHeight,
        this.texturePosition / this.textureWidth, -width1 / this.textureHeight,
      ])
      const initIndices = new Uint16Array([0, 1])
      const meshes = this.meshes.value.concat([new PIXI.mesh.Mesh(this.texture, initVertices, initUvs, initIndices)])
      this.meshes.set(meshes)
    }
    const mesh = this.meshes.value[this.meshes.value.length - 1]

    const newVertices = new Float32Array([
      l2x, l2y,
      h2x, h2y,
    ])
    const newUvs = new Float32Array([
      width2 / this.textureHeight, (this.texturePosition + length) / this.textureWidth,
      -width2 / this.textureHeight, (this.texturePosition + length) / this.textureWidth,
    ])
    const index = mesh.indices.length
    const newIndices = new Uint16Array([index, index + 1])
    mesh.vertices = mergeFloat32(mesh.vertices, newVertices)
    mesh.uvs = mergeFloat32(mesh.uvs, newUvs)
    mesh.indices = mergeUint16(mesh.indices, newIndices)

    this.texturePosition += length

    mesh.dirty++
    mesh.indexDirty++
    const meshy = mesh as any
    meshy.refresh()
    mesh.updateTransform()

  }

  public clear() {
    const meshes = this.meshes.value
    this.meshes.set([])
    meshes.forEach(mesh => mesh.destroy())
  }

}

export class ServerTail implements Tail {
  private minX: number
  private maxX: number
  private minY: number
  private maxY: number
  private parts: TailPart[] = []
  private vertices: number[][] = []

  public isNew() {
    return this.parts.length < 1
  }

  public add(part: TailPart) {
    const { vertices } = part

    if (this.isNew()) {
      this.minX = this.maxX = vertices[0]
      this.minY = this.maxY = vertices[1]
    }

    for (let i = 0; i < vertices.length; i += 2) {
      const x = vertices[i]
      const y = vertices[i + 1]

      this.ensureBoundsX(x)
      this.ensureBoundsY(y)
    }

    this.parts.push(part)
    const [h1x, h1y, h2x, h2y, l2x, l2y, l1x, l1y] = part.vertices

    if (part.isTailStart) {
      this.vertices.push([l1x, l1y, h1x, h1y])
    }

    this.vertices[this.vertices.length - 1].push(h2x, h2y, l2x, l2y)
  }

  public clear() {
    this.parts.forEach(part => part.removed = true)

    // This triggers isNew to be true which will also reset min/max values
    this.parts = []
  }

  // special case for colliding with itself
  public containsPointExcludeLatest(x: number, y: number) {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) {
      return false
    }

    const last = this.vertices[this.vertices.length - 1]
    const rest = this.vertices.slice(0, -1)
    const mostOfLast = last.slice(0, -4)

    if (mostOfLast.length > 4 && specialContainsPoint(mostOfLast, x, y)) {
      return true
    }

    return rest.some(part => containsPoint(part, x, y))
  }

  public containsPoint(x: number, y: number) {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) {
      return false
    }
    return this.vertices.some(part => specialContainsPoint(part, x, y))
  }

  private ensureBoundsX(x: number) {
    this.minX = Math.min(this.minX, x)
    this.maxX = Math.max(this.maxX, x)
  }

  private ensureBoundsY(y: number) {
    this.minY = Math.min(this.minY, y)
    this.maxY = Math.max(this.maxY, y)
  }

}

function lineIntersect(x: number, y: number, arr: number[], i: number, j: number) {
  const xi = arr[i]
  const yi = arr[i + 1]
  const xj = arr[j]
  const yj = arr[j + 1]
  return ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
}

function containsPoint(points: number[], x: number, y: number) {
  let inside = false

  const length = points.length / 2

  // j is i - 1 with wrapparound for negative numbers
  for (let i = 0, j = length - 1; i < length; j = i++) {
    if (lineIntersect(x, y, points, i * 2, j * 2)) {
      inside = !inside
    }
  }

  return inside
}

// containsPoint using our special indexing
export function specialContainsPoint(points: number[], x: number, y: number) {
  let inside = false

  for (let i = 0; i + 7 < points.length; i += 4) {
    const iLower = i
    const jLower = i + 4
    if (lineIntersect(x, y, points, iLower, jLower)) {
      inside = !inside
    }
    const iUpper = i + 2
    const jUpper = i + 6
    if (lineIntersect(x, y, points, iUpper, jUpper)) {
      inside = !inside
    }
  }

  // special case for start and end
  const iLower = 0
  const jLower = 0 + 2
  if (lineIntersect(x, y, points, iLower, jLower)) {
    inside = !inside
  }
  const iUpper = points.length - 2
  const jUpper = points.length - 4
  if (lineIntersect(x, y, points, iUpper, jUpper)) {
    inside = !inside
  }

  return inside
}
