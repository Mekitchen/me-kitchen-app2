import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useKitchens } from '../../hooks/useLookups'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field, Select, TextInput } from '../../components/ui/FormField'
import { StatusBadge } from '../../components/ui/Badge'
import { todayISO, uuid } from '../../lib/utils'
import type { DishMaster, MealPeriod, MenuPlanDetail, MenuPlanHeader, MenuPlanStatus } from '../../types/domain'

type DraftLine = Partial<MenuPlanDetail> & { _key: string; _deleted?: boolean }

export default function MenuPlanningPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'planner', 'kitchen_manager')
  const qc = useQueryClient()
  const { data: kitchens } = useKitchens()

  const [kitchenId, setKitchenId] = useState('')
  const [planDate, setPlanDate] = useState(todayISO())
  const [mealPeriod, setMealPeriod] = useState<MealPeriod>('lunch')

  const { data: dishes } = useQuery({
    queryKey: ['dish_master', 'for-menu'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dish_master').select('*').eq('active', true).order('name')
      if (error) throw error
      return data as DishMaster[]
    },
  })

  const { data: header, refetch: refetchHeader } = useQuery({
    queryKey: ['menu_plan_header', kitchenId, planDate, mealPeriod],
    enabled: !!kitchenId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_plan_header')
        .select('*')
        .eq('kitchen_id', kitchenId)
        .eq('plan_date', planDate)
        .eq('meal_period', mealPeriod)
        .maybeSingle()
      if (error) throw error
      return data as MenuPlanHeader | null
    },
  })

  const { data: details } = useQuery({
    queryKey: ['menu_plan_detail', header?.id],
    enabled: !!header?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('menu_plan_detail').select('*').eq('menu_plan_header_id', header!.id)
      if (error) throw error
      return data as MenuPlanDetail[]
    },
  })

  const [lines, setLines] = useState<DraftLine[] | null>(null)
  const editableLines: DraftLine[] = lines ?? (details ?? []).map((d) => ({ ...d, _key: d.id }))

  function addLine() {
    setLines([...editableLines, { _key: uuid(), dish_id: '', planned_qty: 0 }])
  }
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines(editableLines.map((l) => (l._key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: string) {
    setLines(editableLines.map((l) => (l._key === key ? { ...l, _deleted: true } : l)))
  }

  const totalMeals = useMemo(
    () => editableLines.filter((l) => !l._deleted).reduce((s, l) => s + Number(l.planned_qty ?? 0), 0),
    [editableLines]
  )

  const ensureHeader = useMutation({
    mutationFn: async () => {
      if (header) return header
      const { data, error } = await supabase
        .from('menu_plan_header')
        .insert({ kitchen_id: kitchenId, plan_date: planDate, meal_period: mealPeriod, status: 'draft' })
        .select()
        .single()
      if (error) throw error
      return data as MenuPlanHeader
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const h = header ?? (await ensureHeader.mutateAsync())
      const toDelete = editableLines.filter((l) => l._deleted && l.id)
      const toUpsert = editableLines.filter((l) => !l._deleted && l.dish_id)
      for (const l of toDelete) await supabase.from('menu_plan_detail').delete().eq('id', l.id)
      for (const l of toUpsert) {
        const payload = { menu_plan_header_id: h!.id, dish_id: l.dish_id, planned_qty: l.planned_qty ?? 0, notes: l.notes ?? null }
        if (l.id) await supabase.from('menu_plan_detail').update(payload).eq('id', l.id)
        else await supabase.from('menu_plan_detail').insert(payload)
      }
    },
    onSuccess: () => {
      toast.success('Đã lưu thực đơn')
      setLines(null)
      qc.invalidateQueries({ queryKey: ['menu_plan_header'] })
      qc.invalidateQueries({ queryKey: ['menu_plan_detail'] })
      refetchHeader()
    },
    onError: (e: any) => toast.error(e.message ?? 'Lưu thất bại'),
  })

  const setStatus = useMutation({
    mutationFn: async (status: MenuPlanStatus) => {
      if (!header) return
      const { error } = await supabase.from('menu_plan_header').update({ status }).eq('id', header.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái')
      qc.invalidateQueries({ queryKey: ['menu_plan_header'] })
      refetchHeader()
    },
  })

  return (
    <div>
      <PageHeader title="Lập kế hoạch thực đơn" description="Lập kế hoạch món ăn và số suất theo bếp, ngày và bữa ăn." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Bếp" required>
          <Select value={kitchenId} onChange={(e) => { setKitchenId(e.target.value); setLines(null) }}>
            <option value="">— Chọn bếp —</option>
            {kitchens?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
        <Field label="Ngày lập kế hoạch" required>
          <TextInput type="date" value={planDate} onChange={(e) => { setPlanDate(e.target.value); setLines(null) }} />
        </Field>
        <Field label="Bữa ăn">
          <Select value={mealPeriod} onChange={(e) => { setMealPeriod(e.target.value as MealPeriod); setLines(null) }}>
            <option value="breakfast">Sáng</option>
            <option value="lunch">Trưa</option>
            <option value="dinner">Tối</option>
            <option value="snack">Ăn phụ</option>
          </Select>
        </Field>
        {header && (
          <div className="flex items-end gap-2">
            <StatusBadge status={header.status} />
          </div>
        )}
      </div>

      {!kitchenId && <div className="card p-10 text-center text-ink-400">Chọn bếp, ngày và bữa ăn để lập thực đơn.</div>}

      {kitchenId && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-medium text-ink-900">Món đã lên kế hoạch</p>
            <p className="text-sm text-ink-500">Total meals: <span className="font-semibold text-ink-900">{totalMeals.toLocaleString()}</span></p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5">Món ăn</th>
                <th className="px-4 py-2.5 text-right">SL kế hoạch (suất)</th>
                {canWrite && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {editableLines.filter((l) => !l._deleted).map((l) => (
                <tr key={l._key} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-2">
                    {canWrite ? (
                      <Select value={l.dish_id ?? ''} onChange={(e) => updateLine(l._key, { dish_id: e.target.value })}>
                        <option value="">— Chọn món —</option>
                        {dishes?.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                      </Select>
                    ) : (dishes?.find((d) => d.id === l.dish_id)?.name ?? '—')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canWrite ? (
                      <TextInput type="number" className="text-right" value={l.planned_qty ?? 0} onChange={(e) => updateLine(l._key, { planned_qty: Number(e.target.value) })} />
                    ) : l.planned_qty}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-2 text-right">
                      <button className="text-xs text-red-600 hover:underline" onClick={() => removeLine(l._key)}>Xoá dòng</button>
                    </td>
                  )}
                </tr>
              ))}
              {editableLines.filter((l) => !l._deleted).length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-ink-400">Chưa có món nào trong kế hoạch.</td></tr>
              )}
            </tbody>
          </table>
          {canWrite && header?.status !== 'locked' && (
            <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
              <button className="btn btn-secondary" onClick={addLine}>+ Thêm món</button>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => save.mutate()}>Lưu nháp</button>
                {header && header.status === 'draft' && (
                  <button className="btn btn-primary" onClick={() => setStatus.mutate('confirmed')}>Xác nhận thực đơn</button>
                )}
                {header && header.status === 'confirmed' && (
                  <button className="btn btn-primary" onClick={() => setStatus.mutate('locked')}>Khoá thực đơn</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
