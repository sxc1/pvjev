import type { GameId } from '../contracts'
import { ticTacToeRules } from '../games/tic-tac-toe/rules'

export const gameRegistry = {
  'tic-tac-toe': { id: 'tic-tac-toe', label: 'Tic Tac Toe', enabled: true, rules: ticTacToeRules },
  'connect-four': { id: 'connect-four', label: 'Connect Four', enabled: false },
  chess: { id: 'chess', label: 'Chess', enabled: false },
} as const satisfies Record<GameId, { readonly id: GameId; readonly label: string; readonly enabled: boolean; readonly rules?: typeof ticTacToeRules }>
