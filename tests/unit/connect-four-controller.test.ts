import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectFourControllerDependencies, CpuChoice, Settings, SharedSettingsStore } from '../../src/contracts'
import { CONNECT_FOUR_MATCH_STORAGE_KEY } from '../../src/contracts/persistence'
import { createConnectFourController } from '../../src/app/connect-four-controller'
import { connectFourRules } from '../../src/games/connect-four/rules'
import { emptySnapshot, transition } from '../../src/app/connect-four-transitions'

type Deferred = { resolve(value: unknown): void; reject(reason: unknown): void; signal: AbortSignal }
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

function harness(seed = new Map<string, string>(), providerMode?: 'throw') {
  const requests: Deferred[] = [], calls: string[] = []
  let ids = 0, settings: Settings = { confirmMoves: false }
  const listeners = new Set<() => void>()
  const settingsStore: SharedSettingsStore = {
    getSnapshot: () => settings,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    setConfirmMoves: enabled => { settings = { confirmMoves: enabled }; for (const listener of listeners) listener() },
  }
  const deps: ConnectFourControllerDependencies = {
    rules: connectFourRules,
    cpu: { chooseMove: ({ signal }) => {
      if (providerMode === 'throw') throw new Error('synchronous outage')
      return new Promise<CpuChoice<number>>((resolve, reject) => {
      requests.push({ resolve: value => resolve(value as CpuChoice<number>), reject, signal }); calls.push('provider')
      })
    } },
    storage: () => ({
      getItem: key => seed.get(key) ?? null,
      setItem: (key, value) => { calls.push('save'); seed.set(key, value) },
      removeItem: key => { calls.push('remove'); seed.delete(key) },
    }),
    scheduler: { now: () => Date.now(), setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: handle => clearTimeout(handle as number) },
    random: () => 0,
    newId: () => `cf-${++ids}`,
    settings: settingsStore,
  }
  const controller = createConnectFourController(deps)
  controller.start()
  return { controller, requests, calls, seed, settingsStore }
}

