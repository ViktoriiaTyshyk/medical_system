import { useState, useCallback } from 'react'

function StarRating({ value, max = 5, size = 12 }: { value: number; max?: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(value)
        const half   = !filled && i < value
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="none">
            <path d="M10 1l2.4 7H19l-5.7 4.1 2.2 6.9L10 15.2 4.5 19 6.7 12.1 1 8h6.6L10 1z"
              fill={filled ? '#f59e0b' : half ? 'url(#half)' : '#374151'}
              stroke="#f59e0b" strokeWidth={filled || half ? 0 : 0.5} />
          </svg>
        )
      })}
    </div>
  )
}

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
        колесо миші · зум | клік — 2.5×
      </div>
    </div>
  )
}
import { useNavigate } from 'react-router-dom'
import { Upload, X, ScanLine, Zap, Check, Info } from 'lucide-react'
import { api } from '@/services/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageLoader, Spinner } from '@/components/ui/spinner'
import { DoctorProfileModal } from '@/components/DoctorProfileModal'
import { cn } from '@/lib/utils'
import type { AiResult, Radiologist } from '@/types'

const CLASS_COLORS: Record<string, string> = {
  Atelectasis:'#f97316', Cardiomegaly:'#3b82f6', Effusion:'#06b6d4',
  Pneumothorax:'#ef4444', Infiltration:'#a855f7', 'Mass/Nodule':'#dc2626', Other:'#6b7280',
}

