import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LungIcon } from '@/components/ui/lung-icon'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export function ForgotPassword() {
  const [email, setEmail]   = useState('')
  const [msg, setMsg]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMsg('')
    setLoading(true)
    try {
      const res = await api.forgotPassword(email) as { detail: string }
      setMsg(res.detail)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(79,142,247,0.06) 0%, transparent 60%), #060c1a' }}>
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-sky to-jade flex items-center justify-center shadow-lg">
            <LungIcon size={20} className="text-white" />
          </div>
          <span className="text-[22px] font-bold text-ink">МедСкан АІ</span>
        </div>

        <div className="bg-surface border border-line rounded-xl shadow-modal p-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Забули пароль?</h1>
          <p className="text-sm text-ink-muted mb-7">
            Введіть свій email — надішлемо посилання для відновлення.
          </p>

          {error && <Alert variant="error" className="mb-5">{error}</Alert>}
          {msg   && <Alert variant="success" className="mb-5">{msg}</Alert>}

          {!msg && (
            <form onSubmit={submit} className="space-y-4">
              <FormGroup className="mb-0">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </FormGroup>
              <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
                Надіслати посилання
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-ink-muted mt-5">
          <Link to="/login" className="text-sky hover:text-sky-dark transition-colors font-medium">
            ← Повернутись до входу
          </Link>
        </p>
      </div>
    </div>
  )
}
