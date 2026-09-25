import type { TicTacToeScreenProps } from '../contracts'
import { inspectionText, selectTicTacToePresentation } from '../games/tic-tac-toe/selectors'
import { MoveHistory } from './MoveHistory'
import './tic-tac-toe-widgets.css'

export function TicTacToeHistory({ snapshot, dispatch }: TicTacToeScreenProps) {
  const presentation = selectTicTacToePresentation(snapshot)
  if (!presentation || !snapshot.match) return null
  const expanded = snapshot.view.mobileHistoryOpen
  return (
    <MoveHistory entries={presentation.entries.map(entry => ({ ...entry, actor: entry.record.actor }))} expanded={expanded}
      contentId="ttt-history-content" onToggle={() => dispatch({ type: 'set-mobile-history-open', open: !expanded })}
      onSelect={ply => dispatch({ type: 'select-history', ply })}>
        {presentation.reviewing && presentation.reviewedMove && (
          <div className="ttt-inspection" aria-label="Move inspection">
            <p className="ttt-inspection-title">Reviewing {presentation.entries[presentation.reviewedMove.ply - 1]?.label}</p>
            <p>{inspectionText(presentation.reviewedMove)}</p>
          </div>
        )}
    </MoveHistory>
  )
}
