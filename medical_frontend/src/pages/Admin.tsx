import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Building2, GraduationCap, Stethoscope, FolderOpen, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, FormGroup } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/spinner'
import { Modal } from '@/components/ui/modal'
import { fmtDate } from '@/lib/utils'
import type { User } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  PATIENT:'Пацієнт', RADIOLOGIST:'Рентгенолог', FAMILY_DOCTOR:'Терапевт', ADMIN:'Адміністратор',
}
const ROLE_VARIANT: Record<string, 'blue'|'green'|'yellow'|'red'|'gray'> = {
  PATIENT:'blue', RADIOLOGIST:'yellow', FAMILY_DOCTOR:'green', ADMIN:'red',
}

// ── Confirm delete modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({
  title, description, onConfirm, onClose,
}: {
  title: string
  description?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleConfirm() {
    setLoading(true); setErr('')
    try { await onConfirm(); onClose() }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setLoading(false) }
  }

  return (
    <Modal open onClose={onClose} title="Підтвердження видалення" size="sm">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-rose/12 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trash2 size={15} className="text-rose" />
        </div>
        <div>
          <p className="font-semibold text-ink text-sm">{title}</p>
          {description && <p className="text-[13px] text-ink-muted mt-1">{description}</p>}
        </div>
      </div>
      {err && <Alert variant="error" className="mb-4">{err}</Alert>}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>Скасувати</Button>
        <Button variant="danger" loading={loading} onClick={handleConfirm}>Видалити</Button>
      </div>
    </Modal>
  )
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export function Admin() {
  const [activeSection, setActiveSection] = useState<'doctors'|'users'|'cases'|'facilities'|'specializations'>('doctors')
  const [showAddUser, setShowAddUser]     = useState(false)
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [selectedUser, setSelectedUser]   = useState<User | null>(null)
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn:  api.adminGetUsers,
  })

  function refresh() { qc.invalidateQueries({ queryKey: ['admin-users'] }) }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-2">Адміністрування</h1>
      <p className="text-ink-muted mb-8">Управління користувачами та системними даними</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { key: 'doctors',         label: 'Лікарі',          icon: Stethoscope },
          { key: 'users',           label: 'Всі користувачі', icon: UserPlus },
          { key: 'cases',           label: 'Справи',           icon: FolderOpen },
          { key: 'facilities',      label: 'Заклади',          icon: Building2 },
          { key: 'specializations', label: 'Спеціалізації',    icon: GraduationCap },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-medium transition-all border ${
              activeSection === s.key
                ? 'bg-panel-100 border-line text-ink'
                : 'border-transparent text-ink-muted hover:bg-panel-50'
            }`}>
            <s.icon size={15} />{s.label}
          </button>
        ))}
      </div>

      {activeSection === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>Користувачі ({users.length})</CardTitle>
            <Button size="sm" onClick={() => setShowAddUser(true)}>
              <UserPlus size={14} /> Додати
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? <PageLoader /> : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    {['#', "Ім'я", 'Email', 'Роль', 'Статус'].map(h => (
                      <th key={h} className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const role   = u.roles[0]?.name
                    const active = u.status !== 'INACTIVE'
                    return (
                      <tr key={u.id}
                        className="border-b border-line/50 hover:bg-panel-50/50 last:border-0 cursor-pointer"
                        onClick={() => setSelectedUser(u)}>
                        <td className="py-3 px-1 text-[13px] text-ink-muted">#{u.id}</td>
                        <td className="py-3 px-1 text-[13px] font-medium text-ink">{u.first_name} {u.last_name}</td>
                        <td className="py-3 px-1 text-[13px] text-ink-muted">{u.email}</td>
                        <td className="py-3 px-1">
                          {role && <Badge variant={ROLE_VARIANT[role] ?? 'gray'}>{ROLE_LABEL[role] ?? role}</Badge>}
                        </td>
                        <td className="py-3 px-1">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            active ? 'bg-jade/10 text-jade' : 'bg-rose/10 text-rose'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-jade' : 'bg-rose'}`} />
                            {active ? 'Активний' : 'Неактивний'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'doctors' && (
        <DoctorsSection onAdd={() => setShowAddDoctor(true)} onSelect={setSelectedUser} />
      )}
      {activeSection === 'cases' && (
        <CasesSection onDeleteDone={() => qc.invalidateQueries({ queryKey: ['admin-cases'] })} />
      )}
      {activeSection === 'facilities' && <FacilitiesSection />}
      {activeSection === 'specializations' && <SpecializationsSection />}

      <AddUserModal open={showAddUser} onClose={() => setShowAddUser(false)}
        onCreated={() => { setShowAddUser(false); refresh() }} />
      <AddDoctorModal open={showAddDoctor} onClose={() => setShowAddDoctor(false)}
        onCreated={() => { setShowAddDoctor(false); qc.invalidateQueries({ queryKey: ['admin-doctors'] }); refresh() }} />
      {selectedUser && (
        <UserProfileModal key={selectedUser.id} user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdated={() => { refresh(); setSelectedUser(null) }}
          onDeleted={() => { refresh(); setSelectedUser(null) }} />
      )}
    </div>
  )
}

