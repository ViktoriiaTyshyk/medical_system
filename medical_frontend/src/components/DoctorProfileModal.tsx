import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { PageLoader } from '@/components/ui/spinner'
import type { User } from '@/types'

interface Props {
  userId: number
  doctorRole: 'RADIOLOGIST' | 'FAMILY_DOCTOR'
  onClose: () => void
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(value) ? '#f59e0b' : '#374151'} strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2 border-b border-line/50 last:border-0">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  )
}

export function DoctorProfileModal({ userId, doctorRole, onClose }: Props) {
  const isRad = doctorRole === 'RADIOLOGIST'

  const { data: user, isLoading: loadingUser } = useQuery<User>({
    queryKey: ['user', userId],
    queryFn:  () => api.getUser(userId),
  })
  const { data: profile, isLoading: loadingProf } = useQuery({
    queryKey: ['profile', doctorRole, userId],
    queryFn:  () => isRad ? api.getRadiologistProfile(userId) : api.getFamilyDoctorProfile(userId),
  })
  const { data: reviews } = useQuery({
    queryKey: ['rad-reviews-pub', userId],
    queryFn:  () => api.getRadiologistReviews(userId),
    enabled:  isRad,
  })
  const { data: specs = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['doc-specs-pub', userId],
    queryFn:  () => api.getDoctorSpecializationsPublic(userId),
  })

  const p = (profile as Record<string, unknown>) || {}
  const revData = reviews as { average: number; count: number; reviews: Array<{ id: number; rating: number; comment?: string; created_at: string }> } | undefined

  const availLabel: Record<string, string> = {
    AVAILABLE: 'Доступний', BUSY: 'Зайнятий', OFF_DUTY: 'Не на зміні',
  }

  if (loadingUser || loadingProf) {
    return (
      <Modal open onClose={onClose} title="Профіль лікаря">
        <PageLoader />
      </Modal>
    )
  }
  if (!user) return null

  return (
    <Modal open onClose={onClose} title="Профіль лікаря" size="md">
      {/* Header */}
      <div className="flex items-start gap-4 pb-5 mb-5 border-b border-line">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky to-jade flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {user.first_name[0]}{user.last_name[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[17px] font-bold text-ink">
              {user.first_name} {user.last_name}
            </h3>
            <Badge variant={isRad ? 'yellow' : 'green'}>
              {isRad ? 'Рентгенолог' : 'Терапевт'}
            </Badge>
          </div>
          {isRad && revData && revData.count > 0 && (
            <div className="flex items-center gap-2">
              <Stars value={revData.average} />
              <span className="text-[13px] font-semibold text-ink">{revData.average}</span>
              <span className="text-[12px] text-ink-muted">({revData.count} відгуків)</span>
            </div>
          )}
          {isRad && revData && revData.count === 0 && (
            <p className="text-[12px] text-ink-muted">Відгуків поки немає</p>
          )}
        </div>
      </div>

      {/* Profile info */}
      <div className="mb-5">
        <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">Інформація</p>
        <div className="bg-panel-50 rounded-[10px] border border-line px-4 py-1">
          {isRad && <InfoRow label="Відділення" value={p.department as string} />}
          {!isRad && <InfoRow label="Клініка" value={p.clinic_name as string} />}
          <InfoRow label="Стаж" value={p.years_of_experience ? `${p.years_of_experience} р.` : null} />
          {isRad && <InfoRow label="Статус" value={availLabel[p.availability_status as string] || null} />}
        </div>
      </div>

      {/* Specializations */}
      {specs.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">Спеціалізації</p>
          <div className="flex flex-wrap gap-2">
            {specs.map(s => (
              <span key={s.id} className="text-[12px] px-3 py-1 rounded-full bg-sky/10 text-sky border border-sky/20 font-medium">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {isRad && revData && revData.reviews.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-2">
            Відгуки ({revData.count})
          </p>
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {revData.reviews.map(r => (
              <div key={r.id} className="bg-panel-50 border border-line rounded-[10px] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Stars value={r.rating} size={13} />
                  <span className="text-[11px] text-ink-muted">
                    {new Date(r.created_at).toLocaleDateString('uk')}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-[13px] text-ink">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
