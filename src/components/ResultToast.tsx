import type { ResultFailureNotice } from '../contracts/statistics'

export function ResultToast({ notices, onDismiss }: { readonly notices: readonly ResultFailureNotice[]; readonly onDismiss: (id: string) => void }) {
  return <div className="pv-result-notices" aria-live="polite" aria-atomic="false">
    {notices.map(notice => <div className="pv-result-toast" key={notice.id}><span>{notice.message}</span><button className="pv-button pv-button-secondary" type="button" aria-label="Dismiss result notice" onClick={() => onDismiss(notice.id)}>Dismiss</button></div>)}
  </div>
}
