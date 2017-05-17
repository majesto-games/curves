
type TweenF = (step: number, stepsLeft: number) => number

interface Tween {
  readonly start: number
  readonly end: number
  readonly f: TweenF
}

export class Animation {
  private tweens: Tween[] = []
  private currentTick = 0

  constructor(private reducer: (values: number[]) => void) {

  }

  public add(duration: number, f: TweenF) {
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
