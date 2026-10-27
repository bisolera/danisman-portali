/* Aktiviteler: günlük giriş, haftalık tablo, aylık takvim ve Excel ile toplu giriş.
   Klavye — günlük: ← → gün, N yeni kayıt · tablo: Enter/↑↓ satır, ← → hücre · boştayken ← → hafta/ay */

const ACTIVITY_MODES = [['gun', 'Günlük', 'list'], ['tablo', 'Haftalık', 'grid'], ['ay', 'Aylık', 'calendar']];

const ActivitiesView = {
  mount(el, { query }) {
    const me = App.user;
    let selected = /^\d{4}-\d{2}-\d{2}$/.test(query.d || '') ? query.d : todayISO();
    const wanted = query.v || Prefs.get(me.id).activityMode;
    let mode = ACTIVITY_MODES.some(([k]) => k === wanted) ? wanted : 'gun';
    const gridRows = {};   // hafta (pazartesi) → tablodaki projeler; sıra korunur ki yazarken satırlar kaymasın
    const rowMeta = {};    // proje → tablodan açılan yeni kayıtların türü ve açıklaması
    let gridPicker = null, savedTimer = null;

    el.innerHTML = `
      <header class="page-head">
        <div><h1>Aktiviteler</h1><p>Gününü gir, haftanı ve ayını takip et.</p></div>
        <div class="row-gap">
          <button class="btn ghost" data-import>${icon('upload', 16)} Excel’den yükle</button>
          <button class="btn ghost" data-export>${icon('download', 16)} Dışa aktar</button>
        </div>
      </header>
      <div class="act-toolbar">
        <div class="tabs">${ACTIVITY_MODES.map(([k, label, ic]) => `<button data-mode="${k}">${icon(ic, 15)} ${label}</button>`).join('')}</div>
        <div class="week-nav">
          <button class="icon-btn bordered" data-nav="prev" aria-label="Önceki">${icon('chevron-left')}</button>
          <div class="week-label" id="periodLabel"></div>
          <button class="icon-btn bordered" data-nav="next" aria-label="Sonraki">${icon('chevron-right')}</button>
          <button class="btn ghost sm" data-nav="today">Bugün</button>
        </div>
      </div>
      <div id="dayMode">
        <section class="day-strip" id="days"></section>
        <div class="day-layout">
          <!-- Günün kayıtları ve yeni kayıt aynı kartta: önce ne girdiğini gör, hemen altına ekle -->
          <section class="card day-panel">
            <div id="dayHead"></div>
            <div id="dayList"></div>
            <div class="composer">
              <div id="entryForm"></div>
              <div class="lock-banner" id="lockBanner" hidden></div>
              <p class="kbd-hint composer-hint" id="composerHint"><kbd>Enter</kbd> kaydet · <kbd>←</kbd><kbd>→</kbd> gün değiştir · <kbd>N</kbd> yeni kayıt</p>
            </div>
          </section>
          <aside class="card cal-panel" id="calCard"></aside>
        </div>
      </div>
      <section class="card" id="gridCard"></section>
      <section class="card" id="monthCard"></section>`;

    const gridCard = el.querySelector('#gridCard'), monthCard = el.querySelector('#monthCard');

    const form = createEntryForm(el.querySelector('#entryForm'), {
      userId: me.id,
      initial: { date: selected },
      showDate: false,   // gün yukarıdaki kutulardan seçilir
      onSubmit(data, f) {
        Store.addActivity({ userId: me.id, ...data });
        if (data.date !== selected) select(data.date, { fromForm: true }); else renderAll();
        f.reset();
        const total = hoursOn(me.id, data.date), target = dailyTarget(me.id, data.date);
        if (total > 12) toast(`${fmtShort(data.date)} toplamı ${fmtHours(total)} oldu — kontrol etmek ister misin?`, { tone: 'warn' });
        else toast(`${fmtHours(data.hours)} eklendi · gün toplamı ${fmtNum(total)}${target ? ` / ${fmtNum(target)}` : ''} sa`);
      },
    });

    /* ---------- Durum ve gezinme ---------- */

    const updateHash = () => history.replaceState(null, '', `#/aktiviteler?d=${selected}&v=${mode}`);

    function select(iso, { fromForm = false } = {}) {
      selected = iso;
      if (!fromForm) form.setDate(iso);
      updateHash();
      renderAll();
    }

    function setMode(m) {
      mode = m;
      Prefs.set(me.id, { activityMode: m });
      updateHash();
      renderAll();
    }

    function step(dir) {
      if (mode === 'ay') select(addMonths(selected, dir));
      else select(addDays(selected, 7 * dir));
    }

    function renderHeader() {
      const label = el.querySelector('#periodLabel');
      if (mode === 'ay') {
        const s = monthSummary(me.id, selected);
        label.innerHTML = `<strong>${monthTitle(selected)}</strong><small>${fmtNum(s.logged)} / ${fmtNum(s.target)} sa</small>`;
        return null;
      }
      const week = weekSummary(me.id, weekStart(selected));
      label.innerHTML = `<strong>${fmtRange(week.days[0], week.days[6])}</strong><small>${fmtNum(week.logged)} / ${fmtNum(week.target)} sa</small>`;
      return week;
    }

    function renderAll() {
      el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
      el.querySelector('#dayMode').hidden = mode !== 'gun';
      gridCard.hidden = mode !== 'tablo';
      monthCard.hidden = mode !== 'ay';
      const week = renderHeader();
      if (mode === 'gun') {
        const locked = isLocked(me.id, selected);
        el.querySelector('#entryForm').hidden = locked;
        el.querySelector('#composerHint').hidden = locked;
        const banner = el.querySelector('#lockBanner');
        banner.hidden = !locked;
        if (locked) banner.innerHTML = `${icon('lock', 18)}<div><strong>${esc(lockMessage(me.id, selected))}</strong><p>Bu ayın kayıtları değiştirilemez.</p></div>
          <button class="btn ghost sm" data-mode="ay">${icon('calendar', 15)} Ay kapanışına git</button>`;
        renderDays(week);
        el.querySelector('#calCard').innerHTML = calendarCardHtml(me, selected);
        renderDay();
        form.refresh();
      } else if (mode === 'tablo') renderGrid(week);
      else renderMonth();
    }

    /* ---------- Günlük görünüm ---------- */

    function renderDays(week) {
      const today = todayISO();
      el.querySelector('#days').innerHTML = week.days.map(d => {
        const { target, logged, status } = dayStatus(me.id, d, today);
        const off = target === 0 ? dayOffReason(me.id, d) : null;
        const half = getHoliday(d)?.half;
        const cls = { full: 'is-complete', partial: 'is-partial', planned: 'is-partial', missing: 'is-missing', off: 'is-off', extra: 'is-off' }[status] || '';
        const pct = target ? Math.min(100, (logged / target) * 100) : logged ? 100 : 0;
        const tag = isLocked(me.id, d) ? `<span class="day-tag lock" title="Kilitli">${icon('lock', 11)}</span>`
          : d === today ? '<span class="day-tag">Bugün</span>' : half ? '<span class="day-tag half">½ gün</span>' : '';
        return `<button class="day ${cls}${d === selected ? ' is-selected' : ''}${d === today ? ' is-today' : ''}" data-day="${d}" title="${esc(off || getHoliday(d)?.name || fmtDate(d, { weekday: true }))}">
          <span class="day-top"><span class="day-name">${dayName(d, true)}</span>${tag}</span>
          <span class="day-date">${parseISO(d).getDate()} <small>${TR_MONTHS_SHORT[parseISO(d).getMonth()]}</small></span>
          <span class="meter"><span style="width:${pct}%"></span></span>
          <span class="day-hours">${off && !logged ? esc(off) : `${fmtNum(logged)}${target ? ` / ${fmtNum(target)}` : ''} sa`}</span>
        </button>`;
      }).join('');
    }

    function statusText(target, logged) {
      const off = dayOffReason(me.id, selected), holiday = getHoliday(selected);
      if (target === 0) return off || 'Çalışma günü değil';
      const prefix = holiday?.half ? `${holiday.name} · ` : '';
      if (logged >= target) return `${prefix}Gün tamamlandı ✓`;
      return `${prefix}${fmtNum(target - logged)} sa eksik · hedef ${fmtNum(target)} sa`;
    }

    function renderDay() {
      const items = Store.activities({ userId: me.id, from: selected, to: selected }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const target = dailyTarget(me.id, selected), logged = sum(items, a => a.hours);
      const source = !items.length && target > 0 && !isLocked(me.id, selected) ? findCopySource(me.id, selected) : null;
      const tone = target === 0 ? '' : logged >= target ? 'is-ok' : logged > 0 ? 'is-partial' : '';
      el.querySelector('#dayHead').innerHTML = `
        <div class="day-panel-head">
          <div class="min0"><h2>${fmtDate(selected, { weekday: true, year: false })}</h2><p class="sub">${esc(statusText(target, logged))}</p></div>
          <span class="day-total ${tone}">${fmtNum(logged)}${target ? `<small> / ${fmtNum(target)} sa</small>` : '<small> sa</small>'}</span>
        </div>`;
      el.querySelector('#dayList').innerHTML = items.length
        ? `<div class="list">${items.map(a => activityRow(a)).join('')}</div>`
        : `<div class="day-empty">${icon('inbox', 16)}<span>${target ? 'Bu gün için henüz kayıt yok.' : 'Bu gün çalışma günü değil.'}</span>
            ${source ? `<button class="btn ghost sm" data-copy-day>${icon('copy', 15)} ${dayName(source.date, true)} ${fmtShort(source.date)} gününü kopyala <span class="muted">(${fmtHours(source.total)})</span></button>` : ''}</div>`;
    }

    function copyPreviousDay() {
      const src = findCopySource(me.id, selected);
      if (!src) return;
      const created = src.items.map(a => Store.addActivity({ userId: me.id, projectId: a.projectId, date: selected, hours: a.hours, type: a.type, note: a.note })).filter(Boolean);
      renderAll();
      toast(`${created.length} kayıt kopyalandı (${fmtHours(src.total)})`, {
        action: { label: 'Geri al', fn: () => { created.forEach(a => Store.deleteActivity(a.id)); renderAll(); } },
      });
    }

    /* ---------- Haftalık tablo (CATS tarzı) ---------- */

    function gridRowIds(monday, items) {
      if (!gridRows[monday]) {
        // Boş haftada son kullanılan projelerle başla ki doğrudan saat yazılabilsin
        gridRows[monday] = items.length ? [] : recentProjectIds(me.id).filter(id => Store.project(id)?.status === 'aktif').slice(0, 3);
      }
      items.forEach(a => { if (!gridRows[monday].includes(a.projectId)) gridRows[monday].push(a.projectId); });
      return gridRows[monday];
    }

    function metaFor(pid, items) {
      if (!rowMeta[pid]) {
        const counts = {};
        items.filter(a => a.projectId === pid).forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
        const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        rowMeta[pid] = { type: common ? common[0] : Prefs.get(me.id).lastType || ACTIVITY_TYPES[0].id, note: '' };
      }
      return rowMeta[pid];
    }

    // Hafta sonu yalnızca istenirse ya da o hafta hafta sonuna kayıt girildiyse gösterilir
    function gridDays(week, items) {
      const weekend = Prefs.get(me.id).gridWeekend || items.some(a => isWeekend(a.date));
      return weekend ? week.days : week.days.slice(0, 5);
    }

    // Sütun başlığındaki kısa etiket: hedef saat, ½ gün, tatil, izin ya da kilit
    function dayColumnNote(d) {
      if (isLocked(me.id, d)) return icon('lock', 11);
      const t = dailyTarget(me.id, d), holiday = getHoliday(d);
      if (t > 0) return holiday?.half ? '½ gün' : `${fmtNum(t)} sa`;
      if (holiday) return 'Tatil';
      return isWeekend(d) ? '—' : 'İzin';
    }

    function renderGrid(week) {
      const today = todayISO(), monday = week.days[0];
      const items = Store.activities({ userId: me.id, from: monday, to: week.days[6] });
      const pids = gridRowIds(monday, items), days = gridDays(week, items);
      const weekendForced = items.some(a => isWeekend(a.date));
      gridCard.innerHTML = `
        <div class="grid-bar">
          <p class="muted">Hücreye saati yaz; <kbd>Tab</kbd> / <kbd>Enter</kbd> ile ilerle. Excel’den kopyaladığın saatleri yapıştırabilirsin.</p>
          <div class="row-gap">
            <span class="save-state" data-saved>${icon('check', 14)} Kaydedildi</span>
            <label class="toggle small"><input type="checkbox" data-weekend${days.length === 7 ? ' checked' : ''}${weekendForced ? ' disabled' : ''}> Hafta sonu</label>
          </div>
        </div>
        ${pids.length ? `<div class="table-wrap"><table class="table grid-table">
          <thead><tr>
            <th class="sticky-col">Proje</th>
            ${days.map(d => {
              const off = dailyTarget(me.id, d) === 0, title = isLocked(me.id, d) ? lockMessage(me.id, d) : off ? dayOffReason(me.id, d) : '';
              return `<th class="day-col${off ? ' is-off' : ''}${d === today ? ' is-today' : ''}"${title ? ` title="${esc(title)}"` : ''}>${dayName(d, true)} ${parseISO(d).getDate()}<span class="day-target">${dayColumnNote(d)}</span></th>`;
            }).join('')}
            <th class="num">Toplam</th><th></th>
          </tr></thead>
          <tbody>${pids.map((pid, r) => gridRow(pid, r, days, items)).join('')}</tbody>
          <tfoot><tr><td class="sticky-col">Gün toplamı</td>${days.map(d => `<td class="num" data-daytotal="${d}"></td>`).join('')}<td class="num" data-grandtotal></td><td></td></tr></tfoot>
        </table></div>` : emptyState('grid', 'Bu hafta için satır yok', 'Aşağıdan bir proje seçerek başla.')}
        <div class="grid-foot"><div class="grid-add"></div><span class="grid-hint">${icon('plus', 14)} Satır eklemek için proje seç</span></div>`;
      gridPicker = createProjectPicker(gridCard.querySelector('.grid-add'), { userId: me.id, onChange: addGridRow });
      if (pids.length) updateGridTotals();
    }

    // Satır: proje adı + (müşteri · tür seçici · not). Not, istenince satırın altında açılır.
    function gridRow(pid, r, days, items) {
      const p = Store.project(pid), c = Store.customer(p.customerId), meta = metaFor(pid, items);
      const active = p.status === 'aktif';
      const noteRow = meta.open ? `<tr class="note-row" data-pid="${pid}"><td colspan="${days.length + 3}">
          <input class="input" data-meta="note" value="${esc(meta.note)}" maxlength="${NOTE_MAX}" placeholder="${esc(p.name)} satırından girilen yeni saatlere yazılacak açıklama">
        </td></tr>` : '';
      return `<tr data-pid="${pid}"${active ? '' : ' class="is-inactive"'}>
        <td class="sticky-col">
          <div class="grid-proj"><span class="dot" style="background:${c.color}"></span><span class="min0">
            <strong>${esc(p.name)}</strong>
            <span class="grid-sub"><span>${esc(c.name)}</span>
              <span class="grid-opt">·
                <select class="tag-select" data-meta="type" aria-label="Yeni hücrelerin türü">${ACTIVITY_TYPES.map(t => `<option value="${t.id}"${t.id === meta.type ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select> ·
                <button type="button" class="link-btn" data-note-toggle>${meta.note ? `${icon('pencil', 12)} not` : '+ not'}</button>
              </span>
            </span>
          </span></div>
        </td>
        ${days.map((d, ci) => {
          const list = items.filter(a => a.projectId === pid && a.date === d), h = sum(list, a => a.hours);
          const monthLocked = isLocked(me.id, d), multi = list.length > 1 && !monthLocked;
          const readonly = monthLocked || multi || (!active && !h);
          const title = monthLocked ? lockMessage(me.id, d) : multi ? `${list.length} kayıt var — günlük görünümde aç` : !active && !h ? 'Proje aktif değil' : '';
          return `<td class="gcell${dailyTarget(me.id, d) === 0 ? ' is-off' : ''}"><input class="ginput${h ? ' has-val' : ''}${multi ? ' is-multi' : ''}${monthLocked ? ' is-locked' : ''}" data-r="${r}" data-c="${ci}" data-date="${d}" value="${h ? fmtNum(h) : ''}" inputmode="decimal" autocomplete="off"${readonly ? ' readonly' : ''}${title ? ` title="${esc(title)}"` : ''} aria-label="${esc(p.name)}, ${fmtDate(d)}"></td>`;
        }).join('')}
        <td class="num"><strong data-rowtotal="${pid}"></strong></td>
        <td class="row-del"><button class="icon-btn sm" data-delrow="${pid}" title="Satırı kaldır" aria-label="Satırı kaldır">${icon('x', 15)}</button></td>
      </tr>${noteRow}`;
    }

    function updateGridTotals() {
      renderHeader();
      const today = todayISO(), monday = weekStart(selected);
      const items = Store.activities({ userId: me.id, from: monday, to: addDays(monday, 6) });
      gridCard.querySelectorAll('[data-rowtotal]').forEach(e => {
        const h = sum(items.filter(a => a.projectId === e.dataset.rowtotal), a => a.hours);
        e.textContent = h ? fmtNum(h) : '–';
      });
      gridCard.querySelectorAll('[data-daytotal]').forEach(e => {
        const d = e.dataset.daytotal, t = dailyTarget(me.id, d), h = sum(items.filter(a => a.date === d), a => a.hours);
        e.textContent = t ? `${fmtNum(h)} / ${fmtNum(t)}` : h ? fmtNum(h) : '–';
        e.className = `num ${t === 0 ? '' : h >= t ? 'dt-ok' : h > 0 ? 'dt-partial' : d < today ? 'dt-miss' : ''}`;
      });
      const grand = gridCard.querySelector('[data-grandtotal]');
      if (grand) grand.textContent = `${fmtNum(sum(items, a => a.hours))} / ${fmtNum(weekSummary(me.id, monday).target)}`;
    }

    function flashSaved() {
      const s = gridCard.querySelector('[data-saved]');
      if (!s) return;
      s.classList.add('show');
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => s.classList.remove('show'), 1400);
    }

    // Hücredeki değeri kayda çevirir: boş/0 → sil, tek kayıt → güncelle, kayıt yoksa → ekle
    function setCell(input, { quiet = false } = {}) {
      if (input.readOnly) return 'same';
      const pid = input.closest('tr').dataset.pid, date = input.dataset.date;
      const list = Store.activities({ userId: me.id, from: date, to: date, projectId: pid });
      const prev = sum(list, a => a.hours);
      const raw = input.value.trim();
      const h = raw ? Math.round(parseHours(raw) * 4) / 4 : 0;
      const show = v => { input.value = v ? fmtNum(v) : ''; input.classList.toggle('has-val', v > 0); };
      if (Number.isNaN(h) || h < 0 || h > 24) {
        show(prev);
        input.classList.add('is-invalid');
        setTimeout(() => input.classList.remove('is-invalid'), 1500);
        if (!quiet) toast('Süreyi saat olarak yaz: 2, 1,5 ya da 1:30', { tone: 'warn' });
        return 'invalid';
      }
      show(h);
      if (h === prev) return 'same';
      if (list.length === 1 && h === 0) {
        const removed = Store.deleteActivity(list[0].id);
        if (!quiet) toast(`${fmtShort(date)} · ${Store.project(pid).name} kaydı silindi`, { tone: 'info', action: { label: 'Geri al', fn: () => { Store.restoreActivity(removed); renderAll(); } } });
      } else if (list.length === 1) Store.updateActivity(list[0].id, { hours: h });
      else {
        const meta = rowMeta[pid];
        Store.addActivity({ userId: me.id, projectId: pid, date, hours: h, type: meta.type, note: meta.note.trim() });
      }
      flashSaved();
      return 'changed';
    }

    function addGridRow(pid) {
      const monday = weekStart(selected);
      if (!gridRows[monday].includes(pid)) gridRows[monday].push(pid);
      renderAll();
      const row = `tr[data-pid="${pid}"]`;
      (gridCard.querySelector(`${row} .gcell:not(.is-off) .ginput:not([readonly])`) || gridCard.querySelector(`${row} .ginput`))?.focus();
    }

    function removeGridRow(pid) {
      const monday = weekStart(selected);
      const rowItems = Store.activities({ userId: me.id, from: monday, to: addDays(monday, 6), projectId: pid });
      const keep = rowItems.filter(a => isLocked(me.id, a.date));
      const removed = rowItems.filter(a => !keep.includes(a)).map(a => Store.deleteActivity(a.id));
      if (!keep.length) gridRows[monday] = gridRows[monday].filter(x => x !== pid);
      else toast(`Kilitli aydaki ${keep.length} kayıt silinmedi`, { tone: 'info' });
      renderAll();
      if (removed.length) toast(`${Store.project(pid).name}: ${removed.length} kayıt silindi`, {
        tone: 'info',
        action: { label: 'Geri al', fn: () => { removed.forEach(a => Store.restoreActivity(a)); if (!gridRows[monday].includes(pid)) gridRows[monday].push(pid); renderAll(); } },
      });
    }

    gridCard.addEventListener('focusin', e => { if (e.target.classList.contains('ginput')) e.target.select(); });
    gridCard.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('ginput')) { if (setCell(t) === 'changed') updateGridTotals(); }
      else if (t.dataset.meta) rowMeta[t.closest('tr').dataset.pid][t.dataset.meta] = t.value;
      else if (t.matches('[data-weekend]')) { Prefs.set(me.id, { gridWeekend: t.checked }); renderAll(); }
    });
    gridCard.addEventListener('input', e => {
      if (e.target.dataset.meta === 'note') rowMeta[e.target.closest('tr').dataset.pid].note = e.target.value;
    });
    // Excel gibi gezinme: Enter/↓ alt satır, ↑ üst satır, imleç kenardayken ← → yan hücre
    gridCard.addEventListener('keydown', e => {
      const t = e.target;
      if (!t.classList.contains('ginput')) return;
      const r = Number(t.dataset.r), c = Number(t.dataset.c);
      const whole = t.selectionStart === 0 && t.selectionEnd === t.value.length;
      let to = null;
      if (e.key === 'Enter') to = [r + (e.shiftKey ? -1 : 1), c];
      else if (e.key === 'ArrowDown') to = [r + 1, c];
      else if (e.key === 'ArrowUp') to = [r - 1, c];
      else if (e.key === 'ArrowRight' && (whole || t.selectionStart === t.value.length)) to = [r, c + 1];
      else if (e.key === 'ArrowLeft' && (whole || t.selectionEnd === 0)) to = [r, c - 1];
      if (!to) return;
      e.preventDefault();
      const next = gridCard.querySelector(`.ginput[data-r="${to[0]}"][data-c="${to[1]}"]`);
      if (next) next.focus(); else if (e.key === 'Enter') t.blur();
    });
    // Excel'den kopyalanan saat bloğu, odaklı hücreden başlayarak sağa ve aşağı dağıtılır
    gridCard.addEventListener('paste', e => {
      const t = e.target;
      if (!t.classList.contains('ginput')) return;
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(text.trim())) return;   // tek değer: normal yapıştırma
      e.preventDefault();
      const matrix = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
      const r0 = Number(t.dataset.r), c0 = Number(t.dataset.c);
      let changed = 0, bad = 0;
      matrix.forEach((cells, dr) => cells.forEach((v, dc) => {
        const cell = gridCard.querySelector(`.ginput[data-r="${r0 + dr}"][data-c="${c0 + dc}"]`);
        if (!cell || cell.readOnly) return;
        cell.value = v.trim();
        const res = setCell(cell, { quiet: true });
        if (res === 'changed') changed++; else if (res === 'invalid') bad++;
      }));
      updateGridTotals();
      if (changed || bad) toast(`${changed} hücre dolduruldu${bad ? ` · ${bad} hücre okunamadı` : ''}`, { tone: bad ? 'warn' : 'ok' });
    });
    gridCard.addEventListener('click', e => {
      const del = e.target.closest('[data-delrow]');
      if (del) return removeGridRow(del.dataset.delrow);
      const noteToggle = e.target.closest('[data-note-toggle]');
      if (noteToggle) {
        const pid = noteToggle.closest('tr').dataset.pid;
        rowMeta[pid].open = !rowMeta[pid].open;
        renderAll();
        if (rowMeta[pid].open) gridCard.querySelector(`.note-row[data-pid="${pid}"] input`)?.focus();
        return;
      }
      const multi = e.target.closest('.ginput.is-multi');
      if (multi) { mode = 'gun'; Prefs.set(me.id, { activityMode: mode }); select(multi.dataset.date); }
    });

    /* ---------- Aylık takvim ---------- */

    function renderMonth() {
      monthCard.innerHTML = `
        <div class="card-head">
          <div><h2>${monthTitle(selected)}</h2><p class="sub">Hangi günler girildi, hangileri eksik. Bir güne tıkla, o güne git.</p></div>
        </div>
        <div class="month-layout">${monthCalendar(me.id, selected, { selected })}<aside>${monthStatsHtml(monthSummary(me.id, selected))}${periodPanelHtml(me, selected)}</aside></div>`;
    }

    monthCard.addEventListener('click', e => {
      if (handlePeriodClick(e, me, selected, renderAll)) return;
      const cell = e.target.closest('[data-cal-day]');
      if (!cell) return;
      mode = 'gun';
      Prefs.set(me.id, { activityMode: mode });
      select(cell.dataset.calDay);
      form.focus();
    });

    /* ---------- Excel ---------- */

    function onImported(result) {
      const created = result.filter(Boolean);
      if (!created.length) return;
      select(created.map(a => a.date).sort()[0]);
      toast(`${created.length} kayıt içe aktarıldı (${fmtHours(sum(created, a => a.hours))})`, {
        duration: 7000,
        action: { label: 'Geri al', fn: () => { created.forEach(a => Store.deleteActivity(a.id)); renderAll(); } },
      });
    }

    function openExportMenu(anchor) {
      const monday = weekStart(selected), month = monthStart(selected), prev = addMonths(month, -1);
      const fail = e => toast(e.message, { tone: 'danger' });
      const list = (from, to, tag) => exportActivities(me, from, to, tag).catch(fail);
      const form = iso => exportMonthlyForm(me, iso).catch(fail);
      openMenu(anchor, [
        { icon: 'sheet', label: 'Aylık aktivite formu', hint: monthTitle(month), fn: () => form(month) },
        { icon: 'sheet', label: 'Aylık aktivite formu', hint: monthTitle(prev), fn: () => form(prev) },
        { icon: 'list', label: 'Kayıt listesi · hafta', hint: fmtRange(monday, addDays(monday, 6)), fn: () => list(monday, addDays(monday, 6), `hafta-${monday}`) },
        { icon: 'list', label: 'Kayıt listesi · ay', hint: monthTitle(month), fn: () => list(month, monthEnd(month), month.slice(0, 7)) },
      ]);
    }

    /* ---------- Olaylar ---------- */

    el.addEventListener('click', e => {
      const t = e.target.closest('[data-nav], [data-mode], [data-day], [data-copy-day], [data-import], [data-export]');
      if (!t) return;
      if (t.dataset.nav) return t.dataset.nav === 'today' ? select(todayISO()) : step(t.dataset.nav === 'next' ? 1 : -1);
      if (t.dataset.mode) return setMode(t.dataset.mode);
      if (t.dataset.day) return select(t.dataset.day);   // odak verilmez: proje listesi kendiliğinden açılıp ekranı kapatmasın
      if (t.hasAttribute('data-copy-day')) return copyPreviousDay();
      if (t.hasAttribute('data-import')) return openImportDialog(me.id, onImported, { defaultMonth: selected.slice(0, 7) });
      if (t.hasAttribute('data-export')) return openExportMenu(t);
    });
    bindActivityRows(el.querySelector('#dayList'), renderAll);
    const calCard = el.querySelector('#calCard');
    calCard.addEventListener('click', e => handleCalendarClick(e, me, selected, renderAll));
    calCard.addEventListener('change', e => handleCalendarChange(e, renderAll));

    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal-wrap, .menu')) return;
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (mode === 'gun') select(addDays(selected, dir)); else step(dir);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (mode === 'gun') form.focus(); else if (mode === 'tablo') gridPicker?.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    renderAll();
    return () => document.removeEventListener('keydown', onKey);
  },
};
