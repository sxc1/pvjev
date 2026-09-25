import type { CommandResult, TicTacToeCommand, TicTacToeMatch, TicTacToeMoveRecord, TicTacToeSnapshot, TicTacToeViewState } from '../contracts'
import { applyMove, initialPosition, isCellIndex, isLegalMove } from '../games/tic-tac-toe/rules'

export const liveView = (): TicTacToeViewState => ({
  location: { mode: 'live' }, pendingCell: null, mobileHistoryOpen: false, resignationDialogOpen: false,
})

export function emptySnapshot(): TicTacToeSnapshot {
  return {
    selectedGame: 'tic-tac-toe', setupSymbol: 'X', match: null, view: liveView(),
    request: { status: 'idle', consecutiveInvalid: 0 }, settings: { confirmMoves: false }, notices: [],
  }
}

export function createMatch(id: string, humanSymbol: 'X' | 'O'): TicTacToeMatch {
  const position = initialPosition()
  return { gameId: 'tic-tac-toe', id, humanSymbol, moves: [], position, outcome: position.outcome }
}

export function appendMove(match: TicTacToeMatch, cell: number, actor: 'human' | 'cpu', diagnostic?: string): TicTacToeMatch {
  const symbol = match.position.nextSymbol
  const position = applyMove(match.position, cell)
  const record: TicTacToeMoveRecord = actor === 'human'
    ? { ply: match.moves.length + 1, symbol, cell, actor, provenance: 'human' }
    : diagnostic === undefined
      ? { ply: match.moves.length + 1, symbol, cell, actor, provenance: 'rng' }
      : { ply: match.moves.length + 1, symbol, cell, actor, provenance: 'rng-fallback', diagnostic }
  return { ...match, moves: [...match.moves, record], position, outcome: position.outcome }
}

export interface TransitionResult {
  readonly snapshot: TicTacToeSnapshot
  readonly result: CommandResult
  readonly persistence: 'none' | 'match' | 'remove-match' | 'settings'
}

const ignored = (snapshot: TicTacToeSnapshot, reason: 'illegal' | 'stale' | 'not-ready' = 'illegal'): TransitionResult =>
  ({ snapshot, result: { status: 'ignored', reason }, persistence: 'none' })
const applied = (snapshot: TicTacToeSnapshot, persistence: TransitionResult['persistence'] = 'none'): TransitionResult =>
  ({ snapshot, result: { status: 'applied' }, persistence })

