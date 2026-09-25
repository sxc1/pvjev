import { useApplicationHost, useConnectFourController, useTicTacToeController } from './app/AppProvider'
import { ConnectFourScreen } from './components/ConnectFourScreen'
import { TicTacToeBoard } from './components/TicTacToeBoard'
import { TicTacToeHistory } from './components/TicTacToeHistory'
import { TicTacToeScreen } from './components/TicTacToeScreen'

export default function App() {
  const { host, selectedGame } = useApplicationHost()
  const { snapshot, dispatch } = useTicTacToeController()
  const connectFour = useConnectFourController()
  return selectedGame === 'connect-four' ? <ConnectFourScreen
    snapshot={connectFour.snapshot}
    dispatch={connectFour.dispatch}
    onConfirmMoves={host.settings.setConfirmMoves}
    onSelectGame={host.selectGame}
  /> : (
    <TicTacToeScreen
      snapshot={snapshot}
      dispatch={dispatch}
      onSelectGame={host.selectGame}
      board={<TicTacToeBoard snapshot={snapshot} dispatch={dispatch} />}
      history={<TicTacToeHistory snapshot={snapshot} dispatch={dispatch} />}
    />
  )
}
