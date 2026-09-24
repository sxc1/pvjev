/** Contracts shared by game adapters and the application controller. */
export type GameId = 'tic-tac-toe' | 'connect-four' | 'chess'

export interface RulesAdapter<Position, Move, Side> {
  initialPosition(): Position
  legalMoves(position: Position): readonly Move[]
  applyMove(position: Position, move: Move): Position
  reconstructPosition(moves: readonly Move[]): Position
  sideToMove(position: Position): Side | null
}

export interface CpuChoice<Move, Analysis = never> {
  move: Move
  analysis?: Analysis
}

export interface CpuProvider<Position, Move, Analysis = never> {
  chooseMove(input: {
    readonly position: Readonly<Position>
    readonly legalMoves: readonly Move[]
    readonly signal: AbortSignal
  }): Promise<CpuChoice<Move, Analysis>>
}
