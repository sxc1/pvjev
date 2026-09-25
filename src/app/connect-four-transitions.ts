import type { CommandResult, ConnectFourCommand, ConnectFourMatch, ConnectFourMoveRecord, ConnectFourSetup, ConnectFourSnapshot, ConnectFourViewState } from '../contracts'
import { applyMove, initialPosition, isLegalMove } from '../games/connect-four/rules'

export const liveView = (): ConnectFourViewState => ({ location: { mode: 'live' }, pendingColumn: null, mobileHistoryOpen: false, resignationDialogOpen: false })

export function emptySnapshot(): ConnectFourSnapshot {
  return { setup: { humanColor: 'red', humanOrder: 'first' }, match: null, view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 }, settings: { confirmMoves: false }, notices: [] }
}

export function humanPlayer(setup: ConnectFourSetup): 'one' | 'two' {
  return setup.humanOrder === 'first' ? 'one' : 'two'
}

export function createMatch(id: string, setup: ConnectFourSetup): ConnectFourMatch {
  const position = initialPosition()
  return { gameId: 'connect-four', id, setup, moves: [], position, outcome: position.outcome }
}

export function appendMove(match: ConnectFourMatch, column: number, actor: 'human' | 'cpu', diagnostic?: string): ConnectFourMatch {
  const player = match.position.nextPlayer
  const color = player === humanPlayer(match.setup) ? match.setup.humanColor : match.setup.humanColor === 'red' ? 'yellow' : 'red'
  const position = applyMove(match.position, column)
  const landingCell = position.board.findIndex((cell, index) => cell !== match.position.board[index])
  const base = { ply: match.moves.length + 1, column, landingCell, player, color }
  const record: ConnectFourMoveRecord = actor === 'human'
    ? { ...base, actor, provenance: 'human' }
    : diagnostic === undefined
      ? { ...base, actor, provenance: 'rng' }
      : { ...base, actor, provenance: 'rng-fallback', diagnostic }
  return { ...match, moves: [...match.moves, record], position, outcome: position.outcome }
}

export interface TransitionResult {
  readonly snapshot: ConnectFourSnapshot
  readonly result: CommandResult
  readonly persistence: 'none' | 'match' | 'remove-match'
}

const ignored = (snapshot: ConnectFourSnapshot, reason: 'illegal' | 'stale' | 'not-ready' = 'illegal'): TransitionResult =>
  ({ snapshot, result: { status: 'ignored', reason }, persistence: 'none' })
const applied = (snapshot: ConnectFourSnapshot, persistence: TransitionResult['persistence'] = 'none'): TransitionResult =>
  ({ snapshot, result: { status: 'applied' }, persistence })

