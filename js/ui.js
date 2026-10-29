/* Ortak arayüz parçaları: ikonlar, bildirimler, pencereler, proje seçici, aktivite formu */

const ICONS = {
  home: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'arrow-down': '<path d="M12 5v14M5 12l7 7 7-7"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  share: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2"/>',
  'plus-square': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  refresh: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  grid: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h2M14 13h2M8 17h2M14 17h2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  printer: '<path d="M6 9V3h12v6"/><rect width="20" height="9" x="2" y="9" rx="2"/><path d="M6 14h12v7H6z"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
};

function icon(name, size = 18) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// Alt-ortada kısa bildirim. action: { label, fn } → "Geri al" gibi bir buton ekler.
function toast(message, { tone = 'ok', action = null, duration = 4200 } = {}) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `<span class="toast-ic">${icon(tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert', 16)}</span>
    <span class="toast-msg">${esc(message)}</span>${action ? `<button class="toast-btn">${esc(action.label)}</button>` : ''}`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 220); };
  // { once: true }: çift tıklama "Geri al"ı iki kez çalıştırıp kaydı çoğaltmasın
  if (action) el.querySelector('.toast-btn').addEventListener('click', () => { action.fn(); close(); }, { once: true });
  setTimeout(close, duration);
}

function openModal({ title, body, footer = '', size = '', onMount, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button></header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  document.body.appendChild(wrap);
  const prevFocus = document.activeElement;
  const onKey = e => { if (e.key === 'Escape' && !e.defaultPrevented) close(); };
  function close() {
    document.removeEventListener('keydown', onKey);
    onClose?.();
    wrap.classList.remove('in');
    setTimeout(() => wrap.remove(), 180);
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus();
  }
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  requestAnimationFrame(() => wrap.classList.add('in'));
  onMount?.(wrap.querySelector('.modal'), close);
  return close;
}

// Bir butonun altında açılan küçük menü. items: [{ icon, label, hint, fn }]
let closeActiveMenu = null;
function openMenu(anchor, items) {
  closeActiveMenu?.();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = items.map((it, i) => `<button class="menu-item" role="menuitem" data-i="${i}">${icon(it.icon, 16)}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('');
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + window.scrollY + 6}px`;
  menu.style.left = `${Math.max(8, r.right + window.scrollX - menu.offsetWidth)}px`;
  const outside = e => { if (!menu.contains(e.target) && !anchor.contains(e.target)) close(); };
  const onKey = e => { if (e.key === 'Escape') { close(); anchor.focus(); } };
  function close() {
    menu.remove();
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', onKey);
    closeActiveMenu = null;
  }
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b) { close(); items[b.dataset.i].fn(); }
  });
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close, { once: true });
  menu.querySelector('button')?.focus();
  closeActiveMenu = close;
}

// "Dışarı aktar": her raporda aynı düğme ve menü. build() raporu veri olarak kurar (excel.js); Excel ve PDF aynı satırları kullanır.
function exportButton(attr, enabled = true) {
  return `<button class="btn ghost sm" ${attr}${enabled ? '' : ' disabled'} aria-haspopup="menu">${icon('download', 15)} Dışarı aktar ${icon('chevron-down', 14)}</button>`;
}
function openExportChoice(anchor, build) {
  openMenu(anchor, [
    { icon: 'sheet', label: 'Excel', hint: '.xlsx', fn: () => saveReportExcel(build()).catch(e => toast(e.message, { tone: 'danger' })) },
    { icon: 'printer', label: 'PDF / Yazdır', hint: 'A4 yatay', fn: () => printReport(build()) },
  ]);
}

