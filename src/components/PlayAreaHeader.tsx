import { BookOpenText, ChevronsLeft, ChevronsRight, Flag, RotateCcw } from 'lucide-react'

export interface PlayAreaHeaderProps {
  action: 'Resign' | 'Restart' | 'Rematch'
  status: string
  tone: string
  reviewing: boolean
  canGoBack: boolean
  canGoForward: boolean
  canReview: boolean
  onAction: () => void
  onBack: () => void
  onForward: () => void
  onReview: () => void
  onReturn: () => void
}

export function PlayAreaHeader({ action, status, tone, reviewing, canGoBack, canGoForward, canReview, onAction, onBack, onForward, onReview, onReturn }: PlayAreaHeaderProps) {
  return <div className="pv-play-header" aria-label="Match controls">
    <button className="pv-icon-button" type="button" aria-label={action} title={action} onClick={onAction}>
      {action === 'Resign' ? <Flag aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
    </button>
    <button className="pv-icon-button" type="button" aria-label="Earlier" title="Previous move" disabled={!canGoBack} onClick={onBack}><ChevronsLeft aria-hidden="true" /></button>
    {reviewing
      ? <button className="pv-button pv-button-primary pv-return-current" type="button" onClick={onReturn}>Return to current</button>
      : <p className={`pv-board-status pv-board-status-${tone}`} role="status" aria-live="polite">{status}</p>}
    {reviewing
      ? <button className="pv-icon-button" type="button" aria-label="Later" title="Next move" disabled={!canGoForward} onClick={onForward}><ChevronsRight aria-hidden="true" /></button>
      : <button className="pv-icon-button" type="button" aria-label="Review moves" title="Review moves" disabled={!canReview} onClick={onReview}><BookOpenText aria-hidden="true" /></button>}
  </div>
}
