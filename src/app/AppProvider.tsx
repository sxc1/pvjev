import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { ApplicationHost, TicTacToeController } from '../contracts'

const ControllerContext = createContext<TicTacToeController | null>(null)
const HostContext = createContext<ApplicationHost | null>(null)

export function AppProvider({ controller, host, children }: { readonly controller?: TicTacToeController; readonly host?: ApplicationHost; readonly children: ReactNode }) {
  return <HostContext.Provider value={host ?? null}><ControllerContext.Provider value={host?.ticTacToe ?? controller ?? null}>{children}</ControllerContext.Provider></HostContext.Provider>
}

export function useApplicationHost() {
  const host = useContext(HostContext)
  if (!host) throw new Error('Application host is missing')
  const selectedGame = useSyncExternalStore(host.subscribe, host.getSelectedGame, host.getSelectedGame)
  return { host, selectedGame }
}

export function useConnectFourController() {
  const host = useContext(HostContext)
  if (!host) throw new Error('Application host is missing')
  const controller = host.connectFour
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { snapshot, dispatch: controller.dispatch }
}

export function useTicTacToeController() {
  const controller = useContext(ControllerContext)
  if (!controller) throw new Error('Tic Tac Toe controller is missing')
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { snapshot, dispatch: controller.dispatch }
}
