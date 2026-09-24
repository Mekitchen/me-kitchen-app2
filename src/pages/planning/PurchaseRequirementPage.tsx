import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Field, Select } from '../../components/ui/FormField'
import { StatusBadge } from '../../components/ui/Badge'
import { formatDate, formatNumber } from '../../lib/utils'
import type { IngredientMaster, MrpRun, PurchaseRequirement } from '../../types/domain'

type PRow = PurchaseRequirement & { ingredient?: IngredientMaster }

export default function PurchaseRequirementPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'planner', 'purchasing')
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: runs } = useQuery({
    queryKey: ['mrp_run', 'computed'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mrp_run').select('*, kitchen:kitchen_master(*)').in('status', ['computed', 'released']).order('run_at', { ascending: false })
      if (error) throw error
      return data as MrpRun[]
    },
  })

  const [runId, setRunId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: requirements, refetch } = useQuery({
    queryKey: ['purchase_requirement', runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_requirement')
        .select('*, ingredient:ingredient_master(*, uom:uom_master(*), default_supplier:supplier_master(*))')
        .eq('mrp_run_id', runId)
        .order('net_requirement_qty', { ascending: false })
      if (error) throw error
      return data as PRow[]
    },
  })

  const generate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('generate_purchase_requirement', { p_run_id: runId })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã tính nhu cầu mua thực (MRP tổng − tồn kho hiện có)')
      refetch()
    },
    onError: (e: any) => toast.error(e.message ?? 'Tính toán thất bại'),
  })

  const toBuy = useMemo(() => (requirements ?? []).filter((r) => Number(r.net_requirement_qty) > 0), [requirements])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const createPR = useMutation({
    mutationFn: async () => {
      const rows = toBuy.filter((r) => selected.size === 0 || selected.has(r.id))
      if (rows.length === 0) throw new Error('Không có dòng nhu cầu nào để đưa vào')
      const run = runs?.find((r) => r.id === runId)
      const kitchenId = run?.kitchen_id ?? rows[0].kitchen_id

      const { data: prNo, error: prNoErr } = await supabase.rpc('next_document_no', { prefix: 'PR' })
      if (prNoErr) throw prNoErr

      const { data: header, error: headerErr } = await supabase
        .from('purchase_request_header')
        .insert({
          pr_no: prNo,
          kitchen_id: kitchenId,
          requirement_period_from: run?.plan_date_from ?? new Date().toISOString().slice(0, 10),
          requirement_period_to: run?.plan_date_to ?? new Date().toISOString().slice(0, 10),
          status: 'draft',
        })
        .select()
        .single()
      if (headerErr) throw headerErr

      const lines = rows.map((r) => ({
        pr_header_id: header.id,
        ingredient_id: r.ingredient_id,
        supplier_id: r.ingredient?.default_supplier_id ?? null,
        quantity: r.net_requirement_qty,
        uom_id: r.uom_id,
        estimated_unit_cost: r.ingredient?.last_purchase_cost ?? r.ingredient?.standard_cost ?? 0,
        purchase_requirement_id: r.id,
      }))
      const { error: detailErr } = await supabase.from('purchase_request_detail').insert(lines)
      if (detailErr) throw detailErr

      await supabase.from('purchase_requirement').update({ status: 'confirmed' }).in('id', rows.map((r) => r.id))

      return header.id as string
    },
    onSuccess: (id) => {
      toast.success('Đã tạo yêu cầu mua hàng')
      navigate('/purchase-requests', { state: { openId: id } })
    },
    onError: (e: any) => toast.error(e.message ?? 'Tạo yêu cầu mua hàng thất bại'),
  })

  return (
    <div>
      <PageHeader
        title="Nhu cầu mua hàng"
        description="Số lượng cần mua thực = Nhu cầu nguyên liệu tổng − Tồn kho hiện có."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Đợt tính MRP">
          <Select value={runId} onChange={(e) => { setRunId(e.target.value); setSelected(new Set()) }}>
            <option value="">— Chọn đợt MRP đã tính —</option>
            {runs?.map((r) => <option key={r.id} value={r.id}>{r.run_name} ({formatDate(r.plan_date_from)} - {formatDate(r.plan_date_to)})</option>)}
          </Select>
        </Field>
        {canWrite && runId && (
          <div className="flex items-end">
            <button className="btn btn-secondary" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? 'Đang đối chiếu…' : 'Đối chiếu tồn kho & tính nhu cầu mua thực'}
            </button>
          </div>
        )}
      </div>

      {runId && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                {canWrite && <th className="px-4 py-2.5 w-8" />}
                <th className="px-4 py-2.5">Nguyên liệu</th>
                <th className="px-4 py-2.5 text-right">Nhu cầu tổng</th>
                <th className="px-4 py-2.5 text-right">Tồn kho</th>
                <th className="px-4 py-2.5 text-right">Cần mua thực</th>
                <th className="px-4 py-2.5">ĐVT</th>
                <th className="px-4 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {toBuy.map((r) => (
                <tr key={r.id} className="border-b border-ink-50 last:border-0">
                  {canWrite && (
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 rounded border-ink-300" />
                    </td>
                  )}
                  <td className="px-4 py-2">{r.ingredient?.name}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(r.gross_requirement_qty)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(r.on_hand_qty)}</td>
                  <td className="px-4 py-2 text-right font-medium text-brand-700">{formatNumber(r.net_requirement_qty)}</td>
                  <td className="px-4 py-2">{r.ingredient?.uom?.code}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {toBuy.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">Chưa có nhu cầu mua thực. Bấm "Đối chiếu tồn kho" ở trên.</td></tr>
              )}
            </tbody>
          </table>
          {canWrite && toBuy.length > 0 && (
            <div className="flex justify-end border-t border-ink-100 px-4 py-3">
              <button className="btn btn-primary" onClick={() => createPR.mutate()} disabled={createPR.isPending}>
                {createPR.isPending ? 'Đang tạo…' : `Tạo yêu cầu mua hàng${selected.size ? ` (đã chọn ${selected.size})` : ' (tất cả)'}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
