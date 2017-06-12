import { Texture, BaseTexture } from "pixi.js"
import { hexToString } from "game/util"
import { FunctionProviderUndefined, DehydratedFunction } from "utils/serif"

export type DehydratedTexture = DehydratedFunction
export const textureProviders = new FunctionProviderUndefined<Texture>()

export function registerTextureProvider(f: (t: any) => Texture) {
  textureProviders.register(f)
}
export function getTexture(dehydrated: DehydratedFunction): Texture {
  const cacheKey = JSON.stringify(dehydrated)
  const cached: Texture | undefined = PIXI.utils.TextureCache[cacheKey]
  if (cached != null) {
    return cached
  } else {
    const texture: Texture = textureProviders.getF(dehydrated);
    (Texture as any).addToCache(texture, cacheKey)
    return texture
  }
}

// ===============================================================================
// Texture implementations
// ===============================================================================

export function fromImageTexture(url: string) {
  return Texture.fromImage(url)
}
registerTextureProvider(fromImageTexture)

export interface StripeColorParams {
  color: number
  stripeColor: number
}
export function stripeColorTexture({ color, stripeColor }: StripeColorParams) {
  return createTexture(color, straightStripesTemplate(hexToString(stripeColor), 4))
}
registerTextureProvider(stripeColorTexture)

export function solidColorTexture(color: number) {
  return createTexture(color, solidColorTemplate)
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
