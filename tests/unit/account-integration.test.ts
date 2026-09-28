import { describe, expect, it, vi } from 'vitest'
import { createAccountRuntime } from '../../src/app/account-runtime'
import { createStatisticsStore } from '../../src/app/statistics'
import { createTicTacToeController } from '../../src/app/controller'
import { createConnectFourController } from '../../src/app/connect-four-controller'
import { createSharedSettingsStore } from '../../src/app/settings'
import { ticTacToeRules } from '../../src/games/tic-tac-toe/rules'
import { connectFourRules } from '../../src/games/connect-four/rules'
import type { AuthSnapshot, AuthStore } from '../../src/contracts/account'
import type { GameStatistics, StatisticsAdapter } from '../../src/contracts/statistics'

const row = (gameId: GameStatistics['gameId'], matchId: string): GameStatistics => ({ gameId, winRng: 0, lossRng: 1, drawRng: 0, winJev: 0, lossJev: 0, drawJev: 0, lastMatchId: matchId, lastMatchCompletedAt: '2026-09-28T00:00:00Z' })
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

function setup() {
  let authSnapshot: AuthSnapshot = { status: 'signed-out', account: null, pending: null, error: null }
  const listeners = new Set<() => void>()
  const auth: AuthStore = { start() {}, dispose() {}, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) }, getSnapshot: () => authSnapshot, signIn: async () => {}, signOut: async () => {} }
  const signIn = () => { authSnapshot = { status: 'signed-in', account: { id: 'user-1', email: null, name: null }, pending: null, error: null }; listeners.forEach(listener => listener()) }
  const storageData = new Map<string, string>()
  const storage = () => ({ getItem: (key: string) => storageData.get(key) ?? null, setItem: (key: string, value: string) => { storageData.set(key, value) }, removeItem: (key: string) => { storageData.delete(key) } })
  const recordCompletion = vi.fn(async (event: { gameId: GameStatistics['gameId']; matchId: string }) => ({ ok: true as const, data: row(event.gameId, event.matchId) }))
  const adapter: StatisticsAdapter = { loadTotals: async () => ({ ok: true, data: [] }), recordCompletion, reconcileCompletion: async () => ({ ok: true, data: null }) }
  const stats = createStatisticsStore(adapter)
  stats.start()
  const runtime = createAccountRuntime(auth, stats)
  const settings = createSharedSettingsStore(storage)
  const common = { storage, scheduler: { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} }, random: () => 0, newId: () => crypto.randomUUID(), settings, cpu: { chooseMove: () => new Promise<never>(() => {}) }, onMatchCompleted: runtime.onMatchCompleted }
  const ttt = createTicTacToeController({ ...common, rules: ticTacToeRules })
  const cf = createConnectFourController({ ...common, rules: connectFourRules })
  ttt.start(); cf.start()
  return { signIn, stats, runtime, ttt, cf, recordCompletion, storageData, listenerCount: () => listeners.size }
}

describe('account completion integration', () => {
  it('records guest-started matches completed after sign-in in both games', async () => {
    const h = setup()
    h.ttt.dispatch({ type: 'start-game' })
    h.cf.dispatch({ type: 'start-game' })
    h.ttt.dispatch({ type: 'activate-cell', cell: 0 })
    h.cf.dispatch({ type: 'select-column', column: 0 })
    h.signIn()
    await flush()
    h.ttt.dispatch({ type: 'open-resignation' }); h.ttt.dispatch({ type: 'confirm-resignation' })
    h.cf.dispatch({ type: 'open-resignation' }); h.cf.dispatch({ type: 'confirm-resignation' })
    await flush()
    expect(h.recordCompletion).toHaveBeenCalledTimes(2)
    expect(h.recordCompletion.mock.calls.map(call => call[0].gameId).sort()).toEqual(['connect-four', 'tic-tac-toe'])
    expect(h.stats.getSnapshot().rows['tic-tac-toe']?.lossRng).toBe(1)
    expect(h.stats.getSnapshot().rows['connect-four']?.lossRng).toBe(1)
    expect(h.storageData.size).toBeGreaterThan(0)
    h.runtime.dispose(); h.stats.dispose(); h.ttt.dispose(); h.cf.dispose()
  })
  it('does not record signed-out completions', async () => {
    const h = setup()
    h.ttt.dispatch({ type: 'start-game' }); h.ttt.dispatch({ type: 'activate-cell', cell: 0 })
    h.ttt.dispatch({ type: 'open-resignation' }); h.ttt.dispatch({ type: 'confirm-resignation' })
    await flush()
    expect(h.recordCompletion).not.toHaveBeenCalled()
    h.runtime.dispose(); h.stats.dispose(); h.ttt.dispose(); h.cf.dispose()
  })
  it('keeps one account listener across game use and removes it on disposal', async () => {
    const h = setup()
    expect(h.listenerCount()).toBe(1)
    h.signIn(); await flush()
    h.ttt.dispatch({ type: 'start-game' })
    h.cf.dispatch({ type: 'start-game' })
    expect(h.stats.getSnapshot().accountId).toBe('user-1')
    h.runtime.dispose()
    h.runtime.dispose()
    expect(h.listenerCount()).toBe(0)
    h.stats.dispose(); h.ttt.dispose(); h.cf.dispose()
  })
})
