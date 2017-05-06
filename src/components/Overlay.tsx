import * as React from "react"

interface OverlayProps {
  text: string | undefined
}

// TODO: Better styling
export default class Overlay extends React.Component<OverlayProps, void> {

  public render() {
    if (this.props.text != null) {
      return <p className="Overlay" >{this.props.text}</p>
    }
    return null
  }
}
