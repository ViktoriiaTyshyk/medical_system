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

export function CaseDetailPage(caseId, navigate) {
  const el = document.createElement('div');
  const user = auth.getUser();
  const role = auth.getRole();
  let activeTab = 'info';
  let chatPollInterval = null;   // polling для чату

  function stopChatPoll() {
    if (chatPollInterval) {
      clearInterval(chatPollInterval);
      chatPollInterval = null;
    }
  }

  async function load() {
    try {
      const c = await api.getCase(caseId);
      renderCase(c);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-error">Помилка: ${e.message}</div>`;
    }
  }

  function renderCase(c) {
    stopChatPoll();

    el.innerHTML = `
      <div class="page-header">
        <div class="flex-center gap-8 mb-16">
          <button class="btn btn-secondary btn-sm" id="back-btn">← Назад</button>
          <span class="badge ${STATUS_BADGE[c.status] || 'badge-gray'}">${STATUS_LABEL[c.status] || c.status}</span>
        </div>
        <h1 class="page-title">${c.title}</h1>
        <p class="page-subtitle">Кейс #${c.id} · Пацієнт #${c.patient_id}</p>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="info">📋 Інформація</button>
        ${c.status !== 'PENDING' ? '<button class="tab" data-tab="chat">💬 Чат</button>' : ''}
        <button class="tab" data-tab="files">📎 Файли</button>
        ${(role === 'RADIOLOGIST' || role === 'ADMIN') && c.status !== 'PENDING'
          ? '<button class="tab" data-tab="conclusion">📝 Висновок</button>' : ''}
        ${role === 'ADMIN' ? '<button class="tab" data-tab="manage">⚙️ Управління</button>' : ''}
      </div>
      <div id="tab-content"></div>
    `;

    el.querySelector('#back-btn').addEventListener('click', () => {
      stopChatPoll();
      navigate('cases');
    });

    el.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        stopChatPoll();
        el.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        renderTab(c, activeTab);
      });
    });

    renderTab(c, activeTab);
  }

  function renderTab(c, tab) {
    const content = el.querySelector('#tab-content');
    if (tab === 'info') renderInfo(content, c);
    else if (tab === 'chat') renderChat(content, c);
    else if (tab === 'files') renderFiles(content, c);
    else if (tab === 'conclusion') renderConclusion(content, c);
    else if (tab === 'manage') renderManage(content, c);
  }

  function renderInfo(content, c) {
    const canChangeStatus = (role === 'RADIOLOGIST' || role === 'ADMIN');
    const canActivate = (role === 'FAMILY_DOCTOR' || role === 'ADMIN') && c.status === 'PENDING';

    content.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">Деталі кейсу</span></div>
          <div class="case-meta">
            <div class="case-meta-item">
              <span class="case-meta-label">ID</span>
              <span class="case-meta-value">#${c.id}</span>
            </div>
            <div class="case-meta-item">
              <span class="case-meta-label">Статус</span>
              <span class="case-meta-value">${STATUS_LABEL[c.status] || c.status}</span>
            </div>
            <div class="case-meta-item">
              <span class="case-meta-label">Створено</span>
              <span class="case-meta-value">${new Date(c.created_at).toLocaleDateString('uk')}</span>
            </div>
            ${c.closed_at ? `
            <div class="case-meta-item">
              <span class="case-meta-label">Закрито</span>
              <span class="case-meta-value">${new Date(c.closed_at).toLocaleDateString('uk')}</span>
            </div>` : ''}
          </div>
          <div class="divider"></div>
          <div class="form-group">
            <label>Опис</label>
            <p style="font-size:14px;color:var(--text2)">${c.description || 'Опис відсутній'}</p>
          </div>
          ${c.conclusion ? `
          <div class="form-group mt-16">
            <label>Висновок рентгенолога</label>
            <p style="font-size:14px;color:var(--text)">${c.conclusion}</p>
          </div>` : ''}
        </div>

        <div id="action-card">
          ${canActivate ? `
            <div class="card" style="border-left:4px solid #f59e0b; background:#fffbeb">
              <div class="card-header"><span class="card-title">⏳ Кейс очікує вашого рішення</span></div>
              <p style="font-size:13px; color:var(--text2); margin-bottom:14px">
                Пацієнт надіслав рентгенівський знімок через AI-аналіз. Активуйте кейс щоб почати роботу.
              </p>
              <div id="activate-alert"></div>
              <button class="btn btn-primary" id="activate-btn">✅ Активувати кейс</button>
            </div>
          ` : ''}

          ${canChangeStatus ? `
            <div class="card">
              <div class="card-header"><span class="card-title">Змінити статус</span></div>
              <div class="form-group">
                <label>Новий статус</label>
                <select id="status-select">
                  <option value="OPEN">Відкритий</option>
                  <option value="IN_PROGRESS">В процесі</option>
                  <option value="COMPLETED">Завершено</option>
                  <option value="CLOSED">Закрито</option>
                </select>
              </div>
              <div id="status-alert"></div>
              <button class="btn btn-primary" id="update-status">Оновити статус</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Активація PENDING кейсу лікарем
    const activateBtn = content.querySelector('#activate-btn');
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        try {
          await api.updateCaseStatus(c.id, 'OPEN');
          content.querySelector('#activate-alert').innerHTML =
            '<div class="alert alert-success">Кейс активовано!</div>';
          setTimeout(load, 800);
        } catch (e) {
          content.querySelector('#activate-alert').innerHTML =
            `<div class="alert alert-error">${e.message}</div>`;
        }
      });
    }

    // Зміна статусу рентгенологом/адміном
    const sel = content.querySelector('#status-select');
    if (sel) {
      sel.value = c.status;
      content.querySelector('#update-status').addEventListener('click', async () => {
        try {
          await api.updateCaseStatus(c.id, sel.value);
          content.querySelector('#status-alert').innerHTML =
            '<div class="alert alert-success">Статус оновлено!</div>';
          setTimeout(load, 1000);
        } catch (e) {
          content.querySelector('#status-alert').innerHTML =
            `<div class="alert alert-error">${e.message}</div>`;
        }
      });
    }
  }

  // ─── ЧАТ з polling ────────────────────────────────────────────────────────
  async function renderChat(content, c) {
    content.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;

    let lastMessageCount = 0;

    async function loadMessages(isFirst = false) {
      try {
        const messages = await api.getMessages(c.id);

        // Якщо перший раз або прийшли нові повідомлення — перерендерити список
        if (isFirst || messages.length !== lastMessageCount) {
          lastMessageCount = messages.length;

          if (isFirst) {
            // Перший рендер — малюємо всю структуру чату
            content.innerHTML = `
              <div class="card">
                <div class="chat-wrap">
                  <div class="chat-messages" id="chat-msgs">
                    ${renderMessagesList(messages, user)}
                  </div>
                  <div class="chat-input">
                    <input type="text" id="msg-input" placeholder="Написати повідомлення..." />
                    <button class="btn btn-primary" id="send-msg">Надіслати</button>
                  </div>
                </div>
              </div>
            `;
            bindChatSend(c);
          } else {
            // Оновлення — тільки список повідомлень
            const msgsList = content.querySelector('#chat-msgs');
            if (msgsList) {
              const wasAtBottom = msgsList.scrollTop + msgsList.clientHeight >= msgsList.scrollHeight - 20;
              msgsList.innerHTML = renderMessagesList(messages, user);
              if (wasAtBottom) msgsList.scrollTop = msgsList.scrollHeight;
            }
          }

          if (isFirst) {
            const msgs = content.querySelector('#chat-msgs');
            if (msgs) msgs.scrollTop = msgs.scrollHeight;
          }
        }
      } catch (e) {
        if (isFirst) {
          content.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      }
    }

    await loadMessages(true);

    // Запускаємо polling кожні 4 секунди
    chatPollInterval = setInterval(() => loadMessages(false), 4000);
  }

  function renderMessagesList(messages, currentUser) {
    if (messages.length === 0) {
      return '<div class="empty"><div class="empty-icon">💬</div><div class="empty-title">Повідомлень ще немає</div></div>';
    }
    return messages.map(m => `
      <div class="msg ${m.sender_user_id === currentUser.id ? 'mine' : 'theirs'}">
        <div class="msg-bubble">${escHtml(m.text || '')}</div>
        <div class="msg-meta">${new Date(m.created_at).toLocaleTimeString('uk', {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
    `).join('');
  }

  function bindChatSend(c) {
    async function send() {
      const input = el.querySelector('#msg-input');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        await api.sendMessage(c.id, { text, message_type: 'TEXT' });
        // Одразу отримуємо оновлений список без очікування polling
        const messages = await api.getMessages(c.id);
        const msgsList = el.querySelector('#chat-msgs');
        if (msgsList) {
          msgsList.innerHTML = renderMessagesList(messages, user);
          msgsList.scrollTop = msgsList.scrollHeight;
        }
      } catch (e) {
        console.error('Помилка відправки:', e);
      }
    }

    const sendBtn = el.querySelector('#send-msg');
    if (sendBtn) sendBtn.addEventListener('click', send);

    const input = el.querySelector('#msg-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }
  // ─────────────────────────────────────────────────────────────────────────

  async function renderFiles(content, c) {
    content.innerHTML = `<div class="loading-page"><div class="spinner"></div></div>`;
    try {
      const files = await api.getCaseFiles(c.id);
      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Файли кейсу</span>
            ${c.status !== 'PENDING' ? `
            <label class="btn btn-secondary btn-sm" style="cursor:pointer">
              📎 Завантажити
              <input type="file" id="file-upload" style="display:none" />
            </label>` : ''}
          </div>
          <div id="file-alert"></div>
          ${files.length === 0 ? `
            <div class="empty">
              <div class="empty-icon">📂</div>
              <div class="empty-title">Файлів немає</div>
            </div>
          ` : `
            <table>
              <thead><tr><th>Назва</th><th>Тип</th><th>Розмір</th></tr></thead>
              <tbody>
                ${files.map(f => `
                  <tr>
                    <td>${f.file?.name || 'файл'}</td>
                    <td class="text-muted">${f.file?.mime_type || '-'}</td>
                    <td class="text-muted">${f.file?.size ? Math.round(f.file.size / 1024) + ' KB' : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;

      const fileUpload = content.querySelector('#file-upload');
      if (fileUpload) {
        fileUpload.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append('file', file);
          try {
            await api.uploadCaseFile(c.id, fd);
            content.querySelector('#file-alert').innerHTML =
              '<div class="alert alert-success">Файл завантажено!</div>';
            setTimeout(() => renderFiles(content, c), 1000);
          } catch (err) {
            content.querySelector('#file-alert').innerHTML =
              `<div class="alert alert-error">${err.message}</div>`;
          }
        });
      }
    } catch (e) {
      content.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  }

  function renderConclusion(content, c) {
    content.innerHTML = `
      <div class="card" style="max-width:600px">
        <div class="card-header"><span class="card-title">Висновок рентгенолога</span></div>
        <div id="conc-alert"></div>
        <div class="form-group">
          <label>Висновок</label>
          <textarea id="conclusion" style="min-height:160px">${c.conclusion || ''}</textarea>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-primary" id="save-conc">Зберегти висновок</button>
          <button class="btn btn-secondary" id="sign-case">✅ Підписати кейс</button>
        </div>
      </div>
    `;

    content.querySelector('#save-conc').addEventListener('click', async () => {
      const conclusion = content.querySelector('#conclusion').value.trim();
      try {
        await api.updateConclusion(c.id, conclusion);
        content.querySelector('#conc-alert').innerHTML =
          '<div class="alert alert-success">Висновок збережено!</div>';
      } catch (e) {
        content.querySelector('#conc-alert').innerHTML =
          `<div class="alert alert-error">${e.message}</div>`;
      }
    });

    content.querySelector('#sign-case').addEventListener('click', async () => {
      try {
        await api.signCase(c.id);
        content.querySelector('#conc-alert').innerHTML =
          '<div class="alert alert-success">Кейс підписано і завершено!</div>';
        setTimeout(load, 1000);
      } catch (e) {
        content.querySelector('#conc-alert').innerHTML =
          `<div class="alert alert-error">${e.message}</div>`;
      }
    });
  }

  function renderManage(content, c) {
    content.innerHTML = `
      <div class="card" style="max-width:500px">
        <div class="card-header"><span class="card-title">Управління кейсом</span></div>
        <div id="manage-alert"></div>
        <div class="form-group">
          <label>Назва</label>
          <input type="text" id="m-title" value="${c.title}" />
        </div>
        <div class="form-group">
          <label>Опис</label>
          <textarea id="m-desc">${c.description || ''}</textarea>
        </div>
        <button class="btn btn-primary" id="save-case">Зберегти зміни</button>
        <div class="divider"></div>
        <div class="form-group">
          <label>Додати учасника (ID юзера)</label>
          <div class="flex gap-8">
            <input type="number" id="part-id" placeholder="ID" style="max-width:120px" />
            <button class="btn btn-secondary" id="add-part">Додати</button>
          </div>
        </div>
      </div>
    `;

    content.querySelector('#save-case').addEventListener('click', async () => {
      try {
        await api.updateCase(c.id, {
          title: content.querySelector('#m-title').value,
          description: content.querySelector('#m-desc').value,
        });
        content.querySelector('#manage-alert').innerHTML =
          '<div class="alert alert-success">Збережено!</div>';
        setTimeout(load, 1000);
      } catch (e) {
        content.querySelector('#manage-alert').innerHTML =
          `<div class="alert alert-error">${e.message}</div>`;
      }
    });

    content.querySelector('#add-part').addEventListener('click', async () => {
      const uid = parseInt(content.querySelector('#part-id').value);
      if (!uid) return;
      try {
        await api.addParticipant(c.id, uid);
        content.querySelector('#manage-alert').innerHTML =
          '<div class="alert alert-success">Учасника додано!</div>';
      } catch (e) {
        content.querySelector('#manage-alert').innerHTML =
          `<div class="alert alert-error">${e.message}</div>`;
      }
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  load();
  return el;
}
