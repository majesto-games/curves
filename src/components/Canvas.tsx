import * as React from "react"

interface CanvasProps {
  view: HTMLCanvasElement,
}

export default class Canvas extends React.Component<CanvasProps> {
  private div: HTMLDivElement | null = null

  public componentDidMount() {
    this.updateView(this.props)
    window.KeysPreventDefault = true
  }

  public componentWillUnmount() {
    window.KeysPreventDefault = false
  }

  public shouldComponentUpdate() {
    return false
  }

  public componentWillReceiveProps(p: CanvasProps) {
    this.updateView(p)
  }

  public render() {
    return <div className="Canvas" ref={n => this.div = n} />
  }

  private updateView(p: CanvasProps) {
    if (this.div) {
      while (this.div.firstChild) {
        this.div.removeChild(this.div.firstChild)
      }
      this.div.appendChild(p.view)
      document.body.focus()
    }
  }

}
