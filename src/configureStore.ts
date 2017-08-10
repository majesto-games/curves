import { createStore } from "redux"
import DevTools from "components/Devtools"

export default function configureStore(reducer: any, initialState: any) {
  return createStore(reducer, initialState, DevTools.instrument())

}
