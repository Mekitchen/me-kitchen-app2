import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/Badge'
import { formatCurrency, formatDate, formatNumber } from '../../lib/utils'
import type { IngredientMaster, KitchenMaster, PurchaseRequestDetail, PurchaseRequestHeader, SupplierMaster } from '../../types/domain'

type HRow = PurchaseRequestHeader & { kitchen?: KitchenMaster; total?: number }

export default function PurchaseRequestPage() {
  const { hasRole, profile } = useAuth()
  const canSubmit = hasRole('admin', 'planner', 'purchasing')
  const qc = useQueryClient()
  const location = useLocation()

  const { data: headers, isLoading } = useQuery({
    queryKey: ['purchase_request_header'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_request_header').select('*, kitchen:kitchen_master(*)').order('requested_at', { ascending: false })
      if (error) throw error
      return data as HRow[]
    },
  })

  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    const stateId = (location.state as any)?.openId
    if (stateId) setOpenId(stateId)
  }, [location.state])

  const { data: lines } = useQuery({
    queryKey: ['purchase_request_detail', openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_request_detail')
        .select('*, ingredient:ingredient_master(*, uom:uom_master(*)), supplier:supplier_master(*)')
        .eq('pr_header_id', openId!)
      if (error) throw error
      return data as (PurchaseRequestDetail & { ingredient?: IngredientMaster; supplier?: SupplierMaster })[]
    },
  })

  const submit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_request_header').update({ status: 'submitted' }).eq('id', id)
      if (error) throw error
      await supabase.from('approval_log').insert({ pr_header_id: id, action: 'submit', actor_id: profile?.id, actor_role: profile?.role })
    },
    onSuccess: () => {
      toast.success('Đã gửi phê duyệt')
      qc.invalidateQueries({ queryKey: ['purchase_request_header'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Gửi thất bại'),
  })

  const openHeader = headers?.find((h) => h.id === openId)
  const lineTotal = (lines ?? []).reduce((s, l) => s + Number(l.estimated_total_cost ?? 0), 0)

  const columns: Column<HRow>[] = [
    { key: 'pr_no', header: 'Số yêu cầu mua', render: (r) => <span className="font-medium text-ink-900">{r.pr_no}</span> },
    { key: 'kitchen', header: 'Bếp', render: (r) => r.kitchen?.name ?? '—' },
    { key: 'requirement_period_from', header: 'Kỳ', render: (r) => `${formatDate(r.requirement_period_from)} → ${formatDate(r.requirement_period_to)}` },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'requested_at', header: 'Đã yêu cầu', render: (r) => formatDate(r.requested_at) },
  ]

  return (
    <div>
      <PageHeader title="Yêu cầu mua hàng" description="Yêu cầu mua hàng tổng hợp từ Nhu cầu mua hàng, được chuyển đi phê duyệt trước khi mua." />

      <DataTable
        columns={columns}
        rows={headers ?? []}
        loading={isLoading}
        searchable
        searchKeys={['pr_no']}
        onRowClick={(r) => setOpenId(r.id)}
        actions={canSubmit ? (r) => (
          r.status === 'draft' ? (
            <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => submit.mutate(r.id)}>Gửi</button>
          ) : null
        ) : undefined}
      />

      <Modal open={!!openId} onClose={() => setOpenId(null)} title={`Purchase Request ${openHeader?.pr_no ?? ''}`} width="lg">
        {openHeader && (
          <div className="mb-3 flex items-center gap-3 text-sm text-ink-500">
            <StatusBadge status={openHeader.status} />
            <span>{openHeader.kitchen?.name}</span>
            <span>{formatDate(openHeader.requirement_period_from)} → {formatDate(openHeader.requirement_period_to)}</span>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2">Nguyên liệu</th>
              <th className="px-3 py-2">Nhà cung cấp</th>
              <th className="px-3 py-2 text-right">SL</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Đơn giá ước tính</th>
              <th className="px-3 py-2 text-right">Tổng ước tính</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-ink-50 last:border-0">
                <td className="px-3 py-2">{l.ingredient?.name}</td>
                <td className="px-3 py-2">{l.supplier?.name ?? '—'}</td>
                <td className="px-3 py-2 text-right">{formatNumber(l.quantity)}</td>
                <td className="px-3 py-2">{l.ingredient?.uom?.code}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(l.estimated_unit_cost)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(l.estimated_total_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right font-medium text-ink-700">Tổng chi phí ước tính</td>
              <td className="px-3 py-2 text-right font-semibold text-brand-700">{formatCurrency(lineTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </Modal>
    </div>
  )
}
