const MATERIAL_COLORS = [0xff5177, 0x7c4dff, 0x18ffff, 0x5af158, 0xeeff41, 0xffab40, 0xff6e40]

function shuffle<T> (array: T[]) {
  let i = 0
  let j = 0

  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1))
    let temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

export function getColors (num: number) {
  let colors = MATERIAL_COLORS.slice()

  shuffle(colors)

  return colors.slice(0, num)
}

/* tslint:disable no-bitwise */
export function funColor () {
  const red   = 0x80 + Math.random() * 0x80
  const green = 0x80 + Math.random() * 0x80
  const blue  = 0x80 + Math.random() * 0x80
  return superFunColor((red << 16) | (green << 8) | blue)
}

export function superFunColor (input: number) {
  let choices = [0xff00ff, 0xffff00, 0x00ffff, 0x0000ff, 0x00ff00, 0xff0000]

  return input & choices[Math.floor(Math.random() * choices.length)]
}

export function chunk<T> (arr: T[], n: number) {
  return arr.slice(0, (arr.length + n - 1) / n | 0).map((_, i) => arr.slice(n * i, n * i + n ))
}

/* tslint: enable */
