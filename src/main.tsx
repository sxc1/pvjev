import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './app/AppProvider'
import { createTicTacToeController } from './app/controller'
import { createRandomCpuProvider } from './cpu/random'
import { ticTacToeRules } from './games/tic-tac-toe/rules'
import './app.css'

const controller = createTicTacToeController({
  rules: ticTacToeRules,
  cpu: createRandomCpuProvider(),
  storage: () => window.localStorage,
  scheduler: {
    now: () => Date.now(),
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: handle => window.clearTimeout(handle as number),
  },
  random: Math.random,
  newId: () => crypto.randomUUID(),
})
controller.start()

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <AppProvider controller={controller}>
      <App />
    </AppProvider>
  </StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount()
    controller.dispose()
  })
}
