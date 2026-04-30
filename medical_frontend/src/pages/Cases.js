import { api } from '../services/api.js';
import { auth } from '../context/auth.js';

const STATUS_BADGE = {
  PENDING: 'badge-gray',
  OPEN: 'badge-blue',
  IN_PROGRESS: 'badge-yellow',
  COMPLETED: 'badge-green',
  CLOSED: 'badge-gray',
};
const STATUS_LABEL = {
  PENDING: 'Очікує',
  OPEN: 'Відкритий',
  IN_PROGRESS: 'В процесі',
  COMPLETED: 'Завершено',
  CLOSED: 'Закрито',
};

export function CasesPage(navigate) {
  const el = document.createElement('div');
  const role = auth.getRole();

  async function load() {
    el.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
    try {
      let cases = [];
      if (role === 'PATIENT') cases = await api.getMyCases();
      else if (role === 'RADIOLOGIST') cases = await api.getRadiologistCases();
      else if (role === 'FAMILY_DOCTOR') cases = await api.getDoctorCases();
      else cases = await api.getCases();

      // Розбити PENDING окремо для лікаря
      const pendingCases = cases.filter(c => c.status === 'PENDING');
      const activeCases = cases.filter(c => c.status !== 'PENDING');

      el.innerHTML = `
        <div class="page-header">
          <div class="flex-between">
            <div>
              <h1 class="page-title">Медичні кейси</h1>
              <p class="page-subtitle">${cases.length} кейсів знайдено</p>
            </div>
            ${role !== 'PATIENT' && role !== 'RADIOLOGIST' ? `
              <button class="btn btn-primary" id="create-case-btn">＋ Новий кейс</button>
            ` : ''}
          </div>
        </div>
        <div id="create-modal"></div>

        ${pendingCases.length > 0 && (role === 'FAMILY_DOCTOR' || role === 'ADMIN') ? `
          <!-- Блок PENDING кейсів -->
          <div class="card" style="border-left: 4px solid #f59e0b; margin-bottom: 20px">
            <div class="card-header">
              <span class="card-title">⏳ Очікують вашого рішення (${pendingCases.length})</span>
            </div>
            <p style="font-size:13px; color:var(--text2); margin-bottom:12px">
              Пацієнти надіслали рентгенівські знімки через AI-аналіз. Активуйте кейс для початку роботи.
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Назва</th>
                    <th>Пацієнт ID</th>
                    <th>Дата</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingCases.map(c => `
                    <tr>
                      <td class="text-muted">${c.id}</td>
                      <td><strong>${c.title}</strong></td>
                      <td class="text-muted">${c.patient_id}</td>
                      <td class="text-muted">${new Date(c.created_at).toLocaleDateString('uk')}</td>
                      <td style="display:flex; gap:6px">
                        <button class="btn btn-primary btn-sm activate-btn" data-id="${c.id}">
                          ✅ Активувати
                        </button>
                        <button class="btn btn-secondary btn-sm" data-case="${c.id}">Відкрити</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- Основна таблиця активних кейсів -->
        <div class="card">
          <div class="table-wrap">
            ${activeCases.length === 0 ? `
              <div class="empty">
                <div class="empty-icon">📋</div>
                <div class="empty-title">Кейсів поки немає</div>
                <div class="empty-desc">Нові кейси з'являться тут</div>
              </div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Назва</th>
                    <th>Статус</th>
                    <th>Пацієнт ID</th>
                    <th>Дата</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${activeCases.map(c => `
                    <tr>
                      <td class="text-muted">${c.id}</td>
                      <td><strong>${c.title}</strong></td>
                      <td><span class="badge ${STATUS_BADGE[c.status] || 'badge-gray'}">${STATUS_LABEL[c.status] || c.status}</span></td>
                      <td class="text-muted">${c.patient_id}</td>
                      <td class="text-muted">${new Date(c.created_at).toLocaleDateString('uk')}</td>
                      <td>
                        <button class="btn btn-secondary btn-sm" data-case="${c.id}">Відкрити →</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `;

      // Відкрити кейс
      el.querySelectorAll('[data-case]').forEach(btn => {
        btn.addEventListener('click', () => navigate('case', btn.dataset.case));
      });

      // Активувати PENDING кейс одразу зі списку
      el.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const caseId = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = '...';
          try {
            await api.updateCaseStatus(parseInt(caseId), 'OPEN');
            load(); // оновити список
          } catch (err) {
            btn.disabled = false;
            btn.textContent = '✅ Активувати';
            alert(err.message);
          }
        });
      });

      const createBtn = el.querySelector('#create-case-btn');
      if (createBtn) createBtn.addEventListener('click', () => showCreateModal());

    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">Помилка: ${e.message}</div>`;
    }
  }

  function showCreateModal() {
    const modal = el.querySelector('#create-modal');
    modal.innerHTML = `
      <div class="modal-overlay" id="overlay">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Новий медичний кейс</span>
            <button class="modal-close" id="close-modal">✕</button>
          </div>
          <div id="modal-alert"></div>
          <div class="form-group">
            <label>Назва кейсу *</label>
            <input type="text" id="m-title" placeholder="Рентген легень..." />
          </div>
          <div class="form-group">
            <label>Опис</label>
            <textarea id="m-desc" placeholder="Опис симптомів та скарг..."></textarea>
          </div>
          <div class="form-group">
            <label>ID Пацієнта *</label>
            <input type="number" id="m-patient" placeholder="1" />
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="close-modal2">Скасувати</button>
            <button class="btn btn-primary" id="submit-case">Створити кейс</button>
          </div>
        </div>
      </div>
    `;

    modal.querySelector('#close-modal').addEventListener('click', () => modal.innerHTML = '');
    modal.querySelector('#close-modal2').addEventListener('click', () => modal.innerHTML = '');
    modal.querySelector('#overlay').addEventListener('click', (e) => {
      if (e.target.id === 'overlay') modal.innerHTML = '';
    });

    modal.querySelector('#submit-case').addEventListener('click', async () => {
      const title = modal.querySelector('#m-title').value.trim();
      const description = modal.querySelector('#m-desc').value.trim();
      const patient_id = parseInt(modal.querySelector('#m-patient').value);
      if (!title || !patient_id) {
        modal.querySelector('#modal-alert').innerHTML =
          '<div class="alert alert-error">Заповніть обов\'язкові поля</div>';
        return;
      }
      try {
        await api.createCase({ title, description, patient_id });
        modal.innerHTML = '';
        load();
      } catch (e) {
        modal.querySelector('#modal-alert').innerHTML =
          `<div class="alert alert-error">${e.message}</div>`;
      }
    });
  }

  load();
  return el;
}
