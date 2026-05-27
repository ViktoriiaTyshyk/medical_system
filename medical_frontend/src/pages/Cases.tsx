import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FolderOpen } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { fmtDate } from '@/lib/utils'
import type { Case } from '@/types'

const STATUS_LABEL:   Record<string, string> = {
  PENDING:'Очікує', OPEN:'В роботі', IN_PROGRESS:'В роботі', COMPLETED:'Завершено', CLOSED:'Завершено',
}
const STATUS_VARIANT: Record<string, 'yellow'|'green'|'gray'> = {
  PENDING:'gray', OPEN:'yellow', IN_PROGRESS:'yellow', COMPLETED:'green', CLOSED:'green',
}

export function Cases() {
  const navigate  = useNavigate()
  const { role }  = useAuth()
  const qc        = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['cases', role],
    queryFn: () => {
      if (role === 'PATIENT')       return api.getMyCases()
      if (role === 'RADIOLOGIST')   return api.getRadiologistCases()
      if (role === 'FAMILY_DOCTOR') return api.getDoctorCases()
      return api.getCases()
    },
  })

  const pending = cases.filter((c: Case) => c.status === 'PENDING')
  const active  = cases.filter((c: Case) => c.status !== 'PENDING')
  const filtered = (list: Case[]) =>
    list.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))

  async function activate(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    await api.updateCaseStatus(id, 'OPEN')
    qc.invalidateQueries({ queryKey: ['cases'] })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Медичні справи</h1>
          <p className="text-ink-muted mt-1">{cases.length} справ загалом</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <Input className="pl-9" placeholder="Пошук справ..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-4">
          {/* Pending */}
          {pending.length > 0 && (role === 'FAMILY_DOCTOR' || role === 'ADMIN') && (
            <Card className="border-l-4 border-l-amber">
              <CardHeader>
                <CardTitle>Очікують розгляду ({pending.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[13px] text-ink-muted mb-4">
                  Пацієнти надіслали рентгенівські знімки через AI-аналіз.
                </p>
                <CaseTable cases={filtered(pending)} navigate={navigate}
                  action={(c, e) => <Button size="sm" variant="primary" onClick={ev => { ev.stopPropagation(); activate(c.id, ev) }}>Активувати</Button>}
                />
              </CardContent>
            </Card>
          )}

          {/* Active cases */}
          <Card>
            <CardContent className="pt-5">
              {filtered(active).length === 0 ? (
                <div className="text-center py-14 text-ink-muted">
                  <FolderOpen size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-ink">Справ поки немає</p>
                </div>
              ) : (
                <CaseTable cases={filtered(active)} navigate={navigate} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {
        setShowCreate(false)
        qc.invalidateQueries({ queryKey: ['cases'] })
      }} />
    </div>
  )
}

function CaseTable({ cases, navigate, action }: {
  cases: Case[]
  navigate: (path: string) => void
  action?: (c: Case, e: React.MouseEvent) => React.ReactNode
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-line">
          {['#', 'Назва', 'Статус', 'Дата', ''].map(h => (
            <th key={h} className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cases.map(c => (
          <tr key={c.id}
            className="border-b border-line/50 hover:bg-panel-50/50 cursor-pointer transition-colors last:border-0"
            onClick={() => navigate(`/cases/${c.id}`)}>
            <td className="py-3 px-1 text-[13px] text-ink-muted">#{c.id}</td>
            <td className="py-3 px-1 text-[13px] font-medium text-ink">{c.title}</td>
            <td className="py-3 px-1">
              <Badge variant={STATUS_VARIANT[c.status] ?? 'gray'}>
                {STATUS_LABEL[c.status] ?? c.status}
              </Badge>
            </td>
            <td className="py-3 px-1 text-[13px] text-ink-muted">{fmtDate(c.created_at)}</td>
            <td className="py-3 px-1 text-right">{action?.(c, {} as React.MouseEvent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CreateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [patientId, setPatientId] = useState<number | null>(null)
  const [patientName, setPatientName] = useState('')
  const [results, setResults] = useState<{ id: number; first_name: string; last_name: string; email: string }[]>([])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  let searchTimer: ReturnType<typeof setTimeout>

  async function searchPatients(q: string) {
    if (q.length < 2) { setResults([]); return }
    clearTimeout(searchTimer)
    searchTimer = setTimeout(async () => {
      const r = await api.searchUsers(q, 'PATIENT').catch(() => [])
      setResults(r as typeof results)
    }, 300)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !patientId) { setError('Заповніть назву та оберіть пацієнта'); return }
    setLoading(true)
    try {
      await api.createCase({ title, description: desc, patient_id: patientId })
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Нова медична справа">
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <FormGroup className="mb-0">
          <Label>Назва справи *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Рентген легень..." />
        </FormGroup>
        <FormGroup className="mb-0">
          <Label>Опис</Label>
          <textarea className="w-full rounded-[8px] bg-base-100 border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-sky focus:ring-2 focus:ring-sky/20 outline-none resize-none"
            rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Симптоми..." />
        </FormGroup>
        <FormGroup className="mb-0 relative">
          <Label>Пацієнт *</Label>
          {patientId ? (
            <div className="flex items-center justify-between bg-panel-50 rounded-[8px] px-3 py-2 text-sm text-ink border border-line">
              <span>{patientName}</span>
              <button type="button" onClick={() => { setPatientId(null); setPatientName('') }} className="text-ink-muted hover:text-ink">✕</button>
            </div>
          ) : (
            <>
              <Input placeholder="Введіть ім'я пацієнта..."
                onChange={e => searchPatients(e.target.value)} />
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-surface border border-line rounded-[8px] shadow-modal mt-1 overflow-hidden">
                  {results.map(p => (
                    <button key={p.id} type="button"
                      className="w-full text-left px-4 py-2.5 hover:bg-panel-50 transition-colors text-sm"
                      onClick={() => { setPatientId(p.id); setPatientName(`${p.first_name} ${p.last_name}`); setResults([]) }}>
                      <div className="font-medium text-ink">{p.first_name} {p.last_name}</div>
                      <div className="text-[11px] text-ink-muted">{p.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </FormGroup>
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button type="submit" loading={loading}>Створити справу</Button>
        </div>
      </form>
    </Modal>
  )
}
