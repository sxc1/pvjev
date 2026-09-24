import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTicTacToeController } from '../../src/app/controller'
import type { ControllerDependencies, CpuChoice, TicTacToeController } from '../../src/contracts'
import { MATCH_STORAGE_KEY } from '../../src/contracts/persistence'
import { ticTacToeRules } from '../../src/games/tic-tac-toe/rules'

type Deferred = { resolve(value: unknown): void; reject(reason: unknown): void; signal: AbortSignal }

function harness(seed?: Map<string, string>) {
  const data = seed ?? new Map<string, string>()
  const requests: Deferred[] = []
  const calls: string[] = []
  let ids = 0
  const deps: ControllerDependencies = {
    rules: ticTacToeRules,
    cpu: { chooseMove: ({ signal }) => new Promise<CpuChoice<number>>((resolve, reject) => {
      requests.push({ resolve: value => resolve(value as CpuChoice<number>), reject, signal })
      calls.push('provider')
    }) },
    storage: () => ({
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => { calls.push('save'); data.set(key, value) },
      removeItem: key => { calls.push('remove'); data.delete(key) },
    }),
    scheduler: { now: () => Date.now(), setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: handle => clearTimeout(handle as number) },
    random: () => 0,
    newId: () => `id-${++ids}`,
  }
  const controller = createTicTacToeController(deps)
  controller.start()
  return { controller, requests, calls, data }
}

const flush = async () => { await Promise.resolve(); await Promise.resolve() }
const play = (controller: TicTacToeController, cell: number) => controller.dispatch({ type: 'activate-cell', cell })

