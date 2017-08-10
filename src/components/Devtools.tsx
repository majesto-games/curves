import * as React from "react"

import { createDevTools } from "redux-devtools"

import SliderMonitor from "redux-slider-monitor"
import DockMonitor from "redux-devtools-dock-monitor"

const devTools = createDevTools(
  <DockMonitor
    toggleVisibilityKey="ctrl-h"
    changePositionKey="ctrl-q"
    defaultPosition="bottom"
    defaultSize={0.1}>
    <SliderMonitor />
  </DockMonitor>,
)

export default devTools
