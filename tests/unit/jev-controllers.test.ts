import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTicTacToeController } from '../../src/app/controller'
import { createConnectFourController } from '../../src/app/connect-four-controller'
import type { ControllerDependencies, ConnectFourControllerDependencies, JevMoveInput, JevMoveResult, Settings, SharedSettingsStore, VisitorKeySource } from '../../src/contracts'
import { ticTacToeRules } from '../../src/games/tic-tac-toe/rules'
import { connectFourRules } from '../../src/games/connect-four/rules'
import { JEV_INVALID_FALLBACK_DIAGNOSTIC, JEV_SERVICE_FALLBACK_DIAGNOSTIC } from '../../src/contracts/jev'

const flush = async () => { await Promise.resolve(); await Promise.resolve() }
function keySource(initial: string | null = 'synthetic-credential'): VisitorKeySource & { change(value: string | null): void } {
  let key = initial, revision = 0
  const listeners = new Set<() => void>()
  return { getKey: () => key, getRevision: () => revision, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    change(value) { key = value; revision++; listeners.forEach(listener => listener()) } }
}
function analysis(legal: readonly number[], move: number, prefix: string) {
  return { confidence: 0.742, choices: legal.map(id => ({ moveId: `${prefix}-${id}`, probability: id === move ? 1 : 0 })),
    tie: { count: 1, selectedMoveId: `${prefix}-${move}` }, resolvedModelId: 'test-model' }
}
function memory() {
  const data = new Map<string, string>()
  return { data, acquire: () => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }) }
}
function settings(): SharedSettingsStore {
  let value: Settings = { confirmMoves: false }
  const listeners = new Set<() => void>()
  return { getSnapshot: () => value, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    setConfirmMoves(enabled) { value = { confirmMoves: enabled }; listeners.forEach(listener => listener()) } }
}
function ticHarness(keys = keySource(), storage = memory()) {
  const requests: { input: JevMoveInput<any, number, 'X' | 'O'>; resolve(value: JevMoveResult<number>): void; reject(error: unknown): void }[] = []
  let id = 0
  const deps: ControllerDependencies = { rules: ticTacToeRules, cpu: { chooseMove: async () => ({ move: 0 }) },
    jev: { chooseMove: input => new Promise((resolve, reject) => requests.push({ input, resolve, reject })) }, visitorKey: keys,
    storage: storage.acquire, scheduler: { now: () => Date.now(), setTimeout, clearTimeout: handle => clearTimeout(handle as number) },
    random: () => 0, newId: () => `id-${++id}` }
  const controller = createTicTacToeController(deps); controller.start()
  return { controller, requests, keys, storage }
}
function fourHarness() {
  const requests: { input: JevMoveInput<any, number, 'one' | 'two'>; resolve(value: JevMoveResult<number>): void; reject(error: unknown): void }[] = []
  const keys = keySource(), storage = memory()
  let id = 0
  const deps: ConnectFourControllerDependencies = { rules: connectFourRules, cpu: { chooseMove: async () => ({ move: 0 }) },
    jev: { chooseMove: input => new Promise((resolve, reject) => requests.push({ input, resolve, reject })) }, visitorKey: keys,
    storage: storage.acquire, scheduler: { now: () => Date.now(), setTimeout, clearTimeout: handle => clearTimeout(handle as number) },
    random: () => 0, newId: () => `id-${++id}`, settings: settings() }
  const controller = createConnectFourController(deps); controller.start()
  return { controller, requests, keys, storage }
}

