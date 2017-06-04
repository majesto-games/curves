import * as React from "react"

/* tslint:disable: no-namespace */
declare global {
  interface Window {
    PhoneControls: { left: boolean, right: boolean }
  }
}
/* tslint:enable: no-namespace */
window.PhoneControls = { left: false, right: false }

export default class PhoneControls extends React.Component<{}, {}> {

  public constructor(props: {}) {
    super(props)
  }

  public render() {
    return (
      <div className="PhoneControls" onContextMenu={(e) => e.preventDefault()}>
        <div
          onTouchStart={(e) => this.onTouchStart(e, "left")}
          onTouchEnd={(e) => this.onTouchEnd(e, "left")} />
        <div
          onTouchStart={(e) => this.onTouchStart(e, "right")}
          onTouchEnd={(e) => this.onTouchEnd(e, "right")} />
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
