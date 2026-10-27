/* Ay kapanışı: danışman ayı onaya gönderir (ay kilitlenir), yönetici onaylar ya da iade eder.
   Onaylanan ayın aylık aktivite formu indirilebilir; gerekirse yönetici kilidi açar. */

// Ayın proje bazında özeti: [{ project, customer, days, hours }]
function monthByProject(userId, iso) {
  const map = new Map();
  Store.activities({ userId, from: monthStart(iso), to: monthEnd(iso) }).forEach(a => {
    if (!map.has(a.projectId)) {
      const project = Store.project(a.projectId);
      map.set(a.projectId, { project, customer: Store.customer(project.customerId), days: new Set(), hours: 0 });
    }
    const row = map.get(a.projectId);
    row.days.add(a.date);
    row.hours += a.hours;
  });
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

const incompleteDays = summary => summary.days.filter(d => d.status === 'missing' || d.status === 'partial');

function projectSummaryTable(rows) {
  if (!rows.length) return emptyState('inbox', 'Bu ay için kayıt yok');
  return `<table class="table close-table">
    <thead><tr><th>Müşteri / Proje</th><th class="num">Gün</th><th class="num">Saat</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td><span class="cell-proj"><span class="dot" style="background:${r.customer.color}"></span><span><strong>${esc(r.customer.name)}</strong><small>${esc(r.project.name)}</small></span></span></td>
      <td class="num">${r.days.size}</td><td class="num"><strong>${fmtNum(r.hours)}</strong></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function periodHistoryHtml(p) {
  if (!p?.history?.length) return '';
  return `<div class="history"><div class="sub-head">Geçmiş</div>
    ${p.history.slice().reverse().map(h => `<div class="history-row">
      <span class="history-dot"></span>
      <span class="grow"><strong>${esc(Store.user(h.by)?.name || '')}</strong> ${PERIOD_ACTIONS[h.action] || esc(h.action)}${h.note ? ` — “${esc(h.note)}”` : ''}</span>
      <small class="muted nowrap">${fmtStamp(h.at)}</small>
    </div>`).join('')}
  </div>`;
}

/* ---------- Danışman paneli (Aktiviteler → Aylık ve Özet'teki aylık kart) ---------- */

function periodPanelHtml(user, iso) {
  if (monthStart(iso) > todayISO()) return '';   // gelecek ay kapatılamaz
  const p = Store.period(user.id, iso.slice(0, 7));
  const status = p?.status || 'acik';
  const approver = p?.decidedBy && Store.user(p.decidedBy);
  const ended = monthEnd(iso) < todayISO();
  const btn = (action, label, ic, cls = 'ghost') => `<button class="btn ${cls} sm" data-period="${action}">${icon(ic, 15)} ${label}</button>`;
  const download = cls => btn('download', 'Aylık formu indir', 'download', cls) + btn('print', 'Yazdır / PDF', 'printer');
  const view = {
    acik: [ended ? 'Ay bitti. Kayıtlarını kontrol et ve onaya gönder.' : 'Ay sonunda kayıtlarını kontrol edip onaya gönder.',
      btn('submit', 'Ayı onaya gönder', 'send', ended ? 'primary' : 'ghost')],
    gonderildi: [`${fmtStamp(p?.submittedAt)} gönderildi. Onaylanana kadar kayıtlar kilitli.`, btn('withdraw', 'Geri çek', 'refresh') + download('ghost')],
    onaylandi: [`${approver ? approver.name : 'Yönetici'} onayladı · ${fmtStamp(p?.decidedAt)}. Kayıtlar kilitli; imzalı çıktı için yazdırabilirsin.`, download('primary')],
    iade: [`İade nedeni: “${p?.reviewNote || '—'}” Düzeltip yeniden gönder.`, btn('submit', 'Yeniden gönder', 'send', 'primary')],
  }[status];
  return `<div class="period st-${status}">
    <div class="period-head"><span class="period-title">${icon(status === 'onaylandi' || status === 'gonderildi' ? 'lock' : 'send', 15)} Ay kapanışı</span>${pill(PERIOD_STATUS[status].label, PERIOD_STATUS[status].tone)}</div>
    <p class="period-text">${esc(view[0])}</p>
    <div class="period-actions">${view[1]}</div>
  </div>`;
}

// Paneldeki butonlar; true dönerse tıklama işlendi
function handlePeriodClick(e, user, iso, onChange) {
  const b = e.target.closest('[data-period]');
  if (!b) return false;
  const month = iso.slice(0, 7);
  if (b.dataset.period === 'submit') openSubmitDialog(user, iso, onChange);
  else if (b.dataset.period === 'download') exportMonthlyForm(user, iso).catch(err => toast(err.message, { tone: 'danger' }));
  else if (b.dataset.period === 'print') openPrintDialog(user, iso);
  else if (b.dataset.period === 'withdraw') {
    Store.setPeriod(user.id, month, { status: 'acik' }, { by: user.id, action: 'geri_cekildi' });
    App.refreshBadges();
    onChange();
    toast(`${monthTitle(iso)} gönderimi geri çekildi; kayıtları düzenleyebilirsin`, { tone: 'info' });
  }
  return true;
}

function openSubmitDialog(user, iso, onDone) {
  const month = iso.slice(0, 7), s = monthSummary(user.id, iso), rows = monthByProject(user.id, iso);
  const missing = incompleteDays(s);
  const approver = Store.users().find(u => u.role === 'admin' && u.active && u.id !== user.id);
  openModal({
    title: `${monthTitle(iso)} ayını onaya gönder`,
    body: `
      <div class="close-stats">
        <div><b>${fmtNum(s.logged)}</b><span>toplam saat</span></div>
        <div><b>${s.full} / ${s.workdays}</b><span>tamamlanan gün</span></div>
        <div class="${missing.length ? 'is-bad' : 'is-good'}"><b>${missing.length}</b><span>eksik gün</span></div>
      </div>
      ${projectSummaryTable(rows)}
      ${!rows.length ? '' : missing.length ? `<div class="callout warn">${icon('alert', 16)}<div>
          <strong>${missing.length} günde giriş eksik:</strong> ${missing.map(d => fmtShort(d.date)).join(', ')}
          <p>İzinliysen önce izin talebi oluştur. Bilerek gönderiyorsan aşağıdan onayla.</p>
          <label class="toggle"><input type="checkbox" data-ack> Eksik günleri biliyorum, yine de gönder</label>
        </div></div>` : `<div class="callout ok">${icon('check', 16)}<div>Tüm iş günleri dolu.</div></div>`}
      <label class="field"><span class="field-label">Yöneticine not <span class="faint">(isteğe bağlı)</span></span>
        <textarea class="input" rows="2" maxlength="500" data-note placeholder="${missing.length ? `Örn. ${fmtShort(missing[0].date)} izinliydim, izin talebini sonradan gireceğim` : 'Örn. ay boyunca ağırlıklı tek bir müşteri projesindeydim'}"></textarea></label>
      <p class="close-hint">${icon('lock', 14)} Gönderdikten sonra ${monthTitle(iso)} kayıtların kilitlenir. Onaylanana kadar geri çekebilirsin.</p>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-send>${icon('send', 15)} Onaya gönder</button>`,
    onMount(m, close) {
      const send = m.querySelector('[data-send]'), ack = m.querySelector('[data-ack]');
      send.disabled = !rows.length || !!ack;
      ack?.addEventListener('change', () => { send.disabled = !ack.checked; });
      send.addEventListener('click', () => {
        const note = m.querySelector('[data-note]').value.trim();
        Store.setPeriod(user.id, month, { status: 'gonderildi', submittedAt: new Date().toISOString(), note, reviewNote: '', decidedBy: null, decidedAt: null },
          { by: user.id, action: 'gonderildi', note });
        close();
        App.refreshBadges();
        onDone();
        toast(`${monthTitle(iso)} onaya gönderildi${approver ? ` · Onaylayacak: ${approver.name}` : ''}`);
      });
    },
  });
}

/* ---------- Yönetici incelemesi ---------- */

function openReviewDialog(user, iso, onDone) {
  const month = iso.slice(0, 7), p = Store.period(user.id, month), status = p?.status || 'acik';
  const s = monthSummary(user.id, iso), missing = incompleteDays(s);
  const me = App.user;
  const actions = {
    gonderildi: `<button class="btn ghost" data-return>İade et</button><button class="btn primary" data-approve>${icon('check', 15)} Onayla ve kilitle</button>`,
    onaylandi: `<button class="btn ghost" data-unlock>${icon('unlock', 15)} Kilidi aç</button>`,
  }[status] || '<button class="btn ghost" data-close>Kapat</button>';

  openModal({
    title: `${user.name} · ${monthTitle(iso)}`,
    size: 'wide',
    body: `
      <div class="review">
        <div class="review-cal">${monthCalendar(user.id, iso)}</div>
        <aside class="review-side">
          <div class="row-gap">${pill(PERIOD_STATUS[status].label, PERIOD_STATUS[status].tone)}${p?.submittedAt && status !== 'acik' ? `<span class="muted">Gönderim: ${fmtStamp(p.submittedAt)}</span>` : ''}</div>
          <div class="close-stats compact">
            <div><b>${fmtNum(s.logged)}</b><span>saat</span></div>
            <div><b>${s.full}/${s.workdays}</b><span>tam gün</span></div>
            <div class="${missing.length ? 'is-bad' : 'is-good'}"><b>${missing.length}</b><span>eksik gün</span></div>
          </div>
          ${projectSummaryTable(monthByProject(user.id, iso))}
          ${missing.length ? `<div class="callout warn">${icon('alert', 16)}<div><strong>Eksik günler:</strong> ${missing.map(d => fmtShort(d.date)).join(', ')}</div></div>` : ''}
          ${p?.note ? `<div class="quote"><small>Danışmanın notu</small>“${esc(p.note)}”</div>` : ''}
          ${status === 'gonderildi' ? `<label class="field"><span class="field-label">İade nedeni <span class="faint">(iade edeceksen zorunlu)</span></span>
            <textarea class="input" rows="2" maxlength="500" data-reason placeholder="Örn. 25 ve 28 Eylül eksik, izin girilmemiş"></textarea></label>
            <p class="form-error" data-reason-error hidden></p>` : ''}
          ${periodHistoryHtml(p)}
        </aside>
      </div>`,
    footer: `<button class="btn ghost sm" data-dl>${icon('download', 15)} Aylık formu indir</button>
      <button class="icon-btn bordered" data-print-form title="Yazdır / PDF" aria-label="Yazdır / PDF">${icon('printer', 16)}</button><span class="grow"></span>${actions}`,
    onMount(m, close) {
      const done = msg => { close(); App.refreshBadges(); onDone(); if (msg) toast(msg.text, msg.opts); };
      m.querySelector('[data-dl]').addEventListener('click', () => exportMonthlyForm(user, iso).catch(e => toast(e.message, { tone: 'danger' })));
      m.querySelector('[data-print-form]').addEventListener('click', () => { close(); openPrintDialog(user, iso); });

      m.querySelector('[data-approve]')?.addEventListener('click', () => {
        Store.setPeriod(user.id, month, { status: 'onaylandi', decidedBy: me.id, decidedAt: new Date().toISOString(), reviewNote: '' }, { by: me.id, action: 'onaylandi' });
        done({
          text: `${user.name} · ${monthTitle(iso)} onaylandı ve kilitlendi`,
          opts: { action: { label: 'Geri al', fn: () => { Store.setPeriod(user.id, month, { status: 'gonderildi', decidedBy: null, decidedAt: null }, { by: me.id, action: 'onay_geri_alindi' }); App.refreshBadges(); onDone(); } } },
        });
      });

      m.querySelector('[data-return]')?.addEventListener('click', () => {
        const reason = m.querySelector('[data-reason]'), err = m.querySelector('[data-reason-error]');
        if (!reason.value.trim()) {
          err.textContent = 'İade nedenini yaz; danışman ne düzelteceğini görsün.';
          err.hidden = false;
          reason.classList.add('is-invalid');
          return reason.focus();
        }
        Store.setPeriod(user.id, month, { status: 'iade', reviewNote: reason.value.trim(), decidedBy: me.id, decidedAt: new Date().toISOString() },
          { by: me.id, action: 'iade', note: reason.value.trim() });
        done({ text: `${monthTitle(iso)} ${user.name} kişisine iade edildi`, opts: { tone: 'info' } });
      });

      const unlock = m.querySelector('[data-unlock]');
      unlock?.addEventListener('click', () => {
        if (!unlock.dataset.armed) {     // yanlışlıkla açılmasın diye ikinci tık
          unlock.dataset.armed = '1';
          unlock.innerHTML = `${icon('alert', 15)} Emin misin? Tekrar tıkla`;
          return;
        }
        Store.setPeriod(user.id, month, { status: 'acik', decidedBy: null, decidedAt: null }, { by: me.id, action: 'kilit_acildi' });
        done({ text: `${monthTitle(iso)} kilidi açıldı; ${firstName(user.name)} yeniden düzenleyebilir`, opts: { tone: 'info' } });
      });
    },
  });
}
