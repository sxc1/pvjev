import { describe, expect, it } from 'vitest'
import { ConnectFour, ConnectFourData } from '@devshareacademy/connect-four'

const multiLine = [5, 3, 0, 3, 5, 0, 0, 1, 3, 0, 1, 3, 2, 3, 3, 1, 4, 5, 2, 6, 6, 1, 4, 0, 4, 0, 2, 4, 4, 5, 2]
const lastMoveWin = [5, 5, 1, 6, 0, 3, 2, 1, 6, 3, 3, 2, 3, 2, 0, 6, 4, 1, 5, 0, 1, 6, 1, 2, 2, 1, 6, 2, 4, 3, 3, 5, 5, 6, 0, 5, 0, 0, 4, 4, 4, 4]

function play(columns: number[]) {
  const game = new ConnectFour()
  for (const column of columns) game.makeMove(column)
  return game
}

describe('published Connect Four artifact qualification', () => {
  it('uses a 42-cell top-origin board and lands the first move at A1', () => {
    const game = new ConnectFour()
    expect(game.board).toHaveLength(42)
    expect(game.board.every((cell) => cell === 0)).toBe(true)
    expect(game.playersTurn).toBe(ConnectFourData.PLAYER.ONE)
    const landing: ConnectFourData.Coordinate = game.makeMove(0)
    expect(landing).toEqual({ row: 5, col: 0 })
    expect(game.board[35]).toBe(1)
    expect(game.board[0]).toBe(0)
    expect(game.playersTurn).toBe(ConnectFourData.PLAYER.TWO)
    expect(game.moveHistory).toEqual([0])
  })

  it('rejects a filled column and out-of-range columns', () => {
    const game = play([0, 0, 0, 0, 0, 0])
    expect(game.board[0]).toBe(2)
    expect(() => game.makeMove(0)).toThrow(ConnectFourData.CONNECT_FOUR_ERROR.INVALID_MOVE)
    for (const column of [-1, 8]) {
      expect(() => game.makeMove(column)).toThrow(ConnectFourData.CONNECT_FOUR_ERROR.INVALID_COLUMN)
    }
    // Published 0.2.1 incorrectly accepts 7 at its range check; the adapter must reject it.
    expect(() => game.makeMove(7)).toThrow(ConnectFourData.CONNECT_FOUR_ERROR.INVALID_MOVE)
    expect(game.moveHistory).toHaveLength(6)
  })

  it('ends a game on a win and refuses post-terminal moves', () => {
    const game = play([0, 6, 1, 6, 2, 5, 3])
    expect(game.isGameOver).toBe(true)
    expect(game.gameWinner).toBe(ConnectFourData.PLAYER.ONE)
    expect(game.winningCells).toEqual([{ row: 5, col: 0 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }])
    expect(() => game.makeMove(4)).toThrow(ConnectFourData.CONNECT_FOUR_ERROR.INVALID_MOVE_GAME_IS_OVER)
  })

  it('reports one line for a final move that forms two lines', () => {
    const game = play(multiLine.slice(0, -1))
    expect(game.isGameOver).toBe(false)
    expect(game.makeMove(multiLine.at(-1)!)).toEqual({ row: 2, col: 2 })
    expect(game.gameWinner).toBe(ConnectFourData.PLAYER.ONE)
    expect(game.winningCells).toHaveLength(4)
    const board = game.board
    expect([16, 23, 30, 37].map((cell) => board[cell])).toEqual([1, 1, 1, 1])
    expect([16, 24, 32, 40].map((cell) => board[cell])).toEqual([1, 1, 1, 1])
  })

  it('recognizes a win on the 42nd placement ahead of a full-board draw', () => {
    const game = play(lastMoveWin.slice(0, -1))
    expect(game.isGameOver).toBe(false)
    expect(game.moveHistory).toHaveLength(41)
    expect(game.makeMove(4)).toEqual({ row: 0, col: 4 })
    expect(game.board.every((cell) => cell !== 0)).toBe(true)
    expect(game.isGameOver).toBe(true)
    expect(game.gameWinner).toBe(ConnectFourData.PLAYER.TWO)
    expect(game.winningCells).toEqual([{ row: 3, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 3 }, { row: 0, col: 4 }])
  })
})
