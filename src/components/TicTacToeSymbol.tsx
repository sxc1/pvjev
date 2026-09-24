import type { TicTacToeSymbol as Symbol } from '../contracts'

export function TicTacToeSymbol({ symbol }: { symbol: Symbol }) {
  return <span className={`ttt-symbol ttt-symbol-${symbol.toLowerCase()}`} aria-hidden="true" />
}
