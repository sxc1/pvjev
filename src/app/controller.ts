import type { ControllerDependencies, MatchCompletedEvent, RequestToken, TicTacToeController, TicTacToeMatch, TicTacToeSnapshot } from '../contracts'
import { SCHEMA_VERSION, SETTINGS_SCHEMA_VERSION } from '../contracts/persistence'
import { createAttemptResources, createRequestToken, sameRequestToken, type AttemptResources } from '../cpu/requests'
import { classifyJevError, createJevAttempt, stepJevRecovery, type JevAttempt } from './jev-access'
import { JEV_INVALID_FALLBACK_DIAGNOSTIC, JEV_SERVICE_FALLBACK_DIAGNOSTIC, JEV_SAFE_ERROR_MESSAGES, JEV_PROTOCOL_VERSION, type JevAnalysis, type JevErrorCode } from '../contracts/jev'
import { sampleLegalMove } from '../cpu/random'
import { isLegalMove } from '../games/tic-tac-toe/rules'
import { createStorageAdapter, decodeReplayMatchEnvelope } from '../storage'
import { validAnalysis } from '../storage/jev-validation'
import { appendMove, emptySnapshot, liveView, transition } from './transitions'

const FALLBACK_MESSAGE = 'CPU returned three invalid moves; a random legal move was used.'

