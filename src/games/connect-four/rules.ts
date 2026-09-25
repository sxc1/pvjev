import { ConnectFour } from '@devshareacademy/connect-four'
import type { ConnectFourBoardOutcome, ConnectFourMove, ConnectFourPlayer, ConnectFourPosition, ConnectFourWinningLine, RulesAdapter } from '../../contracts'

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const

export function isColumn(value: unknown): value is ConnectFourMove {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

export function isLegalMove(position: ConnectFourPosition, move: unknown): move is ConnectFourMove {
  return position.outcome.kind === 'ongoing' && isColumn(move) && position.board[move] === 0
}

export function initialPosition(): ConnectFourPosition {
  return { board: Array<0>(42).fill(0), columns: [], nextPlayer: 'one', outcome: { kind: 'ongoing' }, winningLines: [] }
}

export function legalMoves(position: ConnectFourPosition): readonly ConnectFourMove[] {
  if (position.outcome.kind !== 'ongoing') return []
  return [0, 1, 2, 3, 4, 5, 6].filter(column => position.board[column] === 0)
}

export function sideToMove(position: ConnectFourPosition): ConnectFourPlayer | null {
  return position.outcome.kind === 'ongoing' ? position.nextPlayer : null
}

function winningLinesFrom(board: readonly (0 | 1 | 2)[], landingCell: number, player: 1 | 2): readonly ConnectFourWinningLine[] {
  const row = Math.floor(landingCell / 7)
  const col = landingCell % 7
  const lines: ConnectFourWinningLine[] = []
  for (const [dr, dc] of DIRECTIONS) {
    const cells = [landingCell]
    for (const sign of [-1, 1]) {
      for (let distance = 1; ; distance += 1) {
        const nextRow = row + dr * distance * sign
        const nextCol = col + dc * distance * sign
        if (nextRow < 0 || nextRow > 5 || nextCol < 0 || nextCol > 6) break
        const cell = nextRow * 7 + nextCol
        if (board[cell] !== player) break
        cells.push(cell)
      }
    }
    if (cells.length >= 4) lines.push(cells.sort((a, b) => a - b))
  }
  return lines
}

function snapshot(game: ConnectFour, columns: readonly ConnectFourMove[], landingCell: number | null): ConnectFourPosition {
  const board = game.board
  const playedPlayer: ConnectFourPlayer = columns.length % 2 === 1 ? 'one' : 'two'
  const nextPlayer: ConnectFourPlayer = columns.length % 2 === 0 ? 'one' : 'two'
  const lines = landingCell === null ? [] : winningLinesFrom(board, landingCell, playedPlayer === 'one' ? 1 : 2)
  const winner = lines.length > 0 ? playedPlayer : null
  const libraryWinner = game.gameWinner === 'ONE' ? 'one' : game.gameWinner === 'TWO' ? 'two' : null
  if (winner !== libraryWinner) throw new Error('Connect Four library winner disagrees with board')
  const outcome: ConnectFourBoardOutcome = winner
    ? { kind: 'win', winner, winningLines: lines }
    : board.every(cell => cell !== 0) ? { kind: 'draw' } : { kind: 'ongoing' }
  if (game.isGameOver !== (outcome.kind !== 'ongoing')) throw new Error('Connect Four library terminal state disagrees with board')
  return { board, columns: [...columns], nextPlayer, outcome, winningLines: lines }
}

export function reconstructPosition(columns: readonly ConnectFourMove[]): ConnectFourPosition {
  const game = new ConnectFour()
  let landingCell: number | null = null
  for (const column of columns) {
    if (!isColumn(column) || game.isGameOver) throw new RangeError('Illegal Connect Four move sequence')
    const landing = game.makeMove(column)
    landingCell = landing.row * 7 + landing.col
  }
  return snapshot(game, columns, landingCell)
}

export function applyMove(position: ConnectFourPosition, move: ConnectFourMove): ConnectFourPosition {
  if (!isLegalMove(position, move)) throw new RangeError('Illegal Connect Four move')
  return reconstructPosition([...position.columns, move])
}

export const connectFourRules: RulesAdapter<ConnectFourPosition, ConnectFourMove, ConnectFourPlayer> = {
  initialPosition, legalMoves, applyMove, reconstructPosition, sideToMove,
}
