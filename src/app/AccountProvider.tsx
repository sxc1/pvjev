import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { AuthStore } from '../contracts/account'
import type { StatisticsStore } from '../contracts/statistics'
import type { VisitorKeyStore } from './visitor-key-store'

interface AccountServices { readonly auth: AuthStore; readonly statistics: StatisticsStore; readonly visitorKey?: VisitorKeyStore }
const AccountContext = createContext<AccountServices | null>(null)

export function AccountProvider({ auth, statistics, visitorKey, children }: AccountServices & { readonly children: ReactNode }) {
  return <AccountContext.Provider value={{ auth, statistics, visitorKey }}>{children}</AccountContext.Provider>
}

export function useAccountServices() {
  const services = useContext(AccountContext)
  if (!services) throw new Error('Account services are missing')
  const auth = useSyncExternalStore(services.auth.subscribe, services.auth.getSnapshot, services.auth.getSnapshot)
  const statistics = useSyncExternalStore(services.statistics.subscribe, services.statistics.getSnapshot, services.statistics.getSnapshot)
  const visitorKey = useSyncExternalStore(services.visitorKey?.subscribe ?? (() => () => {}), services.visitorKey?.getSnapshot ?? (() => null), services.visitorKey?.getSnapshot ?? (() => null))
  return { auth, statistics, visitorKey, services }
}
