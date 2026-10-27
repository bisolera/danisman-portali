/* Outlook takviminden aktivite önerileri.
   Kaynak: Outlook'tan dışa aktarılan .ics dosyası ya da örnek takvim. Canlıda Microsoft Graph
   (Entra ID uygulama kaydı + Calendars.Read izni) ile aynı öneri ekranı doğrudan beslenir.
   Toplantı → proje: öğrenilen eşleştirme › konudaki proje kodu › katılımcı alan adı › konudaki müşteri adı. */

const CalendarStore = {
  key: userId => `bisolera-calendar-${userId}`,
  get(userId) { try { return JSON.parse(localStorage.getItem(CalendarStore.key(userId))); } catch { return null; } },
  set(userId, data) {
    try { localStorage.setItem(CalendarStore.key(userId), JSON.stringify(data)); return true; } catch { return false; }
  },
  clear(userId) { try { localStorage.removeItem(CalendarStore.key(userId)); } catch { /* yok say */ } },
};

const pad2 = n => String(n).padStart(2, '0');
// Takvim saatleri yerel 'YYYY-MM-DDTHH:MM' metni olarak tutulur
const localStamp = d => `${toISO(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const minutesBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);
const addMinutes = (s, m) => { const d = new Date(s); d.setMinutes(d.getMinutes() + m); return localStamp(d); };

/* ---------- .ics okuma ---------- */

const icsText = v => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

// UTC (Z) saatler yerel saate çevrilir; TZID'li saatler duvar saati kabul edilir (kullanıcı Türkiye saatinde)
function icsDate(value) {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2}(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', z] = m;
  return z ? localStamp(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))) : `${y}-${mo}-${d}T${h}:${mi}`;
}

function icsDuration(v) {   // PT1H30M → 90 dk
  const m = String(v).match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  return m ? (Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 60 + Number(m[3] || 0) : 0;
}

function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);   // katlanmış satırları birleştir
  const events = [];
  let cur = null, nested = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { attendees: [], exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur?.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (/^BEGIN:/.test(line)) { nested++; continue; }   // VALARM vb. alt bloklar
    if (/^END:/.test(line)) { nested--; continue; }
    if (nested > 0) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...rawParams] = line.slice(0, i).split(';');
    const value = line.slice(i + 1);
    const params = Object.fromEntries(rawParams.map(p => { const [k, ...v] = p.split('='); return [k.toUpperCase(), v.join('=').replace(/^"|"$/g, '')]; }));
    switch (name.toUpperCase()) {
      case 'UID': cur.uid = value; break;
      case 'SUMMARY': cur.subject = icsText(value); break;
      case 'LOCATION': cur.location = icsText(value); break;
      case 'DTSTART': cur.start = icsDate(value); cur.allDay = params.VALUE === 'DATE' || /^\d{8}$/.test(value); break;
      case 'DTEND': cur.end = icsDate(value); break;
      case 'DURATION': cur.duration = icsDuration(value); break;
      case 'RRULE': cur.rrule = Object.fromEntries(value.split(';').map(p => p.split('='))); break;
      case 'EXDATE': value.split(',').forEach(v => cur.exdates.push(icsDate(v))); break;
      case 'RECURRENCE-ID': cur.recurrenceId = icsDate(value); break;
      case 'TRANSP': if (value === 'TRANSPARENT') cur.transparent = true; break;
      case 'STATUS': if (value === 'CANCELLED') cur.cancelled = true; break;
      case 'X-MICROSOFT-CDO-BUSYSTATUS': if (value === 'FREE' || value === 'OOF') cur.transparent = true; break;
      case 'ATTENDEE': case 'ORGANIZER': {
        const mail = value.match(/mailto:(.+)/i);
        if (mail) cur.attendees.push(mail[1].trim().toLowerCase());
        break;
      }
      default: break;
    }
  }
  return events;
}

/* ---------- Tekrarlayan toplantılar ----------
   Desteklenen: DAILY, WEEKLY (BYDAY), MONTHLY (ayın günü) + INTERVAL, UNTIL, COUNT, EXDATE.
   "Her ayın 2. salısı" gibi kurallar şimdilik açılmaz. */

const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function expandRule(e, from, to) {
  const r = e.rrule, interval = Number(r.INTERVAL || 1), count = r.COUNT ? Number(r.COUNT) : Infinity;
  const first = e.start.slice(0, 10), time = e.start.slice(10);
  const until = r.UNTIL ? icsDate(r.UNTIL)?.slice(0, 10) : null;
  const last = until && until < to ? until : to;
  const byDay = r.BYDAY ? r.BYDAY.split(',').map(x => ICS_DAYS.indexOf(x.slice(-2))) : null;
  const out = [];
  let n = 0;
  for (let d = first; d <= last && n < count; d = addDays(d, 1)) {
    const dd = parseISO(d), fd = parseISO(first);
    let hit = false;
    if (r.FREQ === 'DAILY') hit = daysBetween(first, d) % interval === 0 && (!byDay || byDay.includes(dd.getDay()));
    else if (r.FREQ === 'WEEKLY') {
      hit = (daysBetween(weekStart(first), weekStart(d)) / 7) % interval === 0
        && (byDay ? byDay.includes(dd.getDay()) : dd.getDay() === fd.getDay());
    } else if (r.FREQ === 'MONTHLY' && !byDay) {
      const months = (dd.getFullYear() - fd.getFullYear()) * 12 + dd.getMonth() - fd.getMonth();
      hit = months % interval === 0 && dd.getDate() === Number(r.BYMONTHDAY || fd.getDate());
    }
    if (hit) { n++; if (d >= from) out.push(d + time); }
  }
  return out;
}

// [from, to] günleri arasındaki toplantı örnekleri (tekrarlar açılmış, tekil değişiklikler uygulanmış)
function eventsBetween(events, from, to) {
  const lengthOf = e => (e.end ? minutesBetween(e.start, e.end) : e.duration || 0);
  const overrides = new Map(events.filter(e => e.recurrenceId).map(e => [`${e.uid}|${e.recurrenceId}`, e]));
  const inRange = s => s.slice(0, 10) >= from && s.slice(0, 10) <= to;
  const out = [];
  for (const e of events) {
    if (e.recurrenceId) {   // seri aralık dışındaysa ama taşınan örnek aralığa düşüyorsa
      if (inRange(e.start) && !inRange(e.recurrenceId)) out.push(e);
      continue;
    }
    const starts = e.rrule ? expandRule(e, from, to) : [e.start];
    for (const s of starts) {
      if (!inRange(s) || e.exdates?.includes(s)) continue;
      const moved = overrides.get(`${e.uid}|${s}`);
      const inst = moved || { ...e, start: s, end: e.end || e.duration ? addMinutes(s, lengthOf(e)) : null };
      if (inRange(inst.start)) out.push(inst);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/* ---------- Toplantı → proje eşleştirme ---------- */

// "RE: Kuzey haftalık 12. toplantı" → "kuzey haftalik #. toplanti"
const subjectKey = s => fold(s || '').replace(/^((re|fw|fwd|ynt|ilt|ileti)\s*:\s*)+/g, '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

function projectForCustomer(userId, customerId) {
  const active = Store.projects({ customerId, activeOnly: true });
  if (active.length <= 1) return active[0] || null;
  const recent = recentProjectIds(userId).find(id => active.some(p => p.id === id));
  return recent ? Store.project(recent) : active[0];
}

function matchProject(userId, e) {
  const learned = Store.project((Prefs.get(userId).calendarMap || {})[subjectKey(e.subject)]);
  if (learned?.status === 'aktif') return { projectId: learned.id, reason: 'Daha önce böyle eşleştirdin' };
  const text = fold(`${e.subject || ''} ${e.location || ''}`);
  const byCode = Store.projects({ activeOnly: true }).find(p => text.includes(fold(p.code)));
  if (byCode) return { projectId: byCode.id, reason: `Konuda proje kodu: ${byCode.code}` };
  const domains = [...new Set((e.attendees || []).map(a => a.split('@')[1]).filter(d => d && d !== COMPANY_DOMAIN))];
  const slug = c => fold(c.name).replace(/[^a-z0-9]/g, '');
  for (const c of Store.customers().filter(c => !c.internal)) {
    const domain = domains.find(d => d.replace(/[^a-z0-9.]/g, '').includes(slug(c)));
    const named = text.includes(fold(c.name));
    const p = (domain || named) && projectForCustomer(userId, c.id);
    if (p) return { projectId: p.id, reason: domain ? `Katılımcı: ${domain}` : `Konuda: ${c.name}` };
  }
  return { projectId: null, reason: domains.length ? `Tanınmayan müşteri: ${domains[0]}` : 'Şirket içi toplantı — proje seç' };
}

const meetingType = subject => (/egitim|training|sertifika|workshop/.test(fold(subject || '')) ? 'egitim' : 'toplanti');

// Seçili günün önerileri; takvim bağlı değilse null
function calendarSuggestions(userId, day) {
  const cal = CalendarStore.get(userId);
  if (!cal) return null;
  const dismissed = new Set(Prefs.get(userId).calendarDismissed || []);
  const acts = Store.activities({ userId, from: day, to: day });
  return eventsBetween(cal.events, day, day)
    .filter(e => !e.allDay && !e.transparent && !e.cancelled && !/^(iptal|canceled|cancelled)\b/i.test(e.subject || ''))
    .map(e => {
      const key = `${e.uid}|${e.start}`;
      const minutes = e.end ? minutesBetween(e.start, e.end) : 0;
      return { key, event: e, hours: Math.min(24, Math.round(minutes / 15) / 4), ...matchProject(userId, e), added: acts.some(a => a.source?.key === key) };
    })
    .filter(s => s.hours > 0 && !dismissed.has(s.key));
}

/* ---------- Örnek takvim (dosya olmadan denemek için) ---------- */

function demoCalendar(user) {
  const monday = weekStart(todayISO()), me = user.email;
  const at = (offset, time) => `${addDays(monday, offset)}T${time}`;
  const weekly = (uid, subject, offset, start, end, attendees, extra = {}) =>
    ({ uid, subject, start: at(offset - 14, start), end: at(offset - 14, end), attendees: [me, ...attendees], rrule: { FREQ: 'WEEKLY' }, exdates: [], ...extra });
  return [
    // Kurgusal müşteriler; .example alan adları gerçek bir şirkete ait olamaz
    weekly('demo-standup', 'Kuzey Elektronik BW günlük stand-up', 0, '09:30', '09:45', ['bw.ekibi@kuzeyelektronik.example'], { rrule: { FREQ: 'WEEKLY', BYDAY: 'MO,TU,WE,TH,FR' } }),
    weekly('demo-mavi', 'Stok raporu fark inceleme', 1, '14:00', '15:30', ['raporlama@maviseramik.example']),
    weekly('demo-ada', 'Ada İçecek Fabric geçişi durum toplantısı', 2, '11:00', '12:00', ['veri.ekibi@adaicecek.example']),
    weekly('demo-demir', 'Tartım verisi doğrulama', 3, '10:00', '12:00', ['bt@demirmaden.example']),
    weekly('demo-ekip', 'Bisolera haftalık ekip toplantısı', 4, '16:00', '17:00', [`ekip@${COMPANY_DOMAIN}`]),
    weekly('demo-ogle', 'Öğle arası', 0, '12:30', '13:30', [], { rrule: { FREQ: 'DAILY', BYDAY: 'MO,TU,WE,TH,FR' }, transparent: true }),
    { uid: 'demo-sac', subject: 'SAC planlama eğitimi', start: at(3, '14:00'), end: at(3, '16:00'), attendees: [me, `egitim@${COMPANY_DOMAIN}`], exdates: [] },
  ];
}

/* ---------- Bağlama penceresi ---------- */

function openCalendarConnect(user, onDone) {
  const current = CalendarStore.get(user.id);
  openModal({
    title: 'Outlook takvimini bağla',
    body: `
      ${current ? `<div class="callout ok">${icon('calendar', 16)}<div><strong>Bağlı: ${esc(current.name)}</strong> · ${current.events.length} etkinlik · ${fmtStamp(current.loadedAt)} yüklendi</div></div>` : ''}
      <label class="dropzone" data-drop>
        <input type="file" accept=".ics,text/calendar" hidden>
        <span class="dz-ic">${icon('calendar', 26)}</span>
        <strong data-dz-title>Outlook takvim dosyasını (.ics) buraya sürükle</strong>
        <span class="muted">veya <span class="link">bilgisayarından seç</span></span>
      </label>
      <details class="howto">
        <summary>Outlook’tan .ics dosyası nasıl alınır?</summary>
        <ol>
          <li><strong>Outlook (masaüstü):</strong> Takvim görünümünde <em>Dosya → Takvimi Kaydet</em>. <em>Diğer Seçenekler</em>’den tarih aralığını seç (ör. bu ay) ve kaydet.</li>
          <li><strong>Outlook web / yeni Outlook:</strong> <em>Ayarlar → Takvim → Paylaşılan takvimler → Takvimi yayımla</em>, ardından ICS bağlantısını tarayıcıda açıp dosyayı indir (şirket politikası izin veriyorsa).</li>
        </ol>
      </details>
      <div class="connect-options">
        <button class="connect-opt" data-demo>${icon('calendar', 18)}<span><strong>Örnek takvimle dene</strong><small>Bu hafta için müşterilerinle örnek toplantılar oluşturur</small></span></button>
        <div class="connect-opt is-disabled">${MS_LOGO}<span><strong>Microsoft 365 ile otomatik bağlan</strong><small>Canlı sürümde: Entra ID kurulumundan sonra takvim izinle okunur, dosyaya gerek kalmaz</small></span>${pill('Yakında', 'muted')}</div>
      </div>
      <p class="form-error" hidden></p>`,
    footer: `${current ? `<button class="btn danger-ghost sm" data-remove>${icon('trash', 15)} Takvimi kaldır</button>` : ''}<span class="grow"></span><button class="btn ghost" data-close>Kapat</button>`,
    onMount(m, close) {
      const err = m.querySelector('.form-error'), drop = m.querySelector('[data-drop]'), input = m.querySelector('input[type=file]');
      const finish = (data, msg) => {
        if (!CalendarStore.set(user.id, data)) { err.textContent = 'Takvim kaydedilemedi (tarayıcı depolama alanı dolu olabilir).'; err.hidden = false; return; }
        close();
        onDone();
        toast(msg);
      };
      async function load(file) {
        if (!file) return;
        try {
          const all = parseICS(await file.text());
          if (!all.length) throw new Error('Dosyada takvim etkinliği bulunamadı.');
          // Tekrarlayanlar ve son 6 ay / önümüzdeki 4 ay saklanır; depolama dolmasın
          const from = addDays(todayISO(), -180), to = addDays(todayISO(), 120);
          const events = all.filter(e => e.rrule || e.recurrenceId || (e.start.slice(0, 10) >= from && e.start.slice(0, 10) <= to));
          finish({ source: 'ics', name: file.name, loadedAt: new Date().toISOString(), events }, `${events.length} takvim etkinliği yüklendi`);
        } catch (e) { err.textContent = e.message || 'Dosya okunamadı.'; err.hidden = false; }
      }
      input.addEventListener('change', () => load(input.files[0]));
      m.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
      m.addEventListener('dragleave', e => { if (!m.contains(e.relatedTarget)) drop.classList.remove('is-over'); });
      m.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-over'); load(e.dataTransfer.files[0]); });
      m.querySelector('[data-demo]').addEventListener('click', () =>
        finish({ source: 'demo', name: 'Örnek takvim', loadedAt: new Date().toISOString(), events: demoCalendar(user) }, 'Örnek takvim yüklendi'));
      m.querySelector('[data-remove]')?.addEventListener('click', () => { CalendarStore.clear(user.id); close(); onDone(); toast('Takvim bağlantısı kaldırıldı', { tone: 'info' }); });
    },
  });
}

/* ---------- Öneri kartı (Aktiviteler → Günlük) ---------- */

const suggestionEdits = new Map();   // öneri anahtarı → kullanıcının değiştirdiği proje/süre

function calendarCardHtml(user, day) {
  const list = calendarSuggestions(user.id, day);
  if (!list) {
    return `<div class="cal-connect">
      <span class="cal-connect-ic">${icon('calendar', 18)}</span>
      <div><strong>Outlook takviminden öneriler</strong><p>Toplantıların tek tıkla aktiviteye dönüşsün.</p></div>
      <button class="btn ghost sm" data-cal-connect>Takvimi bağla</button>
    </div>`;
  }
  const locked = isLocked(user.id, day);
  const ready = list.filter(s => !s.added && (suggestionEdits.get(s.key)?.projectId ?? s.projectId));
  const cal = CalendarStore.get(user.id);
  return `
    <div class="cal-panel-head">
      <div class="min0"><h2>${icon('calendar', 16)} Takvimden öneriler</h2><p class="sub">${esc(cal.name)}${cal.source === 'demo' ? ' · örnek veri' : ''}</p></div>
      <button class="btn ghost sm" data-cal-connect>Yönet</button>
    </div>
    ${!list.length ? '<p class="muted cal-empty">Bu gün takviminde aktiviteye dönüşecek toplantı yok.</p>' : list.map(s => suggestionRow(s, locked)).join('')}
    ${ready.length > 1 && !locked ? `<button class="btn primary sm block sug-all" data-sug-all>${icon('check', 15)} ${ready.length} öneriyi birden ekle</button>` : ''}`;
}

// Üst satır: saat + toplantı adı (kesilmeden) · alt satır: süre, proje, ekle
function suggestionRow(s, locked) {
  const e = s.event, edit = suggestionEdits.get(s.key) || {};
  const projectId = edit.projectId ?? s.projectId, hours = edit.hours ?? s.hours;
  const people = (e.attendees || []).length;
  const status = s.added ? pill('Eklendi', 'ok') : locked ? pill('Ay kilitli', 'muted') : '';
  return `<div class="sug-row${s.added ? ' is-added' : ''}" data-sug="${esc(s.key)}">
    <div class="sug-top">
      <span class="sug-time">${e.start.slice(11)}${e.end ? `–${e.end.slice(11)}` : ''}</span>
      <strong class="sug-subject">${esc(e.subject || '(konu yok)')}</strong>
      ${status || `<button class="icon-btn sm" data-sug-skip title="Bu öneriyi gizle" aria-label="Öneriyi gizle">${icon('x', 15)}</button>`}
    </div>
    <small class="sug-reason">${people ? `${people} katılımcı · ` : ''}${esc(s.reason)}</small>
    ${status ? '' : `<div class="sug-controls">
      <span class="sug-hours"><input class="input" data-sug-hours value="${fmtNum(hours)}" inputmode="decimal" aria-label="Süre"><span>sa</span></span>
      <select class="input sug-proj${projectId ? '' : ' is-pending'}" data-sug-proj aria-label="Proje"><option value="">Proje seç…</option>${projectOptions(projectId)}</select>
      <button class="btn primary sm" data-sug-add${projectId ? '' : ' disabled'}>Ekle</button>
    </div>`}
  </div>`;
}

function acceptSuggestion(user, day, s) {
  const edit = suggestionEdits.get(s.key) || {};
  const projectId = edit.projectId ?? s.projectId;
  const hours = Math.round(parseHours(edit.hours ?? s.hours) * 4) / 4;
  if (!projectId || !(hours > 0 && hours <= 24)) return null;
  const act = Store.addActivity({ userId: user.id, projectId, date: day, hours, type: meetingType(s.event.subject), note: s.event.subject || '', source: { kind: 'outlook', key: s.key } });
  if (!act) return null;
  // Konu → proje eşleştirmesini öğren: tekrarlayan toplantılar bir dahakine otomatik gelir
  const map = Prefs.get(user.id).calendarMap || {};
  map[subjectKey(s.event.subject)] = projectId;
  Prefs.set(user.id, { calendarMap: map });
  suggestionEdits.delete(s.key);
  return act;
}

// Kart olayları; true dönerse tıklama işlendi
function handleCalendarClick(e, user, day, onChange) {
  if (e.target.closest('[data-cal-connect]')) { openCalendarConnect(user, onChange); return true; }
  const list = () => calendarSuggestions(user.id, day) || [];
  if (e.target.closest('[data-sug-all]')) {
    const created = list().filter(s => !s.added).map(s => acceptSuggestion(user, day, s)).filter(Boolean);
    onChange();
    toast(`${created.length} toplantı aktiviteye eklendi (${fmtHours(sum(created, a => a.hours))})`, {
      action: { label: 'Geri al', fn: () => { created.forEach(a => Store.deleteActivity(a.id)); onChange(); } },
    });
    return true;
  }
  const row = e.target.closest('[data-sug]');
  if (!row) return false;
  const s = list().find(x => x.key === row.dataset.sug);
  if (!s) return true;
  if (e.target.closest('[data-sug-add]')) {
    const act = acceptSuggestion(user, day, s);
    onChange();
    if (act) toast(`${fmtHours(act.hours)} eklendi · ${s.event.subject}`, { action: { label: 'Geri al', fn: () => { Store.deleteActivity(act.id); onChange(); } } });
    else toast('Süreyi kontrol et (0–24 saat)', { tone: 'warn' });
  } else if (e.target.closest('[data-sug-skip]')) {
    const dismissed = Prefs.get(user.id).calendarDismissed || [];
    Prefs.set(user.id, { calendarDismissed: [...dismissed, s.key].slice(-500) });
    onChange();
  }
  return true;
}

function handleCalendarChange(e, onChange) {
  const row = e.target.closest('[data-sug]');
  if (!row) return;
  const edit = suggestionEdits.get(row.dataset.sug) || {};
  if (e.target.matches('[data-sug-proj]')) edit.projectId = e.target.value || null;
  if (e.target.matches('[data-sug-hours]')) edit.hours = e.target.value;
  suggestionEdits.set(row.dataset.sug, edit);
  if (e.target.matches('[data-sug-proj]')) onChange();   // "Ekle" butonu ve "hepsini ekle" sayısı güncellensin
}
