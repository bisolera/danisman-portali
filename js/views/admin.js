/* Yönetim (yalnızca yönetici): izin onayları, ay kapanışı, raporlar, ekibin haftası, tatiller, kullanıcı hesapları */

const AdminView = {
  mount(el, { query }) {
    const TABS = [['onaylar', 'İzin onayları'], ['kapanis', 'Ay kapanışı'], ['raporlar', 'Raporlar'], ['ekip', 'Ekip durumu'], ['tatiller', 'Tatiller'], ['kullanicilar', 'Kullanıcılar']];
    let tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'onaylar';
    let teamMonth = todayISO();
    let closeMonth = addMonths(todayISO(), -1);   // kapanışta genelde geçen ay incelenir
    let reportMonth = todayISO();
    const thisYear = parseISO(todayISO()).getFullYear();
    let holidayYear = thisYear;

    el.innerHTML = `
      <header class="page-head"><div><h1>Yönetim</h1><p>İzin onayları, ekibin haftası ve kullanıcı hesapları.</p></div></header>
      <div class="tabs admin-tabs" id="tabs"></div>
      <div id="panel"></div>`;
    const tabsEl = el.querySelector('#tabs'), panel = el.querySelector('#panel');

    function render() {
      const counts = { onaylar: Store.leaves({ status: 'beklemede' }).length + cancelRequests().length, kapanis: Store.periods({ status: 'gonderildi' }).length };
      tabsEl.innerHTML = TABS.map(([k, label]) =>
        `<button class="${k === tab ? 'is-active' : ''}" data-tab="${k}">${label}${counts[k] ? ` <span class="count">${counts[k]}</span>` : ''}</button>`).join('');
      ({ onaylar: renderApprovals, kapanis: renderClosing, raporlar: renderReports, ekip: renderTeam, tatiller: renderHolidays, kullanicilar: renderUsers })[tab]();
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

    // Onaylı izin için iptal talebi: onaylanırsa izin iptal olur, günler bakiyeye döner
    function cancelRow(l) {
      const u = Store.user(l.userId), days = leaveDays(l);
      const locked = isLocked(u.id, l.start) || isLocked(u.id, l.end);
      return `<div class="approval" data-id="${l.id}">
        ${avatar(u, 40)}
        <div class="approval-main">
          <div><strong>${esc(u.name)}</strong> <span class="muted">· iznini iptal etmek istiyor</span></div>
          <div class="approval-what">${esc(leaveTypeName(l.type))} · ${fmtRange(l.start, l.end)} · <strong>${fmtNum(days)} iş günü</strong></div>
          <div class="approval-meta">
            ${l.type === 'yillik' ? `<span>${icon('sun', 14)} Onaylarsan ${fmtNum(days)} gün bakiyeye döner</span>` : ''}
            ${locked ? `<span class="warn-text">${icon('lock', 14)} Bu ay kapanışa gönderilmiş; iptalden sonra bu günler eksik görünür</span>` : ''}
            ${l.cancel.note ? `<span>“${esc(l.cancel.note)}”</span>` : ''}
            <span class="faint">${fmtStamp(l.cancel.requestedAt)}</span>
          </div>
        </div>
        <div class="approval-actions">
          <button class="btn ghost sm" data-cancel-decide="reddedildi">Reddet</button>
          <button class="btn primary sm" data-cancel-decide="onaylandi">${icon('check', 15)} İptali onayla</button>
        </div>
      </div>`;
    }

    function renderApprovals() {
      const pending = Store.leaves({ status: 'beklemede' }).slice().sort((a, b) => a.start.localeCompare(b.start));
      const cancels = cancelRequests().sort((a, b) => a.start.localeCompare(b.start));
      const decided = Store.leaves().filter(l => l.decidedAt).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)).slice(0, 5);
      panel.innerHTML = `
        <section class="card">
          <div class="card-head"><h2>Onay bekleyen talepler</h2><span class="muted">${pending.length} talep</span></div>
          ${pending.length ? pending.map(approvalRow).join('') : emptyState('check', 'Bekleyen talep yok', 'Yeni talepler geldiğinde burada görünecek.')}
        </section>
        ${cancels.length ? `<section class="card section-gap"><div class="card-head"><h2>İptal talepleri</h2><span class="muted">${cancels.length} talep</span></div>${cancels.map(cancelRow).join('')}</section>` : ''}
        ${decided.length ? `<section class="card section-gap"><div class="card-head"><h2>Son kararlar</h2></div>${decided.map(l => leaveRow(l, { user: Store.user(l.userId) })).join('')}</section>` : ''}`;
    }

    // Raporlar: faturalanır/faturalanmaz saat, müşteri → proje dökümü, sözleşme kullanımı, talepler
    function renderReports() {
      const r = monthReport(reportMonth);
      const pct = r.total ? Math.round((r.billable / r.total) * 100) : 0;
      const names = row => [...row.users].sort((a, b) => b[1] - a[1]).map(([uid, h]) => `${esc(firstName(Store.user(uid)?.name || '?'))} ${fmtNum(h)}`).join(' · ');
      const budget = row => {
        const b = budgetState(row.project, reportMonth);
        if (!b) return '<span class="faint">—</span>';
        return `<div class="budget budget-${b.tone}"><div class="meter"><span style="width:${Math.min(100, b.pct)}%"></span></div><span>%${Math.round(b.pct)} · ${fmtNum(b.budget)} sa</span></div>`;
      };
      panel.innerHTML = `
        <section class="card">
          <div class="card-head">
            <div><h2>Raporlar · ${monthTitle(reportMonth)}</h2><p class="sub">Faturalama, sözleşme saati kullanımı ve talep bazında saatler.</p></div>
            <div class="week-nav">
              <button class="btn ghost sm" data-report-export${r.total ? '' : ' disabled'}>${icon('download', 15)} Excel'e aktar</button>
              <button class="icon-btn bordered" data-report-month="-1" aria-label="Önceki ay">${icon('chevron-left')}</button>
              <button class="btn ghost sm" data-report-month="0">Bu ay</button>
              <button class="icon-btn bordered" data-report-month="1" aria-label="Sonraki ay">${icon('chevron-right')}</button>
            </div>
          </div>
          <div class="close-stats report-stats">
            <div><b>${fmtNum(r.total)}</b><span>toplam saat</span></div>
            <div class="is-good"><b>${fmtNum(r.billable)}</b><span>faturalanır · %${pct}</span></div>
            <div><b>${fmtNum(r.nonBillable)}</b><span>faturalanmaz (iç)</span></div>
            <div><b>${r.consultants}</b><span>danışman</span></div>
          </div>
          ${r.groups.length ? `<div class="table-wrap"><table class="table report-table">
            <thead><tr><th>Müşteri / Proje</th><th>Danışmanlar (saat)</th><th class="num">Saat</th><th>Sözleşme</th></tr></thead>
            <tbody>${r.groups.map(g => `
              <tr class="group-row"><td colspan="2"><span class="cell-proj"><span class="dot" style="background:${g.customer.color}"></span><strong>${esc(g.customer.name)}</strong></span></td><td class="num"><strong>${fmtNum(g.hours)}</strong></td><td></td></tr>
              ${g.rows.map(row => `<tr>
                <td class="indent">${esc(row.project.name)} <span class="code">${esc(row.project.code)}</span>${row.project.billable ? '' : ' <span class="tag">İç</span>'}</td>
                <td class="muted small-text">${names(row)}</td>
                <td class="num">${fmtNum(row.hours)}</td>
                <td class="w-budget">${budget(row)}</td>
              </tr>`).join('')}`).join('')}
            </tbody>
          </table></div>` : emptyState('inbox', 'Bu ay için kayıt yok')}
        </section>
        <section class="card section-gap">
          <div class="card-head"><div><h2>Talep bazında saatler</h2><p class="sub">Açıklamalarda geçen talep numaraları (ör. SM-2119038, CFR-102). Birden fazla talep geçen kaydın saati eşit bölünür.</p></div></div>
          ${r.tickets.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Talep</th><th>Proje</th><th class="num">Kayıt</th><th class="num">Saat</th><th>Son çalışma</th></tr></thead>
            <tbody>${r.tickets.slice(0, 50).map(t => `<tr>
              <td><strong class="code ticket">${esc(t.id)}</strong></td>
              <td>${[...t.projects].map(pid => esc(Store.project(pid).name)).join(', ')}</td>
              <td class="num">${t.entries}</td>
              <td class="num">${fmtNum(Math.round(t.hours * 100) / 100)}</td>
              <td class="muted nowrap">${fmtShort(t.last)}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : emptyState('search', 'Bu ay talep numarası geçen kayıt yok', 'Açıklamaya talep numarasını (ör. SM-2119038) yazınca burada toplanır.')}
        </section>`;
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
              <button class="icon-btn sm" data-print-form title="Yazdır / PDF" aria-label="Yazdır / PDF">${icon('printer', 15)}</button>
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

    // Tatiller: resmi tatiller ve şirketin verdiği köprü günleri. Hedef saat, izin günü ve eksik gün hesapları buradan beslenir.
    function renderHolidays() {
      const y = holidayYear, today = todayISO(), list = Store.holidays({ from: `${y}-01-01`, to: `${y}-12-31` });
      const missingFixed = fixedHolidays(y).filter(h => !Store.holiday(h.date));
      const noFeast = ['Ramazan', 'Kurban'].filter(k => !list.some(h => fold(h.name).includes(fold(k))));
      const workdays = sum(list.filter(h => !isWeekend(h.date)), h => (h.half ? 0.5 : 1));
      panel.innerHTML = `<section class="card">
        <div class="card-head">
          <div><h2>Tatiller · ${y}</h2><p class="sub">Resmi tatiller ve şirketin verdiği köprü günleri. Hedef saat, izin günü ve eksik gün hesapları buna göre yapılır.</p></div>
          <div class="week-nav">
            <button class="btn primary sm" data-hol-add>${icon('plus', 15)} Tatil ekle</button>
            <button class="icon-btn bordered" data-hol-year="-1" aria-label="Önceki yıl">${icon('chevron-left')}</button>
            <button class="btn ghost sm" data-hol-year="0">Bu yıl</button>
            <button class="icon-btn bordered" data-hol-year="1" aria-label="Sonraki yıl">${icon('chevron-right')}</button>
          </div>
        </div>
        ${missingFixed.length ? `<div class="callout info">${icon('info', 16)}<div><strong>${missingFixed.length} sabit tarihli resmi tatil eksik:</strong> ${missingFixed.map(h => fmtShort(h.date)).join(', ')}
          <div class="row-gap"><button class="btn ghost sm" data-hol-fixed>${icon('plus', 15)} Sabit tatilleri ekle</button></div></div></div>` : ''}
        ${noFeast.length ? `<div class="callout warn">${icon('alert', 16)}<div><strong>${noFeast.join(' ve ')} Bayramı girilmemiş.</strong> Dini bayramların tarihi her yıl değişir; Diyanet takviminden bakıp “Tatil ekle” ile gir (arifeyi de ekle seçeneğiyle).</div></div>` : ''}
        ${list.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Tarih</th><th>Tatil</th><th>Tür</th><th>Süre</th><th></th></tr></thead>
          <tbody>${list.map(h => `<tr data-hol="${h.id}" class="${h.date < today ? 'is-past' : ''}">
            <td class="nowrap">${fmtDate(h.date, { weekday: true })}${isWeekend(h.date) ? ' <span class="faint">· hafta sonu</span>' : ''}</td>
            <td><strong>${esc(h.name)}</strong></td>
            <td>${pill(HOLIDAY_KINDS[h.kind]?.label || h.kind, HOLIDAY_KINDS[h.kind]?.tone || 'muted')}</td>
            <td class="nowrap">${h.half ? 'Yarım gün' : 'Tam gün'}</td>
            <td class="num nowrap">
              <button class="icon-btn sm" data-hol-edit title="Düzenle" aria-label="Düzenle">${icon('pencil', 15)}</button>
              <button class="icon-btn sm" data-hol-del title="Sil" aria-label="Sil">${icon('trash', 15)}</button>
            </td>
          </tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small-text hol-foot">${list.length} kayıt · hafta içine denk gelen ${fmtNum(workdays)} iş günü</p>`
          : emptyState('calendar', `${y} için tatil girilmemiş`, 'Önce sabit tatilleri ekle, sonra bayramları gir.')}
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
            <td class="num nowrap">${u.annualLeave} gün${(c => c ? ` <small class="faint">${c > 0 ? '+' : '−'}${fmtNum(Math.abs(c))} devir</small>` : '')(leaveBalance(u).carried)}</td>
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
      const reportNav = e.target.closest('[data-report-month]');
      if (reportNav) {
        reportMonth = reportNav.dataset.reportMonth === '0' ? todayISO() : addMonths(reportMonth, Number(reportNav.dataset.reportMonth));
        return renderReports();
      }
      if (e.target.closest('[data-report-export]')) return exportMonthReport(reportMonth).catch(err => toast(err.message, { tone: 'danger' }));
      const closeNav = e.target.closest('[data-close-month]');
      if (closeNav) {
        closeMonth = closeNav.dataset.closeMonth === '0' ? addMonths(todayISO(), -1) : addMonths(closeMonth, Number(closeNav.dataset.closeMonth));
        return renderClosing();
      }
      const userRow = e.target.closest('[data-user]');
      if (userRow && e.target.closest('[data-review]')) return openReviewDialog(Store.user(userRow.dataset.user), closeMonth, render);
      if (userRow && e.target.closest('[data-dl]')) return exportMonthlyForm(Store.user(userRow.dataset.user), closeMonth).catch(err => toast(err.message, { tone: 'danger' }));
      if (userRow && e.target.closest('[data-print-form]')) return openPrintDialog(Store.user(userRow.dataset.user), closeMonth);
      const holNav = e.target.closest('[data-hol-year]');
      if (holNav) {
        holidayYear = holNav.dataset.holYear === '0' ? thisYear : holidayYear + Number(holNav.dataset.holYear);
        return renderHolidays();
      }
      if (e.target.closest('[data-hol-add]')) return holidayModal(null, holidayYear, renderHolidays);
      if (e.target.closest('[data-hol-fixed]')) {
        const added = fixedHolidays(holidayYear).map(h => Store.addHoliday(h)).filter(Boolean);
        renderHolidays();
        return toast(`${holidayYear} için ${added.length} sabit tatil eklendi${closedPeriodsNote(added.map(h => h.date))}`, {
          action: { label: 'Geri al', fn: () => { added.forEach(h => Store.deleteHoliday(h.id)); renderHolidays(); } },
        });
      }
      const holRow = e.target.closest('[data-hol]');
      if (holRow && e.target.closest('[data-hol-edit]')) return holidayModal(Store.holidays().find(h => h.id === holRow.dataset.hol), holidayYear, renderHolidays);
      if (holRow && e.target.closest('[data-hol-del]')) {
        const removed = Store.deleteHoliday(holRow.dataset.hol);
        renderHolidays();
        return toast(`${removed.name} (${fmtShort(removed.date)}) silindi${closedPeriodsNote([removed.date])}`, {
          tone: 'info', action: { label: 'Geri al', fn: () => { Store.addHoliday(removed); renderHolidays(); } },
        });
      }
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
      const cancelDecide = e.target.closest('[data-cancel-decide]');
      if (cancelDecide) {
        const l = Store.leave(cancelDecide.closest('[data-id]').dataset.id), ok = cancelDecide.dataset.cancelDecide === 'onaylandi';
        const before = { status: l.status, cancel: l.cancel };
        const cancel = { ...l.cancel, status: ok ? 'onaylandi' : 'reddedildi', decidedBy: App.user.id, decidedAt: new Date().toISOString() };
        Store.updateLeave(l.id, ok ? { status: 'iptal', cancel } : { cancel });
        render();
        toast(ok ? `${Store.user(l.userId).name} · izin iptal edildi` : 'İptal talebi reddedildi; izin geçerli', {
          tone: ok ? 'ok' : 'info',
          action: { label: 'Geri al', fn: () => { Store.updateLeave(l.id, before); render(); } },
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
        <label class="field"><span class="field-label">Yıllık izin hakkı (gün) <span class="faint" data-legal></span></span><input class="input" name="annualLeave" type="number" min="0" max="40" value="${u?.annualLeave ?? legalAnnualLeave(todayISO())}"></label>
        <label class="field"><span class="field-label">İşe giriş tarihi</span><input class="input" name="startDate" type="date" value="${u?.startDate || todayISO()}"></label>
        <label class="field"><span class="field-label">Devreden izin · ${LEAVE_START_YEAR} başı (gün) <span class="faint">portal öncesinden</span></span><input class="input" name="carryIn" type="number" step="0.5" min="-40" max="60" value="${u?.carryIn ?? 0}"></label>
      </div>
      ${u ? `<label class="toggle"><input type="checkbox" name="active"${u.active ? ' checked' : ''}${self ? ' disabled' : ''}> Hesap aktif${self ? ' <span class="faint">(kendi hesabın)</span>' : ''}</label>` : ''}
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="userForm">Kaydet</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      el.name.focus();
      // Kıdeme göre yasal asgari izin; yeni kullanıcıda elle değiştirilmediyse tarihle birlikte güncellenir
      const legal = m.querySelector('[data-legal]');
      const showLegal = () => { legal.textContent = `· yasal asgari ${legalAnnualLeave(el.startDate.value)}`; };
      el.annualLeave.addEventListener('input', () => { el.annualLeave.dataset.touched = '1'; });
      el.startDate.addEventListener('change', () => {
        showLegal();
        if (!u && !el.annualLeave.dataset.touched) el.annualLeave.value = legalAnnualLeave(el.startDate.value);
      });
      showLegal();
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
        const carryIn = Number(el.carryIn.value || 0);
        if (!(carryIn >= -40 && carryIn <= 60)) return formError(f, 'Devreden izin −40 ile 60 gün arasında olmalı.', el.carryIn);
        const data = { name, email, title: el.title.value.trim() || 'Danışman', annualLeave, startDate: el.startDate.value, carryIn };
        // Hak değişirse geçmiş yıllar eski hakla kalır; yoksa devreden izin geriye dönük değişirdi
        if (u && u.annualLeave !== annualLeave) {
          data.entitlements = { ...(u.entitlements || { [LEAVE_START_YEAR]: u.annualLeave }), [parseISO(todayISO()).getFullYear()]: annualLeave };
        }
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

// Kapanmış ayda tatil değişirse hedef saatler yeniden hesaplanır (girilen kayıtlar değişmez); yönetici bunu bilsin
function closedPeriodsNote(dates) {
  const months = new Set(dates.map(d => d.slice(0, 7)));
  const n = Store.periods().filter(p => months.has(p.month) && (p.status === 'gonderildi' || p.status === 'onaylandi')).length;
  return n ? ` · ${n} kişinin bu ayı kapanmış, hedef saatleri yeniden hesaplandı` : '';
}

// Tatil ekle / düzenle. Yeni kayıtta tarih aralığı girilebilir (bayram); istenirse önceki gün arife (yarım gün) olarak eklenir.
function holidayModal(h, year, onSave) {
  const first = h?.date || (todayISO().startsWith(String(year)) ? todayISO() : `${year}-01-01`);
  openModal({
    title: h ? 'Tatili düzenle' : 'Tatil ekle',
    body: `<form class="form-stack" id="holForm" novalidate>
      <label class="field"><span class="field-label">Tatil adı</span><input class="input" name="name" value="${esc(h?.name || '')}" maxlength="60" placeholder="Örn. Kurban Bayramı ya da Köprü günü"></label>
      <div class="field"><span class="field-label">Tür</span>
        <div class="seg">${Object.entries(HOLIDAY_KINDS).map(([k, v]) => `<input type="radio" name="kind" id="hk-${k}" value="${k}"${(h?.kind || 'resmi') === k ? ' checked' : ''}><label for="hk-${k}">${v.label}</label>`).join('')}</div>
      </div>
      <div class="form-grid">
        <label class="field"><span class="field-label">${h ? 'Tarih' : 'Başlangıç'}</span><input class="input" type="date" name="start" value="${first}"></label>
        ${h ? '' : `<label class="field"><span class="field-label">Bitiş <span class="faint">(birden çok günse)</span></span><input class="input" type="date" name="end" value="${first}"></label>`}
      </div>
      <label class="toggle" data-half-wrap><input type="checkbox" name="half"${h?.half ? ' checked' : ''}> Yarım gün (öğleden sonra tatil)</label>
      ${h ? '' : '<label class="toggle"><input type="checkbox" name="eve"> Önceki gün arife olarak eklensin (yarım gün)</label>'}
      <p class="muted small-text" data-kind-hint></p>
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="holForm">${h ? 'Kaydet' : 'Ekle'}</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      const dates = () => {
        const s = el.start.value, e = el.end ? el.end.value : s;
        return s && e && e >= s ? dateRange(s, e) : [];
      };
      const sync = () => {
        if (el.end && el.end.value < el.start.value) el.end.value = el.start.value;
        const multi = dates().length > 1;
        m.querySelector('[data-half-wrap]').hidden = multi;
        if (multi) el.half.checked = false;
        m.querySelector('[data-kind-hint]').textContent = el.kind.value === 'sirket'
          ? 'Şirket tatilinde (köprü günü) hedef saat düşer ve yıllık izinden düşülmez; danışmanın izin talebi açmasına gerek kalmaz.'
          : 'Resmi tatilde hedef saat düşer; o günlere denk gelen izin bakiyeden düşülmez.';
      };
      f.addEventListener('input', sync);
      f.addEventListener('change', sync);
      sync();
      el.name.focus();

      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = el.name.value.trim(), kind = el.kind.value, days = dates();
        if (!name) return formError(f, 'Tatilin adını yaz.', el.name);
        if (!days.length) return formError(f, 'Tarihleri kontrol et: bitiş başlangıçtan önce olamaz.', el.start);
        if (days.length > 15) return formError(f, 'Tek seferde en fazla 15 gün girilebilir.', el.end);
        const clash = days.map(d => Store.holiday(d)).find(x => x && x.id !== h?.id);
        if (clash) return formError(f, `${fmtDate(clash.date)} tarihinde zaten “${clash.name}” var.`, el.start);

        if (h) {
          Store.updateHoliday(h.id, { name, kind, date: days[0], half: el.half.checked });
          close();
          onSave();
          return toast(`${name} güncellendi${closedPeriodsNote([h.date, days[0]])}`);
        }
        const added = [];
        const eve = addDays(days[0], -1);
        if (el.eve.checked && !Store.holiday(eve)) added.push(Store.addHoliday({ date: eve, name: `${name} Arifesi`, kind, half: true }));
        days.forEach(date => added.push(Store.addHoliday({ date, name, kind, half: days.length === 1 && el.half.checked })));
        close();
        onSave();
        toast(`${name} eklendi · ${added.length} gün${closedPeriodsNote(added.map(x => x.date))}`, {
          action: { label: 'Geri al', fn: () => { added.forEach(x => Store.deleteHoliday(x.id)); onSave(); } },
        });
      });
    },
  });
}
