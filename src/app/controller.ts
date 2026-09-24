import type { ControllerDependencies, RequestToken, TicTacToeController, TicTacToeMatch, TicTacToeSnapshot } from '../contracts'
import { SCHEMA_VERSION } from '../contracts/persistence'
import { createAttemptResources, createRequestToken, sameRequestToken, type AttemptResources } from '../cpu/requests'
import { sampleLegalMove } from '../cpu/random'
import { isLegalMove } from '../games/tic-tac-toe/rules'
import { createStorageAdapter, decodeReplayMatchEnvelope } from '../storage'
import { appendMove, emptySnapshot, liveView, transition } from './transitions'

const FALLBACK_MESSAGE = 'CPU returned three invalid moves; a random legal move was used.'

export function createTicTacToeController(deps: ControllerDependencies): TicTacToeController {
  const storage = createStorageAdapter(deps.storage)
  const listeners = new Set<() => void>()
  let snapshot = emptySnapshot()
  let started = false
  let disposed = false
  let attempt: AttemptResources | null = null
  let invalidSavedMatch = false

  const publish = (next: TicTacToeSnapshot) => {
    if (next === snapshot || disposed) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }
  const addNotice = (kind: 'unavailable' | 'invalid-match' | 'invalid-settings', message: string) => {
    const notices = snapshot.notices.filter(notice => notice.kind !== kind)
    publish({ ...snapshot, notices: [...notices, { kind, message }] })
  }
  const clearNotice = (kind: 'invalid-match' | 'invalid-settings') => {
    if (snapshot.notices.some(notice => notice.kind === kind)) publish({ ...snapshot, notices: snapshot.notices.filter(notice => notice.kind !== kind) })
  }
  const writeResult = (result: { status: string; error?: string }) => {
    if (result.status === 'unavailable') addNotice('unavailable', `Progress or settings could not be saved. A reload may restore older data. ${result.error ?? ''}`.trim())
  }
  const saveMatch = (next: TicTacToeSnapshot) => next.match
    ? storage.writeMatch({ schemaVersion: SCHEMA_VERSION, match: next.match, recovery: { consecutiveInvalid: next.request.consecutiveInvalid } })
    : { status: 'saved' as const }
  const releaseAttempt = () => {
    const old = attempt
    attempt = null
    old?.cancel()
  }
  const cpuTurn = (match: TicTacToeMatch | null = snapshot.match) =>
    !!match && match.outcome.kind === 'ongoing' && match.position.nextSymbol !== match.humanSymbol
  const current = (token: RequestToken) => {
    const match = snapshot.match
    return !disposed && attempt !== null && snapshot.request.status === 'pending' &&
      sameRequestToken(snapshot.request.token, token) && match !== null && match.id === token.matchId &&
      token.gameId === match.gameId && token.expectedPly === match.moves.length + 1 && cpuTurn(match)
  }
  const commitCpu = (cell: number, diagnostic?: string) => {
    const match = snapshot.match!
    releaseAttempt()
    const nextMatch = appendMove(match, cell, 'cpu', diagnostic)
    const next = { ...snapshot, match: nextMatch, request: { status: 'idle' as const, consecutiveInvalid: 0 },
      view: nextMatch.outcome.kind === 'ongoing' ? snapshot.view : { ...snapshot.view, resignationDialogOpen: false } }
    const saved = saveMatch(next)
    publish(next)
    writeResult(saved)
  }
  const handleInvalid = (token: RequestToken) => {
    if (!current(token)) return
    const count = snapshot.request.consecutiveInvalid + 1
    releaseAttempt()
    if (count === 3) {
      const legal = deps.rules.legalMoves(snapshot.match!.position)
      commitCpu(sampleLegalMove(legal, deps.random), FALLBACK_MESSAGE)
      return
    }
    const next = { ...snapshot, request: { status: 'idle' as const, consecutiveInvalid: count } }
    const saved = saveMatch(next)
    publish(next)
    writeResult(saved)
    reconcile()
  }
  const handleFailure = (token: RequestToken, error: unknown) => {
    if (!current(token)) return
    const count = snapshot.request.consecutiveInvalid
    releaseAttempt()
    const message = error instanceof Error ? error.message : String(error)
    publish({ ...snapshot, request: { status: 'failed', token, error: message, retryAvailable: true, consecutiveInvalid: count } })
  }
  const handleSuccess = (token: RequestToken, result: unknown) => {
    if (!current(token)) return
    const candidate = typeof result === 'object' && result !== null ? (result as { move?: unknown; analysis?: unknown }).move : undefined
    if (!isLegalMove(snapshot.match!.position, candidate)) { handleInvalid(token); return }
    commitCpu(candidate)
  }
  const reconcile = () => {
    if (!started || disposed || invalidSavedMatch || !cpuTurn()) return
    if (attempt || snapshot.request.status === 'failed') return
    const match = snapshot.match!
    const token = createRequestToken({ gameId: match.gameId, matchId: match.id, expectedPly: match.moves.length + 1 }, deps.newId)
    const resources = createAttemptResources(token, deps.scheduler)
    attempt = resources
    publish({ ...snapshot, request: { status: 'pending', token, startedAt: deps.scheduler.now(), retryAvailable: false, consecutiveInvalid: snapshot.request.consecutiveInvalid } })
    if (!current(token)) return
    resources.scheduleRetryAfter(timerToken => {
      if (!current(timerToken)) return
      publish({ ...snapshot, request: { ...snapshot.request, retryAvailable: true } as TicTacToeSnapshot['request'] })
    })
    const legalMoves = [...deps.rules.legalMoves(match.position)]
    const position = { ...match.position, board: [...match.position.board], winningLines: [...match.position.winningLines] }
    try {
      Promise.resolve(deps.cpu.chooseMove({ position: position as unknown as typeof match.position, legalMoves, signal: resources.signal }))
        .then(value => handleSuccess(token, value), error => handleFailure(token, error))
    } catch (error) { handleFailure(token, error) }
  }
  const start = () => {
    if (started || disposed) return
    started = true
    const settings = storage.readSettings()
    if (settings.status === 'valid') publish({ ...snapshot, settings: settings.value.settings })
    else if (settings.status === 'invalid') addNotice('invalid-settings', settings.reason)
    else if (settings.status === 'unavailable') addNotice('unavailable', `Settings could not be loaded. ${settings.error}`)
    const saved = storage.readMatch(decodeReplayMatchEnvelope)
    if (saved.status === 'valid') publish({ ...snapshot, match: saved.value.match, setupSymbol: saved.value.match.humanSymbol, view: liveView(), request: { status: 'idle', consecutiveInvalid: saved.value.recovery.consecutiveInvalid } })
    else if (saved.status === 'invalid') { invalidSavedMatch = true; addNotice('invalid-match', `${saved.reason} Choose Start fresh to replace it.`) }
    else if (saved.status === 'unavailable') addNotice('unavailable', `Match could not be loaded. ${saved.error}`)
    reconcile()
  }
  const dispatch: TicTacToeController['dispatch'] = command => {
    if (!started || disposed) return { status: 'ignored', reason: 'not-ready' }
    if (command.type === 'start-fresh') {
      if (!invalidSavedMatch) return { status: 'ignored', reason: 'illegal' }
      invalidSavedMatch = false
      releaseAttempt()
      publish({ ...snapshot, match: null, view: liveView(), request: { status: 'idle', consecutiveInvalid: 0 } })
      writeResult(storage.removeMatch())
      clearNotice('invalid-match')
      return { status: 'applied' }
    }
    if (invalidSavedMatch && (command.type === 'start-game' || command.type === 'restart')) return { status: 'ignored', reason: 'not-ready' }
    if (command.type === 'retry-cpu') {
      if (!cpuTurn() || (snapshot.request.status !== 'failed' && (snapshot.request.status !== 'pending' || !snapshot.request.retryAvailable))) return { status: 'ignored', reason: 'illegal' }
      const count = snapshot.request.consecutiveInvalid
      releaseAttempt()
      publish({ ...snapshot, request: { status: 'idle', consecutiveInvalid: count } })
      reconcile()
      return { status: 'applied' }
    }
    const matchId = (command.type === 'start-game' && !snapshot.match) || (command.type === 'restart' && snapshot.match?.moves.length === 0) ? deps.newId() : undefined
    const outcome = transition(snapshot, command, matchId)
    if (outcome.result.status === 'ignored') return outcome.result
    if (outcome.snapshot.match !== snapshot.match && attempt) releaseAttempt()
    const saved = outcome.persistence === 'match' ? saveMatch(outcome.snapshot)
      : outcome.persistence === 'remove-match' ? storage.removeMatch()
        : outcome.persistence === 'settings' ? storage.writeSettings({ schemaVersion: SCHEMA_VERSION, settings: outcome.snapshot.settings })
          : null
    publish(outcome.snapshot)
    if (saved) writeResult(saved)
    if (outcome.persistence === 'settings') clearNotice('invalid-settings')
    reconcile()
    return outcome.result
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch, start,
    dispose: () => { if (disposed) return; disposed = true; releaseAttempt(); listeners.clear() },
  }
}
