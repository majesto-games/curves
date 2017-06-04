import { Texture } from "pixi.js"

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
