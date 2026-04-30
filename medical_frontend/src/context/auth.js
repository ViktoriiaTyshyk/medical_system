import { api } from '../services/api.js';

export const auth = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  },
  isLoggedIn() { return !!localStorage.getItem('access_token'); },
  getRole() {
    const u = this.getUser();
    return u?.roles?.[0]?.name || null;
  },
  async login(email, password) {
    const data = await api.login({ email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const me = await api.getMe();
    localStorage.setItem('user', JSON.stringify(me));
    return me;
  },
  async register(payload) {
    const data = await api.register(payload);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const me = await api.getMe();
    localStorage.setItem('user', JSON.stringify(me));
    return me;
  },
  async logout() {
    const rt = localStorage.getItem('refresh_token');
    try { if (rt) await api.logout(rt); } catch {}
    localStorage.clear();
  }
};
