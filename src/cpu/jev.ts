import type { ConnectFourColor, ConnectFourMove, ConnectFourPlayer, ConnectFourPosition } from '../contracts/connect-four'
import type { TicTacToeMove, TicTacToePosition, TicTacToeSymbol } from '../contracts/tic-tac-toe'
import { JEV_SAFE_ERROR_MESSAGES, type JevErrorCode, type JevMoveInput, type JevMoveResult, type JevProvider, type JevResponse, type JevVisitorRequest } from '../contracts/jev'
import { validateJevChoice } from '../../shared/jev/choice'
import { connectFourJevMoves, connectFourMoveFromJevId } from '../games/connect-four/jev'
import { ticTacToeJevMoves, ticTacToeMoveFromJevId } from '../games/tic-tac-toe/jev'

export class JevProviderError extends Error {
  constructor(readonly code: JevErrorCode) { super(JEV_SAFE_ERROR_MESSAGES[code]); this.name = 'JevProviderError' }
}
function error(code: JevErrorCode): never { throw new JevProviderError(code) }
const safeCode = (code: unknown): code is JevErrorCode =>
  code === 'authentication' || code === 'authorization' || code === 'rate_limit' ||
  code === 'transport' || code === 'service' || code === 'invalid_response'
function sameIdentity(value: Record<string, unknown>, request: JevVisitorRequest): boolean {
  return value.protocolVersion === request.protocolVersion && value.gameId === request.gameId &&
    value.matchId === request.matchId && value.expectedPly === request.expectedPly &&
    value.attemptId === request.attemptId
}
async function evaluate(baseUrl: string, publishableKey: string, request: JevVisitorRequest, signal: AbortSignal) {
  let response: Response
  try {
    response = await fetch(new URL('/functions/v1/jev-visitor', baseUrl), {
      method: 'POST', signal, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: publishableKey },
      body: JSON.stringify(request),
    })
  } catch { return error('transport') }
  let wire: unknown
  try { wire = await response.json() } catch { return error('service') }
  if (!wire || typeof wire !== 'object' || Array.isArray(wire) || !sameIdentity(wire as Record<string, unknown>, request)) return error('service')
  const envelope = wire as JevResponse
  if (envelope.status === 'error') {
    if (!safeCode(envelope.code) || envelope.message !== JEV_SAFE_ERROR_MESSAGES[envelope.code]) return error('service')
    return error(envelope.code)
  }
  if (!response.ok || envelope.status !== 'success') return error('service')
  const normalized = validateJevChoice({ choice: envelope.choice, confidence: envelope.confidence,
    probabilities: envelope.probabilities, resolvedModelId: envelope.resolvedModelId }, request.legalMoveIds)
  if (!normalized) return error('invalid_response')
  return normalized
}
export function createTicTacToeJevProvider(baseUrl: string, publishableKey: string): JevProvider<TicTacToePosition, TicTacToeMove, TicTacToeSymbol> {
  return { async chooseMove(input: JevMoveInput<TicTacToePosition, TicTacToeMove, TicTacToeSymbol>): Promise<JevMoveResult<TicTacToeMove>> {
    const { state, legalMoveIds } = ticTacToeJevMoves(input.position, input.cpuSide)
    if (input.identity.gameId !== 'tic-tac-toe' || !legalMoveIds.length ||
      legalMoveIds.length !== input.legalMoves.length || !legalMoveIds.every((id, i) => ticTacToeMoveFromJevId(id) === input.legalMoves[i]))
      return error('invalid_response')
    const selected = await evaluate(baseUrl, publishableKey, { ...input.identity, state, legalMoveIds, visitorKey: input.visitorKey }, input.signal)
    const move = ticTacToeMoveFromJevId(selected.moveId)
    if (move === null) return error('invalid_response')
    return { move, analysis: selected.analysis }
  } }
}
export function createConnectFourJevProvider(baseUrl: string, publishableKey: string, oneColor: () => ConnectFourColor): JevProvider<ConnectFourPosition, ConnectFourMove, ConnectFourPlayer> {
  return { async chooseMove(input: JevMoveInput<ConnectFourPosition, ConnectFourMove, ConnectFourPlayer>): Promise<JevMoveResult<ConnectFourMove>> {
    const { state, legalMoveIds } = connectFourJevMoves(input.position, input.cpuSide, oneColor())
    if (input.identity.gameId !== 'connect-four' || !legalMoveIds.length ||
      legalMoveIds.length !== input.legalMoves.length || !legalMoveIds.every((id, i) => connectFourMoveFromJevId(id) === input.legalMoves[i]))
      return error('invalid_response')
    const selected = await evaluate(baseUrl, publishableKey, { ...input.identity, state, legalMoveIds, visitorKey: input.visitorKey }, input.signal)
    const move = connectFourMoveFromJevId(selected.moveId)
    if (move === null) return error('invalid_response')
    return { move, analysis: selected.analysis }
  } }
}

