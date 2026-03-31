'use client'
import Link from 'next/link'

const MODULES = [
  {
    href: '/breeder/marking-generator',
    icon: '🏷️',
    title: 'Breeding Records',
    desc: 'Manage seasons, matings, generate markings, and track egg and chick counts.',
  },
  {
    href: '/breeder/finance',
    icon: '💰',
    title: 'Farm Finance',
    desc: 'Track worker salaries, advance requests, expenses, and payslip generation.',
  },
]

export default function BreederPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-ink text-2xl font-bold">Farm OS</h1>
        <p className="text-ink-2 text-sm mt-1">Your private farm management tools</p>
      </div>

      <div className="flex flex-col gap-3">
        {MODULES.map(m => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center bg-card border border-rim rounded-xl p-4 hover:border-accent/40 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-card-2 flex items-center justify-center text-2xl shrink-0 mr-4">
              {m.icon}
            </div>
            <div className="flex-1">
              <p className="text-ink font-bold text-base mb-0.5">{m.title}</p>
              <p className="text-ink-2 text-sm leading-snug">{m.desc}</p>
            </div>
            <span className="text-accent text-xl ml-3 group-hover:translate-x-0.5 transition-transform">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