export function LungAnalysis() {
  const navigate = useNavigate()
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [result, setResult]     = useState<AiResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]       = useState('')
  const [savedCaseId, setSavedCaseId] = useState<number | null>(null)
  const [fsImg, setFsImg]       = useState<string | null>(null)

  // Radiologist modal
  const [showRadModal, setShowRadModal] = useState(false)
  const [viewDoctorId, setViewDoctorId] = useState<number | null>(null)
  const [radiologists, setRadiologists]   = useState<Radiologist[]>([])
  const [radWarning, setRadWarning]       = useState('')
  const [selectedRads, setSelectedRads]   = useState<Set<number>>(new Set())
  const [saving, setSaving]               = useState(false)
  const [radLoading, setRadLoading]       = useState(false)

  function pickFile(f: File) {
    setFile(f); setResult(null); setSavedCaseId(null); setError('')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) pickFile(f)
  }, [])

  async function analyze() {
    if (!file || analyzing) return
    setAnalyzing(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await api.analyzeLung(fd) as AiResult & { filename: string }
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка аналізу')
    } finally {
      setAnalyzing(false)
    }
  }

  async function openRadModal() {
    setShowRadModal(true); setRadLoading(true); setRadWarning(''); setSelectedRads(new Set())
    const urgency = result?.urgency || 'NORMAL'
    const data = await api.getRadiologists(urgency).catch(() => ({ radiologists: [], filtered: false, warning: null }))
    setRadiologists(data.radiologists)
    setRadWarning(data.warning || '')
    setRadLoading(false)
  }

  async function confirmRads() {
    if (!file || selectedRads.size === 0) return
    setSaving(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const { case_id } = await api.saveAnalysis('radiologist', [...selectedRads].join(','), fd, result)
      setSavedCaseId(case_id)
      setShowRadModal(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  const urgencyColor = result?.urgency === 'URGENT' ? 'border-rose text-rose' : 'border-jade text-jade'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">AI-аналіз рентгену</h1>
        <p className="text-ink-muted mt-1">Двоетапний скринінг легень</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <Card>
          <CardHeader><CardTitle>Завантаження знімку</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div
              className={cn(
                'border-2 border-dashed rounded-[10px] p-10 text-center cursor-pointer transition-all',
                'hover:border-sky hover:bg-sky/4',
                file ? 'border-sky bg-sky/4' : 'border-line'
              )}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
            >
              <ScanLine size={36} className={`mx-auto mb-3 ${file ? 'text-sky' : 'text-ink-muted opacity-40'}`} />
              {file ? (
                <div>
                  <p className="font-semibold text-sky">{file.name}</p>
                  <p className="text-[12px] text-ink-muted mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-ink mb-1">Перетягніть файл або клікніть</p>
                  <p className="text-[13px] text-ink-muted">JPEG, PNG · до 20 MB</p>
                </div>
              )}
            </div>
            <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />

            {preview && (
              <div className="mt-4 text-center">
                <img src={preview} onClick={() => setFsImg(preview)}
                  className="max-h-[180px] mx-auto rounded-[8px] border border-line cursor-zoom-in hover:border-sky transition-colors" />
              </div>
            )}

            {error && <Alert variant="error" className="mt-3">{error}</Alert>}

            <Button className="w-full mt-4" loading={analyzing} disabled={!file}
              onClick={analyze}>
              {analyzing ? 'Аналізую...' : 'Аналізувати'}
            </Button>
            {file && (
              <Button variant="ghost" size="sm" className="w-full mt-2"
                onClick={() => { setFile(null); setPreview(null); setResult(null); setSavedCaseId(null) }}>
                <X size={14} /> Очистити
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <div>
          {!result ? (
            <Card className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <ScanLine size={40} className="text-ink-subtle opacity-20 mb-3" />
              <p className="font-medium text-ink-muted">Результати з'являться тут</p>
              <p className="text-[13px] text-ink-subtle mt-1">Виберіть знімок і натисніть «Аналізувати»</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Binary result */}
              <Card className={cn('border-l-4', result.binary_abnormal ? 'border-l-rose' : 'border-l-jade')}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.binary_abnormal ? 'bg-rose/15' : 'bg-jade/15'}`}>
                      {result.binary_abnormal ? <Zap size={18} className="text-rose" /> : <Check size={18} className="text-jade" />}
                    </div>
                    <div>
                      <p className={`font-semibold ${result.binary_abnormal ? 'text-rose' : 'text-jade'}`}>
                        {result.binary_abnormal ? 'Виявлено відхилення' : 'Патологій не виявлено'}
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        Впевненість: {result.binary_abnormal ? Math.round(result.binary_prob * 100) : Math.round((1 - result.binary_prob) * 100)}%
                      </p>
                    </div>
                    {result.urgency === 'URGENT' && (
                      <Badge variant="red" className="ml-auto">ТЕРМІНОВО</Badge>
                    )}
                    {!result.binary_abnormal && (
                      <Badge variant="green" className="ml-auto">НОРМА</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stage-specific */}
              {result.stage !== 'healthy' && (
                <Card>
                  <CardContent className="pt-5">
                    {result.stage === 'unclassifiable' && (
                      <Alert variant="warning" className="mb-4">
                        Відхилення виявлено, але конкретна патологія не класифікована. Необхідна перевірка рентгенологом.
                      </Alert>
                    )}
                    {result.stage === 'classified' && (
                      <div className="flex items-center gap-2 mb-4">
                        <Badge variant="red">ТЕРМІНОВО</Badge>
                        <span className="font-bold text-rose">Виявлено: {result.top_label || result.top_class}</span>
                      </div>
                    )}
                    {result.multiclass && (
                      <div className="space-y-2">
                        {Object.entries(result.multiclass).sort(([,a],[,b]) => b - a).map(([name, prob]) => {
                          const pct = Math.round(prob * 100)
                          const col = CLASS_COLORS[name] || '#6b7280'
                          const label = result.labels?.[name] || name
                          return (
                            <div key={name}>
                              <div className="flex justify-between mb-1">
                                <span className="text-[12px] font-medium text-ink">{label}</span>
                                <span className="text-[12px] font-bold" style={{ color: col }}>{pct}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-panel-100">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {(preview || result.heatmap_base64) && (
                      <div className="mt-4 pt-4 border-t border-line">
                        <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide mb-3">Зображення</p>
                        <div className="flex gap-4 flex-wrap">
                          {preview && (
                            <div className="flex-1 min-w-[120px] text-center">
                              <p className="text-[10px] text-ink-muted mb-2">Оригінал</p>
                              <img src={preview} onClick={() => setFsImg(preview)}
                                className="rounded-[8px] border border-line cursor-zoom-in hover:border-sky transition-colors max-w-[180px] w-full mx-auto" />
                            </div>
                          )}
                          {result.heatmap_base64 && (
                            <div className="flex-1 min-w-[120px] text-center">
                              <p className="text-[10px] text-ink-muted mb-2">Теплова карта</p>
                              <img src={`data:image/png;base64,${result.heatmap_base64}`}
                                onClick={() => setFsImg(`data:image/png;base64,${result.heatmap_base64}`)}
                                className="rounded-[8px] border border-line cursor-zoom-in hover:border-sky transition-colors max-w-[180px] w-full mx-auto" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              {savedCaseId ? (
                <Card className="bg-jade/4 border-jade/25">
                  <CardContent className="pt-5">
                    <Alert variant="success" className="mb-3">
                      Справу #{savedCaseId} створено. Рентгенолог отримав доступ.
                    </Alert>
                    <Button className="w-full" onClick={() => navigate(`/cases/${savedCaseId}`)}>
                      Перейти до справи
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-5">
                    <p className="font-semibold text-ink mb-1">
                      {result.urgency === 'URGENT' ? '⚡ ТЕРМІНОВО — оберіть доступного рентгенолога' : 'Надішліть знімок рентгенологу'}
                    </p>
                    <p className="text-[13px] text-ink-muted mb-4">
                      Рентгенолог перевірить знімок та надасть висновок. Можна обрати кількох лікарів.
                    </p>
                    <Button className="w-full" onClick={openRadModal}>
                      Обрати рентгенолога
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full mt-2"
                      onClick={() => setResult(null)}>
                      Скасувати
                    </Button>
                  </CardContent>
                </Card>
              )}

              <p className="text-[12px] text-ink-muted text-center">
                ⚠️ Система проводить скринінг, не ставить діагноз. Потрібне підтвердження лікаря.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Radiologist modal */}
      <Modal open={showRadModal} onClose={() => setShowRadModal(false)} title="Вибрати рентгенолога(-ів)" size="md">
        {radWarning && <Alert variant="warning" className="mb-4">{radWarning}</Alert>}
        {radLoading ? <PageLoader /> : radiologists.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">Рентгенологів не знайдено</div>
        ) : (
          <div className="space-y-2 mb-5 max-h-[300px] overflow-y-auto">
            {radiologists.map(r => {
              const sel = selectedRads.has(r.id)
              const avail = r.availability_status
              const availColor = avail === 'AVAILABLE' ? 'text-jade' : avail === 'BUSY' ? 'text-amber' : 'text-ink-muted'
              const availLabel = avail === 'AVAILABLE' ? '● Доступний' : avail === 'BUSY' ? '● Зайнятий' : '● Не на зміні'
              return (
                <div key={r.id}
                  className={cn(
                    'w-full flex items-center gap-2 p-3 rounded-[10px] border transition-all',
                    sel ? 'border-sky bg-sky/8' : 'border-line bg-panel-50'
                  )}>
                  <button type="button" className="flex-1 text-left"
                    onClick={() => setSelectedRads(prev => {
                      const s = new Set(prev)
                      s.has(r.id) ? s.delete(r.id) : s.add(r.id)
                      return s
                    })}>
                    <p className="font-semibold text-[14px] text-ink">
                      {sel && <Check size={13} className="inline mr-1.5 text-sky" />}
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {r.department}{r.years_of_experience ? ` · ${r.years_of_experience} р. досвіду` : ''}
                    </p>
                    {(r.average_rating !== undefined) && (
                      <div className="flex items-center gap-1 mt-1">
                        <StarRating value={r.average_rating} />
                        <span className="text-[11px] text-ink-muted">
                          {r.average_rating > 0 ? `${r.average_rating} (${r.review_count})` : 'немає відгуків'}
                        </span>
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[11px] font-semibold ${availColor}`}>{availLabel}</span>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); setViewDoctorId(r.id) }}
                      className="flex items-center gap-1 text-[11px] text-sky hover:text-sky-dark transition-colors">
                      <Info size={12} /> Профіль
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowRadModal(false)}>Скасувати</Button>
          <Button disabled={selectedRads.size === 0} loading={saving} onClick={confirmRads}>
            Надіслати ({selectedRads.size})
          </Button>
        </div>
      </Modal>

      {/* Fullscreen з зумом */}
      {fsImg && <FullscreenImage src={fsImg} onClose={() => setFsImg(null)} />}

      {/* Doctor profile view */}
      {viewDoctorId && (
        <DoctorProfileModal
          userId={viewDoctorId}
          doctorRole="RADIOLOGIST"
          onClose={() => setViewDoctorId(null)}
        />
      )}
    </div>
  )
}
