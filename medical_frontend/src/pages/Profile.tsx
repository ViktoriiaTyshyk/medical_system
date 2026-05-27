import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/spinner'
import { DoctorProfileModal } from '@/components/DoctorProfileModal'
import type { User, FamilyDoctor } from '@/types'

export function Profile() {
  const { role, setAuth, token } = useAuth()

  const { data: me, isLoading } = useQuery<User>({ queryKey: ['me'], queryFn: api.getMe })
  if (isLoading) return <PageLoader />
  if (!me) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-8">Мій профіль</h1>
      <div className="space-y-5 max-w-[760px]">
        <UserCard me={me} onSave={updated => {
          localStorage.setItem('user', JSON.stringify(updated))
          setAuth(token!, updated)
        }} />
        {role === 'RADIOLOGIST'   && <RadiologistCard me={me} />}
        {role === 'PATIENT'       && <PatientCard me={me} />}
      </div>
    </div>
  )
}

function UserCard({ me, onSave }: { me: User; onSave: (u: User) => void }) {
  const [form, setForm] = useState({
    first_name: me.first_name,
    last_name:  me.last_name,
    phone:      me.phone || '',
    sex:        me.sex || '',
    date_of_birth: me.date_of_birth || '',
  })
  const [msg, setMsg] = useState('')

  async function save() {
    const updated = await api.updateMe(form).catch(() => null)
    if (updated) { onSave(updated as User); setMsg('Збережено!') }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Особисті дані</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormGroup className="mb-0">
            <Label>Ім'я</Label>
            <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
          </FormGroup>
          <FormGroup className="mb-0">
            <Label>Прізвище</Label>
            <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
          </FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormGroup className="mb-0">
            <Label>Email</Label>
            <Input value={me.email} disabled />
          </FormGroup>
          <FormGroup className="mb-0">
            <Label>Телефон</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <FormGroup className="mb-0">
            <Label>Стать</Label>
            <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
              className="w-full rounded-[8px] bg-base-100 border border-line px-3 py-2 text-sm text-ink focus:border-sky focus:ring-2 focus:ring-sky/20 outline-none">
              <option value="">— оберіть —</option>
              <option value="MALE">Чоловіча</option>
              <option value="FEMALE">Жіноча</option>
            </select>
          </FormGroup>
          <FormGroup className="mb-0">
            <Label>Дата народження</Label>
            <Input type="date" value={form.date_of_birth}
              onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          </FormGroup>
        </div>
        <Button onClick={save}>Зберегти зміни</Button>
      </CardContent>
    </Card>
  )
}

