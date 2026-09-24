import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { Field, Select } from '../../components/ui/FormField'
import { StatusBadge } from '../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../lib/utils'
import type { IngredientMaster, PurchaseOrderHeader, PurchaseRequestDetail, PurchaseRequestHeader, SupplierMaster } from '../../types/domain'

type ApprovedPR = PurchaseRequestHeader & { kitchen?: { name: string } }
type Line = PurchaseRequestDetail & { ingredient?: IngredientMaster; supplier?: SupplierMaster }

export default function PurchaseOrderPage() {
  const { hasRole, profile } = useAuth()
  const canWrite = hasRole('admin', 'purchasing')
  const qc = useQueryClient()

  const { data: approvedPRs } = useQuery({
    queryKey: ['purchase_request_header', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_request_header').select('*, kitchen:kitchen_master(name)').in('status', ['approved', 'purchasing']).order('approved_at', { ascending: false })
      if (error) throw error
      return data as ApprovedPR[]
    },
  })

  const [prId, setPrId] = useState('')

  const { data: lines } = useQuery({
    queryKey: ['purchase_request_detail', 'for-po', prId],
    enabled: !!prId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_request_detail')
        .select('*, ingredient:ingredient_master(*, uom:uom_master(*)), supplier:supplier_master(*)')
        .eq('pr_header_id', prId)
      if (error) throw error
      return data as Line[]
    },
  })

  const bySupplier = useMemo(() => {
    const map = new Map<string, { supplier?: SupplierMaster; lines: Line[] }>()
    for (const l of lines ?? []) {
      const key = l.supplier_id ?? 'unassigned'
      if (!map.has(key)) map.set(key, { supplier: l.supplier, lines: [] })
      map.get(key)!.lines.push(l)
    }
    return Array.from(map.entries())
  }, [lines])

  const createPO = useMutation({
    mutationFn: async ({ supplierId, group }: { supplierId: string; group: Line[] }) => {
      if (supplierId === 'unassigned') throw new Error('Vui lòng gán nhà cung cấp cho các nguyên liệu này trước (trong Danh mục nguyên liệu).')
      const { data: poNo, error: noErr } = await supabase.rpc('next_document_no', { prefix: 'PO' })
      if (noErr) throw noErr
      const { data: po, error } = await supabase
        .from('purchase_order_header')
        .insert({ po_no: poNo, pr_header_id: prId, supplier_id: supplierId, created_by: profile?.id })
        .select()
        .single()
      if (error) throw error
      const detailRows = group.map((l) => ({
        po_header_id: po.id,
        ingredient_id: l.ingredient_id,
        quantity: l.quantity,
        uom_id: l.uom_id,
        unit_cost: l.estimated_unit_cost,
      }))
      const { error: dErr } = await supabase.from('purchase_order_detail').insert(detailRows)
      if (dErr) throw dErr
      await supabase.from('purchase_request_header').update({ status: 'purchasing' }).eq('id', prId)
    },
    onSuccess: () => {
      toast.success('Đã tạo đơn mua hàng')
      qc.invalidateQueries({ queryKey: ['purchase_order_header'] })
      qc.invalidateQueries({ queryKey: ['purchase_request_header'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Tạo đơn mua hàng thất bại'),
  })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase_order_header'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_order_header').select('*, supplier:supplier_master(*)').order('created_at', { ascending: false })
      if (error) throw error
      return data as (PurchaseOrderHeader & { supplier?: SupplierMaster })[]
    },
  })

  const columns: Column<PurchaseOrderHeader & { supplier?: SupplierMaster }>[] = [
    { key: 'po_no', header: 'Số đơn mua', render: (r) => <span className="font-medium text-ink-900">{r.po_no}</span> },
    { key: 'supplier', header: 'Nhà cung cấp', render: (r) => r.supplier?.name ?? '—' },
    { key: 'order_date', header: 'Ngày đặt hàng', render: (r) => formatDate(r.order_date) },
    { key: 'expected_date', header: 'Dự kiến', render: (r) => formatDate(r.expected_date) },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader title="Mua hàng" description="Chuyển yêu cầu mua hàng đã duyệt thành đơn đặt hàng với nhà cung cấp." />

      {canWrite && (
        <div className="mb-6 card p-4">
          <Field label="Yêu cầu mua hàng đã duyệt">
            <Select value={prId} onChange={(e) => setPrId(e.target.value)}>
              <option value="">— Chọn yêu cầu mua đã duyệt —</option>
              {approvedPRs?.map((p) => <option key={p.id} value={p.id}>{p.pr_no} — {p.kitchen?.name}</option>)}
            </Select>
          </Field>

          {prId && bySupplier.map(([supplierId, group]) => (
            <div key={supplierId} className="mt-4 rounded-md border border-ink-100">
              <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-3 py-2">
                <p className="text-sm font-medium text-ink-900">{group.supplier?.name ?? 'Chưa gán nhà cung cấp'}</p>
                <button className="btn btn-primary !py-1 !px-3 text-xs" onClick={() => createPO.mutate({ supplierId, group: group.lines })}>
                  Tạo đơn mua cho nhà cung cấp này
                </button>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {group.lines.map((l) => (
                    <tr key={l.id} className="border-b border-ink-50 last:border-0">
                      <td className="px-3 py-2">{l.ingredient?.name}</td>
                      <td className="px-3 py-2 text-right">{l.quantity} {l.ingredient?.uom?.code}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(l.estimated_total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-ink-900">Đơn mua hàng</h3>
      <DataTable columns={columns} rows={orders ?? []} loading={isLoading} searchable searchKeys={['po_no']} />
    </div>
  )
}
