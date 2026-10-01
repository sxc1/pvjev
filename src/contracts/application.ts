import type { CpuProvider, GameId, RulesAdapter } from './game'
import type { TicTacToeMatch, TicTacToeMove, TicTacToePosition, TicTacToeSymbol, TicTacToeViewState } from './tic-tac-toe'
import type { ConnectFourColor, ConnectFourHumanOrder, ConnectFourMatch, ConnectFourMove, ConnectFourPosition, ConnectFourSetup, ConnectFourViewState } from './connect-four'
import type { JevProvider } from './jev'

/** A terminal transition from the human player's perspective. */
export interface MatchCompletedEvent {
  readonly gameId: 'tic-tac-toe' | 'connect-four'
  readonly matchId: string
  readonly opponent: 'rng' | 'jev'
  readonly result: 'win' | 'loss' | 'draw'
}

export interface RequestToken {
  readonly gameId: GameId
  readonly matchId: string
  /** The next individual move number, not the X/O pair number. */
  readonly expectedPly: number
  readonly attemptId: string
}

export type RequestState =
  | { readonly status: 'idle' | 'waiting-for-key'; readonly disposition?: 'ready' | 'manual-retry-required'; readonly retryAvailable?: false; readonly consecutiveInvalid: number; readonly consecutiveServiceFailures: number }
  | { readonly status: 'pending'; readonly disposition?: 'ready'; readonly token: RequestToken; readonly startedAt: number; readonly retryAvailable: boolean; readonly consecutiveInvalid: number; readonly consecutiveServiceFailures: number }
  | { readonly status: 'failed'; readonly disposition?: 'manual-retry-required'; readonly token: RequestToken; readonly error: string; readonly retryAvailable: true; readonly consecutiveInvalid: number; readonly consecutiveServiceFailures: number }

export interface VisitorKeySource {
  getKey(): string | null
  getRevision(): number
  subscribe(listener: () => void): () => void
}

export interface Settings { readonly confirmMoves: boolean }

/** One store owns the settings key and notifies both controllers. */
export interface SharedSettingsStore {
  readonly getSnapshot: () => Settings
  readonly subscribe: (listener: () => void) => () => void
  setConfirmMoves(enabled: boolean): void
}

export interface ApplicationHost {
  readonly getSelectedGame: () => GameId
  readonly subscribe: (listener: () => void) => () => void
  readonly settings: SharedSettingsStore
  readonly ticTacToe: TicTacToeController
  readonly connectFour: ConnectFourController
  selectGame(gameId: GameId): void
  start(): void
  dispose(): void
}

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
  | { readonly type: 'clear-transient' }

export interface ConnectFourSnapshot {
  readonly setup: ConnectFourSetup
  readonly match: ConnectFourMatch | null
  readonly view: ConnectFourViewState
  readonly request: RequestState
  readonly settings: Settings
  readonly notices: readonly StorageNotice[]
}

export type ConnectFourCommand =
  | { readonly type: 'select-color'; readonly color: ConnectFourColor }
  | { readonly type: 'select-order'; readonly order: ConnectFourHumanOrder }
  | { readonly type: 'start-game' }
  | { readonly type: 'restart' }
  | { readonly type: 'open-resignation' }
  | { readonly type: 'cancel-resignation' }
  | { readonly type: 'confirm-resignation' }
  | { readonly type: 'rematch' }
  | { readonly type: 'select-column'; readonly column: ConnectFourMove }
  | { readonly type: 'confirm-move' }
  | { readonly type: 'toggle-review' }
  | { readonly type: 'select-piece'; readonly cell: number }
  | { readonly type: 'select-history'; readonly ply: number }
  | { readonly type: 'navigate-history'; readonly direction: 'back' | 'forward' }
  | { readonly type: 'return-to-current' }
  | { readonly type: 'set-mobile-history-open'; readonly open: boolean }
  | { readonly type: 'retry-cpu' }
  | { readonly type: 'start-fresh' }
  | { readonly type: 'clear-transient' }

export interface ConnectFourController {
  readonly getSnapshot: () => ConnectFourSnapshot
  readonly subscribe: (listener: () => void) => () => void
  dispatch(command: ConnectFourCommand): CommandResult
  start(): void
  dispose(): void
}

export interface ConnectFourControllerDependencies {
  readonly rules: RulesAdapter<ConnectFourPosition, ConnectFourMove, 'one' | 'two'>
  readonly cpu: CpuProvider<ConnectFourPosition, ConnectFourMove>
  readonly jev?: JevProvider<ConnectFourPosition, ConnectFourMove, 'one' | 'two'>
  readonly visitorKey?: VisitorKeySource
  readonly storage: () => KeyValueStorage
  readonly scheduler: Scheduler
  readonly random: () => number
  readonly newId: () => string
  readonly settings: SharedSettingsStore
  readonly onMatchCompleted?: (event: MatchCompletedEvent) => void
}

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
  readonly jev?: JevProvider<TicTacToePosition, TicTacToeMove, TicTacToeSymbol>
  readonly visitorKey?: VisitorKeySource
  /** Acquisition is injectable because browser storage access itself can throw. */
  readonly storage: () => KeyValueStorage
  readonly scheduler: Scheduler
  readonly random: () => number
  readonly newId: () => string
  readonly settings?: SharedSettingsStore
  readonly onMatchCompleted?: (event: MatchCompletedEvent) => void
}
