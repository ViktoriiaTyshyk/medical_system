import { api } from '../services/api.js';
import { auth } from '../context/auth.js';

export function ProfilePage() {
  const el = document.createElement('div');
  const user = auth.getUser();
  const role = auth.getRole();

  async function load() {
    el.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
    try {
      const me = await api.getMe();
      let profileHtml = '';

      if (role === 'PATIENT') {
        try {
          const p = await api.getPatientProfile(me.id);
          profileHtml = `
            <div class="card mt-16">
              <div class="card-header"><span class="card-title">Профіль пацієнта</span></div>
              <div class="grid-2">
                <div class="form-group"><label>Номер медкнижки</label><input type="text" id="p-mrn" value="${p.medical_record_number||''}" /></div>
                <div class="form-group"><label>Страховий номер</label><input type="text" id="p-ins" value="${p.insurance_number||''}" /></div>
                <div class="form-group"><label>Адреса</label><input type="text" id="p-addr" value="${p.address||''}" /></div>
                <div class="form-group">
                  <label>Група крові</label>
                  <select id="p-blood">
                    <option value="">— обрати —</option>
                    ${['A_POS','A_NEG','B_POS','B_NEG','AB_POS','AB_NEG','O_POS','O_NEG'].map(b =>
                      `<option value="${b}" ${p.blood_type===b?'selected':''}>${b.replace('_','')}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="form-group"><label>Контактна особа (ім'я)</label><input type="text" id="p-ecn" value="${p.emergency_contact_name||''}" /></div>
                <div class="form-group"><label>Контактна особа (тел)</label><input type="text" id="p-ecp" value="${p.emergency_contact_phone||''}" /></div>
              </div>
              <div id="p-alert"></div>
              <button class="btn btn-primary" id="save-patient">Зберегти профіль пацієнта</button>
            </div>
          `;
        } catch {}
      }

      el.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Мій профіль</h1>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Особисті дані</span></div>
          <div id="user-alert"></div>
          <div class="form-row">
            <div class="form-group"><label>Ім'я</label><input type="text" id="u-fname" value="${me.first_name}" /></div>
            <div class="form-group"><label>Прізвище</label><input type="text" id="u-lname" value="${me.last_name}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Email</label><input type="email" value="${me.email}" disabled /></div>
            <div class="form-group"><label>Телефон</label><input type="text" id="u-phone" value="${me.phone||''}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Стать</label>
              <select id="u-sex">
                <option value="">— оберіть —</option>
                <option value="MALE" ${me.sex==='MALE'?'selected':''}>Чоловіча</option>
                <option value="FEMALE" ${me.sex==='FEMALE'?'selected':''}>Жіноча</option>
              </select>
            </div>
            <div class="form-group"><label>Дата народження</label><input type="date" id="u-dob" value="${me.date_of_birth||''}" /></div>
          </div>
          <div class="mt-16">
            <button class="btn btn-primary" id="save-user">Зберегти зміни</button>
          </div>
        </div>
        ${profileHtml}
      `;

      el.querySelector('#save-user').addEventListener('click', async () => {
        try {
          const updated = await api.updateMe({
            first_name: el.querySelector('#u-fname').value,
            last_name: el.querySelector('#u-lname').value,
            phone: el.querySelector('#u-phone').value,
            sex: el.querySelector('#u-sex').value || undefined,
            date_of_birth: el.querySelector('#u-dob').value || undefined,
          });
          localStorage.setItem('user', JSON.stringify(updated));
          el.querySelector('#user-alert').innerHTML = '<div class="alert alert-success">Збережено!</div>';
        } catch (e) {
          el.querySelector('#user-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      });

      const savePatient = el.querySelector('#save-patient');
      if (savePatient) {
        savePatient.addEventListener('click', async () => {
          try {
            await api.updatePatientProfile(me.id, {
              medical_record_number: el.querySelector('#p-mrn').value || undefined,
              insurance_number: el.querySelector('#p-ins').value || undefined,
              address: el.querySelector('#p-addr').value || undefined,
              blood_type: el.querySelector('#p-blood').value || undefined,
              emergency_contact_name: el.querySelector('#p-ecn').value || undefined,
              emergency_contact_phone: el.querySelector('#p-ecp').value || undefined,
            });
            el.querySelector('#p-alert').innerHTML = '<div class="alert alert-success">Профіль пацієнта збережено!</div>';
          } catch (e) {
            el.querySelector('#p-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
          }
        });
      }

    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">Помилка: ${e.message}</div>`;
    }
  }

  load();
  return el;
}
