import { describe, expect, it } from 'vitest'
import { applyMove, initialPosition, isColumn, isLegalMove, legalMoves, reconstructPosition, sideToMove } from '../../src/games/connect-four/rules'
import { cellCoordinate, historyLabel, moveLabel } from '../../src/games/connect-four/notation'

const diagonalDown = [1,1,4,0,6,4,0,3,4,5,0,0,3,3,3,5,5,1,2,3,4,5,0,1,3,6,2,6,1,4,5,2,4,0,5,2]
const diagonalUp = [6,3,4,3,6,1,1,2,1,4,2,2,0,1,0,4,3,0,2,6,1,2,4,3,4,3,1,5,5,6,5,4,6,6,3,0,0,2,5,0,5]
const multiLine = [5,3,0,3,5,0,0,1,3,0,1,3,2,3,3,1,4,5,2,6,6,1,4,0,4,0,2,4,4,5,2]
const draw = [5,4,3,6,2,2,6,0,1,4,3,3,4,5,2,4,2,2,4,0,6,4,6,6,0,2,5,3,1,6,3,0,3,5,0,0,5,5,1,1,1,1]
const lastMoveWin = [5,5,1,6,0,3,2,1,6,3,3,2,3,2,0,6,4,1,5,0,1,6,1,2,2,1,6,2,4,3,3,5,5,6,0,5,0,0,4,4,4,4]
const longRun = [1,2,3,0,3,4,3,3,1,1,4,4,5,1,3,3,1,4,0,1,4,2,4,2,5,6,0,5,2]

describe('C2 Connect Four rules', () => {
  it('validates columns and uses a fresh immutable position for each move', () => {
    const empty = initialPosition()
    expect(empty.board).toHaveLength(42)
    expect(empty.columns).toEqual([])
    expect(sideToMove(empty)).toBe('one')
    expect(legalMoves(empty)).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const invalid of [-1, 7, 0.5, NaN, Infinity, '0', null]) {
      expect(isColumn(invalid)).toBe(false)
      expect(isLegalMove(empty, invalid)).toBe(false)
      expect(() => applyMove(empty, invalid as number)).toThrow(RangeError)
    }
    const first = applyMove(empty, 0)
    expect(first.board[35]).toBe(1)
    expect(first.columns).toEqual([0])
    expect(first.nextPlayer).toBe('two')
    expect(empty.board[35]).toBe(0)
    expect(empty.columns).toEqual([])
    expect(reconstructPosition([0])).toEqual(first)
    const frozen = Object.freeze({ ...first, board: Object.freeze([...first.board]), columns: Object.freeze([...first.columns]) })
    expect(applyMove(frozen, 1).board[36]).toBe(2)
    expect(frozen.board[36]).toBe(0)
  })

  it('checks full columns, both player identities, terminal rejection, and prefix replay', () => {
    const filled = reconstructPosition([0,0,0,0,0,0])
    expect(filled.board.slice(0, 42).filter(Boolean)).toHaveLength(6)
    expect(legalMoves(filled)).toEqual([1,2,3,4,5,6])
    expect(() => applyMove(filled, 0)).toThrow(RangeError)
    const oneWin = reconstructPosition([0,6,1,6,2,5,3])
    const twoWin = reconstructPosition([6,0,6,1,5,2,5,3])
    expect(oneWin.outcome).toMatchObject({ kind: 'win', winner: 'one' })
    expect(twoWin.outcome).toMatchObject({ kind: 'win', winner: 'two' })
    for (const terminal of [oneWin, twoWin]) {
      expect(sideToMove(terminal)).toBeNull()
      expect(legalMoves(terminal)).toEqual([])
      expect(() => applyMove(terminal, 4)).toThrow(RangeError)
      expect(() => reconstructPosition([...terminal.columns, 4])).toThrow(RangeError)
    }
  })

  it('finds valid horizontal, vertical, and both diagonal runs', () => {
    const cases = [
      [0,6,1,6,2,5,3],
      [0,1,0,1,0,1,0],
      diagonalDown,
      diagonalUp,
    ]
    for (const moves of cases) {
      const prefix = reconstructPosition(moves.slice(0, -1))
      expect(prefix.outcome.kind).toBe('ongoing')
      const final = reconstructPosition(moves)
      expect(final.outcome.kind).toBe('win')
      expect(final.winningLines.length).toBeGreaterThan(0)
      expect(final.winningLines.some(line => line.length >= 4)).toBe(true)
    }
  })

  it('handles intersecting lines, a draw, and a 42nd-move win', () => {
    const intersecting = reconstructPosition(multiLine)
    expect(intersecting.outcome).toMatchObject({ kind: 'win', winner: 'one' })
    expect(intersecting.winningLines).toContainEqual([16,23,30,37])
    expect(intersecting.winningLines).toContainEqual([16,24,32,40])
    const drawn = reconstructPosition(draw)
    expect(drawn.outcome).toEqual({ kind: 'draw' })
    expect(drawn.winningLines).toEqual([])
    const final = reconstructPosition(lastMoveWin)
    expect(final.outcome).toMatchObject({ kind: 'win', winner: 'two' })
    expect(final.board.every(cell => cell !== 0)).toBe(true)
    expect(final.winningLines).toContainEqual([4,10,16,22])
    const long = reconstructPosition(longRun)
    expect(long.outcome.kind).toBe('win')
    expect(long.winningLines.some(line => line.length >= 5)).toBe(true)
  })
})

describe('C2 Connect Four notation', () => {
  it('maps top-origin indices and color suffixes', () => {
    expect([0,6,35,41].map(cellCoordinate)).toEqual(['A6','G6','A1','G1'])
    expect(moveLabel(1,'yellow')).toBe('1y')
    expect(moveLabel(2,'red')).toBe('1r')
    expect(historyLabel({ ply: 2, color: 'red', landingCell: 36 })).toBe('1r B1')
    expect(() => cellCoordinate(42)).toThrow(RangeError)
  })
})
