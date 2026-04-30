import { api } from '../services/api.js';
import { auth } from '../context/auth.js';

export function AdminPage() {
  const el = document.createElement('div');
  let activeTab = 'users';

  async function load() {
    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⚙️ Адмін панель</h1>
        <p class="page-subtitle">Управління системою</p>
      </div>
      <div class="tabs">
        <button class="tab active" data-tab="users">👤 Користувачі</button>
        <button class="tab" data-tab="facilities">🏥 Заклади</button>
        <button class="tab" data-tab="specializations">🎓 Спеціалізації</button>
      </div>
      <div id="admin-content"></div>
    `;

    el.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        renderTab(activeTab);
      });
    });

    renderTab('users');
  }

  async function renderTab(tab) {
    const content = el.querySelector('#admin-content');
    if (tab === 'users') await renderUsers(content);
    else if (tab === 'facilities') await renderFacilities(content);
    else if (tab === 'specializations') await renderSpecializations(content);
  }

  async function renderUsers(content) {
    content.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
    try {
      const users = await api.adminGetUsers();
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Всі користувачі (${users.length})</span>
            <button class="btn btn-primary btn-sm" id="add-user-btn">＋ Додати</button>
          </div>
          <div id="u-alert"></div>
          <div id="u-modal"></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Ім'я</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td class="text-muted">${u.id}</td>
                    <td>${u.first_name} ${u.last_name}</td>
                    <td class="text-muted">${u.email}</td>
                    <td>${u.roles?.map(r => `<span class="badge badge-blue">${r.name}</span>`).join(' ') || '-'}</td>
                    <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}">${u.status}</span></td>
                    <td>
                      <button class="btn btn-danger btn-sm" data-uid="${u.id}" data-status="${u.status}">
                        ${u.status === 'ACTIVE' ? 'Деактивувати' : 'Активувати'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      content.querySelector('#add-user-btn').addEventListener('click', () => showAddUser(content));

      content.querySelectorAll('[data-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const newStatus = btn.dataset.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          try {
            await api.adminUpdateStatus(btn.dataset.uid, newStatus);
            content.querySelector('#u-alert').innerHTML = '<div class="alert alert-success">Статус оновлено!</div>';
            setTimeout(() => renderUsers(content), 800);
          } catch (e) {
            content.querySelector('#u-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
          }
        });
      });
    } catch (e) {
      content.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  function showAddUser(content) {
    const modal = content.querySelector('#u-modal');
    modal.innerHTML = `
      <div class="modal-overlay" id="add-overlay">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">Новий користувач</span>
            <button class="modal-close" id="close-add">✕</button>
          </div>
          <div id="add-alert"></div>
          <div class="form-row">
            <div class="form-group"><label>Ім'я *</label><input type="text" id="a-fname" /></div>
            <div class="form-group"><label>Прізвище *</label><input type="text" id="a-lname" /></div>
          </div>
          <div class="form-group"><label>Email *</label><input type="email" id="a-email" /></div>
          <div class="form-group"><label>Телефон</label><input type="text" id="a-phone" /></div>
          <div class="form-group"><label>Пароль *</label><input type="password" id="a-pass" /></div>
          <div class="form-group">
            <label>Роль *</label>
            <select id="a-role">
              <option value="PATIENT">Пацієнт</option>
              <option value="FAMILY_DOCTOR">Сімейний лікар</option>
              <option value="RADIOLOGIST">Рентгенолог</option>
              <option value="ADMIN">Адмін</option>
            </select>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-add">Скасувати</button>
            <button class="btn btn-primary" id="submit-add">Створити</button>
          </div>
        </div>
      </div>
    `;

    modal.querySelector('#close-add').addEventListener('click', () => modal.innerHTML = '');
    modal.querySelector('#cancel-add').addEventListener('click', () => modal.innerHTML = '');

    modal.querySelector('#submit-add').addEventListener('click', async () => {
      const data = {
        first_name: modal.querySelector('#a-fname').value.trim(),
        last_name: modal.querySelector('#a-lname').value.trim(),
        email: modal.querySelector('#a-email').value.trim(),
        phone: modal.querySelector('#a-phone').value.trim() || undefined,
        password: modal.querySelector('#a-pass').value,
        roles: [modal.querySelector('#a-role').value],
      };
      if (!data.first_name || !data.last_name || !data.email || !data.password) {
        modal.querySelector('#add-alert').innerHTML = '<div class="alert alert-error">Заповніть всі поля</div>';
        return;
      }
      try {
        await api.adminCreateUser(data);
        modal.innerHTML = '';
        renderUsers(content);
      } catch (e) {
        modal.querySelector('#add-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
      }
    });
  }

  async function renderFacilities(content) {
    content.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
    try {
      const facilities = await api.adminGetFacilities();
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Медичні заклади</span>
            <button class="btn btn-primary btn-sm" id="add-fac-btn">＋ Додати</button>
          </div>
          <div id="fac-form" style="display:none;margin-bottom:16px">
            <div class="form-row">
              <div class="form-group"><label>Назва *</label><input type="text" id="fac-name" /></div>
              <div class="form-group"><label>Телефон</label><input type="text" id="fac-phone" /></div>
            </div>
            <div class="form-group"><label>Адреса</label><input type="text" id="fac-addr" /></div>
            <div id="fac-alert"></div>
            <button class="btn btn-primary btn-sm" id="save-fac">Зберегти</button>
          </div>
          ${facilities.length === 0 ? '<div class="empty"><div class="empty-title">Закладів немає</div></div>' : `
          <table>
            <thead><tr><th>ID</th><th>Назва</th><th>Адреса</th><th>Телефон</th></tr></thead>
            <tbody>
              ${facilities.map(f => `
                <tr>
                  <td class="text-muted">${f.id}</td>
                  <td><strong>${f.name}</strong></td>
                  <td class="text-muted">${f.address || '-'}</td>
                  <td class="text-muted">${f.phone || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`}
        </div>
      `;

      content.querySelector('#add-fac-btn').addEventListener('click', () => {
        content.querySelector('#fac-form').style.display = 'block';
      });

      content.querySelector('#save-fac')?.addEventListener('click', async () => {
        try {
          await api.adminCreateFacility({
            name: content.querySelector('#fac-name').value,
            address: content.querySelector('#fac-addr').value,
            phone: content.querySelector('#fac-phone').value,
          });
          renderFacilities(content);
        } catch (e) {
          content.querySelector('#fac-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      });
    } catch (e) {
      content.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  async function renderSpecializations(content) {
    content.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
    try {
      const specs = await api.adminGetSpecializations();
      content.innerHTML = `
        <div class="card" style="max-width:500px">
          <div class="card-header"><span class="card-title">Спеціалізації</span></div>
          <div class="flex gap-8 mb-16">
            <input type="text" id="spec-name" placeholder="Назва спеціалізації" />
            <button class="btn btn-primary" id="add-spec">Додати</button>
          </div>
          <div id="spec-alert"></div>
          ${specs.map(s => `
            <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <span>${s.name}</span>
              <span class="text-muted text-sm">#${s.id}</span>
            </div>
          `).join('') || '<div class="empty"><div class="empty-title">Спеціалізацій немає</div></div>'}
        </div>
      `;

      content.querySelector('#add-spec').addEventListener('click', async () => {
        const name = content.querySelector('#spec-name').value.trim();
        if (!name) return;
        try {
          await api.adminCreateSpecialization({ name });
          renderSpecializations(content);
        } catch (e) {
          content.querySelector('#spec-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      });
    } catch (e) {
      content.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  load();
  return el;
}
