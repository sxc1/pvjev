import type { ApplicationHost, ConnectFourController, GameId, KeyValueStorage, TicTacToeController } from '../contracts'
import { gameRegistry } from './registry'
import type { SettingsStore } from './settings'

const ACTIVE_GAME_KEY = 'pvjev.active-game'

export function createApplicationHost(settings: SettingsStore, ticTacToe: TicTacToeController, connectFour: ConnectFourController, enabledGames: ReadonlySet<GameId> = new Set((Object.keys(gameRegistry) as GameId[]).filter(id => gameRegistry[id].enabled)), storage?: () => KeyValueStorage): ApplicationHost {
  const listeners = new Set<() => void>()
  let selectedGame: GameId = 'tic-tac-toe'
  try {
    const saved = storage?.().getItem(ACTIVE_GAME_KEY)
    if (saved === 'tic-tac-toe' || saved === 'connect-four') {
      if (enabledGames.has(saved)) selectedGame = saved
    }
  } catch { /* Browser storage may be unavailable. */ }
  let started = false
  let disposed = false
  return {
    settings, ticTacToe, connectFour,
    getSelectedGame: () => selectedGame,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    selectGame: gameId => {
      if (disposed || !enabledGames.has(gameId) || selectedGame === gameId) return
      // Closing transient interaction state leaves matches and review history intact.
      ticTacToe.dispatch({ type: 'cancel-resignation' })
      ticTacToe.dispatch({ type: 'clear-transient' })
      connectFour.dispatch({ type: 'cancel-resignation' })
      connectFour.dispatch({ type: 'clear-transient' })
      selectedGame = gameId
      try { storage?.().setItem(ACTIVE_GAME_KEY, gameId) } catch { /* Keep selection usable without storage. */ }
      for (const listener of [...listeners]) listener()
    },
    start: () => { if (started || disposed) return; started = true; settings.start(); ticTacToe.start(); connectFour.start() },
    dispose: () => { if (disposed) return; disposed = true; ticTacToe.dispose(); connectFour.dispose(); listeners.clear() },
  }
}
