import { NavLink } from 'react-router-dom'
import { cx } from '../../lib/utils'

interface NavItem {
  to: string
  label: string
  group: string
}

const nav: NavItem[] = [
  { to: '/', label: 'Tổng quan', group: 'Tổng quan' },
  { to: '/ingredients', label: 'Danh mục nguyên liệu', group: 'Dữ liệu nền' },
  { to: '/dishes', label: 'Danh mục món ăn', group: 'Dữ liệu nền' },
  { to: '/kitchens', label: 'Danh mục bếp', group: 'Dữ liệu nền' },
  { to: '/customers', label: 'Danh mục khách hàng', group: 'Dữ liệu nền' },
  { to: '/suppliers', label: 'Danh mục nhà cung cấp', group: 'Dữ liệu nền' },
  { to: '/recipes', label: 'Công thức / BOM', group: 'Công thức' },
  { to: '/recipes/versions', label: 'Phiên bản công thức', group: 'Công thức' },
  { to: '/menu-planning', label: 'Lập thực đơn', group: 'Kế hoạch' },
  { to: '/mrp', label: 'Nhu cầu nguyên vật liệu', group: 'Kế hoạch' },
  { to: '/inventory', label: 'Tồn kho', group: 'Kế hoạch' },
  { to: '/purchase-requirement', label: 'Nhu cầu mua hàng', group: 'Kế hoạch' },
  { to: '/purchase-requests', label: 'Yêu cầu mua hàng', group: 'Thu mua' },
  { to: '/approvals', label: 'Phê duyệt', group: 'Thu mua' },
  { to: '/purchase-orders', label: 'Mua hàng', group: 'Thu mua' },
  { to: '/receiving', label: 'Nhận hàng', group: 'Thu mua' },
  { to: '/food-cost', label: 'Phân tích chi phí món ăn', group: 'Phân tích' },
  { to: '/audit-log', label: 'Nhật ký hệ thống', group: 'Phân tích' },
]

const groups = Array.from(new Set(nav.map((n) => n.group)))

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-ink-100 bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-ink-100 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">ME</div>
          <div>
            <p className="text-sm font-semibold leading-none text-ink-900">ME Kitchen</p>
            <p className="text-[11px] leading-none text-ink-400 mt-0.5">Thực đơn &amp; Thu mua</p>
          </div>
        </div>
        <nav className="h-[calc(100%-3.5rem)] overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{g}</p>
              {nav
                .filter((n) => n.group === g)
                .map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cx(
                        'mb-0.5 flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium',
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                      )
                    }
                  >
                    {n.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