describe('controller lifecycle and CPU coordination', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves before an O opening request and before every subsequent CPU request', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    expect(h.calls).toEqual(['save', 'provider'])
    expect(h.controller.getSnapshot().request.status).toBe('pending')
    h.requests[0].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    play(h.controller, 4)
    expect(h.calls.slice(-2)).toEqual(['save', 'provider'])
    h.controller.dispose()
  })

  it('reveals Retry exactly at five seconds without dispatching and supersedes stale responses', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    vi.advanceTimersByTime(4999)
    expect(h.controller.getSnapshot().request.status === 'pending' && h.controller.getSnapshot().request.retryAvailable).toBe(false)
    vi.advanceTimersByTime(1)
    expect(h.requests).toHaveLength(1)
    expect(h.controller.getSnapshot().request.status === 'pending' && h.controller.getSnapshot().request.retryAvailable).toBe(true)
    h.controller.dispatch({ type: 'retry-cpu' })
    expect(h.requests[0].signal.aborted).toBe(true)
    h.requests[0].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    h.requests[1].resolve({ move: 1 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves.map(move => move.cell)).toEqual([1])
    h.controller.dispose()
  })

  it('retries invalid choices twice, persists recovery count, and commits one legal fallback', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    for (let index = 0; index < 2; index++) {
      h.requests[index].resolve({ move: 20 })
      await flush()
      expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(index + 1)
      expect(JSON.parse(h.data.get(MATCH_STORAGE_KEY)!).recovery.consecutiveInvalid).toBe(index + 1)
    }
    h.requests[2].resolve({ move: NaN })
    await flush()
    expect(h.requests).toHaveLength(3)
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    expect(h.controller.getSnapshot().match?.moves[0].provenance).toBe('rng-fallback')
    expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(0)
    h.controller.dispose()
  })

  it('restores partial invalid count and begins one fresh attempt, including across repeated start', async () => {
    const first = harness()
    first.controller.dispatch({ type: 'select-side', symbol: 'O' })
    first.controller.dispatch({ type: 'start-game' })
    first.requests[0].resolve({})
    await flush()
    const data = first.data
    first.controller.dispose()
    const restored = harness(data)
    restored.controller.start()
    expect(restored.requests).toHaveLength(1)
    expect(restored.controller.getSnapshot().request.consecutiveInvalid).toBe(1)
    restored.requests[0].resolve({ move: 0 })
    await flush()
    expect(restored.controller.getSnapshot().request.consecutiveInvalid).toBe(0)
    restored.controller.dispose()
  })

  it('ignores old success after restart, and preserves a request through unsubscribe/remount', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    const original = h.controller.getSnapshot().match?.id
    let renders = 0
    const unsubscribe = h.controller.subscribe(() => { renders++ })
    unsubscribe()
    h.controller.dispatch({ type: 'restart' })
    expect(h.requests).toHaveLength(2)
    expect(h.controller.getSnapshot().match?.id).not.toBe(original)
    const subscribe = h.controller.subscribe(() => { renders++ })
    h.requests[0].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    h.requests[1].resolve({ move: 1 })
    await flush()
    expect(renders).toBeGreaterThan(0)
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    subscribe()
    h.controller.dispose()
  })

  it('keeps review selection while a CPU move commits, then returns to current', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    play(h.controller, 0)
    h.controller.dispatch({ type: 'select-history', ply: 1 })
    expect(h.controller.getSnapshot().view.mobileHistoryOpen).toBe(true)
    h.requests[0].resolve({ move: 1 })
    await flush()
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', ply: 1 })
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(2)
    expect(play(h.controller, 2).status).toBe('ignored')
    h.controller.dispatch({ type: 'return-to-current' })
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'live' })
    h.controller.dispose()
  })

  it('retries immediately after rejection without changing the invalid count', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    h.requests[0].resolve({ move: -1 })
    await flush()
    expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(1)
    h.requests[1].reject(new Error('service failed'))
    await flush()
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', retryAvailable: true, consecutiveInvalid: 1 })
    h.controller.dispatch({ type: 'retry-cpu' })
    h.requests[2].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(0)
    h.controller.dispose()
  })

  it('clears previews on setting change and prevents duplicate confirmation or play in review', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    h.controller.dispatch({ type: 'set-confirm-moves', enabled: true })
    play(h.controller, 0)
    expect(h.controller.getSnapshot().view.pendingCell).toBe(0)
    h.controller.dispatch({ type: 'set-confirm-moves', enabled: false })
    expect(h.controller.getSnapshot().view.pendingCell).toBeNull()
    h.controller.dispatch({ type: 'set-confirm-moves', enabled: true })
    play(h.controller, 1)
    h.controller.dispatch({ type: 'confirm-move' })
    expect(h.controller.dispatch({ type: 'confirm-move' }).status).toBe('ignored')
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    h.controller.dispatch({ type: 'select-history', ply: 1 })
    expect(play(h.controller, 2).status).toBe('ignored')
    h.controller.dispose()
  })

  it('resignation cancels CPU work and disposal ignores late callbacks', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    play(h.controller, 0)
    h.controller.dispatch({ type: 'open-resignation' })
    h.controller.dispatch({ type: 'confirm-resignation' })
    expect(h.requests[0].signal.aborted).toBe(true)
    expect(h.controller.getSnapshot().match?.outcome.kind).toBe('resignation')
    h.requests[0].resolve({ move: 1 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    h.controller.dispose()
    vi.runAllTimers()
  })

  it('completes and restores a full X win, then returns to setup on Rematch', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    play(h.controller, 0)
    h.requests[0].resolve({ move: 1 })
    await flush()
    play(h.controller, 3)
    h.requests[1].resolve({ move: 2 })
    await flush()
    play(h.controller, 6)
    expect(h.requests).toHaveLength(2)
    expect(h.controller.getSnapshot().match?.outcome).toMatchObject({ kind: 'win', winner: 'X' })
    const restored = harness(h.data)
    expect(restored.controller.getSnapshot().match?.moves).toHaveLength(5)
    expect(restored.requests).toHaveLength(0)
    restored.controller.dispatch({ type: 'rematch' })
    expect(restored.controller.getSnapshot().match).toBeNull()
    expect(restored.controller.getSnapshot().setupSymbol).toBe('X')
    expect(h.data.has(MATCH_STORAGE_KEY)).toBe(false)
    restored.controller.dispose()
    h.controller.dispose()
  })

  it('holds corrupt saved data until explicit Start fresh', () => {
    const data = new Map([[MATCH_STORAGE_KEY, '{bad json']])
    const h = harness(data)
    expect(h.controller.getSnapshot().notices.some(notice => notice.kind === 'invalid-match')).toBe(true)
    expect(h.controller.dispatch({ type: 'start-game' }).status).toBe('ignored')
    expect(data.get(MATCH_STORAGE_KEY)).toBe('{bad json')
    h.controller.dispatch({ type: 'start-fresh' })
    expect(data.has(MATCH_STORAGE_KEY)).toBe(false)
    expect(h.controller.getSnapshot().notices.some(notice => notice.kind === 'invalid-match')).toBe(false)
    h.controller.dispose()
  })

  it('does not invoke a superseded request after a synchronous subscriber restart', () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    let restarted = false
    const unsubscribe = h.controller.subscribe(() => {
      if (!restarted && h.controller.getSnapshot().request.status === 'pending') {
        restarted = true
        h.controller.dispatch({ type: 'restart' })
      }
    })
    h.controller.dispatch({ type: 'start-game' })
    expect(h.requests).toHaveLength(1)
    expect(h.controller.getSnapshot().match?.id).toBe('id-3')
    unsubscribe()
    h.controller.dispose()
  })
})
