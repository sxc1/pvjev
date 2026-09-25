import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChessRook, Columns4, Settings, TicTacToe } from 'lucide-react'
import type { GameId, Settings as AppSettings } from '../contracts'
import { gameRegistry } from '../app/registry'

const gameIcons = { 'tic-tac-toe': TicTacToe, 'connect-four': Columns4, chess: ChessRook }

export function AppShell({ children, selectedGame = 'tic-tac-toe', onSelectGame, settings, onConfirmMoves }: {
  readonly children: ReactNode
  readonly selectedGame?: GameId
  readonly onSelectGame?: (gameId: GameId) => void
  readonly settings: AppSettings
  readonly onConfirmMoves: (enabled: boolean) => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => typeof document === 'undefined' || document.documentElement.classList.contains('dark'))
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', darkMode ? 'dark' : 'light')
  }, [darkMode])
  useEffect(() => {
    if (!settingsOpen) return
    const closeOutside = (event: PointerEvent) => { if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false) }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); settingsRef.current?.querySelector('button')?.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [settingsOpen])
  return <div className="pv-app">
    <header className="pv-header">
      <div className="pv-brand"><img src={`${import.meta.env.BASE_URL}sxc1-logo.png`} alt="" /><span>Play vs Jev</span></div>
      <nav className="pv-game-nav" aria-label="Games">
        {(Object.keys(gameRegistry) as GameId[]).map(id => {
          const Icon = gameIcons[id]
          return <button key={id} className={`pv-game-tab${selectedGame === id ? ' pv-game-tab-current' : ''}`} type="button" aria-label={gameRegistry[id].label} title={gameRegistry[id].label} aria-current={selectedGame === id ? 'page' : undefined} disabled={!gameRegistry[id].enabled} onClick={() => onSelectGame?.(id)}><Icon aria-hidden="true" /></button>
        })}
      </nav>
      <div className="pv-settings" ref={settingsRef}>
        <button className="pv-icon-button" type="button" aria-label="Settings" aria-expanded={settingsOpen} aria-controls="pv-settings-menu" onClick={() => setSettingsOpen(!settingsOpen)}><Settings aria-hidden="true" /></button>
        {settingsOpen && <div className="pv-settings-menu pv-card" id="pv-settings-menu">
          <h2>Settings</h2>
          <label className="pv-setting"><input type="checkbox" checked={settings.confirmMoves} onChange={event => onConfirmMoves(event.target.checked)} /><span>Confirm moves before playing</span></label>
          <label className="pv-setting"><input type="checkbox" checked={darkMode} onChange={event => setDarkMode(event.target.checked)} /><span>Dark mode</span></label>
        </div>}
      </div>
    </header>
    {children}
  </div>
}

export function MatchAction({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return <div className="pv-match-actions"><button className="pv-button pv-button-secondary" type="button" onClick={onClick}>{label}</button></div>
}

export function ResignationDialog({ open, onCancel, onConfirm }: { readonly open: boolean; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const priorFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) { priorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; element.showModal() }
    else if (!open && element.open) element.close()
    if (!open) priorFocus.current?.focus()
  }, [open])
  return <dialog ref={dialog} className="pv-dialog" aria-labelledby="resign-title" onCancel={event => { event.preventDefault(); onCancel() }} onClose={() => { if (open) onCancel(); priorFocus.current?.focus() }}>
    <h2 id="resign-title">Resign this match?</h2>
    <p>The match will end as a CPU win. You can still review its moves.</p>
    <div className="pv-dialog-actions">
      <button className="pv-button pv-button-secondary" type="button" onClick={onCancel}>Keep playing</button>
      <button className="pv-button pv-button-danger" type="button" onClick={onConfirm}>Resign</button>
    </div>
  </dialog>
}
