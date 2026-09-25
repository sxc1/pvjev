import { ChevronsLeft, ChevronsRight, Eye, EyeOff } from 'lucide-react'
import type { ConnectFourCommand, ConnectFourSnapshot } from '../contracts'
import { selectConnectFourPresentation } from '../games/connect-four/selectors'
import './connect-four-history.css'

export interface ConnectFourHistoryProps {
  snapshot: ConnectFourSnapshot
  dispatch: (command: ConnectFourCommand) => unknown
}

export function ConnectFourHistory({ snapshot, dispatch }: ConnectFourHistoryProps) {
  const presentation = selectConnectFourPresentation(snapshot)
  if (!presentation) return null
  const expanded = snapshot.view.mobileHistoryOpen
  return <section className="cf-history-widget" aria-label="Connect Four history">
    <div className="cf-history-heading">
      <h2>Move history</h2>
      <button className="pv-icon-button cf-mobile-toggle" type="button" aria-label={expanded ? 'Hide history' : 'Show history'}
        aria-expanded={expanded} aria-controls="cf-history-content"
        onClick={() => dispatch({ type: 'set-mobile-history-open', open: !expanded })}>
        {expanded ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
    <div id="cf-history-content" className={`cf-history-content${expanded ? ' cf-history-expanded' : ''}`}>
      <div className="cf-history-controls" aria-label="Review navigation">
        <button className="pv-button pv-button-secondary" type="button" aria-label="Earlier" disabled={!presentation.canGoBack}
          onClick={() => dispatch({ type: 'navigate-history', direction: 'back' })}><ChevronsLeft aria-hidden="true" /></button>
        <button className="pv-button pv-button-secondary" type="button" aria-label="Later" disabled={!presentation.canGoForward}
          onClick={() => dispatch({ type: 'navigate-history', direction: 'forward' })}><ChevronsRight aria-hidden="true" /></button>
      </div>
      {presentation.entries.length === 0 ? <p>No moves yet.</p> : <ol className="cf-history-list">
        {presentation.entries.map(entry => <li key={entry.ply}>
          <button type="button" className={`cf-history-entry${entry.selected ? ' cf-history-entry-selected' : ''}`}
            aria-current={entry.selected ? 'step' : undefined} onClick={() => dispatch({ type: 'select-history', ply: entry.ply })}>
            <span>{entry.label}</span><span>{entry.record.actor === 'human' ? 'You' : 'CPU'}</span>
          </button>
        </li>)}
      </ol>}
      {presentation.canReturnToCurrent && <button className="pv-button pv-button-primary" type="button"
        onClick={() => dispatch({ type: 'return-to-current' })}>Return to current</button>}
    </div>
  </section>
}
