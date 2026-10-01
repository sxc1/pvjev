import type { RequestToken, Scheduler } from '../contracts'
import { JEV_DEADLINE_MS } from '../contracts/jev'
import { createAttemptResources, type AttemptResources } from '../cpu/requests'

/** One product attempt. Identity and credential revision are checked before any state change. */
export interface JevAttempt extends AttemptResources {
  readonly startedAt: number
  readonly credentialRevision: number
  /** A late callback expires the attempt even if its timer was throttled. */
  accept(token: RequestToken, revision: number): 'current' | 'expired' | 'stale'
  scheduleDeadline(onExpiry: () => void): void
}

export function createJevAttempt(token: RequestToken, scheduler: Scheduler, credentialRevision: number): JevAttempt {
  const resources = createAttemptResources(token, scheduler)
  const startedAt = scheduler.now()
  let active = true
  let deadlineHandle: unknown
  let deadlineScheduled = false
  return {
    ...resources,
    startedAt,
    credentialRevision,
    scheduleDeadline(onExpiry) {
      if (!active || deadlineScheduled) return
      deadlineScheduled = true
      deadlineHandle = scheduler.setTimeout(() => {
        deadlineScheduled = false
        if (active) onExpiry()
      }, JEV_DEADLINE_MS)
    },
    accept(candidate, revision) {
      if (!active || candidate.attemptId !== token.attemptId || candidate.matchId !== token.matchId ||
        candidate.expectedPly !== token.expectedPly || candidate.gameId !== token.gameId || revision !== credentialRevision) return 'stale'
      return scheduler.now() - startedAt >= JEV_DEADLINE_MS ? 'expired' : 'current'
    },
    cancel() {
      if (!active) return
      active = false
      if (deadlineScheduled) scheduler.clearTimeout(deadlineHandle)
      resources.cancel()
    },
  }
}
import { JEV_SAFE_ERROR_MESSAGES, type JevErrorCode } from '../contracts/jev'

/** Untrusted provider exceptions never reach UI or persistence verbatim. */
export function classifyJevError(value: unknown): { code: JevErrorCode; message: string } {
  const code = typeof value === 'object' && value !== null && 'code' in value ? (value as { code?: unknown }).code : undefined
  const safeCode: JevErrorCode = code === 'authentication' || code === 'authorization' || code === 'rate_limit' ||
    code === 'transport' || code === 'service' || code === 'invalid_response' ? code : 'service'
  return { code: safeCode, message: JEV_SAFE_ERROR_MESSAGES[safeCode] }
}

export function stepJevRecovery(current: { consecutiveInvalid: number; consecutiveServiceFailures: number },
  kind: 'service' | 'invalid'): { fallback: boolean; consecutiveInvalid: number; consecutiveServiceFailures: number } {
  const consecutiveInvalid = current.consecutiveInvalid + (kind === 'invalid' ? 1 : 0)
  const consecutiveServiceFailures = current.consecutiveServiceFailures + (kind === 'service' ? 1 : 0)
  return { fallback: kind === 'invalid' ? consecutiveInvalid >= 3 : consecutiveServiceFailures >= 3,
    consecutiveInvalid: Math.min(2, consecutiveInvalid), consecutiveServiceFailures: Math.min(2, consecutiveServiceFailures) }
}
