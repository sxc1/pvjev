import { JEV_PROBABILITY_SUM_TOLERANCE, JEV_RETAINED_CHOICE_LIMIT, type JevAnalysis } from '../../src/contracts/jev.ts'

export interface ChoiceData { readonly choice: unknown; readonly confidence: unknown; readonly probabilities: unknown; readonly resolvedModelId: unknown }

/** Reject malformed data before ranking; exact ties use the caller's canonical legal order. */
export function validateJevChoice(value: ChoiceData, legalMoveIds: readonly string[]): { moveId: string; analysis: JevAnalysis } | null {
  if (typeof value.choice !== 'string' || typeof value.resolvedModelId !== 'string' || !value.resolvedModelId.trim() ||
    typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1 ||
    typeof value.probabilities !== 'object' || value.probabilities === null || Array.isArray(value.probabilities) ||
    !legalMoveIds.length || new Set(legalMoveIds).size !== legalMoveIds.length || !legalMoveIds.includes(value.choice)) return null
  const probabilities = value.probabilities as Record<string, unknown>
  if (Object.keys(probabilities).length !== legalMoveIds.length ||
    !legalMoveIds.every(id => Object.hasOwn(probabilities, id))) return null
  let sum = 0
  for (const id of legalMoveIds) {
    const probability = probabilities[id]
    if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) return null
    sum += probability
  }
  if (Math.abs(sum - 1) > JEV_PROBABILITY_SUM_TOLERANCE) return null
  const peak = Math.max(...legalMoveIds.map(id => probabilities[id] as number))
  if (probabilities[value.choice] !== peak) return null
  const leaders = legalMoveIds.filter(id => probabilities[id] === peak)
  const selectedMoveId = leaders[0]
  const choices = legalMoveIds.map((moveId, order) => ({ moveId, probability: probabilities[moveId] as number, order }))
    .sort((a, b) => b.probability - a.probability || a.order - b.order)
    .slice(0, JEV_RETAINED_CHOICE_LIMIT)
    .map(({ moveId, probability }) => ({ moveId, probability }))
  return { moveId: selectedMoveId, analysis: { confidence: value.confidence, choices,
    tie: { count: leaders.length, selectedMoveId }, resolvedModelId: value.resolvedModelId } }
}
