import type { StatisticsGameId, StatisticsSnapshot } from '../contracts/statistics'

export function PersonalStats({ stats, gameId, onRetry }: {
  readonly stats: StatisticsSnapshot
  readonly gameId: StatisticsGameId
  readonly onRetry: () => void
}) {
  if (!stats.accountId) return null
  const row = stats.rows[gameId]
  return <section className="pv-personal-stats pv-card" aria-labelledby="pv-personal-stats-title">
    <h2 id="pv-personal-stats-title">Your stats</h2>
    {stats.status === 'loading' && !row ? <p role="status">Loading stats…</p> : null}
    {stats.status === 'error' && <div className="pv-stats-error" role="status"><span>Stats unavailable. {row ? 'Showing your last loaded totals.' : ''}</span><button className="pv-button pv-button-secondary" type="button" onClick={onRetry}>Retry</button></div>}
    {row && <table>
      <caption className="pv-sr-only">Personal game results</caption>
      <thead><tr><th scope="col">Opponent</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Draws</th></tr></thead>
      <tbody>
        <tr><th scope="row">RNG</th><td>{row.winRng}</td><td>{row.lossRng}</td><td>{row.drawRng}</td></tr>
        <tr><th scope="row">Jev <span className="pv-stats-note">(unavailable)</span></th><td>{row.winJev}</td><td>{row.lossJev}</td><td>{row.drawJev}</td></tr>
      </tbody>
    </table>}
  </section>
}
