import type { GameId } from './game'

/** Cell indices are row-major, from A3 (0) to C1 (8). Runtime input still needs validation. */
export type TicTacToeMove = number
export type TicTacToeSymbol = 'X' | 'O'
export type TicTacToeCell = TicTacToeSymbol | null
export type TicTacToeBoard = readonly [
  TicTacToeCell, TicTacToeCell, TicTacToeCell,
  TicTacToeCell, TicTacToeCell, TicTacToeCell,
  TicTacToeCell, TicTacToeCell, TicTacToeCell,
]
export type TicTacToeWinningLine = readonly [TicTacToeMove, TicTacToeMove, TicTacToeMove]

export type TicTacToeBoardOutcome =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'win'; readonly winner: TicTacToeSymbol; readonly winningLines: readonly TicTacToeWinningLine[] }
  | { readonly kind: 'draw' }

export type TicTacToeOutcome = TicTacToeBoardOutcome |
  { readonly kind: 'resignation'; readonly resigningSymbol: TicTacToeSymbol; readonly winner: TicTacToeSymbol; readonly ply: number }

export interface TicTacToePosition {
  readonly board: TicTacToeBoard
  /** X opens. This remains the alternating next symbol even for terminal boards. */
  readonly nextSymbol: TicTacToeSymbol
  readonly outcome: TicTacToeBoardOutcome
  readonly winningLines: readonly TicTacToeWinningLine[]
}

export type TicTacToeMoveRecord<Analysis = never> = {
  readonly ply: number
  readonly symbol: TicTacToeSymbol
  readonly cell: TicTacToeMove
} & (
  | { readonly actor: 'human'; readonly provenance: 'human'; readonly analysis?: never; readonly diagnostic?: never }
  | { readonly actor: 'cpu'; readonly provenance: 'rng'; readonly analysis?: Analysis; readonly diagnostic?: never }
  | { readonly actor: 'cpu'; readonly provenance: 'rng-fallback'; readonly diagnostic: string; readonly analysis?: never }
)

export interface TicTacToeMatch<Analysis = never> {
  readonly gameId: Extract<GameId, 'tic-tac-toe'>
  readonly id: string
  readonly humanSymbol: TicTacToeSymbol
  readonly moves: readonly TicTacToeMoveRecord<Analysis>[]
  /** A cached position; replaying moves is authoritative when restoring. */
  readonly position: TicTacToePosition
  readonly outcome: TicTacToeOutcome
}

export type TicTacToeViewState = {
  readonly location: { readonly mode: 'live' } | { readonly mode: 'review'; readonly ply: number }
  readonly pendingCell: TicTacToeMove | null
  readonly mobileHistoryOpen: boolean
  readonly resignationDialogOpen: boolean
}
