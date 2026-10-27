/* Aylık formun yazdırılabilir hali: müşteri başına bir A4 sayfa, isteğe bağlı imza alanı.
   Tarayıcının yazdır penceresinde "PDF olarak kaydet" seçilince PDF olur; ayrı bir PDF kütüphanesi gerekmez. */

// Ayın kayıtları müşteri → gün: [{ customer, hours, rows: [{ date, codes, notes, hours }] }]
function monthlyFormData(userId, iso) {
  const groups = new Map();
  Store.activities({ userId, from: monthStart(iso), to: monthEnd(iso) })
    .slice().sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt))
    .forEach(a => {
      const project = Store.project(a.projectId), customer = Store.customer(project.customerId);
      const g = groups.get(customer.id) || { customer, days: new Map(), hours: 0 };
      const day = g.days.get(a.date) || { date: a.date, codes: new Set(), notes: [], hours: 0 };
      day.codes.add(project.code);
      if (a.note) day.notes.push(a.note);
      day.hours += a.hours;
      g.days.set(a.date, day);
      g.hours += a.hours;
      groups.set(customer.id, g);
    });
  return [...groups.values()]
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name, 'tr'))
    .map(g => ({ customer: g.customer, hours: g.hours, rows: [...g.days.values()] }));
}

function printFormHtml(user, iso, groups, { signature }) {
  const month = monthTitle(iso), status = formApprovalText(user, iso), printed = fmtStamp(new Date().toISOString());
  return groups.map(g => {
    const multi = new Set(g.rows.flatMap(r => [...r.codes])).size > 1;   // müşteride birden çok proje varsa satırda kod yazılır
    return `<section class="print-page">
      <header class="print-head">
        <span class="print-brand">BISOLERA</span>
        <div><h1>${esc(FORM_TITLE)}</h1><p>${esc(month)}</p></div>
      </header>
      <dl class="print-meta">
        <div><dt>Danışman</dt><dd>${esc(user.name)}</dd></div>
        <div><dt>Müşteri</dt><dd>${esc(g.customer.name)}</dd></div>
        <div><dt>Dönem</dt><dd>${esc(month)}</dd></div>
        <div><dt>Durum</dt><dd>${esc(status)}</dd></div>
      </dl>
      <table class="print-table">
        <thead><tr><th>Tarih</th>${multi ? '<th>Proje</th>' : ''}<th>Açıklama</th><th class="num">Saat</th></tr></thead>
        <tbody>${g.rows.map(r => `<tr>
          <td class="nowrap">${fmtShort(r.date)} ${dayName(r.date, true)}</td>
          ${multi ? `<td class="nowrap">${esc([...r.codes].join(', '))}</td>` : ''}
          <td>${esc(r.notes.join(' · '))}</td>
          <td class="num">${fmtNum(r.hours)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="${multi ? 3 : 2}">Toplam · ${g.rows.length} gün</td><td class="num">${fmtNum(g.hours)}</td></tr></tfoot>
      </table>
      ${signature ? `<div class="print-sign">
        <div><span>Danışman</span><b>${esc(user.name)}</b><i>İmza / Tarih</i></div>
        <div><span>Müşteri onayı · ${esc(g.customer.name)}</span><b></b><i>Ad Soyad / İmza / Tarih</i></div>
      </div>` : ''}
      <footer class="print-foot">Bisolera Danışman Portalı · ${esc(printed)}</footer>
    </section>`;
  }).join('');
}

// Sayfalar gizli bir alana çizilir ve yalnızca o alan yazdırılır. Belge adı, PDF dosyasının varsayılan adı olur.
function printPages(html, fileTitle) {
  document.getElementById('print-root')?.remove();
  const root = document.createElement('div');
  root.id = 'print-root';
  root.innerHTML = html;
  document.body.appendChild(root);
  document.body.classList.add('is-printing');
  const title = document.title;
  document.title = fileSafe(fileTitle);
  window.addEventListener('afterprint', () => {
    document.title = title;
    // Bazı tarayıcılar afterprint'i çıktı hazırlanmadan gönderiyor; sayfa biraz sonra kaldırılır
    setTimeout(() => { document.body.classList.remove('is-printing'); root.remove(); }, 1000);
  }, { once: true });
  window.print();
}

function printMonthlyForm(user, iso, { customerIds = null, signature = true } = {}) {
  const groups = monthlyFormData(user.id, iso).filter(g => !customerIds || customerIds.includes(g.customer.id));
  if (!groups.length) return false;
  printPages(printFormHtml(user, iso, groups, { signature }), `${FORM_TITLE}_${user.name}_${TR_MONTHS[parseISO(iso).getMonth()]}_${parseISO(iso).getFullYear()}`);
  return true;
}

/* ---------- Teklif için danışman CV'si ---------- */

const monthYear = iso => `${TR_MONTHS_SHORT[parseISO(iso).getMonth()]} ${parseISO(iso).getFullYear()}`;

// Tek A4: kişi, özet, uzmanlıklar, geçerli sertifikalar, son 24 ayın müşteri projeleri.
// hideCustomers: başka müşteriye giden teklifte müşteri adı yerine sektör yazılır.
function cvHtml(user, { hideCustomers = false } = {}) {
  const today = todayISO(), hours = skillHours(user.id, today);
  const byLevel = [3, 2, 1].map(n => [n, SKILLS.filter(s => (user.skills?.[s.id] || 0) === n)]).filter(([, list]) => list.length);
  const certs = Store.certs({ userId: user.id }).filter(c => certValid(c, today)).sort((a, b) => (b.issued || '').localeCompare(a.issued || ''));
  const projects = cvProjects(user.id, today);
  const who = r => (hideCustomers ? (r.customer.sector ? `${r.customer.sector} sektörü` : 'Müşteri') : r.customer.name);
  return `<section class="print-page cv">
    <header class="print-head">
      <span class="print-brand">BISOLERA</span>
      <div><h1>Danışman Profili</h1><p>${esc(fmtDate(today))}</p></div>
    </header>
    <div class="cv-person"><h2>${esc(user.name)}</h2><p>${esc(user.title)}${user.startDate ? ` · ${esc(tenureText(user, today))}` : ''}</p></div>
    ${user.summary ? `<p class="cv-summary">${esc(user.summary)}</p>` : ''}
    <h3>Uzmanlıklar</h3>
    ${byLevel.length ? `<dl class="cv-skills">${byLevel.map(([n, list]) => `<div><dt>${SKILL_LEVELS[n]}</dt><dd>${list.map(s =>
      `${esc(s.name)}${hours[s.id] ? ` <small>(${fmtNum(Math.round(hours[s.id]))} sa, 12 ay)</small>` : ''}`).join(' · ')}</dd></div>`).join('')}</dl>` : '<p class="cv-empty">Yetkinlik girilmemiş.</p>'}
    ${certs.length ? `<h3>Sertifikalar</h3><ul class="cv-certs">${certs.map(c => `<li><strong>${esc(c.name)}</strong>${c.code ? ` (${esc(c.code)})` : ''}${c.issued ? ` · ${monthYear(c.issued)}` : ''}${c.expires ? ` · geçerlilik ${monthYear(c.expires)}` : ''}</li>`).join('')}</ul>` : ''}
    <h3>Proje deneyimi <small>(son 24 ay)</small></h3>
    ${projects.length ? `<table class="print-table">
      <thead><tr><th>Dönem</th><th>Müşteri</th><th>Proje</th><th>Yetkinlikler</th><th class="num">Saat</th></tr></thead>
      <tbody>${projects.map(r => `<tr>
        <td class="nowrap">${monthYear(r.from)}${monthYear(r.from) !== monthYear(r.to) ? ` – ${monthYear(r.to)}` : ''}</td>
        <td>${esc(who(r))}</td>
        <td>${esc(r.project.name)}</td>
        <td>${esc((r.project.skills || []).map(skillName).join(', '))}</td>
        <td class="num">${fmtNum(Math.round(r.hours))}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<p class="cv-empty">Son 24 ayda müşteri projesi kaydı yok.</p>'}
    <footer class="print-foot">Bisolera Danışman Portalı · ${esc(fmtStamp(new Date().toISOString()))}</footer>
  </section>`;
}

function printCv(user, options = {}) {
  printPages(cvHtml(user, options), `CV_${user.name}_${todayISO()}`);
}

function openCvDialog(user) {
  openModal({
    title: `${user.name} · yetkinlik özeti`,
    body: `<div class="form-stack">
      <p class="muted">Portaldaki bilgilerden tek sayfa: özet, uzmanlıklar, geçerli sertifikalar ve son 24 ayın müşteri projeleri. Süresi dolmuş sertifikalar ve iç projeler girmez. Asıl CV, Profil'deki Word CV'dir.</p>
      <label class="toggle"><input type="checkbox" data-hide-customers> Müşteri adlarını gizle, yerine sektör yaz</label>
      <p class="muted small-text">Başka bir müşteriye giden teklifte işaretle. Proje adlarında müşteri adı geçiyorsa onları da kontrol et.</p>
    </div>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-print>${icon('printer', 15)} Yazdır / PDF</button>`,
    onMount(m, close) {
      m.querySelector('[data-print]').addEventListener('click', () => {
        const hideCustomers = m.querySelector('[data-hide-customers]').checked;
        close();
        printCv(user, { hideCustomers });
      });
    },
  });
}

function openPrintDialog(user, iso) {
  const groups = monthlyFormData(user.id, iso);
  if (!groups.length) return toast(`${monthTitle(iso)} için kayıt yok`, { tone: 'info' });
  const approved = periodStatus(user.id, iso) === 'onaylandi';
  openModal({
    title: `${monthTitle(iso)} · yazdır / PDF`,
    body: `<div class="form-stack">
      <div class="field"><span class="field-label">Müşteriler <span class="faint">(her müşteri ayrı sayfa)</span></span>
        <div class="print-pick">${groups.map(g => `<label class="toggle"><input type="checkbox" value="${g.customer.id}" checked>
          <span class="dot" style="background:${g.customer.color}"></span>${esc(g.customer.name)} <span class="faint">${fmtNum(g.hours)} sa · ${g.rows.length} gün</span></label>`).join('')}</div>
      </div>
      <label class="toggle"><input type="checkbox" data-sign checked> İmza alanı ekle (danışman ve müşteri onayı)</label>
      ${approved ? '' : `<div class="callout warn">${icon('alert', 16)}<div>Bu ay henüz onaylanmadı; formun üstünde “${esc(formApprovalText(user, iso))}” yazacak.</div></div>`}
      <p class="muted small-text">Yazdır penceresinde hedef olarak <strong>PDF olarak kaydet</strong>'i seçersen PDF dosyası olur.</p>
    </div>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-print>${icon('printer', 15)} Yazdır / PDF</button>`,
    onMount(m, close) {
      const btn = m.querySelector('[data-print]'), boxes = [...m.querySelectorAll('.print-pick input')];
      m.addEventListener('change', () => { btn.disabled = !boxes.some(b => b.checked); });
      btn.addEventListener('click', () => {
        const options = { customerIds: boxes.filter(b => b.checked).map(b => b.value), signature: m.querySelector('[data-sign]').checked };
        close();
        printMonthlyForm(user, iso, options);
      });
    },
  });
}
