import type { ReactNode } from 'react'
import type { ConnectFourCommand, ConnectFourSnapshot, GameId } from '../contracts'
import { selectConnectFourPresentation } from '../games/connect-four/selectors'
import { AppShell, ResignationDialog } from './AppShell'
import { ConnectFourBoard } from './ConnectFourBoard'
import { ConnectFourHistory } from './ConnectFourHistory'
import { PlayAreaHeader } from './PlayAreaHeader'
import './connect-four-screen.css'

export interface ConnectFourScreenProps {
  readonly snapshot: ConnectFourSnapshot
  readonly dispatch: (command: ConnectFourCommand) => unknown
  readonly onConfirmMoves: (enabled: boolean) => void
  readonly onSelectGame?: (gameId: GameId) => void
  readonly board?: ReactNode
  readonly history?: ReactNode
}

function status(snapshot: ConnectFourSnapshot): { label: string; tone: string } {
  const match = snapshot.match!
  if (match.outcome.kind === 'resignation') return { label: 'Defeat', tone: 'defeat' }
  if (match.outcome.kind === 'draw') return { label: 'Draw', tone: 'draw' }
  if (match.outcome.kind === 'win') return match.outcome.winner === (match.setup.humanOrder === 'first' ? 'one' : 'two')
    ? { label: 'Victory', tone: 'victory' } : { label: 'Defeat', tone: 'defeat' }
  if (snapshot.request.status === 'failed') return { label: 'CPU move failed', tone: 'waiting' }
  if (snapshot.request.status === 'pending') return { label: 'CPU is thinking…', tone: 'waiting' }
  return match.position.nextPlayer === (match.setup.humanOrder === 'first' ? 'one' : 'two')
    ? { label: 'Your turn', tone: 'turn' } : { label: 'CPU’s turn', tone: 'waiting' }
}

function matchAction(snapshot: ConnectFourSnapshot): { label: string; command: ConnectFourCommand } | null {
  const match = snapshot.match
  if (!match) return null
  if (match.outcome.kind !== 'ongoing') return { label: 'Rematch', command: { type: 'rematch' } }
  if (match.moves.length === 0) return { label: 'Restart', command: { type: 'restart' } }
  return { label: 'Resign', command: { type: 'open-resignation' } }
}

export function ConnectFourScreen({ snapshot, dispatch, onConfirmMoves, onSelectGame, board, history }: ConnectFourScreenProps) {
  const action = matchAction(snapshot)
  const liveStatus = snapshot.match ? status(snapshot) : null
  const presentation = selectConnectFourPresentation(snapshot)
  const invalidMatch = snapshot.notices.some(notice => notice.kind === 'invalid-match')
  const reviewing = snapshot.view.location.mode === 'review'
  return <AppShell selectedGame="connect-four" onSelectGame={onSelectGame} settings={snapshot.settings}
    onConfirmMoves={onConfirmMoves}>
    <main className="pv-main">
      {snapshot.notices.map((notice, index) => <div className="pv-notice" role="status" key={`${notice.kind}-${index}`}>
        <span>{notice.message}</span>
        {notice.kind === 'invalid-match' && <button className="pv-button pv-button-secondary" type="button" onClick={() => dispatch({ type: 'start-fresh' })}>Start fresh</button>}
      </div>)}
      {!snapshot.match ? <section className="pv-setup pv-card" aria-labelledby="cf-setup-title">
        <p className="pv-eyebrow">New match</p>
        <h2 id="cf-setup-title">Set up Connect Four</h2>
        <p>Choose your color and move order. The CPU chooses random legal columns.</p>
        <div className="cf-setup-row" role="group" aria-label="Your color">
          <span className="cf-setup-row-label">Your color</span>
          <div className="cf-setup-options">{(['red', 'yellow'] as const).map(color => <button key={color} type="button"
            className={`pv-side-option cf-color-option${snapshot.setup.humanColor === color ? ' pv-side-option-selected' : ''}`}
            aria-label={`Play as ${color}`} aria-pressed={snapshot.setup.humanColor === color}
            onClick={() => dispatch({ type: 'select-color', color })}><span className={`cf-color-swatch cf-color-swatch-${color}`} />{color[0].toUpperCase() + color.slice(1)}</button>)}</div>
        </div>
        <div className="cf-setup-row" role="group" aria-label="Move order">
          <span className="cf-setup-row-label">Move order</span>
          <div className="cf-setup-options">{(['first', 'second'] as const).map(order => <button key={order} type="button"
            className={`pv-side-option cf-order-option${snapshot.setup.humanOrder === order ? ' pv-side-option-selected' : ''}`}
            aria-label={`Play ${order}`} aria-pressed={snapshot.setup.humanOrder === order}
            onClick={() => dispatch({ type: 'select-order', order })}>{order[0].toUpperCase() + order.slice(1)}</button>)}</div>
        </div>
        <div className="pv-setup-actions"><button className="pv-button pv-button-primary" type="button" disabled={invalidMatch}
          onClick={() => dispatch({ type: 'start-game' })}>Start game</button></div>
      </section> : <div className="pv-play-layout">
        <section className="pv-board-panel pv-card cf-board-panel" aria-label="Connect Four board">
          <PlayAreaHeader action={action!.label as 'Resign' | 'Restart' | 'Rematch'} status={liveStatus!.label} tone={liveStatus!.tone}
            reviewing={reviewing} canGoBack={presentation!.canGoBack} canGoForward={presentation!.canGoForward} canReview
            onAction={() => dispatch(action!.command)} onBack={() => dispatch({ type: 'navigate-history', direction: 'back' })}
            onForward={() => dispatch({ type: 'navigate-history', direction: 'forward' })}
            onReview={() => dispatch({ type: 'toggle-review' })} onReturn={() => dispatch({ type: 'return-to-current' })} />
          {board ?? (presentation && <ConnectFourBoard snapshot={snapshot} position={presentation.position} dispatch={dispatch}
            selectedCell={presentation.selectedCell} latestCell={presentation.latestCell} winningCells={presentation.winningCells} />)}
          {snapshot.request.status === 'failed' && <div className="pv-error" role="alert"><p>{snapshot.request.error}</p></div>}
          {snapshot.request.status !== 'idle' && snapshot.request.retryAvailable && <button className="pv-button pv-button-secondary" type="button"
            onClick={() => dispatch({ type: 'retry-cpu' })}>Retry CPU move</button>}
        </section>
        <aside className="pv-history-panel pv-card" aria-label="Move history and inspection">
          {history ?? <ConnectFourHistory snapshot={snapshot} dispatch={dispatch} />}
        </aside>
      </div>}
    </main>
    <ResignationDialog open={snapshot.view.resignationDialogOpen} onCancel={() => dispatch({ type: 'cancel-resignation' })}
      onConfirm={() => dispatch({ type: 'confirm-resignation' })} />
  </AppShell>
}
