import type { TicTacToePosition, TicTacToeSymbol } from '../../contracts/tic-tac-toe'
import type { TicTacToeJevState } from '../../contracts/jev'
import { TIC_TAC_TOE_COORDINATES, criteriaForState, legalMoveIdsForState } from '../../../shared/jev/games'

/** Jev prompt v1: row-major indices 0–8 map A3 through C1. */
export function serializeTicTacToeForJev(position: TicTacToePosition, cpuSide: TicTacToeSymbol): TicTacToeJevState {
  const board = [0, 1, 2].map(row => position.board.slice(row * 3, row * 3 + 3))
  return { game: 'tic-tac-toe', board, sideToMove: position.nextSymbol, cpuSide, coordinates: TIC_TAC_TOE_COORDINATES }
}

export function ticTacToeJevMoves(position: TicTacToePosition, cpuSide: TicTacToeSymbol) {
  const state = serializeTicTacToeForJev(position, cpuSide)
  return { state, legalMoveIds: legalMoveIdsForState(state), criteria: criteriaForState(state) }
}

export function ticTacToeMoveFromJevId(id: string): number | null {
  if (!/^cell-[0-8]$/.test(id)) return null
  return Number(id.slice(5))
}
