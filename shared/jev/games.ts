import type { ConnectFourJevState, SerializedGameState, TicTacToeJevState } from '../../src/contracts/jev.ts'

export interface JevCriterion { readonly id: string; readonly description: string }

const TTT_COORDINATES = 'Columns A-C left to right; rows 3-1 top to bottom; null is empty'
const C4_COORDINATES = 'Columns A-G left to right; rows 6-1 top to bottom; 0 empty, 1 player one, 2 player two'
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const rows = (v: unknown, n: number, m: number, cell: (v: unknown) => boolean): v is unknown[][] => Array.isArray(v) && v.length === n && v.every(r => Array.isArray(r) && r.length === m && r.every(cell))

/** Pure, runtime-neutral legality gate for the relay's trusted prompt builder. */
export function validateJevGameState(value: unknown): value is SerializedGameState {
  if (!record(value)) return false
  if (value.game === 'tic-tac-toe') {
    if (!exact(value, ['game', 'board', 'sideToMove', 'cpuSide', 'coordinates']) || value.coordinates !== TTT_COORDINATES ||
      !rows(value.board, 3, 3, c => c === 'X' || c === 'O' || c === null)) return false
    const board = value.board.flat()
    const x = board.filter(c => c === 'X').length
    const o = board.filter(c => c === 'O').length
    return x >= o && x <= o + 1 && value.sideToMove === (x === o ? 'X' : 'O') &&
      value.cpuSide === value.sideToMove && board.some(c => c === null) &&
      !LINES.some(line => line.every(i => board[i] === 'X') || line.every(i => board[i] === 'O'))
  }
  if (value.game === 'connect-four') {
    if (!exact(value, ['game', 'board', 'sideToMove', 'cpuSide', 'colors', 'coordinates']) || value.coordinates !== C4_COORDINATES ||
      !rows(value.board, 6, 7, c => c === 0 || c === 1 || c === 2) || !record(value.colors) ||
      !exact(value.colors, ['one', 'two']) || !['red', 'yellow'].includes(value.colors.one as string) ||
      !['red', 'yellow'].includes(value.colors.two as string) || value.colors.one === value.colors.two) return false
    const board = value.board.flat() as number[]
    const one = board.filter(c => c === 1).length
    const two = board.filter(c => c === 2).length
    if (one < two || one > two + 1 || value.sideToMove !== (one === two ? 'one' : 'two') ||
      value.cpuSide !== value.sideToMove || !board.slice(0, 7).some(c => c === 0)) return false
    for (let col = 0; col < 7; col++) for (let row = 0; row < 5; row++) {
      if (board[row * 7 + col] !== 0 && board[(row + 1) * 7 + col] === 0) return false
    }
    for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
      const player = board[row * 7 + col]
      if (!player) continue
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        if ([0, 1, 2, 3].every(step => board[(row + dr * step) * 7 + col + dc * step] === player &&
          row + dr * step < 6 && col + dc * step >= 0 && col + dc * step < 7)) return false
      }
    }
    return true
  }
  return false
}

export function legalMoveIdsForState(state: SerializedGameState): string[] {
  if (!validateJevGameState(state)) return []
  return state.game === 'tic-tac-toe'
    ? state.board.flat().flatMap((cell, i) => cell === null ? [`cell-${i}`] : [])
    : state.board[0].flatMap((cell, i) => cell === 0 ? [`column-${i}`] : [])
}

/** Jev prompt v1: top-origin rows, ascending cell or column order. */
export function criteriaForState(state: SerializedGameState): JevCriterion[] {
  const ids = legalMoveIdsForState(state)
  return state.game === 'tic-tac-toe'
    ? ids.map(id => {
      const i = Number(id.slice(5))
      return { id, description: `Place ${state.cpuSide} at ${String.fromCharCode(65 + i % 3)}${3 - Math.floor(i / 3)}.` }
    })
    : ids.map(id => {
      const col = Number(id.slice(7))
      let landingRow = 5
      while (landingRow >= 0 && state.board[landingRow][col] !== 0) landingRow--
      const letter = String.fromCharCode(65 + col)
      return { id, description: `Drop ${state.colors[state.cpuSide]} (player ${state.cpuSide}) in column ${letter}; it lands at ${letter}${6 - landingRow}.` }
    })
}

export const TIC_TAC_TOE_COORDINATES: TicTacToeJevState['coordinates'] = TTT_COORDINATES
export const CONNECT_FOUR_COORDINATES: ConnectFourJevState['coordinates'] = C4_COORDINATES
