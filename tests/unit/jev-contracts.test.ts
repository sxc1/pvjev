import { describe, expect, it } from 'vitest'
import {
  advanceJevRecovery, EMPTY_JEV_RECOVERY, hasVisitorRouteShape,
  isOpponentAssignment, isProvenanceAllowed, JEV_PROTOCOL_VERSION,
  TIC_TAC_TOE_JEV_INSTRUCTIONS, CONNECT_FOUR_JEV_INSTRUCTIONS,
  SCHEMA_VERSION, CONNECT_FOUR_SCHEMA_VERSION, SETTINGS_SCHEMA_VERSION,
} from '../../src/contracts'

const visitorRequest = {
  protocolVersion: JEV_PROTOCOL_VERSION,
  gameId: 'tic-tac-toe',
  matchId: '11111111-1111-4111-8111-111111111111',
  expectedPly: 2,
  attemptId: '22222222-2222-4222-8222-222222222222',
  state: { game: 'tic-tac-toe' },
  legalMoveIds: ['cell-1'],
  visitorKey: 'disposable-fixture',
}

describe('V1 frozen Jev contracts', () => {
  it('rejects shared or malformed assignments in visitor-only Part 1', () => {
    expect(isOpponentAssignment({ opponent: 'rng' }, true)).toBe(true)
    expect(isOpponentAssignment({ opponent: 'jev', credentialRoute: 'visitor' }, true)).toBe(true)
    expect(isOpponentAssignment({ opponent: 'jev', credentialRoute: 'shared', approvingUserId: 'u', accessClass: 'daily' }, true)).toBe(false)
    expect(isOpponentAssignment({ opponent: 'jev', credentialRoute: 'visitor', approvingUserId: 'u' }, true)).toBe(false)
    expect(isOpponentAssignment({ opponent: 'rng', credentialRoute: 'visitor' }, true)).toBe(false)
  })

  it('requires visitor credentials and rejects shared-route and override fields', () => {
    expect(hasVisitorRouteShape(visitorRequest)).toBe(true)
    expect(hasVisitorRouteShape({ ...visitorRequest, visitorKey: undefined })).toBe(false)
    expect(hasVisitorRouteShape({ ...visitorRequest, visitorKey: '' })).toBe(false)
    expect(hasVisitorRouteShape({ ...visitorRequest, model: 'other' })).toBe(false)
    expect(hasVisitorRouteShape({ ...visitorRequest, credentialRoute: 'shared' })).toBe(false)
    expect(hasVisitorRouteShape({ ...visitorRequest, state: { game: 'connect-four' } })).toBe(false)
    expect(hasVisitorRouteShape({ ...visitorRequest, protocolVersion: 2 })).toBe(false)
  })

  it('locks provenance to immutable assignment', () => {
    const rng = { opponent: 'rng' } as const
    const jev = { opponent: 'jev', credentialRoute: 'visitor' } as const
    expect(isProvenanceAllowed(rng, 'cpu', 'rng')).toBe(true)
    expect(isProvenanceAllowed(rng, 'cpu', 'jev')).toBe(false)
    expect(isProvenanceAllowed(rng, 'cpu', 'rng-fallback')).toBe(false)
    expect(isProvenanceAllowed(jev, 'cpu', 'jev')).toBe(true)
    expect(isProvenanceAllowed(jev, 'cpu', 'rng-fallback')).toBe(true)
    expect(isProvenanceAllowed(jev, 'cpu', 'rng')).toBe(false)
    expect(isProvenanceAllowed(jev, 'human', 'jev')).toBe(false)
  })

  it('keeps failure counters independent and saves a manual-retry disposition', () => {
    const first = advanceJevRecovery(EMPTY_JEV_RECOVERY, 'invalid-response')
    const second = advanceJevRecovery(first, 'service-failure')
    expect(second).toEqual({ consecutiveServiceFailures: 1, consecutiveInvalid: 1, disposition: 'manual-retry-required' })
    expect(advanceJevRecovery(second, 'success-or-fallback')).toEqual(EMPTY_JEV_RECOVERY)
  })

  it('freezes prompt text and match schema versions without changing settings schema', () => {
    expect(TIC_TAC_TOE_JEV_INSTRUCTIONS).toContain('Select only from the supplied criteria.')
    expect(CONNECT_FOUR_JEV_INSTRUCTIONS).toContain('lowest empty cell')
    expect([SCHEMA_VERSION, CONNECT_FOUR_SCHEMA_VERSION, SETTINGS_SCHEMA_VERSION]).toEqual([2, 2, 1])
  })
})
