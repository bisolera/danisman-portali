/* Masraflar: danışman masrafını girer ve fişini ekler; yönetici onaylar ya da gerekçeyle reddeder, ödenince işaretler.
   Danışman kendi masraflarını, yönetici herkesinkini görür. */

const ExpensesView = {
  mount(el, { query }) {
    const me = App.user, admin = App.isAdmin(), today = todayISO();
    const MODES = [['ben', 'Masraflarım'], ...(admin ? [['onay', 'Onay bekleyen'], ['odeme', 'Ödenecekler'], ['rapor', 'Rapor']] : [])];
    let mode = MODES.some(([k]) => k === query.v) ? query.v : 'ben';
    let month = /^\d{4}-\d{2}$/.test(query.ay || '') ? `${query.ay}-01` : monthStart(today);
    let editing = null;          // düzenlenen masrafın kimliği
    let receipt;                 // formda seçilen fiş: undefined = değişmedi, null = kaldırıldı, nesne = yeni dosya
    let dupConfirmed = false;    // aynı masraf uyarısı bir kez gösterildi mi
    const selected = new Set();  // onay ekranında seçilenler

    el.innerHTML = `
      <header class="page-head"><div><h1>Masraflar</h1><p>Masrafını gir, fişini ekle; onay ve ödeme durumunu buradan izle.</p></div></header>
      ${admin ? '<div class="tabs admin-tabs" id="modes"></div>' : ''}
      <div id="body"></div>`;
    const body = el.querySelector('#body');
    const setHash = () => history.replaceState(null, '', `#/masraflar?v=${mode}${mode === 'ben' || mode === 'rapor' ? `&ay=${month.slice(0, 7)}` : ''}`);

    function render() {
      if (admin) {
        const pend = pendingExpenses(), toPay = Store.expenses({ status: 'onaylandi' }).length;
        el.querySelector('#modes').innerHTML = MODES.map(([k, label]) => `<button class="${k === mode ? 'is-active' : ''}" data-mode="${k}">${label}${
          k === 'onay' && pend ? ` <span class="count">${pend}</span>` : k === 'odeme' && toPay ? ` <span class="count">${toPay}</span>` : ''}</button>`).join('');
      }
      ({ ben: renderMine, onay: renderApprovals, odeme: renderPayments, rapor: renderReport })[mode]();
      App.refreshBadges();
    }

    const monthNav = () => `
      <button class="icon-btn bordered" data-month="-1" aria-label="Önceki ay">${icon('chevron-left')}</button>
      <button class="btn ghost sm" data-month="0">Bu ay</button>
      <button class="icon-btn bordered" data-month="1" aria-label="Sonraki ay"${monthStart(month) >= monthStart(today) ? ' disabled' : ''}>${icon('chevron-right')}</button>`;

    // Masraf satırı. review: yöneticinin onay butonları · select: toplu onay kutusu · actions: danışmanın düzenle/sil
    function expenseRow(x, { user = null, actions = false, review = false, select = false } = {}) {
      const p = x.projectId && Store.project(x.projectId), c = p && Store.customer(p.customerId);
      const st = EXPENSE_STATUS[x.status], d = parseISO(x.date);
      return `<div class="exp-row${select ? ' has-check' : ''}${x.id === editing ? ' is-editing' : ''}" data-exp="${x.id}">
        ${select ? `<input type="checkbox" class="exp-check" data-select${selected.has(x.id) ? ' checked' : ''} aria-label="Seç">` : ''}
        <span class="date-badge"><b>${d.getDate()}</b><span>${TR_MONTHS_SHORT[d.getMonth()]}</span></span>
        <div class="exp-main">
          <strong>${user ? `${esc(user.name)} · ` : ''}${esc(expenseCategoryName(x.category))}</strong>
          <small>${esc(x.description)}</small>
          <div class="exp-tags">
            ${p ? `<span><span class="dot" style="background:${c.color}"></span>${esc(c.name)} · ${esc(p.name)}</span>` : ''}
            ${x.rebill ? '<span class="tag tag-info">Müşteriye yansıtılacak</span>' : ''}
            ${x.receipt ? `<button class="link-btn" data-receipt>${icon('sheet', 13)} Fiş</button>` : '<span class="tag tag-warn">Fişsiz</span>'}
          </div>
          ${x.status === 'reddedildi' && x.rejectReason ? `<div class="exp-reason">${icon('alert', 13)} ${esc(x.rejectReason)}</div>` : ''}
        </div>
        <div class="exp-side">
          <b class="money">${fmtMoney(x.amount)}</b>
          ${review ? `<span class="row-gap"><button class="btn ghost sm" data-reject>Reddet</button><button class="btn primary sm" data-approve>${icon('check', 15)} Onayla</button></span>`
            : pill(st.label, st.tone)}
          ${actions && canEditExpense(x) ? `<span class="row-gap"><button class="icon-btn sm" data-edit title="${x.status === 'reddedildi' ? 'Düzelt ve yeniden gönder' : 'Düzenle'}" aria-label="Düzenle">${icon('pencil', 15)}</button>
            <button class="icon-btn sm" data-delete title="Sil" aria-label="Sil">${icon('trash', 15)}</button></span>` : ''}
        </div>
      </div>`;
    }

    /* ---------- Masraflarım: özet, liste, form ---------- */

    function renderMine() {
      const s = expenseSummary(me.id, today);
      const list = Store.expenses({ userId: me.id, from: monthStart(month), to: monthEnd(month) })
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      const monthTotal = sum(list.filter(x => x.status !== 'reddedildi'), x => x.amount);
      body.innerHTML = `
        <section class="grid balance">${[
          ['Bu ay', s.month, `${monthTitle(today)} toplamı`],
          ['Onay bekleyen', s.pending, s.pending ? 'Yöneticinde' : 'Bekleyen yok'],
          ['Ödenecek', s.toPay, s.toPay ? 'Onaylandı, ödeme bekliyor' : 'Ödeme bekleyen yok', true],
          ['Bu yıl ödenen', s.paidYear, `${today.slice(0, 4)} yılı`],
        ].map(([label, val, sub, main]) => `<div class="card bal${main ? ' is-main' : ''}"><span class="bal-label">${label}</span><span class="bal-val money-val">${fmtMoney(val)}</span><span class="bal-sub">${esc(sub)}</span></div>`).join('')}</section>
        <div class="grid two-col section-gap">
          <section class="card">
            <div class="card-head">
              <div><h2>Masraflarım · ${monthTitle(month)}</h2><p class="sub">${list.length} kayıt · ${fmtMoney(monthTotal)}</p></div>
              <div class="week-nav">
                <button class="icon-btn bordered" data-print-month title="Aylık masraf formu (yazdır / PDF)" aria-label="Aylık masraf formu"${list.some(x => x.status !== 'reddedildi') ? '' : ' disabled'}>${icon('printer')}</button>
                ${monthNav()}
              </div>
            </div>
            ${list.length ? list.map(x => expenseRow(x, { actions: true })).join('') : emptyState('inbox', 'Bu ay masraf yok', 'Formdan ilk masrafını ekle.')}
          </section>
          <section class="card sticky" id="expForm"></section>
        </div>`;
      renderForm();
    }

    function renderForm() {
      const box = body.querySelector('#expForm');
      if (!box) return;
      const x = editing ? Store.expense(editing) : null;
      const projects = Store.projects({ activeOnly: true });
      if (x?.projectId && !projects.some(p => p.id === x.projectId)) projects.push(Store.project(x.projectId));
      const options = groupByCustomer(projects).map(g => `<optgroup label="${esc(g.title)}">${g.items.map(p =>
        `<option value="${p.id}"${x?.projectId === p.id ? ' selected' : ''}>${esc(p.name)} (${esc(p.code)})</option>`).join('')}</optgroup>`).join('');
      box.innerHTML = `
        <div class="card-head"><h2>${!x ? 'Yeni masraf' : x.status === 'reddedildi' ? 'Düzelt ve yeniden gönder' : 'Masrafı düzenle'}</h2>${x ? '<button class="btn ghost sm" data-cancel-edit>Vazgeç</button>' : ''}</div>
        <form class="form-stack" novalidate>
          <div class="form-grid">
            <label class="field"><span class="field-label">Tarih</span><input class="input" type="date" name="date" max="${today}" value="${x?.date || today}"></label>
            <label class="field"><span class="field-label">Tutar <span class="faint">(TL, KDV dahil)</span></span><input class="input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${x ? MONEY.format(x.amount) : ''}"></label>
          </div>
          <div class="field"><span class="field-label">Kategori</span>
            <div class="seg">${EXPENSE_CATEGORIES.map((c, i) => `<input type="radio" name="category" id="ec-${c.id}" value="${c.id}"${(x ? x.category === c.id : i === 0) ? ' checked' : ''}><label for="ec-${c.id}"${c.hint ? ` title="${esc(c.hint)}"` : ''}>${esc(c.name)}</label>`).join('')}</div></div>
          <label class="field"><span class="field-label">Açıklama</span><input class="input" name="description" maxlength="200" value="${esc(x?.description || '')}" placeholder="Örn. İstanbul – Ankara tren bileti, müşteri toplantısı"></label>
          <label class="field"><span class="field-label">Proje <span class="faint">(isteğe bağlı)</span></span><select class="input" name="projectId"><option value="">—</option>${options}</select></label>
          <label class="toggle"><input type="checkbox" name="rebill"${x?.rebill ? ' checked' : ''}> Müşteriye yansıtılacak (faturaya eklenecek)</label>
          <div class="field"><span class="field-label">Fiş / fatura <span class="faint">(fotoğraf ya da PDF)</span></span><div class="receipt-pick" data-receipt-pick></div></div>
          <div class="calc" data-exp-msg hidden></div>
          <button class="btn primary block lg" type="submit">${x && x.status !== 'reddedildi' ? 'Kaydet' : 'Onaya gönder'}</button>
        </form>`;
      const f = box.querySelector('form');
      f.addEventListener('submit', e => { e.preventDefault(); submitForm(f); });
      // Formda bir şey değişince "aynı masraf" uyarısı sıfırlanır
      f.addEventListener('input', () => { dupConfirmed = false; f.querySelector('[data-exp-msg]').hidden = true; });
      renderReceiptPick();
    }

    function renderReceiptPick() {
      const pick = body.querySelector('[data-receipt-pick]');
      if (!pick) return;
      const x = editing ? Store.expense(editing) : null;
      const current = receipt === undefined ? x?.receipt : receipt;
      const input = label => `<label class="btn ghost sm">${icon('upload', 15)} ${label}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" data-receipt-file hidden></label>`;
      pick.innerHTML = current
        ? `<span class="receipt-chip">${icon('sheet', 14)} ${esc(current.name)} <small class="faint">${fmtSize(current.size)}</small></span>${input('Değiştir')}<button class="btn ghost sm" type="button" data-receipt-remove>Kaldır</button>`
        : `${input('Fiş ekle')}<small class="muted">Fişsiz masraf “fişsiz” etiketiyle görünür.</small>`;
    }

    async function submitForm(f) {
      const x = editing ? Store.expense(editing) : null, msg = f.querySelector('[data-exp-msg]');
      const show = (text, tone) => { msg.hidden = false; msg.className = `calc ${tone}`; msg.innerHTML = `${icon('alert', 16)}<span>${esc(text)}</span>`; };
      const draft = {
        userId: x?.userId || me.id, date: f.elements.date.value, category: f.elements.category.value, amount: parseAmount(f.elements.amount.value),
        description: f.elements.description.value.trim(), projectId: f.elements.projectId.value || null, rebill: f.elements.rebill.checked,
      };
      const errors = expenseErrors(draft, today);
      if (errors.length) return show(errors[0], 'err');
      const dup = duplicateExpense(draft, x?.id);
      if (dup && !dupConfirmed) {
        dupConfirmed = true;
        return show(`${fmtShort(dup.date)} tarihinde aynı tutarda bir ${expenseCategoryName(dup.category).toLocaleLowerCase('tr')} masrafın zaten var. İki kez girmediysen tekrar gönder.`, 'warn');
      }
      const resend = x?.status === 'reddedildi';
      const saved = x ? (Store.updateExpense(x.id, { ...draft, ...(resend ? { status: 'beklemede', rejectReason: null, decidedBy: null, decidedAt: null } : {}) }), x)
        : Store.addExpense(draft);
      try {
        if (receipt) await attachReceipt(saved.id, receipt);
        else if (receipt === null && saved.receipt) await detachReceipt(saved.id);
      } catch (e) { toast(`Masraf kaydedildi ama fiş kaydedilemedi: ${e.message}`, { tone: 'danger', duration: 8000 }); }
      editing = null;
      receipt = undefined;
      dupConfirmed = false;
      month = monthStart(draft.date);
      setHash();
      render();
      const approver = Store.users().find(u => u.role === 'admin' && u.active && u.id !== me.id);
      toast(x && !resend ? 'Masraf güncellendi' : `${fmtMoney(draft.amount)} ${resend ? 'yeniden gönderildi' : 'onaya gönderildi'}${approver ? ` · Onaylayacak: ${approver.name}` : ''}`);
    }

    async function removeExpense(id) {
      const removed = Store.deleteExpense(id);
      if (!removed) return;
      const file = removed.receipt ? await Files.get(receiptKey(id)).catch(() => null) : null;
      if (file) await Files.remove(receiptKey(id)).catch(() => {});
      if (editing === id) { editing = null; receipt = undefined; }
      render();
      toast(`${expenseCategoryName(removed.category)} · ${fmtMoney(removed.amount)} silindi`, {
        tone: 'info',
        action: { label: 'Geri al', fn: async () => { Store.restoreExpense(removed); if (file) await Files.put(receiptKey(id), file); render(); } },
      });
    }

    /* ---------- Yönetici: onay, ödeme, rapor ---------- */

    function renderApprovals() {
      const list = Store.expenses({ status: 'beklemede' }).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      [...selected].forEach(id => { if (!list.some(x => x.id === id)) selected.delete(id); });
      const chosen = list.filter(x => selected.has(x.id));
      body.innerHTML = `<section class="card">
        <div class="card-head">
          <div><h2>Onay bekleyen masraflar</h2><p class="sub">${list.length} masraf · ${fmtMoney(sum(list, x => x.amount))}</p></div>
          ${list.length ? `<div class="row-gap"><label class="toggle small"><input type="checkbox" data-select-all${chosen.length === list.length ? ' checked' : ''}> Tümünü seç</label>
            <button class="btn primary sm" data-approve-selected${chosen.length ? '' : ' disabled'}>${icon('check', 15)} Seçilenleri onayla${chosen.length ? ` (${chosen.length} · ${fmtMoney(sum(chosen, x => x.amount))})` : ''}</button></div>` : ''}
        </div>
        ${list.length ? list.map(x => expenseRow(x, { user: Store.user(x.userId), review: true, select: true })).join('') : emptyState('check', 'Onay bekleyen masraf yok', 'Yeni masraflar geldiğinde burada görünür.')}
      </section>`;
    }

    function decide(ids, changes, text) {
      const before = ids.map(id => ({ id, ...pickFields(Store.expense(id), ['status', 'decidedBy', 'decidedAt', 'rejectReason']) }));
      ids.forEach(id => { Store.updateExpense(id, changes); selected.delete(id); });
      render();
      toast(text, { tone: changes.status === 'reddedildi' ? 'info' : 'ok', action: { label: 'Geri al', fn: () => { before.forEach(({ id, ...b }) => Store.updateExpense(id, b)); render(); } } });
    }
    const approve = ids => decide(ids, { status: 'onaylandi', decidedBy: me.id, decidedAt: new Date().toISOString(), rejectReason: null },
      `${ids.length} masraf onaylandı · ${fmtMoney(sum(ids, id => Store.expense(id).amount))}`);

    function openRejectDialog(id) {
      const x = Store.expense(id), u = Store.user(x.userId);
      openModal({
        title: 'Masrafı reddet',
        body: `<div class="form-stack">
          <p><strong>${esc(u.name)}</strong> · ${esc(expenseCategoryName(x.category))} · ${fmtDate(x.date)} · <strong>${fmtMoney(x.amount)}</strong><br><span class="muted">${esc(x.description)}</span></p>
          <label class="field"><span class="field-label">Gerekçe <span class="faint">(zorunlu; danışman görür)</span></span>
            <textarea class="input" rows="2" maxlength="300" data-reason placeholder="Örn. Fiş eksik; fişi ekleyip yeniden gönder."></textarea></label>
          <p class="form-error" data-reason-error hidden></p>
        </div>`,
        footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn danger-ghost" data-do-reject>Reddet</button>`,
        onMount(m, close) {
          const reason = m.querySelector('[data-reason]');
          reason.focus();
          m.querySelector('[data-do-reject]').addEventListener('click', () => {
            if (!reason.value.trim()) {
              const err = m.querySelector('[data-reason-error]');
              err.textContent = 'Gerekçeyi yaz; danışman neyi düzelteceğini görsün.';
              err.hidden = false;
              return reason.focus();
            }
            close();
            decide([id], { status: 'reddedildi', decidedBy: me.id, decidedAt: new Date().toISOString(), rejectReason: reason.value.trim() }, `${u.name} · masraf reddedildi`);
          });
        },
      });
    }

    function renderPayments() {
      const list = Store.expenses({ status: 'onaylandi' }).sort((a, b) => a.date.localeCompare(b.date));
      const groups = [...list.reduce((m, x) => m.set(x.userId, [...(m.get(x.userId) || []), x]), new Map())]
        .map(([userId, items]) => ({ user: Store.user(userId), items, total: sum(items, x => x.amount) })).sort((a, b) => b.total - a.total);
      body.innerHTML = `<section class="card">
        <div class="card-head"><div><h2>Ödenecekler</h2><p class="sub">Onaylanmış, henüz ödenmemiş masraflar. Muhasebe ödeyince kişi bazında “Ödendi” işaretle.</p></div><span class="muted">${fmtMoney(sum(list, x => x.amount))}</span></div>
        ${groups.length ? groups.map(g => `<div class="pay-group" data-pay-user="${g.user.id}">
          <div class="pay-head">${avatar(g.user, 32)}<div class="grow min0"><strong>${esc(g.user.name)}</strong><small class="muted block-sm">${g.items.length} masraf${g.items.some(x => !x.receipt) ? ` · ${g.items.filter(x => !x.receipt).length} fişsiz` : ''}</small></div>
            <b class="money">${fmtMoney(g.total)}</b><button class="btn primary sm" data-pay>${icon('check', 15)} Ödendi</button></div>
          ${g.items.map(x => expenseRow(x)).join('')}
        </div>`).join('') : emptyState('check', 'Ödenecek masraf yok')}
      </section>`;
    }

    function pay(userId) {
      const ids = Store.expenses({ userId, status: 'onaylandi' }).map(x => x.id), u = Store.user(userId);
      const total = sum(ids, id => Store.expense(id).amount), at = new Date().toISOString();
      ids.forEach(id => Store.updateExpense(id, { status: 'odendi', paidAt: at, paidBy: me.id }));
      render();
      toast(`${u.name} · ${fmtMoney(total)} ödendi olarak işaretlendi`, {
        action: { label: 'Geri al', fn: () => { ids.forEach(id => Store.updateExpense(id, { status: 'onaylandi', paidAt: null, paidBy: null })); render(); } },
      });
    }

    function renderReport() {
      const r = expenseMonthReport(month);
      const cats = EXPENSE_CATEGORIES.filter(c => r.people.some(p => p.byCategory[c.id]));
      const total = key => sum(r.people, p => p[key]);
      body.innerHTML = `<section class="card">
        <div class="card-head">
          <div><h2>Masraf raporu · ${monthTitle(month)}</h2><p class="sub">Reddedilenler hariç. Müşteriye yansıtılacaklar faturaya eklenmek üzere ayrıca listelenir.</p></div>
          <div class="week-nav">${exportButton('data-exp-export', r.items.length)}${monthNav()}</div>
        </div>
        <div class="close-stats report-stats money-stats">
          <div><b>${fmtMoney(r.total)}</b><span>toplam</span></div>
          <div><b>${fmtMoney(total('pending'))}</b><span>onay bekleyen</span></div>
          <div><b>${fmtMoney(total('toPay'))}</b><span>ödenecek</span></div>
          <div class="is-good"><b>${fmtMoney(sum(r.rebill, c => c.total))}</b><span>müşteriye yansıtılacak</span></div>
        </div>
        ${r.people.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Danışman</th>${cats.map(c => `<th class="num">${esc(c.name)}</th>`).join('')}<th class="num">Toplam</th><th class="num">Fişsiz</th><th></th></tr></thead>
          <tbody>${r.people.map(p => `<tr data-report-user="${p.user.id}">
            <td><span class="cell-user">${avatar(p.user, 28)}<strong>${esc(p.user.name)}</strong></span></td>
            ${cats.map(c => `<td class="num nowrap">${p.byCategory[c.id] ? fmtMoney(p.byCategory[c.id]) : '<span class="faint">—</span>'}</td>`).join('')}
            <td class="num nowrap"><strong>${fmtMoney(p.total)}</strong></td>
            <td class="num">${p.noReceipt ? pill(String(p.noReceipt), 'warn') : '<span class="faint">0</span>'}</td>
            <td class="num"><button class="icon-btn sm" data-print-user title="Masraf formu (yazdır / PDF)" aria-label="Masraf formu">${icon('printer', 15)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div>` : emptyState('inbox', 'Bu ay masraf yok')}
      </section>
      <section class="card section-gap">
        <div class="card-head"><div><h2>Müşteriye yansıtılacaklar</h2><p class="sub">Fatura hazırlarken kullan.</p></div></div>
        ${r.rebill.length ? r.rebill.map(c => `<div class="pay-group">
          <div class="pay-head"><span class="dot" style="background:${c.customer.color}"></span><strong class="grow">${esc(c.customer.name)}</strong><b class="money">${fmtMoney(c.total)}</b></div>
          ${c.items.map(x => expenseRow(x, { user: Store.user(x.userId) })).join('')}
        </div>`).join('') : emptyState('check', 'Bu ay müşteriye yansıtılacak masraf yok')}
      </section>`;
    }

    /* ---------- Olaylar ---------- */

    el.addEventListener('click', e => {
      const t = e.target.closest('[data-mode], [data-month], [data-print-month], [data-print-user], [data-exp-export], [data-receipt], [data-edit], [data-delete], [data-approve], [data-reject], [data-approve-selected], [data-cancel-edit], [data-receipt-remove], [data-pay]');
      if (!t) return;
      const row = t.closest('[data-exp]'), x = row && Store.expense(row.dataset.exp);
      if (t.dataset.mode) { mode = t.dataset.mode; selected.clear(); setHash(); return render(); }
      if (t.dataset.month) { month = t.dataset.month === '0' ? monthStart(today) : addMonths(month, Number(t.dataset.month)); setHash(); return render(); }
      if (t.hasAttribute('data-print-month')) return printExpenseForm(me, month);
      if (t.hasAttribute('data-print-user')) return printExpenseForm(Store.user(t.closest('[data-report-user]').dataset.reportUser), month);
      if (t.hasAttribute('data-exp-export')) return openExportChoice(t, () => expensesData(month));
      if (t.hasAttribute('data-receipt') && x) return openReceiptPreview(x);
      if (t.hasAttribute('data-edit') && x && canEditExpense(x)) {
        editing = x.id; receipt = undefined; dupConfirmed = false;
        renderMine();
        return body.querySelector('#expForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (t.hasAttribute('data-delete') && x && canEditExpense(x)) return removeExpense(x.id);
      if (t.hasAttribute('data-approve') && x) return approve([x.id]);
      if (t.hasAttribute('data-reject') && x) return openRejectDialog(x.id);
      if (t.hasAttribute('data-approve-selected')) return approve([...selected]);
      if (t.hasAttribute('data-cancel-edit')) { editing = null; receipt = undefined; dupConfirmed = false; return renderMine(); }
      if (t.hasAttribute('data-receipt-remove')) { receipt = null; return renderReceiptPick(); }
      if (t.hasAttribute('data-pay')) return pay(t.closest('[data-pay-user]').dataset.payUser);
    });

    el.addEventListener('change', e => {
      if (e.target.matches('[data-receipt-file]')) {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        readReceipt(file).then(r => { receipt = r; renderReceiptPick(); }).catch(err => toast(err.message, { tone: 'danger', duration: 7000 }));
        return;
      }
      if (e.target.matches('[data-select]')) {
        const id = e.target.closest('[data-exp]').dataset.exp;
        if (e.target.checked) selected.add(id); else selected.delete(id);
        return renderApprovals();
      }
      if (e.target.matches('[data-select-all]')) {
        Store.expenses({ status: 'beklemede' }).forEach(x => (e.target.checked ? selected.add(x.id) : selected.delete(x.id)));
        return renderApprovals();
      }
    });

    render();
  },
};

// Geri al için kaydın yalnızca değişen alanlarını saklar
const pickFields = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k] ?? null]));
