import { Key, mapObject } from "utils/array"

type Reducer<STATE, ACTION> = (state: STATE, action: ACTION) => STATE

export interface Action<P> {
  readonly type: string
  payload: P
}

interface Module<S, ACTION_TYPES> {
  reducer: (state: S, action: Action<any>) => S,
  actions: {[K in Key<ACTION_TYPES>]: (p: ACTION_TYPES[K]) => Action<ACTION_TYPES[K]>},
  types: Key<ACTION_TYPES>[],
}

type Handler<S, ACTION_TYPES> = {[K in Key<ACTION_TYPES>]: Reducer<S, Action<ACTION_TYPES[K]>>}

export default function createModule<S, ACTION_TYPES>(initial: S, handler: Handler<S, ACTION_TYPES>):
  Module<S, ACTION_TYPES> {

  const reducer = (state = initial, action: Action<any>) => {
    return handler[action.type] ? handler[action.type](state, action) : state
  }

  const actions = mapObject((v, key) => {
    const actionCreator = (payload: ACTION_TYPES[Key<ACTION_TYPES>]) => ({ type: key, payload })
    return actionCreator
  }, handler)

  const types = Object.keys(handler) as Key<ACTION_TYPES>[]

  return { reducer, actions, types }
}
