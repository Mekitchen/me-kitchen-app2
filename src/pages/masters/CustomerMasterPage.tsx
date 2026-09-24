import { useState } from 'react'
import { useCrud } from '../../hooks/useCrud'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Checkbox } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import type { CustomerMaster } from '../../types/domain'

const empty: Partial<CustomerMaster> = { code: '', name: '', contract_type: '', contact_person: '', contact_phone: '', contact_email: '', active: true }

export default function CustomerMasterPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin')
  const { list, create, update, remove } = useCrud<CustomerMaster>('customer_master')
  const [modal, setModal] = useState<{ open: boolean; row?: CustomerMaster }>({ open: false })
  const [form, setForm] = useState<Partial<CustomerMaster>>(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() { setForm(empty); setModal({ open: true }) }
  function openEdit(row: CustomerMaster) { setForm(row); setModal({ open: true, row }) }

  async function onSave() {
    if (modal.row) await update.mutateAsync({ id: modal.row.id, payload: form })
    else await create.mutateAsync(form)
    setModal({ open: false })
  }

  const columns: Column<CustomerMaster>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span className="font-medium text-ink-900">{r.code}</span> },
    { key: 'name', header: 'Khách hàng', render: (r) => r.name },
    { key: 'contract_type', header: 'Loại hợp đồng', render: (r) => r.contract_type ?? '—' },
    { key: 'contact_person', header: 'Liên hệ', render: (r) => r.contact_person ?? '—' },
    { key: 'contact_phone', header: 'Điện thoại', render: (r) => r.contact_phone ?? '—' },
    { key: 'active', header: 'Trạng thái', render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Danh mục khách hàng"
        description="Các khách hàng doanh nghiệp mà ME Kitchen cung cấp suất ăn."
        actions={canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Thêm khách hàng</button>}
      />
      <DataTable
        columns={columns}
        rows={list.data ?? []}
        loading={list.isLoading}
        searchable
        searchKeys={['code', 'name', 'contact_person']}
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
        title={modal.row ? 'Sửa khách hàng' : 'Khách hàng mới'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal({ open: false })}>Huỷ</button>
          <button className="btn btn-primary" onClick={onSave}>Lưu</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã" required><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tên" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Loại hợp đồng"><TextInput value={form.contract_type ?? ''} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} /></Field>
          <Field label="Người liên hệ"><TextInput value={form.contact_person ?? ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
          <Field label="Điện thoại"><TextInput value={form.contact_phone ?? ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
          <Field label="Email"><TextInput value={form.contact_email ?? ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
          <Checkbox label="Đang hoạt động" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId); setDeleteId(null) }}
        title="Xoá khách hàng"
        message="Thao tác này sẽ xoá vĩnh viễn khách hàng này."
        confirmLabel="Xoá"
        danger
      />
    </div>
  )
}