/** Pure command transition. The controller supplies an ID for commands that create a match. */
export function transition(snapshot: TicTacToeSnapshot, command: TicTacToeCommand, newMatchId?: string): TransitionResult {
  const { match, view } = snapshot
  switch (command.type) {
    case 'select-side':
      if (match || (command.symbol !== 'X' && command.symbol !== 'O')) return ignored(snapshot)
      return snapshot.setupSymbol === command.symbol ? ignored(snapshot) : applied({ ...snapshot, setupSymbol: command.symbol })
    case 'start-game':
      if (match || !newMatchId) return ignored(snapshot)
      return applied({ ...snapshot, match: createMatch(newMatchId, snapshot.setupSymbol), view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } }, 'match')
    case 'restart':
      if (!match) return snapshot.setupSymbol === 'X' ? ignored(snapshot) : applied({ ...snapshot, setupSymbol: 'X', view: liveView() })
      if (match.moves.length || !newMatchId) return ignored(snapshot)
      return applied({ ...snapshot, match: createMatch(newMatchId, match.humanSymbol), view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } }, 'match')
    case 'open-resignation':
      if (!match || match.outcome.kind !== 'ongoing' || !match.moves.length || view.resignationDialogOpen) return ignored(snapshot)
      return applied({ ...snapshot, view: { ...view, resignationDialogOpen: true, pendingCell: null } })
    case 'cancel-resignation':
      return view.resignationDialogOpen ? applied({ ...snapshot, view: { ...view, resignationDialogOpen: false } }) : ignored(snapshot)
    case 'confirm-resignation':
      if (!match || match.outcome.kind !== 'ongoing' || !view.resignationDialogOpen) return ignored(snapshot, 'stale')
      return applied({ ...snapshot, match: { ...match, outcome: { kind: 'resignation', resigningSymbol: match.humanSymbol, winner: match.humanSymbol === 'X' ? 'O' : 'X', ply: match.moves.length } }, view: { ...view, resignationDialogOpen: false, pendingCell: null }, request: { status: 'idle', consecutiveInvalid: 0 } }, 'match')
    case 'rematch':
      if (!match || match.outcome.kind === 'ongoing') return ignored(snapshot)
      return applied({ ...snapshot, setupSymbol: match.humanSymbol, match: null, view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } }, 'remove-match')
    case 'activate-cell': {
      if (!match || !isCellIndex(command.cell)) return ignored(snapshot)
      const placement = match.moves.find(move => move.cell === command.cell)
      if (placement) return applied({ ...snapshot, view: { ...view, location: { mode: 'review', ply: placement.ply }, pendingCell: null, mobileHistoryOpen: true } })
      if (match.outcome.kind !== 'ongoing' || view.location.mode !== 'live' || match.position.nextSymbol !== match.humanSymbol || !isLegalMove(match.position, command.cell)) return ignored(snapshot)
      if (snapshot.settings.confirmMoves) return applied({ ...snapshot, view: { ...view, pendingCell: command.cell } })
      return applied({ ...snapshot, match: appendMove(match, command.cell, 'human'), view: { ...view, pendingCell: null } }, 'match')
    }
    case 'confirm-move':
      if (!match || match.outcome.kind !== 'ongoing' || view.location.mode !== 'live' || match.position.nextSymbol !== match.humanSymbol || !isLegalMove(match.position, view.pendingCell)) return ignored(snapshot, 'stale')
      return applied({ ...snapshot, match: appendMove(match, view.pendingCell!, 'human'), view: { ...view, pendingCell: null } }, 'match')
    case 'select-history':
      if (!match || !Number.isInteger(command.ply) || command.ply < 1 || command.ply > match.moves.length) return ignored(snapshot)
      return applied({ ...snapshot, view: { ...view, location: { mode: 'review', ply: command.ply }, pendingCell: null, mobileHistoryOpen: true } })
    case 'navigate-history': {
      if (!match || !match.moves.length) return ignored(snapshot)
      const ply = view.location.mode === 'live' ? (command.direction === 'back' ? match.moves.length : 0) : view.location.ply + (command.direction === 'back' ? -1 : 1)
      if (ply < 1 || ply > match.moves.length) return ignored(snapshot)
      return applied({ ...snapshot, view: { ...view, location: { mode: 'review', ply }, pendingCell: null, mobileHistoryOpen: true } })
    }
    case 'return-to-current':
      return view.location.mode === 'live' ? ignored(snapshot) : applied({ ...snapshot, view: { ...view, location: { mode: 'live' }, pendingCell: null } })
    case 'set-confirm-moves':
      if (typeof command.enabled !== 'boolean') return ignored(snapshot)
      return applied({ ...snapshot, settings: { confirmMoves: command.enabled }, view: { ...view, pendingCell: null } }, 'settings')
    case 'clear-transient':
      return view.pendingCell === null && !view.resignationDialogOpen ? ignored(snapshot) : applied({ ...snapshot, view: { ...view, pendingCell: null, resignationDialogOpen: false } })
    case 'set-mobile-history-open':
      return typeof command.open === 'boolean' ? applied({ ...snapshot, view: { ...view, mobileHistoryOpen: command.open } }) : ignored(snapshot)
    case 'retry-cpu':
    case 'start-fresh':
      return ignored(snapshot, 'not-ready')
  }
}
