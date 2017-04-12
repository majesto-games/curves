require("file-loader?name=[name].[ext]!index.html")

import * as React from "react"
import * as ReactDOM from "react-dom"

import Game from "components/Game"
import Lobby from "components/Lobby"
import history from "components/history"
import { Location, parsePath } from "history"

function render(location: Location) {
  let component: JSX.Element | undefined = undefined

  switch (location.pathname) {
    case "/": {
      component = <Lobby />
      break
    }
    case "/game": {
      component = <Game />
    }
    default:

  }

  ReactDOM.render(
    component || <p>Error</p>,
    document.getElementById("content") as HTMLElement,
  )
}

history.listen(render)
render(history.location)
