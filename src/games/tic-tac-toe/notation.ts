import type { TicTacToeMove, TicTacToeSymbol } from '../../contracts'
import { isCellIndex } from './rules'

export function cellCoordinate(cell: TicTacToeMove): string {
  if (!isCellIndex(cell)) throw new RangeError('Invalid tic tac toe cell')
  return `${'ABC'[cell % 3]}${3 - Math.floor(cell / 3)}`
}

export function moveLabel(ply: number, symbol: TicTacToeSymbol): string {
  if (!Number.isInteger(ply) || ply < 1 || ply > 9) throw new RangeError('Invalid tic tac toe ply')
  if (symbol !== 'X' && symbol !== 'O') throw new RangeError('Invalid tic tac toe symbol')
  const expectedSymbol = ply % 2 === 1 ? 'X' : 'O'
  if (symbol !== expectedSymbol) throw new RangeError('Symbol does not match ply')
  return `${Math.ceil(ply / 2)}${symbol.toLowerCase()}`
}

export function historyLabel(ply: number, symbol: TicTacToeSymbol, cell: TicTacToeMove): string {
  return `${moveLabel(ply, symbol)} ${cellCoordinate(cell)}`
}
