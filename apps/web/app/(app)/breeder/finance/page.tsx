'use client'
import Link from 'next/link'

const MODULES = [
  {
    href: '/breeder/finance/workers',
    icon: '👷',
    title: 'Workers',
    desc: 'Manage salaries, advance requests, and generate payslips for your farm workers.',
  },
  {
    href: '/breeder/finance/expenses',
    icon: '💸',
    title: 'Farm Expenses',
    desc: 'Log feeds, vitamins, medicines, deworming, and miscellaneous farm costs.',
  },
]

export default function FinancePage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/breeder" className="text-accent text-sm hover:opacity-80">‹ Farm OS</Link>
        <h1 className="text-ink text-2xl font-bold mt-1">Farm Finance</h1>
        <p className="text-ink-2 text-sm mt-1">Payroll and expense tracking</p>
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
