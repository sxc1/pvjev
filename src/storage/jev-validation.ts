import { JEV_PROBABILITY_SUM_TOLERANCE, JEV_RETAINED_CHOICE_LIMIT, isPartOneAssignment, isOpponentAssignment, isProvenanceAllowed, type OpponentAssignment } from '../contracts/jev'

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const probability = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export function validRecovery(value: unknown, cpuTurn: boolean, assignment: OpponentAssignment): boolean {
  if (!object(value) || !exactKeys(value, ['consecutiveServiceFailures', 'consecutiveInvalid', 'disposition']) || !Number.isInteger(value.consecutiveServiceFailures) || !Number.isInteger(value.consecutiveInvalid) ||
    Number(value.consecutiveServiceFailures) < 0 || Number(value.consecutiveServiceFailures) > 2 ||
    Number(value.consecutiveInvalid) < 0 || Number(value.consecutiveInvalid) > 2 ||
    (value.disposition !== 'ready' && value.disposition !== 'manual-retry-required')) return false
  if (!cpuTurn) return value.consecutiveServiceFailures === 0 && value.consecutiveInvalid === 0 && value.disposition === 'ready'
  if (assignment.opponent === 'rng') return value.consecutiveServiceFailures === 0 && value.disposition === 'ready'
  return value.disposition !== 'manual-retry-required' || Number(value.consecutiveServiceFailures) > 0
}

export function validPartOneAssignment(value: unknown): value is OpponentAssignment {
  return isOpponentAssignment(value) && isPartOneAssignment(value)
}

export function validMoveMetadata(value: unknown, assignment: OpponentAssignment, legalMoveIds: readonly string[], playedMoveId: string): boolean {
  if (!object(value) || (value.actor !== 'human' && value.actor !== 'cpu') ||
    !isProvenanceAllowed(assignment, value.actor, value.provenance as never)) return false
  if (value.provenance === 'jev') return !('diagnostic' in value) && validAnalysis(value.analysis, legalMoveIds, playedMoveId)
  if ('analysis' in value) return false
  if (value.provenance === 'rng-fallback') return typeof value.diagnostic === 'string' && value.diagnostic.length > 0
  return !('diagnostic' in value)
}

export function validAnalysis(value: unknown, legalMoveIds: readonly string[], playedMoveId: string): boolean {
  if (!object(value) || !exactKeys(value, ['confidence', 'choices', 'tie', 'resolvedModelId']) || !probability(value.confidence) ||
    typeof value.resolvedModelId !== 'string' || value.resolvedModelId.trim().length === 0 ||
    !Array.isArray(value.choices) || value.choices.length !== Math.min(legalMoveIds.length, JEV_RETAINED_CHOICE_LIMIT) ||
    !object(value.tie) || !exactKeys(value.tie, ['count', 'selectedMoveId']) || !Number.isInteger(value.tie.count) || Number(value.tie.count) < 1 ||
    value.tie.selectedMoveId !== playedMoveId || !legalMoveIds.includes(playedMoveId)) return false
  const seen = new Set<string>()
  const choices: { moveId: string; probability: number }[] = []
  for (const choice of value.choices) {
    if (!object(choice) || !exactKeys(choice, ['moveId', 'probability']) || typeof choice.moveId !== 'string' || !legalMoveIds.includes(choice.moveId) ||
      seen.has(choice.moveId) || !probability(choice.probability)) return false
    seen.add(choice.moveId)
    choices.push({ moveId: choice.moveId, probability: choice.probability })
  }
  const order = new Map(legalMoveIds.map((id, index) => [id, index]))
  for (let index = 1; index < choices.length; index += 1) {
    const previous = choices[index - 1], current = choices[index]
    if (previous.probability < current.probability ||
      (previous.probability === current.probability && order.get(previous.moveId)! > order.get(current.moveId)!)) return false
  }
  if (choices[0]?.moveId !== playedMoveId) return false
  const tieCount = choices.filter(choice => choice.probability === choices[0].probability).length
  if (value.tie.count !== tieCount) return false
  if (choices.length === legalMoveIds.length && Math.abs(choices.reduce((sum, choice) => sum + choice.probability, 0) - 1) > JEV_PROBABILITY_SUM_TOLERANCE) return false
  return true
}


