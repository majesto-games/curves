import * as React from "react"

interface OverlayProps {
  text: string | undefined
}

// TODO: Better styling
export default class Overlay extends React.Component<OverlayProps, {}> {

  public render() {
    if (this.props.text != null) {
      return <div className="Overlay">{this.props.text}</div>
    }
    return null
  }
}
