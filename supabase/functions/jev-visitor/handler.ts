import { choice, TypeSafeClient } from '@typesafe-ai/sdk'
import { JEV_DEADLINE_MS, JEV_SAFE_ERROR_MESSAGES, hasVisitorRouteShape, TIC_TAC_TOE_JEV_INSTRUCTIONS, CONNECT_FOUR_JEV_INSTRUCTIONS } from '../../../src/contracts/jev.ts'
import type { JevErrorCode, JevIdentity, JevVisitorRequest } from '../../../src/contracts/jev.ts'
import { criteriaForState, legalMoveIdsForState, validateJevGameState } from '../../../shared/jev/games.ts'
import { validateJevChoice } from '../../../shared/jev/choice.ts'

type Upstream = (key: string, signal: AbortSignal, request: JevVisitorRequest) => Promise<unknown>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const headersFor = (origin: string | null, allowed: readonly string[]) => {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' })
  if (origin && allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'content-type, apikey, authorization')
  }
  return headers
}
const respond = (data: unknown, status: number, headers: Headers) => {
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { status, headers })
}
const fail = (identity: Partial<JevIdentity>, code: JevErrorCode, status: number, headers: Headers) =>
  respond({ ...identity, status: 'error', code, message: JEV_SAFE_ERROR_MESSAGES[code] }, status, headers)
async function readBounded(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw Error()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16384) throw Error()
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}
function valid(value: unknown): value is JevVisitorRequest {
  if (!hasVisitorRouteShape(value) || !uuid.test(value.matchId) || !uuid.test(value.attemptId) ||
    !value.visitorKey.trim() || new TextEncoder().encode(value.visitorKey).length > 4096 ||
    !validateJevGameState(value.state)) return false
  const legal = legalMoveIdsForState(value.state)
  return legal.length === value.legalMoveIds.length && legal.every((id, i) => id === value.legalMoveIds[i])
}
const upstreamDefault = async (key: string, signal: AbortSignal, request: JevVisitorRequest, sdkFetch?: typeof fetch): Promise<unknown> => {
  const client = new TypeSafeClient({ apiKey: key, logger: { debug() {}, info() {}, warn() {}, error() {} },
    retry: { maxRetries: 2, maxRetryAfterMs: 1500 }, fetch: sdkFetch })
  const criteria = Object.fromEntries(criteriaForState(request.state).map(({ id, description }) => [id, description]))
  const instructions = request.gameId === 'tic-tac-toe' ? TIC_TAC_TOE_JEV_INSTRUCTIONS : CONNECT_FOUR_JEV_INSTRUCTIONS
  return client.systemOne({ state: request.state as never, model: 'jev-latest', questions: { move: choice(instructions, criteria) } }, { signal })
}
function errorCode(error: unknown): JevErrorCode {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
  return status === 401 ? 'authentication' : status === 403 ? 'authorization' : status === 429 ? 'rate_limit' :
    typeof status === 'number' && status >= 500 ? 'service' : 'transport'
}
export function createVisitorHandler(options: { allowedOrigins: readonly string[]; upstream?: Upstream; sdkFetch?: typeof fetch; now?: () => number }) {
  const upstream: Upstream = options.upstream ?? ((key, signal, request) => upstreamDefault(key, signal, request, options.sdkFetch))
  const now = options.now ?? (() => performance.now())
  return async (request: Request): Promise<Response> => {
    const headers = headersFor(request.headers.get('Origin'), options.allowedOrigins)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return fail({}, 'authorization', 405, headers)
    const origin = request.headers.get('Origin')
    if (origin && !options.allowedOrigins.includes(origin)) return fail({}, 'authorization', 403, headers)
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return fail({}, 'invalid_response', 400, headers)
    const started = now()
    let data: unknown
    try { data = await readBounded(request) } catch { return fail({}, 'invalid_response', 400, headers) }
    if (!valid(data)) return fail({}, 'invalid_response', 400, headers)
    const identity: JevIdentity = { protocolVersion: data.protocolVersion, gameId: data.gameId, matchId: data.matchId,
      expectedPly: data.expectedPly, attemptId: data.attemptId }
    const controller = new AbortController()
    const abort = () => controller.abort()
    request.signal.addEventListener('abort', abort, { once: true })
    if (request.signal.aborted) controller.abort()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error()) },
        Math.max(0, JEV_DEADLINE_MS - (now() - started))) })
      const result = await Promise.race([upstream(data.visitorKey, controller.signal, data), timeout]) as Record<string, unknown>
      if (now() - started >= JEV_DEADLINE_MS) return fail(identity, 'transport', 504, headers)
      const answer = (result?.answers as Record<string, unknown> | undefined)?.move as Record<string, unknown> | undefined
      const normalized = validateJevChoice({ choice: answer?.choice, confidence: answer?.confidence,
        probabilities: answer?.probabilities, resolvedModelId: result?.model }, data.legalMoveIds)
      if (!normalized) return fail(identity, 'invalid_response', 502, headers)
      return respond({ ...identity, status: 'success', choice: answer?.choice,
        confidence: normalized.analysis.confidence, probabilities: answer?.probabilities,
        resolvedModelId: normalized.analysis.resolvedModelId }, 200, headers)
    } catch (error) {
      const code = controller.signal.aborted ? 'transport' : errorCode(error)
      return fail(identity, code, code === 'transport' ? 504 : 502, headers)
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      controller.abort()
      request.signal.removeEventListener('abort', abort)
    }
  }
}



