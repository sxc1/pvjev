import { Eye, EyeOff } from 'lucide-react'
import type { ReactNode } from 'react'

export interface MoveHistoryEntry {
  readonly ply: number
  readonly label: string
  readonly selected: boolean
  readonly actor: 'human' | 'cpu'
}

export function MoveHistory({ entries, expanded, contentId, onToggle, onSelect, children }: {
  entries: readonly MoveHistoryEntry[]
  expanded: boolean
  contentId: string
  onToggle: () => void
  onSelect: (ply: number) => void
  children?: ReactNode
}) {
  return <div className="pv-history-widget">
    <div className="pv-history-heading">
      <h2>Move history</h2>
      <button className="pv-icon-button pv-history-toggle" type="button" aria-label={expanded ? 'Hide history' : 'Show history'}
        aria-expanded={expanded} aria-controls={contentId} onClick={onToggle}>
        {expanded ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
    <div id={contentId} className={`pv-history-content${expanded ? ' pv-history-expanded' : ''}`}>
      {entries.length === 0 ? <p className="pv-empty-history">No moves yet.</p> : <ol className="pv-history-list">
        {entries.map(entry => <li key={entry.ply}>
          <button className={`pv-history-entry${entry.selected ? ' pv-history-entry-selected' : ''}`} type="button"
            aria-current={entry.selected ? 'step' : undefined} onClick={() => onSelect(entry.ply)}>
            <span>{entry.label}</span><span>{entry.actor === 'human' ? 'You' : 'CPU'}</span>
          </button>
        </li>)}
      </ol>}
      {children}
    </div>
  </div>
}
