import type { TicTacToeScreenProps } from '../contracts'
import { selectTicTacToePresentation } from '../games/tic-tac-toe/selectors'
import { TicTacToeSymbol } from './TicTacToeSymbol'
import './tic-tac-toe-widgets.css'

export function TicTacToeBoard({ snapshot, dispatch }: TicTacToeScreenProps) {
  const presentation = selectTicTacToePresentation(snapshot)
  if (!presentation) return null
  return (
    <div className="ttt-board-widget">
      <div className="ttt-board" role="group" aria-label={presentation.reviewing ? 'Historical Tic Tac Toe board' : 'Current Tic Tac Toe board'}>
        {presentation.cells.map(cell => (
          <button
            key={cell.index}
            type="button"
            className={`ttt-cell ttt-cell-${cell.highlight} ttt-cell-win-${cell.winning}`}
            aria-label={cell.label}
            disabled={!cell.canActivate}
            onClick={() => dispatch({ type: 'activate-cell', cell: cell.index })}
          >
            {cell.symbol ? <TicTacToeSymbol symbol={cell.symbol} /> : (cell.preview ? <span className="ttt-preview"><TicTacToeSymbol symbol={snapshot.match!.humanSymbol} /><span className="ttt-preview-label">Pending</span></span> : null)}
          </button>
        ))}
      </div>
      {presentation.canConfirm && (
        <button className="pv-button pv-button-primary" type="button" onClick={() => dispatch({ type: 'confirm-move' })}>Confirm move</button>
      )}
    </div>
  )
}
