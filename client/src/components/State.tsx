import React from 'react'

export const State = <T,>({ children, initialState }: { children: (props: { state: T; setState: (vals: Partial<T>) => void }) => React.ReactNode; initialState: T }) => {
  const [state, setState] = React.useState(initialState)
  return <>{children({ state, setState: (vals) => setState({ ...state, ...vals }) })}</>
}
