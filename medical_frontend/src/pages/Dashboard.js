import { api } from '../services/api.js';
import { auth } from '../context/auth.js';

export function DashboardPage(navigate) {
  const el = document.createElement('div');
  const user = auth.getUser();
  const role = auth.getRole();

  const roleLabel = { PATIENT: 'Пацієнт', RADIOLOGIST: 'Рентгенолог', FAMILY_DOCTOR: 'Сімейний лікар', ADMIN: 'Адміністратор' };
  const roleIcon = { PATIENT: '🧑‍🦽', RADIOLOGIST: '🩻', FAMILY_DOCTOR: '👨‍⚕️', ADMIN: '⚙️' };

  async function load() {
    el.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;

    let cases = [];
    try {
      if (role === 'PATIENT') cases = await api.getMyCases().catch(() => []);
      else if (role === 'RADIOLOGIST') cases = await api.getRadiologistCases().catch(() => []);
      else if (role === 'FAMILY_DOCTOR') cases = await api.getDoctorCases().catch(() => []);
      else cases = await api.getCases().catch(() => []);
    } catch {}

    const open = cases.filter(c => c.status === 'OPEN').length;
    const inProgress = cases.filter(c => c.status === 'IN_PROGRESS').length;
    const completed = cases.filter(c => c.status === 'COMPLETED').length;

    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Вітаємо, ${user?.first_name || ''} ${roleIcon[role] || ''}</h1>
        <p class="page-subtitle">${roleLabel[role] || role} · ${new Date().toLocaleDateString('uk', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
      </div>

      <div class="grid-4 mb-16">
        <div class="stat-card">
          <div class="stat-label">Всього кейсів</div>
          <div class="stat-value">${cases.length}</div>
          <div class="stat-change">↑ всі кейси</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Відкриті</div>
          <div class="stat-value" style="color:var(--accent-blue)">${open}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">В процесі</div>
          <div class="stat-value" style="color:var(--accent-yellow)">${inProgress}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Завершені</div>
          <div class="stat-value" style="color:var(--accent)">${completed}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Останні кейси</span>
          <button class="btn btn-secondary btn-sm" id="see-all">Всі кейси →</button>
        </div>
        ${cases.length === 0 ? `
          <div class="empty">
            <div class="empty-icon">📋</div>
            <div class="empty-title">Кейсів поки немає</div>
            <div class="empty-desc">Нові кейси з'являться тут</div>
          </div>
        ` : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Назва</th><th>Статус</th><th>Дата</th><th></th></tr>
              </thead>
              <tbody>
                ${cases.slice(0, 5).map(c => `
                  <tr>
                    <td class="text-muted">${c.id}</td>
                    <td><strong>${c.title}</strong></td>
                    <td><span class="badge ${
                      c.status === 'OPEN' ? 'badge-blue' :
                      c.status === 'IN_PROGRESS' ? 'badge-yellow' :
                      c.status === 'COMPLETED' ? 'badge-green' : 'badge-gray'
                    }">${c.status}</span></td>
                    <td class="text-muted">${new Date(c.created_at).toLocaleDateString('uk')}</td>
                    <td><button class="btn btn-secondary btn-sm" data-case="${c.id}">→</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    el.querySelector('#see-all').addEventListener('click', () => navigate('cases'));
    el.querySelectorAll('[data-case]').forEach(btn => {
      btn.addEventListener('click', () => navigate('case', btn.dataset.case));
    });
  }

  load();
  return el;
}
