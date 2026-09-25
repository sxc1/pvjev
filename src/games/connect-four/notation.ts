import type { ConnectFourColor, ConnectFourMoveRecord } from '../../contracts'

export function cellCoordinate(cell: number): string {
  if (!Number.isInteger(cell) || cell < 0 || cell > 41) throw new RangeError('Invalid Connect Four cell')
  return `${'ABCDEFG'[cell % 7]}${6 - Math.floor(cell / 7)}`
}

export function moveLabel(ply: number, color: ConnectFourColor): string {
  if (!Number.isInteger(ply) || ply < 1 || ply > 42) throw new RangeError('Invalid Connect Four ply')
  if (color !== 'red' && color !== 'yellow') throw new RangeError('Invalid Connect Four color')
  return `${Math.ceil(ply / 2)}${color === 'red' ? 'r' : 'y'}`
}

export function historyLabel(record: Pick<ConnectFourMoveRecord, 'ply' | 'color' | 'landingCell'>): string {
  return `${moveLabel(record.ply, record.color)} ${cellCoordinate(record.landingCell)}`
}