// ── Doctors Section ───────────────────────────────────────────────────────────
function DoctorsSection({ onAdd, onSelect }: { onAdd: () => void; onSelect: (u: User) => void }) {
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-doctors'],
    queryFn:  api.adminGetUsers,
  })
  const doctors = users.filter(u => {
    const role = u.roles[0]?.name
    return role === 'RADIOLOGIST' || role === 'FAMILY_DOCTOR'
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Лікарі ({doctors.length})</CardTitle>
        <Button size="sm" onClick={onAdd}>
          <UserPlus size={14} /> Додати лікаря
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? <PageLoader /> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                {['#', "Ім'я", 'Email', 'Роль', 'Статус'].map(h => (
                  <th key={h} className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doctors.map(u => {
                const role   = u.roles[0]?.name
                const active = u.status !== 'INACTIVE'
                return (
                  <tr key={u.id}
                    className="border-b border-line/50 hover:bg-panel-50/50 last:border-0 cursor-pointer"
                    onClick={() => onSelect(u)}>
                    <td className="py-3 px-1 text-[13px] text-ink-muted">#{u.id}</td>
                    <td className="py-3 px-1 text-[13px] font-medium text-ink">{u.first_name} {u.last_name}</td>
                    <td className="py-3 px-1 text-[13px] text-ink-muted">{u.email}</td>
                    <td className="py-3 px-1">
                      {role && <Badge variant={ROLE_VARIANT[role] ?? 'gray'}>{ROLE_LABEL[role] ?? role}</Badge>}
                    </td>
                    <td className="py-3 px-1">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        active ? 'bg-jade/10 text-jade' : 'bg-rose/10 text-rose'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-jade' : 'bg-rose'}`} />
                        {active ? 'Активний' : 'Неактивний'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && doctors.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[13px] text-ink-muted">
                    Лікарів ще немає. Додайте першого лікаря.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

// ── Cases Section ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  PENDING:'Очікує', OPEN:'В роботі', IN_PROGRESS:'В роботі', COMPLETED:'Завершено', CLOSED:'Завершено',
}
const STATUS_VARIANT: Record<string, 'yellow'|'green'|'gray'> = {
  PENDING:'gray', OPEN:'yellow', IN_PROGRESS:'yellow', COMPLETED:'green', CLOSED:'green',
}

function CasesSection({ onDeleteDone }: { onDeleteDone: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['admin-cases'],
    queryFn:  api.adminGetAllCases,
  })

  const filtered = (cases as { id: number; title: string; status: string; urgency: string; patient_id: number; created_at: string }[])
    .filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || String(c.id).includes(search))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Усі справи ({cases.length})</CardTitle>
          <div className="relative w-56">
            <Input placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-3 text-xs h-8" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? <PageLoader /> : filtered.length === 0 ? (
            <div className="text-center py-12 text-ink-muted">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-20" />
              <p>Справ не знайдено</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  {['#', 'Назва', 'Статус', 'Дата', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-1 text-[11px] font-bold text-ink-subtle uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-line/50 hover:bg-panel-50/50 last:border-0 group">
                    <td className="py-3 px-1 text-[13px] text-ink-muted">#{c.id}</td>
                    <td className="py-3 px-1 text-[13px] font-medium text-ink max-w-[240px] truncate">{c.title}</td>
                    <td className="py-3 px-1">
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'gray'}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-1 text-[13px] text-ink-muted">{fmtDate(c.created_at)}</td>
                    <td className="py-3 px-1 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget({ id: c.id, title: c.title }) }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[6px] text-ink-subtle hover:text-rose hover:bg-rose/10 transition-all"
                        title="Видалити справу">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Видалити справу «${deleteTarget.title}»?`}
          description="Буде видалено всі повідомлення, файли та учасників. Дію неможливо скасувати."
          onConfirm={async () => {
            await api.adminDeleteCase(deleteTarget.id)
            qc.invalidateQueries({ queryKey: ['admin-cases'] })
            onDeleteDone()
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

// ── User Profile Modal ────────────────────────────────────────────────────────
const SEX_LABEL: Record<string, string>    = { MALE: 'Чоловік', FEMALE: 'Жінка' }
const BLOOD_LABEL: Record<string, string>  = {
  A_POS:'A+', A_NEG:'A-', B_POS:'B+', B_NEG:'B-',
  AB_POS:'AB+', AB_NEG:'AB-', O_POS:'O+', O_NEG:'O-',
}
const AVAIL_LABEL: Record<string, string>  = {
  AVAILABLE:'Доступний', BUSY:'Зайнятий', OFF_DUTY:'Не на роботі',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-3 mt-5 pt-5 border-t border-line">{children}</p>
}

function Select({ value, onChange, children, className = '' }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`w-full rounded-[8px] bg-base border border-line px-3 py-2 text-[13px] text-ink focus:border-sky focus:ring-2 focus:ring-sky/20 outline-none ${className}`}>
      {children}
    </select>
  )
}

function UserProfileModal({ user, onClose, onUpdated, onDeleted }: {
  user: User; onClose: () => void; onUpdated: () => void; onDeleted: () => void
}) {
  const role     = user.roles[0]?.name
  const isRad    = role === 'RADIOLOGIST'
  const isFD     = role === 'FAMILY_DOCTOR'
  const isDoctor = isRad || isFD
  const isPatient = role === 'PATIENT'

  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ── basic user fields
  const [basic, setBasic] = useState({
    first_name:    user.first_name,
    last_name:     user.last_name,
    phone:         user.phone         ?? '',
    date_of_birth: user.date_of_birth ?? '',
    sex:           user.sex           ?? '',
  })

  // ── doctor profile
  const [prof, setProf] = useState({
    license_number:      '', department: '', clinic_name: '',
    years_of_experience: '', facility_id: '', availability_status: '',
  })

  // ── patient profile
  const [pat, setPat] = useState({
    blood_type: '', address: '', insurance_number: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })

  // ── specializations (doctor)
  const [selectedSpecs, setSelectedSpecs] = useState<number[]>([])

  // ── queries
  const { data: facilitiesRaw = [] } = useQuery({ queryKey: ['facilities'], queryFn: api.adminGetFacilities })
  const facilities = facilitiesRaw as { id: number; name: string }[]

  const { data: allSpecsRaw = [] } = useQuery({
    queryKey: ['specs'], queryFn: api.adminGetSpecializations,
  })
  const allSpecs = allSpecsRaw as { id: number; name: string }[]

  const { data: doctorSpecs = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['doctor-specs', user.id],
    queryFn:  () => api.adminGetDoctorSpecializations(user.id),
    enabled:  isDoctor,
  })

  const { data: profileData } = useQuery({
    queryKey: ['profile', role, user.id],
    queryFn:  () => isRad ? api.getRadiologistProfile(user.id)
                 : isFD  ? api.getFamilyDoctorProfile(user.id)
                 : isPatient ? api.getPatientProfile(user.id)
                 : null,
    enabled: isDoctor || isPatient,
  })

  // sync forms when data loads
  useEffect(() => {
    if (!profileData) return
    const p = profileData as Record<string, unknown>
    if (isDoctor) {
      setProf({
        license_number:      String(p.license_number      ?? ''),
        department:          String(p.department          ?? ''),
        clinic_name:         String(p.clinic_name         ?? ''),
        years_of_experience: String(p.years_of_experience ?? ''),
        facility_id:         String(p.facility_id         ?? ''),
        availability_status: String(p.availability_status ?? ''),
      })
    }
    if (isPatient) {
      setPat({
        blood_type:              String(p.blood_type              ?? ''),
        address:                 String(p.address                 ?? ''),
        insurance_number:        String(p.insurance_number        ?? ''),
        emergency_contact_name:  String(p.emergency_contact_name  ?? ''),
        emergency_contact_phone: String(p.emergency_contact_phone ?? ''),
      })
    }
  }, [profileData])

  useEffect(() => {
    setSelectedSpecs(doctorSpecs.map(s => s.id))
  }, [doctorSpecs])

  // ── save helpers
  async function save(key: string, fn: () => Promise<unknown>) {
    setLoading(key); setErr(''); setMsg('')
    try { await fn(); setMsg('Збережено') }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setLoading(null) }
  }

  async function toggleStatus() {
    await save('status', async () => {
      await api.adminUpdateStatus(user.id, user.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE')
      onUpdated()
    })
  }

  const active = user.status !== 'INACTIVE'

  return (
    <>
      <Modal open onClose={onClose} title="Профіль користувача" size="lg">
        {/* Header */}
        <div className="flex items-center gap-3 pb-5 border-b border-line -mt-1 mb-2">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky to-jade flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink">{user.first_name} {user.last_name}</p>
            <p className="text-[12px] text-ink-muted">{user.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {role && <Badge variant={ROLE_VARIANT[role] ?? 'gray'}>{ROLE_LABEL[role] ?? role}</Badge>}
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              active ? 'bg-jade/10 text-jade' : 'bg-rose/10 text-rose'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-jade' : 'bg-rose'}`} />
              {active ? 'Активний' : 'Неактивний'}
            </span>
          </div>
        </div>

        {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
        {err && <Alert variant="error"   className="mb-4">{err}</Alert>}

        {/* ── Basic info ── */}
        <SectionTitle>Основна інформація</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup className="mb-0"><Label>Ім'я</Label>
            <Input value={basic.first_name} onChange={e => setBasic(b => ({ ...b, first_name: e.target.value }))} />
          </FormGroup>
          <FormGroup className="mb-0"><Label>Прізвище</Label>
            <Input value={basic.last_name} onChange={e => setBasic(b => ({ ...b, last_name: e.target.value }))} />
          </FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup className="mb-0"><Label>Email</Label>
            <Input value={user.email} disabled className="opacity-50 cursor-not-allowed" />
          </FormGroup>
          <FormGroup className="mb-0"><Label>Телефон</Label>
            <Input value={basic.phone} onChange={e => setBasic(b => ({ ...b, phone: e.target.value }))} placeholder="+380..." />
          </FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <FormGroup className="mb-0"><Label>Дата народження</Label>
            <Input type="date" value={basic.date_of_birth}
              onChange={e => setBasic(b => ({ ...b, date_of_birth: e.target.value }))} />
          </FormGroup>
          <FormGroup className="mb-0"><Label>Стать</Label>
            <Select value={basic.sex} onChange={v => setBasic(b => ({ ...b, sex: v }))}>
              <option value="">— Не вказано —</option>
              {Object.entries(SEX_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </FormGroup>
        </div>
        <div className="flex gap-2 mb-2">
          <Button size="sm" loading={loading === 'basic'}
            onClick={() => save('basic', () => api.adminUpdateUser(user.id, {
              first_name: basic.first_name, last_name: basic.last_name,
              phone: basic.phone || null,
              date_of_birth: basic.date_of_birth || null,
              sex: basic.sex || null,
            }))}>
            Зберегти
          </Button>
          <Button size="sm" variant={active ? 'secondary' : 'primary'}
            loading={loading === 'status'} onClick={toggleStatus}>
            {active ? 'Деактивувати' : 'Активувати'}
          </Button>
        </div>

        {/* ── Patient profile ── */}
        {isPatient && (
          <>
            <SectionTitle>Профіль пацієнта</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormGroup className="mb-0"><Label>Група крові</Label>
                <Select value={pat.blood_type} onChange={v => setPat(p => ({ ...p, blood_type: v }))}>
                  <option value="">— Не вказано —</option>
                  {Object.entries(BLOOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </FormGroup>
              <FormGroup className="mb-0"><Label>Страховий номер</Label>
                <Input value={pat.insurance_number}
                  onChange={e => setPat(p => ({ ...p, insurance_number: e.target.value }))} />
              </FormGroup>
            </div>
            <FormGroup className="mb-3"><Label>Адреса</Label>
              <Input value={pat.address} onChange={e => setPat(p => ({ ...p, address: e.target.value }))} />
            </FormGroup>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <FormGroup className="mb-0"><Label>Контакт при НС — ім'я</Label>
                <Input value={pat.emergency_contact_name}
                  onChange={e => setPat(p => ({ ...p, emergency_contact_name: e.target.value }))} />
              </FormGroup>
              <FormGroup className="mb-0"><Label>Контакт при НС — тел.</Label>
                <Input value={pat.emergency_contact_phone}
                  onChange={e => setPat(p => ({ ...p, emergency_contact_phone: e.target.value }))} />
              </FormGroup>
            </div>
            <Button size="sm" loading={loading === 'patient'}
              onClick={() => save('patient', () => api.updatePatientProfile(user.id, {
                blood_type:              pat.blood_type              || null,
                address:                 pat.address                 || null,
                insurance_number:        pat.insurance_number        || null,
                emergency_contact_name:  pat.emergency_contact_name  || null,
                emergency_contact_phone: pat.emergency_contact_phone || null,
              }))}>
              Зберегти профіль
            </Button>
          </>
        )}

        {/* ── Doctor profile ── */}
        {isDoctor && (
          <>
            <SectionTitle>{isRad ? 'Профіль рентгенолога' : 'Профіль терапевта'}</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <FormGroup className="mb-0"><Label>Номер ліцензії</Label>
                <Input value={prof.license_number}
                  onChange={e => setProf(p => ({ ...p, license_number: e.target.value }))} />
              </FormGroup>
              <FormGroup className="mb-0"><Label>Стаж (роки)</Label>
                <Input type="number" min="0" max="60" value={prof.years_of_experience}
                  onChange={e => setProf(p => ({ ...p, years_of_experience: e.target.value }))} />
              </FormGroup>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {isRad && (
                <FormGroup className="mb-0"><Label>Відділення</Label>
                  <Input value={prof.department} placeholder="Напр. Рентген"
                    onChange={e => setProf(p => ({ ...p, department: e.target.value }))} />
                </FormGroup>
              )}
              {isFD && (
                <FormGroup className="mb-0"><Label>Назва клініки</Label>
                  <Input value={prof.clinic_name} placeholder="Напр. Клініка Здоров'я"
                    onChange={e => setProf(p => ({ ...p, clinic_name: e.target.value }))} />
                </FormGroup>
              )}
              <FormGroup className="mb-0"><Label>Статус доступності</Label>
                <Select value={prof.availability_status} onChange={v => setProf(p => ({ ...p, availability_status: v }))}>
                  <option value="">— Не вказано —</option>
                  {Object.entries(AVAIL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </FormGroup>
            </div>
            <FormGroup className="mb-4"><Label>Медичний заклад</Label>
              <Select value={prof.facility_id} onChange={v => setProf(p => ({ ...p, facility_id: v }))}>
                <option value="">— Не призначено —</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </FormGroup>
            <Button size="sm" loading={loading === 'profile'}
              onClick={() => save('profile', async () => {
                const payload: Record<string, unknown> = {}
                if (prof.license_number)      payload.license_number      = prof.license_number
                if (prof.years_of_experience) payload.years_of_experience = Number(prof.years_of_experience)
                if (prof.facility_id)         payload.facility_id         = Number(prof.facility_id)
                if (prof.availability_status) payload.availability_status = prof.availability_status
                if (isRad) { if (prof.department)  payload.department  = prof.department }
                if (isFD)  { if (prof.clinic_name) payload.clinic_name = prof.clinic_name }
                isRad
                  ? await api.updateRadiologistProfile(user.id, payload)
                  : await api.updateFamilyDoctorProfile(user.id, payload)
              })}>
              Зберегти профіль
            </Button>

            {/* Specializations */}
            <SectionTitle>Спеціалізації</SectionTitle>
            {allSpecs.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Спеціалізацій ще немає. Додайте їх у розділі "Спеціалізації".</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {allSpecs.map(s => (
                    <label key={s.id}
                      className={`flex items-center gap-2.5 p-3 rounded-[8px] border cursor-pointer transition-all ${
                        selectedSpecs.includes(s.id)
                          ? 'border-sky bg-sky/8 text-ink'
                          : 'border-line bg-panel-50 text-ink-muted hover:bg-panel-100'
                      }`}>
                      <input type="checkbox" checked={selectedSpecs.includes(s.id)}
                        onChange={e => setSelectedSpecs(prev =>
                          e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                        )}
                        className="w-4 h-4 accent-sky" />
                      <span className="text-[13px] font-medium">{s.name}</span>
                    </label>
                  ))}
                </div>
                <Button size="sm" loading={loading === 'specs'}
                  onClick={() => save('specs', () => api.adminSetDoctorSpecializations(user.id, selectedSpecs))}>
                  Зберегти спеціалізації
                </Button>
              </>
            )}
          </>
        )}

        {/* ── Danger zone ── */}
        <div className="mt-6 pt-5 border-t border-line">
          <p className="text-[11px] font-bold text-rose/70 uppercase tracking-wide mb-3">Небезпечна зона</p>
          <div className="flex items-center justify-between p-3 rounded-[8px] border border-rose/20 bg-rose/4">
            <div>
              <p className="text-[13px] font-medium text-ink">Видалити акаунт</p>
              <p className="text-[12px] text-ink-muted">Всі дані користувача будуть видалені назавжди</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={13} /> Видалити
            </Button>
          </div>
        </div>
      </Modal>

      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title={`Видалити акаунт «${user.first_name} ${user.last_name}»?`}
          description="Всі справи, повідомлення, файли та дані цього користувача будуть видалені. Дію неможливо скасувати."
          onConfirm={async () => {
            await api.adminDeleteUser(user.id)
            onDeleted()
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}

// ── Add Doctor Modal ───────────────────────────────────────────────────────────
function AddDoctorModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [role, setRole] = useState<'RADIOLOGIST' | 'FAMILY_DOCTOR'>('RADIOLOGIST')
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    phone: '', date_of_birth: '', sex: '',
    license_number: '', years_of_experience: '',
    department: '', clinic_name: '',
    availability_status: '', facility_id: '',
  })
  const [selectedSpecs, setSelectedSpecs] = useState<number[]>([])
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data: facilitiesRaw = [] } = useQuery({ queryKey: ['facilities'], queryFn: api.adminGetFacilities, enabled: open })
  const facilities = facilitiesRaw as { id: number; name: string }[]

  const { data: allSpecsRaw = [] } = useQuery({ queryKey: ['specs'], queryFn: api.adminGetSpecializations, enabled: open })
  const allSpecs = allSpecsRaw as { id: number; name: string }[]

  function reset() {
    setForm({ first_name:'', last_name:'', email:'', password:'', phone:'', date_of_birth:'', sex:'',
              license_number:'', years_of_experience:'', department:'', clinic_name:'', availability_status:'', facility_id:'' })
    setSelectedSpecs([])
    setErr('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        email: form.email, password: form.password,
        first_name: form.first_name, last_name: form.last_name,
        role,
        phone:         form.phone         || undefined,
        date_of_birth: form.date_of_birth || undefined,
        sex:           form.sex           || undefined,
        license_number:      form.license_number      || undefined,
        years_of_experience: form.years_of_experience ? Number(form.years_of_experience) : undefined,
        availability_status: form.availability_status || undefined,
        facility_id:         form.facility_id         ? Number(form.facility_id) : undefined,
      }
      if (role === 'RADIOLOGIST') payload.department  = form.department  || undefined
      else                        payload.clinic_name = form.clinic_name || undefined

      const created = await api.adminCreateDoctor(payload) as { id: number }
      if (selectedSpecs.length > 0) {
        await api.adminSetDoctorSpecializations(created.id, selectedSpecs)
      }
      onCreated(); reset()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setLoading(false)
    }
  }

  const isRad = role === 'RADIOLOGIST'

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Новий лікар">
      {err && <Alert variant="error" className="mb-4">{err}</Alert>}
      <form onSubmit={submit} className="space-y-0">

        {/* Роль */}
        <FormGroup className="mb-4">
          <Label>Роль</Label>
          <div className="grid grid-cols-2 gap-2">
            {([['RADIOLOGIST','Рентгенолог'],['FAMILY_DOCTOR','Терапевт']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRole(v)}
                className={`py-2 px-3 rounded-[8px] text-sm font-medium border transition-all ${role===v?'border-sky bg-sky/10 text-sky':'border-line bg-panel-50 text-ink-muted hover:bg-panel-100'}`}>
                {l}
              </button>
            ))}
          </div>
        </FormGroup>

        {/* Основна інформація */}
        <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-3 pb-1 border-b border-line">Основна інформація</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup className="mb-0"><Label>Ім'я *</Label><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></FormGroup>
          <FormGroup className="mb-0"><Label>Прізвище *</Label><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup className="mb-0"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></FormGroup>
          <FormGroup className="mb-0"><Label>Пароль *</Label><Input type="password" value={form.password} onChange={e => set('password', e.target.value)} required /></FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup className="mb-0"><Label>Телефон</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+380..." /></FormGroup>
          <FormGroup className="mb-0"><Label>Дата народження</Label><Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></FormGroup>
        </div>
        <FormGroup className="mb-4">
          <Label>Стать</Label>
          <Select value={form.sex} onChange={v => set('sex', v)}>
            <option value="">— Не вказано —</option>
            <option value="MALE">Чоловік</option>
            <option value="FEMALE">Жінка</option>
          </Select>
        </FormGroup>

        {/* Профіль лікаря */}
        <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-3 pb-1 border-b border-line">
          {isRad ? 'Профіль рентгенолога' : 'Профіль терапевта'}
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup className="mb-0"><Label>Номер ліцензії</Label><Input value={form.license_number} onChange={e => set('license_number', e.target.value)} /></FormGroup>
          <FormGroup className="mb-0"><Label>Стаж (роки)</Label><Input type="number" min="0" max="60" value={form.years_of_experience} onChange={e => set('years_of_experience', e.target.value)} /></FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {isRad ? (
            <FormGroup className="mb-0"><Label>Відділення</Label><Input value={form.department} onChange={e => set('department', e.target.value)} placeholder="Напр. КТ, МРТ" /></FormGroup>
          ) : (
            <FormGroup className="mb-0"><Label>Назва клініки</Label><Input value={form.clinic_name} onChange={e => set('clinic_name', e.target.value)} placeholder="Напр. Клініка Здоров'я" /></FormGroup>
          )}
          <FormGroup className="mb-0">
            <Label>Статус доступності</Label>
            <Select value={form.availability_status} onChange={v => set('availability_status', v)}>
              <option value="">— Доступний —</option>
              <option value="AVAILABLE">Доступний</option>
              <option value="BUSY">Зайнятий</option>
              <option value="OFF_DUTY">Не на роботі</option>
            </Select>
          </FormGroup>
        </div>
        <FormGroup className="mb-5">
          <Label>Медичний заклад</Label>
          <Select value={form.facility_id} onChange={v => set('facility_id', v)}>
            <option value="">— Не призначено —</option>
            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </FormGroup>

        {/* Спеціалізації */}
        {allSpecs.length > 0 && (
          <>
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-3 pb-1 border-b border-line">
              Спеціалізації
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {allSpecs.map(s => (
                <label key={s.id}
                  className={`flex items-center gap-2.5 p-3 rounded-[8px] border cursor-pointer transition-all ${
                    selectedSpecs.includes(s.id)
                      ? 'border-sky bg-sky/8 text-ink'
                      : 'border-line bg-panel-50 text-ink-muted hover:bg-panel-100'
                  }`}>
                  <input type="checkbox" checked={selectedSpecs.includes(s.id)}
                    onChange={e => setSelectedSpecs(prev =>
                      e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                    )}
                    className="w-4 h-4 accent-sky" />
                  <span className="text-[13px] font-medium">{s.name}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end pt-2 border-t border-line">
          <Button type="button" variant="secondary" onClick={() => { onClose(); reset() }}>Скасувати</Button>
          <Button type="submit" loading={loading}>Створити лікаря</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Facilities Section ────────────────────────────────────────────────────────
function FacilitiesSection() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ['facilities'], queryFn: api.adminGetFacilities })
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const qc = useQueryClient()
  const list = items as { id: number; name: string }[]

  async function add() {
    if (!name) return
    await api.adminCreateFacility({ name })
    qc.invalidateQueries({ queryKey: ['facilities'] })
    setName('')
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Медичні заклади</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Назва закладу..." value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }} />
            <Button onClick={add}>Додати</Button>
          </div>
          {isLoading ? <PageLoader /> : list.length === 0 ? (
            <p className="text-center py-6 text-[13px] text-ink-muted">Закладів ще немає</p>
          ) : (
            <div className="space-y-2">
              {list.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-[8px] bg-panel-50 border border-line group">
                  <div>
                    <span className="text-[13px] text-ink">{f.name}</span>
                    <span className="text-[11px] text-ink-muted ml-2">#{f.id}</span>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[6px] text-ink-subtle hover:text-rose hover:bg-rose/10 transition-all"
                    title="Видалити заклад">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Видалити заклад «${deleteTarget.name}»?`}
          description="Лікарі прив'язані до цього закладу збережуться, але посилання на заклад буде знято."
          onConfirm={async () => {
            await api.adminDeleteFacility(deleteTarget.id)
            qc.invalidateQueries({ queryKey: ['facilities'] })
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

// ── Specializations Section ───────────────────────────────────────────────────
function SpecializationsSection() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ['specs'], queryFn: api.adminGetSpecializations })
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const qc = useQueryClient()
  const list = items as { id: number; name: string }[]

  async function add() {
    if (!name) return
    await api.adminCreateSpecialization({ name })
    qc.invalidateQueries({ queryKey: ['specs'] })
    setName('')
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Спеціалізації</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Назва спеціалізації..." value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }} />
            <Button onClick={add}>Додати</Button>
          </div>
          {isLoading ? <PageLoader /> : list.length === 0 ? (
            <p className="text-center py-6 text-[13px] text-ink-muted">Спеціалізацій ще немає</p>
          ) : (
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-[8px] bg-panel-50 border border-line group">
                  <div>
                    <span className="text-[13px] text-ink">{s.name}</span>
                    <span className="text-[11px] text-ink-muted ml-2">#{s.id}</span>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ id: s.id, name: s.name })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[6px] text-ink-subtle hover:text-rose hover:bg-rose/10 transition-all"
                    title="Видалити спеціалізацію">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Видалити спеціалізацію «${deleteTarget.name}»?`}
          description="Буде знято з усіх лікарів, яким призначена ця спеціалізація."
          onConfirm={async () => {
            await api.adminDeleteSpecialization(deleteTarget.id)
            qc.invalidateQueries({ queryKey: ['specs'] })
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

// ── Add User Modal ────────────────────────────────────────────────────────────
function AddUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email:'', password:'', first_name:'', last_name:'', role:'PATIENT' })
  const [err, setErr]   = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true)
    try { await api.adminCreateUser(form); onCreated() }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новий користувач">
      {err && <Alert variant="error" className="mb-4">{err}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormGroup className="mb-0"><Label>Ім'я</Label><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></FormGroup>
          <FormGroup className="mb-0"><Label>Прізвище</Label><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></FormGroup>
        </div>
        <FormGroup className="mb-0"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></FormGroup>
        <FormGroup className="mb-0"><Label>Пароль</Label><Input type="password" value={form.password} onChange={e => set('password', e.target.value)} required /></FormGroup>
        <FormGroup className="mb-0">
          <Label>Роль</Label>
          <div className="grid grid-cols-2 gap-2">
            {[['PATIENT','Пацієнт'],['RADIOLOGIST','Рентгенолог'],['FAMILY_DOCTOR','Терапевт'],['ADMIN','Адмін']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => set('role', v)}
                className={`py-2 px-3 rounded-[8px] text-sm font-medium border transition-all ${form.role===v?'border-sky bg-sky/10 text-sky':'border-line bg-panel-50 text-ink-muted hover:bg-panel-100'}`}>
                {l}
              </button>
            ))}
          </div>
        </FormGroup>
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Скасувати</Button>
          <Button type="submit" loading={loading}>Створити</Button>
        </div>
      </form>
    </Modal>
  )
}
