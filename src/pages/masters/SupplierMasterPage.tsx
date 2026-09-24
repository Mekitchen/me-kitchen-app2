import { useState } from 'react'
import { useCrud } from '../../hooks/useCrud'
import { useAuth } from '../../lib/auth'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Checkbox } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import type { SupplierMaster } from '../../types/domain'

const empty: Partial<SupplierMaster> = { code: '', name: '', tax_code: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', active: true }

export default function SupplierMasterPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole('admin', 'purchasing')
  const { list, create, update, remove } = useCrud<SupplierMaster>('supplier_master')
  const [modal, setModal] = useState<{ open: boolean; row?: SupplierMaster }>({ open: false })
  const [form, setForm] = useState<Partial<SupplierMaster>>(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() { setForm(empty); setModal({ open: true }) }
  function openEdit(row: SupplierMaster) { setForm(row); setModal({ open: true, row }) }

  async function onSave() {
    if (modal.row) await update.mutateAsync({ id: modal.row.id, payload: form })
    else await create.mutateAsync(form)
    setModal({ open: false })
  }

  const columns: Column<SupplierMaster>[] = [
    { key: 'code', header: 'Mã', render: (r) => <span className="font-medium text-ink-900">{r.code}</span> },
    { key: 'name', header: 'Nhà cung cấp', render: (r) => r.name },
    { key: 'contact_person', header: 'Liên hệ', render: (r) => r.contact_person ?? '—' },
    { key: 'phone', header: 'Điện thoại', render: (r) => r.phone ?? '—' },
    { key: 'payment_terms', header: 'Điều khoản', render: (r) => r.payment_terms ?? '—' },
    { key: 'active', header: 'Trạng thái', render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Danh mục nhà cung cấp"
        description="Danh sách nhà cung cấp được duyệt để mua nguyên liệu."
        actions={canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Thêm nhà cung cấp</button>}
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
        title={modal.row ? 'Sửa nhà cung cấp' : 'Nhà cung cấp mới'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal({ open: false })}>Huỷ</button>
          <button className="btn btn-primary" onClick={onSave}>Lưu</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã" required><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tên" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Mã số thuế"><TextInput value={form.tax_code ?? ''} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} /></Field>
          <Field label="Điều khoản thanh toán"><TextInput value={form.payment_terms ?? ''} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></Field>
          <Field label="Người liên hệ"><TextInput value={form.contact_person ?? ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
          <Field label="Điện thoại"><TextInput value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><TextInput value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="col-span-2">
            <Field label="Địa chỉ"><TextInput value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
          <Checkbox label="Đang hoạt động" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId); setDeleteId(null) }}
        title="Xoá nhà cung cấp"
        message="Thao tác này sẽ xoá vĩnh viễn nhà cung cấp này."
        confirmLabel="Xoá"
        danger
      />
    </div>
  )
}
