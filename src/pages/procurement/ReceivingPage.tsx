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
import { formatDate, formatNumber } from '../../lib/utils'
import type { GoodsReceiptHeader, IngredientMaster, PurchaseOrderDetail, PurchaseOrderHeader, SupplierMaster } from '../../types/domain'

type OpenPO = PurchaseOrderHeader & { supplier?: SupplierMaster }
type Line = PurchaseOrderDetail & { ingredient?: IngredientMaster; received_qty_input?: number }

export default function ReceivingPage() {
  const { hasRole, profile } = useAuth()
  const canWrite = hasRole('admin', 'purchasing', 'kitchen_manager')
  const qc = useQueryClient()
  const { data: kitchens } = useKitchens()

  const { data: openPOs } = useQuery({
    queryKey: ['purchase_order_header', 'open'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_order_header').select('*, supplier:supplier_master(*)').in('status', ['open', 'partially_received']).order('order_date', { ascending: false })
      if (error) throw error
      return data as OpenPO[]
    },
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [poId, setPoId] = useState('')
  const [kitchenId, setKitchenId] = useState('')
  const [lines, setLines] = useState<Line[]>([])

  const { data: poLines } = useQuery({
    queryKey: ['purchase_order_detail', poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_order_detail').select('*, ingredient:ingredient_master(*, uom:uom_master(*))').eq('po_header_id', poId)
      if (error) throw error
      return data as Line[]
    },
  })

  function selectPO(id: string) {
    setPoId(id)
    setLines([])
  }

  const effectiveLines = lines.length ? lines : (poLines ?? []).map((l) => ({ ...l, received_qty_input: l.quantity }))

  const createGrn = useMutation({
    mutationFn: async () => {
      if (!poId || !kitchenId) throw new Error('Vui lòng chọn đơn mua hàng và bếp nhận hàng')
      const { data: grnNo, error: noErr } = await supabase.rpc('next_document_no', { prefix: 'GRN' })
      if (noErr) throw noErr
      const { data: grn, error } = await supabase
        .from('goods_receipt_header')
        .insert({ grn_no: grnNo, po_header_id: poId, kitchen_id: kitchenId, received_by: profile?.id, status: 'draft' })
        .select()
        .single()
      if (error) throw error
      const rows = effectiveLines.map((l) => ({
        grn_header_id: grn.id,
        ingredient_id: l.ingredient_id,
        po_qty: l.quantity,
        received_qty: l.received_qty_input ?? l.quantity,
        uom_id: l.uom_id,
        unit_cost: l.unit_cost,
      }))
      const { error: dErr } = await supabase.from('goods_receipt_detail').insert(rows)
      if (dErr) throw dErr
      // Post immediately -> triggers inventory_transaction + PO status update
      const { error: postErr } = await supabase.from('goods_receipt_header').update({ status: 'posted' }).eq('id', grn.id)
      if (postErr) throw postErr
    },
    onSuccess: () => {
      toast.success('Đã ghi nhận phiếu nhập — tồn kho đã cập nhật')
      setModalOpen(false)
      setPoId('')
      setLines([])
      qc.invalidateQueries({ queryKey: ['purchase_order_header'] })
      qc.invalidateQueries({ queryKey: ['inventory_balance'] })
      qc.invalidateQueries({ queryKey: ['goods_receipt_header'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Ghi nhận phiếu nhập thất bại'),
  })

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['goods_receipt_header'],
    queryFn: async () => {
      const { data, error } = await supabase.from('goods_receipt_header').select('*, po:purchase_order_header(po_no)').order('received_date', { ascending: false })
      if (error) throw error
      return data as (GoodsReceiptHeader & { po?: { po_no: string } })[]
    },
  })

  const columns: Column<GoodsReceiptHeader & { po?: { po_no: string } }>[] = [
    { key: 'grn_no', header: 'Số phiếu nhập', render: (r) => <span className="font-medium text-ink-900">{r.grn_no}</span> },
    { key: 'po', header: 'Số đơn mua', render: (r) => r.po?.po_no ?? '—' },
    { key: 'received_date', header: 'Đã nhận', render: (r) => formatDate(r.received_date) },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Nhận hàng"
        description="Ghi nhận phiếu nhập kho (GRN) theo đơn mua hàng đang mở. Ghi nhận sẽ cập nhật tồn kho ngay lập tức."
        actions={canWrite && <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Phiếu nhập kho mới</button>}
      />

      <DataTable columns={columns} rows={receipts ?? []} loading={isLoading} searchable searchKeys={['grn_no']} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Phiếu nhập kho mới"
        width="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Huỷ</button>
          <button className="btn btn-primary" onClick={() => createGrn.mutate()} disabled={createGrn.isPending}>
            {createGrn.isPending ? 'Đang ghi nhận…' : 'Ghi nhận phiếu nhập'}
          </button>
        </>}
      >
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field label="Đơn mua hàng" required>
            <Select value={poId} onChange={(e) => selectPO(e.target.value)}>
              <option value="">— Chọn đơn mua đang mở —</option>
              {openPOs?.map((p) => <option key={p.id} value={p.id}>{p.po_no} — {p.supplier?.name}</option>)}
            </Select>
          </Field>
          <Field label="Bếp nhận hàng" required>
            <Select value={kitchenId} onChange={(e) => setKitchenId(e.target.value)}>
              <option value="">— Chọn —</option>
              {kitchens?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
          </Field>
        </div>

        {poId && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2">Nguyên liệu</th>
                <th className="px-3 py-2 text-right">SL đặt hàng</th>
                <th className="px-3 py-2 text-right">SL đã nhận</th>
                <th className="px-3 py-2">ĐVT</th>
              </tr>
            </thead>
            <tbody>
              {effectiveLines.map((l, idx) => (
                <tr key={l.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-3 py-2">{l.ingredient?.name}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(l.quantity)}</td>
                  <td className="px-3 py-2 text-right">
                    <TextInput
                      type="number"
                      className="text-right"
                      value={l.received_qty_input ?? l.quantity}
                      onChange={(e) => {
                        const next = [...effectiveLines]
                        next[idx] = { ...next[idx], received_qty_input: Number(e.target.value) }
                        setLines(next)
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">{l.ingredient?.uom?.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  )
}
