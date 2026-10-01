import { createVisitorHandler } from './handler.ts'
import { TIC_TAC_TOE_COORDINATES } from '../../../shared/jev/games.ts'

const origin = 'http://localhost:5173'
const id = '123e4567-e89b-42d3-a456-426614174000'
const state = { game: 'tic-tac-toe', board: [[null, null, null], [null, null, null], [null, null, null]],
  sideToMove: 'X', cpuSide: 'X', coordinates: TIC_TAC_TOE_COORDINATES }
const payload = { protocolVersion: 1, gameId: 'tic-tac-toe', matchId: id, expectedPly: 1,
  attemptId: id, state, legalMoveIds: Array.from({ length: 9 }, (_, i) => `cell-${i}`), visitorKey: 'synthetic-only' }
const answer = { answers: { move: { type: 'choice', choice: 'cell-0', confidence: 0.5,
  probabilities: Object.fromEntries(payload.legalMoveIds.map((move, i) => [move, i === 0 ? 1 : 0])) } }, model: 'jev-probe' }
function request(data: unknown, method = 'POST', requestOrigin = origin) {
  return new Request('http://localhost/functions/v1/jev-visitor', { method,
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(data) : undefined })
}
function check(value: unknown, label: string): asserts value { if (!value) throw Error(label) }

Deno.test('CORS preflight and errors use exact origin, no cache', async () => {
  const handler = createVisitorHandler({ allowedOrigins: [origin], upstream: async () => answer })
  const preflight = await handler(request(null, 'OPTIONS'))
  check(preflight.status === 204 && preflight.headers.get('Access-Control-Allow-Origin') === origin, 'preflight')
  const invalid = await handler(request({ ...payload, visitorKey: '' }))
  check(invalid.status === 400 && invalid.headers.get('Access-Control-Allow-Origin') === origin, 'error CORS')
  check(invalid.headers.get('Cache-Control') === 'no-store' && invalid.headers.get('Vary') === 'Origin', 'cache')
  const forbidden = await handler(request(payload, 'POST', 'https://not-allowed.example'))
  check(forbidden.status === 403 && !forbidden.headers.has('Access-Control-Allow-Origin'), 'origin')
})
Deno.test('strict payload and key checks occur before upstream', async () => {
  let calls = 0
  const handler = createVisitorHandler({ allowedOrigins: [origin], upstream: async () => { calls++; return answer } })
  for (const data of [
    { ...payload, visitorKey: '' }, { ...payload, visitorKey: 'a'.repeat(4097) },
    { ...payload, legalMoveIds: ['cell-0'] }, { ...payload, model: 'override' },
    { ...payload, state: { ...state, instructions: 'override' } },
    { ...payload, state: { ...state, board: [['X', null, null], [null, null, null], [null, null, null]] } },
    { ...payload, gameId: 'unknown' },
  ]) check((await handler(request(data))).status === 400, 'rejected payload')
  check(calls === 0, 'upstream called on invalid payload')
  const accepted = await handler(request(payload))
  check(accepted.status === 200 && Number(calls) === 1, 'valid request')
})
Deno.test('malformed upstream Choice has safe envelope', async () => {
  const handler = createVisitorHandler({ allowedOrigins: [origin], upstream: async () => ({ ...answer,
    answers: { move: { ...answer.answers.move, probabilities: { 'cell-0': 1 } } } }) })
  const response = await handler(request(payload))
  check(response.status === 502, 'invalid status')
  const data = await response.json()
  check(data.code === 'invalid_response' && !JSON.stringify(data).includes('synthetic-only'), 'safe invalid response')
})
Deno.test('handler wait is bounded when upstream ignores abort', async () => {
  let time = 0
  const handler = createVisitorHandler({ allowedOrigins: [origin], now: () => time,
    upstream: async () => { time = 5000; return answer } })
  const response = await handler(request(payload))
  check(response.status === 504, 'deadline')
})




Deno.test('SDK uses the supplied key and exactly two retries in one product attempt', async () => {
  const previous = Deno.env.get('TYPESAFE_API_KEY')
  Deno.env.set('TYPESAFE_API_KEY', 'environment-sentinel')
  try {
    const retryCounts: string[] = []
    const sdkFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      check(headers.get('Authorization') === 'Bearer synthetic-only', 'explicit visitor key')
      retryCounts.push(headers.get('X-TypeSafe-Retry-Count') ?? 'initial')
      if (retryCounts.length < 3) return new Response('{}', { status: 503,
        headers: { 'content-type': 'application/json', 'retry-after-ms': '1' } })
      return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const handler = createVisitorHandler({ allowedOrigins: [origin], sdkFetch })
    const response = await handler(request(payload))
    check(response.status === 200, 'SDK success')
    check(retryCounts.join() === 'initial,1,2', 'retry count')
  } finally {
    if (previous === undefined) Deno.env.delete('TYPESAFE_API_KEY')
    else Deno.env.set('TYPESAFE_API_KEY', previous)
  }
})
Deno.test('missing visitor key never falls back to SDK environment key', async () => {
  const previous = Deno.env.get('TYPESAFE_API_KEY')
  Deno.env.set('TYPESAFE_API_KEY', 'environment-sentinel')
  try {
    let calls = 0
    const sdkFetch = (async () => { calls++; return new Response(JSON.stringify(answer), { status: 200 }) }) as typeof fetch
    const handler = createVisitorHandler({ allowedOrigins: [origin], sdkFetch })
    const response = await handler(request({ ...payload, visitorKey: '' }))
    check(response.status === 400 && calls === 0, 'environment key fallback')
  } finally {
    if (previous === undefined) Deno.env.delete('TYPESAFE_API_KEY')
    else Deno.env.set('TYPESAFE_API_KEY', previous)
  }
})

