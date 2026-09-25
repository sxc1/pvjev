import type { GameId } from './game'

/** Top-origin row-major index, A6=0 through G1=41. Runtime input needs validation. */
export type ConnectFourCell = number
/** Column A=0 through G=6. Runtime input needs finite-integer validation. */
export type ConnectFourMove = number
export type ConnectFourPlayer = 'one' | 'two'
export type ConnectFourColor = 'red' | 'yellow'
export type ConnectFourHumanOrder = 'first' | 'second'

export interface ConnectFourSetup {
  readonly humanColor: ConnectFourColor
  readonly humanOrder: ConnectFourHumanOrder
}

/** Each line is a complete maximal run in stable ascending cell order. */
export type ConnectFourWinningLine = readonly ConnectFourCell[]
export type ConnectFourBoardOutcome =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'win'; readonly winner: ConnectFourPlayer; readonly winningLines: readonly ConnectFourWinningLine[] }
  | { readonly kind: 'draw' }

export type ConnectFourOutcome = ConnectFourBoardOutcome |
  { readonly kind: 'resignation'; readonly resigningPlayer: ConnectFourPlayer; readonly winner: ConnectFourPlayer; readonly ply: number }

export interface ConnectFourPosition {
  /** Exactly 42 cells; values are 0, 1, or 2. Replay is authoritative. */
  readonly board: readonly (0 | 1 | 2)[]
  readonly columns: readonly ConnectFourMove[]
  /** Sequence parity, including after a terminal board. */
  readonly nextPlayer: ConnectFourPlayer
  readonly outcome: ConnectFourBoardOutcome
  readonly winningLines: readonly ConnectFourWinningLine[]
}

export type ConnectFourMoveRecord<Analysis = never> = {
  readonly ply: number
  readonly column: ConnectFourMove
  readonly landingCell: ConnectFourCell
  readonly player: ConnectFourPlayer
  readonly color: ConnectFourColor
} & (
  | { readonly actor: 'human'; readonly provenance: 'human'; readonly analysis?: never; readonly diagnostic?: never }
  | { readonly actor: 'cpu'; readonly provenance: 'rng'; readonly analysis?: never; readonly diagnostic?: never }
  | { readonly actor: 'cpu'; readonly provenance: 'rng-fallback'; readonly analysis?: never; readonly diagnostic: string }
  | { readonly actor: 'cpu'; readonly provenance: 'jev'; readonly analysis: Analysis; readonly diagnostic?: never }
)

export interface ConnectFourMatch<Analysis = never> {
  readonly gameId: Extract<GameId, 'connect-four'>
  readonly id: string
  readonly setup: ConnectFourSetup
  readonly moves: readonly ConnectFourMoveRecord<Analysis>[]
  /** Cached live position; decoder must replay records before trusting it. */
  readonly position: ConnectFourPosition
  readonly outcome: ConnectFourOutcome
}

export interface ConnectFourViewState {
  readonly location: { readonly mode: 'live' } | { readonly mode: 'review'; readonly selectedPly: number | null }
  readonly pendingColumn: ConnectFourMove | null
  readonly mobileHistoryOpen: boolean
  readonly resignationDialogOpen: boolean
}
