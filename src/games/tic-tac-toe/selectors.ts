import type { TicTacToeMoveRecord, TicTacToePosition, TicTacToeSnapshot } from '../../contracts'
import { cellCoordinate, historyLabel } from './notation'
import { reconstructPosition } from './rules'

export interface BoardCellView {
  readonly index: number
  readonly coordinate: string
  readonly symbol: 'X' | 'O' | null
  readonly label: string
  readonly canActivate: boolean
  readonly highlight: 'none' | 'latest' | 'reviewed'
  readonly winning: 'none' | 'human' | 'cpu'
  readonly preview: boolean
}

export interface HistoryEntryView {
  readonly ply: number
  readonly label: string
  readonly selected: boolean
  readonly record: TicTacToeMoveRecord
}

export interface TicTacToePresentation {
  readonly position: TicTacToePosition
  readonly cells: readonly BoardCellView[]
  readonly entries: readonly HistoryEntryView[]
  readonly reviewing: boolean
  readonly reviewedMove: TicTacToeMoveRecord | null
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly canReturnToCurrent: boolean
  readonly canConfirm: boolean
}

/** All displayed board data comes from the selected prefix; live status remains in the match. */
export function selectTicTacToePresentation(snapshot: TicTacToeSnapshot): TicTacToePresentation | null {
  const match = snapshot.match
  if (!match) return null
  const { moves } = match
  const reviewing = snapshot.view.location.mode === 'review'
  const selectedPly = reviewing ? snapshot.view.location.ply : null
  const position = reviewing
    ? reconstructPosition(moves.slice(0, selectedPly!).map(move => move.cell))
    : match.position
  const reviewedMove = reviewing ? moves[selectedPly! - 1] ?? null : null
  const markedMove = reviewing ? reviewedMove : moves.at(-1) ?? null
  const winnerCells = new Set(position.winningLines.flatMap(line => [...line]))
  const canPlay = !reviewing && match.outcome.kind === 'ongoing' &&
    snapshot.request.status === 'idle' && match.position.nextSymbol === match.humanSymbol
  const pendingCell = canPlay && snapshot.settings.confirmMoves ? snapshot.view.pendingCell : null

  const cells = position.board.map((symbol, index): BoardCellView => {
    const placement = moves.find(move => move.cell === index)
    const canActivate = symbol !== null || canPlay
    const purpose = symbol !== null && placement
      ? `inspect ${historyLabel(placement.ply, placement.symbol, placement.cell)}`
      : pendingCell === index ? 'pending move, confirm to play'
      : canPlay ? 'play here' : 'unavailable'
    return {
      index,
      coordinate: cellCoordinate(index),
      symbol,
      label: `${cellCoordinate(index)}, ${symbol ?? 'empty'}, ${purpose}`,
      canActivate,
      highlight: markedMove?.cell === index ? reviewing ? 'reviewed' : 'latest' : 'none',
      winning: winnerCells.has(index) ? position.outcome.kind === 'win' && position.outcome.winner === match.humanSymbol ? 'human' : 'cpu' : 'none',
      preview: pendingCell === index && symbol === null,
    }
  })

  return {
    position,
    cells,
    entries: moves.map((record): HistoryEntryView => ({
      ply: record.ply,
      label: historyLabel(record.ply, record.symbol, record.cell),
      selected: record.ply === selectedPly,
      record,
    })),
    reviewing,
    reviewedMove,
    canGoBack: moves.length > 0 && (!reviewing || selectedPly! > 1),
    canGoForward: reviewing && selectedPly! < moves.length,
    canReturnToCurrent: reviewing,
    canConfirm: pendingCell !== null,
  }
}

export function inspectionText(record: TicTacToeMoveRecord): string {
  if (record.actor === 'human') return `Your ${record.symbol} move at ${cellCoordinate(record.cell)}.`
  if (record.provenance === 'rng-fallback') return `Random fallback at ${cellCoordinate(record.cell)}. ${record.diagnostic}`
  return `Random CPU move at ${cellCoordinate(record.cell)}.`
}
