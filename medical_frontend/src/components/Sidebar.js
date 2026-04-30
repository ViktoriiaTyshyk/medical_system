import { auth } from '../context/auth.js';

const roleMenus = {
  PATIENT: [
    { icon: '🏠', label: 'Дашборд', page: 'dashboard' },
    { icon: '📋', label: 'Мої кейси', page: 'cases' },
    { icon: '🩻', label: 'AI-аналіз рентгену', page: 'lung-analysis' },
    { icon: '👤', label: 'Профіль', page: 'profile' },
  ],
  RADIOLOGIST: [
    { icon: '🏠', label: 'Дашборд', page: 'dashboard' },
    { icon: '🩻', label: 'Призначені кейси', page: 'cases' },
    { icon: '👤', label: 'Профіль', page: 'profile' },
  ],
  FAMILY_DOCTOR: [
    { icon: '🏠', label: 'Дашборд', page: 'dashboard' },
    { icon: '📋', label: 'Кейси', page: 'cases' },
    { icon: '👤', label: 'Профіль', page: 'profile' },
  ],
  ADMIN: [
    { icon: '🏠', label: 'Дашборд', page: 'dashboard' },
    { icon: '📋', label: 'Кейси', page: 'cases' },
    { icon: '⚙️', label: 'Адмін панель', page: 'admin' },
    { icon: '👤', label: 'Профіль', page: 'profile' },
  ],
};

export function Sidebar(currentPage, navigate, onLogout) {
  const user = auth.getUser();
  const role = auth.getRole();
  const menu = roleMenus[role] || roleMenus.PATIENT;
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`;

  const el = document.createElement('div');
  el.className = 'sidebar';
  el.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-icon">🏥</div>
      <span>MedSystem</span>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-label">Навігація</div>
        ${menu.map(item => `
          <button class="nav-item ${currentPage === item.page ? 'active' : ''}" data-page="${item.page}">
            <span class="icon">${item.icon}</span>
            ${item.label}
          </button>
        `).join('')}
      </div>
    </nav>
    <div class="sidebar-user">
      <div class="user-avatar">${initials}</div>
      <div class="user-info">
        <div class="user-name">${user?.first_name || ''} ${user?.last_name || ''}</div>
        <div class="user-role">${role || ''}</div>
      </div>
      <button class="logout-btn" id="logout-btn" title="Вийти">⏻</button>
    </div>
  `;

  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  el.querySelector('#logout-btn').addEventListener('click', async () => {
    await auth.logout();
    onLogout();
  });

  return el;
}
