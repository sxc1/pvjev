import type { CpuChoice, CpuProvider, MatchEnvelope, SettingsEnvelope, TicTacToeMatch, TicTacToeMove, TicTacToePosition } from '../../src/contracts'

/** Hand-authored expected states: these fixtures intentionally do not call game rules. */
export const emptyPosition: TicTacToePosition = {
  board: [null, null, null, null, null, null, null, null, null],
  nextSymbol: 'X', outcome: { kind: 'ongoing' }, winningLines: [],
}

export const humanTurnMatch: TicTacToeMatch = {
  gameId: 'tic-tac-toe', id: 'fixture-human-turn', humanSymbol: 'X',
  moves: [
    { ply: 1, symbol: 'X', cell: 0, actor: 'human', provenance: 'human' },
    { ply: 2, symbol: 'O', cell: 4, actor: 'cpu', provenance: 'rng' },
  ],
  position: { board: ['X', null, null, null, 'O', null, null, null, null], nextSymbol: 'X', outcome: { kind: 'ongoing' }, winningLines: [] },
  outcome: { kind: 'ongoing' },
}

export const cpuTurnMatch: TicTacToeMatch = {
  gameId: 'tic-tac-toe', id: 'fixture-cpu-turn', humanSymbol: 'X',
  moves: [{ ply: 1, symbol: 'X', cell: 0, actor: 'human', provenance: 'human' }],
  position: { board: ['X', null, null, null, null, null, null, null, null], nextSymbol: 'O', outcome: { kind: 'ongoing' }, winningLines: [] },
  outcome: { kind: 'ongoing' },
}

export const wonMatch: TicTacToeMatch = {
  gameId: 'tic-tac-toe', id: 'fixture-win', humanSymbol: 'X',
  moves: [
    { ply: 1, symbol: 'X', cell: 0, actor: 'human', provenance: 'human' },
    { ply: 2, symbol: 'O', cell: 3, actor: 'cpu', provenance: 'rng' },
    { ply: 3, symbol: 'X', cell: 1, actor: 'human', provenance: 'human' },
    { ply: 4, symbol: 'O', cell: 4, actor: 'cpu', provenance: 'rng' },
    { ply: 5, symbol: 'X', cell: 2, actor: 'human', provenance: 'human' },
  ],
  position: { board: ['X', 'X', 'X', 'O', 'O', null, null, null, null], nextSymbol: 'O', outcome: { kind: 'win', winner: 'X', winningLines: [[0, 1, 2]] }, winningLines: [[0, 1, 2]] },
  outcome: { kind: 'win', winner: 'X', winningLines: [[0, 1, 2]] },
}

export const drawnMatch: TicTacToeMatch = {
  gameId: 'tic-tac-toe', id: 'fixture-draw', humanSymbol: 'X',
  moves: [
    { ply: 1, symbol: 'X', cell: 0, actor: 'human', provenance: 'human' },
    { ply: 2, symbol: 'O', cell: 1, actor: 'cpu', provenance: 'rng' },
    { ply: 3, symbol: 'X', cell: 2, actor: 'human', provenance: 'human' },
    { ply: 4, symbol: 'O', cell: 4, actor: 'cpu', provenance: 'rng' },
    { ply: 5, symbol: 'X', cell: 3, actor: 'human', provenance: 'human' },
    { ply: 6, symbol: 'O', cell: 5, actor: 'cpu', provenance: 'rng' },
    { ply: 7, symbol: 'X', cell: 7, actor: 'human', provenance: 'human' },
    { ply: 8, symbol: 'O', cell: 6, actor: 'cpu', provenance: 'rng' },
    { ply: 9, symbol: 'X', cell: 8, actor: 'human', provenance: 'human' },
  ],
  position: { board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'], nextSymbol: 'O', outcome: { kind: 'draw' }, winningLines: [] },
  outcome: { kind: 'draw' },
}

export const resignedMatch: TicTacToeMatch = {
  gameId: 'tic-tac-toe', id: 'fixture-resigned', humanSymbol: 'X',
  moves: [{ ply: 1, symbol: 'X', cell: 0, actor: 'human', provenance: 'human' }],
  position: { board: ['X', null, null, null, null, null, null, null, null], nextSymbol: 'O', outcome: { kind: 'ongoing' }, winningLines: [] },
  outcome: { kind: 'resignation', resigningSymbol: 'X', winner: 'O', ply: 1 },
}

export const validSaves = {
  humanTurn: { schemaVersion: 1, match: humanTurnMatch, recovery: { consecutiveInvalid: 0 } },
  cpuTurnAfterTwoInvalid: { schemaVersion: 1, match: cpuTurnMatch, recovery: { consecutiveInvalid: 2 } },
  win: { schemaVersion: 1, match: wonMatch, recovery: { consecutiveInvalid: 0 } },
  draw: { schemaVersion: 1, match: drawnMatch, recovery: { consecutiveInvalid: 0 } },
  resignation: { schemaVersion: 1, match: resignedMatch, recovery: { consecutiveInvalid: 0 } },
} satisfies Record<string, MatchEnvelope>

export const validSettings = { schemaVersion: 1, settings: { confirmMoves: true } } satisfies SettingsEnvelope

export type ProviderStep =
  | { readonly kind: 'move'; readonly move: TicTacToeMove }
  | { readonly kind: 'invalid'; readonly value: unknown }
  | { readonly kind: 'failure'; readonly message: string }
  | { readonly kind: 'deferred' }

/** A provider script suitable for controller tests, including malformed runtime values. */
export function scriptedProvider(steps: readonly ProviderStep[]) {
  const pending: Array<{ resolve(value: unknown): void; reject(reason: unknown): void }> = []
  let next = 0
  const provider: CpuProvider<TicTacToePosition, TicTacToeMove> = {
    chooseMove: async () => {
      const step = steps[next++]
      if (!step) throw new Error('Provider script exhausted')
      if (step.kind === 'failure') throw new Error(step.message)
      if (step.kind === 'move') return { move: step.move }
      if (step.kind === 'invalid') return step.value as CpuChoice<TicTacToeMove>
      return new Promise<CpuChoice<TicTacToeMove>>((resolve, reject) => {
        pending.push({ resolve: resolve as (value: unknown) => void, reject })
      })
    },
  }
  return {
    provider,
    get calls() { return next },
    get pendingCount() { return pending.length },
    resolveNext(value: unknown) { const attempt = pending.shift(); if (!attempt) throw new Error('No pending attempt'); attempt.resolve(value) },
    rejectNext(reason: unknown) { const attempt = pending.shift(); if (!attempt) throw new Error('No pending attempt'); attempt.reject(reason) },
  }
}
