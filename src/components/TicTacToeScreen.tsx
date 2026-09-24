import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Settings } from 'lucide-react'
import type { TicTacToeCommand, TicTacToeScreenProps, TicTacToeSnapshot } from '../contracts'
import { TicTacToeSymbol } from './TicTacToeSymbol'

export interface TicTacToeShellProps extends TicTacToeScreenProps {
  /** T8 supplies game-specific board and history widgets here. */
  readonly board?: ReactNode
  readonly history?: ReactNode
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

function ResignationDialog({ open, dispatch }: { open: boolean; dispatch: TicTacToeScreenProps['dispatch'] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const priorFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      priorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      element.showModal()
    } else if (!open && element.open) {
      element.close()
    }
    if (!open) priorFocus.current?.focus()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="pv-dialog"
      aria-labelledby="resign-title"
      onCancel={(event) => { event.preventDefault(); dispatch({ type: 'cancel-resignation' }) }}
      onClose={() => { if (open) dispatch({ type: 'cancel-resignation' }); priorFocus.current?.focus() }}
    >
      <h2 id="resign-title">Resign this match?</h2>
      <p>The match will end as a CPU win. You can still review its moves.</p>
      <div className="pv-dialog-actions">
        <button className="pv-button pv-button-secondary" type="button" onClick={() => dispatch({ type: 'cancel-resignation' })}>Keep playing</button>
        <button className="pv-button pv-button-danger" type="button" onClick={() => dispatch({ type: 'confirm-resignation' })}>Resign</button>
      </div>
    </dialog>
  )
}

/** Layout and shared controls only; no provider, timer, storage, or local match state. */
export function TicTacToeScreen({ snapshot, dispatch, board, history }: TicTacToeShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => typeof document === 'undefined' || document.documentElement.classList.contains('dark'))
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', darkMode ? 'dark' : 'light')
  }, [darkMode])
  useEffect(() => {
    if (!settingsOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); settingsRef.current?.querySelector('button')?.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [settingsOpen])
  const action = matchAction(snapshot)
  const status = snapshot.match ? matchStatus(snapshot) : null
  const invalidMatch = snapshot.notices.some((notice) => notice.kind === 'invalid-match')

  return (
    <div className="pv-app">
      <header className="pv-header">
        <div className="pv-brand"><img src={`${import.meta.env.BASE_URL}sxc1-logo.png`} alt="" /><span>Play vs Jev</span></div>
        <nav className="pv-game-nav" aria-label="Games">
          <button className="pv-game-tab pv-game-tab-current" type="button" aria-current="page">Tic Tac Toe</button>
          <button className="pv-game-tab" type="button" disabled>Connect Four</button>
          <button className="pv-game-tab" type="button" disabled>Chess</button>
        </nav>
        <div className="pv-settings" ref={settingsRef}>
          <button className="pv-icon-button" type="button" aria-label="Settings" aria-expanded={settingsOpen} aria-controls="pv-settings-menu" onClick={() => setSettingsOpen(!settingsOpen)}>
            <Settings aria-hidden="true" />
          </button>
          {settingsOpen && <div className="pv-settings-menu pv-card" id="pv-settings-menu">
            <h2>Settings</h2>
            <label className="pv-setting"><input type="checkbox" checked={snapshot.settings.confirmMoves} onChange={(event) => dispatch({ type: 'set-confirm-moves', enabled: event.target.checked })} /><span>Confirm moves before playing</span></label>
            <label className="pv-setting"><input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} /><span>Dark mode</span></label>
          </div>}
        </div>
      </header>

      <main className="pv-main">
        {action && <div className="pv-match-actions"><button className="pv-button pv-button-secondary" type="button" onClick={() => dispatch(action.command)}>{action.label}</button></div>}

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
      <ResignationDialog open={snapshot.view.resignationDialogOpen} dispatch={dispatch} />
    </div>
  )
}

export default TicTacToeScreen
