import { cx } from '../../lib/utils'

export function StatCard({
  label,
  value,
  sublabel,
  tone = 'default',
  icon,
}: {
  label: string
  value: string
  sublabel?: string
  tone?: 'default' | 'warn' | 'good' | 'bad'
  icon?: React.ReactNode
}) {
  const toneClass = {
    default: 'text-ink-900',
    warn: 'text-amber-600',
    good: 'text-emerald-600',
    bad: 'text-red-600',
  }[tone]

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <span className="text-ink-300">{icon}</span>}
      </div>
      <p className={cx('mt-2 text-2xl font-semibold', toneClass)}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-ink-400">{sublabel}</p>}
    </div>
  )
}
