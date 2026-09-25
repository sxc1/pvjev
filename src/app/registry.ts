import type { GameId } from '../contracts'

export const gameRegistry = {
  'tic-tac-toe': { id: 'tic-tac-toe', label: 'Tic Tac Toe', enabled: true },
  'connect-four': { id: 'connect-four', label: 'Connect Four', enabled: true },
  chess: { id: 'chess', label: 'Chess', enabled: false },
} as const satisfies Record<GameId, { readonly id: GameId; readonly label: string; readonly enabled: boolean }>
