import type { ConnectFourMatch, ConnectFourMatchEnvelope, ConnectFourPosition, ConnectFourSetup, ConnectFourViewState } from '../../src/contracts'

/** Hand-authored fixture values: no rules adapter or package engine is used here. */
export const allSetups = [
  { humanColor: 'red', humanOrder: 'first' },
  { humanColor: 'yellow', humanOrder: 'first' },
  { humanColor: 'red', humanOrder: 'second' },
  { humanColor: 'yellow', humanOrder: 'second' },
] as const satisfies readonly ConnectFourSetup[]

export const emptyPosition: ConnectFourPosition = {
  board: [
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ],
  columns: [], nextPlayer: 'one', outcome: { kind: 'ongoing' }, winningLines: [],
}

export const twoMovePosition: ConnectFourPosition = {
  board: [
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    1, 2, 0, 0, 0, 0, 0,
  ],
  columns: [0, 1], nextPlayer: 'one', outcome: { kind: 'ongoing' }, winningLines: [],
}

/** Yellow opens; red is the CPU, proving color and player identity are independent. */
export const yellowFirstMatch: ConnectFourMatch = {
  gameId: 'connect-four', id: 'fixture-yellow-first', setup: allSetups[1],
  moves: [
    { ply: 1, column: 0, landingCell: 35, player: 'one', color: 'yellow', actor: 'human', provenance: 'human' },
    { ply: 2, column: 1, landingCell: 36, player: 'two', color: 'red', actor: 'cpu', provenance: 'rng' },
  ],
  position: twoMovePosition, outcome: { kind: 'ongoing' },
}

/** CPU opens as player one; red human plays second. */
export const redSecondMatch: ConnectFourMatch = {
  gameId: 'connect-four', id: 'fixture-red-second', setup: allSetups[2],
  moves: [
    { ply: 1, column: 0, landingCell: 35, player: 'one', color: 'yellow', actor: 'cpu', provenance: 'rng' },
    { ply: 2, column: 1, landingCell: 36, player: 'two', color: 'red', actor: 'human', provenance: 'human' },
  ],
  position: twoMovePosition, outcome: { kind: 'ongoing' },
}

export const emptyReviewView: ConnectFourViewState = {
  location: { mode: 'review', selectedPly: null }, pendingColumn: null,
  mobileHistoryOpen: false, resignationDialogOpen: false,
}

/** Live match retains two moves while the view shows only the first placement. */
export const reviewingFirstMoveView: ConnectFourViewState = {
  location: { mode: 'review', selectedPly: 1 }, pendingColumn: null,
  mobileHistoryOpen: true, resignationDialogOpen: false,
}

export const yellowFirstSave: ConnectFourMatchEnvelope = {
  schemaVersion: 1, match: yellowFirstMatch, recovery: { consecutiveInvalid: 0 },
}
