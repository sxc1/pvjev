import { describe, expect, it } from 'vitest'
import { createConnectFourController } from '../../src/app/connect-four-controller'
import { createTicTacToeController } from '../../src/app/controller'
import { createApplicationHost } from '../../src/app/host'
import { createSharedSettingsStore } from '../../src/app/settings'
import type { ApplicationHost } from '../../src/contracts'
import { CONNECT_FOUR_MATCH_STORAGE_KEY, MATCH_STORAGE_KEY } from '../../src/contracts/persistence'
import { createRandomCpuProvider } from '../../src/cpu/random'
import { connectFourRules } from '../../src/games/connect-four/rules'
import { ticTacToeRules } from '../../src/games/tic-tac-toe/rules'

function makeHost(data: Map<string, string>): ApplicationHost {
  const storage = () => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } })
  const scheduler = { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} }
  const settings = createSharedSettingsStore(storage)
  let nextId = 0
  const common = { storage, scheduler, random: () => 0, newId: () => `id-${++nextId}`, settings }
  const host = createApplicationHost(settings,
    createTicTacToeController({ ...common, rules: ticTacToeRules, cpu: createRandomCpuProvider(() => 0) }),
    createConnectFourController({ ...common, rules: connectFourRules, cpu: createRandomCpuProvider(() => 0) }), undefined, storage)
  host.start()
  return host
}

const flush = async () => { await Promise.resolve(); await Promise.resolve() }

describe('two-game integration', () => {
  it('plays a full Connect Four RNG match, preserves both games, and restores both independently', async () => {
    const data = new Map<string, string>()
    const host = makeHost(data)
    host.ticTacToe.dispatch({ type: 'start-game' })
    expect(data.has(MATCH_STORAGE_KEY)).toBe(true)
    host.selectGame('connect-four')
    host.connectFour.dispatch({ type: 'select-order', order: 'second' })
    host.connectFour.dispatch({ type: 'start-game' })
    await flush()
    expect(host.connectFour.getSnapshot().match?.moves).toHaveLength(1)
    for (let turn = 1; turn <= 3; turn++) {
      host.connectFour.dispatch({ type: 'select-column', column: 1 })
      await flush()
      expect(host.connectFour.getSnapshot().match?.moves).toHaveLength(turn * 2 + 1)
    }
    expect(host.connectFour.getSnapshot().match?.outcome).toMatchObject({ kind: 'win', winner: 'one' })
    expect(host.connectFour.getSnapshot().match?.moves.map(move => move.column)).toEqual([0, 1, 0, 1, 0, 1, 0])
    expect(data.has(CONNECT_FOUR_MATCH_STORAGE_KEY)).toBe(true)
    expect(data.get('pvjev.active-game')).toBe('connect-four')
    host.selectGame('tic-tac-toe')
    expect(host.ticTacToe.getSnapshot().match?.moves).toHaveLength(0)
    host.dispose()
    const restored = makeHost(data)
    expect(restored.getSelectedGame()).toBe('tic-tac-toe')
    expect(restored.ticTacToe.getSnapshot().match).not.toBeNull()
    expect(restored.connectFour.getSnapshot().match?.outcome).toMatchObject({ kind: 'win', winner: 'one' })
    restored.selectGame('connect-four')
    expect(restored.connectFour.getSnapshot().match?.moves).toHaveLength(7)
    restored.dispose()
    const connectFourRestored = makeHost(data)
    expect(connectFourRestored.getSelectedGame()).toBe('connect-four')
    connectFourRestored.dispose()
  })
})
