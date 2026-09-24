import type { GameId, RequestToken, Scheduler } from '../contracts'

export interface RequestIdentity {
  readonly gameId: GameId
  readonly matchId: string
  readonly expectedPly: number
}

/** Use a fresh ID for each attempt, including manual and automatic retries. */
export function createRequestToken(identity: RequestIdentity, newId: () => string): RequestToken {
  const attemptId = newId()
  if (!identity.matchId || !attemptId || !Number.isSafeInteger(identity.expectedPly) || identity.expectedPly < 1) {
    throw new RangeError('Invalid request identity')
  }
  return Object.freeze({ ...identity, attemptId })
}

export function sameRequestToken(left: RequestToken | null | undefined, right: RequestToken | null | undefined): boolean {
  return left != null && right != null
    && left.gameId === right.gameId
    && left.matchId === right.matchId
    && left.expectedPly === right.expectedPly
    && left.attemptId === right.attemptId
}

export interface AttemptResources {
  readonly token: RequestToken
  readonly signal: AbortSignal
  /** Register or replace the threshold timer. A canceled attempt cannot fire it. */
  scheduleRetryAfter(callback: (token: RequestToken) => void, delayMs?: number): void
  /** Invalidate callbacks, clear the timer, then best-effort abort the provider. */
  cancel(): void
}

export function createAttemptResources(token: RequestToken, scheduler: Scheduler): AttemptResources {
  const controller = new AbortController()
  let timer: unknown
  let hasTimer = false
  let canceled = false

  return {
    token,
    signal: controller.signal,
    scheduleRetryAfter(callback, delayMs = 5_000) {
      if (canceled) return
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new RangeError('Retry delay must be a nonnegative finite number')
      }
      if (hasTimer) scheduler.clearTimeout(timer)
      timer = scheduler.setTimeout(() => {
        hasTimer = false
        if (!canceled) callback(token)
      }, delayMs)
      hasTimer = true
    },
    cancel() {
      if (canceled) return
      canceled = true
      if (hasTimer) {
        scheduler.clearTimeout(timer)
        hasTimer = false
      }
      try {
        controller.abort()
      } catch {
        // Some injected abort implementations may throw; token checks still guard state.
      }
    },
  }
}

export function createSystemScheduler(): Scheduler {
  return {
    now: () => Date.now(),
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  }
}

export function newUuid(): string {
  return globalThis.crypto.randomUUID()
}
