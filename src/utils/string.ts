export function leftPad(str: string, len: number) {
  const diff = len - str.length
  if (diff <= 0) {
    return str
  }

  return " ".repeat(diff) + str
}

export function rightPad(str: string, len: number) {
  const diff = len - str.length
  if (diff <= 0) {
    return str
  }

  return str + " ".repeat(diff)
}

export function padEqual(left: string, right: string) {
  return [leftPad(left, right.length), rightPad(right, left.length)]
}
