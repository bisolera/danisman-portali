/* Yönetim (yalnızca yönetici): izin onayları, ekibin haftası, kullanıcı hesapları */

const AdminView = {
  mount(el, { query }) {
    const TABS = [['onaylar', 'İzin onayları'], ['kapanis', 'Ay kapanışı'], ['ekip', 'Ekip durumu'], ['kullanicilar', 'Kullanıcılar']];
    let tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'onaylar';
    let teamMonth = todayISO();
    let closeMonth = addMonths(todayISO(), -1);   // kapanışta genelde geçen ay incelenir

    el.innerHTML = `
      <header class="page-head"><div><h1>Yönetim</h1><p>İzin onayları, ekibin haftası ve kullanıcı hesapları.</p></div></header>
      <div class="tabs admin-tabs" id="tabs"></div>
      <div id="panel"></div>`;
    const tabsEl = el.querySelector('#tabs'), panel = el.querySelector('#panel');

    function render() {
      const counts = { onaylar: Store.leaves({ status: 'beklemede' }).length, kapanis: Store.periods({ status: 'gonderildi' }).length };
      tabsEl.innerHTML = TABS.map(([k, label]) =>
        `<button class="${k === tab ? 'is-active' : ''}" data-tab="${k}">${label}${counts[k] ? ` <span class="count">${counts[k]}</span>` : ''}</button>`).join('');
      ({ onaylar: renderApprovals, kapanis: renderClosing, ekip: renderTeam, kullanicilar: renderUsers })[tab]();
      App.refreshBadges();
    }

    function approvalRow(l) {
      const u = Store.user(l.userId), days = leaveDays(l);
      const b = l.type === 'yillik' ? leaveBalance(u) : null;
      const clashes = [...new Set(Store.leaves({ status: 'onaylandi' })
        .filter(o => o.userId !== u.id && o.start <= l.end && l.start <= o.end)
        .map(o => Store.user(o.userId).name))];
      return `<div class="approval" data-id="${l.id}">
        ${avatar(u, 40)}
        <div class="approval-main">
          <div><strong>${esc(u.name)}</strong> <span class="muted">· ${esc(u.title)}</span></div>
          <div class="approval-what">${esc(leaveTypeName(l.type))} · ${fmtRange(l.start, l.end)} · <strong>${fmtNum(days)} iş günü</strong>${l.halfDay ? ' (yarım gün)' : ''}</div>
          <div class="approval-meta">
            ${b ? `<span>${icon('sun', 14)} Bakiye ${fmtNum(b.remaining)} → ${fmtNum(b.remaining - days)} gün</span>` : ''}
            ${clashes.length ? `<span class="warn-text">${icon('users', 14)} Aynı tarihlerde izinli: ${esc(clashes.join(', '))}</span>` : ''}
            ${l.note ? `<span>“${esc(l.note)}”</span>` : ''}
          </div>
        </div>
        <div class="approval-actions">
          <button class="btn ghost sm" data-decide="reddedildi">Reddet</button>
          <button class="btn primary sm" data-decide="onaylandi">${icon('check', 15)} Onayla</button>
        </div>
      </div>`;
    }

    function renderApprovals() {
      const pending = Store.leaves({ status: 'beklemede' }).slice().sort((a, b) => a.start.localeCompare(b.start));
      const decided = Store.leaves().filter(l => l.decidedAt).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)).slice(0, 5);
      panel.innerHTML = `
        <section class="card">
          <div class="card-head"><h2>Onay bekleyen talepler</h2><span class="muted">${pending.length} talep</span></div>
          ${pending.length ? pending.map(approvalRow).join('') : emptyState('check', 'Bekleyen talep yok', 'Yeni talepler geldiğinde burada görünecek.')}
        </section>
        ${decided.length ? `<section class="card section-gap"><div class="card-head"><h2>Son kararlar</h2></div>${decided.map(l => leaveRow(l, { user: Store.user(l.userId) })).join('')}</section>` : ''}`;
    }

    // Ay kapanışı: kim gönderdi, kim onay bekliyor; incele → onayla / iade et / kilidi aç
    function renderClosing() {
      const month = closeMonth.slice(0, 7);
      const rows = Store.users().filter(u => u.active).map(u => {
        const p = Store.period(u.id, month), s = monthSummary(u.id, closeMonth);
        return { u, p, status: p?.status || 'acik', s, bad: s.missing + s.partial };
      }).sort((a, b) => (a.status === 'gonderildi' ? 0 : 1) - (b.status === 'gonderildi' ? 0 : 1) || a.u.name.localeCompare(b.u.name, 'tr'));
      const count = st => rows.filter(r => r.status === st).length;
      panel.innerHTML = `<section class="card">
        <div class="card-head">
          <div><h2>Ay kapanışı · ${monthTitle(closeMonth)}</h2><p class="sub">Danışman ayı onaya gönderir; onayladığında ay kilitlenir ve aylık form hazır olur.</p></div>
          <div class="week-nav">
            <button class="icon-btn bordered" data-close-month="-1" aria-label="Önceki ay">${icon('chevron-left')}</button>
            <button class="btn ghost sm" data-close-month="0">Geçen ay</button>
            <button class="icon-btn bordered" data-close-month="1" aria-label="Sonraki ay">${icon('chevron-right')}</button>
          </div>
        </div>
        <div class="row-gap close-summary">
          ${pill(`${count('gonderildi')} onay bekliyor`, count('gonderildi') ? 'warn' : 'muted')}
          ${pill(`${count('onaylandi')} onaylandı`, 'ok')}
          ${count('iade') ? pill(`${count('iade')} iade edildi`, 'danger') : ''}
          ${pill(`${count('acik')} henüz göndermedi`, 'muted')}
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Danışman</th><th>Durum</th><th class="num">Saat</th><th class="num">Eksik gün</th><th></th></tr></thead>
          <tbody>${rows.map(r => `<tr data-user="${r.u.id}">
            <td><span class="cell-user">${avatar(r.u, 30)}<span><strong>${esc(r.u.name)}</strong><small>${esc(r.u.title)}</small></span></span></td>
            <td class="nowrap"><span class="status-cell">${pill(PERIOD_STATUS[r.status].label, PERIOD_STATUS[r.status].tone)}${r.status !== 'acik' && r.p?.submittedAt ? `<small>${fmtStamp(r.p.submittedAt)}</small>` : ''}</span></td>
            <td class="num nowrap">${fmtNum(r.s.logged)} / ${fmtNum(r.s.target)}</td>
            <td class="num">${r.bad ? pill(`${r.bad} gün`, 'warn') : pill('Tam', 'ok')}</td>
            <td class="num nowrap">
              <button class="btn ${r.status === 'gonderildi' ? 'primary' : 'ghost'} sm" data-review>${r.status === 'gonderildi' ? 'İncele' : 'Ayrıntı'}</button>
              <button class="icon-btn sm" data-dl title="Aylık formu indir" aria-label="Aylık formu indir">${icon('download', 15)}</button>
            </td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>`;
    }

    function renderTeam() {
      const today = todayISO(), monday = weekStart(today);
      const rows = Store.users().filter(u => u.active).map(u => ({
        u,
        week: weekSummary(u.id, monday),
        missing: missingDays(u.id, monthStart(today), addDays(today, -1)).length,
        leaveToday: approvedLeaveOn(u.id, today),
        balance: leaveBalance(u),
        todayHours: hoursOn(u.id, today),
      }));
      panel.innerHTML = `<section class="card">
        <div class="card-head"><h2>Bu hafta · ${fmtRange(monday, addDays(monday, 6))}</h2><span class="muted">Eksik gün: ay başından düne kadar</span></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Danışman</th><th>Bu hafta</th><th class="num">Bugün</th><th class="num">Eksik gün</th><th class="num">Kalan izin</th></tr></thead>
          <tbody>${rows.map(r => `<tr>
            <td><span class="cell-user">${avatar(r.u, 30)}<span><strong>${esc(r.u.name)}</strong><small>${esc(r.u.title)}</small></span></span></td>
            <td class="w-meter"><div class="meter-line"><div class="meter"><span style="width:${r.week.target ? Math.min(100, (r.week.logged / r.week.target) * 100) : 0}%"></span></div><span>${fmtNum(r.week.logged)} / ${fmtNum(r.week.target)} sa</span></div></td>
            <td class="num">${r.leaveToday && !r.leaveToday.halfDay ? pill('İzinli', 'muted') : fmtHours(r.todayHours)}</td>
            <td class="num">${r.missing ? pill(`${r.missing} gün`, 'warn') : pill('Tam', 'ok')}</td>
            <td class="num">${fmtNum(r.balance.remaining)} gün</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>
      ${teamMonthHtml(rows.map(r => r.u))}`;
    }

    // Ekibin aylık doluluk haritası: satır = danışman, sütun = gün
    function teamMonthHtml(users) {
      const today = todayISO();
      const days = dateRange(monthStart(teamMonth), monthEnd(teamMonth));
      const legend = [['full', 'Tamam'], ['partial', 'Eksik saat'], ['missing', 'Girilmedi'], ['open', 'Henüz gelmedi'], ['off', 'Hafta sonu / tatil / izin']];
      return `<section class="card section-gap">
        <div class="card-head">
          <div><h2>Aylık doluluk · ${monthTitle(teamMonth)}</h2><p class="sub">Kim hangi günü girmemiş, tek bakışta. Kutunun üstüne gelince ayrıntı görünür.</p></div>
          <div class="week-nav">
            <button class="icon-btn bordered" data-team-month="-1" aria-label="Önceki ay">${icon('chevron-left')}</button>
            <button class="btn ghost sm" data-team-month="0">Bu ay</button>
            <button class="icon-btn bordered" data-team-month="1" aria-label="Sonraki ay">${icon('chevron-right')}</button>
          </div>
        </div>
        <div class="table-wrap"><table class="table heat">
          <thead><tr><th class="sticky-col">Danışman</th>${days.map(d => `<th class="heat-day${isWeekend(d) ? ' we' : ''}${d === today ? ' is-today' : ''}">${parseISO(d).getDate()}</th>`).join('')}<th class="num">Eksik</th><th class="num">Saat</th></tr></thead>
          <tbody>${users.map(u => {
            const s = monthSummary(u.id, teamMonth), bad = s.missing + s.partial;
            return `<tr>
              <td class="sticky-col"><span class="cell-user">${avatar(u, 26)}<strong>${esc(u.name)}</strong></span></td>
              ${s.days.map(d => `<td class="hc"><span class="heat-cell st-${d.status}" title="${esc(`${fmtDate(d.date, { weekday: true })} · ${dayStatusLabel(u.id, d)}`)}"></span></td>`).join('')}
              <td class="num">${bad ? pill(`${bad} gün`, 'warn') : pill('Tam', 'ok')}</td>
              <td class="num nowrap">${fmtNum(s.logged)} / ${fmtNum(s.target)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <div class="heat-legend">${legend.map(([st, label]) => `<span><i class="heat-cell st-${st}"></i>${label}</span>`).join('')}</div>
      </section>`;
    }

    function renderUsers() {
      const users = Store.users().slice().sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'tr'));
      panel.innerHTML = `<section class="card">
        <div class="card-head"><h2>Kullanıcılar</h2><button class="btn primary sm" data-add-user>${icon('plus', 15)} Kullanıcı ekle</button></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Ad Soyad</th><th>Unvan</th><th>Rol</th><th class="num">Yıllık izin</th><th>Durum</th><th></th></tr></thead>
          <tbody>${users.map(u => `<tr class="${u.active ? '' : 'is-inactive'}">
            <td><span class="cell-user">${avatar(u, 30)}<span><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></span></span></td>
            <td>${esc(u.title)}</td>
            <td>${u.role === 'admin' ? pill('Yönetici', 'info') : 'Danışman'}</td>
            <td class="num">${u.annualLeave} gün</td>
            <td>${u.active ? pill('Aktif', 'ok') : pill('Pasif', 'muted')}</td>
            <td class="num"><button class="icon-btn sm" data-edit-user="${u.id}" title="Düzenle" aria-label="Düzenle">${icon('pencil', 15)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>`;
    }

    tabsEl.addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      history.replaceState(null, '', `#/yonetim?tab=${tab}`);
      render();
    });

    panel.addEventListener('click', e => {
      const closeNav = e.target.closest('[data-close-month]');
      if (closeNav) {
        closeMonth = closeNav.dataset.closeMonth === '0' ? addMonths(todayISO(), -1) : addMonths(closeMonth, Number(closeNav.dataset.closeMonth));
        return renderClosing();
      }
      const userRow = e.target.closest('[data-user]');
      if (userRow && e.target.closest('[data-review]')) return openReviewDialog(Store.user(userRow.dataset.user), closeMonth, render);
      if (userRow && e.target.closest('[data-dl]')) return exportMonthlyForm(Store.user(userRow.dataset.user), closeMonth).catch(err => toast(err.message, { tone: 'danger' }));
      const month = e.target.closest('[data-team-month]');
      if (month) {
        teamMonth = month.dataset.teamMonth === '0' ? todayISO() : addMonths(teamMonth, Number(month.dataset.teamMonth));
        return renderTeam();
      }
      const decide = e.target.closest('[data-decide]');
      if (decide) {
        const id = decide.closest('[data-id]').dataset.id, status = decide.dataset.decide;
        Store.updateLeave(id, { status, decidedBy: App.user.id, decidedAt: new Date().toISOString() });
        render();
        toast(status === 'onaylandi' ? 'Talep onaylandı' : 'Talep reddedildi', {
          tone: status === 'onaylandi' ? 'ok' : 'info',
          action: { label: 'Geri al', fn: () => { Store.updateLeave(id, { status: 'beklemede', decidedBy: null, decidedAt: null }); render(); } },
        });
        return;
      }
      if (e.target.closest('[data-add-user]')) return userModal(null, render);
      const edit = e.target.closest('[data-edit-user]');
      if (edit) userModal(Store.user(edit.dataset.editUser), render);
    });

    render();
  },
};

function userModal(u, onSave) {
  const self = u && u.id === App.user.id;
  const local = u ? u.email.split('@')[0] : '';
  openModal({
    title: u ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı',
    body: `<form class="form-stack" id="userForm" novalidate>
      <div class="form-grid">
        <label class="field full"><span class="field-label">Ad Soyad</span><input class="input" name="name" value="${esc(u?.name || '')}" maxlength="60"></label>
        <label class="field full"><span class="field-label">Şirket e-postası</span>
          <div class="input-suffix"><input class="input" name="email" value="${esc(local)}" placeholder="ad.soyad" autocomplete="off"><span>@${COMPANY_DOMAIN}</span></div></label>
        <label class="field full"><span class="field-label">Unvan</span><input class="input" name="title" value="${esc(u?.title || '')}" maxlength="60" placeholder="Örn. SAP BW Danışmanı"></label>
        <label class="field"><span class="field-label">Rol</span>
          <select class="input" name="role"${self ? ' disabled' : ''}><option value="consultant">Danışman</option><option value="admin"${u?.role === 'admin' ? ' selected' : ''}>Yönetici</option></select></label>
        <label class="field"><span class="field-label">Yıllık izin hakkı (gün)</span><input class="input" name="annualLeave" type="number" min="0" max="40" value="${u?.annualLeave ?? 14}"></label>
        <label class="field"><span class="field-label">İşe giriş tarihi</span><input class="input" name="startDate" type="date" value="${u?.startDate || todayISO()}"></label>
      </div>
      ${u ? `<label class="toggle"><input type="checkbox" name="active"${u.active ? ' checked' : ''}${self ? ' disabled' : ''}> Hesap aktif${self ? ' <span class="faint">(kendi hesabın)</span>' : ''}</label>` : ''}
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="userForm">Kaydet</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      el.name.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = el.name.value.trim();
        const email = `${el.email.value.trim().toLowerCase().replace(/@.*$/, '')}@${COMPANY_DOMAIN}`;
        const annualLeave = Number(el.annualLeave.value);
        if (!name) return formError(f, 'Ad soyad zorunlu.', el.name);
        if (!/^[a-z0-9._-]+@/.test(email)) return formError(f, 'E-posta adresinin @ öncesini yaz (ör. ad.soyad).', el.email);
        const owner = Store.userByEmail(email);
        if (owner && owner.id !== u?.id) return formError(f, 'Bu e-posta başka bir kullanıcıda kayıtlı.', el.email);
        if (!(annualLeave >= 0 && annualLeave <= 40)) return formError(f, 'İzin hakkı 0–40 gün arasında olmalı.', el.annualLeave);
        const data = { name, email, title: el.title.value.trim() || 'Danışman', annualLeave, startDate: el.startDate.value };
        if (!self) data.role = el.role.value;
        if (u && !self) data.active = el.active.checked;
        if (u) Store.updateUser(u.id, data); else Store.addUser(data);
        close();
        onSave();
        toast(u ? 'Kullanıcı güncellendi' : `${name} eklendi · artık ${email} ile giriş yapabilir`);
      });
    },
  });
}
