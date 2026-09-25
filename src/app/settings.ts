import type { KeyValueStorage, Settings, SharedSettingsStore, StorageNotice } from '../contracts'
import { SCHEMA_VERSION } from '../contracts/persistence'
import { createStorageAdapter } from '../storage'

export interface SettingsStore extends SharedSettingsStore {
  start(): void
  readonly getNotices: () => readonly StorageNotice[]
}

export function createSharedSettingsStore(acquire: () => KeyValueStorage): SettingsStore {
  const storage = createStorageAdapter(acquire)
  const listeners = new Set<() => void>()
  let settings: Settings = { confirmMoves: false }
  let notices: readonly StorageNotice[] = []
  let started = false
  const notify = () => { for (const listener of [...listeners]) listener() }
  return {
    getSnapshot: () => settings,
    getNotices: () => notices,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start: () => {
      if (started) return
      started = true
      const read = storage.readSettings()
      if (read.status === 'valid') settings = read.value.settings
      if (read.status === 'invalid') notices = [{ kind: 'invalid-settings', message: read.reason }]
      if (read.status === 'unavailable') notices = [{ kind: 'unavailable', message: `Settings could not be loaded. ${read.error}` }]
      notify()
    },
    setConfirmMoves: enabled => {
      if (typeof enabled !== 'boolean' || settings.confirmMoves === enabled) return
      settings = { confirmMoves: enabled }
      notices = notices.filter(notice => notice.kind !== 'invalid-settings')
      const result = storage.writeSettings({ schemaVersion: SCHEMA_VERSION, settings })
      if (result.status === 'unavailable') notices = [...notices.filter(notice => notice.kind !== 'unavailable'), { kind: 'unavailable', message: `Settings could not be saved. ${result.error}` }]
      notify()
    },
  }
}
