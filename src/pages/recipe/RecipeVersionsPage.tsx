import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { StatusBadge } from '../../components/ui/Badge'
import { Field, Select } from '../../components/ui/FormField'
import { formatDate, formatNumber } from '../../lib/utils'
import type { DishMaster, IngredientMaster, RecipeDetail, RecipeHeader } from '../../types/domain'

interface VersionRow extends RecipeHeader {
  dish?: DishMaster
}

export default function RecipeVersionsPage() {
  const { data: versions, isLoading } = useQuery({
    queryKey: ['recipe_header', 'all-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_header')
        .select('*, dish:dish_master(*)')
        .order('dish_id')
        .order('version_no', { ascending: false })
      if (error) throw error
      return data as VersionRow[]
    },
  })

  const [dishId, setDishId] = useState('')
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')

  const dishVersions = useMemo(() => (versions ?? []).filter((v) => v.dish_id === dishId), [versions, dishId])

  const { data: leftLines } = useQuery({
    queryKey: ['recipe_detail', 'compare', leftId],
    enabled: !!leftId,
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_detail').select('*, ingredient:ingredient_master(*)').eq('recipe_header_id', leftId)
      if (error) throw error
      return data as (RecipeDetail & { ingredient?: IngredientMaster })[]
    },
  })
  const { data: rightLines } = useQuery({
    queryKey: ['recipe_detail', 'compare', rightId],
    enabled: !!rightId,
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_detail').select('*, ingredient:ingredient_master(*)').eq('recipe_header_id', rightId)
      if (error) throw error
      return data as (RecipeDetail & { ingredient?: IngredientMaster })[]
    },
  })

  const cols: Column<VersionRow>[] = [
    { key: 'dish', header: 'Món ăn', render: (r) => `${r.dish?.code ?? ''} — ${r.dish?.name ?? ''}` },
    { key: 'version_no', header: 'Phiên bản', render: (r) => `v${r.version_no}` },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'yield_qty', header: 'Sản lượng', align: 'right', render: (r) => formatNumber(r.yield_qty, 0) },
    { key: 'effective_from', header: 'Hiệu lực từ', render: (r) => formatDate(r.effective_from) },
    { key: 'effective_to', header: 'Hiệu lực đến', render: (r) => formatDate(r.effective_to) },
    { key: 'change_summary', header: 'Tóm tắt thay đổi', render: (r) => r.change_summary ?? '—' },
  ]

  const ingredientIds = useMemo(() => {
    const set = new Set<string>()
    leftLines?.forEach((l) => set.add(l.ingredient_id))
    rightLines?.forEach((l) => set.add(l.ingredient_id))
    return Array.from(set)
  }, [leftLines, rightLines])

  return (
    <div>
      <PageHeader title="Quản lý phiên bản công thức" description="Toàn bộ lịch sử các phiên bản công thức, có thể so sánh song song." />

      <DataTable columns={cols} rows={versions ?? []} loading={isLoading} searchable searchKeys={['change_summary']} />

      <div className="mt-6 card p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink-900">So sánh phiên bản</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Món ăn">
            <Select value={dishId} onChange={(e) => { setDishId(e.target.value); setLeftId(''); setRightId('') }}>
              <option value="">— Chọn món —</option>
              {Array.from(new Map((versions ?? []).map((v) => [v.dish_id, v.dish])).entries()).map(([id, d]) => (
                <option key={id} value={id}>{d?.code} — {d?.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Phiên bản A">
            <Select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              <option value="">— Chọn —</option>
              {dishVersions.map((v) => <option key={v.id} value={v.id}>v{v.version_no} ({v.status})</option>)}
            </Select>
          </Field>
          <Field label="Phiên bản B">
            <Select value={rightId} onChange={(e) => setRightId(e.target.value)}>
              <option value="">— Chọn —</option>
              {dishVersions.map((v) => <option key={v.id} value={v.id}>v{v.version_no} ({v.status})</option>)}
            </Select>
          </Field>
        </div>

        {leftId && rightId && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5">Nguyên liệu</th>
                  <th className="px-4 py-2.5 text-right">SL (A)</th>
                  <th className="px-4 py-2.5 text-right">SL (B)</th>
                  <th className="px-4 py-2.5 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {ingredientIds.map((id) => {
                  const l = leftLines?.find((x) => x.ingredient_id === id)
                  const r = rightLines?.find((x) => x.ingredient_id === id)
                  const name = l?.ingredient?.name ?? r?.ingredient?.name ?? '—'
                  const delta = Number(r?.quantity ?? 0) - Number(l?.quantity ?? 0)
                  return (
                    <tr key={id} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-2">{name}</td>
                      <td className="px-4 py-2 text-right">{l ? formatNumber(l.quantity) : '—'}</td>
                      <td className="px-4 py-2 text-right">{r ? formatNumber(r.quantity) : '—'}</td>
                      <td className={`px-4 py-2 text-right font-medium ${delta > 0 ? 'text-amber-600' : delta < 0 ? 'text-emerald-600' : 'text-ink-400'}`}>
                        {delta === 0 ? '—' : (delta > 0 ? '+' : '') + formatNumber(delta)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
