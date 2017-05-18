
export default function never(message: string, x: never): never {
  throw new Error(`${message} ${x}`)
}
