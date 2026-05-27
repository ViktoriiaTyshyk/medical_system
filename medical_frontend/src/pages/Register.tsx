import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LungIcon } from '@/components/ui/lung-icon'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '',
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { access_token, refresh_token } = await api.register(form)
      localStorage.setItem('access_token', access_token)
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
      const me = await api.getMe()
      setAuth(access_token, me)
      navigate('/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка реєстрації')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(79,142,247,0.06) 0%, transparent 60%), #060c1a' }}>
      <div className="w-full max-w-[460px]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-sky to-jade flex items-center justify-center shadow-lg">
            <LungIcon size={20} className="text-white" />
          </div>
          <span className="text-[22px] font-bold text-ink">МедСкан АІ</span>
        </div>

        <div className="bg-surface border border-line rounded-xl shadow-modal p-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Реєстрація</h1>
          <p className="text-sm text-ink-muted mb-7">Створіть акаунт для доступу до системи</p>

          {error && <Alert variant="error" className="mb-5">{error}</Alert>}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormGroup className="mb-0">
                <Label>Ім'я</Label>
                <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
              </FormGroup>
              <FormGroup className="mb-0">
                <Label>Прізвище</Label>
                <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
              </FormGroup>
            </div>

            <FormGroup className="mb-0">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
            </FormGroup>

            <FormGroup className="mb-0">
              <Label>Пароль</Label>
              <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} />
            </FormGroup>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Зареєструватись
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-muted mt-5">
          Вже є акаунт?{' '}
          <Link to="/login" className="text-sky hover:text-sky-dark transition-colors font-medium">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  )
}
