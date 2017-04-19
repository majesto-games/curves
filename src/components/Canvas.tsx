import * as React from "react"

interface CanvasProps {
  view: HTMLCanvasElement,
}

export default class Canvas extends React.Component<CanvasProps, void> {
  private div: HTMLDivElement | null = null
  private games: { [key: string]: HTMLCanvasElement | undefined } = {}

  public componentDidMount() {
    this.updateView()
  }

  public render() {
    return <div ref={n => this.div = n} />
  }

  private updateView() {
    if (this.div) {
      while (this.div.firstChild) {
        this.div.removeChild(this.div.firstChild)
      }
      this.div.appendChild(this.props.view)
      document.body.focus()
    }
  }

}
