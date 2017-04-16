import { Snake, Point } from "./player"
import {
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "../server/main"

export interface Tail {
  add: (part: TailPart) => void
  clear: ()  => void
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
  public readonly graphics = new PIXI.Graphics()

  constructor(public color: number) {

  }

  public add(part: TailPart) {
    this.graphics.beginFill(this.color)
    this.graphics.drawPolygon(part.vertices)
    this.graphics.endFill()
  }

  public clear() {
    this.graphics.clear()
  }

}

export class ServerTail implements Tail {
  public minX: number
  public maxX: number
  public minY: number
  public maxY: number
  public parts: TailPart[] = []

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
  }

  public clear() {
    this.parts.forEach(part => part.removed = true)

    // This triggers isNew to be true which will also reset min/max values
    this.parts = []
  }

  public containsPoint(x: number, y: number) {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) {
      return false
    }
    return this.parts.some(part => containsPoint(part.vertices, x, y))
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

export function containsPoint (points: number[], x: number, y: number) {
  let inside = false

  const length = points.length / 2

  // j is i - 1 with wrapparound for negative numbers
  for (let i = 0, j = length - 1; i < length; j = i++) {
    const xi = points[i * 2]
    const yi = points[i * 2 + 1]
    const xj = points[j * 2]
    const yj = points[j * 2 + 1]
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)

    if (intersect) {
      inside = !inside
    }
  }

  return inside
};
