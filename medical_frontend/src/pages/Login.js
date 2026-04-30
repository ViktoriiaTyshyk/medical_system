import { auth } from '../context/auth.js';

export function LoginPage(onLogin) {
  const el = document.createElement('div');
  el.className = 'auth-page';
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-icon">🏥</div>
        <span class="auth-logo-text">MedSystem</span>
      </div>
      <h1 class="auth-title">Вхід</h1>
      <p class="auth-subtitle">Увійдіть до медичної платформи</p>
      <div id="auth-alert"></div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="email" placeholder="your@email.com" />
      </div>
      <div class="form-group">
        <label>Пароль</label>
        <input type="password" id="password" placeholder="••••••••" />
      </div>
      <button class="btn btn-primary btn-full" id="login-btn">Увійти</button>
      <div class="auth-link">
        Немає акаунту? <a href="#register">Зареєструватись</a>
      </div>
    </div>
  `;

  const alertEl = el.querySelector('#auth-alert');
  const btn = el.querySelector('#login-btn');

  async function doLogin() {
    const email = el.querySelector('#email').value.trim();
    const password = el.querySelector('#password').value;
    if (!email || !password) {
      alertEl.innerHTML = '<div class="alert alert-error">Заповніть всі поля</div>';
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Вхід...';
    try {
      const user = await auth.login(email, password);
      onLogin(user);
    } catch (e) {
      alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
      btn.disabled = false;
      btn.textContent = 'Увійти';
    }
  }

  btn.addEventListener('click', doLogin);
  el.querySelector('#password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  return el;
}
