import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Zap, CheckCircle, Clock, Star } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/spinner'
import { fmtDate } from '@/lib/utils'
import type { Case } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Очікує', OPEN: 'В роботі', IN_PROGRESS: 'В роботі', COMPLETED: 'Завершено', CLOSED: 'Завершено',
}
const STATUS_VARIANT: Record<string, 'yellow' | 'green' | 'gray'> = {
  PENDING: 'gray', OPEN: 'yellow', IN_PROGRESS: 'yellow', COMPLETED: 'green', CLOSED: 'green',
}

function StatCard({ label, value, color, icon: Icon }:
  { label: string; value: number; color: string; icon: React.ElementType }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-[11px] text-ink-muted font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
      </div>
    </Card>
  )
}

// ─── Review Prompt ────────────────────────────────────────────────────────────
type PendingReview = { case_id: number; case_title: string; radiologist_id: number; radiologist_name: string }

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-2 my-3">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110 focus:outline-none">
          <svg width="36" height="36" viewBox="0 0 24 24"
            fill={(hover || value) >= i ? '#f59e0b' : 'none'}
            stroke={(hover || value) >= i ? '#f59e0b' : '#374151'} strokeWidth="1.5">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function ReviewPromptModal({ items, onDone }: { items: PendingReview[]; onDone: () => void }) {
  const qc = useQueryClient()
  const [step, setStep]       = useState(0)
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  const current = items[step]
  const isLast  = step === items.length - 1

  function skipForever(caseId: number) {
    const key = 'skipped_reviews'
    const existing: number[] = JSON.parse(localStorage.getItem(key) || '[]')
    if (!existing.includes(caseId)) {
      localStorage.setItem(key, JSON.stringify([...existing, caseId]))
    }
  }

  function next(skipped = false) {
    if (skipped) skipForever(current.case_id)
    setRating(0); setComment(''); setErr('')
    if (isLast) { qc.invalidateQueries({ queryKey: ['pending-reviews'] }); onDone() }
    else setStep(s => s + 1)
  }

  async function submit() {
    if (!rating) { setErr('Будь ласка, поставте оцінку'); return }
    setLoading(true); setErr('')
    try {
      await api.submitReview(current.case_id, current.radiologist_id, rating, comment || undefined)
      next(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Помилка'
      if (msg.includes('вже залишено')) next(false)
      else setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-[420px] bg-surface border border-line rounded-xl shadow-modal animate-scale-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-line">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-ink">Як пройшло лікування?</h2>
            <span className="text-[11px] text-ink-muted bg-panel-100 border border-line px-2 py-0.5 rounded-full">
              {step + 1} / {items.length}
            </span>
          </div>
          <p className="text-[13px] text-ink-muted">
            Ваш відгук допомагає покращити якість обслуговування
          </p>
        </div>

        <div className="p-6">
          {/* Progress dots */}
          {items.length > 1 && (
            <div className="flex gap-1.5 mb-5">
              {items.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-sky' : 'bg-panel-100'}`} />
              ))}
            </div>
          )}

          {/* Case + doctor info */}
          <div className="bg-panel-50 border border-line rounded-[10px] p-4 mb-5">
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-1">Справа</p>
            <p className="text-[14px] font-semibold text-ink mb-3">{current.case_title}</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky to-jade flex items-center justify-center text-white text-[10px] font-bold">
                {current.radiologist_name.split(' ').map(w => w[0]).join('')}
              </div>
              <div>
                <p className="text-[11px] text-ink-muted">Рентгенолог</p>
                <p className="text-[13px] font-medium text-ink">{current.radiologist_name}</p>
              </div>
            </div>
          </div>

          {/* Stars */}
          <p className="text-[13px] font-medium text-ink mb-1">Оцініть роботу рентгенолога</p>
          <StarPicker value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="text-[12px] text-ink-muted mb-3">
              {['','Погано','Задовільно','Добре','Дуже добре','Відмінно'][rating]}
            </p>
          )}

          {/* Comment */}
          <FormGroup className="mb-0">
            <Label>Коментар (необов'язково)</Label>
            <Input value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Що сподобалось або що можна покращити..." />
          </FormGroup>

          {err && <Alert variant="error" className="mt-3">{err}</Alert>}

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <Button variant="secondary" className="flex-1" onClick={() => next(true)}>
              Пропустити
            </Button>
            <Button className="flex-1" loading={loading} onClick={submit}>
              {isLast ? 'Завершити' : 'Далі'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function Dashboard() {
  const navigate  = useNavigate()
  const { user, role } = useAuth()
  const [reviewsDismissed, setReviewsDismissed] = useState(false)

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['cases', role],
    queryFn: () => {
      if (role === 'PATIENT')       return api.getMyCases()
      if (role === 'RADIOLOGIST')   return api.getRadiologistCases()
      if (role === 'FAMILY_DOCTOR') return api.getDoctorCases()
      return api.getCases()
    },
  })

  const { data: pendingReviewsRaw = [] } = useQuery<PendingReview[]>({
    queryKey: ['pending-reviews'],
    queryFn:  api.getPendingReviews,
    enabled:  role === 'PATIENT',
    staleTime: 60_000,
  })
  const pendingReviews = pendingReviewsRaw.filter(r => {
    const skipped: number[] = JSON.parse(localStorage.getItem('skipped_reviews') || '[]')
    return !skipped.includes(r.case_id)
  })

  const active    = cases.filter((c: Case) => c.status === 'OPEN' || c.status === 'IN_PROGRESS' || c.status === 'PENDING').length
  const urgent    = cases.filter((c: Case) => c.urgency === 'URGENT' && c.status !== 'COMPLETED' && c.status !== 'CLOSED').length
  const completed = cases.filter((c: Case) => c.status === 'COMPLETED' || c.status === 'CLOSED').length

  const showReviewPrompt = role === 'PATIENT' && !reviewsDismissed && pendingReviews.length > 0

  return (
    <div>
      {showReviewPrompt && (
        <ReviewPromptModal items={pendingReviews} onDone={() => setReviewsDismissed(true)} />
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">
          Вітаємо, {user?.first_name}
        </h1>
        <p className="text-ink-muted mt-1">
          {new Date().toLocaleDateString('uk', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Всього справ" value={cases.length} color="bg-sky-dark"  icon={FolderOpen} />
        <StatCard label="В роботі"     value={active}       color="bg-amber"    icon={Clock} />
        <StatCard label="Терміново"    value={urgent}       color="bg-rose"     icon={Zap} />
        <StatCard label="Завершені"    value={completed}    color="bg-jade-dark" icon={CheckCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Останні справи</CardTitle>
          <Button variant="secondary" size="sm" onClick={() => navigate('/cases')}>
            Всі справи
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? <PageLoader /> : cases.length === 0 ? (
            <div className="text-center py-12 text-ink-muted">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-ink">Справ поки немає</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">#</th>
                  <th className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">Назва</th>
                  <th className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">Статус</th>
                  <th className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">Дата</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 6).map((c: Case) => (
                  <tr key={c.id}
                    className="border-b border-line/50 hover:bg-panel-50/50 cursor-pointer transition-colors last:border-0"
                    onClick={() => navigate(`/cases/${c.id}`)}>
                    <td className="py-3 px-1 text-[13px] text-ink-muted">#{c.id}</td>
                    <td className="py-3 px-1 text-[13px] font-medium text-ink max-w-[240px] truncate">{c.title}</td>
                    <td className="py-3 px-1">
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'gray'}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-1 text-[13px] text-ink-muted">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
