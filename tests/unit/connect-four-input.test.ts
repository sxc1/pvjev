import { describe, expect, it } from 'vitest'
import { columnAtPoint, landingCell, legalColumn } from '../../src/games/connect-four/input'
import { emptyPosition, twoMovePosition } from '../fixtures/connect-four'

describe('Connect Four board input', () => {
  const bounds = { left: 20, top: 30, width: 70, height: 60 }
  it('uses seven bands and rejects every outside edge', () => {
    expect(columnAtPoint(bounds, 20, 30)).toBe(0)
    expect(columnAtPoint(bounds, 29.99, 89.99)).toBe(0)
    expect(columnAtPoint(bounds, 30, 50)).toBe(1)
    expect(columnAtPoint(bounds, 89.99, 50)).toBe(6)
    for (const [x, y] of [[19.9, 50], [90, 50], [40, 29.9], [40, 90]]) expect(columnAtPoint(bounds, x, y)).toBeNull()
  })
  it('rejects full columns and finds the gravity landing cell', () => {
    expect(landingCell(emptyPosition.board, 0)).toBe(35)
    expect(landingCell(twoMovePosition.board, 0)).toBe(28)
    const full = [...emptyPosition.board]
    for (let row = 0; row < 6; row++) full[row * 7] = 1
    expect(legalColumn(full, 0)).toBe(false)
    expect(landingCell(full, 0)).toBeNull()
    expect(landingCell(full, 1)).toBe(36)
  })
})
