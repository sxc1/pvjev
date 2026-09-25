import type { Settings } from './application'
import type { TicTacToeMatch } from './tic-tac-toe'
import type { ConnectFourMatch } from './connect-four'

export const MATCH_STORAGE_KEY = 'pvjev:v0.5:match:tic-tac-toe'
export const SETTINGS_STORAGE_KEY = 'pvjev:v0.5:settings'
export const SCHEMA_VERSION = 1 as const
export const CONNECT_FOUR_MATCH_STORAGE_KEY = 'pvjev:match:connect-four'
export const CONNECT_FOUR_SCHEMA_VERSION = 1 as const

export interface ConnectFourMatchEnvelope {
  readonly schemaVersion: typeof CONNECT_FOUR_SCHEMA_VERSION
  readonly match: ConnectFourMatch
  /** Only 0–2 can be stored between automatic invalid-response retries. */
  readonly recovery: { readonly consecutiveInvalid: number }
}

export interface MatchEnvelope {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly match: TicTacToeMatch
  /** Only 0–2 can be stored between automatic invalid-response retries. */
  readonly recovery: { readonly consecutiveInvalid: number }
}

export interface SettingsEnvelope {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly settings: Settings
}

export type StorageReadResult<Value> =
  | { readonly status: 'missing' }
  | { readonly status: 'valid'; readonly value: Value }
  | { readonly status: 'invalid'; readonly reason: string }
  | { readonly status: 'unavailable'; readonly error: string }

export type StorageWriteResult =
  | { readonly status: 'saved' }
  | { readonly status: 'unavailable'; readonly error: string }
