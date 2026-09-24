import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">ME</div>
          <h1 className="text-lg font-semibold text-ink-900">ME Kitchen</h1>
          <p className="text-sm text-ink-500">Hệ thống lập thực đơn &amp; kế hoạch thu mua</p>
        </div>
        <form onSubmit={onSubmit} className="card p-6">
          <div className="mb-3">
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.com" />
          </div>
          <div className="mb-4">
            <label className="label">Mật khẩu</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button className="btn btn-primary w-full" disabled={loading} type="submit">
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-400">
          Tài khoản do quản trị viên cấp qua Supabase Auth.
        </p>
      </div>
    </div>
  )
}
