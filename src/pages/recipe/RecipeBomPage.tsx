import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useUoms } from '../../hooks/useLookups'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field, Select, TextInput } from '../../components/ui/FormField'
import { StatusBadge } from '../../components/ui/Badge'
import { formatCurrency, formatNumber, uuid } from '../../lib/utils'
import type { DishMaster, IngredientMaster, RecipeDetail, RecipeHeader } from '../../types/domain'

type DraftLine = Partial<RecipeDetail> & { _key: string; _deleted?: boolean }

export default function RecipeBomPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'planner')
  const qc = useQueryClient()
  const { data: uoms } = useUoms()

  const { data: dishes } = useQuery({
    queryKey: ['dish_master', 'for-recipe'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dish_master').select('*').eq('active', true).order('name')
      if (error) throw error
      return data as DishMaster[]
    },
  })

  const { data: ingredients } = useQuery({
    queryKey: ['ingredient_master', 'for-recipe'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ingredient_master').select('*').eq('active', true).order('name')
      if (error) throw error
      return data as IngredientMaster[]
    },
  })

  const [dishId, setDishId] = useState<string>('')

  const { data: headers } = useQuery({
    queryKey: ['recipe_header', dishId],
    enabled: !!dishId,
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_header').select('*').eq('dish_id', dishId).order('version_no', { ascending: false })
      if (error) throw error
      return data as RecipeHeader[]
    },
  })

  const activeHeader = headers?.find((h) => h.status === 'active') ?? headers?.[0]
  const [selectedHeaderId, setSelectedHeaderId] = useState<string>('')
  const currentHeader = headers?.find((h) => h.id === selectedHeaderId) ?? activeHeader

  const { data: details } = useQuery({
    queryKey: ['recipe_detail', currentHeader?.id],
    enabled: !!currentHeader?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_detail').select('*').eq('recipe_header_id', currentHeader!.id).order('sequence')
      if (error) throw error
      return data as RecipeDetail[]
    },
  })

  const [lines, setLines] = useState<DraftLine[] | null>(null)
  const editableLines: DraftLine[] = lines ?? (details ?? []).map((d) => ({ ...d, _key: d.id }))

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients])
  const uomMap = useMemo(() => new Map((uoms ?? []).map((u) => [u.id, u])), [uoms])

  const costPerYield = useMemo(() => {
    return editableLines
      .filter((l) => !l._deleted)
      .reduce((sum, l) => {
        const ing = ingredientMap.get(l.ingredient_id ?? '')
        if (!ing) return sum
        const qty = Number(l.quantity ?? 0) * (1 + Number(l.wastage_pct ?? 0) / 100)
        return sum + qty * ing.standard_cost
      }, 0)
  }, [editableLines, ingredientMap])

  const costPerPortion = currentHeader?.yield_qty ? costPerYield / currentHeader.yield_qty : 0

  function addLine() {
    setLines([
      ...editableLines,
      { _key: uuid(), ingredient_id: '', quantity: 0, uom_id: uoms?.[0]?.id, wastage_pct: 0, sequence: editableLines.length + 1 },
    ])
  }
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines(editableLines.map((l) => (l._key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: string) {
    setLines(editableLines.map((l) => (l._key === key ? { ...l, _deleted: true } : l)))
  }

  const saveLines = useMutation({
    mutationFn: async () => {
      if (!currentHeader) return
      const toDelete = editableLines.filter((l) => l._deleted && l.id)
      const toUpsert = editableLines.filter((l) => !l._deleted && l.ingredient_id && l.uom_id)

      for (const l of toDelete) {
        await supabase.from('recipe_detail').delete().eq('id', l.id)
      }
      for (const l of toUpsert) {
        const payload = {
          recipe_header_id: currentHeader.id,
          ingredient_id: l.ingredient_id,
          quantity: l.quantity,
          uom_id: l.uom_id,
          wastage_pct: l.wastage_pct ?? 0,
          sequence: l.sequence ?? 1,
          notes: l.notes ?? null,
        }
        if (l.id) await supabase.from('recipe_detail').update(payload).eq('id', l.id)
        else await supabase.from('recipe_detail').insert(payload)
      }
    },
    onSuccess: () => {
      toast.success('Đã lưu công thức / BOM')
      setLines(null)
      qc.invalidateQueries({ queryKey: ['recipe_detail'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Lưu thất bại'),
  })

  const newVersion = useMutation({
    mutationFn: async () => {
      if (!dishId) return
      const nextVersion = (headers?.[0]?.version_no ?? 0) + 1
      const { data: newHeader, error } = await supabase
        .from('recipe_header')
        .insert({
          dish_id: dishId,
          version_no: nextVersion,
          status: 'draft',
          yield_qty: currentHeader?.yield_qty ?? 100,
          yield_uom_id: currentHeader?.yield_uom_id,
          change_summary: 'Phiên bản nháp mới',
        })
        .select()
        .single()
      if (error) throw error
      if (currentHeader) {
        const { data: srcLines } = await supabase.from('recipe_detail').select('*').eq('recipe_header_id', currentHeader.id)
        if (srcLines?.length) {
          await supabase.from('recipe_detail').insert(
            srcLines.map((l: RecipeDetail) => ({
              recipe_header_id: newHeader.id,
              ingredient_id: l.ingredient_id,
              quantity: l.quantity,
              uom_id: l.uom_id,
              wastage_pct: l.wastage_pct,
              sequence: l.sequence,
              notes: l.notes,
            }))
          )
        }
      }
      return newHeader
    },
    onSuccess: (h) => {
      toast.success('Đã tạo phiên bản nháp mới')
      qc.invalidateQueries({ queryKey: ['recipe_header', dishId] })
      if (h) setSelectedHeaderId(h.id)
    },
    onError: (e: any) => toast.error(e.message ?? 'Tạo phiên bản thất bại'),
  })

  const activate = useMutation({
    mutationFn: async () => {
      if (!currentHeader) return
      const { error } = await supabase.from('recipe_header').update({ status: 'active' }).eq('id', currentHeader.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã kích hoạt phiên bản')
      qc.invalidateQueries({ queryKey: ['recipe_header', dishId] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Kích hoạt thất bại'),
  })

  return (
    <div>
      <PageHeader title="Quản lý công thức / BOM" description="Khai báo định mức nguyên liệu (BOM) cho từng món — nền tảng cho mọi tính toán phía sau." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Món ăn">
          <Select value={dishId} onChange={(e) => { setDishId(e.target.value); setSelectedHeaderId(''); setLines(null) }}>
            <option value="">— Chọn món —</option>
            {dishes?.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </Select>
        </Field>
        {headers && headers.length > 0 && (
          <Field label="Phiên bản">
            <Select value={currentHeader?.id ?? ''} onChange={(e) => { setSelectedHeaderId(e.target.value); setLines(null) }}>
              {headers.map((h) => <option key={h.id} value={h.id}>v{h.version_no} — {h.status}</option>)}
            </Select>
          </Field>
        )}
        {canWrite && dishId && (
          <div className="flex items-end gap-2">
            <button className="btn btn-secondary" onClick={() => newVersion.mutate()}>+ Phiên bản mới</button>
            {currentHeader && currentHeader.status !== 'active' && (
              <button className="btn btn-primary" onClick={() => activate.mutate()}>Kích hoạt</button>
            )}
          </div>
        )}
      </div>

      {!dishId && <div className="card p-10 text-center text-ink-400">Chọn một món để xem hoặc chỉnh sửa công thức.</div>}

      {dishId && currentHeader && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink-900">Version {currentHeader.version_no}</span>
              <StatusBadge status={currentHeader.status} />
              <span className="text-sm text-ink-500">Yield: {currentHeader.yield_qty} portions</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400">Chi phí định mức / khẩu phần</p>
              <p className="text-lg font-semibold text-brand-700">{formatCurrency(costPerPortion)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5">Nguyên liệu</th>
                  <th className="px-4 py-2.5 text-right">SL</th>
                  <th className="px-4 py-2.5">ĐVT</th>
                  <th className="px-4 py-2.5 text-right">% hao hụt</th>
                  <th className="px-4 py-2.5 text-right">Chi phí dòng</th>
                  {canWrite && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {editableLines.filter((l) => !l._deleted).map((l) => {
                  const ing = ingredientMap.get(l.ingredient_id ?? '')
                  const lineCost = ing ? Number(l.quantity ?? 0) * (1 + Number(l.wastage_pct ?? 0) / 100) * ing.standard_cost : 0
                  return (
                    <tr key={l._key} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-2">
                        {canWrite ? (
                          <Select value={l.ingredient_id ?? ''} onChange={(e) => updateLine(l._key, { ingredient_id: e.target.value })}>
                            <option value="">— Chọn —</option>
                            {ingredients?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </Select>
                        ) : (ing?.name ?? '—')}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {canWrite ? (
                          <TextInput type="number" className="text-right" value={l.quantity ?? 0} onChange={(e) => updateLine(l._key, { quantity: Number(e.target.value) })} />
                        ) : formatNumber(l.quantity)}
                      </td>
                      <td className="px-4 py-2">
                        {canWrite ? (
                          <Select value={l.uom_id ?? ''} onChange={(e) => updateLine(l._key, { uom_id: e.target.value })}>
                            {uoms?.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                          </Select>
                        ) : (uomMap.get(l.uom_id ?? '')?.code ?? '—')}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {canWrite ? (
                          <TextInput type="number" className="text-right" value={l.wastage_pct ?? 0} onChange={(e) => updateLine(l._key, { wastage_pct: Number(e.target.value) })} />
                        ) : `${l.wastage_pct ?? 0}%`}
                      </td>
                      <td className="px-4 py-2 text-right text-ink-600">{formatCurrency(lineCost)}</td>
                      {canWrite && (
                        <td className="px-4 py-2 text-right">
                          <button className="text-xs text-red-600 hover:underline" onClick={() => removeLine(l._key)}>Xoá dòng</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {canWrite && (
            <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
              <button className="btn btn-secondary" onClick={addLine}>+ Thêm nguyên liệu</button>
              <button className="btn btn-primary" onClick={() => saveLines.mutate()} disabled={saveLines.isPending}>
                {saveLines.isPending ? 'Đang lưu…' : 'Lưu công thức'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
