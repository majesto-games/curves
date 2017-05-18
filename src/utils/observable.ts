export class SimpleEvent<E> {
  private listeners: ((event: E) => void)[] = []

  public subscribe(f: (event: E) => void) {
    this.listeners.push(f)

    return () =>
      this.listeners = this.listeners.filter(g => g !== f)
  }

  public send(event: E) {
    this.listeners.forEach(f => f(event))
  }
}

export class Observable<E> extends SimpleEvent<E> {
  constructor(public value: E) {
    super()
  }

  public send(value: E) {
    this.value = value
    super.send(value)
  }

  public set(value: E) {
    this.send(value)
  }
}

export class DataEvent<E, D> {
  private listeners: ((event: E, data: D) => void)[] = []

  public subscribe(f: (event: E, data: D) => void) {
    this.listeners.push(f)

    return () =>
      this.listeners = this.listeners.filter(g => g !== f)
  }

  public send(event: E, data: D) {
    this.listeners.forEach(f => f(event, data))
  }
}