const AVATAR_COLORS =['#2b8a3e', '#2563eb', '#9333ea', '#db2777', '#ea580c', '#0891b2', '#4f46e5'];
function avatar(user, size = 32) {
  const color = AVATAR_COLORS[[...user.id].reduce((t, c) => t + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return `<span class="avatar" style="--av:${color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" title="${esc(user.name)}">${esc(initials(user.name))}</span>`;
}

// Tarayıcıda oluşturulan metni ya da dosyayı indirir
function downloadText(fileName, text, type = 'application/json') {
  downloadBlob(fileName, new Blob([text], { type }));
}
function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// "bugün", "dün", "5 gün önce"
function daysAgoText(stamp) {
  const n = daysBetween(toISO(new Date(stamp)), todayISO());
  return n <= 0 ? 'bugün' : n === 1 ? 'dün' : `${n} gün önce`;
}

function pill(label, tone) { return `<span class="pill pill-${tone}">${esc(label)}</span>`; }
function leaveStatusPill(status) { const s = LEAVE_STATUS[status]; return pill(s.label, s.tone); }
function projectStatusPill(status) { const s = PROJECT_STATUS[status]; return pill(s.label, s.tone); }

function emptyState(ic, title, text = '') {
  return `<div class="empty"><span class="empty-ic">${icon(ic, 20)}</span><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

function formError(form, msg, field) {
  const p = form.querySelector('.form-error');
  p.textContent = msg;
  p.hidden = false;
  if (field) {
    field.classList.add('is-invalid');
    field.focus();
    field.addEventListener('input', () => { field.classList.remove('is-invalid'); p.hidden = true; }, { once: true });
  }
}

/* ---------- Tarih alanı: gg.aa.yyyy ----------
   Tarayıcının tarih kutusu tarihi tarayıcının diline göre gösterir (İngilizcede ay/gün/yıl). Asıl <input type="date">
   gizli kalır: adı, ISO değeri ve olayları aynen çalışır, formlar bir şey fark etmez. Üstünde gg.aa.yyyy yazılan bir
   kutu ve Türkçe, pazartesiyle başlayan bir takvim durur. Sayfaya eklenen her tarih kutusu kendiliğinden dönüşür. */
const TR_WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const NATIVE_VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

const fmtDateInput = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
// "23.10.2026", "3/1/2026", "23-10-26", "23102026" → ISO; olmayan tarih (31.02) → null.
// Yazarken (loose = false) yıl dört hane olmalı; yoksa "23.10.20" yazılırken 2020'ye atlanırdı.
function parseDateInput(text, loose = false) {
  const m = String(text || '').trim().match(loose ? /^(\d{1,2})[./\- ](\d{1,2})[./\- ](\d{4}|\d{2})$/ : /^(\d{1,2})[./\- ](\d{1,2})[./\- ](\d{4})$/)
    || String(text || '').trim().match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return y >= 1900 && y <= 2100 && dt.getMonth() === mo - 1 && dt.getDate() === d ? toISO(dt) : null;
}

function enhanceDateInput(native) {
  native.dataset.dated = '1';
  const wrap = document.createElement('span'), text = document.createElement('input'), btn = document.createElement('button');
  wrap.className = 'date-field';
  Object.assign(text, { type: 'text', className: `${native.className} date-text`, placeholder: 'gg.aa.yyyy', maxLength: 10, autocomplete: 'off' });
  text.setAttribute('inputmode', 'numeric');
  if (native.id) { text.id = native.id; native.removeAttribute('id'); }     // <label for> görünen kutuya gitsin
  Object.assign(btn, { type: 'button', className: 'date-btn', tabIndex: -1, innerHTML: icon('calendar', 16) });
  btn.setAttribute('aria-label', 'Takvimden seç');
  native.tabIndex = -1;
  native.setAttribute('aria-hidden', 'true');
  native.before(wrap);
  wrap.append(text, btn, native);

  const field = {
    native, text,
    show() { text.value = fmtDateInput(NATIVE_VALUE.get.call(native)); text.disabled = btn.disabled = native.disabled; },
    commit(iso) {               // asıl kutuya yazar; formlar her zamanki input / change olaylarını alır
      if (iso === NATIVE_VALUE.get.call(native)) return;
      NATIVE_VALUE.set.call(native, iso);
      native.dispatchEvent(new Event('input', { bubbles: true }));
      native.dispatchEvent(new Event('change', { bubbles: true }));
      if (datePop?.field === field) datePop.sync();
    },
    settle() {                  // yazılanı kabul et; anlaşılmazsa son geçerli tarihe dön
      const v = text.value.trim(), iso = v ? parseDateInput(v, true) : '';
      if (iso !== null) field.commit(iso);
      field.show();
    },
  };
  // Kod değeri doğrudan yazınca (el.start.value = '…') görünen kutu da güncellensin
  Object.defineProperty(native, 'value', { configurable: true, get() { return NATIVE_VALUE.get.call(this); }, set(v) { NATIVE_VALUE.set.call(this, v); field.show(); } });
  native.addEventListener('focus', () => text.focus());     // formError ve etiket tıklaması görünen kutuya gelsin
  native.form?.addEventListener('reset', () => setTimeout(field.show));

  text.addEventListener('input', e => {
    if (e.inputType?.startsWith('insert') && /^\d{2}$|^\d{1,2}\.\d{2}$/.test(text.value)) text.value += '.';
    const v = text.value.trim(), iso = v ? parseDateInput(v) : '';
    if (iso !== null) field.commit(iso);
  });
  text.addEventListener('blur', () => { if (datePop?.field !== field) field.settle(); });
  text.addEventListener('keydown', e => {
    if (e.key === 'Enter') field.settle();                   // gönderimden önce yazılan tarih asıl kutuya geçsin
    if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); openDatePicker(field); }
  });
  text.addEventListener('click', () => { if (datePop?.field !== field) openDatePicker(field); });
  btn.addEventListener('click', () => { if (datePop?.field === field) closeDatePicker(); else { text.focus(); openDatePicker(field); } });
  field.show();
}

let datePop = null;     // açık takvim: { field, el, sync, close }
function closeDatePicker() { datePop?.close(); }

function openDatePicker(field) {
  closeDatePicker();
  const { native, text } = field;
  if (native.disabled) return;
  const today = todayISO(), min = native.min, max = native.max;
  const outside = d => (min && d < min) || (max && d > max);
  const startOn = () => monthStart(native.value || (max && today > max ? max : min && today < min ? min : today));
  let month = startOn();
  const el = document.createElement('div');
  el.className = 'date-pop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Tarih seç');

  const render = () => {
    const sel = native.value, days = Array.from({ length: 42 }, (_, i) => addDays(weekStart(month), i));
    el.innerHTML = `<div class="dp-head">
        <button type="button" class="icon-btn sm" data-dp-nav="-1" aria-label="Önceki ay">${icon('chevron-left', 16)}</button>
        <strong>${monthTitle(month)}</strong>
        <button type="button" class="icon-btn sm" data-dp-nav="1" aria-label="Sonraki ay">${icon('chevron-right', 16)}</button>
      </div>
      <div class="dp-grid">${TR_WEEKDAYS_SHORT.map(d => `<span class="dp-wd">${d}</span>`).join('')}${days.map(d => `<button type="button" class="dp-day${
        d.slice(0, 7) !== month.slice(0, 7) ? ' is-out' : ''}${isWeekend(d) ? ' is-we' : ''}${d === today ? ' is-today' : ''}${d === sel ? ' is-sel' : ''}" data-dp-day="${d}"${
        outside(d) ? ' disabled' : ''} aria-label="${fmtDate(d, { weekday: true })}">${parseISO(d).getDate()}</button>`).join('')}</div>
      <div class="dp-foot"><button type="button" class="link-btn" data-dp-day="${today}"${outside(today) ? ' disabled' : ''}>Bugün</button>
        <button type="button" class="link-btn" data-dp-clear>Temizle</button></div>`;
  };
  const place = () => {
    const r = text.getBoundingClientRect(), h = el.offsetHeight, w = el.offsetWidth;
    const below = r.bottom + 6 + h <= innerHeight || r.top - 6 - h < 0;
    el.style.top = `${below ? r.bottom + 6 : r.top - 6 - h}px`;
    el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
  };
  const pick = iso => { close(); field.commit(iso); field.show(); if (text.isConnected) text.focus(); };

  el.addEventListener('mousedown', e => e.preventDefault());       // tıklamak yazı kutusunun odağını almasın
  el.addEventListener('click', e => {
    const nav = e.target.closest('[data-dp-nav]'), day = e.target.closest('[data-dp-day]');
    if (nav) { month = addMonths(month, Number(nav.dataset.dpNav)); render(); }
    else if (day && !day.disabled) pick(day.dataset.dpDay);
    else if (e.target.closest('[data-dp-clear]')) pick('');
  });
  const onDown = e => { if (!el.contains(e.target) && !text.parentNode.contains(e.target)) close(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); text.focus(); } };   // açık pencere kapanmasın
  const onScroll = e => { if (!el.contains(e.target)) close(); };
  function close() {
    el.remove();
    document.removeEventListener('mousedown', onDown, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
    if (datePop?.el === el) datePop = null;
  }
  document.addEventListener('mousedown', onDown, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', close);
  datePop = { field, el, close, sync() { month = startOn(); render(); } };
  render();
  document.body.append(el);
  place();
}

function enhanceDateInputs(root) {
  if (root.matches?.('input[type="date"]:not([data-dated])')) enhanceDateInput(root);
  else root.querySelectorAll?.('input[type="date"]:not([data-dated])').forEach(enhanceDateInput);
}
new MutationObserver(list => list.forEach(r => r.addedNodes.forEach(n => n.nodeType === 1 && enhanceDateInputs(n))))
  .observe(document.body, { childList: true, subtree: true });
enhanceDateInputs(document.body);

function groupByCustomer(projects) {
  const map = new Map();
  projects.forEach(p => { if (!map.has(p.customerId)) map.set(p.customerId, []); map.get(p.customerId).push(p); });
  return [...map].map(([cid, items]) => ({ customer: Store.customer(cid), items }))
    .sort((a, b) => (a.customer.internal ? 1 : 0) - (b.customer.internal ? 1 : 0) || a.customer.name.localeCompare(b.customer.name, 'tr'))
    .map(g => ({ title: g.customer.name, items: g.items }));
}

/* ---------- Proje seçici ----------
   Tek kutuda müşteri + proje arar. Klavye: ↑↓ gez, Enter/Tab seç, Esc kapat.
   Boşken son kullanılan projeler en üstte gelir.
   onChange: her seçimde · onPick: fareyle/Enter ile seçimde (odağı sonraki alana taşımak için) */
function createProjectPicker(root, { userId, value = null, onPick, onChange } = {}) {
  const PLACEHOLDER = 'Müşteri, proje veya kod ara…';
  root.classList.add('picker');
  root.innerHTML = `
    <div class="picker-field">
      <span class="picker-dot"></span>
      <input class="input picker-input" type="text" placeholder="${PLACEHOLDER}" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list">
      <span class="picker-caret">${icon('chevron-down', 16)}</span>
    </div>
    <div class="picker-list" role="listbox" hidden></div>`;
  const input = root.querySelector('input'), list = root.querySelector('.picker-list'), dot = root.querySelector('.picker-dot');
  let selected = null, options = [], active = 0, query = '';

  const labelOf = p => `${Store.customer(p.customerId).name} · ${p.name}`;

  function setValue(id) {
    const p = id ? Store.project(id) : null;
    selected = p ? p.id : null;
    input.value = p ? labelOf(p) : '';
    input.placeholder = PLACEHOLDER;
    dot.style.background = p ? Store.customer(p.customerId).color : '';
    root.classList.toggle('has-value', !!p);
  }

  function groups() {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    const matches = Store.projects({ activeOnly: true }).filter(p => {
      const hay = fold(`${Store.customer(p.customerId).name} ${p.name} ${p.code}`);
      return terms.every(t => hay.includes(t));
    });
    if (terms.length) return groupByCustomer(matches);
    const recent = recentProjectIds(userId).map(id => matches.find(p => p.id === id)).filter(Boolean).slice(0, 4);
    const rest = matches.filter(p => !recent.includes(p));
    return [...(recent.length ? [{ title: 'Son kullanılanlar', items: recent }] : []), ...groupByCustomer(rest)];
  }

  function render() {
    const gs = groups();
    options = gs.flatMap(g => g.items);
    if (active < 0) active = Math.max(0, options.findIndex(p => p.id === selected));
    active = Math.min(active, Math.max(0, options.length - 1));
    if (!options.length) { list.innerHTML = '<div class="picker-empty">Eşleşen aktif proje yok</div>'; return; }
    let i = 0;
    list.innerHTML = gs.map(g => `<div class="picker-group">${esc(g.title)}</div>` + g.items.map(p => {
      const idx = i++, c = Store.customer(p.customerId);
      return `<div class="picker-opt${idx === active ? ' is-active' : ''}${p.id === selected ? ' is-selected' : ''}" role="option" data-idx="${idx}">
        <span class="dot" style="background:${c.color}"></span>
        <span class="picker-opt-main"><span class="picker-opt-name">${esc(p.name)}</span><span class="picker-opt-sub">${esc(c.name)} · ${esc(p.code)}</span></span>
        ${p.billable ? '' : '<span class="tag">İç</span>'}
      </div>`;
    }).join('')).join('');
  }

  const scrollActive = () => list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  const show = () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); scrollActive(); };

  function open() {
    if (!list.hidden) return;
    query = '';
    active = -1;                         // seçili projenin üstünde açıl
    if (selected) { input.placeholder = input.value; input.value = ''; }
    render();
    show();
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setValue(selected);                  // yazılıp seçilmeden bırakılan metni geri al
  }
  function choose(idx, { viaTab = false } = {}) {
    const p = options[idx];
    if (!p) return;
    setValue(p.id);
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    onChange?.(p.id);
    if (!viaTab) onPick?.(p.id);         // Tab zaten bir sonraki alana geçiriyor
  }

  input.addEventListener('focus', () => { input.select(); if (!selected) open(); });
  input.addEventListener('click', open);
  input.addEventListener('input', () => {
    query = input.value;
    active = 0;
    render();
    if (list.hidden) show(); else scrollActive();
  });
  input.addEventListener('keydown', e => {
    const isOpen = !list.hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) return open();
      if (!options.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      render();
      scrollActive();
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab' && isOpen) {
      if (query && options.length) choose(active, { viaTab: true }); else close();
    }
  });
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) close(); }, 0));
  list.addEventListener('mousedown', e => e.preventDefault());   // odak input'ta kalsın
  list.addEventListener('click', e => {
    const opt = e.target.closest('.picker-opt');
    if (opt) choose(Number(opt.dataset.idx));
  });

  setValue(value);
  return { get value() { return selected; }, input, focus: () => input.focus(), set: setValue };
}

/* ---------- Aktivite formu ----------
   Özet'teki hızlı giriş, Aktiviteler'deki gün kartı ve düzenleme penceresi aynı bileşeni kullanır.
   Satır 1: proje + süre · Satır 2: açıklama + tür (+ tarih) + kaydet.
   showDate: false → tarih seçili günden gelir (Aktiviteler'de gün kutularıyla değişir). */
function createEntryForm(root, { userId, initial = {}, editingId = null, submitLabel = 'Ekle', showDate = true, onSubmit, onDateChange }) {
  const prefs = Prefs.get(userId);
  const lastProject = prefs.lastProject && Store.project(prefs.lastProject)?.status === 'aktif' ? prefs.lastProject : null;
  const id = uid();
  root.innerHTML = `
    <form class="entry-form" novalidate>
      <div class="ef-row">
        <div class="field ef-project"><span class="field-label">Müşteri / Proje</span><div class="ef-picker"></div></div>
        <div class="field ef-hours">
          <label class="field-label" for="h-${id}">Süre</label>
          <div class="hours-line">
            <div class="hours-box"><input class="input" id="h-${id}" name="hours" inputmode="decimal" autocomplete="off" placeholder="0"><span class="hours-unit">sa</span></div>
            <div class="chips">
              ${[1, 2, 4, 8].map(h => `<button type="button" class="chip" data-h="${h}" tabindex="-1">${h}</button>`).join('')}
              <button type="button" class="chip fill" data-fill tabindex="-1" title="Günün hedefini tamamlar" hidden></button>
            </div>
          </div>
        </div>
      </div>
      <div class="ef-row">
        <div class="field ef-note">
          <label class="field-label" for="n-${id}">Açıklama</label>
          <input class="input" id="n-${id}" name="note" autocomplete="off" maxlength="${NOTE_MAX}" placeholder="Ne üzerinde çalıştın?">
        </div>
        <div class="field ef-type">
          <label class="field-label" for="t-${id}">Tür</label>
          <select class="input" id="t-${id}" name="type">${ACTIVITY_TYPES.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
        </div>
        ${showDate ? `<div class="field ef-date">
          <label class="field-label" for="d-${id}">Tarih</label>
          <input class="input" id="d-${id}" type="date" name="date">
        </div>` : '<input type="hidden" name="date">'}
        <button class="btn primary ef-submit" type="submit">${icon(editingId ? 'check' : 'plus', 16)} ${esc(submitLabel)}</button>
      </div>
      <p class="ef-error" role="alert" hidden></p>
    </form>`;

  const form = root.querySelector('form');
  const { hours, type, note, date } = form.elements;
  const err = form.querySelector('.ef-error'), fill = form.querySelector('[data-fill]');
  const picker = createProjectPicker(form.querySelector('.ef-picker'), {
    userId,
    value: initial.projectId ?? lastProject,
    onPick: () => hours.focus(),
  });

  type.value = initial.type || prefs.lastType || ACTIVITY_TYPES[0].id;
  hours.value = initial.hours != null ? fmtNum(initial.hours) : '';
  note.value = initial.note || '';
  date.value = initial.date || todayISO();

  // "Kalan" çipi: seçili günün hedefini tamamlamak için gereken saat
  function updateFill() {
    if (!date.value) { fill.hidden = true; return; }
    const own = editingId ? (Store.activities({ userId, from: date.value, to: date.value }).find(a => a.id === editingId)?.hours || 0) : 0;
    const rem = dailyTarget(userId, date.value) - hoursOn(userId, date.value) + own;
    fill.hidden = !(rem > 0);
    if (rem > 0) { fill.dataset.h = rem; fill.textContent = `Kalan ${fmtNum(rem)}`; }
  }

  function clearError() {
    err.hidden = true;
    form.querySelectorAll('.is-invalid').forEach(x => x.classList.remove('is-invalid'));
  }
  function showError(msg, field) {
    clearError();
    err.textContent = msg;
    err.hidden = false;
    field.classList.add('is-invalid');
    field.focus();
  }

  form.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    hours.value = fmtNum(Number(chip.dataset.h));
    clearError();
    note.focus();
  });
  form.addEventListener('input', clearError);
  date.addEventListener('change', () => { updateFill(); if (date.value) onDateChange?.(date.value); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const h = Math.round(parseHours(hours.value) * 4) / 4;   // çeyrek saate yuvarla
    if (!picker.value) return showError('Bir müşteri / proje seç.', picker.input);
    if (!(h > 0)) return showError('Süreyi saat olarak yaz: 2, 1,5 ya da 1:30 gibi.', hours);
    if (h > 24) return showError('Tek bir kayıt 24 saati geçemez.', hours);
    if (!date.value) return showError('Tarih seç.', date);
    if (isLocked(userId, date.value)) return showError(lockMessage(userId, date.value), date);
    Prefs.set(userId, { lastProject: picker.value, lastType: type.value });
    onSubmit({ date: date.value, projectId: picker.value, type: type.value, hours: h, note: note.value.trim() }, api);
  });

  const api = {
    reset() { hours.value = ''; note.value = ''; clearError(); updateFill(); picker.focus(); },
    setDate(iso) { date.value = iso; updateFill(); },
    refresh: updateFill,
    focus: () => picker.focus(),
    focusHours: () => hours.focus(),
  };
  updateFill();
  return api;
}

/* ---------- Aktivite satırı (liste) ---------- */
function activityRow(a, { showDate = false } = {}) {
  const p = Store.project(a.projectId), c = Store.customer(p.customerId), locked = isLocked(a.userId, a.date);
  return `<div class="act-row${showDate ? ' with-date' : ''}${locked ? ' is-locked' : ''}" data-id="${a.id}" tabindex="0" role="button" aria-label="${esc(p.name)}, ${fmtHours(a.hours)}${locked ? ' — kilitli' : ' — düzenle'}">
    <span class="act-bar" style="background:${c.color}"></span>
    <div class="act-main">
      <div class="act-title">${a.source?.kind === 'outlook' ? `<span class="act-src" title="Outlook takviminden">${icon('calendar', 13)}</span>` : ''}<strong>${esc(p.name)}</strong> <span class="muted">· ${esc(c.name)}</span></div>
      <div class="act-note">${a.note ? esc(a.note) : '<span class="faint">Açıklama yok</span>'}</div>
    </div>
    ${showDate ? `<span class="act-date">${dayName(a.date, true)}, ${fmtShort(a.date)}</span>` : ''}
    <span class="tag act-type">${esc(activityTypeName(a.type))}</span>
    <span class="act-hours">${fmtHours(a.hours)}</span>
    ${locked ? `<span class="act-lock" title="${esc(lockMessage(a.userId, a.date))}">${icon('lock', 15)}</span>`
      : `<button class="icon-btn sm act-del" data-del title="Sil" aria-label="Sil">${icon('trash', 15)}</button>`}
  </div>`;
}

// Satıra tıkla → düzenle, çöp kutusu / Delete → sil (geri alınabilir)
function bindActivityRows(container, onChange) {
  container.addEventListener('click', e => {
    const row = e.target.closest('.act-row');
    if (!row) return;
    const act = Store.activity(row.dataset.id);
    if (!act) return;
    if (isLocked(act.userId, act.date)) return toast(lockMessage(act.userId, act.date), { tone: 'info' });
    if (e.target.closest('[data-del]')) return deleteActivityWithUndo(act.id, onChange);
    editActivity(act, onChange);
  });
  container.addEventListener('keydown', e => {
    if (!e.target.classList.contains('act-row')) return;
    if (e.key === 'Enter') { e.preventDefault(); e.target.click(); }
    if (e.key === 'Delete' && !e.target.classList.contains('is-locked')) deleteActivityWithUndo(e.target.dataset.id, onChange);
  });
}

function deleteActivityWithUndo(id, onChange) {
  const removed = Store.deleteActivity(id);
  if (!removed) return;
  onChange();
  toast(`${fmtHours(removed.hours)} kayıt silindi`, { tone: 'info', action: { label: 'Geri al', fn: () => { Store.restoreActivity(removed); onChange(); } } });
}

function editActivity(act, onChange) {
  openModal({
    title: 'Aktiviteyi düzenle',
    body: '<div data-form></div>',
    footer: `<button class="btn danger-ghost sm" data-remove>${icon('trash', 15)} Sil</button><span class="grow"></span><span class="kbd-hint"><kbd>Esc</kbd> kapat</span>`,
    onMount(modal, close) {
      const f = createEntryForm(modal.querySelector('[data-form]'), {
        userId: act.userId, initial: act, editingId: act.id, submitLabel: 'Kaydet',
        onSubmit(data) { Store.updateActivity(act.id, data); close(); onChange(); toast('Aktivite güncellendi'); },
      });
      modal.querySelector('[data-remove]').addEventListener('click', () => { close(); deleteActivityWithUndo(act.id, onChange); });
      setTimeout(f.focusHours, 60);
    },
  });
}

/* ---------- Aylık takvim ----------
   Ayın her gününü giriş durumuna göre renklendirir; hücreler data-cal-day ile tıklanır. */
function dayStatusLabel(userId, d) {
  switch (d.status) {
    case 'full': return `${fmtNum(d.logged)} sa · tamam`;
    case 'partial': return `${fmtNum(d.target - d.logged)} sa eksik`;
    case 'missing': return 'Girilmedi';
    case 'planned': return `${fmtNum(d.logged)} sa planlı`;
    case 'extra': return `${fmtNum(d.logged)} sa (${dayOffReason(userId, d.date) || 'tatil'})`;
    case 'off': return dayOffReason(userId, d.date) || '';
    default: return 'Henüz boş';
  }
}

function monthCalendar(userId, iso, { selected = null } = {}) {
  const s = monthSummary(userId, iso), today = todayISO();
  const lead = (parseISO(monthStart(iso)).getDay() + 6) % 7;   // ay pazartesiden başlamıyorsa boş hücre
  const cell = d => {
    const off = d.status === 'off' && !isWeekend(d.date);
    const note = d.status === 'missing' ? 'Girilmedi' : off ? dayOffReason(userId, d.date) : d.status === 'partial' ? `${fmtNum(d.target - d.logged)} sa eksik` : '';
    const hours = d.target || d.logged ? `${fmtNum(d.logged)}${d.target ? ` / ${fmtNum(d.target)}` : ''}` : '';
    return `<button class="cal-cell st-${d.status}${d.date === today ? ' is-today' : ''}${d.date === selected ? ' is-selected' : ''}" data-cal-day="${d.date}" title="${esc(`${fmtDate(d.date, { weekday: true })} · ${dayStatusLabel(userId, d)}`)}">
      <span class="cal-num">${parseISO(d.date).getDate()}</span>
      <span class="cal-hours">${hours}</span>
      <span class="cal-note">${esc(note || '')}</span>
    </button>`;
  };
  return `<div class="cal">
    <div class="cal-head">${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(n => `<span>${n}</span>`).join('')}</div>
    <div class="cal-grid">${'<span class="cal-cell is-empty"></span>'.repeat(lead)}${s.days.map(cell).join('')}</div>
  </div>`;
}

function monthStatsHtml(s) {
  const pct = s.target ? Math.min(100, (s.logged / s.target) * 100) : 0;
  const row = (st, n, label) => `<div class="ms st-${st}"><span class="ms-dot"></span><span>${label}</span><b>${n}</b></div>`;
  return `<div class="month-stats">
    <div class="ms-total">
      <span class="ms-big">${fmtNum(s.logged)}<small> / ${fmtNum(s.target)} sa</small></span>
      <div class="meter"><span style="width:${pct}%"></span></div>
      <span class="muted">${s.workdays} iş günü · %${Math.round(pct)} dolu</span>
    </div>
    ${row('full', s.full, 'Tamamlanan gün')}
    ${row('missing', s.missing, 'Girilmemiş gün')}
    ${row('partial', s.partial, 'Eksik saatli gün')}
    ${row('open', s.open, 'Kalan iş günü')}
    ${row('off', s.off, 'Tatil / izin')}
  </div>`;
}

/* ---------- Köprü izni seçimi ----------
   Köprü gününde şirket kapalıdır. Danışman o güne kadar seçer: izinli (tamamı yıllık izninden düşer), yarım gün çalışır
   (yarım gün düşer) ya da tam gün çalışır (düşmez). Satırlar data-bridge, seçenekler data-bridge-work="off|half|full" taşır. */
const upcomingBridges = (to = null) => Store.holidays({ from: todayISO(), to }).filter(h => h.kind === 'kopru' && !isWeekend(h.date));

// Yarım gün köprüde iki seçenek kalır: izinli ya da çalışıyor
const bridgeOptions = h => h.half ? [['off', 'İzinliyim'], ['full', 'Çalışacağım']]
  : [['off', 'İzinliyim'], ['half', 'Yarım gün çalışacağım'], ['full', 'Tam gün çalışacağım']];
const bridgeChoice = (h, userId) => { const w = bridgeWork(h, userId); return !w ? 'off' : h.half ? 'full' : w; };

function bridgeStatusText(h, userId) {
  const choice = bridgeChoice(h, userId), off = bridgeOff(h, userId);
  const cost = off ? `yıllık izninden ${fmtNum(off)} gün düşer` : 'yıllık izninden düşmez';
  if (choice === 'off') return `Şirket kapalı${h.half ? ' (yarım gün)' : ''}; ${cost}.`;
  const who = choice === 'half' ? 'Yarım gün çalışıyorsun' : h.half ? 'Çalışıyorsun' : 'Tam gün çalışıyorsun';
  return `${who} · hedef ${fmtNum(dailyTarget(userId, h.date))} sa · ${cost}.`;
}

function bridgeChoiceHtml(h, userId) {
  const choice = bridgeChoice(h, userId);
  const action = canChooseBridge(h, userId)
    ? `<div class="bridge-opts" role="group" aria-label="Köprü günü seçimin">${bridgeOptions(h).map(([v, label]) =>
        `<button class="${v === choice ? 'is-active' : ''}" data-bridge-work="${v}" aria-pressed="${v === choice}">${label}</button>`).join('')}</div>`
    : `<span class="muted small-text nowrap">${icon('lock', 13)} ${isLocked(userId, h.date) ? 'Ay kapanışa gönderildi' : 'Seçim süresi geçti; yöneticine söyle'}</span>`;
  return `<div class="bridge${choice !== 'off' ? ' is-working' : ''}" data-bridge="${h.id}">
    <span class="bridge-ic">${icon(choice !== 'off' ? 'clock' : 'sun', 16)}</span>
    <div class="bridge-main"><strong>${fmtDate(h.date, { weekday: true, year: false })} · ${esc(h.name)}</strong>
      <small>${esc(bridgeStatusText(h, userId))}</small></div>
    ${action}
  </div>`;
}

// Seçimi kaydeder; tıklama bir köprü seçeneğiyse true döner
function handleBridgeClick(e, userId, onChange) {
  const b = e.target.closest('[data-bridge-work]');
  if (!b) return false;
  const h = Store.holidays().find(x => x.id === b.closest('[data-bridge]').dataset.bridge);
  if (!h || !canChooseBridge(h, userId)) return true;
  const work = { ...(h.work || {}) };
  if (b.dataset.bridgeWork === 'off') delete work[userId];
  else work[userId] = h.half ? 'full' : b.dataset.bridgeWork;
  Store.updateHoliday(h.id, { work });
  onChange();
  const off = bridgeOff({ ...h, work }, userId);
  toast(`${fmtShort(h.date)} · ${off ? `yıllık izninden ${fmtNum(off)} gün düşecek` : 'yıllık izninden düşmeyecek'}`, { tone: 'info' });
  return true;
}

/* ---------- İzin satırı ----------
   showDetails: false → ekip görünümü; başkasının izin türü ve notu gösterilmez. */
function leaveRow(l, { user = null, showDetails = true, actions = '' } = {}) {
  const d = parseISO(l.start);
  const title = user ? `${avatar(user, 22)} ${esc(user.name)}${showDetails ? ` · ${esc(leaveTypeName(l.type))}` : ''}` : esc(leaveTypeName(l.type));
  const details = [fmtRange(l.start, l.end), `${fmtNum(leaveDays(l))} iş günü${l.halfDay ? ' (yarım gün)' : ''}`];
  if (showDetails && l.note) details.push(esc(l.note));
  return `<div class="leave-row" data-id="${l.id}">
    <span class="date-badge"><b>${d.getDate()}</b><span>${TR_MONTHS_SHORT[d.getMonth()]}</span></span>
    <div class="leave-main"><strong>${title}</strong><small>${details.join(' · ')}</small></div>
    <span class="leave-pills">${leaveStatusPill(l.status)}${l.status === 'onaylandi' && l.cancel?.status === 'beklemede' ? pill('İptal talebi onayda', 'warn')
      : l.status === 'onaylandi' && l.cancel?.status === 'reddedildi' ? pill('İptal reddedildi', 'muted') : ''}</span>
    <div class="leave-actions">${actions}</div>
  </div>`;
}
