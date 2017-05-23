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

export class Tuple2Event<E, D> {
  private listeners: ((value1: E, value2: D) => void)[] = []

  public subscribe(f: (value1: E, value2: D) => void) {
    this.listeners.push(f)

    return () =>
      this.listeners = this.listeners.filter(g => g !== f)
  }

  public send(value1: E, value2: D) {
    this.listeners.forEach(f => f(value1, value2))
  }
}

export class Observable<E> extends Tuple2Event<E, E> {
  constructor(public value: E) {
    super()
  }

  public send(value: E) {
    const old = this.value
    this.value = value
    super.send(value, old)
  }

  public set(value: E) {
    this.send(value)
  }
}

export class Signal<E> extends Observable<E> {
  public send(value: E) {
    if (value !== this.value) {
      super.send(value)
    }
  }
}
