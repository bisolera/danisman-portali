/* Yönetim (yalnızca yönetici): izin onayları, ay kapanışı, raporlar, ekibin haftası, tatiller, kullanıcı hesapları */

const AdminView = {
  mount(el, { query }) {
    const TABS = [['onaylar', 'İzin onayları'], ['kapanis', 'Ay kapanışı'], ['raporlar', 'Raporlar'], ['doluluk', 'Doluluk'], ['sozlesmeler', 'Sözleşmeler'], ['prim', 'Prim & yan haklar'], ['ekip', 'Ekip durumu'], ['tatiller', 'Tatiller'], ['kullanicilar', 'Kullanıcılar']];
    let contractFilter = 'aktif';
    // Prim genelde biten ay için hesaplanır
    let payMonth = query.tab === 'prim' && /^\d{4}-\d{2}$/.test(query.ay || '') ? `${query.ay}-01` : monthStart(addMonths(todayISO(), -1));
    let tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'onaylar';
    // Doluluk: bağlantıyla ay seçilebilir (#/yonetim?tab=doluluk&ay=2026-09); ay yeni başladıysa geçen ay açılır
    let utilMonth = /^\d{4}-\d{2}$/.test(query.ay || '') ? `${query.ay}-01` : todayISO();
    if (!query.ay && utilizationRange(utilMonth).to < monthStart(utilMonth)) utilMonth = addMonths(utilMonth, -1);
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
      const counts = {
        onaylar: Store.leaves({ status: 'beklemede' }).length + cancelRequests().length,
        kapanis: Store.periods({ status: 'gonderildi' }).length,
        sozlesmeler: new Set(contractAlerts().map(a => a.contract.id)).size,
      };
      tabsEl.innerHTML = TABS.map(([k, label]) =>
        `<button class="${k === tab ? 'is-active' : ''}" data-tab="${k}">${label}${counts[k] ? ` <span class="count">${counts[k]}</span>` : ''}</button>`).join('');
      ({ onaylar: renderApprovals, kapanis: renderClosing, raporlar: renderReports, doluluk: renderUtilization, sozlesmeler: renderContracts, prim: renderPayroll, ekip: renderTeam, tatiller: renderHolidays, kullanicilar: renderUsers })[tab]();
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
            ${b ? (p => `<span class="${p.advance ? 'warn-text' : ''}">${icon('sun', 14)} Bakiye ${fmtNum(b.remaining)} → ${fmtNum(p.after)} gün${p.advance
              ? ` · avans${p.next ? `, ${fmtShort(p.next.date)} hak edişinden düşülür` : ''}` : ''}</span>`)(leaveProjection(u, l.start, 0))   // bekleyenler (bu talep dahil) zaten düşülür
              : ''}
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
              ${exportButton('data-report-export', r.total)}
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

    // Doluluk: faturalanır saat ÷ hedef saat (izin, tatil, köprü düşülmüş); en düşük oran en üstte
    function renderUtilization() {
      const t = teamUtilization(utilMonth), { from, to } = utilizationRange(utilMonth);
      const goal = Math.round(UTILIZATION_TARGET * 100), current = monthStart(utilMonth) >= monthStart(todayISO());
      const pctText = p => (p == null ? '—' : `%${Math.round(p * 100)}`);
      const months = [5, 4, 3, 2, 1, 0].map(k => addMonths(utilMonth, -k));
      const rows = t.rows.slice().sort((a, b) => (a.pct ?? 9) - (b.pct ?? 9) || a.user.name.localeCompare(b.user.name, 'tr'));
      const internal = internalBreakdown(utilMonth), internalTotal = sum(internal, r => r.hours);
      const period = to < from ? 'Ay yeni başladı.' : `Dönem: ${fmtShort(from)} – ${fmtShort(to)}${monthEnd(utilMonth) > to ? ' (düne kadar)' : ''}.`;
      const spark = u => `<span class="spark" aria-label="Son 6 ay">${months.map(mo => {
        const x = utilization(u, mo);
        return `<i class="sp-${x.tone}" style="height:${x.pct == null ? 3 : Math.max(10, Math.min(100, x.pct * 100))}%" title="${esc(`${monthTitle(mo)} · ${pctText(x.pct)}`)}"></i>`;
      }).join('')}</span>`;
      const names = users => [...users].sort((a, b) => b[1] - a[1]).map(([id, h]) => `${esc(firstName(Store.user(id)?.name || '?'))} ${fmtNum(h)}`).join(' · ');

      panel.innerHTML = `
        <section class="card">
          <div class="card-head">
            <div><h2>Doluluk · ${monthTitle(utilMonth)}</h2><p class="sub">Faturalanır saat ÷ hedef saat. Hedef: iş günleri × 8; izin, tatil ve köprü düşülmüş. %${goal} altı uyarı. ${period}</p></div>
            <div class="week-nav">
              ${exportButton('data-util-export', t.target)}
              <button class="icon-btn bordered" data-util-month="-1" aria-label="Önceki ay">${icon('chevron-left')}</button>
              <button class="btn ghost sm" data-util-month="0">Bu ay</button>
              <button class="icon-btn bordered" data-util-month="1" aria-label="Sonraki ay"${current ? ' disabled' : ''}>${icon('chevron-right')}</button>
            </div>
          </div>
          <div class="close-stats report-stats">
            <div class="${t.pct == null ? '' : t.pct < UTILIZATION_TARGET ? 'is-bad' : 'is-good'}"><b>${pctText(t.pct)}</b><span>ekip doluluğu</span></div>
            <div><b>${fmtNum(t.billable)}</b><span>faturalanır / ${fmtNum(t.target)} sa hedef</span></div>
            <div><b>${fmtNum(t.logged - t.billable)}</b><span>faturalanmayan (sa)</span></div>
            <div class="${t.warn ? 'is-bad' : ''}"><b>${t.warn}</b><span>kişi %${goal} altında</span></div>
          </div>
          ${t.target ? `<div class="table-wrap"><table class="table util-table">
            <thead><tr><th>Danışman</th><th class="num">Hedef</th><th class="num">Girilen</th><th class="num">Faturalanır</th><th class="num">Faturalanmayan</th><th>Doluluk</th><th>Son 6 ay</th></tr></thead>
            <tbody>${rows.map(r => `<tr data-util-user="${r.user.id}">
              <td><span class="cell-user">${avatar(r.user, 30)}<span><strong>${esc(r.user.name)}</strong><small>${[
                r.leave ? `${fmtNum(r.leave)} gün izin` : '',
                r.missing ? `<span class="warn-text">${r.missing} gün eksik giriş</span>` : '',
              ].filter(Boolean).join(' · ') || esc(r.user.title)}</small></span></span></td>
              <td class="num">${fmtNum(r.target)}</td>
              <td class="num">${fmtNum(r.logged)}</td>
              <td class="num"><strong>${fmtNum(r.billable)}</strong></td>
              <td class="num">${fmtNum(r.internal)}</td>
              <td class="w-util"><div class="util util-${r.tone}"><div class="meter" style="--goal:${goal}%"><span style="width:${r.pct == null ? 0 : Math.min(100, r.pct * 100)}%"></span></div><b>${pctText(r.pct)}</b></div></td>
              <td>${spark(r.user)}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : emptyState('clock', to < from ? 'Ay yeni başladı' : 'Bu dönemde hedef saat yok', to < from ? 'Geçen aya bakmak için soldaki oku kullan.' : '')}
        </section>
        <section class="card section-gap">
          <div class="card-head"><div><h2>Faturalanmayan saatler nereye gitti?</h2><p class="sub">İç projeler ve faturalanmayan işler, aynı dönem.</p></div><span class="muted">${fmtNum(internalTotal)} sa</span></div>
          ${internal.length ? `<div class="bars">${internal.map(r => `<div>
            <div class="bar-label"><span class="dot" style="background:${r.customer.color}"></span><span class="ellipsis">${esc(r.project.name)} <span class="faint">${esc(r.customer.name)}</span></span><span class="bar-val">${fmtNum(r.hours)} sa · %${Math.round((r.hours / internalTotal) * 100)}</span></div>
            <div class="bar"><span style="width:${(r.hours / internal[0].hours) * 100}%;background:${r.customer.color}"></span></div>
            <small class="muted">${names(r.users)}</small>
          </div>`).join('')}</div>` : emptyState('check', 'Bu dönemde faturalanmayan saat yok')}
        </section>`;
    }

    // Sözleşmeler: bitiş tarihleri ve saat havuzları; bitişe yakın, havuzu dolan ve erken tükenecekler üstte uyarılır
    function renderContracts() {
      const today = todayISO(), alerts = contractAlerts(today), alertIds = new Set(alerts.map(a => a.contract.id));
      const all = Store.contracts().map(c => ({ c, st: contractStatus(c, today), u: contractUsage(c, today), customer: Store.customer(c.customerId) }));
      const ended = r => r.st === 'bitti' || r.st === 'yenilendi';
      const shown = all.filter(r => contractFilter === 'hepsi' || (contractFilter === 'aktif' ? !ended(r) : ended(r)))
        .sort((a, b) => (alertIds.has(b.c.id) - alertIds.has(a.c.id)) || a.c.end.localeCompare(b.c.end));
      const count = st => all.filter(r => r.st === st).length;
      const poolAlerts = new Set(alerts.filter(a => a.kind !== 'bitiyor').map(a => a.contract.id)).size;
      const period = ({ c, st }) => ({
        baslamadi: `${daysBetween(today, c.start)} gün sonra başlar`,
        bitti: `${fmtDate(c.end)} bitti`,
        yenilendi: `Yenilendi: ${Store.contract(c.renewedTo)?.name || ''}`,
      })[st] || `${daysBetween(today, c.end)} gün kaldı`;
      panel.innerHTML = `<section class="card">
        <div class="card-head">
          <div><h2>Sözleşmeler</h2><p class="sub">Müşteri sözleşmelerinin bitiş tarihleri ve saat havuzları. Kullanılan saat, bağlı projelere sözleşme döneminde yazılan saattir.</p></div>
          <div class="row-gap">
            ${exportButton('data-contract-export', all.length)}
            <button class="btn primary sm" data-add-contract>${icon('plus', 15)} Sözleşme ekle</button>
          </div>
        </div>
        <div class="close-stats report-stats">
          <div><b>${count('aktif') + count('yakinda')}</b><span>aktif sözleşme</span></div>
          <div class="${count('yakinda') ? 'is-bad' : ''}"><b>${count('yakinda')}</b><span>bitişe yakın</span></div>
          <div class="${poolAlerts ? 'is-bad' : ''}"><b>${poolAlerts}</b><span>saat havuzu uyarısı</span></div>
          <div><b>${count('baslamadi')}</b><span>henüz başlamadı</span></div>
        </div>
        ${alerts.length ? `<div class="callout warn">${icon('alert', 16)}<div><strong>İlgilenilmesi gerekenler</strong>
          <ul class="alert-list">${alerts.map(a => `<li><b>${esc(a.customer.name)} · ${esc(a.contract.name)}:</b> ${esc(a.text)}</li>`).join('')}</ul></div></div>` : ''}
        <div class="tabs sub-tabs">${[['aktif', 'Aktif'], ['biten', 'Biten'], ['hepsi', 'Tümü']].map(([k, label]) =>
          `<button class="${k === contractFilter ? 'is-active' : ''}" data-contract-filter="${k}">${label}</button>`).join('')}</div>
        ${shown.length ? `<div class="table-wrap"><table class="table contract-table">
          <thead><tr><th>Müşteri / Sözleşme</th><th>Dönem</th><th>Projeler</th><th>Saat havuzu</th><th>Durum</th><th></th></tr></thead>
          <tbody>${shown.map(r => `<tr data-contract="${r.c.id}" class="${alertIds.has(r.c.id) ? 'has-alert' : ''}">
            <td><span class="cell-proj"><span class="dot" style="background:${r.customer.color}"></span><span><strong>${esc(r.customer.name)}</strong><small>${esc(r.c.name)}${r.c.note ? ` · ${esc(r.c.note)}` : ''}</small></span></span></td>
            <td class="nowrap">${fmtDate(r.c.start)} – ${fmtDate(r.c.end)}<small class="muted block-sm">${esc(period(r))}</small></td>
            <td>${r.c.projectIds.map(pid => `<span class="code">${esc(Store.project(pid)?.code || '?')}</span>`).join(' ') || '<span class="faint">—</span>'}</td>
            <td class="w-budget">${r.u.hours
              ? `<div class="budget budget-${r.u.tone}"><div class="meter"><span style="width:${Math.min(100, r.u.pct)}%"></span></div><span>${fmtNum(r.u.used)} / ${fmtNum(r.u.hours)} sa · %${Math.round(r.u.pct)}</span></div>
                ${r.u.runsOutOn ? `<small class="warn-text block-sm">Bu hızla ${fmtDate(r.u.runsOutOn)} tarihinde tükenir</small>` : ''}`
              : `<span class="muted">${fmtNum(r.u.used)} sa · havuz yok</span>`}</td>
            <td>${pill(CONTRACT_STATUS[r.st].label, CONTRACT_STATUS[r.st].tone)}${r.c.renewal === 'otomatik' ? '<small class="muted block-sm">otomatik yenilenir</small>' : ''}</td>
            <td class="num nowrap">
              ${r.st !== 'yenilendi' && r.st !== 'baslamadi' ? `<button class="btn ghost sm" data-renew-contract>${icon('refresh', 14)} Yenile</button>` : ''}
              <button class="icon-btn sm" data-edit-contract title="Düzenle" aria-label="Düzenle">${icon('pencil', 15)}</button>
              <button class="icon-btn sm" data-del-contract title="Sil" aria-label="Sil">${icon('trash', 15)}</button>
            </td>
          </tr>`).join('')}</tbody>
        </table></div>` : emptyState('sheet', contractFilter === 'biten' ? 'Biten sözleşme yok' : 'Sözleşme girilmemiş', 'Müşteri sözleşmelerini bitiş tarihi ve saat havuzuyla ekle; bitmeden ve havuz dolmadan uyarılırsın.')}
      </section>`;
    }

    // Prim & yan haklar: faturalanabilir saat ÷ 8 (kesirli gün), eşiği aşan gün × günlük prim; araç yerine araba parası
    function renderPayroll() {
      const r = payrollMonth(payMonth), rate = r.rate, from = monthStart(payMonth), to = monthEnd(payMonth);
      const draft = r.rows.filter(x => !x.final).length, eligible = r.rows.filter(x => x.bonusOn);
      const money = v => (v ? fmtMoney(v) : '<span class="faint">—</span>');
      const share = v => (r.total ? `${((v / r.total) * 100).toFixed(2)}%` : '0%');
      // Gün çubukları aynı ölçekte: eşik çizgisi bütün satırlarda aynı hizaya düşer, kimin geçtiği tek bakışta görülür
      const scale = Math.max(rate ? rate.bonusThreshold * 1.4 : 0, ...r.rows.map(x => x.days), 1);
      const pos = v => `${Math.min(100, (v / scale) * 100).toFixed(2)}%`;
      const dayBar = x => {
        if (!x.bonusOn) return `<span class="pday-off">Prime tabi değil · ${fmtNum(x.billable)} sa</span>`;
        const goal = rate?.bonusThreshold;
        const note = goal == null ? 'eşik tanımsız' : x.over > 0 ? `+${fmtDays(x.over)} gün eşik üstü` : `eşiğe ${fmtDays(goal - x.days)} gün`;
        return `<div class="pday${x.over > 0 ? ' is-over' : ''}${goal == null ? ' no-goal' : ''}" style="--goal:${pos(goal || 0)}">
          <div class="pday-bar"><span style="width:${pos(x.days)}"></span>${x.over > 0 ? `<span class="over" style="left:${pos(goal)};width:calc(${pos(x.days)} - ${pos(goal)})"></span>` : ''}</div>
          <div class="pday-text"><b>${fmtDays(x.days)} gün</b><span>${fmtNum(x.billable)} sa</span><em>${note}</em></div>
        </div>`;
      };
      const subline = u => [esc(u.title), u.startDate > from && u.startDate <= to && `${fmtShort(u.startDate)} başladı`,
        u.endDate && u.endDate <= to && `${fmtShort(u.endDate)} ayrıldı`,
        ...perkChanges(u, from, to).map(c => `${c.key === 'bonus' ? 'Prim' : 'Araba parası'} ${fmtShort(c.date)} itibarıyla ${c.on ? 'başladı' : 'bitti'}`)]
        .filter(Boolean).join(' · ');
      panel.innerHTML = `<section class="card">
        <div class="card-head">
          <div><h2>Prim & yan haklar</h2><p class="sub">Faturalanabilir güne göre prim ve araç yerine ödenen araba parası. Yalnızca yöneticiler görür.</p></div>
          <div class="row-gap">
            ${payMonth !== monthStart(addMonths(todayISO(), -1)) ? '<button class="link-btn" data-pay-month="0">Geçen aya dön</button>' : ''}
            <div class="month-switch">
              <button class="icon-btn" data-pay-month="-1" aria-label="Önceki ay">${icon('chevron-left', 16)}</button>
              <span class="month-label">${monthTitle(payMonth)}</span>
              <button class="icon-btn" data-pay-month="1" aria-label="Sonraki ay"${from >= monthStart(todayISO()) ? ' disabled' : ''}>${icon('chevron-right', 16)}</button>
            </div>
            ${exportButton('data-pay-export', r.rows.length && rate)}
          </div>
        </div>
        ${rate ? `<div class="pay-rate">
            <span class="rate-chip"><small>Eşik</small><b>${fmtNum(rate.bonusThreshold)} gün</b></span>
            <span class="rate-chip"><small>Günlük prim</small><b>${fmtMoney(rate.bonusDaily)}</b></span>
            <span class="rate-chip"><small>Araba parası</small><b>${fmtMoney(rate.carMonthly)}</b><small>/ ay</small></span>
            <span class="rate-meta">${fmtDate(rate.from)} itibarıyla <button class="btn ghost sm" data-pay-rates>${icon('pencil', 14)} Tutarlar</button></span>
          </div>`
          : `<div class="callout warn">${icon('alert', 16)}<div><strong>${monthTitle(payMonth)} için tutar girilmemiş.</strong> Eşik gün, günlük prim ve araba parasını yürürlük tarihiyle gir; bu ayın primi o zaman hesaplanır.
            <div class="row-gap"><button class="btn primary sm" data-pay-rates>${icon('plus', 15)} Tutar gir</button></div></div></div>`}
        ${r.rows.length ? `<div class="pay-sum">
            <div class="pay-sum-main">
              <span>Ödenecek toplam</span>
              <b>${fmtMoney(r.total)}</b>
              <div class="pay-split">${r.bonus ? `<span class="s-bonus" style="width:${share(r.bonus)}"></span>` : ''}${r.car ? `<span class="s-car" style="width:${share(r.car)}"></span>` : ''}</div>
              <span class="pay-sum-meta">${draft ? `${pill('Taslak', 'warn')} ${draft} kişinin ay kapanışı onaylanmadı; tutar değişebilir` : `${pill('Kesin', 'ok')} Bütün aylar onaylı`}</span>
            </div>
            <div><span><i class="dot s-bonus"></i>Prim</span><b>${fmtMoney(r.bonus)}</b><small>${eligible.filter(x => x.bonus > 0).length} / ${eligible.length} kişi eşiği geçti</small></div>
            <div><span><i class="dot s-car"></i>Araba parası</span><b>${fmtMoney(r.car)}</b><small>${r.rows.filter(x => x.car > 0).length} kişi</small></div>
          </div>
          <div class="table-wrap"><table class="table pay-table">
          <thead><tr><th>Danışman</th><th>Prim günü <span class="faint">(faturalanabilir saat ÷ 8)</span></th><th class="num">Prim</th><th class="num">Araba parası</th><th class="num">Toplam</th></tr></thead>
          <tbody>${r.rows.map(x => `<tr data-pay-row="${x.user.id}">
            <td><span class="cell-user">${avatar(x.user, 30)}<span><strong>${esc(x.user.name)}</strong><small>${subline(x.user)}</small></span></span></td>
            <td class="w-days">${dayBar(x)}</td>
            <td class="num nowrap">${money(x.bonus)}${x.bonus ? `<small class="muted block-sm">${fmtDays(x.over)} × ${fmtMoney(rate.bonusDaily)}</small>` : ''}</td>
            <td class="num nowrap">${money(x.car)}${x.car && x.prorated ? `<small class="muted block-sm">kıst ${x.carDays}/${x.monthDays} gün</small>` : ''}</td>
            <td class="num nowrap"><strong>${fmtMoney(x.total)}</strong><span class="pay-st${x.final ? ' is-final' : ''}">${x.final ? 'Kesin' : 'Taslak'}</span></td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">Toplam · ${r.rows.length} kişi</td><td class="num nowrap">${fmtMoney(r.bonus)}</td><td class="num nowrap">${fmtMoney(r.car)}</td><td class="num nowrap">${fmtMoney(r.total)}</td></tr></tfoot>
        </table></div>
        <details class="howto"><summary>Nasıl hesaplanır?</summary><ol>
          <li>Prim günü = faturalanabilir projelere yazılan saat ÷ 8, kesirli (203 sa = 25,375 gün). İç işler sayılmaz.</li>
          <li>Prim = (prim günü − eşik) × günlük prim. Eşiğe ulaşmayan prim almaz.</li>
          <li>Araba parası araç yerine para alanlara aylık ödenir. Ay ortasında giren ya da ayrılan, çalıştığı gün kadar alır (kıst: tutar × gün ÷ ayın gün sayısı).</li>
          <li>Kişinin ay kapanışı onaylanınca tutarı kesinleşir; o zamana kadar taslaktır.</li>
        </ol></details>` : emptyState('users', 'Prime tabi ya da araba parası alan kimse yok', 'Kullanıcılar sekmesinde kişiyi düzenleyip “Prime tabi” ya da “Araç yerine araba parası” işaretle.')}
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
            <td><strong>${esc(h.name)}</strong>${h.kind === 'kopru' ? `<small class="muted block-sm">${esc(bridgeSummary(h))}</small>` : ''}</td>
            <td>${pill(HOLIDAY_KINDS[h.kind]?.label || h.kind, HOLIDAY_KINDS[h.kind]?.tone || 'muted')}</td>
            <td class="nowrap">${!h.half ? 'Tam gün' : Store.holidaysOn(h.date).length > 1 ? 'Yarım gün <span class="faint">· birlikte tam gün</span>' : 'Yarım gün'}</td>
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
          <thead><tr><th>Ad Soyad</th><th>Unvan</th><th>Rol</th><th class="num">Kalan izin</th><th>Sonraki hak ediş</th><th>Durum</th><th></th></tr></thead>
          <tbody>${users.map(u => `<tr class="${u.active ? '' : 'is-inactive'}">
            <td><span class="cell-user">${avatar(u, 30)}<span><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></span></span></td>
            <td>${esc(u.title)}</td>
            <td>${u.role === 'admin' ? pill('Yönetici', 'info') : 'Danışman'}</td>
            ${(b => `<td class="num nowrap${b.advance ? ' warn-text' : ''}">${fmtNum(b.remaining)} gün${b.advance ? ' <small>(avans)</small>' : ''}</td>
              <td class="nowrap">${b.next ? `${fmtDate(b.next.date)} <span class="faint">+${fmtNum(b.next.days)}</span>` : '<span class="faint">—</span>'}</td>`)(leaveBalance(u))}
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
      if (e.target.closest('[data-report-export]')) return openExportChoice(e.target.closest('[data-report-export]'), () => monthReportData(reportMonth));
      const utilNav = e.target.closest('[data-util-month]');
      if (utilNav) {
        utilMonth = utilNav.dataset.utilMonth === '0' ? todayISO() : addMonths(utilMonth, Number(utilNav.dataset.utilMonth));
        history.replaceState(null, '', `#/yonetim?tab=doluluk&ay=${utilMonth.slice(0, 7)}`);
        return renderUtilization();
      }
      if (e.target.closest('[data-util-export]')) return openExportChoice(e.target.closest('[data-util-export]'), () => utilizationData(utilMonth));
      const closeNav = e.target.closest('[data-close-month]');
      if (closeNav) {
        closeMonth = closeNav.dataset.closeMonth === '0' ? addMonths(todayISO(), -1) : addMonths(closeMonth, Number(closeNav.dataset.closeMonth));
        return renderClosing();
      }
      const userRow = e.target.closest('[data-user]');
      if (userRow && e.target.closest('[data-review]')) return openReviewDialog(Store.user(userRow.dataset.user), closeMonth, render);
      if (userRow && e.target.closest('[data-dl]')) return exportMonthlyForm(Store.user(userRow.dataset.user), closeMonth).catch(err => toast(err.message, { tone: 'danger' }));
      if (userRow && e.target.closest('[data-print-form]')) return openPrintDialog(Store.user(userRow.dataset.user), closeMonth);
      const payNav = e.target.closest('[data-pay-month]');
      if (payNav) {
        payMonth = payNav.dataset.payMonth === '0' ? monthStart(addMonths(todayISO(), -1)) : addMonths(payMonth, Number(payNav.dataset.payMonth));
        history.replaceState(null, '', `#/yonetim?tab=prim&ay=${payMonth.slice(0, 7)}`);
        return renderPayroll();
      }
      if (e.target.closest('[data-pay-rates]')) return payRatesModal(render);
      if (e.target.closest('[data-pay-export]')) return openExportChoice(e.target.closest('[data-pay-export]'), () => payrollData(payMonth));
      const cFilter = e.target.closest('[data-contract-filter]');
      if (cFilter) { contractFilter = cFilter.dataset.contractFilter; return renderContracts(); }
      if (e.target.closest('[data-add-contract]')) return contractModal(null, render);
      if (e.target.closest('[data-contract-export]')) return openExportChoice(e.target.closest('[data-contract-export]'), contractsData);
      const cRow = e.target.closest('[data-contract]');
      if (cRow && e.target.closest('[data-edit-contract]')) return contractModal(Store.contract(cRow.dataset.contract), render);
      if (cRow && e.target.closest('[data-renew-contract]')) return contractModal(null, render, Store.contract(cRow.dataset.contract));
      if (cRow && e.target.closest('[data-del-contract]')) {
        const removed = Store.deleteContract(cRow.dataset.contract);
        const renewedFrom = Store.contracts().find(c => c.renewedTo === removed.id);
        if (renewedFrom) Store.updateContract(renewedFrom.id, { renewedTo: null });   // yenilemesi silinen sözleşme yeniden "aktif / bitti" olur
        render();
        return toast(`${removed.name} silindi`, {
          tone: 'info',
          action: { label: 'Geri al', fn: () => { Store.restoreContract(removed); if (renewedFrom) Store.updateContract(renewedFrom.id, { renewedTo: removed.id }); render(); } },
        });
      }
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
  const bal = u ? leaveBalance(u) : null;
  let perks = u ? perkHistory(u) : [];     // kaydedilene kadar burada düzenlenir
  const lastPerk = perks[perks.length - 1] || { bonus: false, car: false };
  const check = (name, on, title, text, disabled = false) => `<label class="opt-card"><input type="checkbox" name="${name}"${on ? ' checked' : ''}${disabled ? ' disabled' : ''}>
    <span><strong>${title}</strong><small>${text}</small></span></label>`;
  openModal({
    title: u ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı',
    body: `<form class="user-form" id="userForm" novalidate>
      ${u ? `<div class="user-id">${avatar(u, 42)}<div><strong>${esc(u.name)}</strong><small>${esc(u.title)}${u.startDate ? ` · ${tenureText(u)}` : ''}</small></div>
        ${u.active ? pill('Aktif', 'ok') : pill('Pasif', 'muted')}</div>` : ''}
      <div class="form-sec">
        <div class="form-sec-title">Kişi</div>
        <label class="field"><span class="field-label">Ad Soyad</span><input class="input" name="name" value="${esc(u?.name || '')}" maxlength="60"></label>
        <label class="field"><span class="field-label">Şirket e-postası</span>
          <span class="input-suffix"><input class="input" name="email" value="${esc(local)}" placeholder="ad.soyad" autocomplete="off"><span>@${COMPANY_DOMAIN}</span></span></label>
        <div class="form-2">
          <label class="field"><span class="field-label">Unvan</span><input class="input" name="title" value="${esc(u?.title || '')}" maxlength="60" placeholder="Örn. SAP BW Danışmanı"></label>
          <label class="field"><span class="field-label">Rol</span>
            <select class="input" name="role"${self ? ' disabled' : ''}><option value="consultant">Danışman</option><option value="admin"${u?.role === 'admin' ? ' selected' : ''}>Yönetici</option></select>
            ${self ? '<small class="field-hint">Kendi rolünü değiştiremezsin.</small>' : ''}</label>
        </div>
      </div>
      <div class="form-sec">
        <div class="form-sec-title">Çalışma</div>
        <div class="form-2">
          <label class="field"><span class="field-label">İşe giriş</span><input class="input" name="startDate" type="date" value="${u?.startDate || todayISO()}"></label>
          <label class="field"><span class="field-label">İşten çıkış <span class="faint">(varsa)</span></span><input class="input" name="endDate" type="date" value="${u?.endDate || ''}"></label>
        </div>
        ${u ? check('active', u.active, `Hesap aktif${self ? ' <span class="faint">· kendi hesabın</span>' : ''}`, 'Kapalıysa portala giriş yapamaz; kayıtları silinmez.', self) : ''}
      </div>
      <div class="form-sec">
        <div class="form-sec-title">İzin</div>
        <p class="form-sec-desc">${bal ? `Şu an kalan <b>${fmtNum(bal.remaining)} gün</b>${bal.next ? ` · sonraki hak ediş <b>${fmtDate(bal.next.date)}</b> (+${fmtNum(bal.next.days)})` : ''}. ` : ''}İzin işe girişten 1 yıl sonra ve her yıl işe giriş gününde eklenir.</p>
        <div class="form-2">
          <label class="field"><span class="field-label">Yıllık hak ediş</span>
            <span class="input-suffix"><input class="input" name="annualLeave" type="number" min="0" max="40" value="${u?.annualLeave ?? legalAnnualLeave(todayISO())}"><span>gün</span></span>
            <small class="field-hint" data-legal></small></label>
          <label class="field"><span class="field-label">Açılış bakiyesi</span>
            <span class="input-suffix"><input class="input" name="carryIn" type="number" step="0.5" min="-40" max="60" value="${u?.carryIn ?? 0}"><span>gün</span></span>
            <small class="field-hint">${fmtDate(LEAVE_START)} öncesinden kalan; eksi olabilir.</small></label>
        </div>
      </div>
      <div class="form-sec">
        <div class="form-sec-title">Yan haklar</div>
        <div class="opt-cards">
          ${check('bonusEligible', lastPerk.bonus, 'Prime tabi', 'Kıdemli danışman: faturalanabilir gün eşiği aşınca prim alır.')}
          ${check('carAllowance', lastPerk.car, 'Araba parası', 'Şirket aracı yerine her ay araba parası alır.')}
        </div>
        ${u ? `<label class="field" data-perk-when hidden><span class="field-label">Geçerlilik tarihi</span><input class="input" type="date" name="perkFrom" value="${monthStart(todayISO())}">
          <small class="field-hint">Değişiklik bu tarihten itibaren geçerli olur; önceki aylar değişmez. Prim, hakkın başladığı ayın tamamı için hesaplanır.</small></label>
        <div data-perk-history></div>` : '<p class="field-hint">Yeni kişide haklar işe giriş tarihinden itibaren geçerli olur.</p>'}
      </div>
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="userForm">Kaydet</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      el.name.focus();
      // Kıdeme göre yasal asgari izin; yeni kullanıcıda elle değiştirilmediyse tarihle birlikte güncellenir
      const legal = m.querySelector('[data-legal]');
      const showLegal = () => { legal.textContent = `Kıdeme göre yasal asgari ${legalAnnualLeave(el.startDate.value)} gün; şirket fazlasını veriyorsa onu yaz.`; };
      el.annualLeave.addEventListener('input', () => { el.annualLeave.dataset.touched = '1'; });
      el.startDate.addEventListener('change', () => {
        showLegal();
        if (!u && !el.annualLeave.dataset.touched) el.annualLeave.value = legalAnnualLeave(el.startDate.value);
      });
      showLegal();
      // Yan hak geçmişi: değişiklik tarihi yalnızca bir hak açılıp kapanınca sorulur; yanlış kayıt silinebilir (kaydedince işler)
      const when = m.querySelector('[data-perk-when]'), history = m.querySelector('[data-perk-history]');
      const latest = () => perks[perks.length - 1] || { bonus: false, car: false };
      const changed = () => latest().bonus !== el.bonusEligible.checked || latest().car !== el.carAllowance.checked;
      // Geçmiş her zaman görünür: kaydedilmemiş değişiklik en üstte önizlenir, yerini alacağı kayıtların üstü çizilir
      const perkText = p => [p.bonus && 'Prime tabi', p.car && 'Araba parası'].filter(Boolean).join(' · ') || 'Hak yok';
      const renderPerks = () => {
        if (!u) return;
        const draft = changed(), at = el.perkFrom.value;
        when.hidden = !draft;
        const next = draft ? `<li class="is-new"><span>${at ? fmtDate(at) : 'Tarih seç'} itibarıyla</span><b>${perkText({ bonus: el.bonusEligible.checked, car: el.carAllowance.checked })}</b>
          <small>kaydedince eklenir</small></li>` : '';
        const rows = perks.slice().reverse().map(p => `<li data-perk="${p.from}" class="${draft && at && p.from >= at ? 'is-replaced' : ''}">
          <span>${fmtDate(p.from)} itibarıyla</span><b>${perkText(p)}</b>
          <button class="icon-btn sm" type="button" data-del-perk title="Bu kaydı sil" aria-label="Bu kaydı sil">${icon('trash', 14)}</button></li>`).join('');
        history.innerHTML = `<div class="field-label">Hak geçmişi</div><ul class="perk-list">${next}${rows || (draft ? '' : '<li class="is-empty">Henüz yan hak kaydı yok</li>')}</ul>`;
      };
      renderPerks();
      el.bonusEligible.addEventListener('change', renderPerks);
      el.carAllowance.addEventListener('change', renderPerks);
      el.perkFrom?.addEventListener('change', renderPerks);
      history?.addEventListener('click', e => {
        const li = e.target.closest('[data-del-perk]')?.closest('[data-perk]');
        if (!li) return;
        perks = perks.filter(p => p.from !== li.dataset.perk);
        renderPerks();
      });
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
        if (!(carryIn >= -40 && carryIn <= 60)) return formError(f, 'Açılış bakiyesi −40 ile 60 gün arasında olmalı.', el.carryIn);
        if (el.endDate.value && el.endDate.value < el.startDate.value) return formError(f, 'İşten çıkış tarihi işe girişten önce olamaz.', el.endDate);
        // Yeni değer seçilen tarihten itibaren geçerli; o tarihten sonraki eski kayıtların yerini alır. İşe giriş değişirse ilk kayıt onunla kayar.
        const want = { bonus: el.bonusEligible.checked, car: el.carAllowance.checked };
        let list = u ? perks.map(p => (p.from === u.startDate ? { ...p, from: el.startDate.value } : p)) : [];
        if (!u) list = want.bonus || want.car ? [{ from: el.startDate.value, ...want }] : [];
        else if (changed()) {
          const at = el.perkFrom.value;
          if (!at) return formError(f, 'Yan hakkın geçerlilik tarihini seç.', el.perkFrom);
          if (at < el.startDate.value) return formError(f, 'Yan hakkın geçerlilik tarihi işe girişten önce olamaz.', el.perkFrom);
          list = list.filter(p => p.from < at);
          const prev = list[list.length - 1] || { bonus: false, car: false };
          if (prev.bonus !== want.bonus || prev.car !== want.car) list.push({ from: at, ...want });
        }
        const now = list[list.length - 1] || { bonus: false, car: false };
        const data = { name, email, title: el.title.value.trim() || 'Danışman', annualLeave, startDate: el.startDate.value, carryIn,
          endDate: el.endDate.value || null, perks: list, bonusEligible: now.bonus, carAllowance: now.car };
        // Hak değişirse geçmiş hak edişler eski değerle kalır; yoksa bakiye geriye dönük değişirdi
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

// Prim ve araba parası tutarları: yürürlük tarihiyle eklenir; her ay o tarihte geçerli tutarla hesaplanır, eski aylar değişmez
function payRatesModal(onSave) {
  const thisMonth = monthStart(todayISO());
  openModal({
    title: 'Prim ve araba parası tutarları',
    body: `<div class="form-stack">
      <div data-rate-list></div>
      <form class="form-stack rate-form" id="rateForm" novalidate>
        <div class="sub-head">Yeni tutar ekle</div>
        <p class="muted small-text">Alanlar son tutarla dolu gelir; yalnızca değişeni düzelt. Yürürlük için ayın 1'ini seç: tutar o aydan itibaren uygulanır, önceki aylar değişmez.</p>
        <div class="form-grid rate-grid">
          <label class="field"><span class="field-label">Yürürlük tarihi</span><input class="input" type="date" name="from" value="${thisMonth}"></label>
          <label class="field"><span class="field-label">Eşik</span><span class="input-suffix"><input class="input" name="threshold" type="number" min="0" max="31" step="1" placeholder="Örn. 17"><span>gün</span></span></label>
          <label class="field"><span class="field-label">Günlük prim</span><span class="input-suffix"><input class="input" name="daily" inputmode="decimal" placeholder="0,00"><span>₺</span></span></label>
          <label class="field"><span class="field-label">Araba parası</span><span class="input-suffix"><input class="input" name="car" inputmode="decimal" placeholder="0,00"><span>₺ / ay</span></span></label>
        </div>
        <p class="form-error" hidden></p>
        <div class="row-gap"><button class="btn primary" type="submit">${icon('plus', 15)} Ekle</button><span class="faint small-text">Tutarlar yalnızca bu portalda ve yedek dosyasında tutulur.</span></div>
      </form>
    </div>`,
    footer: '<span class="grow"></span><button class="btn ghost" data-close>Kapat</button>',
    onMount(m) {
      const list = m.querySelector('[data-rate-list]'), f = m.querySelector('form'), el = f.elements;
      const fill = () => {
        const last = Store.payRates().slice(-1)[0];
        el.from.value = thisMonth;
        el.threshold.value = last ? last.bonusThreshold : '';
        el.daily.value = last ? MONEY.format(last.bonusDaily) : '';
        el.car.value = last ? MONEY.format(last.carMonthly) : '';
      };
      const renderList = () => {
        const rates = Store.payRates(), current = payRateFor(thisMonth);
        const state = r => (r.id === current?.id ? pill('Şu an geçerli', 'ok') : r.from > thisMonth ? pill('Planlı', 'info') : pill('Eski', 'muted'));
        list.innerHTML = rates.length ? `<div class="table-wrap"><table class="table rate-table"><thead><tr><th>Yürürlük</th><th class="num">Eşik</th><th class="num">Günlük prim</th><th class="num">Araba parası</th><th></th><th></th></tr></thead>
          <tbody>${rates.slice().reverse().map(r => `<tr data-rate="${r.id}" class="${r.id !== current?.id && r.from <= thisMonth ? 'is-past' : ''}">
            <td class="nowrap"><strong>${fmtDate(r.from)}</strong></td><td class="num">${fmtNum(r.bonusThreshold)} gün</td><td class="num nowrap">${fmtMoney(r.bonusDaily)}</td><td class="num nowrap">${fmtMoney(r.carMonthly)}</td>
            <td>${state(r)}</td>
            <td class="num"><button class="icon-btn sm" type="button" data-del-rate title="Sil" aria-label="Sil">${icon('trash', 15)}</button></td>
          </tr>`).join('')}</tbody></table></div>` : emptyState('wallet', 'Henüz tutar girilmemiş', 'Aşağıdan eşik, günlük prim ve araba parasını yürürlük tarihiyle ekle.');
      };
      renderList();
      fill();
      list.addEventListener('click', e => {
        const row = e.target.closest('[data-rate]');
        if (!row || !e.target.closest('[data-del-rate]')) return;
        Store.deletePayRate(row.dataset.rate);
        renderList();
        onSave();
      });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const threshold = Number(el.threshold.value), daily = parseAmount(el.daily.value), car = parseAmount(el.car.value || '0');
        if (!el.from.value) return formError(f, 'Yürürlük tarihini seç.', el.from);
        if (Store.payRates().some(r => r.from === el.from.value)) return formError(f, 'Bu tarihte zaten bir tutar var; önce onu sil.', el.from);
        if (el.threshold.value === '' || !(threshold >= 0 && threshold <= 31)) return formError(f, 'Eşik 0–31 gün arasında olmalı.', el.threshold);
        if (!(daily >= 0 && daily <= 1000000)) return formError(f, 'Günlük prim tutarını yaz (ör. 1.500,00).', el.daily);
        if (!(car >= 0 && car <= 1000000)) return formError(f, 'Araba parası tutarını yaz ya da boş bırak.', el.car);
        Store.addPayRate({ from: el.from.value, bonusThreshold: threshold, bonusDaily: daily, carMonthly: car });
        f.querySelector('.form-error').hidden = true;
        fill();
        renderList();
        onSave();
        toast('Tutar eklendi');
      });
    },
  });
}

// Yenilemede yeni dönem: ay başından ay sonuna giden sözleşme aynı sayıda ay uzar, diğerleri aynı gün sayısı kadar.
// Addaki yıl da ilerletilir ("2026 Destek" → "2027 Destek").
function renewalDraft(c) {
  const start = addDays(c.end, 1), wholeMonths = c.start === monthStart(c.start) && c.end === monthEnd(c.end);
  const months = (parseISO(c.end).getFullYear() - parseISO(c.start).getFullYear()) * 12 + parseISO(c.end).getMonth() - parseISO(c.start).getMonth() + 1;
  const end = wholeMonths ? addDays(addMonths(start, months), -1) : addDays(start, daysBetween(c.start, c.end));
  const name = c.name.replace(c.start.slice(0, 4), start.slice(0, 4));
  return { ...c, id: null, renewedTo: null, start, end, name, note: '' };
}

// Sözleşme ekle / düzenle / yenile. Saat havuzu girilirse en az bir proje bağlanmalı (kullanılan saat oradan gelir).
function contractModal(c, onSave, renewFrom = null) {
  const src = c || (renewFrom && renewalDraft(renewFrom));
  const customers = Store.customers().filter(x => !x.internal).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const start = src?.start || monthStart(todayISO()), end = src?.end || addDays(addMonths(start, 12), -1);
  openModal({
    title: renewFrom ? `Yenile · ${renewFrom.name}` : c ? 'Sözleşmeyi düzenle' : 'Sözleşme ekle',
    body: `<form class="form-stack" id="contractForm" novalidate>
      <div class="form-grid">
        <label class="field"><span class="field-label">Müşteri</span>
          <select class="input" name="customerId">${customers.map(x => `<option value="${x.id}"${src?.customerId === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Sözleşme adı</span><input class="input" name="name" maxlength="80" value="${esc(src?.name || '')}" placeholder="Örn. 2027 Destek Sözleşmesi"></label>
        <label class="field"><span class="field-label">Başlangıç</span><input class="input" type="date" name="start" value="${start}"></label>
        <label class="field"><span class="field-label">Bitiş</span><input class="input" type="date" name="end" value="${end}"></label>
        <label class="field"><span class="field-label">Saat havuzu <span class="faint">(isteğe bağlı)</span></span><input class="input" name="hours" type="number" min="1" max="100000" step="1" value="${src?.hours || ''}" placeholder="Örn. 500"></label>
        <label class="field"><span class="field-label">Hatırlatma <span class="faint">(bitişten kaç gün önce)</span></span><input class="input" name="noticeDays" type="number" min="1" max="365" value="${src?.noticeDays ?? 60}"></label>
      </div>
      <div class="field"><span class="field-label">Bağlı projeler <span class="faint">(bu projelere yazılan saat havuzdan düşer)</span></span><div class="chips" data-projects></div></div>
      <div class="field"><span class="field-label">Yenileme</span>
        <div class="seg">${Object.entries(CONTRACT_RENEWAL).map(([k, label]) => `<input type="radio" name="renewal" id="cr-${k}" value="${k}"${(src?.renewal || 'manuel') === k ? ' checked' : ''}><label for="cr-${k}">${label}</label>`).join('')}</div></div>
      <label class="field"><span class="field-label">Not <span class="faint">(isteğe bağlı)</span></span><input class="input" name="note" maxlength="200" value="${esc(src?.note || '')}" placeholder="Örn. fesih bildirimi 30 gün önce yazılı"></label>
      ${renewFrom ? `<p class="muted small-text">${esc(renewFrom.name)} geçmişte kalır ve artık bitiş uyarısı vermez.</p>` : ''}
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="contractForm">${renewFrom ? 'Yenile' : c ? 'Kaydet' : 'Ekle'}</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      let chosen = new Set(src?.projectIds || []);
      const renderProjects = () => {
        const projects = Store.projects({ customerId: el.customerId.value });
        m.querySelector('[data-projects]').innerHTML = projects.length ? projects.map(p => `<label class="chip"><input type="checkbox" name="projectIds" value="${p.id}"${chosen.has(p.id) ? ' checked' : ''}><span>${esc(p.name)} · ${esc(p.code)}</span></label>`).join('')
          : '<span class="muted small-text">Bu müşterinin projesi yok.</span>';
      };
      el.customerId.addEventListener('change', () => { chosen = new Set(); renderProjects(); });
      renderProjects();
      el.name.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const hours = el.hours.value ? Number(el.hours.value) : null, noticeDays = Number(el.noticeDays.value);
        const data = {
          customerId: el.customerId.value, name: el.name.value.trim(), start: el.start.value, end: el.end.value, hours, noticeDays,
          projectIds: [...f.querySelectorAll('[name=projectIds]:checked')].map(x => x.value), renewal: el.renewal.value, note: el.note.value.trim(),
        };
        if (!data.name) return formError(f, 'Sözleşmenin adını yaz.', el.name);
        if (!data.start || !data.end || data.end < data.start) return formError(f, 'Tarihleri kontrol et: bitiş başlangıçtan önce olamaz.', el.end);
        if (hours != null && !(hours >= 1 && hours <= 100000)) return formError(f, 'Saat havuzu 1–100.000 arasında olmalı ya da boş bırakılmalı.', el.hours);
        if (!(noticeDays >= 1 && noticeDays <= 365)) return formError(f, 'Hatırlatma 1–365 gün arasında olmalı.', el.noticeDays);
        if (hours && !data.projectIds.length) return formError(f, 'Saat havuzu için en az bir proje bağla; kullanılan saat oradan hesaplanır.');
        const clash = contractClash(data, c?.id);
        if (clash) return formError(f, `${clash.projects.map(pid => Store.project(pid).code).join(', ')} aynı dönemde “${clash.contract.name}” sözleşmesinde (${fmtDate(clash.contract.start)} – ${fmtDate(clash.contract.end)}). Tarihleri ya da projeleri değiştir.`);
        if (c) {
          Store.updateContract(c.id, data);
          close();
          onSave();
          return toast('Sözleşme güncellendi');
        }
        const created = Store.addContract(data);
        if (renewFrom) Store.updateContract(renewFrom.id, { renewedTo: created.id });
        close();
        onSave();
        toast(renewFrom ? `${renewFrom.name} yenilendi · ${fmtDate(created.start)} – ${fmtDate(created.end)}` : `${created.name} eklendi`, {
          action: { label: 'Geri al', fn: () => { Store.deleteContract(created.id); if (renewFrom) Store.updateContract(renewFrom.id, { renewedTo: null }); onSave(); } },
        });
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

// Tatiller listesinde köprü özeti: kim tam / yarım gün çalışıyor (yarım gün köprüde "yarım" = çalışıyor)
function bridgeSummary(h) {
  const names = mode => Object.entries(h.work || {}).filter(([, w]) => (h.half ? 'full' : w) === mode).map(([id]) => firstName(Store.user(id)?.name || '?'));
  const full = names('full'), half = h.half ? [] : names('half');
  if (!full.length && !half.length) return 'Herkesin yıllık izninden düşer';
  return [full.length && `${h.half ? 'Çalışacak' : 'Tam gün çalışacak'}: ${full.join(', ')}`, half.length && `Yarım gün: ${half.join(', ')}`]
    .filter(Boolean).join(' · ') + ' · diğerlerinin izninden düşer';
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
      <div class="field" data-half-wrap><span class="field-label">Süre</span>
        <div class="seg"><input type="radio" name="dur" id="hd-full" value="full"${h?.half ? '' : ' checked'}><label for="hd-full">Tam gün</label><input type="radio" name="dur" id="hd-half" value="half"${h?.half ? ' checked' : ''}><label for="hd-half">Yarım gün</label></div>
      </div>
      <div class="callout info" data-pair hidden></div>
      ${h ? '' : '<label class="toggle"><input type="checkbox" name="eve"> Önceki gün arife olarak eklensin (yarım gün)</label>'}
      <p class="muted small-text" data-kind-hint></p>
      <div class="field" data-workers-wrap><span class="field-label">Kim çalışacak? <span class="faint">(danışman kendisi de seçebilir)</span></span>
        <div class="work-pick">${Store.users().filter(x => x.active).sort((a, b) => a.name.localeCompare(b.name, 'tr')).map(x => `<label class="work-row"><span>${esc(x.name)}</span>
          <select class="input" name="work" data-user="${x.id}"><option value="">İzinli · tamamı düşer</option>
            <option value="half"${h?.work?.[x.id] === 'half' ? ' selected' : ''}>Yarım gün çalışır · yarısı düşer</option>
            <option value="full"${h?.work?.[x.id] === 'full' ? ' selected' : ''}>Tam gün çalışır · düşmez</option></select></label>`).join('')}</div>
      </div>
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
        const days = dates(), multi = days.length > 1;
        // O gün zaten yarım gün tatilse (ör. arife öğleden sonra) bu kayıt diğer yarıyı kapsar: birlikte tam gün olur
        const pair = !multi && days.length ? Store.holidaysOn(days[0]).find(x => x.id !== h?.id && x.half) : null;
        m.querySelector('[data-half-wrap]').hidden = multi || !!pair;
        if (multi) el.dur.value = 'full';
        if (pair) el.dur.value = 'half';
        const pairBox = m.querySelector('[data-pair]');
        pairBox.hidden = !pair;
        pairBox.innerHTML = pair ? `${icon('info', 16)}<div>${fmtDate(pair.date)} zaten yarım gün tatil (<strong>${esc(pair.name)}</strong>). Bu kayıt günün diğer yarısını kapsar; ikisi birlikte <strong>tam gün</strong> tatil olur.</div>` : '';
        m.querySelector('[data-kind-hint]').textContent = {
          resmi: 'Resmi tatilde hedef saat düşer; o günlere denk gelen izin bakiyeden düşülmez.',
          sirket: 'Şirket tatilinde hedef saat düşer ve kimsenin yıllık izninden düşülmez.',
          kopru: 'Köprü izninde şirket kapalıdır ve herkesin yıllık izninden düşer. Çalışacak olanları aşağıdan işaretle ya da danışman portaldan "Bu gün çalışacağım" desin; onların izninden düşmez, o gün normal iş günüdür.',
        }[el.kind.value];
        m.querySelector('[data-workers-wrap]').hidden = el.kind.value !== 'kopru';
        // Yarım gün köprüde "yarım gün çalışır" köprünün tamamıdır: yalnızca izinli / çalışır kalır
        const halfBridge = !multi && el.dur.value === 'half';
        f.querySelectorAll('[name=work]').forEach(s => {
          s.querySelector('[value=half]').hidden = halfBridge;
          s.querySelector('[value=full]').textContent = halfBridge ? 'Çalışır · düşmez' : 'Tam gün çalışır · düşmez';
          if (halfBridge && s.value === 'half') s.value = 'full';
        });
      };
      f.addEventListener('input', sync);
      f.addEventListener('change', sync);
      sync();
      el.name.focus();

      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = el.name.value.trim(), kind = el.kind.value, days = dates();
        // Kişi başına seçim yalnızca köprüde: { userId: 'half' | 'full' }, izinliler yazılmaz
        const work = kind === 'kopru' ? Object.fromEntries([...f.querySelectorAll('[name=work]')].filter(s => s.value).map(s => [s.dataset.user, s.value])) : {};
        if (!name) return formError(f, 'Tatilin adını yaz.', el.name);
        if (!days.length) return formError(f, 'Tarihleri kontrol et: bitiş başlangıçtan önce olamaz.', el.start);
        if (days.length > 15) return formError(f, 'Tek seferde en fazla 15 gün girilebilir.', el.end);
        const half = days.length === 1 && el.dur.value === 'half';
        // Bir güne tek tatil ya da iki yarım tatil düşebilir
        const clash = days.map(d => Store.holidaysOn(d).filter(x => x.id !== h?.id))
          .find(others => others.length && !(others.length === 1 && others[0].half && half));
        if (clash) return formError(f, `${fmtDate(clash[0].date)} tarihinde zaten “${clash.map(x => x.name).join(' + ')}” var.`, el.start);

        if (h) {
          Store.updateHoliday(h.id, { name, kind, date: days[0], half, work });
          close();
          onSave();
          return toast(`${name} güncellendi${closedPeriodsNote([h.date, days[0]])}`);
        }
        const added = [];
        const eve = addDays(days[0], -1);
        if (el.eve.checked && !Store.holiday(eve)) added.push(Store.addHoliday({ date: eve, name: `${name} Arifesi`, kind, half: true, work }));
        days.forEach(date => added.push(Store.addHoliday({ date, name, kind, half, work })));
        close();
        onSave();
        toast(`${name} eklendi · ${added.length} gün${closedPeriodsNote(added.map(x => x.date))}`, {
          action: { label: 'Geri al', fn: () => { added.forEach(x => Store.deleteHoliday(x.id)); onSave(); } },
        });
      });
    },
  });
}
