import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { AuthStore } from '../contracts/account'
import type { StatisticsStore } from '../contracts/statistics'

interface AccountServices { readonly auth: AuthStore; readonly statistics: StatisticsStore }
const AccountContext = createContext<AccountServices | null>(null)

export function AccountProvider({ auth, statistics, children }: AccountServices & { readonly children: ReactNode }) {
  return <AccountContext.Provider value={{ auth, statistics }}>{children}</AccountContext.Provider>
}

export function useAccountServices() {
  const services = useContext(AccountContext)
  if (!services) throw new Error('Account services are missing')
  const auth = useSyncExternalStore(services.auth.subscribe, services.auth.getSnapshot, services.auth.getSnapshot)
  const statistics = useSyncExternalStore(services.statistics.subscribe, services.statistics.getSnapshot, services.statistics.getSnapshot)
  return { auth, statistics, services }
}