/** Pure command transition; the controller supplies IDs for match creation. */
export function transition(snapshot: ConnectFourSnapshot, command: ConnectFourCommand, newMatchId?: string): TransitionResult {
  const { match, view } = snapshot
  switch (command.type) {
    case 'select-color':
      if (match || (command.color !== 'red' && command.color !== 'yellow')) return ignored(snapshot)
      return snapshot.setup.humanColor === command.color ? ignored(snapshot) : applied({ ...snapshot, setup: { ...snapshot.setup, humanColor: command.color } })
    case 'select-order':
      if (match || (command.order !== 'first' && command.order !== 'second')) return ignored(snapshot)
      return snapshot.setup.humanOrder === command.order ? ignored(snapshot) : applied({ ...snapshot, setup: { ...snapshot.setup, humanOrder: command.order } })
    case 'start-game':
      if (match || !newMatchId) return ignored(snapshot)
      return applied({ ...snapshot, match: createMatch(newMatchId, snapshot.setup), view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } }, 'match')
    case 'restart':
      if (!match) return ignored(snapshot)
      if (match.moves.length || !newMatchId) return ignored(snapshot)
      return applied({ ...snapshot, match: createMatch(newMatchId, match.setup), view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } }, 'match')
    case 'open-resignation':
      if (!match || match.outcome.kind !== 'ongoing' || !match.moves.length || view.resignationDialogOpen) return ignored(snapshot)
      return applied({ ...snapshot, view: { ...view, resignationDialogOpen: true, pendingColumn: null } })
    case 'cancel-resignation':
      return view.resignationDialogOpen ? applied({ ...snapshot, view: { ...view, resignationDialogOpen: false } }) : ignored(snapshot)
    case 'confirm-resignation': {
      if (!match || match.outcome.kind !== 'ongoing' || !view.resignationDialogOpen) return ignored(snapshot, 'stale')
      const resigningPlayer = humanPlayer(match.setup)
      return applied({ ...snapshot, match: { ...match, outcome: { kind: 'resignation', resigningPlayer, winner: resigningPlayer === 'one' ? 'two' : 'one', ply: match.moves.length } },
        view: { ...view, resignationDialogOpen: false, pendingColumn: null }, request: { status: 'idle', consecutiveInvalid: 0 } }, 'match')
    }
    case 'rematch':
      if (!match || match.outcome.kind === 'ongoing') return ignored(snapshot)
      return applied({ ...snapshot, setup: match.setup, match: null, view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } }, 'remove-match')
    case 'select-column':
      if (!match || view.location.mode !== 'live' || match.outcome.kind !== 'ongoing' || match.position.nextPlayer !== humanPlayer(match.setup) || !isLegalMove(match.position, command.column)) return ignored(snapshot)
      return snapshot.settings.confirmMoves
        ? applied({ ...snapshot, view: { ...view, pendingColumn: command.column } })
        : applied({ ...snapshot, match: appendMove(match, command.column, 'human'), view: { ...view, pendingColumn: null } }, 'match')
    case 'confirm-move':
      if (!match || !snapshot.settings.confirmMoves || view.location.mode !== 'live' || match.outcome.kind !== 'ongoing' ||
        match.position.nextPlayer !== humanPlayer(match.setup) || !isLegalMove(match.position, view.pendingColumn)) return ignored(snapshot, 'stale')
      return applied({ ...snapshot, match: appendMove(match, view.pendingColumn!, 'human'), view: { ...view, pendingColumn: null } }, 'match')
    case 'toggle-review':
      return !match ? ignored(snapshot) : view.location.mode === 'review'
        ? applied({ ...snapshot, view: { ...view, location: { mode: 'live' }, pendingColumn: null } })
        : applied({ ...snapshot, view: { ...view, location: { mode: 'review', selectedPly: match.moves.length || null }, pendingColumn: null } })
    case 'select-piece': {
      if (!match || view.location.mode !== 'review' || !Number.isInteger(command.cell) || command.cell < 0 || command.cell > 41) return ignored(snapshot)
      const prefix = view.location.selectedPly ?? 0
      const placement = match.moves.slice(0, prefix).find(move => move.landingCell === command.cell)
      return placement ? applied({ ...snapshot, view: { ...view, location: { mode: 'review', selectedPly: placement.ply }, pendingColumn: null, mobileHistoryOpen: true } }) : ignored(snapshot)
    }
    case 'select-history':
      if (!match || !Number.isInteger(command.ply) || command.ply < 1 || command.ply > match.moves.length) return ignored(snapshot)
      return applied({ ...snapshot, view: { ...view, location: { mode: 'review', selectedPly: command.ply }, pendingColumn: null, mobileHistoryOpen: true } })
    case 'navigate-history': {
      if (!match || !match.moves.length) return ignored(snapshot)
      const selected = view.location.mode === 'review' ? view.location.selectedPly : null
      const ply = view.location.mode === 'live' ? (command.direction === 'back' ? match.moves.length : 0)
        : selected === null ? (command.direction === 'forward' ? 1 : 0)
          : selected + (command.direction === 'back' ? -1 : 1)
      if (ply < 1 || ply > match.moves.length) return ignored(snapshot)
      return applied({ ...snapshot, view: { ...view, location: { mode: 'review', selectedPly: ply }, pendingColumn: null, mobileHistoryOpen: true } })
    }
    case 'return-to-current':
      return view.location.mode === 'live' ? ignored(snapshot) : applied({ ...snapshot, view: { ...view, location: { mode: 'live' }, pendingColumn: null } })
    case 'set-mobile-history-open':
      return typeof command.open === 'boolean' ? applied({ ...snapshot, view: { ...view, mobileHistoryOpen: command.open } }) : ignored(snapshot)
    case 'clear-transient':
      return view.pendingColumn === null && !view.resignationDialogOpen ? ignored(snapshot)
        : applied({ ...snapshot, view: { ...view, pendingColumn: null, resignationDialogOpen: false } })
    case 'retry-cpu':
    case 'start-fresh':
      return ignored(snapshot, 'not-ready')
  }
}
