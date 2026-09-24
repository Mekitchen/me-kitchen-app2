import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatCard } from '../components/ui/StatCard'
import { Field, TextInput } from '../components/ui/FormField'
import { CHART_AXIS, CHART_GRID, DIVERGING } from '../lib/chartColors'
import { formatCurrency, formatDate, formatNumber, todayISO } from '../lib/utils'
import type { FoodCostRow } from '../types/domain'

export default function FoodCostAnalysisPage() {
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(todayISO())

  const { data: rows, isLoading } = useQuery({
    queryKey: ['v_food_cost_analysis', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_food_cost_analysis').select('*').gte('consumption_date', from).lte('consumption_date', to).order('consumption_date', { ascending: false })
      if (error) throw error
      return data as FoodCostRow[]
    },
  })

  const totals = useMemo(() => {
    const std = (rows ?? []).reduce((s, r) => s + Number(r.standard_total_cost), 0)
    const act = (rows ?? []).reduce((s, r) => s + Number(r.actual_total_cost), 0)
    return { std, act, variance: act - std, pct: std ? ((act - std) / std) * 100 : 0 }
  }, [rows])

  const byDish = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows ?? []) map.set(r.dish_name, (map.get(r.dish_name) ?? 0) + Number(r.variance))
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 10)
  }, [rows])

  const columns: Column<FoodCostRow & { id: string }>[] = [
    { key: 'consumption_date', header: 'Ngày', render: (r) => formatDate(r.consumption_date) },
    { key: 'dish_name', header: 'Món ăn', render: (r) => r.dish_name },
    { key: 'actual_qty', header: 'Suất đã phục vụ', align: 'right', render: (r) => formatNumber(r.actual_qty, 0) },
    { key: 'standard_unit_cost', header: 'CP định mức/suất', align: 'right', render: (r) => formatCurrency(r.standard_unit_cost) },
    { key: 'actual_unit_cost', header: 'Chi phí thực/suất', align: 'right', render: (r) => formatCurrency(r.actual_unit_cost) },
    { key: 'standard_total_cost', header: 'Tổng định mức', align: 'right', render: (r) => formatCurrency(r.standard_total_cost) },
    { key: 'actual_total_cost', header: 'Tổng thực tế', align: 'right', render: (r) => formatCurrency(r.actual_total_cost) },
    {
      key: 'variance', header: 'Chênh lệch', align: 'right',
      render: (r) => (
        <span className={r.variance > 0 ? 'text-red-600' : r.variance < 0 ? 'text-emerald-600' : 'text-ink-400'}>
          {formatCurrency(r.variance)} ({r.variance_pct > 0 ? '+' : ''}{r.variance_pct}%)
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Phân tích chi phí món ăn" description="So sánh chi phí định mức (theo công thức) với chi phí thực tế, dựa trên tiêu hao và giá mua thực tế." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Từ ngày"><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Đến ngày"><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Chi phí định mức" value={formatCurrency(totals.std)} />
        <StatCard label="Chi phí thực tế" value={formatCurrency(totals.act)} />
        <StatCard label="Chênh lệch" value={`${formatCurrency(totals.variance)} (${totals.pct.toFixed(1)}%)`} tone={totals.variance > 0 ? 'bad' : 'good'} />
      </div>

      <div className="card mb-6 p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Món có chênh lệch lớn nhất</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byDish} margin={{ left: 0, right: 8 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={(v) => formatCurrency(v)} width={70} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {byDish.map((d, i) => <Cell key={i} fill={d.value >= 0 ? DIVERGING.positive : DIVERGING.negative} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable columns={columns} rows={(rows ?? []).map((r, i) => ({ ...r, id: `${r.dish_id}-${r.consumption_date}-${i}` }))} loading={isLoading} />
    </div>
  )
}