describe('V4 visitor Jev controller recovery', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('expires a Tic Tac Toe attempt, ignores its answer, keeps service and invalid counters separate, then commits saved analysis', async () => {
    const h = ticHarness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    expect(h.controller.getSnapshot().match?.assignment).toEqual({ opponent: 'jev', credentialRoute: 'visitor' })
    vi.advanceTimersByTime(5000)
    expect(h.requests[0].input.signal.aborted).toBe(true)
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', consecutiveServiceFailures: 1, consecutiveInvalid: 0 })
    h.requests[0].resolve({ move: 0, analysis: analysis(h.requests[0].input.legalMoves, 0, 'cell') })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    h.controller.dispatch({ type: 'retry-cpu' })
    h.requests[1].reject({ code: 'invalid_response' })
    await flush()
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'pending', consecutiveServiceFailures: 1, consecutiveInvalid: 1 })
    expect(h.requests).toHaveLength(3)
    h.requests[2].resolve({ move: 0, analysis: analysis(h.requests[2].input.legalMoves, 0, 'cell') })
    await flush()
    expect(h.controller.getSnapshot().match?.moves[0]).toMatchObject({ provenance: 'jev', analysis: { confidence: 0.742 } })
    expect(h.controller.getSnapshot().request).toMatchObject({ consecutiveServiceFailures: 0, consecutiveInvalid: 0 })
    h.controller.dispose()
  })

  it('keeps historical selection fixed when Tic Tac Toe Jev completes and ignores a replaced key attempt', async () => {
    const h = ticHarness()
    h.controller.dispatch({ type: 'start-game' })
    h.controller.dispatch({ type: 'activate-cell', cell: 0 })
    h.controller.dispatch({ type: 'select-history', ply: 1 })
    expect(h.requests).toHaveLength(1)
    h.keys.change('replacement-synthetic-credential')
    expect(h.requests[0].input.signal.aborted).toBe(true)
    h.requests[0].resolve({ move: 1, analysis: analysis(h.requests[0].input.legalMoves, 1, 'cell') })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(1)
    expect(h.requests).toHaveLength(2)
    h.requests[1].resolve({ move: 1, analysis: analysis(h.requests[1].input.legalMoves, 1, 'cell') })
    await flush()
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', ply: 1 })
    h.controller.dispose()
  })

  it('falls back after three service failures in Connect Four and preserves Jev assignment', async () => {
    const h = fourHarness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    for (let i = 0; i < 3; i++) {
      h.requests[i].reject({ code: 'transport', message: 'untrusted details' })
      await flush()
      if (i < 2) {
        expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', consecutiveServiceFailures: i + 1 })
        h.controller.dispatch({ type: 'retry-cpu' })
      }
    }
    expect(h.controller.getSnapshot().match?.moves[0]).toMatchObject({ provenance: 'rng-fallback', diagnostic: JEV_SERVICE_FALLBACK_DIAGNOSTIC })
    expect(h.controller.getSnapshot().match?.assignment.opponent).toBe('jev')
    expect(h.controller.getSnapshot().request).toMatchObject({ consecutiveServiceFailures: 0, consecutiveInvalid: 0 })
    h.controller.dispose()
  })

  it('falls back after three invalid Connect Four responses without changing review selection', async () => {
    const h = fourHarness()
    h.controller.dispatch({ type: 'select-order', order: 'second' })
    h.controller.dispatch({ type: 'start-game' })
    h.controller.dispatch({ type: 'toggle-review' })
    for (let i = 0; i < 3; i++) {
      h.requests[i].reject({ code: 'invalid_response' })
      await flush()
      if (i < 2) expect(h.controller.getSnapshot().request.consecutiveInvalid).toBe(i + 1)
    }
    expect(h.controller.getSnapshot().match?.moves[0]).toMatchObject({ provenance: 'rng-fallback', diagnostic: JEV_INVALID_FALLBACK_DIAGNOSTIC })
    expect(h.controller.getSnapshot().view.location).toEqual({ mode: 'review', selectedPly: null })
    h.controller.dispose()
  })
  it('rejects an answer after elapsed deadline even when the timer callback has not run', async () => {
    const h = ticHarness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    vi.setSystemTime(new Date(Date.now() + 5001))
    h.requests[0].resolve({ move: 0, analysis: analysis(h.requests[0].input.legalMoves, 0, 'cell') })
    await flush()
    expect(h.controller.getSnapshot().match?.moves).toHaveLength(0)
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', consecutiveServiceFailures: 1 })
    expect(h.requests[0].input.signal.aborted).toBe(true)
    h.controller.dispose()
  })

  it('restores manual Retry without issuing a request, and re-entry after key loss resumes only a ready turn', async () => {
    const h = ticHarness()
    h.controller.dispatch({ type: 'select-side', symbol: 'O' })
    h.controller.dispatch({ type: 'start-game' })
    h.requests[0].reject({ code: 'authentication' })
    await flush()
    expect(h.controller.getSnapshot().request).toMatchObject({ status: 'failed', error: 'The TypeSafe key was rejected.' })
    h.controller.dispose()
    const restored = ticHarness(h.keys, h.storage)
    expect(restored.requests).toHaveLength(0)
    expect(restored.controller.getSnapshot().request).toMatchObject({ disposition: 'manual-retry-required', consecutiveServiceFailures: 1 })
    restored.controller.dispatch({ type: 'retry-cpu' })
    expect(restored.requests).toHaveLength(1)
    restored.keys.change(null)
    expect(restored.requests[0].input.signal.aborted).toBe(true)
    expect(restored.controller.getSnapshot().request).toMatchObject({ status: 'waiting-for-key', consecutiveServiceFailures: 1 })
    restored.keys.change('corrected-synthetic-credential')
    expect(restored.requests).toHaveLength(2)
    expect(restored.controller.getSnapshot().request).toMatchObject({ status: 'pending', consecutiveServiceFailures: 1 })
    restored.controller.dispose()
  })
})


