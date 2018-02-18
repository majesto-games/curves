
import { PropTypes } from "react"
import * as React from "react"
import history from "./history"
import { Path, LocationDescriptorObject } from "history"

export interface LinkProps {
  onClick?: (event: any) => void
  to: Path | LocationDescriptorObject
}

class Link extends React.Component<LinkProps> {
  public handleClick = (event: any) => {
    if (this.props.onClick) {
      this.props.onClick(event)
    }

    if (event.button !== 0 /* left click */) {
      return
    }

    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
      return
    }

    if (event.defaultPrevented === true) {
      return
    }

    event.preventDefault()

    if (this.props.to) {
      history.push(this.props.to as Path) // TypeScript can't unify the type signatures
    } else {
      history.push({
        pathname: event.currentTarget.pathname,
        search: event.currentTarget.search,
      })
    }
  }

  public render() {
    const { to, ...props } = this.props
    return <a href={typeof to === "string" ? to : history.createHref(to)} {...props} onClick={this.handleClick} />
  }

}

export default Link
