import type { MatchCompletedEvent } from '../contracts/application'
import type { GameStatistics, StatisticsAdapter, StatisticsGameId, StatisticsSnapshot, StatisticsStore, StatisticsTiming } from '../contracts/statistics'

const games: readonly StatisticsGameId[] = ['tic-tac-toe', 'connect-four']
const zero = (gameId: StatisticsGameId): GameStatistics => ({ gameId, winRng: 0, lossRng: 0, drawRng: 0, winJev: 0, lossJev: 0, drawJev: 0, lastMatchId: null, lastMatchCompletedAt: null })
const defaults: StatisticsTiming = { timeoutMs: 10_000, retryDelayMs: 250, setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }

export function createStatisticsStore(adapter: StatisticsAdapter, timing: StatisticsTiming = defaults): StatisticsStore {
  let snapshot: StatisticsSnapshot = { accountId: null, status: 'idle', rows: {}, error: null, notices: [] }
  let started = false
  let disposed = false
  let generation = 0
  const listeners = new Set<() => void>()
  const controllers = new Set<AbortController>()
  const seen = new Set<string>()
  const tails = new Map<string, Promise<void>>()
  const revisions = new Map<StatisticsGameId, number>()
  const publish = (next: StatisticsSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()) }
  const log = (error: unknown) => console.error('Statistics request failed:', error)
  const timed = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController()
    controllers.add(controller)
    const timer = timing.setTimeout(() => controller.abort('timeout'), timing.timeoutMs)
    try { return await operation(controller.signal) }
    finally { timing.clearTimeout(timer); controllers.delete(controller) }
  }
  const delay = () => new Promise<void>((resolve) => { timing.setTimeout(resolve, timing.retryDelayMs) })
  const notice = (id: string) => {
    if (snapshot.notices.some((item) => item.id === id) || disposed) return
    publish({ ...snapshot, notices: [...snapshot.notices, { id, message: 'Your result could not be saved.' }] })
  }
  const load = async () => {
    const accountId = snapshot.accountId
    if (!accountId || disposed) return
    const current = ++generation
    const before = new Map(revisions)
    publish({ ...snapshot, status: 'loading', error: null })
    try {
      const result = await timed((signal) => adapter.loadTotals(accountId, signal))
      if (disposed || current !== generation || snapshot.accountId !== accountId) return
      if (!result.ok) {
        if (result.error.kind !== 'cancelled') { log(result.error); publish({ ...snapshot, status: 'error', error: 'Your stats could not be loaded.' }) }
        return
      }
      const rows = { ...snapshot.rows }
      for (const gameId of games) {
        if ((revisions.get(gameId) || 0) !== (before.get(gameId) || 0)) continue
        rows[gameId] = result.data.find((row) => row.gameId === gameId) || zero(gameId)
      }
      publish({ ...snapshot, status: 'ready', rows, error: null })
    } catch (error) {
      if (!disposed && current === generation) { log(error); publish({ ...snapshot, status: 'error', error: 'Your stats could not be loaded.' }) }
    }
  }
  const write = async (accountId: string, event: MatchCompletedEvent, id: string) => {
    if (disposed) return
    const apply = (row: GameStatistics) => {
      if (disposed || snapshot.accountId !== accountId) return
      revisions.set(event.gameId, (revisions.get(event.gameId) || 0) + 1)
      publish({ ...snapshot, rows: { ...snapshot.rows, [event.gameId]: row } })
    }
    try {
      const first = await timed((signal) => adapter.recordCompletion(event, signal))
      if (disposed) return
      if (first.ok) { apply(first.data); return }
      if (first.error.kind === 'cancelled') return
      if (first.error.kind !== 'transport') {
        log(first.error)
        if (first.error.kind === 'schema') notice(id)
        return
      }
      await delay()
      if (disposed) return
      const second = await timed((signal) => adapter.recordCompletion(event, signal))
      if (disposed) return
      if (second.ok) { apply(second.data); return }
      if (second.error.kind === 'cancelled') return
      if (second.error.message.includes('Result already recorded or submitted too soon')) {
        const reconciled = await timed((signal) => adapter.reconcileCompletion(accountId, event, signal))
        if (disposed) return
        if (reconciled.ok && reconciled.data?.lastMatchId === event.matchId) { apply(reconciled.data); return }
        if (!reconciled.ok && reconciled.error.kind === 'cancelled') return
        log(reconciled.ok ? 'Result reconciliation did not match' : reconciled.error)
      } else log(second.error)
      notice(id)
    } catch (error) {
      if (!disposed) { log(error); notice(id) }
    }
  }
  return {
    start() { if (!disposed) started = true },
    dispose() { if (disposed) return; disposed = true; generation++; controllers.forEach((controller) => controller.abort('dispose')); controllers.clear(); listeners.clear() },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot() { return snapshot },
    setAccount(accountId) {
      if (disposed || snapshot.accountId === accountId) return
      generation++
      revisions.clear()
      publish({ accountId, status: accountId ? 'loading' : 'idle', rows: {}, error: null, notices: [] })
      if (accountId && started) void load()
    },
    retryLoad() { if (started) void load() },
    recordCompletion(accountId, event) {
      if (disposed || !started || snapshot.accountId !== accountId) return
      const id = `${accountId}:${event.gameId}:${event.matchId}`
      if (seen.has(id)) return
      seen.add(id)
      const key = `${accountId}:${event.gameId}`
      const previous = tails.get(key) || Promise.resolve()
      const next = previous.catch(() => {}).then(() => write(accountId, event, id))
      tails.set(key, next)
      void next.finally(() => { if (tails.get(key) === next) tails.delete(key) })
    },
    dismissNotice(id) { publish({ ...snapshot, notices: snapshot.notices.filter((item) => item.id !== id) }) },
  }
}
