import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { Field, TextArea } from '../../components/ui/FormField'
import { StatusBadge } from '../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { ApprovalLog, KitchenMaster, PurchaseRequestDetail, PurchaseRequestHeader } from '../../types/domain'

type HRow = PurchaseRequestHeader & { kitchen?: KitchenMaster }

export default function ApprovalWorkflowPage() {
  const { hasRole, profile } = useAuth()
  const canApprove = hasRole('admin', 'approver')
  const qc = useQueryClient()

  const { data: headers, isLoading } = useQuery({
    queryKey: ['purchase_request_header', 'for-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_request_header')
        .select('*, kitchen:kitchen_master(*)')
        .order('requested_at', { ascending: false })
      if (error) throw error
      return data as HRow[]
    },
  })

  const pending = (headers ?? []).filter((h) => h.status === 'submitted')
  const history = (headers ?? []).filter((h) => h.status !== 'draft' && h.status !== 'submitted')

  const [reviewId, setReviewId] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const { data: lines } = useQuery({
    queryKey: ['purchase_request_detail', reviewId],
    enabled: !!reviewId,
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_request_detail').select('*, ingredient:ingredient_master(*)').eq('pr_header_id', reviewId!)
      if (error) throw error
      return data as (PurchaseRequestDetail & { ingredient?: any })[]
    },
  })

  const { data: log } = useQuery({
    queryKey: ['approval_log', reviewId],
    enabled: !!reviewId,
    queryFn: async () => {
      const { data, error } = await supabase.from('approval_log').select('*').eq('pr_header_id', reviewId!).order('acted_at')
      if (error) throw error
      return data as ApprovalLog[]
    },
  })

  const decide = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!reviewId) return
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const { error } = await supabase
        .from('purchase_request_header')
        .update({ status: newStatus, approved_by: profile?.id, approved_at: new Date().toISOString() })
        .eq('id', reviewId)
      if (error) throw error
      await supabase.from('approval_log').insert({ pr_header_id: reviewId, action, actor_id: profile?.id, actor_role: profile?.role, comment })
    },
    onSuccess: (_d, action) => {
      toast.success(action === 'approve' ? 'Đã phê duyệt yêu cầu mua hàng' : 'Đã từ chối yêu cầu mua hàng')
      setReviewId(null)
      setComment('')
      qc.invalidateQueries({ queryKey: ['purchase_request_header'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Thao tác thất bại'),
  })

  const total = (lines ?? []).reduce((s, l) => s + Number(l.estimated_total_cost ?? 0), 0)

  const columns: Column<HRow>[] = [
    { key: 'pr_no', header: 'Số yêu cầu mua', render: (r) => <span className="font-medium text-ink-900">{r.pr_no}</span> },
    { key: 'kitchen', header: 'Bếp', render: (r) => r.kitchen?.name ?? '—' },
    { key: 'requirement_period_from', header: 'Kỳ', render: (r) => `${formatDate(r.requirement_period_from)} → ${formatDate(r.requirement_period_to)}` },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader title="Quy trình phê duyệt" description="Xem xét, phê duyệt hoặc từ chối các yêu cầu mua hàng đã gửi trước khi chuyển sang mua hàng." />

      <h3 className="mb-2 text-sm font-semibold text-ink-900">Pending Approval ({pending.length})</h3>
      <DataTable columns={columns} rows={pending} loading={isLoading} onRowClick={(r) => setReviewId(r.id)} emptyLabel="Không có yêu cầu nào đang chờ phê duyệt." />

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Lịch sử</h3>
      <DataTable columns={columns} rows={history} onRowClick={(r) => setReviewId(r.id)} emptyLabel="Chưa có lịch sử phê duyệt." />

      <Modal
        open={!!reviewId}
        onClose={() => { setReviewId(null); setComment('') }}
        title="Xem xét yêu cầu mua hàng"
        width="lg"
        footer={
          canApprove && headers?.find((h) => h.id === reviewId)?.status === 'submitted' ? (
            <>
              <button className="btn btn-danger" onClick={() => decide.mutate('reject')}>Từ chối</button>
              <button className="btn btn-primary" onClick={() => decide.mutate('approve')}>Phê duyệt</button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => setReviewId(null)}>Đóng</button>
          )
        }
      >
        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2">Nguyên liệu</th>
              <th className="px-3 py-2 text-right">SL</th>
              <th className="px-3 py-2 text-right">Tổng ước tính</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-ink-50 last:border-0">
                <td className="px-3 py-2">{l.ingredient?.name}</td>
                <td className="px-3 py-2 text-right">{l.quantity}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(l.estimated_total_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right font-medium text-ink-700">Tổng</td>
              <td className="px-3 py-2 text-right font-semibold text-brand-700">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>

        {canApprove && headers?.find((h) => h.id === reviewId)?.status === 'submitted' && (
          <Field label="Ghi chú (không bắt buộc)"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        )}

        {log && log.length > 0 && (
          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Nhật ký phê duyệt</p>
            <ul className="space-y-1.5 text-sm text-ink-600">
              {log.map((l) => (
                <li key={l.id} className="flex justify-between">
                  <span><StatusBadge status={l.action} /> {l.comment && `— ${l.comment}`}</span>
                  <span className="text-ink-400">{formatDate(l.acted_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
