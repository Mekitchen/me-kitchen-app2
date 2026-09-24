import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { Field, Select } from '../components/ui/FormField'
import { Badge } from '../components/ui/Badge'
import { formatDate } from '../lib/utils'
import type { AuditLogRow } from '../types/domain'

const TABLES = [
  'ingredient_master', 'dish_master', 'recipe_header', 'menu_plan_header',
  'purchase_requirement', 'purchase_request_header', 'purchase_order_header',
  'goods_receipt_header', 'inventory_balance', 'supplier_master',
]

const actionTone: Record<string, 'green' | 'blue' | 'red'> = { insert: 'green', update: 'blue', delete: 'red' }
const actionLabel: Record<string, string> = { insert: 'Thêm mới', update: 'Cập nhật', delete: 'Xoá' }

export default function AuditLogPage() {
  const [table, setTable] = useState('')
  const [detail, setDetail] = useState<AuditLogRow | null>(null)

  const { data: rows, isLoading } = useQuery({
    queryKey: ['audit_log', table],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*, changed_by_profile:profiles(full_name)').order('changed_at', { ascending: false }).limit(500)
      if (table) q = q.eq('table_name', table)
      const { data, error } = await q
      if (error) throw error
      return (data as any[]).map((d) => ({ ...d, changed_by_name: d.changed_by_profile?.full_name })) as AuditLogRow[]
    },
  })

  const columns: Column<AuditLogRow>[] = [
    { key: 'changed_at', header: 'Thời gian', render: (r) => formatDate(r.changed_at) },
    { key: 'table_name', header: 'Bảng', render: (r) => <span className="font-mono text-xs">{r.table_name}</span> },
    { key: 'action', header: 'Hành động', render: (r) => <Badge tone={actionTone[r.action]}>{actionLabel[r.action] ?? r.action}</Badge> },
    { key: 'changed_by_name', header: 'Người thay đổi', render: (r) => r.changed_by_name ?? 'Hệ thống' },
  ]

  return (
    <div>
      <PageHeader title="Nhật ký hệ thống" description="Bản ghi không thể sửa đổi cho mọi thao tác thêm, sửa, xoá trên các bảng nghiệp vụ chính." />

      <div className="mb-4 max-w-xs">
        <Field label="Lọc theo bảng">
          <Select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="">Tất cả các bảng</option>
            {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>

      <DataTable columns={columns} rows={rows ?? []} loading={isLoading} onRowClick={(r) => setDetail(r)} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Chi tiết thay đổi" width="lg">
        {detail && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-ink-400">Trước</p>
              <pre className="max-h-96 overflow-auto rounded-md bg-ink-50 p-3 text-xs">{JSON.stringify(detail.old_data, null, 2) ?? '—'}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-ink-400">Sau</p>
              <pre className="max-h-96 overflow-auto rounded-md bg-ink-50 p-3 text-xs">{JSON.stringify(detail.new_data, null, 2) ?? '—'}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
