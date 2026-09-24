import { describe, expect, it } from 'vitest'
import type { TicTacToeMove, TicTacToePosition, TicTacToeSymbol } from '../../src/contracts'
import {
  applyMove, initialPosition, isCellIndex, isLegalMove, legalMoves,
  reconstructPosition, sideToMove, WINNING_LINES,
} from '../../src/games/tic-tac-toe/rules'
import { cellCoordinate, historyLabel, moveLabel } from '../../src/games/tic-tac-toe/notation'

// This independent, explicit fixture is used to check every reached position.
const expectedLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function expectedWinningLines(position: TicTacToePosition) {
  return expectedLines.filter(line =>
    position.board[line[0]] !== null &&
    position.board[line[0]] === position.board[line[1]] &&
    position.board[line[1]] === position.board[line[2]],
  )
}

describe('T2 rules', () => {
  it('opens as X and rejects occupied, malformed, and post-terminal moves', () => {
    const empty = initialPosition()
    expect(empty.board).toEqual(Array(9).fill(null))
    expect(empty.nextSymbol).toBe('X')
    expect(sideToMove(empty)).toBe('X')
    expect(legalMoves(empty)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(WINNING_LINES).toEqual(expectedLines)

    for (const invalid of [-1, 9, 0.5, NaN, Infinity, '0', null, undefined]) {
      expect(isCellIndex(invalid)).toBe(false)
      expect(isLegalMove(empty, invalid)).toBe(false)
      expect(() => applyMove(empty, invalid as TicTacToeMove)).toThrow(RangeError)
    }

    const afterFirst = applyMove(empty, 0)
    expect(afterFirst.board[0]).toBe('X')
    expect(afterFirst.nextSymbol).toBe('O')
    expect(empty.board[0]).toBeNull()
    expect(() => applyMove(afterFirst, 0)).toThrow(RangeError)
    expect(() => reconstructPosition([0, 0])).toThrow(RangeError)

    const win = reconstructPosition([0, 3, 1, 4, 2])
    expect(win.outcome).toEqual({ kind: 'win', winner: 'X', winningLines: [[0, 1, 2]] })
    expect(legalMoves(win)).toEqual([])
    expect(sideToMove(win)).toBeNull()
    expect(() => applyMove(win, 5)).toThrow(RangeError)
    expect(() => reconstructPosition([0, 3, 1, 4, 2, 5])).toThrow(RangeError)
  })

  it('checks every reachable board and every row, column, and diagonal for both symbols', () => {
    const stack: Array<{ position: TicTacToePosition; history: number[] }> = [{ position: initialPosition(), history: [] }]
    const seen = new Set<string>()
    const observedWins = new Set<string>()
    let doubleLineWins = 0
    let ninthCellWins = 0
    let draws = 0

    while (stack.length > 0) {
      const { position, history } = stack.pop()!
      const key = position.board.map(cell => cell ?? '-').join('')
      if (seen.has(key)) continue
      seen.add(key)

      const xCount = position.board.filter(cell => cell === 'X').length
      const oCount = position.board.filter(cell => cell === 'O').length
      expect(xCount).toBe(Math.ceil(history.length / 2))
      expect(oCount).toBe(Math.floor(history.length / 2))
      expect(xCount + oCount).toBe(history.length)
      expect(position.nextSymbol).toBe(history.length % 2 === 0 ? 'X' : 'O')

      const lines = expectedWinningLines(position)
      expect(position.winningLines).toEqual(lines)
      if (lines.length > 0) {
        const winner = position.board[lines[0][0]] as TicTacToeSymbol
        expect(lines.every(line => position.board[line[0]] === winner)).toBe(true)
        expect(position.outcome).toEqual({ kind: 'win', winner, winningLines: lines })
        for (const line of lines) observedWins.add(`${winner}:${line.join(',')}`)
        if (lines.length > 1) doubleLineWins += 1
        if (history.length === 9) ninthCellWins += 1
      } else if (history.length === 9) {
        expect(position.outcome).toEqual({ kind: 'draw' })
        draws += 1
      } else {
        expect(position.outcome).toEqual({ kind: 'ongoing' })
      }

      const expectedLegal = position.outcome.kind === 'ongoing'
        ? position.board.flatMap((cell, index) => cell === null ? [index] : [])
        : []
      expect(legalMoves(position)).toEqual(expectedLegal)
      expect(sideToMove(position)).toBe(position.outcome.kind === 'ongoing' ? position.nextSymbol : null)
      expect(reconstructPosition(history)).toEqual(position)

      for (const move of expectedLegal) {
        const next = applyMove(position, move)
        expect(next.board.filter((cell, index) => cell !== position.board[index]).length).toBe(1)
        expect(next.board[move]).toBe(position.nextSymbol)
        stack.push({ position: next, history: [...history, move] })
      }
    }

    expect(seen.size).toBeGreaterThan(5000)
    expect(observedWins.size).toBe(16)
    expect(doubleLineWins).toBeGreaterThan(0)
    expect(ninthCellWins).toBeGreaterThan(0)
    expect(draws).toBeGreaterThan(0)
  })
})

describe('T2 notation', () => {
  it('maps all nine row-major cells and every individual ply', () => {
    expect(Array.from({ length: 9 }, (_, cell) => cellCoordinate(cell))).toEqual([
      'A3', 'B3', 'C3', 'A2', 'B2', 'C2', 'A1', 'B1', 'C1',
    ])
    expect(Array.from({ length: 9 }, (_, index) => moveLabel(index + 1, index % 2 === 0 ? 'X' : 'O')))
      .toEqual(['1x', '1o', '2x', '2o', '3x', '3o', '4x', '4o', '5x'])
    expect(historyLabel(1, 'X', 6)).toBe('1x A1')
    expect(historyLabel(2, 'O', 2)).toBe('1o C3')
    expect(() => cellCoordinate(9)).toThrow(RangeError)
    expect(() => moveLabel(0, 'X')).toThrow(RangeError)
    expect(() => moveLabel(10, 'O')).toThrow(RangeError)
    expect(() => moveLabel(1, 'O')).toThrow(RangeError)
  })
})
