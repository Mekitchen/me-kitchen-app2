import { cx } from '../../lib/utils'

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'purple'

const toneClasses: Record<Tone, string> = {
  gray: 'bg-ink-100 text-ink-600',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
}

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cx('badge', toneClasses[tone])}>{children}</span>
}

const statusTone: Record<string, Tone> = {
  active: 'green',
  draft: 'gray',
  archived: 'gray',
  confirmed: 'blue',
  locked: 'purple',
  computed: 'blue',
  released: 'green',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
  purchasing: 'purple',
  completed: 'green',
  open: 'blue',
  partially_received: 'amber',
  received: 'green',
  closed: 'gray',
  cancelled: 'red',
  posted: 'green',
}

const statusLabel: Record<string, string> = {
  active: 'Đang áp dụng',
  draft: 'Nháp',
  archived: 'Lưu trữ',
  confirmed: 'Đã xác nhận',
  locked: 'Đã khoá',
  computed: 'Đã tính toán',
  released: 'Đã phát hành',
  submitted: 'Đã gửi',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  purchasing: 'Đang mua hàng',
  completed: 'Hoàn tất',
  open: 'Đang mở',
  partially_received: 'Nhận một phần',
  received: 'Đã nhận',
  closed: 'Đã đóng',
  cancelled: 'Đã huỷ',
  posted: 'Đã ghi nhận',
  submit: 'Gửi',
  approve: 'Duyệt',
  reject: 'Từ chối',
  return: 'Trả lại',
  insert: 'Thêm mới',
  update: 'Cập nhật',
  delete: 'Xoá',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'gray'}>{statusLabel[status] ?? status.replace(/_/g, ' ')}</Badge>
}
