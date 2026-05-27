import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Bot, FileText, MessageSquare, Files,
  Stethoscope, ClipboardList, Settings, Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup, Textarea } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { PageLoader, Spinner } from '@/components/ui/spinner'
import { Modal } from '@/components/ui/modal'
import { fmtDate, fmtTime, cn } from '@/lib/utils'
import type { Case, CaseFile, Message, Radiologist, ReportTemplate, User } from '@/types'

function FullscreenImage({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in select-none"
      style={{ background: `rgba(0,0,0,${Math.min(0.96, 0.72 + zoom * 0.06)})` }}
      onClick={onClose}
      onWheel={e => { e.preventDefault(); setZoom(z => Math.max(0.5, Math.min(5, z - e.deltaY * 0.002))) }}
    >
      <img
        src={src}
        style={{
          maxWidth: '94vw', maxHeight: '94vh', objectFit: 'contain', borderRadius: 10,
          transform: `scale(${zoom})`, transition: 'transform 0.12s ease',
          cursor: zoom > 1 ? 'zoom-out' : 'zoom-in',
        }}
        onClick={e => { e.stopPropagation(); setZoom(z => z > 1 ? 1 : 2.5) }}
      />
      <button onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-sm transition-colors">
        ✕
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
        колесо миші · зум | клік — 2.5× | Esc — закрити
      </div>
    </div>
  )
}

const STATUS_LABEL:   Record<string, string> = {
  PENDING:'Очікує', OPEN:'В роботі', IN_PROGRESS:'В роботі', COMPLETED:'Завершено', CLOSED:'Завершено',
}
const STATUS_VARIANT: Record<string, 'yellow'|'green'|'gray'> = {
  PENDING:'gray', OPEN:'yellow', IN_PROGRESS:'yellow', COMPLETED:'green', CLOSED:'green',
}

const CLASS_COLORS: Record<string, string> = {
  Atelectasis:'#f97316', Cardiomegaly:'#3b82f6', Effusion:'#06b6d4',
  Pneumothorax:'#ef4444', Infiltration:'#a855f7', 'Mass/Nodule':'#dc2626', Other:'#6b7280',
}

export function CaseDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()
  const qc       = useQueryClient()
  const [tab, setTab] = useState('info')
  const [aiHistory, setAiHistory] = useState<{ role: 'user'|'assistant'; content: string }[]>([])

  const { data: c, isLoading, error } = useQuery<Case>({
    queryKey: ['case', id],
    queryFn:  () => api.getCase(Number(id)),
  })

  if (isLoading) return <PageLoader />
  if (error || !c) return <Alert variant="error">Справу не знайдено</Alert>

  const isClosed = c.status === 'COMPLETED' || c.status === 'CLOSED'

  const tabs = [
    { key: 'info',       label: 'Інформація',    icon: FileText,      show: true },
    { key: 'ai',         label: 'AI-аналіз',     icon: Bot,           show: !!c.ai_result },
    { key: 'chat',       label: 'Чат',            icon: MessageSquare, show: c.status !== 'PENDING' || role === 'ADMIN' },
    { key: 'files',      label: 'Файли',          icon: Files,         show: true },
    { key: 'ai-chat',    label: 'AI-асистент',    icon: Bot,           show: c.status !== 'PENDING' },
    { key: 'conclusion', label: 'Висновок',       icon: Stethoscope,   show: (role === 'RADIOLOGIST' || role === 'ADMIN') && c.status !== 'PENDING' && !isClosed },
    { key: 'treatment',  label: 'Лікування',      icon: ClipboardList, show: (role === 'FAMILY_DOCTOR' || role === 'ADMIN') && !!c.conclusion },
    { key: 'manage',     label: 'Управління',     icon: Settings,      show: role === 'ADMIN' },
  ].filter(t => t.show)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/cases')}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors mb-4">
          <ArrowLeft size={15} /> Назад до справ
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-ink">{c.title}</h1>
          <Badge variant={STATUS_VARIANT[c.status] ?? 'gray'}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
          {c.urgency === 'URGENT' && (
            <Badge variant="red" className="flex items-center gap-1">
              <Zap size={10} /> ТЕРМІНОВО
            </Badge>
          )}
        </div>
        <p className="text-ink-muted text-sm mt-1">Справа #{c.id}</p>
      </div>

      {isClosed && (
        <div className="flex items-center gap-2 text-sm text-amber bg-amber/6 border border-amber/25 border-l-2 border-l-amber rounded-[8px] px-4 py-2.5 mb-5">
          ✓ Справа завершена — редагування недоступне.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-line rounded-[10px] p-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0',
              tab === t.key
                ? 'bg-panel-100 text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-panel-50'
            )}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-slide-up" key={tab}>
        {tab === 'info'       && <InfoTab       c={c} role={role} qc={qc} />}
        {tab === 'ai'         && <AiTab         c={c} />}
        {tab === 'chat'       && <ChatTab       c={c} />}
        {tab === 'files'      && <FilesTab      c={c} qc={qc} />}
        {tab === 'ai-chat'    && <AiChatTab     c={c} history={aiHistory} setHistory={setAiHistory} />}
        {tab === 'conclusion' && <ConclusionTab c={c} qc={qc} />}
        {tab === 'treatment'  && <TreatmentTab  c={c} qc={qc} />}
        {tab === 'manage'     && <ManageTab     c={c} qc={qc} />}
      </div>
    </div>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────