describe('C5 Connect Four controller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves before CPU requests, handles either opener, and restores one pending turn', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-color', color: 'yellow' })
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    expect(h.calls).toEqual(['save', 'provider'])
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    const saved = h.seed.get(CONNECT_FOUR_MATCH_STORAGE_KEY)!
    expect(saved).toContain('"humanOrder":"second"')
    const restored = harness(new Map([[CONNECT_FOUR_MATCH_STORAGE_KEY, saved]]))
    restored.controller.start()
    expect(restored.requests).toHaveLength(1)
    restored.requests[0].resolve({ move: 0 })
    await flush()
    expect(restored.controller.getSnapshot().match?.moves[0]).toMatchObject({ player: 'one', color: 'red', actor: 'cpu', landingCell: 35 })
    h.controller.dispose(); restored.controller.dispose()
  })

  it('reveals Retry at five seconds and ignores a superseded answer', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    vi.advanceTimersByTime(4999)
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'pending', retryAvailable: false })
    vi.advanceTimersByTime(1)
    expect(h.requests).toHaveLength(1)
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'pending', retryAvailable: true })
    h.controller.dispatch({ type: 'retry-cpu' })
    expect(h.requests[0].signal.aborted).toBe(true)
    h.requests[0].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    h.requests[1].resolve({ move: 1 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves[0].column).toBe(1)
    h.controller.dispose()
  })

  it('persists invalid counts and falls back after the third invalid response', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    for (let index = 0; index < 2; index++) {
      h.requests[index].resolve({ move: 7 })
      await flush()
      expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(index + 1)
      expect(JSON.parse(h.seed.get(CONNECT_FOUR_MATCH_STORAGE_KEY)!).recovery.consecutiveInvalid).toBe(index + 1)
    }
    h.requests[2].resolve({ move: NaN })
    await flush()
    expect(h.controller.getSnapshot().match?.moves[0]).toMatchObject({ column: 0, provenance: 'rng-fallback' })
    expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(0)
    h.controller.dispose()
  })

  it('preserves review and empty review across CPU completion, and gates confirmation', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    h.controller.dispatch({ type: 'toggle-review' })
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', selectedPly: null })
    h.requests[0].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', selectedPly: null })
    expect(h.controller.dispatch({ type: 'select-column', column: 1 }).status).toBe('ignored')
    h.controller.dispatch({ type: 'navigate-history', direction: 'forward' })
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', selectedPly: 1 })
    h.controller.dispatch({ type: 'return-to-current' })
    h.settingsStore.setConfirmMoves(true)
    h.controller.dispatch({ type: 'select-column', column: 1 })
    expect(h.controller.getSnapshot().view.pendingColumn).toBe(1)
    h.controller.dispatch({ type: 'clear-transient' })
    expect(h.controller.getSnapshot().view.pendingColumn).toBeNull()
    h.controller.dispatch({ type: 'select-column', column: 1 })
    h.controller.dispatch({ type: 'confirm-move' })
    expect(h.controller.dispatch({ type: 'confirm-move' }).status).toBe('ignored')
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(2)
    h.controller.dispose()
  })

  it('handles resignation, restart, rematch, and stale responses after replacement/disposal', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    const firstId = h.controller.getSnapshot().match!.id
    h.controller.dispatch({ type: 'restart' })
    expect(h.controller.getSnapshot().match!.id).not.toBe(firstId)
    expect(h.requests[0].signal.aborted).toBe(true)
    h.requests[0].resolve({ move: 0 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    h.requests[1].resolve({ move: 0 })
    await flush()
    h.controller.dispatch({ type: 'open-resignation' })
    h.controller.dispatch({ type: 'confirm-resignation' })
    expect(h.controller.getSnapshot().match?.outcome.kind).toBe('resignation')
    expect(h.controller.dispatch({ type: 'select-column', column: 1 }).status).toBe('ignored')
    h.controller.dispatch({ type: 'rematch' })
    expect(h.controller.getSnapshot().match).toBeNull()
    expect(h.seed.has(CONNECT_FOUR_MATCH_STORAGE_KEY)).toBe(false)
    h.controller.dispose()
  })

  it('offers Retry after rejection without incrementing the invalid counter', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    h.requests[0].resolve({ move: -1 })
    await flush()
    h.requests[1].reject(new Error('offline'))
    await flush()
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', consecutiveInvalid: 1, retryAvailable: true })
    h.controller.dispatch({ type: 'retry-cpu' })
    expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(1)
    h.controller.dispose()
  })

  it('ignores a late answer after resignation and a late answer after disposal', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    h.controller.dispatch({ type: 'select-column', column: 0 })
    h.controller.dispatch({ type: 'open-resignation' })
    h.controller.dispatch({ type: 'confirm-resignation' })
    expect(h.requests[0].signal.aborted).toBe(true)
    h.requests[0].resolve({ move: 1 })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    h.controller.dispose()
    const second = harness()
    second.controller.dispatch({ type: 'select-order', order: 'second' })
    second.controller.dispatch({ type: 'start-game' })
    second.controller.dispose()
    second.requests[0].resolve({ move: 0 })
    await flush()
    expect(second.controller.getSnapshot().match?.moves).toHaveLength(0)
  })

  it('transitions all four setups, empty review, and review-only piece selection', () => {
    for (const color of ['red', 'yellow'] as const) for (const order of ['first', 'second'] as const) {
      let state = emptySnapshot()
      state = transition(state, { type: 'select-color', color }).snapshot
      state = transition(state, { type: 'select-order', order }).snapshot
      state = transition(state, { type: 'start-game' }, 'match').snapshot
      expect(state.match?.setup).toEqual({ humanColor: color, humanOrder: order })
      state = transition(state, { type: 'toggle-review' }).snapshot
      expect(state.view.location).toEqual({ mode: 'review', selectedPly: null })
    }
    let state = transition(emptySnapshot(), { type: 'start-game' }, 'match').snapshot
    state = transition(state, { type: 'select-column', column: 0 }).snapshot
    state = { ...state, match: { ...state.match!, moves: [state.match!.moves[0], {
      ply: 2, column: 1, landingCell: 36, player: 'two', color: 'yellow', actor: 'cpu', provenance: 'rng',
    }] } }
    state = transition(state, { type: 'select-history', ply: 1 }).snapshot
    expect(transition(state, { type: 'select-piece', cell: 36 }).result.status).toBe('ignored')
    expect(transition(state, { type: 'select-piece', cell: 35 }).result.status).toBe('applied')
  })

  it('commits a terminal human win without launching another CPU request', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    for (const [human, cpu] of [[0, 6], [1, 6], [2, 5]] as const) {
      expect(h.controller.dispatch({ type: 'select-column', column: human }).status).toBe('applied')
      h.requests.at(-1)!.resolve({ move: cpu })
      await flush()
    }
    expect(h.requests).toHaveLength(3)
    h.controller.dispatch({ type: 'select-column', column: 3 })
    expect(h.controller.getSnapshot().match?.outcome).toMatchObject({ kind: 'win', winner: 'one' })
    expect(h.requests).toHaveLength(3)
    expect(h.controller.dispatch({ type: 'select-column', column: 4 }).status).toBe('ignored')
    h.controller.dispose()
  })

  it('keeps a historical selection when the CPU ends the live match', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    for (const [human, cpu] of [[6, 0], [6, 1], [5, 2]] as const) {
      h.controller.dispatch({ type: 'select-column', column: human })
      h.requests.at(-1)!.resolve({ move: cpu })
      await flush()
    }
    h.controller.dispatch({ type: 'select-column', column: 5 })
    h.controller.dispatch({ type: 'select-history', ply: 1 })
    h.requests.at(-1)!.resolve({ move: 3 })
    await flush()
    expect(h.controller.getSnapshot().match?.outcome).toMatchObject({ kind: 'win', winner: 'two' })
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', selectedPly: 1 })
    const restored = harness(h.seed)
    expect(restored.controller.getSnapshot().view.location).toEqual({ mode: 'live' })
    expect(restored.requests).toHaveLength(0)
    restored.controller.dispose(); h.controller.dispose()
  })

  it('rejects a full column during a human turn and clears pending selection on settings change', async () => {
    const h = harness()
    h.controller.dispatch({ type: 'start-game' })
    for (let turn = 0; turn < 3; turn++) {
      h.controller.dispatch({ type: 'select-column', column: 0 })
      h.requests[turn].resolve({ move: 0 })
      await flush()
    }
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(6)
    expect(h.controller.dispatch({ type: 'select-column', column: 0 }).status).toBe('ignored')
    h.settingsStore.setConfirmMoves(true)
    h.controller.dispatch({ type: 'select-column', column: 1 })
    expect(h.controller.getSnapshot().view.pendingColumn).toBe(1)
    h.settingsStore.setConfirmMoves(false)
    expect(h.controller.getSnapshot().view.pendingColumn).toBeNull()
    expect(h.controller.dispatch({ type: 'confirm-move' }).status).toBe('ignored')
    h.controller.dispose()
  })

  it('surfaces synchronous provider failure and protects corrupt saves until Start fresh', () => {
    const h = harness(new Map(), 'throw')
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', retryAvailable: true, consecutiveInvalid: 0 })
    h.controller.dispose()
    const corrupt = new Map([[CONNECT_FOUR_MATCH_STORAGE_KEY, '{invalid']])
    const restored = harness(corrupt)
    expect(restored.controller.getSnapshot().notices.some(notice => notice.kind === 'invalid-match')).toBe(true)
    expect(restored.controller.dispatch({ type: 'start-game' }).status).toBe('ignored')
    expect(corrupt.get(CONNECT_FOUR_MATCH_STORAGE_KEY)).toBe('{invalid')
    expect(restored.controller.dispatch({ type: 'start-fresh' }).status).toBe('applied')
    expect(corrupt.has(CONNECT_FOUR_MATCH_STORAGE_KEY)).toBe(false)
    restored.controller.dispose()
  })
})
