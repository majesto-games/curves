import { createStore } from "redux"

export default function configureStore(reducer: any, initialState: any) {
  return createStore(reducer, initialState)
}
