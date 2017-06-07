import { Texture, BaseTexture } from "pixi.js"
import { hexToString } from "game/util"

export interface DehydratedTexture<S extends string, P> {
  readonly type: S
  payload: P
}

export type AnyDehydratedTexture = DehydratedTexture<string, any>

// Add to this object to add more texture providers
const textureProviders: { [key: string]: TextureProvider<string, any> } = {}
export function registerTextureProvider<T extends string, P>(provider: TextureProvider<T, P>) {
  if (process.env.NODE_ENV !== "production") {
    const f = textureProviders[provider.type]
    if (f != null) {
      throw new Error(`texture provider (${provider.type}) already registered`)
    }
  }
  textureProviders[provider.type] = provider
}

export function getTexture(dehydrated: DehydratedTexture<string, any>) {
  const provider = textureProviders[dehydrated.type]
  if (process.env.NODE_ENV !== "production") {
    if (provider == null) {
      throw new Error(`texture provider (${dehydrated.type}) not registered`)
    }
  }
  const cacheKey = `${provider.type}___${provider.getCacheKey(dehydrated)}`
  let texture: Texture | undefined = PIXI.utils.TextureCache[cacheKey]
  if (texture != null) {
    return texture
  } else {
    texture = provider.getTexture(dehydrated);
    (Texture as any).addToCache(texture, cacheKey)
    return texture
  }
}

export interface TextureProvider<T extends string, P> {
  readonly type: T
  getTexture: (dehydrated: DehydratedTexture<T, P>) => Texture
  getCacheKey: (dehydrated: DehydratedTexture<T, P>) => string
}

// ===============================================================================
// Texture implementations
// ===============================================================================

type DehydratedImageTexture = DehydratedTexture<"fromimage", string>

interface FromImageTextureProvider extends TextureProvider<"fromimage", string> {
  getDehydrated: (url: string) =>
    DehydratedTexture<"fromimage", string>
}

export const fromImageTexture: FromImageTextureProvider = {
  type: "fromimage",
  getTexture: (dehydrated: DehydratedImageTexture) => Texture.fromImage(dehydrated.payload),
  getCacheKey: (dehydrated: DehydratedImageTexture) => dehydrated.payload,
  getDehydrated(url: string): DehydratedImageTexture {
    return {
      type: "fromimage",
      payload: url,
    }
  },
}
registerTextureProvider(fromImageTexture)

interface StripeColorTextureProvider extends TextureProvider<"stripecolor", DehydratedStripedColorTexturePayload> {
  getDehydrated: (color: number, stripeColor: number) =>
    DehydratedTexture<"stripecolor", DehydratedStripedColorTexturePayload>
}

export const stripeColorTexture: StripeColorTextureProvider = {
  type: "stripecolor",
  getTexture: (dehydrated) => {
    const { color, stripeColor } = dehydrated.payload
    return createTexture(color, straightStripesTemplate(hexToString(stripeColor), 4))
  },
  getCacheKey: (dehydrated) =>
    `c${dehydrated.payload.color}_sc${dehydrated.payload.stripeColor}`,
  getDehydrated(color: number, stripeColor: number) {
    return {
      type: "stripecolor",
      payload: {
        color,
        stripeColor,
      },
    }
  },
}
registerTextureProvider(stripeColorTexture)

interface DehydratedStripedColorTexturePayload {
  color: number
  stripeColor: number
}

interface SolidColorTextureProvider extends TextureProvider<"solidcolor", number> {
  getDehydrated: (color: number) => DehydratedTexture<"solidcolor", number>
}

export const solidColorTexture: SolidColorTextureProvider = {
  type: "solidcolor",
  getTexture: (dehydrated) => createTexture(dehydrated.payload, solidColorTemplate),
  getCacheKey: (dehydrated) => `${dehydrated.payload}`,
  getDehydrated(color: number) {
    return {
      type: "solidcolor",
      payload: color,
    }
  },
}
registerTextureProvider(solidColorTexture)

function solidColorTemplate(baseFill: string, canvas: HTMLCanvasElement) {
  canvas.width = 2
  canvas.height = 2
  const context = canvas.getContext("2d")!
  context.fillStyle = baseFill
  context.fillRect(0, 0, 2, 2)
}

function straightStripesTemplate(stripeColor: string, width: number): TextureTemplate {
  return (baseFill, canvas) => {
    const size = width * 2
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext("2d")!

    context.fillStyle = baseFill
    context.fillRect(0, 0, size, size)
    context.fillStyle = stripeColor
    context.fillRect(width / 2, 0, width, size)
  }
}

// should be tileable in all directions
type TextureTemplate = (baseFill: string, canvas: HTMLCanvasElement) => void

function createTexture(color: number, textureTemplate: TextureTemplate) {
  const canvas = document.createElement("canvas")
  textureTemplate(hexToString(color), canvas)
  const l = new BaseTexture(canvas)
  l.wrapMode = PIXI.WRAP_MODES.REPEAT
  return new Texture(l)
}
