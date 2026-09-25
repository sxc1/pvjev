import type { ConnectFourMoveRecord, ConnectFourPosition, ConnectFourSnapshot } from '../../contracts'
import { cellCoordinate, historyLabel } from './notation'
import { reconstructPosition } from './rules'

export interface ConnectFourHistoryEntry {
  readonly ply: number
  readonly label: string
  readonly selected: boolean
  readonly record: ConnectFourMoveRecord
}

export interface ConnectFourPresentation {
  readonly position: ConnectFourPosition
  readonly entries: readonly ConnectFourHistoryEntry[]
  readonly reviewing: boolean
  readonly selectedPly: number | null
  readonly reviewedMove: ConnectFourMoveRecord | null
  readonly latestCell: number | null
  readonly selectedCell: number | null
  readonly winningCells: readonly number[]
  readonly placementPlyByCell: ReadonlyMap<number, number>
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly canReturnToCurrent: boolean
  readonly historicalLabel: string | null
}

/** Reconstruct only the displayed prefix. Live moves remain available in history. */
export function selectConnectFourPresentation(snapshot: ConnectFourSnapshot): ConnectFourPresentation | null {
  const match = snapshot.match
  if (!match) return null
  const { moves } = match
  const reviewing = snapshot.view.location.mode === 'review'
  const selectedPly = reviewing ? snapshot.view.location.selectedPly : null
  const prefixLength = reviewing ? selectedPly ?? 0 : moves.length
  const prefix = moves.slice(0, prefixLength)
  const position = reviewing ? reconstructPosition(prefix.map(move => move.column)) : match.position
  const markedMove = prefix.at(-1) ?? null
  const reviewedMove = reviewing ? markedMove : null
  const placementPlyByCell = new Map(prefix.map(move => [move.landingCell, move.ply]))
  return {
    position,
    entries: moves.map(record => ({ ply: record.ply, label: historyLabel(record), selected: reviewing && record.ply === selectedPly, record })),
    reviewing,
    selectedPly,
    reviewedMove,
    latestCell: reviewing ? null : markedMove?.landingCell ?? null,
    selectedCell: reviewing ? markedMove?.landingCell ?? null : null,
    winningCells: position.outcome.kind === 'win' ? position.winningLines.flatMap(line => [...line]) : [],
    placementPlyByCell,
    canGoBack: moves.length > 0 && (!reviewing || (selectedPly !== null && selectedPly > 1)),
    canGoForward: reviewing && moves.length > 0 && (selectedPly === null || selectedPly < moves.length),
    canReturnToCurrent: reviewing,
    historicalLabel: reviewing ? selectedPly === null ? 'Reviewing empty board' : `Historical position after ${historyLabel(moves[selectedPly - 1])}` : null,
  }
}

export function inspectionText(record: ConnectFourMoveRecord): string {
  const coordinate = cellCoordinate(record.landingCell)
  if (record.actor === 'human') return `Your ${record.color} move at ${coordinate}.`
  if (record.provenance === 'rng-fallback') return `Random fallback at ${coordinate}. ${record.diagnostic}`
  if (record.provenance === 'jev') return `Jev move at ${coordinate}.`
  return `Random CPU move at ${coordinate}.`
}
