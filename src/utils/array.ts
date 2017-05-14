
export function shuffle<T>(array: T[]) {
  let i = 0
  let j = 0

  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1))
    let temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array // same array returned, for convenience
}

/* tslint:disable no-bitwise */
export function chunk<T>(arr: T[], n: number) {
  return arr.slice(0, (arr.length + n - 1) / n | 0).map((_, i) => arr.slice(n * i, n * i + n))
}

/* tslint: enable */

export function frequency<T>(choices: [number, T][]): T {
  let rand = Math.random()
  for (let choice of choices) {
    rand -= choice[0]
    if (rand <= 0) {
      return choice[1]
    }
  }
  // just in case (and to please the compiler)
  return choices[0][1]
}
