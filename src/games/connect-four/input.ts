export interface BoardBounds { left: number; top: number; width: number; height: number }

/** The labels and surrounding frame must not be included in this rectangle. */
export function columnAtPoint(bounds: BoardBounds, clientX: number, clientY: number): number | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || bounds.width <= 0 || bounds.height <= 0) return null
  const x = clientX - bounds.left
  const y = clientY - bounds.top
  if (x < 0 || x >= bounds.width || y < 0 || y >= bounds.height) return null
  return Math.floor(x * 7 / bounds.width)
}

export function legalColumn(board: readonly number[], column: number | null): column is number {
  return column !== null && Number.isInteger(column) && column >= 0 && column < 7 && board.length === 42 && board[column] === 0
}

export function landingCell(board: readonly number[], column: number | null): number | null {
  if (!legalColumn(board, column)) return null
  for (let row = 5; row >= 0; row--) {
    const cell = row * 7 + column
    if (board[cell] === 0) return cell
  }
  return null
}
