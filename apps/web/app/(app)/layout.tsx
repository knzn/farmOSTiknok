'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

const NAV = [
  { href: '/dashboard',     label: 'Home',          icon: '⌂' },
  { href: '/breeder',       label: 'Farm OS',        icon: '🐓' },
  { href: '/notifications', label: 'Notifications',  icon: '🔔' },
  { href: '/profile',       label: 'Profile',        icon: '◎' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore(s => s.accessToken)
  const clearTokens = useAuthStore(s => s.clearTokens)
  const router      = useRouter()
  const pathname    = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Wait for Zustand persist to finish rehydrating from cookie before auth check
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [])

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login')
  }, [hydrated, accessToken, router])

  if (!hydrated) return null
  if (!accessToken) return null

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-rim shrink-0 fixed h-full">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-rim">
          <span className="text-2xl font-black text-accent tracking-tight">TIKNOK</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-semibold transition-colors
                  ${active
                    ? 'bg-accent/15 text-accent'
                    : 'text-ink-2 hover:bg-card hover:text-ink'
                  }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-rim">
          <button
            onClick={() => { clearTokens(); router.replace('/login') }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm text-danger hover:bg-danger/10 transition-colors"
          >
            <span>↩</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-4 bg-canvas border-b border-rim">
        <span className="text-xl font-black text-accent">TIKNOK</span>
        <button onClick={() => setMenuOpen(v => !v)} className="text-ink text-2xl">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ── Mobile menu overlay ── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-canvas/95 flex flex-col pt-20 px-6 gap-2">
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-4 px-4 py-4 rounded-md text-base font-semibold
                  ${active ? 'bg-accent/15 text-accent' : 'text-ink-2'}`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
          <button
            onClick={() => { clearTokens(); router.replace('/login') }}
            className="flex items-center gap-4 px-4 py-4 text-danger text-base font-semibold mt-4"
          >
            <span>↩</span> Sign Out
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
