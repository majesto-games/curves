require("file-loader?name=[name].[ext]!index.html")

import * as React from "react"
import * as ReactDOM from "react-dom"

import Game from "components/Game"
import RoomBrowser from "components/RoomBrowser"
import GlobalConfig, { initGlobalConfig } from "components/GlobalConfig"
import UserConfig, { initUserConfig } from "components/UserConfig"
import history from "components/history"
import { Location, parsePath } from "history"

import "bootstrap/dist/css/bootstrap.css"
import "style.css"

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

  return <p>Error</p>
}

interface PreferencesState {
  showPreferences: boolean
}

class Preferences extends React.Component<void, PreferencesState> {
  public state: PreferencesState = {
    showPreferences: true,
  }

  constructor(props: void) {
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
      <div className="Preferences">
        {this.state.showPreferences && <div className="GlobalConfig">
          <h1>Preferences</h1>
          <GlobalConfig />
        </div>}
        {this.state.showPreferences && <div className="UserConfig">
          <h1>Controls</h1>
          <UserConfig />
        </div>}
      </div>
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
