import { Snake, Point } from "./player"
import {
  SERVER_WIDTH,
  SERVER_HEIGHT,
} from "../server/main"

import { mergeFloat32, mergeUint16 } from "utils/array"
import { Observable } from "utils/observable"

import { Record, List, Map as MapIm } from "immutable"
import createModule, { Action, Module } from "redux-typescript-module"
import { DehydratedTexture, getTexture } from "game/texture"

export interface TailPart {
  vertices: number[]
  playerId: number
  tailId: number
  isTailStart: boolean
}

export function newTailPart(
  vertices: number[],
  playerId: number,
  tailId: number,
  isTailStart: boolean,
): TailPart {
  return {
    vertices,
    playerId,
    tailId,
    isTailStart,
  }
}

export interface TailStorageI<TailT> {
  all: List<TailPart>
  perPlayer: MapIm<number, List<TailPart>>
  perTail: MapIm<number, List<TailT>>
}

export type TailStorage<TailT> = Record.Instance<TailStorageI<TailT>>

function getDefaultTailStorage<TailT>(): Record.Instance<TailStorageI<TailT>> {
  const clss = Record({
    all: List<TailPart>(),
    perPlayer: MapIm<number, List<TailPart>>(),
    perTail: MapIm<number, List<TailT>>(),
  })

  return new clss()
}

export function tailStorageModule<TailT>(
  createTail: (playerId: number) => TailT,
  addToTail: (tail: TailT, part: TailPart) => TailT,
) {
  return createModule(getDefaultTailStorage<TailT>(), {
    ADD_TAIL: (state: TailStorage<TailT>, action: Action<TailPart>) => {
      const part = action.payload

      const all = state.all.push(part)

      let forThisPlayer = state.perPlayer.get(part.playerId)
      if (forThisPlayer == null) {
        forThisPlayer = List()
      }
      const perPlayer = state.perPlayer.set(part.tailId, forThisPlayer.push(part))

      let tailsForThisPlayer = state.perTail.get(part.playerId)
      if (tailsForThisPlayer == null) {
        tailsForThisPlayer = List<TailT>()
      }

      let currentTail = tailsForThisPlayer.get(part.tailId)
      if (currentTail == null) {
        currentTail = createTail(part.playerId)
      }
      currentTail = addToTail(currentTail, part)

      const tailsForThisPlayer2 = tailsForThisPlayer.set(part.tailId, currentTail)

      return state.withMutations(mut => {
        mut.set("all", all)
        mut.set("perPlayer", perPlayer)
        mut.set("perTail", state.perTail.set(part.playerId, tailsForThisPlayer2))
      })
    },
  })
}

export function partsForPlayer<T>(storage: TailStorage<T>, player: Snake) {
  return partsForPlayerId(storage, player.id)
}

export function partsForPlayerId<T>(storage: TailStorage<T>, id: number) {
  return storage.perPlayer.get(id) || List<TailPart>()
}

export function tailsForPlayer<T>(storage: TailStorage<T>, player: Snake) {
  return tailsForPlayerId(storage, player.id)
}

export function tailsForPlayerId<T>(storage: TailStorage<T>, id: number) {
  return storage.perTail.get(id) || List<T>()
}

export interface MeshPart {
  vertices: Float32Array
  uvs: Float32Array
  indices: Uint16Array
  texture: DehydratedTexture
}

