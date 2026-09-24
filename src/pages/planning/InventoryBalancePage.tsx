import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useKitchens } from '../../hooks/useLookups'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { Field, Select, TextArea, TextInput } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { formatDate, formatNumber } from '../../lib/utils'
import type { IngredientMaster, InventoryBalance } from '../../types/domain'

export default function InventoryBalancePage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'kitchen_manager', 'purchasing')
  const qc = useQueryClient()
  const { data: kitchens } = useKitchens()
  const [kitchenId, setKitchenId] = useState('')

  const { data: balances, isLoading } = useQuery({
    queryKey: ['inventory_balance', kitchenId],
    queryFn: async () => {
      let q = supabase.from('inventory_balance').select('*, ingredient:ingredient_master(*, uom:uom_master(*))').order('as_of_date', { ascending: false })
      if (kitchenId) q = q.eq('kitchen_id', kitchenId)
      const { data, error } = await q
      if (error) throw error
      return data as InventoryBalance[]
    },
  })

  const { data: ingredients } = useQuery({
    queryKey: ['ingredient_master', 'for-adjustment'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ingredient_master').select('*, uom:uom_master(*)').eq('active', true).order('name')
      if (error) throw error
      return data as IngredientMaster[]
    },
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ kitchen_id: '', ingredient_id: '', qty: 0, notes: '' })

  const adjust = useMutation({
    mutationFn: async () => {
      const ing = ingredients?.find((i) => i.id === form.ingredient_id)
      if (!ing) throw new Error('Vui lòng chọn nguyên liệu')
      const { error } = await supabase.from('inventory_transaction').insert({
        kitchen_id: form.kitchen_id,
        ingredient_id: form.ingredient_id,
        txn_type: 'adjustment',
        qty: form.qty,
        uom_id: ing.uom_id,
        ref_type: 'manual_adjustment',
        txn_date: new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã ghi nhận điều chỉnh tồn kho')
      setModalOpen(false)
      setForm({ kitchen_id: '', ingredient_id: '', qty: 0, notes: '' })
      qc.invalidateQueries({ queryKey: ['inventory_balance'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Điều chỉnh thất bại'),
  })

  const columns: Column<InventoryBalance>[] = [
    { key: 'ingredient', header: 'Nguyên liệu', render: (r) => r.ingredient?.name ?? '—' },
    { key: 'on_hand_qty', header: 'Tồn kho', align: 'right', render: (r) => formatNumber(r.on_hand_qty) },
    { key: 'uom', header: 'ĐVT', render: (r) => r.ingredient?.uom?.code ?? '—' },
    {
      key: 'min_stock',
      header: 'Tồn tối thiểu',
      render: (r) => {
        const min = r.ingredient?.min_stock_qty ?? 0
        const low = Number(r.on_hand_qty) < min
        return <Badge tone={low ? 'red' : 'green'}>{low ? 'Dưới định mức' : 'Đủ'}</Badge>
      },
    },
    { key: 'as_of_date', header: 'Tính đến', render: (r) => formatDate(r.as_of_date) },
  ]

  return (
    <div>
      <PageHeader
        title="Tồn kho"
        description="Tồn kho hiện tại theo từng bếp — tự động đối chiếu từ phiếu nhập, tiêu hao và điều chỉnh thủ công."
        actions={canWrite && <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Stock Adjustment</button>}
      />

      <div className="mb-4 max-w-xs">
        <Field label="Lọc theo bếp">
          <Select value={kitchenId} onChange={(e) => setKitchenId(e.target.value)}>
            <option value="">Tất cả các bếp</option>
            {kitchens?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
      </div>

      <DataTable columns={columns} rows={balances ?? []} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Điều chỉnh tồn kho thủ công"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Huỷ</button>
          <button className="btn btn-primary" onClick={() => adjust.mutate()}>Ghi nhận điều chỉnh</button>
        </>}
      >
        <Field label="Bếp" required>
          <Select value={form.kitchen_id} onChange={(e) => setForm({ ...form, kitchen_id: e.target.value })}>
            <option value="">— Chọn —</option>
            {kitchens?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </Field>
        <Field label="Nguyên liệu" required>
          <Select value={form.ingredient_id} onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}>
            <option value="">— Chọn —</option>
            {ingredients?.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.uom?.code})</option>)}
          </Select>
        </Field>
        <Field label="Số lượng (+ để nhập thêm, − để trừ kho)" required>
          <TextInput type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
        </Field>
        <Field label="Ghi chú"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Lý do điều chỉnh (vd: kiểm kê thực tế, hao hụt)" /></Field>
      </Modal>
    </div>
  )
}
