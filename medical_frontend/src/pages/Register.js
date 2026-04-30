import { auth } from '../context/auth.js';

export function RegisterPage(onLogin) {
  const el = document.createElement('div');
  el.className = 'auth-page';
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-icon">🏥</div>
        <span class="auth-logo-text">MedSystem</span>
      </div>
      <h1 class="auth-title">Реєстрація</h1>
      <p class="auth-subtitle">Створіть акаунт на медичній платформі</p>
      <div id="auth-alert"></div>
      <div class="form-row">
        <div class="form-group">
          <label>Ім'я</label>
          <input type="text" id="first_name" placeholder="Іван" />
        </div>
        <div class="form-group">
          <label>Прізвище</label>
          <input type="text" id="last_name" placeholder="Коваленко" />
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="email" placeholder="your@email.com" />
      </div>
      <div class="form-group">
        <label>Телефон</label>
        <input type="text" id="phone" placeholder="+380501234567" />
      </div>
      <div class="form-group">
        <label>Пароль</label>
        <input type="password" id="password" placeholder="••••••••" />
      </div>
      <div class="form-group">
        <label>Роль</label>
        <select id="role">
          <option value="PATIENT">🧑‍🦽 Пацієнт</option>
          <option value="FAMILY_DOCTOR">👨‍⚕️ Сімейний лікар</option>
          <option value="RADIOLOGIST">🩻 Рентгенолог</option>
          <option value="ADMIN">⚙️ Адміністратор</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" id="reg-btn">Зареєструватись</button>
      <div class="auth-link">
        Вже є акаунт? <a href="#login">Увійти</a>
      </div>
    </div>
  `;

  const alertEl = el.querySelector('#auth-alert');
  const btn = el.querySelector('#reg-btn');

  btn.addEventListener('click', async () => {
    const payload = {
      first_name: el.querySelector('#first_name').value.trim(),
      last_name: el.querySelector('#last_name').value.trim(),
      email: el.querySelector('#email').value.trim(),
      phone: el.querySelector('#phone').value.trim(),
      password: el.querySelector('#password').value,
      role: el.querySelector('#role').value,
    };
    if (!payload.first_name || !payload.last_name || !payload.email || !payload.password) {
      alertEl.innerHTML = '<div class="alert alert-error">Заповніть обов\'язкові поля</div>';
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Реєстрація...';
    try {
      const user = await auth.register(payload);
      onLogin(user);
    } catch (e) {
      alertEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
      btn.disabled = false;
      btn.textContent = 'Зареєструватись';
    }
  });

  return el;
}
