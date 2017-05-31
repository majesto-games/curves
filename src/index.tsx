import * as React from "react"
import * as ReactDOM from "react-dom"

import Game from "components/Game"
import RoomBrowser from "components/RoomBrowser"
import GlobalConfig, { initGlobalConfig } from "components/GlobalConfig"
import UserConfig, { initUserConfig } from "components/UserConfig"
import PIXIPlayground from "components/PIXIPlayground"
import history from "components/history"
import { Location, parsePath } from "history"

import "bootstrap/dist/css/bootstrap.css"
import "style.css"
import keysSetup from "game/keys"
keysSetup()

function getComponent(location: Location): JSX.Element {
  const split = location.pathname.substring(1).split("/")

  if (split[0] === "") {
    return <RoomBrowser />
  }
  if (split[0] === "game") {
    const room = split[1] || "leif"
    return <Game room={room} />
  }
  if (split[0] === "globalconfig") {
    return <GlobalConfig />
  }
  if (split[0] === "userconfig") {
    return <UserConfig />
  }
  if (split[0] === "playground") {
    return <PIXIPlayground />
  }

  return <p>Error</p>
}

interface PreferencesState {
  showPreferences: boolean
}

class Preferences extends React.Component<{}, PreferencesState> {
  public state: PreferencesState = {
    showPreferences: false,
  }

  constructor(props: {}) {
    super(props)

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.keyCode === 80 && e.altKey) { // Alt-P
        e.preventDefault()
        this.togglePreferences()
      }
    })
  }

  public render() {
    return (
      this.state.showPreferences ? <div className="Preferences">
        <div className="GlobalConfig">
          <h1>Preferences</h1>
          <GlobalConfig />
        </div>
        <div className="UserConfig">
          <h1>Controls</h1>
          <UserConfig />
        </div>
      </div> : null
    )
  }

  private togglePreferences = () => {
    this.setState({ showPreferences: !this.state.showPreferences })
  }
}

function render(location: Location) {

  ReactDOM.render(
    <div>
      <Preferences />
      {getComponent(location)}
    </div>,
    document.getElementById("content") as HTMLElement,
  )
}

initGlobalConfig()
initUserConfig()
history.listen(render)

render(history.location)

const version = new Date(BUILDTIME).toLocaleString("sv", {
  hour12: false,
})
console.log(`%c Curves (${version})`, "font-style: italic; color: #FC0000")
