import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { ConnectFourCommand, ConnectFourPosition, ConnectFourSnapshot } from '../contracts'
import { columnAtPoint, landingCell, legalColumn } from '../games/connect-four/input'
import './connect-four-board.css'

interface Gesture { pointerId: number; matchId: string; ply: number; width: number; height: number }

export interface ConnectFourBoardProps {
  snapshot: ConnectFourSnapshot
  /** The displayed prefix in review, or the current position in live mode. */
  position: ConnectFourPosition
  dispatch: (command: ConnectFourCommand) => unknown
  selectedCell?: number | null
  latestCell?: number | null
  winningCells?: readonly number[]
}

export function ConnectFourBoard({ snapshot, position, dispatch, selectedCell, latestCell, winningCells }: ConnectFourBoardProps) {
  const surface = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const pointerUpAt = useRef(0)
  const confirmationSetting = useRef(snapshot.settings.confirmMoves)
  const [previewColumn, setPreviewColumn] = useState<number | null>(null)
  const match = snapshot.match
  const reviewing = snapshot.view.location.mode === 'review'
  const humanPlayer = match?.setup.humanOrder === 'first' ? 1 : 2
  const humanColor = match?.setup.humanColor ?? snapshot.setup.humanColor
  const canPlay = Boolean(match && !reviewing && match.outcome.kind === 'ongoing' &&
    match.position.nextPlayer === (humanPlayer === 1 ? 'one' : 'two') && snapshot.request.status === 'idle')
  const livePly = match?.moves.length ?? 0
  const cancel = () => { gesture.current = null; setPreviewColumn(null) }

  useEffect(() => {
    if (confirmationSetting.current !== snapshot.settings.confirmMoves) {
      confirmationSetting.current = snapshot.settings.confirmMoves
      cancel()
    }
    if (!gesture.current) return
    if (!canPlay || gesture.current.matchId !== match?.id || gesture.current.ply !== livePly) cancel()
  }, [canPlay, match?.id, livePly, snapshot.settings.confirmMoves, reviewing])
  useEffect(() => {
    const clear = () => cancel()
    window.addEventListener('blur', clear)
    window.addEventListener('resize', clear)
    window.addEventListener('orientationchange', clear)
    return () => {
      window.removeEventListener('blur', clear)
      window.removeEventListener('resize', clear)
      window.removeEventListener('orientationchange', clear)
      gesture.current = null
    }
  }, [])

  const hit = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = surface.current?.getBoundingClientRect()
    if (!bounds) return null
    const column = columnAtPoint(bounds, event.clientX, event.clientY)
    return legalColumn(position.board, column) ? column : null
  }
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPlay || gesture.current || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || !match) return
    const bounds = surface.current?.getBoundingClientRect()
    if (!bounds) return
    gesture.current = { pointerId: event.pointerId, matchId: match.id, ply: livePly, width: bounds.width, height: bounds.height }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreviewColumn(hit(event))
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return
    const bounds = surface.current?.getBoundingClientRect()
    if (!bounds || bounds.width !== gesture.current.width || bounds.height !== gesture.current.height) { cancel(); return }
    setPreviewColumn(hit(event))
  }
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    const bounds = surface.current?.getBoundingClientRect()
    const column = bounds && bounds.width === active.width && bounds.height === active.height ? hit(event) : null
    pointerUpAt.current = Date.now()
    cancel()
    if (column !== null && canPlay && match?.id === active.matchId && livePly === active.ply) dispatch({ type: 'select-column', column })
  }
  const pending = canPlay && snapshot.settings.confirmMoves ? snapshot.view.pendingColumn : null
  const previewCell = canPlay ? landingCell(position.board, previewColumn) : null
  const pendingCell = canPlay ? landingCell(position.board, pending) : null
  const wins = new Set(winningCells ?? position.winningLines.flat())
  const activateCell = (cell: number, detail: number) => {
    if (detail > 0 && Date.now() - pointerUpAt.current < 500) return
    if (reviewing) {
      if (position.board[cell] !== 0) dispatch({ type: 'select-piece', cell })
    } else if (canPlay && !gesture.current) {
      const column = cell % 7
      if (legalColumn(position.board, column)) dispatch({ type: 'select-column', column })
    }
  }

  return <div className="cf-board-widget">
    <div className="cf-column-labels" aria-hidden="true">{'ABCDEFG'.split('').map(letter => <span key={letter}>{letter}</span>)}</div>
    <div className="cf-board-row">
      <div className="cf-row-labels" aria-hidden="true">{[6, 5, 4, 3, 2, 1].map(row => <span key={row}>{row}</span>)}</div>
      <div ref={surface} className="cf-board" role="group" aria-label={reviewing ? 'Historical Connect Four board' : 'Current Connect Four board'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}>
        {position.board.map((piece, cell) => {
          const color = piece === 0 ? null : piece === 1
            ? (match?.setup.humanOrder === 'first' ? humanColor : humanColor === 'red' ? 'yellow' : 'red')
            : (match?.setup.humanOrder === 'first' ? (humanColor === 'red' ? 'yellow' : 'red') : humanColor)
          const coord = `${'ABCDEFG'[cell % 7]}${6 - Math.floor(cell / 7)}`
          const preview = piece === 0 && (cell === previewCell || cell === pendingCell)
          const label = `${coord}, ${color ?? (preview ? `pending ${humanColor}` : 'empty')}${cell === selectedCell ? ', selected' : ''}${wins.has(cell) ? ', winning' : ''}`
          return <button key={cell} type="button" className={`cf-cell${color ? ` cf-cell-${color}` : ''}${cell === latestCell ? ' cf-cell-latest' : ''}${cell === selectedCell ? ' cf-cell-selected' : ''}${wins.has(cell) ? ' cf-cell-win' : ''}`}
            aria-label={label} aria-disabled={reviewing ? !piece : !canPlay || !legalColumn(position.board, cell % 7)} onClick={event => activateCell(cell, event.detail)}>
            {color && <span className="cf-piece" />}
            {preview && <span className={`cf-piece cf-piece-${humanColor}${cell === pendingCell ? ' cf-piece-pending' : ' cf-piece-held'}`} />}
          </button>
        })}
      </div>
    </div>
    {pendingCell !== null && <button type="button" className="pv-button pv-button-primary" onClick={() => dispatch({ type: 'confirm-move' })}>Confirm move</button>}
  </div>
}
