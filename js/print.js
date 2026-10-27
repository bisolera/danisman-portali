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

// Form gizli bir alana çizilir ve yalnızca o alan yazdırılır. Belge adı, PDF dosyasının varsayılan adı olur.
function printMonthlyForm(user, iso, { customerIds = null, signature = true } = {}) {
  const groups = monthlyFormData(user.id, iso).filter(g => !customerIds || customerIds.includes(g.customer.id));
  if (!groups.length) return false;
  document.getElementById('print-root')?.remove();
  const root = document.createElement('div');
  root.id = 'print-root';
  root.innerHTML = printFormHtml(user, iso, groups, { signature });
  document.body.appendChild(root);
  document.body.classList.add('is-printing');
  const title = document.title;
  document.title = fileSafe(`${FORM_TITLE}_${user.name}_${TR_MONTHS[parseISO(iso).getMonth()]}_${parseISO(iso).getFullYear()}`);
  window.addEventListener('afterprint', () => {
    document.title = title;
    // Bazı tarayıcılar afterprint'i çıktı hazırlanmadan gönderiyor; form biraz sonra kaldırılır
    setTimeout(() => { document.body.classList.remove('is-printing'); root.remove(); }, 1000);
  }, { once: true });
  window.print();
  return true;
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
