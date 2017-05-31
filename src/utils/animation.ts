
type TweenF<T> = (step: number, stepsLeft: number) => T

interface Tween<T> {
  readonly start: number
  readonly end: number
  readonly f: TweenF<T>
}

export interface AnimationProgress<T> {
  value: T
  progress: number
  order: number
}

export class Animation<T> {
  private tweens: Tween<T>[] = []
  private currentTick = 0

  constructor(private reducer: (values: T[]) => void) {

  }

  public add(duration: number, f: TweenF<T>) {
    this.tweens.push({
      start: this.currentTick,
      end: this.currentTick + duration,
      f,
    })
  }

  public tick() {
    this.currentTick++
    this.tweens = this.tweens.filter(tween => tween.end > this.currentTick)
    this.reducer(this.tweens.map(tween => {
      const step = this.currentTick - tween.start
      const stepsLeft = tween.end - this.currentTick
      return tween.f(step, stepsLeft)
    }))
  }
}
