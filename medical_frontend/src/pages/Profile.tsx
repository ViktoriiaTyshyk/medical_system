import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuth } from '@/store/auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { PageLoader } from '@/components/ui/spinner'
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
  const { data: profile } = useQuery({ queryKey: ['patient-profile', me.id], queryFn: () => api.getPatientProfile(me.id), retry: false })
  const { data: doctor }  = useQuery<User>({ queryKey: ['my-doctor'], queryFn: api.getMyDoctor, retry: false })
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [doctors, setDoctors]     = useState<FamilyDoctor[]>([])
  const [allDoctors, setAllDoctors] = useState<FamilyDoctor[]>([])
  const [search, setSearch]       = useState('')
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null)
  const [doctorMsg, setDoctorMsg] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [err, setErr]           = useState('')
  const [saving, setSaving]     = useState(false)
  const qc = useQueryClient()

  const p = (profile as Record<string, string | null | undefined>) || {}

  const [medForm, setMedForm] = useState({
    medical_record_number: '',
    insurance_number: '',
    address: '',
    blood_type: '',
  })

  async function openDoctorModal() {
    setShowDoctorModal(true)
    setSearch('')
    setSelectedDoctorId(null)

    const CACHE_KEY = 'family_doctors_cache'
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const list = JSON.parse(cached) as FamilyDoctor[]
      if (list.length > 0) {
        setAllDoctors(list)
        setDoctors(list)
        return
      }
    }

    setDoctorsLoading(true)
    const r = await api.listFamilyDoctors('').catch(() => [])
    if (r.length > 0) sessionStorage.setItem(CACHE_KEY, JSON.stringify(r))
    setAllDoctors(r)
    setDoctors(r)
    setDoctorsLoading(false)
  }

  function filterDoctors(q: string) {
    setSearch(q)
    const term = q.toLowerCase()
    setDoctors(
      allDoctors.filter(d =>
        `${d.first_name} ${d.last_name}`.toLowerCase().includes(term) ||
        d.email.toLowerCase().includes(term)
      )
    )
  }

  async function confirmDoctor() {
    if (!selectedDoctorId) return
    setSaving(true)
    await api.setMyDoctor(selectedDoctorId)
    qc.invalidateQueries({ queryKey: ['my-doctor'] })
    setShowDoctorModal(false)
    setDoctorMsg('Терапевта призначено!')
    setSaving(false)
  }

  async function savePatient() {
    const data = {
      medical_record_number: medForm.medical_record_number || undefined,
      insurance_number: medForm.insurance_number || undefined,
      address: medForm.address || undefined,
      blood_type: medForm.blood_type || undefined,
    }
    await api.updatePatientProfile(me.id, data).catch(e => setErr(e.message))
    setProfileMsg('Профіль збережено!')
  }

  return (
    <>
      {/* Therapist */}
      <Card>
        <CardHeader><CardTitle>Мій терапевт</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {doctorMsg && <Alert variant="success" className="mb-4">{doctorMsg}</Alert>}
          <p className="text-[13px] text-ink-muted mb-4">
            Терапевт автоматично отримуватиме доступ до ваших справ після висновку рентгенолога.
          </p>
          {doctor ? (
            <div className="flex items-center justify-between p-3 rounded-[8px] bg-jade/6 border border-jade/25">
              <div>
                <p className="font-semibold text-ink">✓ {doctor.first_name} {doctor.last_name}</p>
                <p className="text-[12px] text-ink-muted">{doctor.email}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={openDoctorModal}>Змінити</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={openDoctorModal}>
              Обрати терапевта
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Doctor selection modal */}
      <Modal open={showDoctorModal} onClose={() => setShowDoctorModal(false)} title="Оберіть терапевта" size="md">
        <div className="mb-4">
          <Input
            placeholder="Пошук за іменем або email..."
            value={search}
            onChange={e => filterDoctors(e.target.value)}
            autoFocus
          />
        </div>
        {doctorsLoading ? (
          <div className="text-center py-8 text-ink-muted">Завантаження...</div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">Терапевтів не знайдено</div>
        ) : (
          <div className="space-y-2 mb-5 max-h-[340px] overflow-y-auto">
            {doctors.map(d => {
              const sel = selectedDoctorId === d.id
              return (
                <div key={d.id}
                  className={`w-full flex items-center gap-2 p-3 rounded-[10px] border transition-all
                    ${sel ? 'border-sky bg-sky/8' : 'border-line bg-panel-50'}`}>
                  <button type="button" className="flex-1 text-left"
                    onClick={() => setSelectedDoctorId(sel ? null : d.id)}>
                    <p className="font-semibold text-[14px] text-ink">
                      {sel && <span className="text-sky mr-1.5">✓</span>}
                      {d.first_name} {d.last_name}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {d.specialization
                        ? `${d.specialization} · ${d.email}`
                        : d.email}
                    </p>
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowDoctorModal(false)}>Скасувати</Button>
          <Button disabled={!selectedDoctorId} loading={saving} onClick={confirmDoctor}>
            Призначити
          </Button>
        </div>
      </Modal>

      {/* Medical profile */}
      <Card>
        <CardHeader><CardTitle>Медичний профіль</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {err && <Alert variant="error" className="mb-4">{err}</Alert>}
          {profileMsg && <Alert variant="success" className="mb-4">{profileMsg}</Alert>}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <FormGroup className="mb-0">
              <Label>Номер медкнижки</Label>
              <Input value={medForm.medical_record_number || p.medical_record_number || ''}
                onChange={e => setMedForm(f => ({ ...f, medical_record_number: e.target.value }))} />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Страховий номер</Label>
              <Input value={medForm.insurance_number || p.insurance_number || ''}
                onChange={e => setMedForm(f => ({ ...f, insurance_number: e.target.value }))} />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Адреса</Label>
              <Input value={medForm.address || p.address || ''}
                onChange={e => setMedForm(f => ({ ...f, address: e.target.value }))} />
            </FormGroup>
            <FormGroup className="mb-0">
              <Label>Група крові</Label>
              <select value={medForm.blood_type || p.blood_type || ''}
                onChange={e => setMedForm(f => ({ ...f, blood_type: e.target.value }))}
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
