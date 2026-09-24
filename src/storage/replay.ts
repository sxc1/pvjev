import type { TicTacToeBoardOutcome, TicTacToePosition, TicTacToeWinningLine } from '../contracts/tic-tac-toe'
import type { MatchEnvelope } from '../contracts/persistence'
import { applyMove, initialPosition, isLegalMove } from '../games/tic-tac-toe/rules'
import { decodeMatchEnvelope, type DecodeResult } from './index'

const invalid = (reason: string): DecodeResult<MatchEnvelope> => ({ status: 'invalid', reason })

function sameLines(left: readonly TicTacToeWinningLine[], right: readonly TicTacToeWinningLine[]): boolean {
  return left.length === right.length && left.every((line, index) =>
    line.length === right[index].length && line.every((cell, cellIndex) => cell === right[index][cellIndex]))
}

function sameBoardOutcome(left: TicTacToeBoardOutcome, right: TicTacToeBoardOutcome): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'win' && right.kind === 'win') {
    return left.winner === right.winner && sameLines(left.winningLines, right.winningLines)
  }
  return true
}

function samePosition(left: TicTacToePosition, right: TicTacToePosition): boolean {
  return left.nextSymbol === right.nextSymbol &&
    left.board.every((cell, index) => cell === right.board[index]) &&
    sameLines(left.winningLines, right.winningLines) &&
    sameBoardOutcome(left.outcome, right.outcome)
}

/** Replay is authoritative; cached board and outcome are accepted only when they match it. */
export function decodeReplayMatchEnvelope(value: unknown): DecodeResult<MatchEnvelope> {
  const decoded = decodeMatchEnvelope(value)
  if (decoded.status === 'invalid') return decoded

  const { match, recovery } = decoded.value
  if (match.id.trim().length === 0) return invalid('Saved match has an invalid identifier.')
  let position = initialPosition()
  for (const [index, move] of match.moves.entries()) {
    if (move.ply !== index + 1 || move.symbol !== position.nextSymbol) {
      return invalid('Saved moves have an invalid ply or turn order.')
    }
    const expectedActor = move.symbol === match.humanSymbol ? 'human' : 'cpu'
    if (move.actor !== expectedActor) return invalid('Saved move actor does not match the selected side.')
    if (!isLegalMove(position, move.cell)) return invalid('Saved moves contain an illegal continuation.')
    position = applyMove(position, move.cell)
  }

  if (!samePosition(match.position, position)) return invalid('Saved live position does not match move history.')

  if (match.outcome.kind === 'resignation') {
    if (position.outcome.kind !== 'ongoing' || match.outcome.ply !== match.moves.length ||
      match.outcome.resigningSymbol !== match.humanSymbol || match.outcome.winner === match.humanSymbol) {
      return invalid('Saved resignation is not valid for the current position.')
    }
  } else if (!sameBoardOutcome(match.outcome, position.outcome)) {
    return invalid('Saved outcome does not match move history.')
  }

  const cpuTurn = match.outcome.kind === 'ongoing' && position.nextSymbol !== match.humanSymbol
  if (!cpuTurn && recovery.consecutiveInvalid !== 0) {
    return invalid('Saved recovery count is only valid during a CPU turn.')
  }
  return decoded
}
