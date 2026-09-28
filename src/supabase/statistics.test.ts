import { describe, expect, it } from 'vitest'
import { classifyStatisticsFailure } from './statistics'

describe('statistics transport classification', () => {
  it('keeps structured database rejection final even without an HTTP status', () => {
    const signal = new AbortController().signal
    expect(classifyStatisticsFailure({ message: 'Result already recorded or submitted too soon', code: 'P0001' }, 0, signal)).toMatchObject({ kind: 'database', status: null, code: 'P0001' })
    expect(classifyStatisticsFailure({ message: 'gateway', details: 'database replied' }, 503, signal).kind).toBe('database')
    expect(classifyStatisticsFailure({ message: 'fetch failed' }, 0, signal).kind).toBe('transport')
    expect(classifyStatisticsFailure({ message: 'gateway' }, 503, signal).kind).toBe('transport')
  })
})
