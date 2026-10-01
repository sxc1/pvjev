import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './app/AppProvider'
import { createTicTacToeController } from './app/controller'
import { createConnectFourController } from './app/connect-four-controller'
import { createApplicationHost } from './app/host'
import { createSharedSettingsStore } from './app/settings'
import { createRandomCpuProvider } from './cpu/random'
import { createAuthStore } from './app/auth'
import { createStatisticsStore } from './app/statistics'
import { createAccountRuntime } from './app/account-runtime'
import { AccountProvider } from './app/AccountProvider'
import { readSupabaseConfig } from './supabase/config'
import { createBrowserSupabaseClient } from './supabase/client'
import { createSupabaseAuthAdapter } from './supabase/auth'
import { createStatisticsAdapter } from './supabase/statistics'
import { createVisitorKeyStore } from './app/visitor-key-store'
import { createConnectFourJevProvider, createTicTacToeJevProvider } from './cpu/jev'
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
const visitorKey = createVisitorKeyStore()
const config = readSupabaseConfig()
if (!config.available) console.error(config.reason)
const client = config.available ? createBrowserSupabaseClient(config.config) : null
const auth = createAuthStore({ adapter: client ? createSupabaseAuthAdapter(client) : undefined, unavailableReason: config.available ? undefined : config.reason })
const statistics = createStatisticsStore(client ? createStatisticsAdapter(client) : {
  loadTotals: async () => ({ ok: false, error: { kind: 'cancelled', message: 'Account unavailable', status: null, code: null } }),
  recordCompletion: async () => ({ ok: false, error: { kind: 'cancelled', message: 'Account unavailable', status: null, code: null } }),
  reconcileCompletion: async () => ({ ok: false, error: { kind: 'cancelled', message: 'Account unavailable', status: null, code: null } }),
})
statistics.start()
const accountRuntime = createAccountRuntime(auth, statistics)
auth.start()
const ticTacToe = createTicTacToeController({
  rules: ticTacToeRules,
  cpu: createRandomCpuProvider(),
  jev: config.available ? createTicTacToeJevProvider(config.config.url, config.config.publishableKey) : undefined,
  visitorKey,
  storage,
  scheduler,
  random: Math.random,
  newId: () => crypto.randomUUID(),
  settings,
  onMatchCompleted: accountRuntime.onMatchCompleted,
})
const connectFour = createConnectFourController({
  rules: connectFourRules,
  cpu: createRandomCpuProvider(),
  jev: config.available ? createConnectFourJevProvider(config.config.url, config.config.publishableKey,
    () => {
      const match = connectFour.getSnapshot().match
      if (!match) return 'red'
      return match.setup.humanOrder === 'first' ? match.setup.humanColor
        : match.setup.humanColor === 'red' ? 'yellow' : 'red'
    }) : undefined,
  visitorKey,
  storage,
  scheduler,
  random: Math.random,
  newId: () => crypto.randomUUID(),
  settings,
  onMatchCompleted: accountRuntime.onMatchCompleted,
})
const host = createApplicationHost(settings, ticTacToe, connectFour, undefined, storage)
host.start()

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <AccountProvider auth={auth} statistics={statistics} visitorKey={visitorKey}>
      <AppProvider host={host}>
        <App />
      </AppProvider>
    </AccountProvider>
  </StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount()
    host.dispose()
    visitorKey.dispose()
    accountRuntime.dispose()
    statistics.dispose()
    auth.dispose()
  })
}
