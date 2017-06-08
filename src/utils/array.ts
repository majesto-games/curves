
export function shuffle<T>(array: T[]) {
  let i = 0
  let j = 0

  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array // same array returned, for convenience
}

export function flatten<T>(arr: any): T[] {
  return arr.reduce((flat: any, toFlatten: any) => {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten)
  }, [])
}

/* tslint:disable no-bitwise */
export function chunk<T>(arr: T[], n: number) {
  return arr.slice(0, (arr.length + n - 1) / n | 0).map((_, i) => arr.slice(n * i, n * i + n))
}

/* tslint: enable */

export function frequency<T>(choices: [number, T][], total?: number): T {
  let rand = Math.random() * (total || 1)
  for (const choice of choices) {
    rand -= choice[0]
    if (rand <= 0) {
      return choice[1]
    }
  }
  // just in case (and to please the compiler)
  return choices[0][1]
}

export function mergeFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const c = new Float32Array(a.length + b.length)
  c.set(a)
  c.set(b, a.length)

  return c
}

export function mergeUint16(a: Uint16Array, b: Uint16Array): Uint16Array {
  const c = new Uint16Array(a.length + b.length)
  c.set(a)
  c.set(b, a.length)

  return c
}

export type KeysToTrue<T> = {
  [P in Key<T>]: true;
}

export type Key<T> = keyof T

export type Mapping<T, S> = {
  [P in Key<T>]: S
}

export function arrayToMap<T>(array: Key<T>[]): KeysToTrue<T>
export function arrayToMap(array: string[]): { [key: string]: true }
export function arrayToMap<T>(array: Key<T>[]) {
  const result: KeysToTrue<T> = {} as any
  array.forEach((v: Key<T>) => {
    result[v] = true
  })
  return result
}

type Mapper<T, S> = (value: T[Key<T>], key: Key<T>) => S

export function mapObject<T, S>(f: Mapper<T, S>, obj: T): Mapping<T, S> {
  const result: Mapping<T, S> = {} as any
  const keys = Object.keys(obj) as Key<T>[]
  for (const key of keys) {
    result[key] = f(obj[key], key)
  }
  return result
}
