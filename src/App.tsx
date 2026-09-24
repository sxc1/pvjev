import { useTicTacToeController } from './app/AppProvider'
import { TicTacToeBoard } from './components/TicTacToeBoard'
import { TicTacToeHistory } from './components/TicTacToeHistory'
import { TicTacToeScreen } from './components/TicTacToeScreen'

export default function App() {
  const { snapshot, dispatch } = useTicTacToeController()
  return (
    <TicTacToeScreen
      snapshot={snapshot}
      dispatch={dispatch}
      board={<TicTacToeBoard snapshot={snapshot} dispatch={dispatch} />}
      history={<TicTacToeHistory snapshot={snapshot} dispatch={dispatch} />}
    />
  )
}
