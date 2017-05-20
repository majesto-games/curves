import { shuffle } from "utils/array"

const MATERIAL_COLORS = [0xff5177, 0x7c4dff, 0x18ffff, 0x5af158, 0xeeff41, 0xffab40, 0xff6e40]

export function getColors(num: number) {
  const colors = MATERIAL_COLORS.slice()

  shuffle(colors)

  return colors.slice(0, num)
}

export function hexToString(hex: number) {
  return "#" + hex.toString(16)
}

/* tslint:disable no-bitwise */
export function funColor() {
  const red = 0x80 + Math.random() * 0x80
  const green = 0x80 + Math.random() * 0x80
  const blue = 0x80 + Math.random() * 0x80
  return superFunColor((red << 16) | (green << 8) | blue)
}

/* tslint: enable */

export function superFunColor(input: number) {
  const choices = [0xff00ff, 0xffff00, 0x00ffff, 0x0000ff, 0x00ff00, 0xff0000]

  return input & choices[Math.floor(Math.random() * choices.length)]
}