function InfoTab({ c, role, qc }: { c: Case; role: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const isClosed    = c.status === 'COMPLETED' || c.status === 'CLOSED'
  const canActivate = (role === 'FAMILY_DOCTOR' || role === 'ADMIN') && c.status === 'PENDING'
  const canClose    = (role === 'FAMILY_DOCTOR' || role === 'ADMIN') && !isClosed && !!c.therapist_id
  const [msg, setMsg] = useState('')

  async function activate() {
    await api.updateCaseStatus(c.id, 'OPEN')
    qc.invalidateQueries({ queryKey: ['case', String(c.id)] })
    setMsg('Справу активовано')
  }
  async function close() {
    await api.updateCaseStatus(c.id, 'COMPLETED')
    qc.invalidateQueries({ queryKey: ['case', String(c.id)] })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Деталі справи</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[['ID', `#${c.id}`], ['Статус', STATUS_LABEL[c.status] ?? c.status],
              ['Ургентність', c.urgency === 'URGENT' ? 'Терміново' : (c.ai_result?.stage === 'healthy' || !c.ai_result) ? 'Норма' : 'Невизначено'],
              ['Створено', fmtDate(c.created_at)],
              ...(c.closed_at ? [['Закрито', fmtDate(c.closed_at)]] : []),
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-wide mb-1">{l}</p>
                <p className="text-[14px] font-medium text-ink">{v}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-line pt-4">
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">Опис</p>
            <p className="text-[14px] text-ink-muted">{c.description || 'Опис відсутній'}</p>
          </div>
          {c.conclusion && (
            <div className="border-t border-line pt-4 mt-4">
              <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">Висновок рентгенолога</p>
              <p className="text-[13px] text-ink whitespace-pre-wrap">{c.conclusion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {msg && <Alert variant="success">{msg}</Alert>}
        {canActivate && (
          <Card className="border-l-4 border-l-amber">
            <CardContent className="pt-5">
              <p className="font-semibold text-ink mb-2">Справа очікує розгляду</p>
              <p className="text-[13px] text-ink-muted mb-4">
                Пацієнт надіслав рентгенівський знімок через AI-аналіз.
              </p>
              <Button onClick={activate}>Активувати справу</Button>
            </CardContent>
          </Card>
        )}
        {canClose && (
          <Card>
            <CardContent className="pt-5">
              <p className="font-semibold text-ink mb-2">Завершити справу</p>
              <p className="text-[13px] text-ink-muted mb-4">Після завершення редагування буде недоступне.</p>
              <Button variant="secondary" onClick={close}>Позначити як завершену</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110">
          <svg width="28" height="28" viewBox="0 0 24 24" fill={(hover || value) >= i ? '#f59e0b' : 'none'}
            stroke={(hover || value) >= i ? '#f59e0b' : '#4b5563'} strokeWidth="1.5">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function ReviewCard({ caseId }: { caseId: number }) {
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [err, setErr]         = useState('')

  const { data: participants = [] } = useQuery({
    queryKey: ['case-participants', caseId],
    queryFn:  () => api.getCaseParticipants(caseId),
  })
  const { data: participantUsers = [] } = useQuery({
    queryKey: ['case-participant-users', caseId],
    queryFn:  async () => {
      const users = await Promise.all(participants.map(p => api.getUser(p.user_id).catch(() => null)))
      return users.filter(Boolean) as User[]
    },
    enabled: participants.length > 0,
  })
  const radiologist = participantUsers.find(u => u.roles.some(r => r.name === 'RADIOLOGIST'))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) { setErr('Оцініть рентгенолога'); return }
    if (!radiologist) { setErr('Рентгенолог не знайдений'); return }
    setLoading(true); setErr('')
    try {
      await api.submitReview(caseId, radiologist.id, rating, comment || undefined)
      setDone(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Помилка'
      if (msg.includes('вже залишено')) setDone(true)
      else setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="border-l-4 border-l-jade">
        <CardContent className="pt-5">
          <p className="font-semibold text-jade mb-1">Дякуємо за відгук!</p>
          <div className="flex gap-0.5 mt-1">
            {[1,2,3,4,5].map(i => (
              <svg key={i} width="16" height="16" viewBox="0 0 24 24"
                fill={i <= rating ? '#f59e0b' : 'none'} stroke={i <= rating ? '#f59e0b' : '#6b7280'} strokeWidth="1.5">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!radiologist) return null

  return (
    <Card>
      <CardHeader><CardTitle>Оцінити рентгенолога</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <p className="text-[13px] text-ink-muted mb-4">
          {radiologist.first_name} {radiologist.last_name}
        </p>
        {err && <Alert variant="error" className="mb-3">{err}</Alert>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">Оцінка</p>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <FormGroup className="mb-0">
            <Label>Коментар (необов'язково)</Label>
            <Input value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Ваш відгук про роботу рентгенолога..." />
          </FormGroup>
          <Button type="submit" loading={loading} size="sm">Залишити відгук</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────
function AiTab({ c }: { c: Case }) {
  const { role } = useAuth()
  const r = c.ai_result
  const isClosed = c.status === 'COMPLETED' || c.status === 'CLOSED'
  const [fsImg, setFsImg]    = useState<string | null>(null)
  const [origUrl, setOrigUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getCaseFiles(c.id).then(async (files: CaseFile[]) => {
      const imgs = files.filter(f => f.file?.mime_type?.startsWith('image/'))
      const orig = imgs.find(f => !f.file?.name?.startsWith('heatmap_'))
      if (orig) {
        const { blob } = await api.fetchFileBlob(orig.file_id)
        setOrigUrl(URL.createObjectURL(blob))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [c.id])

  if (!r) return <Card><CardContent className="pt-5 text-ink-muted">Немає даних аналізу.</CardContent></Card>

  const binaryPct   = r.binary_abnormal ? Math.round(r.binary_prob * 100) : Math.round((1 - r.binary_prob) * 100)
  const binaryColor = r.binary_abnormal ? 'text-rose' : 'text-jade'

  function renderBars() {
    if (!r?.multiclass) return null
    const sorted = Object.entries(r.multiclass).sort(([,a],[,b]) => b - a)
    return (
      <div className="space-y-2 my-4">
        {sorted.map(([name, prob]) => {
          const pct = Math.round(prob * 100)
          const col = CLASS_COLORS[name] || '#6b7280'
          const label = r.labels?.[name] || name
          return (
            <div key={name}>
              <div className="flex justify-between mb-1">
                <span className="text-[12px] font-medium text-ink">{label}</span>
                <span className="text-[12px] font-bold" style={{ color: col }}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-panel-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Результат AI-аналізу</CardTitle>
          {role === 'PATIENT' && isClosed && (
            <Button size="sm" variant="secondary" onClick={async () => {
              const blob = await api.fetchPdfReport(c.id)
              const url = URL.createObjectURL(blob)
              Object.assign(document.createElement('a'), { href: url, download: `zvit_${c.id}.pdf` }).click()
            }}>
              Завантажити PDF
            </Button>
          )}
          {role === 'PATIENT' && !isClosed && (
            <span className="text-[12px] text-ink-muted">PDF доступний після завершення справи</span>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {/* Binary */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-[8px] bg-panel-50">
            <div>
              <p className={`font-semibold ${binaryColor}`}>
                {r.binary_abnormal ? 'Є відхилення від норми' : 'Патологій не виявлено'}
              </p>
              <p className="text-[12px] text-ink-muted">Впевненість бінарної моделі: {binaryPct}%</p>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            {r.stage === 'healthy' && (
              <Alert variant="success">Патологій не виявлено. Норма {binaryPct}%.</Alert>
            )}
            {r.stage === 'unclassifiable' && (
              <>
                <Alert variant="warning" className="mb-4">
                  Виявлено відхилення від норми, але конкретна патологія не класифікована системою.
                </Alert>
                {renderBars()}
              </>
            )}
            {r.stage === 'classified' && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="red">ТЕРМІНОВО</Badge>
                  <span className="font-semibold text-rose">Виявлено: {r.top_label || r.top_class}</span>
                </div>
                {r.descriptions && r.top_class && (
                  <p className="text-[13px] text-ink-muted mb-4">{r.descriptions[r.top_class]}</p>
                )}
                {renderBars()}
              </>
            )}

            {/* Images side by side */}
            {(loading || origUrl || r.heatmap_base64) && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-3">
                  Зображення ({loading ? '...' : [origUrl && 'Оригінал', r.heatmap_base64 && 'Теплова карта'].filter(Boolean).join(' + ')})
                </p>
                {loading ? <Spinner /> : (
                  <div className="flex gap-4 flex-wrap">
                    {origUrl && (
                      <div className="text-center flex-1 min-w-[130px]">
                        <p className="text-[10px] text-ink-muted mb-2">Оригінал</p>
                        <img src={origUrl} onClick={() => setFsImg(origUrl)}
                          className="rounded-[8px] border border-line cursor-zoom-in hover:border-sky transition-colors max-w-[220px] w-full mx-auto" />
                      </div>
                    )}
                    {r.heatmap_base64 && (
                      <div className="text-center flex-1 min-w-[130px]">
                        <p className="text-[10px] text-ink-muted mb-2">Теплова карта</p>
                        <img src={`data:image/png;base64,${r.heatmap_base64}`}
                          onClick={() => setFsImg(`data:image/png;base64,${r.heatmap_base64}`)}
                          className="rounded-[8px] border border-line cursor-zoom-in hover:border-sky transition-colors max-w-[220px] w-full mx-auto" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {fsImg && <FullscreenImage src={fsImg} onClose={() => setFsImg(null)} />}
    </>
  )
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────
function ChatTab({ c }: { c: Case }) {
  const { user } = useAuth()
  const [msgs, setMsgs]       = useState<Message[]>([])
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(true)
  const [names, setNames]     = useState<Map<number, string>>(new Map())
  const bottomRef = useRef<HTMLDivElement>(null)

  async function resolveNames(messages: Message[]) {
    const ids = [...new Set(messages.map(m => m.sender_user_id).filter(id => !names.has(id)))]
    if (!ids.length) return
    const updated = new Map(names)
    await Promise.all(ids.map(async id => {
      const u = await api.getUser(id).catch(() => null)
      if (u) updated.set(id, `${u.first_name} ${u.last_name}`)
      else    updated.set(id, `#${id}`)
    }))
    setNames(updated)
  }

  async function load() {
    const m = await api.getMessages(c.id).catch(() => [])
    setMsgs(m)
    setLoading(false)
    await resolveNames(m)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t) }, [c.id])

  async function send() {
    if (!text.trim()) return
    const t = text; setText('')
    await api.sendMessage(c.id, { text: t, message_type: 'TEXT' }).catch(() => {})
    load()
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="h-[420px] flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {loading ? <PageLoader /> : msgs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-ink-muted">
                <MessageSquare size={32} className="mr-2 opacity-20" />
                Повідомлень ще немає
              </div>
            ) : msgs.map(m => {
              const mine     = m.sender_user_id === user?.id
              const senderName = mine ? 'Ви' : (names.get(m.sender_user_id) || '...')
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-semibold text-ink-muted mb-1 px-1">
                    {senderName}
                  </span>
                  <div className={cn(
                    'max-w-[78%] px-4 py-2.5 rounded-[12px] text-[13px] leading-relaxed',
                    mine ? 'bg-sky-dark text-white rounded-br-[4px]'
                          : 'bg-panel-100 text-ink border border-line rounded-bl-[4px]'
                  )}>
                    {m.text}
                    <div className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-ink-muted'}`}>
                      {fmtTime(m.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-line">
            <Input value={text} onChange={e => setText(e.target.value)}
              placeholder="Написати повідомлення..."
              onKeyDown={e => { if (e.key === 'Enter') send() }} />
            <Button onClick={send} className="flex-shrink-0">Надіслати</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Files Tab ────────────────────────────────────────────────────────────────
function FilesTab({ c, qc }: { c: Case; qc: ReturnType<typeof useQueryClient> }) {
  const { data: files = [], isLoading } = useQuery<CaseFile[]>({
    queryKey: ['case-files', c.id],
    queryFn:  () => api.getCaseFiles(c.id),
  })
  const [fsUrl, setFsUrl]     = useState<string | null>(null)
  const [alert, setAlert]     = useState('')

  async function viewFile(fileId: number) {
    const { blob } = await api.fetchFileBlob(fileId)
    setFsUrl(URL.createObjectURL(blob))
  }
  async function download(fileId: number, name: string) {
    const { blob } = await api.fetchFileBlob(fileId)
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: name }).click()
    URL.revokeObjectURL(url)
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    await api.uploadCaseFile(c.id, fd).catch(err => setAlert(err.message))
    qc.invalidateQueries({ queryKey: ['case-files', c.id] })
    setAlert('Файл додано!')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Файли справи ({files.length})</CardTitle>
          {c.status !== 'PENDING' && (
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-panel-50 border border-line text-ink hover:bg-panel-100 transition-all">
              + Додати файл
              <input type="file" className="hidden" onChange={upload} />
            </label>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {alert && <Alert variant="success" className="mb-4">{alert}</Alert>}
          {isLoading ? <PageLoader /> : files.length === 0 ? (
            <div className="text-center py-10 text-ink-muted">
              <Files size={32} className="mx-auto mb-2 opacity-20" />
              <p>Файлів немає</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(f => {
                const isImg = f.file?.mime_type?.startsWith('image/')
                const name  = f.file?.name || 'файл'
                const size  = f.file?.size ? `${Math.round(f.file.size / 1024)} KB` : ''
                return (
                  <div key={f.file_id}
                    className="flex items-center justify-between p-3 rounded-[8px] bg-panel-50 border border-line">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[6px] bg-panel-100 flex items-center justify-center text-ink-muted flex-shrink-0">
                        {isImg ? '🖼' : '📄'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate">{name}</p>
                        <p className="text-[11px] text-ink-muted">{size}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {isImg && (
                        <Button size="sm" variant="ghost" onClick={() => viewFile(f.file_id)}>
                          Відкрити
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => download(f.file_id, name)}>
                        Завантажити
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {fsUrl && <FullscreenImage src={fsUrl} onClose={() => setFsUrl(null)} />}
    </>
  )
}

// ─── AI Chat Tab ──────────────────────────────────────────────────────────────
function AiChatTab({ c, history, setHistory }: {
  c: Case
  history: { role: 'user'|'assistant'; content: string }[]
  setHistory: React.Dispatch<React.SetStateAction<{ role: 'user'|'assistant'; content: string }[]>>
}) {
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const ai = c.ai_result
  const urgencyLabel = c.urgency === 'URGENT'
    ? 'ТЕРМІНОВО'
    : (c.ai_result?.stage === 'healthy' || !c.ai_result) ? 'НОРМА' : 'НЕВИЗНАЧЕНО'
  const aiSummary = ai?.stage === 'healthy' ? 'Патологій не виявлено'
    : ai?.stage === 'classified' ? `Виявлено: ${ai.top_label || ai.top_class}`
    : ai?.stage === 'unclassifiable' ? 'Відхилення не класифіковано' : 'Без AI-аналізу'

  async function send() {
    if (!input.trim() || loading) return
    const text = input; setInput(''); setError(''); setLoading(true)
    const snapshot = [...history]
    setHistory(h => [...h, { role: 'user', content: text }])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const { reply } = await api.sendAiMessage(c.id, text, snapshot)
      setHistory(h => [...h, { role: 'assistant', content: reply }])
    } catch (e: unknown) {
      setHistory(h => h.slice(0, -1))
      setError(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-асистент</CardTitle>
        <span className="text-[11px] text-ink-muted bg-panel-100 border border-line px-3 py-1 rounded-full">
          Llama 3.3 · Groq
        </span>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Context chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: `#${c.id}`, color: 'bg-sky/10 text-sky border-sky/20' },
            { label: urgencyLabel, color: c.urgency === 'URGENT' ? 'bg-rose/10 text-rose border-rose/20' : c.ai_result?.stage === 'healthy' || !c.ai_result ? 'bg-jade/10 text-jade border-jade/20' : 'bg-amber/10 text-amber border-amber/20' },
            { label: aiSummary, color: 'bg-panel-100 text-ink-muted border-line' },
            ...(c.conclusion ? [{ label: 'Висновок є', color: 'bg-panel-100 text-ink-muted border-line' }] : []),
          ].map(chip => (
            <span key={chip.label} className={`text-[11px] px-3 py-1 rounded-full border ${chip.color}`}>
              {chip.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col h-[420px]">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {history.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-2">
                <Bot size={32} className="opacity-20" />
                <p className="text-sm">Поставте запитання про цю справу</p>
                <p className="text-[12px] opacity-60">Ctrl+Enter — надіслати</p>
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={cn(
                  'max-w-[80%] px-4 py-3 rounded-[14px] text-[13px] leading-relaxed',
                  m.role === 'user'
                    ? 'bg-sky-dark text-white rounded-br-[4px]'
                    : 'bg-panel-100 border border-line text-ink rounded-bl-[4px]'
                )}>
                  {m.role === 'assistant' && (
                    <p className="text-[10px] font-bold text-ink-muted mb-2 tracking-wide">LLAMA AI</p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-panel-100 border border-line rounded-[14px] rounded-bl-[4px] px-4 py-3">
                  <Spinner className="h-4 w-4" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <Alert variant="error" className="mb-3">{error}</Alert>}

          <div className="flex gap-2 pt-3 border-t border-line">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Запитайте про патологію, тактику, рекомендації..."
              className="min-h-[44px] max-h-[100px] resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); send() } }} />
            <Button onClick={send} loading={loading} className="self-end flex-shrink-0">
              Надіслати
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Conclusion Tab ───────────────────────────────────────────────────────────
function ConclusionTab({ c, qc }: { c: Case; qc: ReturnType<typeof useQueryClient> }) {
  const { data: templates = [] } = useQuery<ReportTemplate[]>({
    queryKey: ['report-templates'],
    queryFn:  api.getReportTemplates,
  })
  const [selectedTpl, setSelectedTpl] = useState('')
  const [customText, setCustomText]   = useState(() => {
    const t = c.conclusion || ''
    return t.replace(/^\[Висновок рентгенолога[^\]]+\]\n\n/, '').trim()
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')

  async function submit() {
    if (!selectedTpl && !customText.trim()) { setErr('Оберіть шаблон або введіть текст'); return }
    setLoading(true); setErr('')
    try {
      await api.submitReport(c.id, { template_key: selectedTpl || null, custom_text: customText || null })
      setMsg('Висновок збережено. Терапевт отримає доступ автоматично, якщо призначений пацієнтом.')
      qc.invalidateQueries({ queryKey: ['case', String(c.id)] })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="">
      <CardHeader><CardTitle>Висновок рентгенолога</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
        {err && <Alert variant="error"   className="mb-4">{err}</Alert>}

        {/* AI context */}
        {c.ai_result && (
          <div className="rounded-[8px] bg-panel-50 border border-line p-4 mb-5">
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">AI-результат для довідки</p>
            <p className="text-[13px] text-ink">
              {c.ai_result.stage === 'healthy' ? `Патологій не виявлено (норма ${Math.round((1 - c.ai_result.binary_prob) * 100)}%)`
                : c.ai_result.stage === 'classified' ? `⚠️ Виявлено: ${c.ai_result.top_label || c.ai_result.top_class} — ${Math.round(c.ai_result.binary_prob * 100)}%`
                : `Відхилення від норми (${Math.round(c.ai_result.binary_prob * 100)}%), патологія не класифікована`}
            </p>
            {c.ai_result.heatmap_base64 && (
              <img src={`data:image/png;base64,${c.ai_result.heatmap_base64}`}
                className="mt-3 rounded-[6px] border border-line max-w-[180px]" />
            )}
          </div>
        )}

        {/* Templates */}
        {templates.length > 0 && (
          <FormGroup>
            <Label>Шаблон висновку</Label>
            <div className="space-y-2">
              {templates.map(t => (
                <button key={t.key} type="button" onClick={() => setSelectedTpl(t.key)}
                  className={cn(
                    'w-full text-left p-3 rounded-[8px] border transition-all',
                    selectedTpl === t.key
                      ? 'border-sky bg-sky/8 text-ink'
                      : 'border-line bg-panel-50 hover:bg-panel-100 text-ink-muted'
                  )}>
                  <p className="font-semibold text-[13px]">{t.name}</p>
                  <p className="text-[11px] mt-0.5 opacity-70 line-clamp-2">{t.preview}</p>
                </button>
              ))}
            </div>
          </FormGroup>
        )}

        <FormGroup className="mb-0">
          <Label>{c.conclusion ? 'Редагування' : 'Власний текст'}</Label>
          <Textarea value={customText} onChange={e => setCustomText(e.target.value)}
            className="min-h-[140px]" placeholder="Введіть висновок або доповніть шаблон..." />
        </FormGroup>

        <Button className="w-full mt-4" loading={loading} onClick={submit}>
          Надіслати висновок
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Treatment Tab ────────────────────────────────────────────────────────────
function TreatmentTab({ c, qc }: { c: Case; qc: ReturnType<typeof useQueryClient> }) {
  const isClosed     = c.status === 'COMPLETED' || c.status === 'CLOSED'
  const hasNote      = !!c.therapist_note
  // Форма редагування: відкрита якщо кейс не закритий АБО якщо закритий але нотатки ще немає
  const canEdit      = !isClosed || !hasNote
  const [note, setNote]       = useState(c.therapist_note || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')

  async function save(close: boolean) {
    if (!note.trim()) { setErr('Введіть призначення'); return }
    setLoading(true); setErr('')
    try {
      await api.saveTherapistNote(c.id, note, close)
      setMsg(close ? 'Справу завершено. Призначення збережено.' : 'Призначення збережено.')
      qc.invalidateQueries({ queryKey: ['case', String(c.id)] })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="">
      <CardHeader><CardTitle>Лікування та призначення</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
        {err && <Alert variant="error"   className="mb-4">{err}</Alert>}

        {/* Висновок рентгенолога */}
        {c.conclusion && (
          <div className="rounded-[8px] bg-panel-50 border border-line p-4 mb-5">
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">
              Висновок рентгенолога
            </p>
            <p className="text-[13px] text-ink whitespace-pre-wrap">{c.conclusion}</p>
          </div>
        )}

        {/* Збережене призначення (read-only) */}
        {isClosed && hasNote && (
          <div className="rounded-[8px] bg-jade/6 border border-jade/25 p-4 mb-4">
            <p className="text-[11px] font-bold text-jade uppercase tracking-wide mb-2">Призначення</p>
            <p className="text-[13px] text-ink whitespace-pre-wrap">{c.therapist_note}</p>
          </div>
        )}

        {/* Форма редагування */}
        {canEdit && (
          <>
            <FormGroup>
              <Label>Призначення та рекомендації</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                className="min-h-[180px]"
                placeholder="Введіть призначення лікування, рекомендації, направлення..."
              />
            </FormGroup>
            <div className="flex gap-3">
              <Button variant="secondary" loading={loading} onClick={() => save(false)} className="flex-1">
                Зберегти чернетку
              </Button>
              <Button loading={loading} onClick={() => save(true)} className="flex-1">
                Зберегти та завершити справу
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Manage Tab ───────────────────────────────────────────────────────────────
function ManageTab({ c, qc }: { c: Case; qc: ReturnType<typeof useQueryClient> }) {
  const [title, setTitle] = useState(c.title)
  const [desc, setDesc]   = useState(c.description || '')
  const [msg, setMsg]     = useState('')

  async function save() {
    await api.updateCase(c.id, { title, description: desc }).catch(() => {})
    qc.invalidateQueries({ queryKey: ['case', String(c.id)] })
    setMsg('Збережено!')
  }

  return (
    <Card className="">
      <CardHeader><CardTitle>Управління справою</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
        <FormGroup>
          <Label>Назва</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} />
        </FormGroup>
        <FormGroup className="mb-0">
          <Label>Опис</Label>
          <Textarea value={desc} onChange={e => setDesc(e.target.value)} />
        </FormGroup>
        <Button className="mt-4" onClick={save}>Зберегти зміни</Button>
      </CardContent>
    </Card>
  )
}
