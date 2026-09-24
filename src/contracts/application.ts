import type { CpuProvider, GameId, RulesAdapter } from './game'
import type { TicTacToeMatch, TicTacToeMove, TicTacToePosition, TicTacToeSymbol, TicTacToeViewState } from './tic-tac-toe'

export interface RequestToken {
  readonly gameId: GameId
  readonly matchId: string
  /** The next individual move number, not the X/O pair number. */
  readonly expectedPly: number
  readonly attemptId: string
}

export type RequestState =
  | { readonly status: 'idle'; readonly consecutiveInvalid: number }
  | { readonly status: 'pending'; readonly token: RequestToken; readonly startedAt: number; readonly retryAvailable: boolean; readonly consecutiveInvalid: number }
  | { readonly status: 'failed'; readonly token: RequestToken; readonly error: string; readonly retryAvailable: true; readonly consecutiveInvalid: number }

export interface Settings { readonly confirmMoves: boolean }

export type StorageNotice =
  | { readonly kind: 'unavailable'; readonly message: string }
  | { readonly kind: 'invalid-match'; readonly message: string }
  | { readonly kind: 'invalid-settings'; readonly message: string }

export interface TicTacToeSnapshot {
  readonly selectedGame: GameId
  readonly setupSymbol: TicTacToeSymbol
  readonly match: TicTacToeMatch | null
  readonly view: TicTacToeViewState
  readonly request: RequestState
  readonly settings: Settings
  readonly notices: readonly StorageNotice[]
}

export type TicTacToeCommand =
  | { readonly type: 'select-side'; readonly symbol: TicTacToeSymbol }
  | { readonly type: 'start-game' }
  | { readonly type: 'restart' }
  | { readonly type: 'open-resignation' }
  | { readonly type: 'cancel-resignation' }
  | { readonly type: 'confirm-resignation' }
  | { readonly type: 'rematch' }
  | { readonly type: 'activate-cell'; readonly cell: TicTacToeMove }
  | { readonly type: 'confirm-move' }
  | { readonly type: 'select-history'; readonly ply: number }
  | { readonly type: 'navigate-history'; readonly direction: 'back' | 'forward' }
  | { readonly type: 'return-to-current' }
  | { readonly type: 'set-confirm-moves'; readonly enabled: boolean }
  | { readonly type: 'set-mobile-history-open'; readonly open: boolean }
  | { readonly type: 'retry-cpu' }
  | { readonly type: 'start-fresh' }

export type CommandResult =
  | { readonly status: 'applied' }
  | { readonly status: 'ignored'; readonly reason: 'illegal' | 'stale' | 'not-ready' }

export interface TicTacToeController {
  readonly getSnapshot: () => TicTacToeSnapshot
  readonly subscribe: (listener: () => void) => () => void
  dispatch(command: TicTacToeCommand): CommandResult
  start(): void
  dispose(): void
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Scheduler {
  now(): number
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

export interface ControllerDependencies {
  readonly rules: RulesAdapter<TicTacToePosition, TicTacToeMove, TicTacToeSymbol>
  readonly cpu: CpuProvider<TicTacToePosition, TicTacToeMove>
  /** Acquisition is injectable because browser storage access itself can throw. */
  readonly storage: () => KeyValueStorage
  readonly scheduler: Scheduler
  readonly random: () => number
  readonly newId: () => string
}
