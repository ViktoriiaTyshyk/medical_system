import { auth } from './context/auth.js';
import { Sidebar } from './components/Sidebar.js';
import { LoginPage } from './pages/Login.js';
import { RegisterPage } from './pages/Register.js';
import { DashboardPage } from './pages/Dashboard.js';
import { CasesPage } from './pages/Cases.js';
import { CaseDetailPage } from './pages/CaseDetail.js';
import { ProfilePage } from './pages/Profile.js';
import { AdminPage } from './pages/Admin.js';
import { LungAnalysisPage } from './pages/LungAnalysis.js';

const app = document.getElementById('app');
let currentPage = 'dashboard';
let currentParam = null;

function getHashPage() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const [page, param] = hash.split('/');
  return { page, param };
}

function navigate(page, param = null) {
  currentPage = page;
  currentParam = param;
  window.location.hash = param ? `${page}/${param}` : page;
  render();
}

function render() {
  app.innerHTML = '';

  if (!auth.isLoggedIn()) {
    const { page } = getHashPage();
    if (page === 'register') {
      app.appendChild(RegisterPage(() => navigate('dashboard')));
    } else {
      app.appendChild(LoginPage(() => navigate('dashboard')));
    }
    return;
  }

  const { page, param } = getHashPage();
  currentPage = page;
  currentParam = param;

  const layout = document.createElement('div');
  layout.className = 'layout';

  const sidebar = Sidebar(page, navigate, () => navigate('login'));
  layout.appendChild(sidebar);

  const content = document.createElement('div');
  content.className = 'main-content';

  if (page === 'dashboard') content.appendChild(DashboardPage(navigate));
  else if (page === 'cases') content.appendChild(CasesPage(navigate));
  else if (page === 'case' && param) content.appendChild(CaseDetailPage(parseInt(param), navigate));
  else if (page === 'profile') content.appendChild(ProfilePage());
  else if (page === 'admin') content.appendChild(AdminPage());
  else if (page === 'lung-analysis') content.appendChild(LungAnalysisPage(navigate));
  else content.appendChild(DashboardPage(navigate));

  layout.appendChild(content);
  app.appendChild(layout);
}

window.addEventListener('hashchange', () => render());
render();
