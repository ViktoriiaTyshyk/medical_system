import { api } from '../services/api.js';
import { auth } from '../context/auth.js';

export function LungAnalysisPage(navigate) {
  const el = document.createElement('div');

  let selectedFile = null;
  let analysisResults = null;
  let isAnalyzing = false;
  let isProposing = false;
  let isConsulting = false;

  // Список рентгенологів для модалки
  let radiologists = [];
  let selectedRadiologistId = null;
  let showRadiologistModal = false;
  let isLoadingRads = false;

  const CLASS_COLORS = [
    '#22c55e', '#f97316', '#ef4444',
    '#a855f7', '#dc2626', '#3b82f6',
  ];
  const CLASS_ICONS = ['✅', '🫁', '🦠', '🔬', '⚠️', '💧'];
  const CLASS_ORDER = ['Норма','Пневмонія','COVID-19','Туберкульоз','Рак легень','Плевральний випіт'];

  // ── Рендер ────────────────────────────────────────────────────────────────

  function render() {
    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🩻 AI-аналіз рентгену легень</h1>
        <p class="page-subtitle">Завантажте знімок — система визначить ймовірність патологій</p>
      </div>

      <div class="grid-2" style="align-items:start">

        <!-- Ліва колонка: завантаження -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Завантаження знімку</span>
          </div>

          <div id="drop-zone" style="
            border: 2px dashed var(--border);
            border-radius: 12px;
            padding: 40px 20px;
            text-align: center;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
            margin-bottom: 16px;
          ">
            <div style="font-size: 48px; margin-bottom: 12px;">🫁</div>
            ${selectedFile ? `
              <div style="color: var(--primary); font-weight: 600; margin-bottom: 4px;">
                ✓ ${esc(selectedFile.name)}
              </div>
              <div style="font-size: 12px; color: var(--text2)">
                ${(selectedFile.size / 1024).toFixed(1)} KB · ${selectedFile.type}
              </div>
            ` : `
              <div style="font-weight: 600; margin-bottom: 4px;">Перетягніть файл сюди</div>
              <div style="font-size: 13px; color: var(--text2)">або натисніть для вибору</div>
              <div style="font-size: 11px; color: var(--text2); margin-top: 8px">JPEG, PNG, WEBP · до 20 MB</div>
            `}
          </div>
          <input type="file" id="file-input" accept="image/*" style="display:none" />

          ${selectedFile ? `
            <div style="margin-bottom:12px; text-align:center">
              <img id="preview-img" style="
                max-height:200px; max-width:100%;
                border-radius:8px; border:1px solid var(--border); object-fit:contain;
              " />
            </div>
          ` : ''}

          <div id="upload-alert"></div>

          <button class="btn btn-primary" id="analyze-btn" style="width:100%"
            ${!selectedFile || isAnalyzing ? 'disabled' : ''}>
            ${isAnalyzing
              ? '<span class="spinner" style="width:16px;height:16px;margin-right:8px"></span>Аналізую...'
              : '🔍 Аналізувати'}
          </button>

          ${selectedFile ? `
            <button class="btn btn-secondary" id="clear-btn" style="width:100%; margin-top:8px">
              ✕ Очистити
            </button>
          ` : ''}
        </div>

        <!-- Права колонка: результати -->
        <div id="results-col">
          ${analysisResults ? renderResults() : renderEmpty()}
        </div>

      </div>

      <!-- Модалка вибору рентгенолога -->
      ${showRadiologistModal ? renderRadiologistModal() : ''}
    `;

    attachEvents();

    if (selectedFile) {
      const img = el.querySelector('#preview-img');
      if (img) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(selectedFile);
      }
    }
  }

  // ── Шаблони ───────────────────────────────────────────────────────────────

  function renderEmpty() {
    return `
      <div class="card" style="text-align:center; padding:60px 20px">
        <div style="font-size:56px; margin-bottom:16px; opacity:0.3">📊</div>
        <div style="font-weight:600; color:var(--text2); margin-bottom:8px">Результати з'являться тут</div>
        <div style="font-size:13px; color:var(--text2)">Виберіть знімок і натисніть «Аналізувати»</div>
      </div>
    `;
  }

  function renderResults() {
    const sorted = Object.entries(analysisResults.results).sort(([,a],[,b]) => b - a);
    const top = sorted[0];
    const isNormal = top[0] === 'Норма';
    const alertColor = isNormal ? '#22c55e' : '#ef4444';
    const alertBg   = isNormal ? '#f0fdf4' : '#fef2f2';

    return `
      <div>
        <!-- Головний висновок -->
        <div class="card" style="border-left:4px solid ${alertColor}; background:${alertBg}; margin-bottom:16px">
          <div style="display:flex; align-items:center; gap:12px">
            <div style="font-size:36px">${isNormal ? '✅' : '⚠️'}</div>
            <div>
              <div style="font-weight:700; font-size:18px; color:${alertColor}">
                ${isNormal ? 'Патологій не виявлено' : `Виявлено: ${top[0]}`}
              </div>
              <div style="font-size:13px; color:var(--text2)">Впевненість: ${top[1].toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <!-- Діаграма -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-header"><span class="card-title">Розподіл по патологіях</span></div>
          <div style="display:flex; flex-direction:column; gap:12px">
            ${sorted.map(([name, pct]) => {
              const idx = CLASS_ORDER.indexOf(name);
              const color = CLASS_COLORS[idx >= 0 ? idx : 0];
              const icon  = CLASS_ICONS[idx >= 0 ? idx : 0];
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px">
                    <span style="font-size:13px; font-weight:500">${icon} ${name}</span>
                    <span style="font-size:13px; font-weight:700; color:${color}">${pct.toFixed(1)}%</span>
                  </div>
                  <div style="height:8px; border-radius:99px; background:var(--bg2); overflow:hidden">
                    <div style="height:100%; width:${pct}%; background:${color}; border-radius:99px; transition:width 0.6s ease"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Дії -->
        <div class="card" style="background:var(--bg2)">
          <div style="font-weight:600; margin-bottom:6px">Що далі?</div>
          <div style="font-size:13px; color:var(--text2); margin-bottom:14px">
            Надішліть знімок лікарю або просто закрийте — нічого не збережеться.
          </div>
          <div id="action-alert"></div>

          <!-- Кнопка 1: сімейний лікар -->
          <button class="btn btn-primary" id="propose-btn" style="width:100%"
            ${isProposing ? 'disabled' : ''}>
            ${isProposing
              ? '<span class="spinner" style="width:16px;height:16px;margin-right:8px"></span>Надсилаю...'
              : '📤 Запропонувати сімейному лікарю'}
          </button>

          <!-- Кнопка 2: рентгенолог -->
          <button class="btn btn-secondary" id="consult-btn" style="width:100%; margin-top:8px"
            ${isConsulting ? 'disabled' : ''}>
            ${isConsulting
              ? '<span class="spinner" style="width:16px;height:16px;margin-right:8px"></span>Створюю кейс...'
              : '🩺 Обговорити з рентгенологом'}
          </button>

          <!-- Кнопка 3: просто переглянути -->
          <button class="btn btn-secondary" id="discard-btn" style="width:100%; margin-top:8px">
            Переглянути результат, нічого не зберігати
          </button>
        </div>
      </div>
    `;
  }

  function renderRadiologistModal() {
    const availBadge = (status) => {
      if (!status) return '';
      const map = { AVAILABLE: '#22c55e', BUSY: '#f59e0b', OFF_DUTY: '#6b7280' };
      const label = { AVAILABLE: 'Доступний', BUSY: 'Зайнятий', OFF_DUTY: 'Не на зміні' };
      const color = map[status] || '#6b7280';
      return `<span style="font-size:11px; color:${color}; font-weight:600">● ${label[status] || status}</span>`;
    };

    return `
      <div class="modal-overlay" id="rad-overlay">
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <span class="modal-title">🩺 Вибрати рентгенолога</span>
            <button class="modal-close" id="close-rad-modal">✕</button>
          </div>
          <p style="font-size:13px; color:var(--text2); margin-bottom:16px">
            Рентгенолог отримає доступ до знімку і зможе одразу розпочати консультацію в чаті.
          </p>

          <div id="rad-alert"></div>

          ${isLoadingRads ? `
            <div style="text-align:center; padding:32px">
              <div class="spinner"></div>
            </div>
          ` : radiologists.length === 0 ? `
            <div class="empty">
              <div class="empty-icon">👨‍⚕️</div>
              <div class="empty-title">Рентгенологів не знайдено</div>
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px; max-height:320px; overflow-y:auto; margin-bottom:16px">
              ${radiologists.map(r => `
                <div class="rad-card ${selectedRadiologistId === r.id ? 'rad-card--selected' : ''}"
                  data-rad-id="${r.id}"
                  style="
                    padding:14px 16px; border-radius:10px; cursor:pointer;
                    border: 2px solid ${selectedRadiologistId === r.id ? 'var(--primary)' : 'var(--border)'};
                    background: ${selectedRadiologistId === r.id ? 'var(--bg2)' : 'transparent'};
                    transition: border-color 0.15s, background 0.15s;
                    display:flex; align-items:center; justify-content:space-between;
                  "
                >
                  <div>
                    <div style="font-weight:600">
                      ${selectedRadiologistId === r.id ? '✓ ' : ''}
                      ${esc(r.first_name)} ${esc(r.last_name)}
                    </div>
                    <div style="font-size:12px; color:var(--text2); margin-top:2px">
                      ${r.department ? esc(r.department) + ' · ' : ''}
                      ${r.years_of_experience ? r.years_of_experience + ' р. досвіду' : 'Рентгенолог'}
                    </div>
                  </div>
                  <div>${availBadge(r.availability_status)}</div>
                </div>
              `).join('')}
            </div>
          `}

          <div class="modal-footer">
            <button class="btn btn-secondary" id="close-rad-modal2">Скасувати</button>
            <button class="btn btn-primary" id="confirm-rad-btn"
              ${!selectedRadiologistId || isConsulting ? 'disabled' : ''}>
              ${isConsulting
                ? '<span class="spinner" style="width:14px;height:14px;margin-right:6px"></span>Створюю...'
                : 'Надіслати знімок'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Події ─────────────────────────────────────────────────────────────────

  function attachEvents() {
    // Drop zone
    const dz = el.querySelector('#drop-zone');
    const fi = el.querySelector('#file-input');
    if (dz && fi) {
      dz.addEventListener('click', () => fi.click());
      dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        dz.style.borderColor = 'var(--primary)';
        dz.style.background = 'var(--bg2)';
      });
      dz.addEventListener('dragleave', () => {
        dz.style.borderColor = 'var(--border)';
        dz.style.background = '';
      });
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.style.borderColor = 'var(--border)';
        dz.style.background = '';
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) {
          selectedFile = f; analysisResults = null; render();
        }
      });
      fi.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) { selectedFile = f; analysisResults = null; render(); }
      });
    }

    // Аналізувати
    const analyzeBtn = el.querySelector('#analyze-btn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile || isAnalyzing) return;
        isAnalyzing = true;
        render();
        try {
          const fd = new FormData();
          fd.append('file', selectedFile);
          analysisResults = await api.analyzeLung(fd);
          isAnalyzing = false;
          render();
        } catch (e) {
          isAnalyzing = false;
          render();
          const a = el.querySelector('#upload-alert');
          if (a) a.innerHTML = `<div class="alert alert-error" style="margin-top:8px">${e.message}</div>`;
        }
      });
    }

    // Очистити
    el.querySelector('#clear-btn')?.addEventListener('click', () => {
      selectedFile = null; analysisResults = null; render();
    });

    // Запропонувати сімейному лікарю
    el.querySelector('#propose-btn')?.addEventListener('click', async () => {
      if (!selectedFile || isProposing) return;
      isProposing = true;
      render();
      try {
        const fd = new FormData();
        fd.append('file', selectedFile);
        const data = await api.proposeCase(fd);
        isProposing = false;
        render();
        const a = el.querySelector('#action-alert');
        if (a) a.innerHTML = `
          <div class="alert alert-success" style="margin-bottom:10px">
            ✅ Кейс #${data.case_id} надіслано сімейному лікарю!
          </div>`;
        const btn = el.querySelector('#propose-btn');
        if (btn) {
          btn.textContent = '→ Перейти до кейсу';
          btn.disabled = false;
          btn.addEventListener('click', () => navigate('case', data.case_id), { once: true });
        }
      } catch (e) {
        isProposing = false;
        render();
        const a = el.querySelector('#action-alert');
        if (a) a.innerHTML = `<div class="alert alert-error" style="margin-bottom:10px">${e.message}</div>`;
      }
    });

    // Відкрити модалку рентгенологів
    el.querySelector('#consult-btn')?.addEventListener('click', async () => {
      selectedRadiologistId = null;
      showRadiologistModal = true;
      isLoadingRads = true;
      render();
      try {
        radiologists = await api.getRadiologists();
      } catch (e) {
        radiologists = [];
      }
      isLoadingRads = false;
      render();
      bindModalEvents();
    });

    // Не зберігати
    el.querySelector('#discard-btn')?.addEventListener('click', () => {
      selectedFile = null; analysisResults = null; render();
    });

    // Якщо модалка вже відкрита — прив'язати її події
    if (showRadiologistModal) bindModalEvents();
  }

  function bindModalEvents() {
    // Закрити
    const closeModal = () => {
      showRadiologistModal = false;
      selectedRadiologistId = null;
      isConsulting = false;
      render();
    };
    el.querySelector('#close-rad-modal')?.addEventListener('click', closeModal);
    el.querySelector('#close-rad-modal2')?.addEventListener('click', closeModal);
    el.querySelector('#rad-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'rad-overlay') closeModal();
    });

    // Вибір рентгенолога
    el.querySelectorAll('[data-rad-id]').forEach(card => {
      card.addEventListener('click', () => {
        selectedRadiologistId = parseInt(card.dataset.radId);
        // Оновити тільки картки без перерендеру всієї сторінки
        el.querySelectorAll('[data-rad-id]').forEach(c => {
          const id = parseInt(c.dataset.radId);
          const selected = id === selectedRadiologistId;
          c.style.borderColor = selected ? 'var(--primary)' : 'var(--border)';
          c.style.background = selected ? 'var(--bg2)' : 'transparent';
          const nameEl = c.querySelector('div > div:first-child');
          if (nameEl) {
            const rad = radiologists.find(r => r.id === id);
            if (rad) nameEl.textContent = `${selected ? '✓ ' : ''}${rad.first_name} ${rad.last_name}`;
          }
        });
        const confirmBtn = el.querySelector('#confirm-rad-btn');
        if (confirmBtn) confirmBtn.disabled = false;
      });
    });

    // Підтвердити вибір рентгенолога і створити кейс
    el.querySelector('#confirm-rad-btn')?.addEventListener('click', async () => {
      if (!selectedRadiologistId || isConsulting) return;
      isConsulting = true;

      const confirmBtn = el.querySelector('#confirm-rad-btn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin-right:6px"></span>Створюю...';
      }

      try {
        const fd = new FormData();
        fd.append('file', selectedFile);
        const data = await api.consultRadiologist(selectedRadiologistId, fd);

        isConsulting = false;
        showRadiologistModal = false;
        render();

        const a = el.querySelector('#action-alert');
        if (a) a.innerHTML = `
          <div class="alert alert-success" style="margin-bottom:10px">
            ✅ Кейс #${data.case_id} створено! Рентгенолог ${esc(data.radiologist.name)} вже має доступ.
          </div>`;

        const consultBtn = el.querySelector('#consult-btn');
        if (consultBtn) {
          consultBtn.textContent = '→ Перейти до кейсу';
          consultBtn.disabled = false;
          consultBtn.addEventListener('click', () => navigate('case', data.case_id), { once: true });
        }
      } catch (e) {
        isConsulting = false;
        const a = el.querySelector('#rad-alert');
        if (a) a.innerHTML = `<div class="alert alert-error" style="margin-bottom:10px">${e.message}</div>`;
        const confirmBtn2 = el.querySelector('#confirm-rad-btn');
        if (confirmBtn2) {
          confirmBtn2.disabled = false;
          confirmBtn2.textContent = 'Надіслати знімок';
        }
      }
    });
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  render();
  return el;
}
