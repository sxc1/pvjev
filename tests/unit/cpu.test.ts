import { describe, expect, it, vi } from 'vitest'
import type { Scheduler } from '../../src/contracts'
import { createRandomCpuProvider, sampleLegalMove } from '../../src/cpu/random'
import { createAttemptResources, createRequestToken, sameRequestToken } from '../../src/cpu/requests'

describe('U4 legal move sampling', () => {
  it('reaches every choice at controlled boundaries without mutating input', () => {
    const moves = Object.freeze([0, 3, 8])
    expect(sampleLegalMove(moves, () => 0)).toBe(0)
    expect(sampleLegalMove(moves, () => 1 / 3)).toBe(3)
    expect(sampleLegalMove(moves, () => 2 / 3)).toBe(8)
    expect(sampleLegalMove(moves, () => 1 - Number.EPSILON)).toBe(8)
    expect(moves).toEqual([0, 3, 8])
    expect(sampleLegalMove([5], () => 0.999)).toBe(5)
  })

  it('rejects an empty list or invalid random source', () => {
    expect(() => sampleLegalMove([], () => 0)).toThrow(RangeError)
    for (const value of [-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => sampleLegalMove([0], () => value)).toThrow(RangeError)
    }
  })

  it('provides a legal choice asynchronously without an analysis payload', async () => {
    const provider = createRandomCpuProvider<object, number>(() => 0.8)
    const position = Object.freeze({})
    const legalMoves = Object.freeze([1, 4, 6])
    const result = provider.chooseMove({ position, legalMoves, signal: new AbortController().signal })
    expect(result).toBeInstanceOf(Promise)
    await expect(result).resolves.toEqual({ move: 6 })
    expect(legalMoves).toEqual([1, 4, 6])
  })

  it('rejects a request aborted before its asynchronous selection', async () => {
    const provider = createRandomCpuProvider<object, number>(() => 0)
    const controller = new AbortController()
    const result = provider.chooseMove({ position: {}, legalMoves: [0], signal: controller.signal })
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('attempt primitives', () => {
  const identity = { gameId: 'tic-tac-toe' as const, matchId: 'match-1', expectedPly: 2 }

  it('uses a fresh attempt ID and compares the whole token', () => {
    const first = createRequestToken(identity, () => 'attempt-1')
    const second = createRequestToken(identity, () => 'attempt-2')
    expect(first).toEqual({ ...identity, attemptId: 'attempt-1' })
    expect(sameRequestToken(first, { ...first })).toBe(true)
    expect(sameRequestToken(first, second)).toBe(false)
    expect(sameRequestToken(first, { ...first, expectedPly: 3 })).toBe(false)
    expect(sameRequestToken(first, null)).toBe(false)
    expect(() => createRequestToken({ ...identity, expectedPly: 0 }, () => 'attempt-3')).toThrow(RangeError)
  })

  it('clears timers and invalidates callbacks before aborting', () => {
    const callbacks = new Map<number, () => void>()
    let nextHandle = 1
    const scheduler: Scheduler = {
      now: () => 0,
      setTimeout: (callback) => {
        const handle = nextHandle++
        callbacks.set(handle, callback)
        return handle
      },
      clearTimeout: (handle) => { callbacks.delete(handle as number) },
    }
    const token = createRequestToken(identity, () => 'attempt-1')
    const resources = createAttemptResources(token, scheduler)
    const onRetry = vi.fn()

    resources.scheduleRetryAfter(onRetry)
    expect(callbacks.size).toBe(1)
    const obsoleteCallback = callbacks.get(1)!
    resources.scheduleRetryAfter(onRetry)
    expect(callbacks.has(1)).toBe(false)
    resources.cancel()
    expect(resources.signal.aborted).toBe(true)
    expect(callbacks.size).toBe(0)
    obsoleteCallback()
    resources.scheduleRetryAfter(onRetry)
    expect(onRetry).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
  })

  it('fires the scheduled callback with its token only while active', () => {
    let fire: (() => void) | undefined
    const scheduler: Scheduler = {
      now: () => 0,
      setTimeout: (callback) => { fire = callback; return 1 },
      clearTimeout: () => {},
    }
    const token = createRequestToken(identity, () => 'attempt-1')
    const resources = createAttemptResources(token, scheduler)
    const onRetry = vi.fn()
    resources.scheduleRetryAfter(onRetry, 5_000)
    fire?.()
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(token)
    resources.cancel()
    fire?.()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
