import { useMemo, useState } from 'react'
import { cx } from '../../lib/utils'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyLabel = 'Không có dữ liệu.',
  searchable,
  searchKeys,
  actions,
  onRowClick,
}: {
  columns: Column<T>[]
  rows: T[]
  loading?: boolean
  emptyLabel?: string
  searchable?: boolean
  searchKeys?: (keyof T)[]
  actions?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (!searchable || !q.trim()) return rows
    const needle = q.trim().toLowerCase()
    return rows.filter((r) =>
      (searchKeys ?? (Object.keys(r) as (keyof T)[])).some((k) => String(r[k] ?? '').toLowerCase().includes(needle))
    )
  }, [rows, q, searchable, searchKeys])

  return (
    <div className="card overflow-hidden">
      {searchable && (
        <div className="border-b border-ink-100 p-3">
          <input
            className="input max-w-xs"
            placeholder="Tìm kiếm…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              {columns.map((c) => (
                <th key={c.key} className={cx('whitespace-nowrap px-4 py-2.5', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')} style={{ width: c.width }}>
                  {c.header}
                </th>
              ))}
              {actions && <th className="px-4 py-2.5 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-ink-400">
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-10 text-center text-ink-400">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className={cx('border-b border-ink-50 last:border-0 hover:bg-ink-50/60', onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cx('px-4 py-2.5 text-ink-700', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                      {c.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
