import * as React from "react"

import { spinner } from "assets"

export default class Spinner extends React.Component<{}, {}> {

  public render() {
    return (
      <div className="Spinner">
        <img src={spinner} alt="Loading..." />
      </div>)
  }
}
