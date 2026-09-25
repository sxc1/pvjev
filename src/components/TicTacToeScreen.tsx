import type { ReactNode } from 'react'
import type { GameId, TicTacToeCommand, TicTacToeScreenProps, TicTacToeSnapshot } from '../contracts'
import { TicTacToeSymbol } from './TicTacToeSymbol'
import { AppShell, MatchAction, ResignationDialog } from './AppShell'

export interface TicTacToeShellProps extends TicTacToeScreenProps {
  /** T8 supplies game-specific board and history widgets here. */
  readonly board?: ReactNode
  readonly history?: ReactNode
  readonly onSelectGame?: (gameId: GameId) => void
}

function matchAction(snapshot: TicTacToeSnapshot): { label: string; command: TicTacToeCommand } | null {
  const { match } = snapshot
  if (!match) return null
  if (match.outcome.kind !== 'ongoing') return { label: 'Rematch', command: { type: 'rematch' } }
  if (match.moves.length === 0) return { label: 'Restart', command: { type: 'restart' } }
  return { label: 'Resign', command: { type: 'open-resignation' } }
}

function matchStatus(snapshot: TicTacToeSnapshot): { label: string; tone: string } {
  const match = snapshot.match!
  if (match.outcome.kind === 'resignation') return { label: 'Defeat', tone: 'defeat' }
  if (match.outcome.kind === 'draw') return { label: 'Draw', tone: 'draw' }
  if (match.outcome.kind === 'win') return match.outcome.winner === match.humanSymbol
    ? { label: 'Victory', tone: 'victory' }
    : { label: 'Defeat', tone: 'defeat' }
  if (snapshot.request.status === 'failed') return { label: 'CPU move failed', tone: 'waiting' }
  if (snapshot.request.status === 'pending') return { label: 'CPU is thinking…', tone: 'waiting' }
  return match.position.nextSymbol === match.humanSymbol
    ? { label: 'Your turn', tone: 'turn' }
    : { label: 'CPU’s turn', tone: 'waiting' }
}

/** Layout and shared controls only; no provider, timer, storage, or local match state. */
export function TicTacToeScreen({ snapshot, dispatch, board, history, onSelectGame }: TicTacToeShellProps) {
  const action = matchAction(snapshot)
  const status = snapshot.match ? matchStatus(snapshot) : null
  const invalidMatch = snapshot.notices.some((notice) => notice.kind === 'invalid-match')

  return (
    <AppShell selectedGame="tic-tac-toe" onSelectGame={onSelectGame} settings={snapshot.settings} onConfirmMoves={enabled => dispatch({ type: 'set-confirm-moves', enabled })}>
      <main className="pv-main">
        {action && <MatchAction label={action.label} onClick={() => dispatch(action.command)} />}

        {snapshot.notices.map((notice, index) => (
          <div className="pv-notice" role="status" key={`${notice.kind}-${index}`}>
            <span>{notice.message}</span>
            {notice.kind === 'invalid-match' && <button className="pv-button pv-button-secondary" type="button" onClick={() => dispatch({ type: 'start-fresh' })}>Start fresh</button>}
          </div>
        ))}

        {!snapshot.match ? (
          <section className="pv-setup pv-card" aria-labelledby="setup-title">
            <p className="pv-eyebrow">New match</p>
            <h2 id="setup-title">Choose your side</h2>
            <p>X makes the first move. The CPU chooses random legal moves.</p>
            <div className="pv-side-options" role="group" aria-label="Your side">
              {(['X', 'O'] as const).map((symbol) => (
                <button className={`pv-side-option${snapshot.setupSymbol === symbol ? ' pv-side-option-selected' : ''}`} type="button" aria-label={`Play as ${symbol}`} aria-pressed={snapshot.setupSymbol === symbol} onClick={() => dispatch({ type: 'select-side', symbol })} key={symbol}>
                  <TicTacToeSymbol symbol={symbol} />
                </button>
              ))}
            </div>
            <div className="pv-setup-actions">
              <button className="pv-button pv-button-primary" type="button" disabled={invalidMatch} onClick={() => dispatch({ type: 'start-game' })}>Start game</button>
            </div>
          </section>
        ) : (
          <div className="pv-play-layout">
            <section className="pv-board-panel pv-card" aria-label="Tic Tac Toe board">
              <p className={`pv-board-status pv-board-status-${status!.tone}`} role="status" aria-live="polite">{status!.label}</p>
              {board ?? <div className="pv-widget-placeholder">Board</div>}
              {snapshot.request.status === 'failed' && <div className="pv-error" role="alert"><p>{snapshot.request.error}</p></div>}
              {snapshot.request.status !== 'idle' && snapshot.request.retryAvailable && (
                <button className="pv-button pv-button-secondary" type="button" onClick={() => dispatch({ type: 'retry-cpu' })}>Retry CPU move</button>
              )}
            </section>
            <aside className="pv-history-panel pv-card" aria-label="Move history and inspection">
              {history ?? <div className="pv-widget-placeholder">Move history and inspection</div>}
            </aside>
          </div>
        )}

      </main>
      <ResignationDialog open={snapshot.view.resignationDialogOpen} onCancel={() => dispatch({ type: 'cancel-resignation' })} onConfirm={() => dispatch({ type: 'confirm-resignation' })} />
    </AppShell>
  )
}

export default TicTacToeScreen
