import { describe, expect, it, vi } from 'vitest'
import { createVisitorKeyStore } from './visitor-key-store'

describe('visitor key store', () => {
  it('exposes only presence and revision and invalidates observers on replacement and clear', () => {
    const store = createVisitorKeyStore()
    const changed = vi.fn()
    store.subscribe(changed)
    expect(store.getSnapshot()).toEqual({ hasKey: false, revision: 0 })
    expect(store.saveKey('   ')).toBe(false)
    expect(store.saveKey('  example-private-value  ')).toBe(true)
    expect(store.getKey()).toBe('example-private-value')
    expect(store.getSnapshot()).toEqual({ hasKey: true, revision: 1 })
    expect(JSON.stringify(store.getSnapshot())).not.toContain('example-private-value')
    store.saveKey('replacement-private-value')
    expect(store.getRevision()).toBe(2)
    store.clear()
    expect(store.getSnapshot()).toEqual({ hasKey: false, revision: 3 })
    expect(store.getKey()).toBeNull()
    expect(changed).toHaveBeenCalledTimes(3)
    store.dispose()
    expect(store.getKey()).toBeNull()
  })
})
