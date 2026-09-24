import { useState } from 'react'
import { useCrud } from '../../hooks/useCrud'
import { useDishCategories, useUoms } from '../../hooks/useLookups'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, TextArea, Select, Checkbox } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency } from '../../lib/utils'
import type { DishMaster } from '../../types/domain'
import { Link } from 'react-router-dom'

const SELECT = '*, category:dish_category(*), portion_uom:uom_master(*)'

const empty: Partial<DishMaster> = {
  code: '', name: '', category_id: null, description: '', portion_size: 1, portion_uom_id: '',
  standard_selling_price: 0, active: true,
}

export default function DishMasterPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'planner')
  const { list, create, update, remove } = useCrud<DishMaster>('dish_master', SELECT, 'name', true)
  const { data: categories } = useDishCategories()
  const { data: uoms } = useUoms()
  const [modal, setModal] = useState<{ open: boolean; row?: DishMaster }>({ open: false })
  const [form, setForm] = useState<Partial<DishMaster>>(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() { setForm(empty); setModal({ open: true }) }
  function openEdit(row: DishMaster) { setForm(row); setModal({ open: true, row }) }

  async function onSave() {
    const payload = { ...form }
    delete (payload as any).category
    delete (payload as any).portion_uom
    if (modal.row) await update.mutateAsync({ id: modal.row.id, payload })
    else await create.mutateAsync(payload)
    setModal({ open: false })
  }

  const columns: Column<DishMaster>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span className="font-medium text-ink-900">{r.code}</span> },
    { key: 'name', header: 'Tên món', render: (r) => <Link to="/recipes" className="hover:text-brand-700 hover:underline">{r.name}</Link> },
    { key: 'category', header: 'Danh mục', render: (r) => r.category?.name ?? '—' },
    { key: 'portion_size', header: 'Khẩu phần', align: 'right', render: (r) => `${r.portion_size} ${r.portion_uom?.code ?? ''}` },
    { key: 'standard_selling_price', header: 'Giá bán', align: 'right', render: (r) => formatCurrency(r.standard_selling_price) },
    { key: 'active', header: 'Trạng thái', render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Danh mục món ăn"
        description="Danh sách món ăn dùng để lập thực đơn. Mỗi món được gắn với một Công thức / BOM."
        actions={canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Thêm món ăn</button>}
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
        title={modal.row ? 'Sửa món ăn' : 'Món ăn mới'}
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
          <Field label="Giá bán (VNĐ)"><TextInput type="number" value={form.standard_selling_price ?? 0} onChange={(e) => setForm({ ...form, standard_selling_price: Number(e.target.value) })} /></Field>
          <Field label="Định lượng khẩu phần"><TextInput type="number" value={form.portion_size ?? 1} onChange={(e) => setForm({ ...form, portion_size: Number(e.target.value) })} /></Field>
          <Field label="ĐVT khẩu phần" required>
            <Select value={form.portion_uom_id ?? ''} onChange={(e) => setForm({ ...form, portion_uom_id: e.target.value })}>
              <option value="">— Chọn —</option>
              {uoms?.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </Select>
          </Field>
          <div className="col-span-2">
            <Field label="Mô tả">
              <TextArea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Checkbox label="Đang hoạt động" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId); setDeleteId(null) }}
        title="Xoá món ăn"
        message="Thao tác này sẽ xoá vĩnh viễn món ăn và toàn bộ các phiên bản công thức liên quan."
        confirmLabel="Xoá"
        danger
      />
    </div>
  )
}
