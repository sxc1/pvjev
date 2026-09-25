import { describe, expect, it } from 'vitest'
import { createApplicationHost } from '../../src/app/host'
import { createSharedSettingsStore } from '../../src/app/settings'
import { createTicTacToeController } from '../../src/app/controller'
import type { ConnectFourController, TicTacToeController } from '../../src/contracts'
import { SETTINGS_STORAGE_KEY } from '../../src/contracts/persistence'
import { ticTacToeRules } from '../../src/games/tic-tac-toe/rules'

describe('application host and shared settings', () => {
  it('starts each controller once and keeps both alive through navigation', () => {
    const events: string[] = []
    const controller = (name: string) => ({
      getSnapshot: () => ({}), subscribe: () => () => {},
      dispatch: (command: { type: string }) => { events.push(`${name}:${command.type}`); return { status: 'applied' as const } },
      start: () => { events.push(`${name}:start`) }, dispose: () => { events.push(`${name}:dispose`) },
    })
    const host = createApplicationHost({ getSnapshot: () => ({ confirmMoves: false }), getNotices: () => [], subscribe: () => () => {}, start: () => { events.push('settings:start') }, setConfirmMoves: () => {} }, controller('ttt') as TicTacToeController, controller('c4') as ConnectFourController, new Set(['tic-tac-toe', 'connect-four']))
    host.start(); host.start()
    host.selectGame('connect-four'); host.selectGame('tic-tac-toe')
    expect(events.filter(event => event === 'ttt:start' || event === 'c4:start')).toEqual(['ttt:start', 'c4:start'])
    expect(events.filter(event => event === 'settings:start')).toHaveLength(1)
    expect(events).not.toContain('ttt:dispose')
    expect(events).not.toContain('c4:dispose')
    expect(host.getSelectedGame()).toBe('tic-tac-toe')
    host.dispose()
    expect(events.filter(event => event.endsWith(':dispose'))).toEqual(['ttt:dispose', 'c4:dispose'])
  })

  it('writes one setting update and clears the tic tac toe pending move', () => {
    const data = new Map<string, string>()
    const writes: string[] = []
    const storage = () => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { writes.push(key); data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } })
    const settings = createSharedSettingsStore(storage)
    settings.start()
    let secondSnapshot = settings.getSnapshot()
    const unsubscribeSecond = settings.subscribe(() => { secondSnapshot = settings.getSnapshot() })
    const ttt = createTicTacToeController({ rules: ticTacToeRules, cpu: { chooseMove: async () => ({ move: 0 }) }, storage, scheduler: { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} }, random: () => 0, newId: () => 'test', settings })
    ttt.start()
    ttt.dispatch({ type: 'start-game' })
    ttt.dispatch({ type: 'set-confirm-moves', enabled: true })
    expect(ttt.getSnapshot().settings.confirmMoves).toBe(true)
    expect(secondSnapshot.confirmMoves).toBe(true)
    ttt.dispatch({ type: 'activate-cell', cell: 0 })
    expect(ttt.getSnapshot().view.pendingCell).toBe(0)
    settings.setConfirmMoves(false)
    expect(ttt.getSnapshot().settings.confirmMoves).toBe(false)
    expect(secondSnapshot.confirmMoves).toBe(false)
    expect(ttt.getSnapshot().view.pendingCell).toBeNull()
    expect(writes.filter(key => key === SETTINGS_STORAGE_KEY)).toHaveLength(2)
    ttt.dispose()
    unsubscribeSecond()
  })
})
