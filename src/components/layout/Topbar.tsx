import { useState } from 'react'
import { useAuth } from '../../lib/auth'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị viên',
  planner: 'Người lập kế hoạch',
  kitchen_manager: 'Quản lý bếp',
  purchasing: 'Bộ phận mua hàng',
  approver: 'Người phê duyệt',
  viewer: 'Chỉ xem',
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-ink-100 bg-white px-4">
      <button className="rounded p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        ☰
      </button>
      <div className="hidden lg:block" />
      <div className="relative">
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-50" onClick={() => setOpen((o) => !o)}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {(profile?.full_name ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden text-sm font-medium text-ink-700 sm:block">{profile?.full_name ?? 'Người dùng'}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-52 rounded-md border border-ink-100 bg-white py-1 shadow-lg">
            <div className="border-b border-ink-100 px-3 py-2">
              <p className="text-sm font-medium text-ink-800">{profile?.full_name}</p>
              <p className="text-xs text-ink-400">{profile?.role ? ROLE_LABEL[profile.role] ?? profile.role : ''}</p>
            </div>
            <button className="w-full px-3 py-2 text-left text-sm text-ink-600 hover:bg-ink-50" onClick={() => signOut()}>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
