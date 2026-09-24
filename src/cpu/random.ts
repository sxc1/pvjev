import type { CpuProvider } from '../contracts'

/** Select one of the supplied legal moves without changing the input. */
export function sampleLegalMove<Move>(
  legalMoves: readonly Move[],
  random: () => number = Math.random,
): Move {
  if (legalMoves.length === 0) {
    throw new RangeError('Cannot sample from an empty legal-move list')
  }

  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a number in [0, 1)')
  }

  return legalMoves[Math.floor(value * legalMoves.length)]
}

/** A local CPU with the same asynchronous contract as future providers. */
export function createRandomCpuProvider<Position, Move>(
  random: () => number = Math.random,
): CpuProvider<Position, Move> {
  return {
    chooseMove: ({ legalMoves, signal }) => Promise.resolve().then(() => {
      if (signal.aborted) {
        throw new DOMException('CPU request aborted', 'AbortError')
      }
      return { move: sampleLegalMove(legalMoves, random) }
    }),
  }
}
