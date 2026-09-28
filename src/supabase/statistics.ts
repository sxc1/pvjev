import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchCompletedEvent } from '../contracts/application'
import type { GameStatistics, StatisticsAdapter, StatisticsFailure, StatisticsResult } from '../contracts/statistics'
import type { Database } from './database.types'

const columns = 'game_id,rng_wins,rng_losses,rng_draws,jev_wins,jev_losses,jev_draws,last_match_id,last_match_completed_at'

type RawRow = Record<string, unknown>

function mapRow(value: unknown): StatisticsResult<GameStatistics> {
  if (!value || typeof value !== 'object') return schemaError()
  const row = value as RawRow
  if (row.game_id !== 'tic-tac-toe' && row.game_id !== 'connect-four') return schemaError()
  const numbers = ['rng_wins', 'rng_losses', 'rng_draws', 'jev_wins', 'jev_losses', 'jev_draws'] as const
  if (numbers.some((key) => !Number.isSafeInteger(row[key]) || (row[key] as number) < 0)) return schemaError()
  if (row.last_match_id !== null && typeof row.last_match_id !== 'string') return schemaError()
  if (row.last_match_completed_at !== null && typeof row.last_match_completed_at !== 'string') return schemaError()
  return { ok: true, data: {
    gameId: row.game_id, winRng: row.rng_wins as number, lossRng: row.rng_losses as number,
    drawRng: row.rng_draws as number, winJev: row.jev_wins as number,
    lossJev: row.jev_losses as number, drawJev: row.jev_draws as number,
    lastMatchId: row.last_match_id as string | null,
    lastMatchCompletedAt: row.last_match_completed_at as string | null,
  } }
}

function schemaError<T>(): StatisticsResult<T> {
  return { ok: false, error: { kind: 'schema', message: 'Invalid statistics response', status: null, code: null } }
}

export function classifyStatisticsFailure(error: { message?: string; code?: string; details?: string } | null, status: number, signal: AbortSignal): StatisticsFailure {
  const message = error?.message || 'Statistics request failed'
  const code = error?.code || null
  const structured = Boolean(code || error?.details)
  const kind = signal.aborted && signal.reason !== 'timeout' ? 'cancelled' :
    structured ? 'database' : signal.reason === 'timeout' ? 'transport' :
      status === 401 || status === 403 ? 'authentication' :
        status === 0 || [502, 503, 504].includes(status) ? 'transport' : 'database'
  return { kind, message, status: status || null, code }
}

export function createStatisticsAdapter(client: SupabaseClient<Database>): StatisticsAdapter {
  return {
    async loadTotals(userId, signal) {
      const response = await client.from('game_stats').select(columns).eq('user_id', userId).abortSignal(signal).retry(false)
      if (response.error) return { ok: false, error: classifyStatisticsFailure(response.error, response.status, signal) }
      if (!Array.isArray(response.data)) return schemaError()
      const rows: GameStatistics[] = []
      for (const value of response.data) {
        const mapped = mapRow(value)
        if (!mapped.ok) return mapped
        rows.push(mapped.data)
      }
      return { ok: true, data: rows }
    },
    async recordCompletion(event: MatchCompletedEvent, signal) {
      const response = await client.rpc('record_game_result', {
        p_game_id: event.gameId, p_opponent: event.opponent, p_result: event.result, p_match_id: event.matchId,
      }).abortSignal(signal).retry(false).single()
      if (response.error) return { ok: false, error: classifyStatisticsFailure(response.error, response.status, signal) }
      return mapRow(response.data)
    },
    async reconcileCompletion(userId, event, signal) {
      const response = await client.from('game_stats').select(columns).eq('user_id', userId).eq('game_id', event.gameId).abortSignal(signal).retry(false).maybeSingle()
      if (response.error) return { ok: false, error: classifyStatisticsFailure(response.error, response.status, signal) }
      if (response.data === null) return { ok: true, data: null }
      return mapRow(response.data)
    },
  }
}
