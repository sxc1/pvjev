import { useApplicationHost, useConnectFourController, useTicTacToeController } from './app/AppProvider'
import { ConnectFourScreen } from './components/ConnectFourScreen'
import { TicTacToeBoard } from './components/TicTacToeBoard'
import { TicTacToeHistory } from './components/TicTacToeHistory'
import { TicTacToeScreen } from './components/TicTacToeScreen'
import { useAccountServices } from './app/AccountProvider'
import type { AccountViewModel } from './components/AppShell'

export default function App() {
  const { host, selectedGame } = useApplicationHost()
  const { snapshot, dispatch } = useTicTacToeController()
  const connectFour = useConnectFourController()
  const { auth, statistics, visitorKey, services } = useAccountServices()
  const account: AccountViewModel = {
    auth, statistics,
    onSignIn: () => { void services.auth.signIn() },
    onSignOut: () => { void services.auth.signOut() },
    onRetryStats: () => services.statistics.retryLoad(),
    onDismissResultNotice: id => services.statistics.dismissNotice(id),
    visitorKey: visitorKey && services.visitorKey ? {
      snapshot: visitorKey,
      onSave: value => services.visitorKey!.saveKey(value),
      onClear: () => services.visitorKey!.clear(),
    } : undefined,
  }
  return selectedGame === 'connect-four' ? <ConnectFourScreen
    snapshot={connectFour.snapshot}
    dispatch={connectFour.dispatch}
    onConfirmMoves={host.settings.setConfirmMoves}
    onSelectGame={host.selectGame}
    account={account}
  /> : (
    <TicTacToeScreen
      snapshot={snapshot}
      dispatch={dispatch}
      onSelectGame={host.selectGame}
      account={account}
      board={<TicTacToeBoard snapshot={snapshot} dispatch={dispatch} />}
      history={<TicTacToeHistory snapshot={snapshot} dispatch={dispatch} />}
    />
  )
}
