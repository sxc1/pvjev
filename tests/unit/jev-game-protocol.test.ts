import { describe, expect, it } from 'vitest'
import { validateJevGameState, legalMoveIdsForState, criteriaForState } from '../../shared/jev/games'
import { validateJevChoice } from '../../shared/jev/choice'
import * as tic from '../../src/games/tic-tac-toe/rules'
import * as four from '../../src/games/connect-four/rules'
import { serializeTicTacToeForJev, ticTacToeMoveFromJevId } from '../../src/games/tic-tac-toe/jev'
import { serializeConnectFourForJev, connectFourMoveFromJevId } from '../../src/games/connect-four/jev'

function playTic(moves: number[]) { return tic.reconstructPosition(moves) }
function playFour(moves: number[]) { return four.reconstructPosition(moves) }

describe('Jev game protocol', () => {
  it('serializes both Tic Tac Toe sides in row-major order and matches adapter legality', () => {
    for (const moves of [[], [0], [0, 4], [0, 4, 8, 2]]) {
      const position = playTic(moves)
      const state = serializeTicTacToeForJev(position, position.nextSymbol)
      expect(validateJevGameState(state)).toBe(true)
      expect(legalMoveIdsForState(state).map(ticTacToeMoveFromJevId)).toEqual(tic.legalMoves(position))
    }
    const position = playTic([])
    const criteria = criteriaForState(serializeTicTacToeForJev(position, 'X'))
    expect(criteria).toHaveLength(9)
    expect(criteria[0]).toEqual({ id: 'cell-0', description: 'Place X at A3.' })
    expect(criteria[8]).toEqual({ id: 'cell-8', description: 'Place X at C1.' })
    expect(validateJevGameState(serializeTicTacToeForJev(playTic([0, 3, 1, 4, 2]), 'O'))).toBe(false)
  })

  it('serializes Connect Four colors, full columns and landing coordinates with adapter parity', () => {
    for (const moves of [[], [0], [0, 1], [0, 1, 0, 1, 0, 2]]) {
      const position = playFour(moves)
      for (const color of ['red', 'yellow'] as const) {
        const state = serializeConnectFourForJev(position, position.nextPlayer, color)
        expect(validateJevGameState(state)).toBe(true)
        expect(legalMoveIdsForState(state).map(connectFourMoveFromJevId)).toEqual(four.legalMoves(position))
        expect(state.colors.one).toBe(color)
        expect(state.colors.two).not.toBe(color)
      }
    }
    const full = playFour([0, 0, 0, 0, 0, 0])
    const state = serializeConnectFourForJev(full, full.nextPlayer, 'red')
    expect(legalMoveIdsForState(state)).not.toContain('column-0')
    expect(criteriaForState(state).find(c => c.id === 'column-1')?.description).toBe('Drop red (player one) in column B; it lands at B1.')
    const terminal = playFour([0, 1, 0, 1, 0, 1, 0])
    expect(validateJevGameState(serializeConnectFourForJev(terminal, terminal.nextPlayer, 'red'))).toBe(false)
    const floating = { ...state, board: state.board.map(row => [...row]) }
    floating.board[4][2] = 1
    expect(validateJevGameState(floating)).toBe(false)
  })
})

describe('Jev Choice validation', () => {
  const ids = ['cell-0', 'cell-1', 'cell-2']
  const valid = { choice: 'cell-0', confidence: 0.742, probabilities: { 'cell-0': 0.5, 'cell-1': 0.3, 'cell-2': 0.2 }, resolvedModelId: 'jev-resolved' }
  it('retains unrounded scores and rejects malformed numeric data', () => {
    expect(validateJevChoice(valid, ids)?.analysis.confidence).toBe(0.742)
    for (const bad of [NaN, Infinity, -0.1, 1.1, '0.5']) {
      expect(validateJevChoice({ ...valid, confidence: bad }, ids)).toBeNull()
      expect(validateJevChoice({ ...valid, probabilities: { ...valid.probabilities, 'cell-0': bad } }, ids)).toBeNull()
    }
    expect(validateJevChoice({ ...valid, probabilities: { 'cell-0': 0.5, 'cell-1': 0.5 } }, ids)).toBeNull()
    expect(validateJevChoice({ ...valid, probabilities: { ...valid.probabilities, extra: 0 } }, ids)).toBeNull()
    expect(validateJevChoice({ ...valid, choice: 'cell-1' }, ids)).toBeNull()
  })
  it('uses absolute sum tolerance and exact legal-order ties', () => {
    expect(validateJevChoice({ ...valid, probabilities: { 'cell-0': 0.5 + 1e-6, 'cell-1': 0.3, 'cell-2': 0.2 } }, ids)).not.toBeNull()
    expect(validateJevChoice({ ...valid, probabilities: { 'cell-0': 0.5 + 1.1e-6, 'cell-1': 0.3, 'cell-2': 0.2 } }, ids)).toBeNull()
    const tie = validateJevChoice({ ...valid, choice: 'cell-2', probabilities: { 'cell-0': 0.4, 'cell-1': 0.2, 'cell-2': 0.4 } }, ids)
    expect(tie?.moveId).toBe('cell-0')
    expect(tie?.analysis.tie).toEqual({ count: 2, selectedMoveId: 'cell-0' })
    expect(tie?.analysis.choices.map(c => c.moveId)).toEqual(['cell-0', 'cell-2', 'cell-1'])
    expect(validateJevChoice({ ...valid, choice: 'cell-2', probabilities: { 'cell-0': 0.400000001, 'cell-1': 0.199999999, 'cell-2': 0.4 } }, ids)).toBeNull()
  })
})
