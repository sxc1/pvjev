/** Jev wire and retained-data contract. This module has no SDK dependency. */
export const JEV_PROTOCOL_VERSION = 1 as const
export const JEV_PROMPT_VERSION = 1 as const
export const JEV_DEADLINE_MS = 5_000 as const
export const JEV_PROBABILITY_SUM_TOLERANCE = 1e-6
export const JEV_RETAINED_CHOICE_LIMIT = 10 as const

export type JevGameId = 'tic-tac-toe' | 'connect-four'
export type OpponentAssignment =
  | { readonly opponent: 'rng' }
  | { readonly opponent: 'jev'; readonly credentialRoute: 'visitor' }
  | { readonly opponent: 'jev'; readonly credentialRoute: 'shared'; readonly approvingUserId: string; readonly accessClass: 'daily' | 'whitelisted' }

export interface JevIdentity {
  readonly protocolVersion: typeof JEV_PROTOCOL_VERSION
  readonly gameId: JevGameId
  readonly matchId: string
  readonly expectedPly: number
  readonly attemptId: string
}
export interface TicTacToeJevState {
  readonly game: 'tic-tac-toe'
  readonly board: readonly (readonly ('X' | 'O' | null)[])[]
  readonly sideToMove: 'X' | 'O'
  readonly cpuSide: 'X' | 'O'
  readonly coordinates: 'Columns A-C left to right; rows 3-1 top to bottom; null is empty'
}
export interface ConnectFourJevState {
  readonly game: 'connect-four'
  readonly board: readonly (readonly (0 | 1 | 2)[])[]
  readonly sideToMove: 'one' | 'two'
  readonly cpuSide: 'one' | 'two'
  readonly colors: { readonly one: 'red' | 'yellow'; readonly two: 'red' | 'yellow' }
  readonly coordinates: 'Columns A-G left to right; rows 6-1 top to bottom; 0 empty, 1 player one, 2 player two'
}
export type SerializedGameState = TicTacToeJevState | ConnectFourJevState
export type JevVisitorRequest = JevIdentity & { readonly state: SerializedGameState; readonly legalMoveIds: readonly string[]; readonly visitorKey: string }
/** Reserved for Part 2. The shared endpoint must reject credential fields. */
export type JevSharedRequest = JevIdentity & { readonly state: SerializedGameState; readonly legalMoveIds: readonly string[]; readonly visitorKey?: never }

export type JevErrorCode = 'authentication' | 'authorization' | 'rate_limit' | 'transport' | 'service' | 'invalid_response'
export const JEV_SAFE_ERROR_MESSAGES: Readonly<Record<JevErrorCode, string>> = {
  authentication: 'The TypeSafe key was rejected.',
  authorization: 'This Jev request is not authorized.',
  rate_limit: 'Jev is temporarily rate limited.',
  transport: 'Could not reach the Jev service.',
  service: 'The Jev service could not complete this move.',
  invalid_response: 'Jev returned an invalid move response.',
}
export type JevSuccess = JevIdentity & { readonly status: 'success'; readonly choice: string; readonly confidence: number; readonly probabilities: Readonly<Record<string, number>>; readonly resolvedModelId: string }
export type JevFailure = JevIdentity & { readonly status: 'error'; readonly code: JevErrorCode; readonly message: string }
export type JevResponse = JevSuccess | JevFailure

export interface JevAnalysis {
  readonly confidence: number
  readonly choices: readonly { readonly moveId: string; readonly probability: number }[]
  readonly tie: { readonly count: number; readonly selectedMoveId: string }
  readonly resolvedModelId: string
}
export interface JevRecovery {
  readonly consecutiveServiceFailures: number
  readonly consecutiveInvalid: number
  readonly disposition: 'ready' | 'manual-retry-required'
}
export const EMPTY_JEV_RECOVERY: JevRecovery = { consecutiveServiceFailures: 0, consecutiveInvalid: 0, disposition: 'ready' }
export const JEV_SERVICE_FALLBACK_DIAGNOSTIC = 'Jev service failed three times; fell back to random move'
export const JEV_INVALID_FALLBACK_DIAGNOSTIC = 'Rejected illegal move attempted by Jev, fell back to random move'

