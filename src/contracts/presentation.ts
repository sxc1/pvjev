import type { TicTacToeCommand, TicTacToeSnapshot } from './application'

/** T5 builds the shell; T8 supplies derived board and history presentation. */
export interface TicTacToeScreenProps {
  readonly snapshot: TicTacToeSnapshot
  readonly dispatch: (command: TicTacToeCommand) => void
}
