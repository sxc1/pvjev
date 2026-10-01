import type { ConnectFourColor, ConnectFourPlayer, ConnectFourPosition } from '../../contracts/connect-four'
import type { ConnectFourJevState } from '../../contracts/jev'
import { CONNECT_FOUR_COORDINATES, criteriaForState, legalMoveIdsForState } from '../../../shared/jev/games'

/** Jev prompt v1: top-origin rows A6–G1; criteria use ascending A–G columns. */
export function serializeConnectFourForJev(position: ConnectFourPosition, cpuSide: ConnectFourPlayer, oneColor: ConnectFourColor): ConnectFourJevState {
  const board = [0, 1, 2, 3, 4, 5].map(row => position.board.slice(row * 7, row * 7 + 7))
  return { game: 'connect-four', board, sideToMove: position.nextPlayer, cpuSide,
    colors: { one: oneColor, two: oneColor === 'red' ? 'yellow' : 'red' }, coordinates: CONNECT_FOUR_COORDINATES }
}

export function connectFourJevMoves(position: ConnectFourPosition, cpuSide: ConnectFourPlayer, oneColor: ConnectFourColor) {
  const state = serializeConnectFourForJev(position, cpuSide, oneColor)
  return { state, legalMoveIds: legalMoveIdsForState(state), criteria: criteriaForState(state) }
}

export function connectFourMoveFromJevId(id: string): number | null {
  if (!/^column-[0-6]$/.test(id)) return null
  return Number(id.slice(7))
}
