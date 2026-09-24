import { useState } from 'react'
import { useCrud } from '../../hooks/useCrud'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Checkbox } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import type { KitchenMaster } from '../../types/domain'

const empty: Partial<KitchenMaster> = { code: '', name: '', address: '', city: '', capacity_meals: 0, active: true }

export default function KitchenMasterPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin')
  const { list, create, update, remove } = useCrud<KitchenMaster>('kitchen_master')
  const [modal, setModal] = useState<{ open: boolean; row?: KitchenMaster }>({ open: false })
  const [form, setForm] = useState<Partial<KitchenMaster>>(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() {
    setForm(empty)
    setModal({ open: true })
  }
  function openEdit(row: KitchenMaster) {
    setForm(row)
    setModal({ open: true, row })
  }

  async function onSave() {
    if (modal.row) await update.mutateAsync({ id: modal.row.id, payload: form })
    else await create.mutateAsync(form)
    setModal({ open: false })
  }

  const columns: Column<KitchenMaster>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span className="font-medium text-ink-900">{r.code}</span> },
    { key: 'name', header: 'Tên bếp', render: (r) => r.name },
    { key: 'city', header: 'Thành phố', render: (r) => r.city ?? '—' },
    { key: 'capacity_meals', header: 'Công suất (suất/ngày)', align: 'right', render: (r) => r.capacity_meals?.toLocaleString() ?? '—' },
    { key: 'active', header: 'Trạng thái', render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Danh mục bếp"
        description="Các bếp sản xuất / đơn vị nấu-giao do ME Kitchen vận hành."
        actions={canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Thêm bếp</button>}
      />
      <DataTable
        columns={columns}
        rows={list.data ?? []}
        loading={list.isLoading}
        searchable
        searchKeys={['code', 'name', 'city']}
        actions={
          canWrite
            ? (row) => (
                <>
                  <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(row)}>Sửa</button>
                  <button className="btn btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => setDeleteId(row.id)}>Xoá</button>
                </>
              )
            : undefined
        }
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.row ? 'Sửa bếp' : 'Bếp mới'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal({ open: false })}>Huỷ</button>
            <button className="btn btn-primary" onClick={onSave}>Lưu</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã" required>
            <TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Tên" required>
            <TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Thành phố">
            <TextInput value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Công suất (suất/ngày)">
            <TextInput type="number" value={form.capacity_meals ?? 0} onChange={(e) => setForm({ ...form, capacity_meals: Number(e.target.value) })} />
          </Field>
          <div className="col-span-2">
            <Field label="Địa chỉ">
              <TextInput value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <Checkbox label="Đang hoạt động" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await remove.mutateAsync(deleteId)
          setDeleteId(null)
        }}
        title="Xoá bếp"
        message="Thao tác này sẽ xoá vĩnh viễn bếp này. Các giao dịch liên quan có thể bị lỗi khi tải."
        confirmLabel="Xoá"
        danger
      />
    </div>
  )
}
