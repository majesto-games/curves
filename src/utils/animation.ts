
import { FunctionProvider, DehydratedFunction } from "utils/serif"
import { linear } from "tween-functions"

interface TweenParams {
  step: number
  left: number
}

export interface TweenResult<V> {
  progress: number
  order: number
  value: V
}

export const numberTweenProviders = new FunctionProvider<TweenParams, TweenResult<number>>()
export const undefinedTweenProviders = new FunctionProvider<TweenParams, TweenResult<undefined>>()

export interface LinearInOutParams {
  duration: number
  attackDecayTime: number
  target: number
  powerupId: number
}

export function linearAttackDecay({ duration, attackDecayTime, target, powerupId }: LinearInOutParams) {
  return ({ step, left }: TweenParams) => {
    let value = target
    if (step <= attackDecayTime) {
      value = linear(step, 0, target, attackDecayTime)
    } else if (left <= attackDecayTime) {
      value = linear(attackDecayTime - left, target, 0, attackDecayTime)
    }

    return {
      progress: step / duration,
      order: powerupId,
      value,
    }
  }
}
numberTweenProviders.register(linearAttackDecay)

interface GhostifyParams {
  duration: number
  powerupId: number
}
export function booleanTrue({ duration, powerupId }: GhostifyParams) {
  return ({ step, left }: TweenParams) => {

    return {
      progress: step / duration,
      order: powerupId,
      value: undefined,
    }
  }
}
undefinedTweenProviders.register(booleanTrue)

interface Tween {
  readonly start: number
  readonly end: number
  readonly f: DehydratedFunction
}

export interface Animation {
  currentTick: number
  tweens: Tween[]
}

export function tick(animation: Animation): Animation {
  return {
    currentTick: animation.currentTick + 1,
    tweens: animation.tweens.filter(tween => tween.end > animation.currentTick + 1),
  }
}

export function add(animation: Animation, duration: number, f: DehydratedFunction): Animation {
  const tween: Tween = {
    start: animation.currentTick,
    end: animation.currentTick + duration,
    f,
  }

  return {
    currentTick: animation.currentTick,
    tweens: animation.tweens.concat([tween]),
  }
}

export function newAnimation(): Animation {
  return {
    currentTick: 0,
    tweens: [],
  }
}

export function values<V>(
  provider: FunctionProvider<TweenParams, TweenResult<V>>,
  animation: Animation): TweenResult<V>[] {
  return animation.tweens.map(tween => {
    const f = provider.getF(tween.f)
    const step = animation.currentTick - tween.start
    const left = tween.end - animation.currentTick
    return f({ left, step })
  })
}
