import type { JevAnalysis as Analysis } from '../contracts/jev'

export const JEV_TIE_CAUTION = 'Several moves have the same highest choice probability. The first legal move in game order was chosen.'

export function JevAnalysis({ analysis, moveLabel }: { readonly analysis: Analysis; readonly moveLabel: (moveId: string) => string }) {
  return <div className="pv-jev-analysis" aria-label="Jev choice analysis">
    <p>Confidence {analysis.confidence.toFixed(3)}</p>
    {analysis.tie.count > 1 && <p className="pv-jev-tie" tabIndex={0} role="note">{JEV_TIE_CAUTION}</p>}
    <p>Choice probabilities, not win probabilities:</p>
    <ol>{analysis.choices.map(choice => <li key={choice.moveId}>
      <span>{moveLabel(choice.moveId)}{choice.moveId === analysis.tie.selectedMoveId ? ' (chosen)' : ''}</span>
      <span>Choice probability {choice.probability.toFixed(3)}</span>
    </li>)}</ol>
  </div>
}
