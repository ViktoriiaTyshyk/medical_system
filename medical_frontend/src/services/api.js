const BASE = 'http://localhost:8000';

function token() {
  return localStorage.getItem('access_token');
}

async function request(method, path, body, isFormData = false) {
  const headers = {};
  if (token()) headers['Authorization'] = `Bearer ${token()}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.hash = '#login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  register: (data) => request('POST', '/auth/register', data),
  login: (data) => request('POST', '/auth/login', data),
  logout: (rt) => request('POST', `/auth/logout?refresh_token=${rt}`),

  // Users
  getMe: () => request('GET', '/users/me'),
  updateMe: (data) => request('PATCH', '/users/me', data),
  getUser: (id) => request('GET', `/users/${id}`),

  // Profiles
  getPatientProfile: (id) => request('GET', `/profiles/patient/${id}`),
  updatePatientProfile: (id, data) => request('PATCH', `/profiles/patient/${id}`, data),
  getRadiologistProfile: (id) => request('GET', `/profiles/radiologist/${id}`),
  updateRadiologistProfile: (id, data) => request('PATCH', `/profiles/radiologist/${id}`, data),
  getFamilyDoctorProfile: (id) => request('GET', `/profiles/family-doctor/${id}`),
  updateFamilyDoctorProfile: (id, data) => request('PATCH', `/profiles/family-doctor/${id}`, data),

  // Cases
  getCases: () => request('GET', '/cases'),
  createCase: (data) => request('POST', '/cases', data),
  getCase: (id) => request('GET', `/cases/${id}`),
  updateCase: (id, data) => request('PATCH', `/cases/${id}`, data),
  updateCaseStatus: (id, status) => request('PATCH', `/cases/${id}/status`, { status }),
  updateConclusion: (id, conclusion) => request('PATCH', `/cases/${id}/conclusion`, { conclusion }),
  signCase: (id) => request('POST', `/cases/${id}/sign`),
  getParticipants: (id) => request('GET', `/cases/${id}/participants`),
  addParticipant: (caseId, userId) => request('POST', `/cases/${caseId}/participants?user_id=${userId}`),
  getCaseFiles: (id) => request('GET', `/cases/${id}/files`),
  uploadCaseFile: (caseId, formData) => request('POST', `/cases/${caseId}/files`, formData, true),

  // Messages
  getMessages: (caseId) => request('GET', `/cases/${caseId}/messages`),
  sendMessage: (caseId, data) => request('POST', `/cases/${caseId}/messages`, data),
  editMessage: (id, data) => request('PATCH', `/messages/${id}`, data),
  deleteMessage: (id) => request('DELETE', `/messages/${id}`),

  // Files
  uploadFile: (formData) => request('POST', '/files/upload', formData, true),
  getFile: (id) => `${BASE}/files/${id}?token=${token()}`,
  deleteFile: (id) => request('DELETE', `/files/${id}`),

  // Patient routes
  getMyDoctor: () => request('GET', '/patients/my-doctor'),
  getMyCases: () => request('GET', '/patients/my-cases'),

  // Radiologist
  getRadiologistCases: () => request('GET', '/radiologists/my-cases'),

  // Family Doctor
  getDoctorCases: () => request('GET', '/family-doctors/my-cases'),
  getDoctorPatients: () => request('GET', '/family-doctors/my-patients'),

  // AI Analysis
  analyzeLung: (formData) => request('POST', '/ai/analyze', formData, true),
  proposeCase: (formData) => request('POST', '/ai/propose-case', formData, true),
  getRadiologists: () => request('GET', '/ai/radiologists'),
  consultRadiologist: (radiologistId, formData) =>
    request('POST', `/ai/consult-radiologist?radiologist_id=${radiologistId}`, formData, true),
};
