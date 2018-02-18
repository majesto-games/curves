import * as React from "react"
import { KEYS } from "game/keys"
import never from "utils/never"
import { JsonSafeParse } from "utils/misc"

export interface PlayerKeys {
  left: KEYS
  right: KEYS
}

const SHAPE_VERSION = 3
interface UserConfig {
  playerKeys: PlayerKeys[]
  SHAPE_VERSION: number
}

type getConfigValue<T, K extends keyof T> = (key: keyof T) => T[K]

/* tslint:disable: no-namespace */
declare global {
  interface Window {
    UserConfig: UserConfig
  }
}
/* tslint:enable: no-namespace */

function defaultState(): UserConfig {
  return {
    playerKeys: [
      { left: KEYS.LEFT, right: KEYS.RIGHT },
      { left: KEYS.Z, right: KEYS.X },
      { left: KEYS.COMMA, right: KEYS.PERIOD },
      { left: KEYS.O, right: KEYS.P },
      { left: KEYS.Q, right: KEYS.W },
    ],
    SHAPE_VERSION,
  }
}

function readState(): UserConfig {
  const state = JsonSafeParse<UserConfig>(localStorage.getItem("userConfig"), {})
  if (state.SHAPE_VERSION !== SHAPE_VERSION) {
    return defaultState()
  }

  return state
}

function writeState(state: UserConfig) {
  localStorage.setItem("userConfig", JSON.stringify(state))
  window.UserConfig = state
}

export function initUserConfig() {
  const state = readState()
  writeState(state)
}

interface KeyChangeProps {
  value: number
  index: number
  name: "left" | "right"
  handleChange: <E extends string>(name: E, index: number, value: number) => void
}

class KeyChange extends React.Component<KeyChangeProps> {
  public render() {
    return (
      <label>
        NAME: {this.props.index + 1} - {this.props.name}<br />
        <input
          value={KEYS[this.props.value]}
          onKeyDown={this.handleKey}
          readOnly
          className="form-control"
        /><br /><br />
      </label>
    )
  }

  private handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.currentTarget.blur()
    this.props.handleChange(this.props.name, this.props.index, event.keyCode)
  }
}

export default class UserConfigC extends React.Component<{}, UserConfig> {

  public state: UserConfig

  constructor(props: {}) {
    super(props)
    this.state = window.UserConfig
  }

  public render() {
    const changers = []

    for (let i = 0; i < this.state.playerKeys.length; i++) {
      const keys = this.state.playerKeys[i]
      changers.push(
        <KeyChange
          index={i}
          name="left"
          value={keys.left}
          handleChange={this.handleChange}
          key={"left" + i} />,
        <KeyChange
          index={i}
          name="right"
          value={keys.right}
          handleChange={this.handleChange}
          key={"right" + i} />,
      )
    }

    return (
      <div className="Config">
        <button onClick={this.reset}>Reset</button><br /><br />
        {changers}
      </div>
    )
  }

  private reset = () => {
    const state = defaultState()
    writeState(state)
    this.setState(state)
  }

  private handleChange = (name: "left" | "right", index: number, value: number) => {
    this.state.playerKeys[index][name] = value
    writeState(this.state)
    this.setState(this.state)
  }
}
