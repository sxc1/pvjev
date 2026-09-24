import type {
  RulesAdapter,
  TicTacToeBoard,
  TicTacToeCell,
  TicTacToeMove,
  TicTacToePosition,
  TicTacToeSymbol,
  TicTacToeWinningLine,
} from '../../contracts'

/** Row-major cells run from A3 (0) to C1 (8). */
export const WINNING_LINES: readonly TicTacToeWinningLine[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

const EMPTY_BOARD: TicTacToeBoard = [
  null, null, null, null, null, null, null, null, null,
]

export function isCellIndex(value: unknown): value is TicTacToeMove {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 8
}

export function isLegalMove(position: TicTacToePosition, move: unknown): move is TicTacToeMove {
  return position.outcome.kind === 'ongoing' && isCellIndex(move) && position.board[move] === null
}

export function initialPosition(): TicTacToePosition {
  return { board: [...EMPTY_BOARD] as unknown as TicTacToeBoard, nextSymbol: 'X', outcome: { kind: 'ongoing' }, winningLines: [] }
}

export function legalMoves(position: TicTacToePosition): readonly TicTacToeMove[] {
  if (position.outcome.kind !== 'ongoing') return []
  const moves: TicTacToeMove[] = []
  for (let cell = 0; cell < 9; cell += 1) {
    if (position.board[cell] === null) moves.push(cell)
  }
  return moves
}

export function sideToMove(position: TicTacToePosition): TicTacToeSymbol | null {
  return position.outcome.kind === 'ongoing' ? position.nextSymbol : null
}

export function applyMove(position: TicTacToePosition, move: TicTacToeMove): TicTacToePosition {
  if (!isLegalMove(position, move)) throw new RangeError('Illegal tic tac toe move')

  const board = [...position.board] as TicTacToeCell[]
  const playedSymbol = position.nextSymbol
  board[move] = playedSymbol
  const winningLines = WINNING_LINES.filter(line => line.every(cell => board[cell] === playedSymbol))
  const outcome = winningLines.length > 0
    ? { kind: 'win' as const, winner: playedSymbol, winningLines }
    : board.every(cell => cell !== null)
      ? { kind: 'draw' as const }
      : { kind: 'ongoing' as const }

  return {
    board: board as unknown as TicTacToeBoard,
    nextSymbol: playedSymbol === 'X' ? 'O' : 'X',
    outcome,
    winningLines,
  }
}

export function reconstructPosition(moves: readonly TicTacToeMove[]): TicTacToePosition {
  return moves.reduce<TicTacToePosition>((position, move) => applyMove(position, move), initialPosition())
}

export const ticTacToeRules: RulesAdapter<TicTacToePosition, TicTacToeMove, TicTacToeSymbol> = {
  initialPosition,
  legalMoves,
  applyMove,
  reconstructPosition,
  sideToMove,
}
