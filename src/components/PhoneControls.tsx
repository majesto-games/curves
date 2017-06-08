import * as React from "react"
import * as cx from "classnames"

/* tslint:disable: no-namespace */
declare global {
  interface Window {
    PhoneControls: { left: boolean, right: boolean }
  }
}
/* tslint:enable: no-namespace */
window.PhoneControls = { left: false, right: false }

interface PhoneControlsState {
  invisible: boolean
}

export default class PhoneControls extends React.Component<{}, PhoneControlsState> {

  public state: PhoneControlsState = {
    invisible: false,
  }

  public componentDidMount() {
    setTimeout(() => this.setState({ invisible: true }), 3000)
  }

  public render() {
    return (
      // tslint:disable-next-line:object-literal-key-quotes
      <div className={cx("PhoneControls", { "PhoneControls-invisible": this.state.invisible })}
        onContextMenu={(e) => e.preventDefault()}>
        <div
          onTouchStart={(e) => this.onTouchStart(e, "left")}
          onTouchEnd={(e) => this.onTouchEnd(e, "left")}>
          <span><span className="glyphicon glyphicon-arrow-left" /> Left</span>
        </div>
        <div
          onTouchStart={(e) => this.onTouchStart(e, "right")}
          onTouchEnd={(e) => this.onTouchEnd(e, "right")}>
          <span>Right <span className="glyphicon glyphicon-arrow-right" /></span>
        </div>
      </div>
    )
  }

  private onTouchStart = (e: React.TouchEvent<HTMLElement>, direction: "left" | "right") => {
    window.PhoneControls[direction] = true
  }

  private onTouchEnd = (e: React.TouchEvent<HTMLElement>, direction: "left" | "right") => {
    window.PhoneControls[direction] = false
  }
}