export function createTicTacToeController(deps: ControllerDependencies): TicTacToeController {
  const storage = createStorageAdapter(deps.storage)
  const listeners = new Set<() => void>()
  let snapshot = emptySnapshot()
  let started = false
  let disposed = false
  let attempt: AttemptResources | JevAttempt | null = null
  let activeKeyRevision = deps.visitorKey?.getRevision() ?? 0
  let invalidSavedMatch = false
  const unsubscribeSettings = deps.settings?.subscribe(() => {
    const settings = deps.settings!.getSnapshot()
    if (settings !== snapshot.settings) publish({ ...snapshot, settings, view: { ...snapshot.view, pendingCell: null } })
  })

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
    ? storage.writeMatch({ schemaVersion: SCHEMA_VERSION, match: next.match, recovery: { consecutiveInvalid: next.request.consecutiveInvalid, consecutiveServiceFailures: next.request.consecutiveServiceFailures, disposition: next.request.status === 'failed' || next.request.disposition === 'manual-retry-required' ? 'manual-retry-required' : 'ready' } })
    : { status: 'saved' as const }
  const completion = (previous: TicTacToeMatch | null, next: TicTacToeMatch | null): MatchCompletedEvent | null => {
    if (!previous || !next || previous.id !== next.id || previous.outcome.kind !== 'ongoing' || next.outcome.kind === 'ongoing') return null
    const result = next.outcome.kind === 'draw' ? 'draw' : next.outcome.winner === next.humanSymbol ? 'win' : 'loss'
    return { gameId: 'tic-tac-toe', matchId: next.id, opponent: next.assignment.opponent, result }
  }
  const notifyCompletion = (event: MatchCompletedEvent | null) => {
    if (!event) return
    try { deps.onMatchCompleted?.(event) } catch (error) { console.error('Match completion callback failed', error) }
  }
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
  const commitCpu = (cell: number, diagnostic?: string, analysis?: JevAnalysis) => {
    const match = snapshot.match!
    releaseAttempt()
    const nextMatch = appendMove(match, cell, 'cpu', diagnostic, analysis)
    const next = { ...snapshot, match: nextMatch, request: { status: 'idle' as const, consecutiveInvalid: 0, consecutiveServiceFailures: 0 },
      view: nextMatch.outcome.kind === 'ongoing' ? snapshot.view : { ...snapshot.view, resignationDialogOpen: false } }
    const event = completion(match, nextMatch)
    const saved = saveMatch(next)
    publish(next)
    writeResult(saved)
    notifyCompletion(event)
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
    const next = { ...snapshot, request: { status: 'idle' as const, consecutiveInvalid: count, consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } }
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
    publish({ ...snapshot, request: { status: 'failed', token, error: message, retryAvailable: true, consecutiveInvalid: count, consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } })
  }
  const handleSuccess = (token: RequestToken, result: unknown) => {
    if (!current(token)) return
    const candidate = typeof result === 'object' && result !== null ? (result as { move?: unknown; analysis?: unknown }).move : undefined
    if (!isLegalMove(snapshot.match!.position, candidate)) { handleInvalid(token); return }
    commitCpu(candidate)
  }
  const jevCurrent = (token: RequestToken) => {
    if (!current(token) || !attempt || !('accept' in attempt)) return 'stale' as const
    const verdict = attempt.accept(token, deps.visitorKey?.getRevision() ?? -1)
    if (verdict === 'expired') expireJev(token)
    return verdict
  }
  const finishJevFailure = (token: RequestToken, code: JevErrorCode) => {
    if (jevCurrent(token) !== 'current') return
    const step = stepJevRecovery(snapshot.request, 'service')
    const nextCount = step.consecutiveServiceFailures
    releaseAttempt()
    if (step.fallback) {
      commitCpu(sampleLegalMove(deps.rules.legalMoves(snapshot.match!.position), deps.random), JEV_SERVICE_FALLBACK_DIAGNOSTIC)
      return
    }
    const next: TicTacToeSnapshot = { ...snapshot, request: { status: 'failed', token, error: JEV_SAFE_ERROR_MESSAGES[code], retryAvailable: true,
      consecutiveInvalid: snapshot.request.consecutiveInvalid, consecutiveServiceFailures: nextCount } }
    const saved = saveMatch(next)
    publish(next)
    writeResult(saved)
  }
  const expireJev = (token: RequestToken) => {
    if (!current(token) || !attempt || !('accept' in attempt)) return
    const step = stepJevRecovery(snapshot.request, 'service')
    const nextCount = step.consecutiveServiceFailures
    releaseAttempt()
    if (step.fallback) {
      commitCpu(sampleLegalMove(deps.rules.legalMoves(snapshot.match!.position), deps.random), JEV_SERVICE_FALLBACK_DIAGNOSTIC)
      return
    }
    const next: TicTacToeSnapshot = { ...snapshot, request: { status: 'failed', token, error: JEV_SAFE_ERROR_MESSAGES.transport, retryAvailable: true,
      consecutiveInvalid: snapshot.request.consecutiveInvalid, consecutiveServiceFailures: nextCount } }
    const saved = saveMatch(next)
    publish(next)
    writeResult(saved)
  }
  const finishJevInvalid = (token: RequestToken) => {
    if (jevCurrent(token) !== 'current') return
    const step = stepJevRecovery(snapshot.request, 'invalid')
    const nextCount = step.consecutiveInvalid
    releaseAttempt()
    if (step.fallback) {
      commitCpu(sampleLegalMove(deps.rules.legalMoves(snapshot.match!.position), deps.random), JEV_INVALID_FALLBACK_DIAGNOSTIC)
      return
    }
    const next: TicTacToeSnapshot = { ...snapshot, request: { status: 'idle', consecutiveInvalid: nextCount,
      consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } }
    const saved = saveMatch(next)
    publish(next)
    writeResult(saved)
    reconcile()
  }
  const dispatchJev = (match: TicTacToeMatch) => {
    const key = deps.visitorKey?.getKey()
    if (!key) {
      publish({ ...snapshot, request: { status: 'waiting-for-key', consecutiveInvalid: snapshot.request.consecutiveInvalid,
        consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } })
      return
    }
    const token = createRequestToken({ gameId: match.gameId, matchId: match.id, expectedPly: match.moves.length + 1 }, deps.newId)
    const revision = deps.visitorKey!.getRevision()
    const resources = createJevAttempt(token, deps.scheduler, revision)
    attempt = resources
    activeKeyRevision = revision
    const legalMoves = [...deps.rules.legalMoves(match.position)]
    const position = { ...match.position, board: [...match.position.board], winningLines: [...match.position.winningLines] }
    publish({ ...snapshot, request: { status: 'pending', token, startedAt: resources.startedAt, retryAvailable: false,
      consecutiveInvalid: snapshot.request.consecutiveInvalid, consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } })
    resources.scheduleDeadline(() => expireJev(token))
    if (!deps.jev) { finishJevFailure(token, 'service'); return }
    try {
      Promise.resolve(deps.jev.chooseMove({ identity: { protocolVersion: JEV_PROTOCOL_VERSION, gameId: match.gameId, matchId: token.matchId, expectedPly: token.expectedPly, attemptId: token.attemptId }, position: position as unknown as typeof match.position,
        legalMoves, cpuSide: match.position.nextSymbol, credentialRoute: 'visitor', visitorKey: key, signal: resources.signal }))
        .then(value => {
          if (jevCurrent(token) !== 'current') return
          if (!isLegalMove(snapshot.match!.position, value?.move) || !validAnalysis(value?.analysis, legalMoves.map(cell => 'cell-' + cell), 'cell-' + value?.move)) { finishJevInvalid(token); return }
          commitCpu(value.move, undefined, value.analysis)
        }, error => {
          if (jevCurrent(token) !== 'current') return
          const classified = classifyJevError(error)
          if (classified.code === 'invalid_response') finishJevInvalid(token)
          else finishJevFailure(token, classified.code)
        })
    } catch (error) {
      const classified = classifyJevError(error)
      if (classified.code === 'invalid_response') finishJevInvalid(token)
      else finishJevFailure(token, classified.code)
    }
  }
  const reconcile = () => {
    if (!started || disposed || invalidSavedMatch || !cpuTurn()) return
    if (attempt || snapshot.request.status === 'failed' || snapshot.request.disposition === 'manual-retry-required') return
    if (snapshot.match!.assignment.opponent === 'jev') { dispatchJev(snapshot.match!); return }
    const match = snapshot.match!
    const token = createRequestToken({ gameId: match.gameId, matchId: match.id, expectedPly: match.moves.length + 1 }, deps.newId)
    const resources = createAttemptResources(token, deps.scheduler)
    attempt = resources
    publish({ ...snapshot, request: { status: 'pending', token, startedAt: deps.scheduler.now(), retryAvailable: false, consecutiveInvalid: snapshot.request.consecutiveInvalid, consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } })
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
  const unsubscribeKey = deps.visitorKey?.subscribe(() => {
    const revision = deps.visitorKey!.getRevision()
    if (revision === activeKeyRevision) return
    activeKeyRevision = revision
    if (snapshot.match?.assignment.opponent !== 'jev' || !cpuTurn()) return
    if (attempt) {
      releaseAttempt()
      publish({ ...snapshot, request: { status: 'idle', consecutiveInvalid: snapshot.request.consecutiveInvalid,
        consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } })
    }
    if (snapshot.request.status === 'waiting-for-key' || snapshot.request.status === 'idle') reconcile()
  })
  const start = () => {
    if (started || disposed) return
    started = true
    if (deps.settings) publish({ ...snapshot, settings: deps.settings.getSnapshot() })
    else {
      const settings = storage.readSettings()
      if (settings.status === 'valid') publish({ ...snapshot, settings: settings.value.settings })
      else if (settings.status === 'invalid') addNotice('invalid-settings', settings.reason)
      else if (settings.status === 'unavailable') addNotice('unavailable', `Settings could not be loaded. ${settings.error}`)
    }
    const saved = storage.readMatch(decodeReplayMatchEnvelope)
    if (saved.status === 'valid') publish({ ...snapshot, match: saved.value.match, setupSymbol: saved.value.match.humanSymbol, view: liveView(), request: { status: 'idle', consecutiveInvalid: saved.value.recovery.consecutiveInvalid, consecutiveServiceFailures: saved.value.recovery.consecutiveServiceFailures, disposition: saved.value.recovery.disposition } })
    else if (saved.status === 'invalid') { invalidSavedMatch = true; addNotice('invalid-match', `${saved.reason} Choose Start fresh to replace it.`) }
    else if (saved.status === 'unavailable') addNotice('unavailable', `Match could not be loaded. ${saved.error}`)
    reconcile()
  }
  const dispatch: TicTacToeController['dispatch'] = command => {
    if (!started || disposed) return { status: 'ignored', reason: 'not-ready' }
    if (command.type === 'set-confirm-moves' && deps.settings) {
      if (typeof command.enabled !== 'boolean') return { status: 'ignored', reason: 'illegal' }
      deps.settings.setConfirmMoves(command.enabled)
      return { status: 'applied' }
    }
    if (command.type === 'start-fresh') {
      if (!invalidSavedMatch) return { status: 'ignored', reason: 'illegal' }
      invalidSavedMatch = false
      releaseAttempt()
      publish({ ...snapshot, match: null, view: liveView(), request: { status: 'idle', consecutiveInvalid: 0, consecutiveServiceFailures: 0 } })
      writeResult(storage.removeMatch())
      clearNotice('invalid-match')
      return { status: 'applied' }
    }
    if (invalidSavedMatch && (command.type === 'start-game' || command.type === 'restart')) return { status: 'ignored', reason: 'not-ready' }
    if (command.type === 'retry-cpu') {
      if (!cpuTurn() || (snapshot.match?.assignment.opponent === 'jev'
        ? snapshot.request.status !== 'failed' && snapshot.request.disposition !== 'manual-retry-required'
        : snapshot.request.status !== 'failed' && (snapshot.request.status !== 'pending' || !snapshot.request.retryAvailable))) return { status: 'ignored', reason: 'illegal' }
      const count = snapshot.request.consecutiveInvalid
      releaseAttempt()
      const next: TicTacToeSnapshot = { ...snapshot, request: { status: 'idle', consecutiveInvalid: count, consecutiveServiceFailures: snapshot.request.consecutiveServiceFailures } }
      publish(next)
      if (next.match?.assignment.opponent === 'jev') writeResult(saveMatch(next))
      reconcile()
      return { status: 'applied' }
    }
    const matchId = (command.type === 'start-game' && !snapshot.match) || (command.type === 'restart' && snapshot.match?.moves.length === 0) ? deps.newId() : undefined
    let outcome = transition(snapshot, command, matchId)
    if (outcome.result.status === 'applied' && outcome.snapshot.match && (command.type === 'start-game' || command.type === 'restart')) {
      const assignment = deps.visitorKey?.getKey() ? { opponent: 'jev' as const, credentialRoute: 'visitor' as const } : { opponent: 'rng' as const }
      outcome = { ...outcome, snapshot: { ...outcome.snapshot, match: { ...outcome.snapshot.match, assignment } } }
    }
    if (outcome.result.status === 'ignored') return outcome.result
    const event = completion(snapshot.match, outcome.snapshot.match)
    if (outcome.snapshot.match !== snapshot.match && attempt) releaseAttempt()
    const saved = outcome.persistence === 'match' ? saveMatch(outcome.snapshot)
      : outcome.persistence === 'remove-match' ? storage.removeMatch()
        : outcome.persistence === 'settings' ? storage.writeSettings({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings: outcome.snapshot.settings })
          : null
    publish(outcome.snapshot)
    if (saved) writeResult(saved)
    notifyCompletion(event)
    if (outcome.persistence === 'settings') clearNotice('invalid-settings')
    reconcile()
    return outcome.result
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch, start,
    dispose: () => { if (disposed) return; disposed = true; releaseAttempt(); unsubscribeSettings?.(); unsubscribeKey?.(); listeners.clear() },
  }
}
