require("file-loader?name=[name].[ext]!index.html")

import * as React from "react"
import * as ReactDOM from "react-dom"

import Game from "components/Game"
import Lobby from "components/Lobby"
import GlobalConfig, { initGlobalConfig } from "components/GlobalConfig"
import UserConfig, { initUserConfig } from "components/UserConfig"
import history from "components/history"
import { Location, parsePath } from "history"

import "bootstrap/dist/css/bootstrap.css"
import "style.css"

function getComponent(location: Location): JSX.Element {
  const split = location.pathname.substring(1).split("/")

  if (split[0] === "") {
    return <Lobby />
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

function render(location: Location) {

  ReactDOM.render(
    getComponent(location),
    document.getElementById("content") as HTMLElement,
  )
}

initGlobalConfig()
initUserConfig()
history.listen(render)

render(history.location)
