const focusStyles = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
const navigationStyles = `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground ${focusStyles}`

export default function App() {
  return (
    <div className="flex min-h-svh flex-col bg-[radial-gradient(ellipse_at_50%_48%,color-mix(in_srgb,var(--primary)_8%,transparent),transparent_65%)]">
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-[clamp(var(--spacing-4),5vw,var(--spacing-20))] py-6 max-[480px]:grid-cols-[1fr_auto] max-[480px]:gap-2 max-[480px]:py-4">
        <span className="text-2xl font-bold">sxc1</span>
        <nav className="flex items-center gap-6 max-[480px]:col-span-full max-[480px]:row-start-2 max-[480px]:justify-center" aria-label="Main navigation">
          <button className={navigationStyles} type="button">About</button>
          <a className={navigationStyles} href="https://github.com/sxc1">GitHub</a>
          <button className={navigationStyles} type="button">FAQ</button>
        </nav>
        <button className={`${navigationStyles} justify-self-end max-[480px]:col-start-2 max-[480px]:row-start-1`} type="button" aria-label="Information">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6" />
            <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </header>
      <main className="grid flex-1 place-items-center px-6 py-16">
        <div className="w-full max-w-5xl text-center">
          <h1 className="text-[clamp(var(--text-4xl),6vw,4.5rem)] leading-tight font-bold tracking-[-0.045em] text-balance">This is where it all begins.</h1>
          <p className="mt-6 mb-10 text-lg leading-relaxed wrap-anywhere text-muted-foreground">
            Theme derived from <a className={`text-primary underline-offset-4 hover:text-foreground ${focusStyles}`} href="https://github.com/sxc1/design">https://github.com/sxc1/design</a>
          </p>
          <a className={`inline-flex min-h-12 items-center justify-center rounded-full bg-primary-alt px-10 py-3 font-semibold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary-alt),black_10%)] ${focusStyles}`} href="https://sxc1.github.io/design/">Explore</a>
        </div>
      </main>
    </div>
  )
}
