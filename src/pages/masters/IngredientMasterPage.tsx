import { useState } from 'react'
import { useCrud } from '../../hooks/useCrud'
import { useIngredientCategories, useSuppliers, useUoms } from '../../hooks/useLookups'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, Checkbox } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency } from '../../lib/utils'
import type { IngredientMaster } from '../../types/domain'

const SELECT = '*, category:ingredient_category(*), uom:uom_master(*)'

const empty: Partial<IngredientMaster> = {
  code: '', name: '', category_id: null, uom_id: '', standard_cost: 0,
  storage_type: 'dry', default_supplier_id: null, min_stock_qty: 0, active: true,
}

export default function IngredientMasterPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'planner')
  const { list, create, update, remove } = useCrud<IngredientMaster>('ingredient_master', SELECT, 'name', true)
  const { data: categories } = useIngredientCategories()
  const { data: uoms } = useUoms()
  const { data: suppliers } = useSuppliers()
  const [modal, setModal] = useState<{ open: boolean; row?: IngredientMaster }>({ open: false })
  const [form, setForm] = useState<Partial<IngredientMaster>>(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() { setForm(empty); setModal({ open: true }) }
  function openEdit(row: IngredientMaster) { setForm(row); setModal({ open: true, row }) }

  async function onSave() {
    const payload = { ...form }
    delete (payload as any).category
    delete (payload as any).uom
    if (modal.row) await update.mutateAsync({ id: modal.row.id, payload })
    else await create.mutateAsync(payload)
    setModal({ open: false })
  }

  const columns: Column<IngredientMaster>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span className="font-medium text-ink-900">{r.code}</span> },
    { key: 'name', header: 'Nguyên liệu', render: (r) => r.name },
    { key: 'category', header: 'Danh mục', render: (r) => r.category?.name ?? '—' },
    { key: 'uom', header: 'ĐVT', render: (r) => r.uom?.code ?? '—' },
    { key: 'standard_cost', header: 'Chi phí định mức', align: 'right', render: (r) => formatCurrency(r.standard_cost) },
    { key: 'last_purchase_cost', header: 'Giá mua gần nhất', align: 'right', render: (r) => formatCurrency(r.last_purchase_cost) },
    { key: 'storage_type', header: 'Bảo quản', render: (r) => <Badge tone="blue">{r.storage_type}</Badge> },
    { key: 'active', header: 'Trạng thái', render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Danh mục nguyên liệu"
        description="Danh mục nguyên liệu thô kèm chi phí định mức, đơn vị tính và nhà cung cấp mặc định."
        actions={canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Thêm nguyên liệu</button>}
      />
      <DataTable
        columns={columns}
        rows={list.data ?? []}
        loading={list.isLoading}
        searchable
        searchKeys={['code', 'name']}
        actions={canWrite ? (row) => (
          <>
            <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(row)}>Sửa</button>
            <button className="btn btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleteId(row.id)}>Xoá</button>
          </>
        ) : undefined}
      />
      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.row ? 'Sửa nguyên liệu' : 'Nguyên liệu mới'}
        width="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal({ open: false })}>Huỷ</button>
          <button className="btn btn-primary" onClick={onSave}>Lưu</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã" required><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tên" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Danh mục">
            <Select value={form.category_id ?? ''} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}>
              <option value="">— Không có —</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Đơn vị tính" required>
            <Select value={form.uom_id ?? ''} onChange={(e) => setForm({ ...form, uom_id: e.target.value })}>
              <option value="">— Chọn —</option>
              {uoms?.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </Select>
          </Field>
          <Field label="Chi phí định mức (VNĐ)"><TextInput type="number" value={form.standard_cost ?? 0} onChange={(e) => setForm({ ...form, standard_cost: Number(e.target.value) })} /></Field>
          <Field label="Cách bảo quản">
            <Select value={form.storage_type ?? 'dry'} onChange={(e) => setForm({ ...form, storage_type: e.target.value as any })}>
              <option value="dry">Khô</option>
              <option value="chilled">Mát</option>
              <option value="frozen">Đông lạnh</option>
              <option value="other">Khác</option>
            </Select>
          </Field>
          <Field label="Nhà cung cấp mặc định">
            <Select value={form.default_supplier_id ?? ''} onChange={(e) => setForm({ ...form, default_supplier_id: e.target.value || null })}>
              <option value="">— Không có —</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="SL tồn tối thiểu"><TextInput type="number" value={form.min_stock_qty ?? 0} onChange={(e) => setForm({ ...form, min_stock_qty: Number(e.target.value) })} /></Field>
          <Field label="Hạn sử dụng (ngày)"><TextInput type="number" value={form.shelf_life_days ?? ''} onChange={(e) => setForm({ ...form, shelf_life_days: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Checkbox label="Đang hoạt động" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId); setDeleteId(null) }}
        title="Xoá nguyên liệu"
        message="Thao tác này sẽ xoá vĩnh viễn nguyên liệu. Các công thức đang dùng nguyên liệu này có thể bị lỗi khi tải."
        confirmLabel="Xoá"
        danger
      />
    </div>
  )
}