// Jev prompt v1: criterion order is ascending cell index, A3=0 through C1=8.
export const TIC_TAC_TOE_JEV_INSTRUCTIONS = 'Choose the best legal move for cpuSide in this Tic Tac Toe position. Players alternate placing X or O in an empty cell. X moves first. Three matching symbols in a row, column, or diagonal win; a full board without a winner is a draw. Choose a move that wins if possible, otherwise prevents defeat and seeks the best achievable result against optimal opposition. Select only from the supplied criteria.'
// Jev prompt v1: criterion order is ascending column index, A=0 through G=6; rows are 6 (top) through 1 (bottom).
export const CONNECT_FOUR_JEV_INSTRUCTIONS = 'Choose the best legal move for cpuSide in this Connect Four position. Players alternate dropping a piece in a non-full column; it falls to the lowest empty cell. Four matching pieces horizontally, vertically, or diagonally win; a full board without a winner is a draw. Choose a move that wins if possible, otherwise prevents defeat and seeks the best achievable result against optimal opposition. Select only from the supplied criteria.'

/** Part 1 never assigns or serves the reserved shared route. */
export function isPartOneAssignment(value: OpponentAssignment): boolean {
  return value.opponent === 'rng' || value.credentialRoute === 'visitor'
}
/** Provenance is determined by immutable assignment, not the last CPU move. */
export function isProvenanceAllowed(assignment: OpponentAssignment, actor: 'human' | 'cpu', provenance: 'human' | 'rng' | 'jev' | 'rng-fallback'): boolean {
  if (actor === 'human') return provenance === 'human'
  if (assignment.opponent === 'rng') return provenance === 'rng'
  return provenance === 'jev' || provenance === 'rng-fallback'
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key))

export function isOpponentAssignment(value: unknown, partOneOnly = false): value is OpponentAssignment {
  if (!isRecord(value)) return false
  if (value.opponent === 'rng') return hasOnly(value, ['opponent'])
  if (value.opponent !== 'jev') return false
  if (value.credentialRoute === 'visitor') return hasOnly(value, ['opponent', 'credentialRoute'])
  if (partOneOnly || value.credentialRoute !== 'shared') return false
  return hasOnly(value, ['opponent', 'credentialRoute', 'approvingUserId', 'accessClass']) &&
    typeof value.approvingUserId === 'string' && value.approvingUserId.length > 0 &&
    (value.accessClass === 'daily' || value.accessClass === 'whitelisted')
}

/** The relay uses this narrow shape gate before game-specific board validation. */
export function hasVisitorRouteShape(value: unknown): value is JevVisitorRequest {
  if (!isRecord(value) || !hasOnly(value, ['protocolVersion', 'gameId', 'matchId', 'expectedPly', 'attemptId', 'state', 'legalMoveIds', 'visitorKey'])) return false
  return value.protocolVersion === JEV_PROTOCOL_VERSION &&
    (value.gameId === 'tic-tac-toe' || value.gameId === 'connect-four') &&
    typeof value.matchId === 'string' && typeof value.attemptId === 'string' &&
    Number.isInteger(value.expectedPly) && (value.expectedPly as number) > 0 &&
    isRecord(value.state) && value.state.game === value.gameId &&
    Array.isArray(value.legalMoveIds) && value.legalMoveIds.every((id) => typeof id === 'string') &&
    typeof value.visitorKey === 'string' && value.visitorKey.length > 0
}

export type JevRecoveryEvent = 'service-failure' | 'invalid-response' | 'success-or-fallback'
export function advanceJevRecovery(current: JevRecovery, event: JevRecoveryEvent): JevRecovery {
  if (event === 'success-or-fallback') return EMPTY_JEV_RECOVERY
  if (event === 'service-failure') return { consecutiveServiceFailures: Math.min(2, current.consecutiveServiceFailures + 1), consecutiveInvalid: current.consecutiveInvalid, disposition: 'manual-retry-required' }
  return { consecutiveServiceFailures: current.consecutiveServiceFailures, consecutiveInvalid: Math.min(2, current.consecutiveInvalid + 1), disposition: 'ready' }
}

/** Provider input is captured once per product attempt. The key stays outside snapshots. */
export interface JevMoveInput<Position, Move, Side> {
  readonly identity: JevIdentity
  readonly position: Readonly<Position>
  readonly legalMoves: readonly Move[]
  readonly cpuSide: Side
  readonly credentialRoute: 'visitor'
  readonly visitorKey: string
  readonly signal: AbortSignal
}
export interface JevMoveResult<Move> {
  readonly move: Move
  readonly analysis: JevAnalysis
}
export interface JevProvider<Position, Move, Side> {
  chooseMove(input: JevMoveInput<Position, Move, Side>): Promise<JevMoveResult<Move>>
}
