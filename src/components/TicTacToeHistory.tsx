import { ChevronsLeft, ChevronsRight, Eye, EyeOff } from 'lucide-react'
import type { TicTacToeScreenProps } from '../contracts'
import { inspectionText, selectTicTacToePresentation } from '../games/tic-tac-toe/selectors'
import './tic-tac-toe-widgets.css'

export function TicTacToeHistory({ snapshot, dispatch }: TicTacToeScreenProps) {
  const presentation = selectTicTacToePresentation(snapshot)
  if (!presentation || !snapshot.match) return null
  const expanded = snapshot.view.mobileHistoryOpen
  return (
    <div className="ttt-history-widget">
      <div className="ttt-history-heading">
        <h2>Move history</h2>
        <button
          className="pv-icon-button ttt-mobile-toggle"
          type="button"
          aria-label={expanded ? 'Hide history' : 'Show history'}
          aria-expanded={expanded}
          aria-controls="ttt-history-content"
          onClick={() => dispatch({ type: 'set-mobile-history-open', open: !expanded })}
        >{expanded ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
      </div>
      <div id="ttt-history-content" className={`ttt-history-content${expanded ? ' ttt-history-expanded' : ''}`}>
        <div className="ttt-history-controls" aria-label="Review navigation">
          <button className="pv-button pv-button-secondary" type="button" aria-label="Earlier" disabled={!presentation.canGoBack} onClick={() => dispatch({ type: 'navigate-history', direction: 'back' })}><ChevronsLeft aria-hidden="true" /></button>
          <button className="pv-button pv-button-secondary" type="button" aria-label="Later" disabled={!presentation.canGoForward} onClick={() => dispatch({ type: 'navigate-history', direction: 'forward' })}><ChevronsRight aria-hidden="true" /></button>
        </div>
        {presentation.entries.length === 0 ? <p className="ttt-empty-history">No moves yet.</p> : (
          <ol className="ttt-history-list">
            {presentation.entries.map(entry => (
              <li key={entry.ply}>
                <button className={`ttt-history-entry${entry.selected ? ' ttt-history-entry-selected' : ''}`} type="button" aria-current={entry.selected ? 'step' : undefined} onClick={() => dispatch({ type: 'select-history', ply: entry.ply })}>
                  <span>{entry.label}</span><span>{entry.record.actor === 'human' ? 'You' : 'CPU'}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {presentation.reviewing && presentation.reviewedMove && (
          <div className="ttt-inspection" aria-label="Move inspection">
            <p className="ttt-inspection-title">Reviewing {presentation.entries[presentation.reviewedMove.ply - 1]?.label}</p>
            <p>{inspectionText(presentation.reviewedMove)}</p>
          </div>
        )}
        {presentation.canReturnToCurrent && <button className="pv-button pv-button-primary ttt-return" type="button" onClick={() => dispatch({ type: 'return-to-current' })}>Return to current</button>}
      </div>
    </div>
  )
}
