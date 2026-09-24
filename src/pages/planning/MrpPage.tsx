import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useKitchens } from '../../hooks/useLookups'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { Field, Select, TextInput } from '../../components/ui/FormField'
import { StatusBadge } from '../../components/ui/Badge'
import { formatDate, formatNumber, todayISO } from '../../lib/utils'
import type { IngredientMaster, MrpDetail, MrpRun } from '../../types/domain'

export default function MrpPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'planner')
  const qc = useQueryClient()
  const { data: kitchens } = useKitchens()

  const { data: runs, isLoading } = useQuery({
    queryKey: ['mrp_run'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mrp_run').select('*, kitchen:kitchen_master(*)').order('run_at', { ascending: false })
      if (error) throw error
      return data as MrpRun[]
    },
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ run_name: '', plan_date_from: todayISO(), plan_date_to: todayISO(), kitchen_id: '' })
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const { data: mrpDetails } = useQuery({
    queryKey: ['mrp_detail', selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mrp_detail')
        .select('*, ingredient:ingredient_master(*, uom:uom_master(*))')
        .eq('mrp_run_id', selectedRunId!)
      if (error) throw error
      return data as (MrpDetail & { ingredient?: IngredientMaster })[]
    },
  })

  const createRun = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('mrp_run')
        .insert({
          run_name: form.run_name || `MRP ${form.plan_date_from} to ${form.plan_date_to}`,
          plan_date_from: form.plan_date_from,
          plan_date_to: form.plan_date_to,
          kitchen_id: form.kitchen_id || null,
        })
        .select()
        .single()
      if (error) throw error
      return data as MrpRun
    },
    onSuccess: (run) => {
      toast.success('Đã tạo đợt tính MRP')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['mrp_run'] })
      setSelectedRunId(run.id)
    },
    onError: (e: any) => toast.error(e.message ?? 'Tạo đợt chạy thất bại'),
  })

  const compute = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase.rpc('compute_mrp', { p_run_id: runId })
      if (error) throw error
    },
    onSuccess: (_d, runId) => {
      toast.success('Đã tính nhu cầu nguyên liệu từ thực đơn')
      qc.invalidateQueries({ queryKey: ['mrp_run'] })
      qc.invalidateQueries({ queryKey: ['mrp_detail', runId] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Tính toán thất bại — kiểm tra các thực đơn trong khoảng thời gian này đã được xác nhận/khoá chưa'),
  })

  const columns: Column<MrpRun>[] = [
    { key: 'run_name', header: 'Tên đợt chạy', render: (r) => <span className="font-medium text-ink-900">{r.run_name}</span> },
    { key: 'plan_date_from', header: 'Kỳ', render: (r) => `${formatDate(r.plan_date_from)} → ${formatDate(r.plan_date_to)}` },
    { key: 'kitchen', header: 'Bếp', render: (r) => r.kitchen?.name ?? 'Tất cả các bếp' },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'run_at', header: 'Chạy lúc', render: (r) => formatDate(r.run_at) },
  ]

  return (
    <div>
      <PageHeader
        title="Hoạch định nhu cầu nguyên vật liệu"
        description="Bung thực đơn đã xác nhận qua công thức/BOM đang áp dụng của từng món để tính nhu cầu nguyên liệu tổng."
        actions={canWrite && <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Đợt tính MRP mới</button>}
      />

      <DataTable
        columns={columns}
        rows={runs ?? []}
        loading={isLoading}
        onRowClick={(r) => setSelectedRunId(r.id)}
        actions={canWrite ? (r) => (
          <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => compute.mutate(r.id)}>
            {compute.isPending ? '…' : 'Tính toán'}
          </button>
        ) : undefined}
      />

      {selectedRunId && (
        <div className="mt-6 card">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Chi tiết nhu cầu tổng</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5">Nguyên liệu</th>
                <th className="px-4 py-2.5 text-right">Nhu cầu tổng</th>
                <th className="px-4 py-2.5">ĐVT</th>
              </tr>
            </thead>
            <tbody>
              {(mrpDetails ?? []).map((d) => (
                <tr key={d.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-2">{d.ingredient?.name}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(d.gross_requirement_qty)}</td>
                  <td className="px-4 py-2">{d.ingredient?.uom?.code ?? '—'}</td>
                </tr>
              ))}
              {(mrpDetails ?? []).length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-ink-400">No requirement computed yet — click "Compute" on the run above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Đợt tính MRP mới"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Huỷ</button>
          <button className="btn btn-primary" onClick={() => createRun.mutate()}>Tạo đợt chạy</button>
        </>}
      >
        <Field label="Tên đợt chạy"><TextInput value={form.run_name} onChange={(e) => setForm({ ...form, run_name: e.target.value })} placeholder="vd: Tuần 39 — Tất cả các bếp" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Từ ngày" required><TextInput type="date" value={form.plan_date_from} onChange={(e) => setForm({ ...form, plan_date_from: e.target.value })} /></Field>
          <Field label="Đến ngày" required><TextInput type="date" value={form.plan_date_to} onChange={(e) => setForm({ ...form, plan_date_to: e.target.value })} /></Field>
        </div>
        <Field label="Bếp (không bắt buộc — để trống nếu chọn tất cả)">
          <Select value={form.kitchen_id} onChange={(e) => setForm({ ...form, kitchen_id: e.target.value })}>
            <option value="">Tất cả các bếp</option>
            {kitchens?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
      </Modal>
    </div>
  )
}
