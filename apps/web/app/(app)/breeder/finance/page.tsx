'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { apiRequest } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardFinance {
  totalWorkers: number
  totalSalaryDue: number
  totalAdvancesThisMonth: number
  unpaidWorkers: number
  totalExpensesThisMonth: number
  expensesByCategory: Record<string, number>
  totalSalesThisMonth: number
  totalOutflowThisMonth: number
  netIncomeThisMonth: number
}

interface MonthlySummary {
  month: number
  year: number
  total: number
}

interface ChartEntry {
  label: string
  Income: number
  Outflow: number
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function peso(n: number) {
  return '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const income  = payload.find(p => p.name === 'Income')?.value ?? 0
  const outflow = payload.find(p => p.name === 'Outflow')?.value ?? 0
  const net = income - outflow
  return (
    <div className="bg-card border border-rim rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-ink font-bold mb-2">{label}</p>
      <p className="text-success">Income: {peso(income)}</p>
      <p className="text-warning">Outflow: {peso(outflow)}</p>
      <p className={`font-bold mt-1 ${net >= 0 ? 'text-success' : 'text-danger'}`}>
        Net: {net >= 0 ? '+' : '-'}{peso(net)}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear  = now.getFullYear()

  const [finance, setFinance]   = useState<DashboardFinance | null>(null)
  const [chartData, setChartData] = useState<ChartEntry[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Load dashboard data + last 6 months of expense + sales summaries in parallel
        const [dash, expSummary, saleSummary] = await Promise.all([
          apiRequest('/dashboard') as Promise<{ finance: DashboardFinance }>,
          apiRequest('/expenses/summary') as Promise<{ byMonth: MonthlySummary[] }>,
          apiRequest('/sales/summary') as Promise<{ byMonth: Array<MonthlySummary & { paid: number; partial: number; unpaid: number }> }>,
        ])

        setFinance(dash.finance)

        // Build last 6 months chart data (oldest → newest)
        const months: ChartEntry[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(curYear, curMonth - 1 - i, 1)
          const m = d.getMonth() + 1
          const y = d.getFullYear()
          const label = `${MONTH_SHORT[m - 1]} ${y !== curYear ? y : ''}`

          const expRow = expSummary.byMonth.find(r => r.month === m && r.year === y)
          const saleRow = saleSummary.byMonth.find(r => r.month === m && r.year === y)

          // Outflow = expenses + salary (salary is same every month = totalSalaryDue)
          const expTotal = expRow?.total ?? 0
          const salary   = dash.finance.totalSalaryDue
          months.push({
            label:   label.trim(),
            Income:  saleRow?.total ?? 0,
            Outflow: expTotal + salary,
          })
        }
        setChartData(months)
      } catch {
        // non-critical — show empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [curMonth, curYear])

  const net = finance?.netIncomeThisMonth ?? 0
  const netPositive = net >= 0

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/breeder" className="text-accent text-sm hover:opacity-80">‹ Farm OS</Link>
        <h1 className="text-ink text-2xl font-bold mt-1">Farm Finance</h1>
        <p className="text-ink-2 text-sm mt-1">Payroll, expenses, and sales</p>
      </div>

      {/* Net Income Summary Card */}
      {loading ? (
        <div className="h-28 rounded-2xl bg-card animate-pulse mb-5" />
      ) : finance ? (
        <div className="bg-card border border-rim rounded-2xl p-5 mb-5">
          <p className="text-ink-3 text-xs font-semibold uppercase tracking-wider mb-3">
            {MONTH_SHORT[curMonth - 1]} {curYear} — This Month
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-ink-3 text-xs mb-1">Income</p>
              <p className="text-success font-bold text-lg">{peso(finance.totalSalesThisMonth)}</p>
            </div>
            <div>
              <p className="text-ink-3 text-xs mb-1">Outflow</p>
              <p className="text-warning font-bold text-lg">{peso(finance.totalOutflowThisMonth)}</p>
              <p className="text-ink-3 text-xs">Salary + Expenses</p>
            </div>
            <div>
              <p className="text-ink-3 text-xs mb-1">Net</p>
              <p className={`font-bold text-xl ${netPositive ? 'text-success' : 'text-danger'}`}>
                {net >= 0 ? '+' : '-'}{peso(net)}
              </p>
            </div>
          </div>
          <div className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
            netPositive
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}>
            {netPositive
              ? `✅ Income is ahead by ${peso(net)}`
              : `⚠️ Outflow exceeds income by ${peso(Math.abs(net))}`
            }
          </div>
        </div>
      ) : null}

      {/* Income vs Outflow Chart — last 6 months */}
      <div className="bg-card border border-rim rounded-2xl p-5 mb-5">
        <p className="text-ink font-bold mb-4">Income vs Outflow — Last 6 Months</p>
        {chartData.every(d => d.Income === 0 && d.Outflow === 0) ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="text-3xl mb-2">📊</span>
            <p className="text-ink-2 text-sm">No data yet. Add sales and expenses to see your chart.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#606060', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#606060', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#A0A0A0', paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="Income"  fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Outflow" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 3 Module Cards */}
      <div className="flex flex-col gap-3">
        <Link
          href="/breeder/finance/workers"
          className="flex items-center bg-card border border-rim rounded-xl p-4 hover:border-accent/40 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-card-2 flex items-center justify-center text-2xl shrink-0 mr-4">
            👷
          </div>
          <div className="flex-1">
            <p className="text-ink font-bold text-base mb-0.5">Workers</p>
            <p className="text-ink-2 text-sm leading-snug">
              {finance
                ? `${finance.totalWorkers} workers · ₱${finance.totalSalaryDue.toLocaleString()} salary/mo`
                : 'Salaries, advances, and payslips'
              }
            </p>
          </div>
          <span className="text-accent text-xl ml-3 group-hover:translate-x-0.5 transition-transform">›</span>
        </Link>

        <Link
          href="/breeder/finance/expenses"
          className="flex items-center bg-card border border-rim rounded-xl p-4 hover:border-accent/40 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-card-2 flex items-center justify-center text-2xl shrink-0 mr-4">
            💸
          </div>
          <div className="flex-1">
            <p className="text-ink font-bold text-base mb-0.5">Farm Expenses</p>
            <p className="text-ink-2 text-sm leading-snug">
              {finance
                ? `This month: ₱${finance.totalExpensesThisMonth.toLocaleString()}`
                : 'Feeds, medicines, and farm costs'
              }
            </p>
          </div>
          <span className="text-accent text-xl ml-3 group-hover:translate-x-0.5 transition-transform">›</span>
        </Link>

        <Link
          href="/breeder/finance/sales"
          className="flex items-center bg-card border border-rim rounded-xl p-4 hover:border-accent/40 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-card-2 flex items-center justify-center text-2xl shrink-0 mr-4">
            💰
          </div>
          <div className="flex-1">
            <p className="text-ink font-bold text-base mb-0.5">Farm Sales</p>
            <p className="text-ink-2 text-sm leading-snug">
              {finance
                ? `This month: ₱${finance.totalSalesThisMonth.toLocaleString()}`
                : 'Track stags, hens, chicks, and deals'
              }
            </p>
          </div>
          <span className="text-accent text-xl ml-3 group-hover:translate-x-0.5 transition-transform">›</span>
        </Link>
      </div>
    </div>
  )
}
