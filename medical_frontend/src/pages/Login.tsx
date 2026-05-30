import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LungIcon } from '@/components/ui/lung-icon'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { access_token, refresh_token } = await api.login({ email, password })
      localStorage.setItem('access_token', access_token)
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
      const me = await api.getMe()
      setAuth(access_token, me)
      navigate('/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка входу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(79,142,247,0.06) 0%, transparent 60%), #060c1a' }}>
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-sky to-jade flex items-center justify-center shadow-lg">
            <LungIcon size={20} className="text-white" />
          </div>
          <span className="text-[22px] font-bold text-ink">МедСкан АІ</span>
        </div>

        <div className="bg-surface border border-line rounded-xl shadow-modal p-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Вхід</h1>
          <p className="text-sm text-ink-muted mb-7">Введіть свої облікові дані</p>

          {error && <Alert variant="error" className="mb-5">{error}</Alert>}

          <form onSubmit={submit} className="space-y-4">
            <FormGroup>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Пароль</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </FormGroup>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Увійти
            </Button>
            <p className="text-center text-sm text-ink-muted mt-1">
              <Link to="/forgot-password" className="text-sky hover:text-sky-dark transition-colors">
                Забули пароль?
              </Link>
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-ink-muted mt-5">
          Немає акаунту?{' '}
          <Link to="/register" className="text-sky hover:text-sky-dark transition-colors font-medium">
            Зареєструватись
          </Link>
        </p>
      </div>
    </div>
  )
}
