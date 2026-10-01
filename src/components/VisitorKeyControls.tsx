import { useEffect, useState } from 'react'
import type { VisitorKeySnapshot } from '../app/visitor-key-store'

export interface VisitorKeyViewModel {
  readonly snapshot: VisitorKeySnapshot
  readonly onSave: (key: string) => boolean
  readonly onClear: () => void
}

export function VisitorKeyControls({ keyView }: { readonly keyView: VisitorKeyViewModel }) {
  const [draft, setDraft] = useState('')
  useEffect(() => () => setDraft(''), [])
  return <section className="pv-key-controls pv-card" aria-labelledby="pv-key-title">
    <h2 id="pv-key-title">Use your TypeSafe API key</h2>
    <p>Kept only for this page session. Reloading clears it.</p>
    <label htmlFor="pv-visitor-key">TypeSafe API key</label>
    <div className="pv-key-row">
      <input id="pv-visitor-key" type="password" autoComplete="off" spellCheck={false} value={draft}
        onChange={event => setDraft(event.target.value)} placeholder={keyView.snapshot.hasKey ? 'Replace saved key' : 'Enter key'} />
      <button className="pv-button pv-button-primary" type="button" disabled={!draft.trim()}
        onClick={() => { if (keyView.onSave(draft)) setDraft('') }}>{keyView.snapshot.hasKey ? 'Replace' : 'Save'}</button>
      {keyView.snapshot.hasKey && <button className="pv-button pv-button-secondary" type="button"
        onClick={() => { keyView.onClear(); setDraft('') }}>Clear</button>}
    </div>
    <p className="pv-key-status" role="status">{keyView.snapshot.hasKey ? 'Key saved for this page session.' : 'No key saved. New matches use RNG.'}</p>
  </section>
}
