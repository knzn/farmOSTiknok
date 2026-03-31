import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-canvas flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-rim">
        <span className="text-2xl font-black text-accent tracking-tight">TIKNOK</span>
        <Link
          href="/login"
          className="bg-accent text-canvas text-sm font-bold px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center max-w-2xl mx-auto">
        <div className="bg-accent/10 border border-accent/30 rounded-full px-4 py-1.5 mb-6">
          <span className="text-accent text-sm font-semibold">For Filipino Gamefowl Breeders</span>
        </div>

        <h1 className="text-ink text-4xl md:text-5xl font-black leading-tight mb-4">
          The Breeding OS<br />every breeder needs
        </h1>
        <p className="text-ink-2 text-base md:text-lg leading-relaxed mb-10 max-w-md">
          Manage seasons, matings, markings, workers, and farm expenses — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/register"
            className="w-full sm:w-auto bg-accent hover:opacity-90 text-canvas font-bold text-base px-8 py-4 rounded-full transition-opacity text-center"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto bg-card border border-rim hover:border-accent/40 text-ink font-semibold text-base px-8 py-4 rounded-full transition-colors text-center"
          >
            Sign In
          </Link>
        </div>

        <p className="text-ink-3 text-sm mt-6">60-day free trial · No credit card required</p>
      </section>

      {/* Features */}
      <section className="px-6 py-16 border-t border-rim">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: '🎯', title: 'Marking Generator', body: 'Auto-assign nose groups and combos across all your matings. Export as PNG.' },
            { icon: '🥚', title: 'Lifecycle Tracking', body: 'Track eggs laid, chicks hatched, hatch rate, and sex count per mating.' },
            { icon: '💼', title: 'Worker Payroll', body: 'Manage salaries, advances, and generate payslips for your farm workers.' },
            { icon: '💸', title: 'Farm Expenses', body: 'Log feeds, vitamins, medicines, and miscellaneous costs by category.' },
            { icon: '📅', title: 'Derby Schedule', body: 'Event calendar, bird entries, and results tracking. Coming soon.' },
            { icon: '📱', title: 'Works on iPhone', body: 'Install as a web app on your iPhone home screen — no App Store needed.' },
          ].map(f => (
            <div key={f.title} className="bg-card border border-rim rounded-xl p-5">
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h3 className="text-ink font-bold text-base mb-2">{f.title}</h3>
              <p className="text-ink-2 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* iPhone install instructions */}
      <section className="px-6 py-12 border-t border-rim bg-card">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-ink text-xl font-bold mb-2">Using an iPhone?</h2>
          <p className="text-ink-2 text-sm mb-6">Install TIKNOK to your home screen in 3 steps — works like a native app.</p>
          <div className="flex flex-col sm:flex-row gap-4 text-left">
            {[
              { step: '1', text: 'Open this page in Safari' },
              { step: '2', text: 'Tap the Share button at the bottom' },
              { step: '3', text: 'Tap "Add to Home Screen"' },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-3 flex-1 bg-card-2 rounded-lg px-4 py-3">
                <span className="bg-accent text-canvas w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0">
                  {s.step}
                </span>
                <p className="text-ink text-sm font-medium">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-rim flex items-center justify-between">
        <span className="text-ink-3 text-sm">© 2026 TIKNOK</span>
        <Link href="/login" className="text-accent text-sm font-semibold hover:opacity-80">
          Sign In →
        </Link>
      </footer>
    </main>
  )
}
