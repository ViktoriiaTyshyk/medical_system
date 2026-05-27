import type { Case, CaseFile, Message, User, Radiologist, FamilyDoctor, ReportTemplate } from '@/types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function token() { return localStorage.getItem('access_token') }

async function req<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {}
  if (token()) headers['Authorization'] = `Bearer ${token()}`
  if (!isForm && body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? (body as BodyInit) : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.clear()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = err.detail
    const message = Array.isArray(detail)
      ? detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ')
      : detail || 'Request failed'
    throw new Error(message)
  }

  if (res.status === 204) return null as T
  return res.json()
}

async function fetchBlob(path: string): Promise<{ blob: Blob; contentType: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  })
  if (!res.ok) throw new Error('Файл не знайдено')
  return { blob: await res.blob(), contentType: res.headers.get('content-type') || '' }
}

export const api = {
  // Auth
  login:    (data: unknown) => req<{ access_token: string; refresh_token: string }>('POST', '/auth/login', data),
  register: (data: unknown) => req<{ access_token: string; refresh_token: string }>('POST', '/auth/register', data),
  logout: (rt: string)      => req('POST', `/auth/logout?refresh_token=${rt}`),

  // Me
  getMe:    ()       => req<User>('GET', '/users/me'),
  updateMe: (d: unknown) => req<User>('PATCH', '/users/me', d),
  getUser:  (id: number) => req<User>('GET', `/users/${id}`),
  searchUsers: (q: string, role?: string) =>
    req<User[]>('GET', `/users/search?q=${encodeURIComponent(q)}${role ? '&role=' + role : ''}`),

  // Profiles
  getPatientProfile:   (id: number)      => req('GET', `/profiles/patient/${id}`),
  updatePatientProfile:(id: number, d: unknown) => req('PATCH', `/profiles/patient/${id}`, d),
  getRadiologistProfile:(id: number)     => req('GET', `/profiles/radiologist/${id}`),
  getDoctorSpecializationsPublic: (id: number) =>
    req<Array<{ id: number; name: string }>>('GET', `/profiles/doctor/${id}/specializations`),

  // Cases
  getCases:   () => req<Case[]>('GET', '/cases'),
  getMyCases: () => req<Case[]>('GET', '/patients/my-cases'),
  getRadiologistCases: () => req<Case[]>('GET', '/radiologists/my-cases'),
  getDoctorCases:      () => req<Case[]>('GET', '/family-doctors/my-cases'),
  getCase:    (id: number) => req<Case>('GET', `/cases/${id}`),
  createCase: (d: unknown) => req<Case>('POST', '/cases', d),
  updateCase: (id: number, d: unknown) => req<Case>('PATCH', `/cases/${id}`, d),
  updateCaseStatus: (id: number, status: string) => req<Case>('PATCH', `/cases/${id}/status`, { status }),
  saveTherapistNote: (id: number, note: string, close: boolean) =>
    req<Case>('POST', `/cases/${id}/therapist-note`, { note, close_case: close }),

  // Messages
  getMessages: (caseId: number)  => req<Message[]>('GET', `/cases/${caseId}/messages`),
  sendMessage: (caseId: number, d: unknown) => req<Message>('POST', `/cases/${caseId}/messages`, d),

  // Files
  getCaseFiles:   (caseId: number)  => req<CaseFile[]>('GET', `/cases/${caseId}/files`),
  uploadCaseFile: (caseId: number, fd: FormData) => req('POST', `/cases/${caseId}/files`, fd, true),
  fetchFileBlob:  (id: number) => fetchBlob(`/files/${id}`),
  fetchPdfReport: async (caseId: number) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const res = await fetch(`${BASE}/ai/report/${caseId}?tz=${encodeURIComponent(tz)}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
    if (!res.ok) throw new Error('Звіт недоступний')
    return res.blob()
  },

  // Patient
  getMyDoctor: ()         => req<User>('GET', '/patients/my-doctor'),
  setMyDoctor: (id: number) => req('PATCH', '/patients/my-doctor', { family_doctor_id: id }),
  getPendingReviews: () =>
    req<Array<{ case_id: number; case_title: string; radiologist_id: number; radiologist_name: string }>>(
      'GET', '/patients/pending-reviews'
    ),

  // Radiologist
  setAvailability:  (s: string) => req('PATCH', `/radiologists/availability?status=${s}`),
  getReportTemplates: () => req<ReportTemplate[]>('GET', '/radiologists/report-templates'),
  submitReport: (caseId: number, d: unknown) => req('POST', `/radiologists/my-cases/${caseId}/report`, d),

  // Family doctors
  listFamilyDoctors: (q: string) =>
    req<FamilyDoctor[]>('GET', `/family-doctors/list?q=${encodeURIComponent(q)}`),

  // AI
  analyzeLung: (fd: FormData) => req('POST', '/ai/analyze', fd, true),
  saveAnalysis: (saveType: string, radIds: string, fd: FormData, result?: unknown) => {
    if (result) fd.append('analysis_result_json', JSON.stringify(result))
    fd.append('save_type', saveType)
    if (radIds) fd.append('radiologist_ids', radIds)
    return req<{ case_id: number; urgency: string }>('POST', '/ai/save-analysis', fd, true)
  },
  addRadiologistToCase: (caseId: number, radId: number) =>
    req('POST', `/ai/add-radiologist?case_id=${caseId}&radiologist_id=${radId}`),
  getRadiologists: (urgency = 'NORMAL') =>
    req<{ radiologists: Radiologist[]; filtered: boolean; warning: string | null }>(
      'GET', `/ai/radiologists?urgency=${urgency}`
    ),
  sendAiMessage: (caseId: number, message: string, history: Array<{ role: string; content: string }>) =>
    req<{ reply: string }>('POST', `/cases/${caseId}/ai-chat`, { message, history }),

  // Reviews
  submitReview: (caseId: number, radiologistId: number, rating: number, comment?: string) =>
    req('POST', `/cases/${caseId}/review`, { radiologist_id: radiologistId, rating, comment }),
  getRadiologistReviews: (radId: number) =>
    req<{ average: number; count: number; reviews: Array<{ id: number; rating: number; comment?: string; created_at: string }> }>(
      'GET', `/radiologists/${radId}/reviews`
    ),
  getCaseParticipants: (caseId: number) =>
    req<Array<{ id: number; case_id: number; user_id: number; joined_at: string }>>('GET', `/cases/${caseId}/participants`),

  // Admin
  adminGetUsers:    () => req<User[]>('GET', '/admin/users'),
  adminCreateUser:  (d: unknown) => req<User>('POST', '/admin/users', d),
  adminUpdateUser:  (id: number, d: unknown) => req<User>('PATCH', `/admin/users/${id}`, d),
  adminUpdateStatus:(id: number, status: string) => req('PATCH', `/admin/users/${id}/status`, { status }),
  adminCreateDoctor: (d: unknown) => req('POST', '/admin/doctors', d),
  adminGetFacilities:      () => req('GET', '/admin/facilities'),
  adminCreateFacility:     (d: unknown) => req('POST', '/admin/facilities', d),
  adminGetSpecializations: () => req('GET', '/admin/specializations'),
  adminCreateSpecialization:(d: unknown) => req('POST', '/admin/specializations', d),
  updateRadiologistProfile: (id: number, d: unknown) => req('PATCH', `/profiles/radiologist/${id}`, d),
  getFamilyDoctorProfile:   (id: number) => req('GET', `/profiles/family-doctor/${id}`),
  updateFamilyDoctorProfile:(id: number, d: unknown) => req('PATCH', `/profiles/family-doctor/${id}`, d),
  adminGetDoctorSpecializations: (userId: number) =>
    req<Array<{ id: number; name: string }>>('GET', `/admin/doctors/${userId}/specializations`),
  adminSetDoctorSpecializations: (userId: number, ids: number[]) =>
    req('PUT', `/admin/doctors/${userId}/specializations`, { specialization_ids: ids }),

  // Admin delete
  adminDeleteUser:           (id: number) => req('DELETE', `/admin/users/${id}`),
  adminDeleteCase:           (id: number) => req('DELETE', `/admin/cases/${id}`),
  adminDeleteFacility:       (id: number) => req('DELETE', `/admin/facilities/${id}`),
  adminDeleteSpecialization: (id: number) => req('DELETE', `/admin/specializations/${id}`),
  adminGetAllCases: () =>
    req<Array<{ id: number; title: string; status: string; urgency: string; patient_id: number; created_at: string }>>(
      'GET', '/admin/cases'
    ),
}
