import type { MatchCompletedEvent } from '../contracts/application'
import type { AuthStore } from '../contracts/account'
import type { StatisticsStore } from '../contracts/statistics'

/** Keep result dispatch outside React and capture the account at completion time. */
export function createAccountRuntime(auth: AuthStore, statistics: StatisticsStore) {
  let disposed = false
  const unsubscribe = auth.subscribe(() => {
    queueMicrotask(() => {
      if (disposed) return
      const current = auth.getSnapshot()
      statistics.setAccount(current.status === 'signed-in' ? current.account.id : null)
    })
  })
  return {
    onMatchCompleted(event: MatchCompletedEvent) {
      if (disposed) return
      const current = auth.getSnapshot()
      if (current.status !== 'signed-in') return
      statistics.setAccount(current.account.id)
      statistics.recordCompletion(current.account.id, event)
    },
    dispose() { if (disposed) return; disposed = true; unsubscribe() },
  }
}
