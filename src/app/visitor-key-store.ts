import type { VisitorKeySource } from '../contracts/application'

export interface VisitorKeySnapshot { readonly hasKey: boolean; readonly revision: number }
export interface VisitorKeyStore extends VisitorKeySource {
  getSnapshot(): VisitorKeySnapshot
  saveKey(value: string): boolean
  clear(): void
  dispose(): void
}

/** The credential lives only in this closure. Snapshots never contain it. */
export function createVisitorKeyStore(): VisitorKeyStore {
  let key: string | null = null
  let snapshot: VisitorKeySnapshot = { hasKey: false, revision: 0 }
  const listeners = new Set<() => void>()
  const update = (next: string | null) => {
    key = next
    snapshot = { hasKey: next !== null, revision: snapshot.revision + 1 }
    for (const listener of listeners) listener()
  }
  return {
    getKey: () => key,
    getRevision: () => snapshot.revision,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    saveKey(value) { const next = value.trim(); if (!next) return false; update(next); return true },
    clear() { if (key !== null) update(null) },
    dispose() { key = null; snapshot = { hasKey: false, revision: snapshot.revision + 1 }; listeners.clear() },
  }
}
