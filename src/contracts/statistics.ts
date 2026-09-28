import type { MatchCompletedEvent } from './application'

export type StatisticsGameId = MatchCompletedEvent['gameId']

export interface GameTotals {
  readonly winRng: number
  readonly lossRng: number
  readonly drawRng: number
  readonly winJev: number
  readonly lossJev: number
  readonly drawJev: number
}

export interface GameStatistics extends GameTotals {
  readonly gameId: StatisticsGameId
  readonly lastMatchId: string | null
  readonly lastMatchCompletedAt: string | null
}

export interface StatisticsFailure {
  readonly kind: 'transport' | 'database' | 'authentication' | 'schema' | 'cancelled'
  readonly message: string
  readonly status: number | null
  readonly code: string | null
}

export type StatisticsResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: StatisticsFailure }

export interface StatisticsAdapter {
  loadTotals(userId: string, signal: AbortSignal): Promise<StatisticsResult<readonly GameStatistics[]>>
  recordCompletion(event: MatchCompletedEvent, signal: AbortSignal): Promise<StatisticsResult<GameStatistics>>
  reconcileCompletion(userId: string, event: MatchCompletedEvent, signal: AbortSignal): Promise<StatisticsResult<GameStatistics | null>>
}

export type StatisticsReadState = 'idle' | 'loading' | 'ready' | 'error'

export interface StatisticsSnapshot {
  readonly accountId: string | null
  readonly status: StatisticsReadState
  readonly rows: Readonly<Partial<Record<StatisticsGameId, GameStatistics>>>
  readonly error: string | null
  readonly notices: readonly ResultFailureNotice[]
}

export interface ResultFailureNotice {
  readonly id: string
  readonly message: 'Your result could not be saved.'
}

export interface StatisticsTiming {
  readonly timeoutMs: number
  readonly retryDelayMs: number
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown
  readonly clearTimeout: (handle: unknown) => void
}

export interface StatisticsStore {
  start(): void
  dispose(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): StatisticsSnapshot
  setAccount(accountId: string | null): void
  retryLoad(): void
  recordCompletion(accountId: string, event: MatchCompletedEvent): void
  dismissNotice(id: string): void
}
