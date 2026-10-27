/* Özet: bugünün ve haftanın durumu, hızlı giriş, son aktiviteler, yaklaşanlar */

function kpiCard({ ic, label, value, of = '', meter = null, sub = '', tone = '' }) {
  return `<div class="card kpi ${tone}">
    <div class="kpi-head"><span class="kpi-ic">${icon(ic, 16)}</span>${esc(label)}</div>
    <div class="kpi-val">${value}<span class="kpi-of"> ${of}</span></div>
    ${meter != null ? `<div class="meter"><span style="width:${meter}%"></span></div>` : ''}
    <div class="kpi-sub">${sub}</div>
  </div>`;
}

const DashboardView = {
  mount(el) {
    const me = App.user, today = todayISO();
    const monthName = TR_MONTHS[parseISO(today).getMonth()];
    el.innerHTML = `
      <header class="page-head">
        <div><h1>${greeting()}, ${esc(firstName(me.name))}</h1><p>${fmtDate(today, { weekday: true })}</p></div>
        <a class="btn ghost" href="#/izinler">${icon('sun', 16)} İzin talebi oluştur</a>
      </header>
      <div id="reminder"></div>
      <section class="grid kpis" id="kpis"></section>
      <section class="card section-gap" id="month"></section>
      <div class="grid two-col section-gap">
        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>Hızlı aktivite girişi</h2><span class="row-gap"><span id="calHint"></span><span class="kbd-hint"><kbd>Enter</kbd> ile kaydet</span></span></div>
            <div id="quick"></div>
          </section>
          <section class="card" id="recent"></section>
        </div>
        <div class="stack">
          <section class="card" id="dist"></section>
          <section class="card" id="upcoming"></section>
        </div>
      </div>`;

    const form = createEntryForm(el.querySelector('#quick'), {
      userId: me.id,
      initial: { date: today },
      onSubmit(data, f) {
        Store.addActivity({ userId: me.id, ...data });
        f.reset();
        refresh();
        toast(`${fmtHours(data.hours)} eklendi · ${fmtShort(data.date)} toplamı ${fmtHours(hoursOn(me.id, data.date))}`);
      },
    });
    bindActivityRows(el.querySelector('#recent'), () => refresh());

    // Aylık durum: ayın tüm günleri tek bakışta; güne tıklayınca o günün aktivitelerine gider
    let calMonth = today;
    function renderMonth() {
      el.querySelector('#month').innerHTML = `
        <div class="card-head">
          <div><h2>Aylık durum · ${monthTitle(calMonth)}</h2><p class="sub">Hangi günler girildi, hangileri eksik. Bir güne tıkla, o güne git.</p></div>
          <div class="week-nav">
            <button class="btn ghost sm" data-form>${icon('download', 15)} Aylık formu indir</button>
            <button class="icon-btn bordered" data-month="-1" aria-label="Önceki ay">${icon('chevron-left')}</button>
            <button class="btn ghost sm" data-month="0">Bu ay</button>
            <button class="icon-btn bordered" data-month="1" aria-label="Sonraki ay">${icon('chevron-right')}</button>
          </div>
        </div>
        <div class="month-layout">${monthCalendar(me.id, calMonth)}<aside>${monthStatsHtml(monthSummary(me.id, calMonth))}${periodPanelHtml(me, calMonth)}</aside></div>`;
    }

    // Geçen ay kapatılmadıysa ya da iade edildiyse en üstte hatırlat
    function renderReminder() {
      const prev = addMonths(today, -1), p = Store.period(me.id, prev.slice(0, 7)), status = p?.status || 'acik';
      const box = el.querySelector('#reminder');
      if (status !== 'acik' && status !== 'iade') { box.innerHTML = ''; return; }
      const bad = incompleteDays(monthSummary(me.id, prev)).length;
      box.innerHTML = `<div class="reminder${status === 'iade' ? ' is-returned' : ''}">
        ${icon(status === 'iade' ? 'alert' : 'send', 18)}
        <div class="grow"><strong>${status === 'iade' ? `${monthTitle(prev)} iade edildi` : `${monthTitle(prev)} henüz kapatılmadı`}</strong>
          <p>${status === 'iade' ? `Yönetici notu: “${esc(p.reviewNote || '')}”` : bad ? `${bad} günde giriş eksik. Tamamla ve onaya gönder.` : 'Tüm günler dolu; tek tıkla onaya gönderebilirsin.'}</p></div>
        <a class="btn ${status === 'iade' || !bad ? 'primary' : 'ghost'} sm" href="#/aktiviteler?d=${prev}&v=ay">${status === 'iade' ? 'Düzelt' : 'Ayı kapat'} ${icon('arrow-right', 14)}</a>
      </div>`;
    }

    el.querySelector('#month').addEventListener('click', e => {
      if (handlePeriodClick(e, me, calMonth, () => refresh())) return;
      const nav = e.target.closest('[data-month]');
      if (nav) { calMonth = nav.dataset.month === '0' ? today : addMonths(calMonth, Number(nav.dataset.month)); return renderMonth(); }
      if (e.target.closest('[data-form]')) return exportMonthlyForm(me, calMonth).catch(err => toast(err.message, { tone: 'danger' }));
      const cell = e.target.closest('[data-cal-day]');
      if (cell) location.hash = `#/aktiviteler?d=${cell.dataset.calDay}&v=gun`;
    });

    function renderKpis() {
      const tTarget = dailyTarget(me.id, today), tLogged = hoursOn(me.id, today);
      const week = weekSummary(me.id, weekStart(today));
      const missing = missingDays(me.id, monthStart(today), addDays(today, -1));
      const bal = leaveBalance(me);
      const weekHolidays = week.days.map(getHoliday).filter(h => h && !h.half);
      const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);

      const todaySub = tTarget === 0 ? esc(dayOffReason(me.id, today) || 'Bugün çalışma günü değil')
        : tLogged >= tTarget ? 'Gün tamamlandı ✓' : `${fmtNum(tTarget - tLogged)} saat kaldı`;
      const weekSub = weekHolidays.length ? weekHolidays.map(h => `${fmtShort(h.date)} ${esc(h.name)}`).join(', ')
        : `${fmtNum(Math.max(0, week.target - week.logged))} saat kaldı`;
      const missSub = missing.length
        ? `<a class="link" href="#/aktiviteler?d=${missing[0].date}&v=gun">${missing.slice(0, 3).map(d => fmtShort(d.date)).join(', ')}${missing.length > 3 ? '…' : ''} · Tamamla ${icon('arrow-right', 14)}</a>`
        : 'Bu ay tüm günler dolu';

      el.querySelector('#kpis').innerHTML = [
        kpiCard({ ic: 'clock', label: 'Bugün', value: fmtNum(tLogged), of: tTarget ? `/ ${fmtNum(tTarget)} sa` : 'sa', meter: tTarget ? pct(tLogged, tTarget) : null, sub: todaySub }),
        kpiCard({ ic: 'calendar', label: 'Bu hafta', value: fmtNum(week.logged), of: `/ ${fmtNum(week.target)} sa`, meter: pct(week.logged, week.target), sub: weekSub }),
        kpiCard({ ic: missing.length ? 'alert' : 'check', label: `${monthName} eksik giriş`, value: missing.length, of: 'gün', sub: missSub, tone: missing.length ? 'alert' : '' }),
        kpiCard({ ic: 'sun', label: 'Kalan yıllık izin', value: fmtNum(bal.remaining), of: 'gün', sub: `${bal.total} günden ${fmtNum(bal.used)} gün kullanıldı${bal.pending ? ` · ${fmtNum(bal.pending)} gün onayda` : ''}` }),
      ].join('');
    }

    function renderRecent() {
      const items = Store.activities({ userId: me.id }).slice().sort(newestFirst).slice(0, 6);
      el.querySelector('#recent').innerHTML = `
        <div class="card-head"><h2>Son aktiviteler</h2><a class="link" href="#/aktiviteler">Tümü ${icon('arrow-right', 14)}</a></div>
        ${items.length ? `<div class="list">${items.map(a => activityRow(a, { showDate: true })).join('')}</div>`
          : emptyState('inbox', 'Henüz aktivite yok', 'İlk kaydını yukarıdan ekleyebilirsin.')}`;
    }

    function renderDist() {
      const items = Store.activities({ userId: me.id, from: monthStart(today), to: today });
      const total = sum(items, a => a.hours);
      const byProject = items.reduce((m, a) => ((m[a.projectId] = (m[a.projectId] || 0) + a.hours), m), {});
      const rows = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const max = rows.length ? rows[0][1] : 1;
      el.querySelector('#dist').innerHTML = `
        <div class="card-head"><h2>${monthName} proje dağılımı</h2><span class="muted">${fmtHours(total)}</span></div>
        ${rows.length ? `<div class="bars">${rows.map(([pid, h]) => {
          const p = Store.project(pid), c = Store.customer(p.customerId);
          return `<div>
            <div class="bar-label"><span class="dot" style="background:${c.color}"></span><span class="ellipsis">${esc(p.name)}</span><span class="bar-val">${fmtNum(h)} sa · %${Math.round((h / total) * 100)}</span></div>
            <div class="bar"><span style="width:${(h / max) * 100}%;background:${c.color}"></span></div>
          </div>`;
        }).join('')}</div>` : emptyState('clock', 'Bu ay henüz kayıt yok')}`;
    }

    function renderUpcoming() {
      const end = addDays(today, 45);
      const items = [
        ...HOLIDAYS.filter(h => h.date >= today && h.date <= end)
          .map(h => ({ date: h.date, title: h.name, sub: h.half ? 'Yarım gün tatil' : 'Resmi tatil' })),
        ...Store.leaves()
          .filter(l => l.end >= today && l.start <= end && (l.status === 'onaylandi' || (l.status === 'beklemede' && l.userId === me.id)))
          .map(l => {
            const u = Store.user(l.userId), mine = u.id === me.id;
            return {
              date: l.start < today ? today : l.start, user: u,
              title: mine ? `İznin · ${leaveTypeName(l.type)}` : `${u.name} izinde`,
              sub: fmtRange(l.start, l.end) + (l.status === 'beklemede' ? ' · onay bekliyor' : ''),
            };
          }),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

      el.querySelector('#upcoming').innerHTML = `
        <div class="card-head"><h2>Yaklaşanlar</h2><span class="muted">45 gün</span></div>
        ${items.length ? `<div class="upc">${items.map(i => `<div class="upc-row">
            <span class="date-badge sm"><b>${parseISO(i.date).getDate()}</b><span>${TR_MONTHS_SHORT[parseISO(i.date).getMonth()]}</span></span>
            <div class="upc-main"><strong>${esc(i.title)}</strong><small>${esc(i.sub)}</small></div>
            ${i.user ? avatar(i.user, 26) : `<span class="upc-ic">${icon('flag', 14)}</span>`}
          </div>`).join('')}</div>` : emptyState('calendar', 'Yaklaşan bir şey yok')}`;
    }

    // Bugünün takvim önerileri varsa hızlı giriş kartında kısa yol
    function renderCalHint() {
      const open = (calendarSuggestions(me.id, today) || []).filter(s => !s.added);
      el.querySelector('#calHint').innerHTML = open.length && !isLocked(me.id, today)
        ? `<a class="link" href="#/aktiviteler?d=${today}&v=gun">${icon('calendar', 14)} Takviminde ${open.length} toplantı önerisi</a>` : '';
    }

    function refresh() { renderReminder(); renderKpis(); renderMonth(); renderRecent(); renderDist(); renderUpcoming(); renderCalHint(); form.refresh(); }
    refresh();
  },
};
