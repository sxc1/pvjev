import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './app/AppProvider'
import { createTicTacToeController } from './app/controller'
import { createConnectFourController } from './app/connect-four-controller'
import { createApplicationHost } from './app/host'
import { createSharedSettingsStore } from './app/settings'
import { createRandomCpuProvider } from './cpu/random'
import { connectFourRules } from './games/connect-four/rules'
import { ticTacToeRules } from './games/tic-tac-toe/rules'
import './app.css'

const storage = () => window.localStorage
const scheduler = {
  now: () => Date.now(),
  setTimeout: (callback: () => void, delayMs: number) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle: unknown) => window.clearTimeout(handle as number),
}
const settings = createSharedSettingsStore(storage)
const ticTacToe = createTicTacToeController({
  rules: ticTacToeRules,
  cpu: createRandomCpuProvider(),
  storage,
  scheduler,
  random: Math.random,
  newId: () => crypto.randomUUID(),
  settings,
})
const connectFour = createConnectFourController({
  rules: connectFourRules,
  cpu: createRandomCpuProvider(),
  storage,
  scheduler,
  random: Math.random,
  newId: () => crypto.randomUUID(),
  settings,
})
const host = createApplicationHost(settings, ticTacToe, connectFour, undefined, storage)
host.start()

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <AppProvider host={host}>
      <App />
    </AppProvider>
  </StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount()
    host.dispose()
  })
}
