require("file-loader?name=[name].[ext]!index.html")

import * as React from "react"
import * as ReactDOM from "react-dom"

import Game from "components/Game"
import Lobby from "components/Lobby"
import history from "components/history"
import { Location, parsePath } from "history"


function getComponent(location: Location): JSX.Element {
  const split = location.pathname.substring(1).split("/")

  if (split[0] === "") {
    return <Lobby />
  }
  if (split[0] === "game") {
    const room = split[1] || "leif"
    return <Game room={room} />
  }

  return <p>Error</p>
}

function render(location: Location) {

  ReactDOM.render(
    getComponent(location),
    document.getElementById("content") as HTMLElement,
  )
}

history.listen(render)

render(history.location)
