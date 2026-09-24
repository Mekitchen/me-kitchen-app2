import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { CATEGORICAL, CHART_AXIS, CHART_GRID, DIVERGING } from '../lib/chartColors'
import { formatCurrency, formatNumber } from '../lib/utils'

export default function Dashboard() {
  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

      const [{ count: pendingApprovals }, { data: lowStock }, { data: mealsWeek }, { data: fc }] = await Promise.all([
        supabase.from('purchase_request_header').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('inventory_balance').select('on_hand_qty, ingredient:ingredient_master(min_stock_qty)'),
        supabase.from('menu_plan_detail').select('planned_qty, menu_plan_header!inner(plan_date)').gte('menu_plan_header.plan_date', weekAgo).lte('menu_plan_header.plan_date', today),
        supabase.from('v_food_cost_analysis').select('*').gte('consumption_date', weekAgo),
      ])

      const lowStockCount = (lowStock ?? []).filter((r: any) => Number(r.on_hand_qty) < Number(r.ingredient?.min_stock_qty ?? 0)).length
      const totalMealsWeek = (mealsWeek ?? []).reduce((s: number, r: any) => s + Number(r.planned_qty ?? 0), 0)
      const totalVariance = (fc ?? []).reduce((s: number, r: any) => s + Number(r.variance ?? 0), 0)
      const totalStdCost = (fc ?? []).reduce((s: number, r: any) => s + Number(r.standard_total_cost ?? 0), 0)

      return { pendingApprovals: pendingApprovals ?? 0, lowStockCount, totalMealsWeek, totalVariance, totalStdCost }
    },
  })

  const { data: mealTrend } = useQuery({
    queryKey: ['dashboard-meal-trend'],
    queryFn: async () => {
      const from = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10)
      const [{ data: planned }, { data: actual }] = await Promise.all([
        supabase.from('menu_plan_header').select('plan_date, menu_plan_detail(planned_qty)').gte('plan_date', from),
        supabase.from('consumption_actual').select('consumption_date, actual_meal_qty').gte('consumption_date', from),
      ])
      const map = new Map<string, { date: string; planned: number; actual: number }>()
      for (const p of planned ?? []) {
        const sum = (p.menu_plan_detail ?? []).reduce((s: number, d: any) => s + Number(d.planned_qty ?? 0), 0)
        const row = map.get(p.plan_date) ?? { date: p.plan_date, planned: 0, actual: 0 }
        row.planned += sum
        map.set(p.plan_date, row)
      }
      for (const a of actual ?? []) {
        const row = map.get(a.consumption_date) ?? { date: a.consumption_date, planned: 0, actual: 0 }
        row.actual += Number(a.actual_meal_qty ?? 0)
        map.set(a.consumption_date, row)
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
    },
  })

  const { data: spendBySupplier } = useQuery({
    queryKey: ['dashboard-spend-supplier'],
    queryFn: async () => {
      const { data } = await supabase.from('purchase_order_detail').select('total_cost, po:purchase_order_header(supplier:supplier_master(name))')
      const map = new Map<string, number>()
      for (const r of data ?? []) {
        const name = (r as any).po?.supplier?.name ?? 'Không xác định'
        map.set(name, (map.get(name) ?? 0) + Number(r.total_cost ?? 0))
      }
      return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
    },
  })

  const { data: variance } = useQuery({
    queryKey: ['dashboard-variance'],
    queryFn: async () => {
      const { data } = await supabase.from('v_food_cost_analysis').select('*')
      const map = new Map<string, number>()
      for (const r of data ?? []) map.set(r.dish_name, (map.get(r.dish_name) ?? 0) + Number(r.variance ?? 0))
      return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8)
    },
  })

  return (
    <div>
      <PageHeader title="Tổng quan" description="Tổng quan theo thời gian thực về kế hoạch, thu mua và hiệu quả chi phí món ăn." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Suất ăn đã lên kế hoạch (7 ngày)" value={formatNumber(kpis?.totalMealsWeek ?? 0, 0)} sublabel="Tất cả các bếp" />
        <StatCard label="Chờ phê duyệt" value={String(kpis?.pendingApprovals ?? 0)} sublabel="Yêu cầu mua hàng đang chờ ký duyệt" tone={kpis?.pendingApprovals ? 'warn' : 'default'} />
        <StatCard label="Nguyên liệu dưới mức tồn tối thiểu" value={String(kpis?.lowStockCount ?? 0)} sublabel="Tất cả các bếp" tone={kpis?.lowStockCount ? 'bad' : 'good'} />
        <StatCard
          label="Chênh lệch chi phí món ăn (7 ngày)"
          value={formatCurrency(kpis?.totalVariance ?? 0)}
          sublabel={kpis?.totalStdCost ? `${(((kpis?.totalVariance ?? 0) / kpis.totalStdCost) * 100).toFixed(1)}% so với định mức` : undefined}
          tone={(kpis?.totalVariance ?? 0) > 0 ? 'bad' : 'good'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">Kế hoạch và thực tế (14 ngày)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mealTrend ?? []} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} width={44} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="planned" name="Kế hoạch" stroke={CATEGORICAL[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" name="Thực tế" stroke={CATEGORICAL[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">Chi tiêu mua hàng theo NCC</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={spendBySupplier ?? []} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid stroke={CHART_GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: CHART_AXIS }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {(spendBySupplier ?? []).map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">Food Cost Variance by Dish (Actual − Standard)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={variance ?? []} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {(variance ?? []).map((d, i) => <Cell key={i} fill={d.value >= 0 ? DIVERGING.positive : DIVERGING.negative} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
