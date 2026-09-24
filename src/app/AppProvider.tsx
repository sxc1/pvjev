import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { TicTacToeController } from '../contracts'

const ControllerContext = createContext<TicTacToeController | null>(null)

export function AppProvider({ controller, children }: { readonly controller: TicTacToeController; readonly children: ReactNode }) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>
}

export function useTicTacToeController() {
  const controller = useContext(ControllerContext)
  if (!controller) throw new Error('Tic Tac Toe controller is missing')
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { snapshot, dispatch: controller.dispatch }
}