export function addToClientTail(tail: ClientTail, part: TailPart) {
  const textureMid = tail.textureHeight / 2
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

  let meshes = tail.meshes

  if (part.isTailStart) {
    const initVertices = new Float32Array([
      l1x, l1y,
      h1x, h1y,
    ])
    const initUvs = new Float32Array([
      tail.texturePosition / tail.textureWidth, width1 / tail.textureHeight,
      tail.texturePosition / tail.textureWidth, -width1 / tail.textureHeight,
    ])
    const initIndices = new Uint16Array([0, 1])

    meshes = tail.meshes.push({
      vertices: initVertices,
      uvs: initUvs,
      indices: initIndices,
      texture: tail.texture,
    })
  }

  const mesh = Object.assign({}, meshes.get(-1)!)

  const newVertices = new Float32Array([
    l2x, l2y,
    h2x, h2y,
  ])
  const newUvs = new Float32Array([
    width2 / tail.textureHeight, (tail.texturePosition + length) / tail.textureWidth,
    -width2 / tail.textureHeight, (tail.texturePosition + length) / tail.textureWidth,
  ])
  const index = mesh.indices.length
  const newIndices = new Uint16Array([index, index + 1])
  mesh.vertices = mergeFloat32(mesh.vertices, newVertices)
  mesh.uvs = mergeFloat32(mesh.uvs, newUvs)
  mesh.indices = mergeUint16(mesh.indices, newIndices)

  meshes = meshes.set(-1, mesh)

  return tail.withMutations(mut => {
    mut.set("meshes", meshes)
    mut.set("texturePosition", tail.texturePosition + length)
  })
}

export function newClientTail(texture: DehydratedTexture): ClientTail {
  const hydrated = getTexture(texture)

  const clss = Record({
    textureHeight: hydrated.height,
    textureWidth: hydrated.width,
    texturePosition: 0,
    texture,
    meshes: List<MeshPart>(),
  })

  return new clss()
}

export interface ClientTailI {
  meshes: List<MeshPart>
  textureWidth: number
  textureHeight: number
  texturePosition: number
  texture: DehydratedTexture
}

export type ClientTail = Record.Instance<ClientTailI>

export function isNewServerTail(tail: ServerTail) {
  return tail.parts.size < 1
}

export function containsPointExcludeLatest(tail: ServerTail, x: number, y: number) {
  if (x < tail.minX || x > tail.maxX || y < tail.minY || y > tail.maxY) {
    return false
  }

  const last = tail.vertices.get(-1)!
  const rest = tail.vertices.slice(0, -1)
  const mostOfLast = last.slice(0, -4)

  if (mostOfLast.length > 4 && specialContainsPoint(mostOfLast, x, y)) {
    return true
  }

  return rest.some(part => containsPoint(part, x, y))
}

export function serverTailContainsPoint(tail: ServerTail, x: number, y: number) {
  if (x < tail.minX || x > tail.maxX || y < tail.minY || y > tail.maxY) {
    return false
  }
  return tail.vertices.some(part => specialContainsPoint(part, x, y))
}

export function addToServerTail(tail: ServerTail, part: TailPart): ServerTail {
  const { vertices } = part

  if (isNewServerTail(tail)) {
    tail = tail.withMutations(mut => {
      mut.set("minX", vertices[0])
      mut.set("maxX", vertices[0])
      mut.set("minY", vertices[1])
      mut.set("maxY", vertices[1])
    })
  }

  for (let i = 0; i < vertices.length; i += 2) {
    const x = vertices[i]
    const y = vertices[i + 1]

    if (tail.minX > x) {
      tail = tail.set("minX", x)
    }
    if (tail.maxX < x) {
      tail = tail.set("maxX", x)
    }
    if (tail.minY > y) {
      tail = tail.set("minY", y)
    }
    if (tail.maxY < y) {
      tail = tail.set("maxY", y)
    }
  }

  tail = tail.set("parts", tail.parts.push(part))

  const [h1x, h1y, h2x, h2y, l2x, l2y, l1x, l1y] = part.vertices

  if (part.isTailStart || tail.vertices.size === 0) {
    tail = tail.set("vertices", tail.vertices.push([l1x, l1y, h1x, h1y]))
  }

  const verts = tail.vertices
  const last = verts.get(-1)!
  const newVerts = verts.set(-1, last.concat([h2x, h2y, l2x, l2y]))
  tail = tail.set("vertices", newVerts)

  return tail
}

export interface ServerTailI {
  minX: number
  maxX: number
  minY: number
  maxY: number
  parts: List<TailPart>
  vertices: List<number[]>
}

export type ServerTail = Record.Instance<ServerTailI>

export function newServerTail() {
  const clss = Record({
    minX: 0, // 0 is fine since it will be overwritten later as in addToServerTail
    maxX: 0,
    minY: 0,
    maxY: 0,
    parts: List<TailPart>(),
    vertices: List<number[]>(),
  })

  return new clss()
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
