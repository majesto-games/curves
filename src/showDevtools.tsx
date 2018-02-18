import * as React from "react"
import { render } from "react-dom"
import DevTools from "components/Devtools"

export function showDevToolsPopup(store: any) {
  const popup = window.open(undefined, "Redux DevTools", "menubar=no,location=no,resizable=yes,scrollbars=no,status=no")
  // Reload in case it already exists

  if (!popup) {
    return
  }

  popup.location.reload()

  setTimeout(() => {
    popup.document.write('<div id="react-devtools-root"></div>')
    render(
      <DevTools store={store} />,
      popup.document.getElementById("react-devtools-root"),
    )
  }, 10)
}

export default function showDevTools(store: any) {
  render(
    <DevTools store={store} />,
    document.getElementById("devtools"),
  )
}
