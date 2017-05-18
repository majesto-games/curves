import * as React from "react"
import never from "utils/never"

interface GlobalConfigValues {
  TICK_RATE: number
  SKIP_TAIL_FATNESS_MULTIPLIER: number
  ROTATION_SPEED: number
  MOVE_SPEED_BASE: number
  HOLE_CHANCE_BASE: number
  HOLE_CHANCE_INCREASE: number
  FATNESS_BASE: number
  POWERUP_CHANCE_BASE: number
  POWERUP_CHANCE_INCREASE: number
  POWERUP_ACTIVE_DURATION: number
  ROUND_START_DELAY: number
}

interface GlobalConfig {
  SHAPE_VERSION: number
  VALUES: GlobalConfigValues
}

type Configurable<T> = {
  readonly [P in keyof T]: [T[P], T[P], T[P]];
}

type ConfigurableValue<T> = keyof T

const TICK_RATE = 64

const SHAPE_VERSION = 3
const SHAPE: Configurable<GlobalConfigValues> = {
  TICK_RATE: [6, 64, 300],
  SKIP_TAIL_FATNESS_MULTIPLIER: [0.003, 0.03, 0.3],
  ROTATION_SPEED: [0.1, 1, 10],
  MOVE_SPEED_BASE: [10, 100, 300],
  HOLE_CHANCE_BASE: [-0.2, -0.002, 1],
  HOLE_CHANCE_INCREASE: [0, 0.0018, 0.018],
  FATNESS_BASE: [0.5, 5, 50],
  POWERUP_CHANCE_BASE: [0.0032, 0.032, 64],
  POWERUP_CHANCE_INCREASE: [0.000064, 0.00064, 0.1],
  POWERUP_ACTIVE_DURATION: [0, 7, 20],
  ROUND_START_DELAY: [0, 4000, 10000],
}

type getConfigValue<T, K extends keyof T> = (key: keyof T) => T[K]

/* tslint:disable: no-namespace */
declare global {
  interface Window {
    Globals: GlobalConfig
    getGlobal: getConfigValue<GlobalConfigValues, keyof GlobalConfigValues>
  }
}

function JsonSafeParse<T>(s: string | null | undefined, onFail: any): T {
  if (s != null) {
    try {
      return JSON.parse(s)
    } catch (_) { ; }
  }
  return onFail
}

function defaultState(): GlobalConfig {
  const VALUES: GlobalConfigValues = {} as GlobalConfigValues

  for (let key in SHAPE) {
    if (SHAPE.hasOwnProperty(key)) {
      VALUES[key as keyof GlobalConfigValues] = SHAPE[key as keyof GlobalConfigValues][1]
    }
  }

  return {
    SHAPE_VERSION,
    VALUES,
  }
}

function readState(): GlobalConfig {
  let state = JsonSafeParse<GlobalConfig>(localStorage.getItem("globalConfig"), {})
  if (state.SHAPE_VERSION !== SHAPE_VERSION) {
    return defaultState()
  }

  return state
}

function writeState(state: GlobalConfig) {
  localStorage.setItem("globalConfig", JSON.stringify(state))
  window.Globals = state
}

export function initGlobalConfig() {
  writeState(readState())
  window.getGlobal = (key) => {
    switch (key) {
      case "TICK_RATE":
      case "ROTATION_SPEED":
      case "FATNESS_BASE":
      case "ROUND_START_DELAY":
        return window.Globals.VALUES[key]
      case "MOVE_SPEED_BASE":
      case "HOLE_CHANCE_BASE":
      case "HOLE_CHANCE_INCREASE":
      case "POWERUP_CHANCE_BASE":
      case "POWERUP_CHANCE_INCREASE":
        return window.Globals.VALUES[key] / window.Globals.VALUES.TICK_RATE
      case "POWERUP_ACTIVE_DURATION":
      case "SKIP_TAIL_FATNESS_MULTIPLIER":
        return window.Globals.VALUES[key] * window.Globals.VALUES.TICK_RATE
      default:
        return never("Unexpected global value requested:", key)
    }
  }
}

interface SliderProps {
  min: number
  max: number
  value: number
  name: string
  handleChange: (name: string, value: number) => void
}

class Slider extends React.Component<SliderProps, void> {
  public render() {
    const stepsize = (this.props.max - this.props.min) / 100
    return (
      <label>
        NAME: {this.props.name}<br />
        MIN: {this.props.min}<br />
        MAX: {this.props.max}<br />
        CURRENT: {this.props.value}<br />
        <input
          type="range"
          min={this.props.min}
          max={this.props.max}
          step={stepsize}
          value={this.props.value}
          onChange={this.handleChange} /><br /><br />
      </label>
    )
  }

  private handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.props.handleChange(this.props.name, +event.target.value)
  }
}

export default class GlobalConfigC extends React.Component<{}, GlobalConfig> {

  public state: GlobalConfig

  constructor() {
    super()
    this.state = window.Globals
  }

  public render() {
    const sliders = []

    for (let key in SHAPE) {
      if (SHAPE.hasOwnProperty(key)) {
        const [min, _, max] = SHAPE[key as keyof GlobalConfigValues]
        const value = window.Globals.VALUES[key as keyof GlobalConfigValues]
        sliders.push(
          <Slider
            min={min}
            max={max}
            value={value}
            handleChange={this.handleChange}
            name={key}
            key={key}
          />)
      }
    }

    return (
      <div className="Config">
        <button onClick={this.reset}>Reset</button><br /><br />
        {sliders}
      </div>
    )
  }

  private reset = () => {
    const state = defaultState()
    writeState(state)
    this.setState(state)
  }

  private handleChange = (name: keyof GlobalConfigValues, value: number) => {
    this.state.VALUES[name] = value
    writeState(this.state)
    this.setState(this.state)
  }

}