function RadiologistCard({ me }: { me: User }) {
  const { data: profile } = useQuery({ queryKey: ['rad-profile', me.id], queryFn: () => api.getRadiologistProfile(me.id) })
  const [msg, setMsg] = useState('')
  const qc = useQueryClient()

  const current = (profile as { availability_status?: string })?.availability_status || 'AVAILABLE'
  const statuses = [
    { value: 'AVAILABLE', label: 'Доступний', color: 'jade' },
    { value: 'BUSY',      label: 'Зайнятий',  color: 'amber' },
    { value: 'OFF_DUTY',  label: 'Не на зміні', color: 'gray' },
  ]

  async function setStatus(s: string) {
    await api.setAvailability(s)
    qc.invalidateQueries({ queryKey: ['rad-profile', me.id] })
    setMsg('Статус оновлено!')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статус доступності</CardTitle>
        <span className={`text-[12px] font-semibold px-3 py-1 rounded-full
          ${current === 'AVAILABLE' ? 'bg-jade/12 text-jade' : current === 'BUSY' ? 'bg-amber/12 text-amber' : 'bg-panel-100 text-ink-muted'}`}>
          {statuses.find(s => s.value === current)?.label}
        </span>
      </CardHeader>
      <CardContent className="pt-0">
        {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
        <p className="text-[13px] text-ink-muted mb-4">
          Визначає пріоритетність при направленні термінових кейсів.
        </p>
        <div className="flex gap-3">
          {statuses.map(s => (
            <Button key={s.value} size="sm"
              variant={current === s.value ? 'primary' : 'secondary'}
              onClick={() => setStatus(s.value)} className="flex-1">
              {s.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PatientCard({ me }: { me: User }) {
  const { data: profile } = useQuery({ queryKey: ['patient-profile', me.id], queryFn: () => api.getPatientProfile(me.id) })
  const { data: doctor }  = useQuery<User>({ queryKey: ['my-doctor'], queryFn: api.getMyDoctor, retry: false })
  const [doctors, setDoctors]   = useState<FamilyDoctor[]>([])
  const [search, setSearch]     = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [viewDoctorId, setViewDoctorId] = useState<number | null>(null)
  const [msg, setMsg]           = useState('')
  const [err, setErr]           = useState('')
  const qc = useQueryClient()

  const p = (profile as Record<string, string | null | undefined>) || {}

  async function searchDoctors(q: string) {
    const r = await api.listFamilyDoctors(q).catch(() => [])
    setDoctors(r)
  }
  async function selectDoctor(id: number) {
    await api.setMyDoctor(id)
    qc.invalidateQueries({ queryKey: ['my-doctor'] })
    setShowSearch(false); setMsg('Терапевта призначено!')
  }

  async function savePatient() {
    const data = {
      medical_record_number: (document.getElementById('mrn') as HTMLInputElement)?.value || undefined,
      insurance_number: (document.getElementById('ins') as HTMLInputElement)?.value || undefined,
      address: (document.getElementById('addr') as HTMLInputElement)?.value || undefined,
      blood_type: (document.getElementById('blood') as HTMLSelectElement)?.value || undefined,
    }
    await api.updatePatientProfile(me.id, data).catch(e => setErr(e.message))
    setMsg('Профіль збережено!')
  }

  return (
    <>
      {/* Therapist */}
      <Card>
        <CardHeader><CardTitle>Мій терапевт</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
          <p className="text-[13px] text-ink-muted mb-4">
            Терапевт автоматично отримуватиме доступ до ваших справ після висновку рентгенолога.
          </p>
          {doctor ? (
            <div className="flex items-center justify-between p-3 rounded-[8px] bg-jade/6 border border-jade/25">
              <div>
                <p className="font-semibold text-ink">✓ {doctor.first_name} {doctor.last_name}</p>
                <p className="text-[12px] text-ink-muted">{doctor.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setViewDoctorId(doctor.id)}>Профіль</Button>
                <Button size="sm" variant="secondary" onClick={() => setShowSearch(true)}>Змінити</Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => { setShowSearch(true); searchDoctors('') }}>
              Обрати терапевта
            </Button>
          )}
          {showSearch && (
            <div className="mt-4">
              <Input placeholder="Пошук терапевта..." onChange={e => searchDoctors(e.target.value)} autoFocus />
              <div className="mt-2 bg-surface border border-line rounded-[8px] overflow-hidden">
                {doctors.map(d => (
                  <div key={d.id} className="flex items-center border-b border-line last:border-0 hover:bg-panel-50 transition-colors">
                    <button type="button" className="flex-1 text-left px-4 py-2.5"
                      onClick={() => selectDoctor(d.id)}>
                      <p className="font-medium text-[13px] text-ink">{d.first_name} {d.last_name}</p>
                      <p className="text-[11px] text-ink-muted">{d.email}</p>
                    </button>
                    <button type="button"
                      className="px-3 py-2.5 text-[11px] text-sky hover:text-sky-dark transition-colors flex-shrink-0"
                      onClick={() => setViewDoctorId(d.id)}>
                      Профіль
                    </button>
                  </div>
                ))}
                {doctors.length === 0 && <p className="px-4 py-3 text-[13px] text-ink-muted">Введіть ім'я для пошуку</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {viewDoctorId && (
        <DoctorProfileModal
          userId={viewDoctorId}
          doctorRole="FAMILY_DOCTOR"
          onClose={() => setViewDoctorId(null)}
        />
      )}

      {/* Medical profile */}
      <Card>
        <CardHeader><CardTitle>Медичний профіль</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {err && <Alert variant="error" className="mb-4">{err}</Alert>}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormGroup className="mb-0">
              <Label>Номер медкнижки</Label>
              <Input id="mrn" defaultValue={p.medical_record_number || ''} />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Страховий номер</Label>
              <Input id="ins" defaultValue={p.insurance_number || ''} />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Адреса</Label>
              <Input id="addr" defaultValue={p.address || ''} />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Група крові</Label>
              <select id="blood" defaultValue={p.blood_type || ''}
                className="w-full rounded-[8px] bg-base-100 border border-line px-3 py-2 text-sm text-ink focus:border-sky focus:ring-2 focus:ring-sky/20 outline-none">
                <option value="">— обрати —</option>
                {['A_POS','A_NEG','B_POS','B_NEG','AB_POS','AB_NEG','O_POS','O_NEG'].map(b => (
                  <option key={b} value={b}>{b.replace('_','')}</option>
                ))}
              </select>
            </FormGroup>
          </div>
          <Button onClick={savePatient}>Зберегти медичний профіль</Button>
        </CardContent>
      </Card>
    </>
  )
}
