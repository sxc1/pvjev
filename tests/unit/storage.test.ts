import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../../src/contracts/application'
import { MATCH_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../../src/contracts/persistence'
import { createStorageAdapter, decodeMatchEnvelope } from '../../src/storage'
import { validSaves, validSettings } from '../fixtures/v05'

function fakeStorage() {
  const values = new Map<string, string>()
  const storage: KeyValueStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
  return { values, storage, adapter: createStorageAdapter(() => storage) }
}

describe('T4 storage adapter', () => {
  it('round trips versioned match and settings in separate namespaced keys', () => {
    const { values, adapter } = fakeStorage()
    expect(adapter.readMatch()).toEqual({ status: 'missing' })
    expect(adapter.readSettings()).toEqual({ status: 'missing' })
    expect(adapter.writeMatch(validSaves.humanTurn)).toEqual({ status: 'saved' })
    expect(adapter.writeSettings(validSettings)).toEqual({ status: 'saved' })
    expect(JSON.parse(values.get(MATCH_STORAGE_KEY)!)).toEqual(validSaves.humanTurn)
    expect(JSON.parse(values.get(SETTINGS_STORAGE_KEY)!)).toEqual(validSettings)
    expect(adapter.readMatch()).toEqual({ status: 'valid', value: validSaves.humanTurn })
    expect(adapter.readSettings()).toEqual({ status: 'valid', value: validSettings })
    expect(adapter.removeMatch()).toEqual({ status: 'saved' })
    expect(adapter.readMatch()).toEqual({ status: 'missing' })
    expect(adapter.readSettings()).toEqual({ status: 'valid', value: validSettings })
  })

  it('reports malformed JSON, unsupported versions, and malformed shapes without overwriting data', () => {
    const { values, adapter } = fakeStorage()
    const cases = [
      'not json',
      JSON.stringify({ ...validSaves.humanTurn, schemaVersion: 2 }),
      JSON.stringify({ ...validSaves.humanTurn, match: { ...validSaves.humanTurn.match, gameId: 'chess' } }),
      JSON.stringify({ ...validSaves.humanTurn, recovery: { consecutiveInvalid: 3 } }),
      JSON.stringify({ ...validSaves.humanTurn, match: { ...validSaves.humanTurn.match, moves: [{ ...validSaves.humanTurn.match.moves[0], analysis: {} }] } }),
    ]
    for (const raw of cases) {
      values.set(MATCH_STORAGE_KEY, raw)
      expect(adapter.readMatch().status).toBe('invalid')
      expect(values.get(MATCH_STORAGE_KEY)).toBe(raw)
    }
    values.set(SETTINGS_STORAGE_KEY, JSON.stringify({ ...validSettings, settings: { confirmMoves: 'yes' } }))
    expect(adapter.readSettings().status).toBe('invalid')
    expect(adapter.readMatch().status).toBe('invalid')
  })

  it('allows T6 to reject semantic corruption after structural decoding', () => {
    const { adapter } = fakeStorage()
    adapter.writeMatch(validSaves.cpuTurnAfterTwoInvalid)
    const result = adapter.readMatch((raw) => {
      const shape = decodeMatchEnvelope(raw)
      return shape.status === 'valid'
        ? { status: 'invalid', reason: 'replay mismatch' }
        : shape
    })
    expect(result).toEqual({ status: 'invalid', reason: 'replay mismatch' })
  })

  it('catches acquisition, read, write, and removal failures', () => {
    const inaccessible = createStorageAdapter(() => { throw new Error('blocked') })
    expect(inaccessible.readMatch()).toEqual({ status: 'unavailable', error: 'blocked' })
    expect(inaccessible.writeSettings(validSettings)).toEqual({ status: 'unavailable', error: 'blocked' })
    expect(inaccessible.removeMatch()).toEqual({ status: 'unavailable', error: 'blocked' })

    const throws: KeyValueStorage = {
      getItem: () => { throw new Error('read blocked') },
      setItem: () => { throw new Error('quota exceeded') },
      removeItem: () => { throw new Error('remove blocked') },
    }
    const adapter = createStorageAdapter(() => throws)
    expect(adapter.readSettings()).toEqual({ status: 'unavailable', error: 'read blocked' })
    expect(adapter.writeMatch(validSaves.humanTurn)).toEqual({ status: 'unavailable', error: 'quota exceeded' })
    expect(adapter.removeSettings()).toEqual({ status: 'unavailable', error: 'remove blocked' })
  })
})
