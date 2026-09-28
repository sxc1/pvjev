import { describe, expect, it, vi } from 'vitest'
import type { MatchCompletedEvent } from '../contracts/application'
import type { GameStatistics, StatisticsAdapter, StatisticsFailure, StatisticsResult } from '../contracts/statistics'
import { createStatisticsStore } from './statistics'

const event: MatchCompletedEvent = { gameId: 'tic-tac-toe', matchId: 'match-1', opponent: 'rng', result: 'win' }
const row: GameStatistics = { gameId: 'tic-tac-toe', winRng: 1, lossRng: 0, drawRng: 0, winJev: 0, lossJev: 0, drawJev: 0, lastMatchId: 'match-1', lastMatchCompletedAt: '2026-09-28T00:00:00Z' }
const fail = (kind: StatisticsFailure['kind'], message = 'failed'): StatisticsResult<GameStatistics> => ({ ok: false, error: { kind, message, status: kind === 'transport' ? null : 400, code: null } })
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const make = (responses: StatisticsResult<GameStatistics>[]) => {
  const recordCompletion = vi.fn(async (_event: MatchCompletedEvent, _signal: AbortSignal) => responses.shift() || fail('database'))
  const reconcileCompletion = vi.fn(async () => ({ ok: true as const, data: row }))
  const adapter: StatisticsAdapter = { loadTotals: async () => ({ ok: true, data: [] }), recordCompletion, reconcileCompletion }
  const store = createStatisticsStore(adapter, { timeoutMs: 10_000, retryDelayMs: 0, setTimeout: (callback, ms) => ms === 0 ? queueMicrotask(callback) : setTimeout(callback, ms), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) })
  store.start(); store.setAccount('account-1')
  return { store, recordCompletion, reconcileCompletion }
}

describe('statistics writes', () => {
  it('deduplicates delivery and applies one successful RPC', async () => {
    const { store, recordCompletion } = make([{ ok: true, data: row }])
    store.recordCompletion('account-1', event)
    store.recordCompletion('account-1', event)
    await flush()
    expect(recordCompletion).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().rows['tic-tac-toe']?.winRng).toBe(1)
    expect(store.getSnapshot().notices).toHaveLength(0)
  })
  it('does not retry a direct database rejection or show a notice', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store, recordCompletion } = make([fail('database', 'Result already recorded or submitted too soon')])
    store.recordCompletion('account-1', event); await flush()
    expect(recordCompletion).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().notices).toHaveLength(0)
    expect(spy).toHaveBeenCalledWith('Statistics request failed:', expect.objectContaining({ message: 'Result already recorded or submitted too soon' }))
    spy.mockRestore()
  })
  it('retries transport once with the same event and reconciles duplicate response', async () => {
    const { store, recordCompletion, reconcileCompletion } = make([fail('transport'), fail('database', 'Result already recorded or submitted too soon')])
    store.recordCompletion('account-1', event); await flush()
    expect(recordCompletion).toHaveBeenCalledTimes(2)
    expect(recordCompletion.mock.calls[0]?.[0]).toEqual(recordCompletion.mock.calls[1]?.[0])
    expect(reconcileCompletion).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(store.getSnapshot().rows['tic-tac-toe']?.lastMatchId).toBe('match-1'))
    expect(store.getSnapshot().notices).toHaveLength(0)
  })
  it('keeps totals and shows one notice for an unconfirmed retry', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store, recordCompletion } = make([fail('transport'), fail('transport')])
    store.recordCompletion('account-1', event); await flush()
    expect(recordCompletion).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().rows['tic-tac-toe']?.winRng).toBe(0)
    expect(store.getSnapshot().notices).toEqual([{ id: 'account-1:tic-tac-toe:match-1', message: 'Your result could not be saved.' }])
    spy.mockRestore()
  })
})

describe('statistics reads and ordering', () => {
  it('keeps a successful write above an older pending read', async () => {
    let resolveRead!: (value: StatisticsResult<readonly GameStatistics[]>) => void
    const adapter: StatisticsAdapter = {
      loadTotals: () => new Promise((resolve) => { resolveRead = resolve }),
      recordCompletion: async () => ({ ok: true, data: row }),
      reconcileCompletion: async () => ({ ok: true, data: row }),
    }
    const store = createStatisticsStore(adapter)
    store.start(); store.setAccount('account-1'); store.recordCompletion('account-1', event)
    await flush()
    resolveRead({ ok: true, data: [] }); await flush()
    expect(store.getSnapshot().rows['tic-tac-toe']?.winRng).toBe(1)
    expect(store.getSnapshot().rows['connect-four']?.winRng).toBe(0)
  })
  it('ignores a superseded account read and clears rows on sign-out', async () => {
    let resolveRead!: (value: StatisticsResult<readonly GameStatistics[]>) => void
    const adapter: StatisticsAdapter = {
      loadTotals: () => new Promise((resolve) => { resolveRead = resolve }),
      recordCompletion: async () => ({ ok: true, data: row }),
      reconcileCompletion: async () => ({ ok: true, data: row }),
    }
    const store = createStatisticsStore(adapter)
    store.start(); store.setAccount('account-1'); store.setAccount(null)
    resolveRead({ ok: true, data: [row] }); await flush()
    expect(store.getSnapshot()).toMatchObject({ accountId: null, status: 'idle', rows: {} })
  })
})
