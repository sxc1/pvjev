import type { ConnectFourCommand, ConnectFourSnapshot } from '../contracts'
import { selectConnectFourPresentation } from '../games/connect-four/selectors'
import { inspectionText } from '../games/connect-four/selectors'
import { MoveHistory } from './MoveHistory'

export interface ConnectFourHistoryProps {
  snapshot: ConnectFourSnapshot
  dispatch: (command: ConnectFourCommand) => unknown
}

export function ConnectFourHistory({ snapshot, dispatch }: ConnectFourHistoryProps) {
  const presentation = selectConnectFourPresentation(snapshot)
  if (!presentation) return null
  const expanded = snapshot.view.mobileHistoryOpen
  return <MoveHistory entries={presentation.entries.map(entry => ({ ...entry, actor: entry.record.actor }))} expanded={expanded}
    contentId="cf-history-content" onToggle={() => dispatch({ type: 'set-mobile-history-open', open: !expanded })}
    onSelect={ply => dispatch({ type: 'select-history', ply })}>
    {presentation.reviewing && presentation.reviewedMove && <div className="pv-inspection" aria-label="Move inspection">
      <p className="pv-inspection-title">Reviewing {presentation.entries[presentation.reviewedMove.ply - 1]?.label}</p>
      <p>{inspectionText(presentation.reviewedMove)}</p>
    </div>}
  </MoveHistory>
}
