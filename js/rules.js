/* İş kuralları: hedef saat, izin günleri, bakiye, eksik giriş.
   Ekranlar hesaplamaları buradan alır; bir kural değişirse değişecek tek yer burası. */

const DAILY_HOURS = 8;

// Günün tatili. İki yarım tatil (ör. arife öğleden sonra resmi + sabah köprü izni) birlikte tam gün sayılır.
function mergeHolidays(list) {
  if (list.length <= 1) return list[0] || null;
  return { ...list[0], name: list.map(h => h.name).join(' + '), half: false, parts: list };
}
function getHoliday(iso) { return mergeHolidays(Store.holidaysOn(iso)); }

// Köprü izninde kişinin seçimi (h.work = { userId: 'full' | 'half' }): tam gün çalışır, yarım gün çalışır ya da izinli (null).
// Yarım gün köprüde "yarım gün çalışmak" köprünün tamamını çalışmak demektir.
const bridgeWork = (h, userId) => (h?.kind === 'kopru' && h.work?.[userId]) || null;

// Köprünün kişi için izinli kalan kısmı (gün): tam gün köprüde 1 / 0,5 / 0, yarım gün köprüde 0,5 / 0
function bridgeOff(h, userId) {
  const length = h.half ? 0.5 : 1, work = bridgeWork(h, userId);
  return work === 'full' ? 0 : work === 'half' ? Math.max(0, length - 0.5) : length;
}

// Kişiye göre tatil: köprünün çalışılan kısmı o kişi için normal iş sayılır.
// Tam gün köprüde yarım gün çalışan için gün yarım gün tatil olur (hedef 4 saat).
function holidayFor(userId, iso) {
  return mergeHolidays(Store.holidaysOn(iso).flatMap(h => {
    if (h.kind !== 'kopru') return [h];
    const off = bridgeOff(h, userId);
    return !off ? [] : off === 0.5 && !h.half ? [{ ...h, half: true }] : [h];
  }));
}

// Köprü izninde kişinin yıllık izninden düşen gün: izinli kalan kısım (1, 0,5 ya da 0), from tarihinden itibaren.
// O gün başka türde onaylı izni varsa (rapor vb.) ya da henüz işe girmemişse düşülmez.
function bridgeDays(user, from = LEAVE_START) {
  const other = Store.leaves({ userId: user.id, status: 'onaylandi' }).filter(l => l.type !== 'yillik');
  return sum(Store.holidays({ from }).filter(h => h.kind === 'kopru' && !isWeekend(h.date)
    && (!user.startDate || user.startDate <= h.date) && !other.some(l => l.start <= h.date && h.date <= l.end)), h => bridgeOff(h, user.id));
}

// Danışman köprü gününde çalışıp çalışmayacağını o güne kadar seçer; ay kapanışa gönderildiyse seçim değişmez
const canChooseBridge = (h, userId, today = todayISO()) => h.kind === 'kopru' && h.date >= today && !isLocked(userId, h.date);

// Seçilen yılın sabit tarihli resmi tatilleri (dini bayramlar her yıl değiştiği için elle girilir)
function fixedHolidays(year) {
  return FIXED_HOLIDAYS.map(([md, name, half]) => ({ date: `${year}-${md}`, name, kind: 'resmi', half: !!half }));
}

// Kullanıcının o güne denk gelen onaylı izni (yoksa null)
function approvedLeaveOn(userId, iso) {
  return Store.leaves({ userId, status: 'onaylandi' }).find(l => iso >= l.start && iso <= l.end) || null;
}

// O gün için beklenen çalışma saati: hafta sonu ve tatil 0, arife yarım, izinli gün düşülür
function dailyTarget(userId, iso) {
  if (isWeekend(iso)) return 0;
  const holiday = holidayFor(userId, iso);
  if (holiday && !holiday.half) return 0;
  let target = holiday ? DAILY_HOURS / 2 : DAILY_HOURS;
  const leave = approvedLeaveOn(userId, iso);
  if (leave) target = leave.halfDay ? target / 2 : 0;
  return target;
}

function hoursOn(userId, iso) {
  return sum(Store.activities({ userId, from: iso, to: iso }), a => a.hours);
}

// Hedefi 0 olan günün nedeni; gün kutularında etiket olarak gösterilir
function dayOffReason(userId, iso) {
  const holiday = holidayFor(userId, iso);
  if (holiday && !holiday.half) return holiday.name;
  const leave = approvedLeaveOn(userId, iso);
  if (leave && !leave.halfDay) return leaveTypeName(leave.type);
  if (isWeekend(iso)) return 'Hafta sonu';
  return null;
}

// İzin talebinde bakiyeden düşülecek gün sayısı (başlangıç ve bitiş dahil):
// hafta sonu ve resmi tatil düşülmez; arife öğleden sonra tatil olduğu için yarım gün düşülür.
// Köprü günü, çalışmayan için zaten köprüden düştüğü için izinde ayrıca sayılmaz (userId verilirse kişiye göre).
function countLeaveDays(startISO, endISO, userId = null) {
  return sum(dateRange(startISO, endISO), d => {
    if (isWeekend(d)) return 0;
    const holiday = userId ? holidayFor(userId, d) : getHoliday(d);
    if (holiday) return holiday.half ? 0.5 : 0;
    return 1;
  });
}

/* ---------- Yıllık izin: işe giriş yıldönümünde hak ediş, yürüyen bakiye, avans ---------- */

// Portalda izin takibinin başladığı gün. Kullanıcının açılış bakiyesi (user.carryIn) bu günün başındaki bakiyedir.
const LEAVE_START = `${LEAVE_START_YEAR}-01-01`;

// Yasal yıllık izin (4857 sayılı İş Kanunu md. 53): n. hizmet yılını dolduran kazanır.
// 1–5. yıl (5 dahil) 14 gün, 6–14. yıl 20 gün, 15. yıl ve sonrası 26 gün.
const legalAccrual = n => (n >= 15 ? 26 : n > 5 ? 20 : 14);

// Tamamlanan hizmet yılı
function serviceYears(startISO, dateISO) {
  const s = parseISO(startISO), t = parseISO(dateISO);
  return t.getFullYear() - s.getFullYear() - (t < new Date(t.getFullYear(), s.getMonth(), s.getDate()) ? 1 : 0);
}

// Bir sonraki hak edişin yasal tutarı; yeni kullanıcı formunda varsayılan değer
function legalAnnualLeave(startISO, today = todayISO()) {
  return startISO ? legalAccrual(serviceYears(startISO, today) + 1) : 14;
}

// İşe girişin n. yıldönümü (29 Şubat'ta girenin yıldönümü artık olmayan yıllarda 28 Şubat)
function anniversary(startISO, n) {
  const s = parseISO(startISO), d = new Date(s.getFullYear() + n, s.getMonth(), s.getDate());
  if (d.getMonth() !== s.getMonth()) d.setDate(0);
  return toISO(d);
}

// n. yıldönümünde eklenen gün: şirketin verdiği hak (kullanıcı formu) yasal asgarinin altına inmez
const accrualAmount = (user, n, dateISO) => Math.max(entitlementFor(user, parseISO(dateISO).getFullYear()), legalAccrual(n));

// Portal başlangıcından toISO'ya kadarki hak edişler: [{ date, n, days }]
function accruals(user, toISO) {
  const out = [];
  if (!user.startDate) return out;
  for (let n = 1; n < 60; n++) {
    const date = anniversary(user.startDate, n);
    if (date > toISO) break;
    if (date >= LEAVE_START) out.push({ date, n, days: accrualAmount(user, n, date) });
  }
  return out;
}

// afterISO'dan sonraki ilk hak ediş (işe giriş tarihi yoksa null)
function nextAccrual(user, afterISO) {
  if (!user.startDate) return null;
  for (let n = 1; n < 60; n++) {
    const date = anniversary(user.startDate, n);
    if (date > afterISO) return { date, n, days: accrualAmount(user, n, date) };
  }
  return null;
}

function leaveDays(leave) {
  const days = countLeaveDays(leave.start, leave.end, leave.userId);
  return leave.halfDay ? Math.min(0.5, days) : days;
}

// O yılın izin hakkı. Hak değişince (kıdem 5 yılı geçti vb.) eski yıllar eski değerle kalsın diye
// user.entitlements = { '2026': 14, '2028': 20 } tutulur; yılın değeri, o yıla kadarki son kayıttır.
function entitlementFor(user, year) {
  const years = Object.keys(user.entitlements || {}).filter(y => Number(y) <= year).sort();
  return years.length ? user.entitlements[years.pop()] : user.annualLeave;
}

// Bakiyeden düşen yıllık izin günleri (portal başlangıcından ya da from'dan itibaren, tarihinden bağımsız)
function annualLeaveDays(user, status, from = LEAVE_START) {
  return sum(Store.leaves({ userId: user.id, status }).filter(l => l.type === 'yillik' && l.end >= from),
    l => leaveDays({ ...l, start: l.start < from ? from : l.start }));
}

// Yürüyen bakiye: açılış + bugüne kadarki hak edişler − onaylı yıllık izinler − köprü izinleri.
// Takvim yılı ayrımı yok; kalan kendiliğinden bir sonraki yıla geçer. Eksi bakiye avans izindir, sonraki hak edişten düşer
// (−3 iken 14 gelirse 11). İş Kanunu md. 53–59: kullanılmayan yıllık izin yanmaz.
function leaveBalance(user, today = todayISO()) {
  const opening = user.startDate && user.startDate > LEAVE_START ? 0 : Number(user.carryIn) || 0;
  const earned = accruals(user, today), last = earned[earned.length - 1] || null;
  const bridge = bridgeDays(user), used = annualLeaveDays(user, 'onaylandi') + bridge;
  const remaining = opening + sum(earned, a => a.days) - used;
  const termFrom = last?.date || LEAVE_START;   // bu hak yılı: son hak edişten bu yana
  return {
    opening, accrued: sum(earned, a => a.days), used, bridge, pending: annualLeaveDays(user, 'beklemede'), remaining,
    termUsed: annualLeaveDays(user, 'onaylandi', termFrom) + bridgeDays(user, termFrom), termFrom,
    last, next: nextAccrual(user, today), advance: remaining < 0,
  };
}

// Yeni yıllık izin talebi sonrası bakiye: talebin başladığı güne kadar hak edilecekler eklenir, onaylı ve bekleyen bütün
// talepler düşülür. Eksiye (avans) en fazla bir sonraki hak ediş kadar inilebilir.
function leaveProjection(user, start, days, today = todayISO()) {
  const b = leaveBalance(user, today);
  const coming = sum(accruals(user, start).filter(a => a.date > today), a => a.days);
  const after = b.remaining + coming - b.pending - days;
  const next = nextAccrual(user, start), limit = next ? next.days : legalAnnualLeave(user.startDate, start);
  return { after, limit, next, ok: after >= -limit, advance: after < 0 };
}

// Hedefin altında kalan günler (genelde ay başından düne kadar sorulur)
function missingDays(userId, fromISO, toISO) {
  return dateRange(fromISO, toISO)
    .map(date => ({ date, target: dailyTarget(userId, date), logged: hoursOn(userId, date) }))
    .filter(d => d.target > 0 && d.logged < d.target);
}

// Onaylı izin için iptal talebi: izin başlamadan (en geç ilk günü) istenebilir; yönetici onaylayınca izin iptal olur.
// Talep beklerken izin geçerli sayılır (bakiyeden düşük kalır, gün hedefi 0).
const canRequestCancel = (l, today = todayISO()) => l.status === 'onaylandi' && l.start >= today && l.cancel?.status !== 'beklemede';
const cancelRequests = () => Store.leaves({ status: 'onaylandi' }).filter(l => l.cancel?.status === 'beklemede');

// Yeni talep, onaylı ya da bekleyen başka bir taleple çakışıyor mu?
function overlappingLeave(userId, start, end, ignoreId = null) {
  return Store.leaves({ userId }).find(l => l.id !== ignoreId && (l.status === 'onaylandi' || l.status === 'beklemede') && l.start <= end && start <= l.end) || null;
}

// Günün giriş durumu:
//   full: hedef tamam · partial: eksik saatli · missing: geçmiş iş günü, hiç giriş yok
//   open: bugün/gelecek, henüz boş · planned: gelecek, kısmen girilmiş
//   off: hafta sonu/tatil/izin · extra: hedefi olmayan günde çalışılmış
function dayStatus(userId, iso, today = todayISO()) {
  const target = dailyTarget(userId, iso), logged = hoursOn(userId, iso);
  let status;
  if (target === 0) status = logged > 0 ? 'extra' : 'off';
  else if (logged >= target) status = 'full';
  else if (logged > 0) status = iso <= today ? 'partial' : 'planned';
  else status = iso < today ? 'missing' : 'open';
  return { date: iso, target, logged, status };
}

function monthSummary(userId, iso) {
  const today = todayISO();
  const days = dateRange(monthStart(iso), monthEnd(iso)).map(d => dayStatus(userId, d, today));
  const work = days.filter(d => d.target > 0);
  const count = (...st) => work.filter(d => st.includes(d.status)).length;
  return {
    days,
    workdays: work.length,
    full: count('full'),
    partial: count('partial'),
    missing: count('missing'),
    open: count('open', 'planned'),
    off: days.filter(d => d.target === 0 && !isWeekend(d.date)).length,   // hafta içine denk gelen tatil/izin
    target: sum(work, d => d.target),
    logged: sum(days, d => d.logged),
  };
}

function weekSummary(userId, mondayISO) {
  const days = dateRange(mondayISO, addDays(mondayISO, 6));
  return {
    days,
    target: sum(days, d => dailyTarget(userId, d)),
    logged: sum(Store.activities({ userId, from: days[0], to: days[6] }), a => a.hours),
  };
}

// Kullanıcının en son çalıştığı projeler (en yeni önce)
function recentProjectIds(userId) {
  const seen = new Set();
  Store.activities({ userId }).slice().sort(newestFirst).forEach(a => seen.add(a.projectId));
  return [...seen];
}

// "Önceki günü kopyala" için kaynak: geriye doğru kaydı olan ilk gün
function findCopySource(userId, iso) {
  for (let i = 1; i <= 14; i++) {
    const date = addDays(iso, -i);
    const items = Store.activities({ userId, from: date, to: date }).filter(a => Store.project(a.projectId)?.status === 'aktif');
    if (items.length) return { date, items, total: sum(items, a => a.hours) };
  }
  return null;
}

/* ---------- Raporlar: sözleşme saati, faturalama, talepler ---------- */

// Projenin ay içindeki toplam saati (tüm danışmanlar)
function projectMonthHours(projectId, iso) {
  return sum(Store.activities({ projectId, from: monthStart(iso), to: monthEnd(iso) }), a => a.hours);
}

// Aylık sözleşme saati olan projede kullanım: %80'de uyarı, %100'de aşım
function budgetState(project, iso) {
  if (!project.monthlyBudget) return null;
  const used = projectMonthHours(project.id, iso), pct = (used / project.monthlyBudget) * 100;
  return { used, budget: project.monthlyBudget, pct, tone: pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok' };
}

// Açıklamadaki talep numaraları: "SM-2119038", "CFR-102" (proje kodlarında rakam olmadığı için karışmaz)
function ticketIds(note) {
  return [...new Set(String(note || '').match(/\b[A-Z]{2,6}-\d{2,8}\b/g) || [])];
}

// Ayın yönetim raporu: faturalanır/faturalanmaz saat, müşteri → proje → danışman dökümü, talepler
function monthReport(iso) {
  const items = Store.activities({ from: monthStart(iso), to: monthEnd(iso) });
  const projects = new Map(), tickets = new Map();
  for (const a of items) {
    const project = Store.project(a.projectId);
    const row = projects.get(project.id) || { project, customer: Store.customer(project.customerId), hours: 0, users: new Map() };
    row.hours += a.hours;
    row.users.set(a.userId, (row.users.get(a.userId) || 0) + a.hours);
    projects.set(project.id, row);
    // Birden fazla talep geçen kaydın saati talepler arasında eşit bölünür
    const ids = ticketIds(a.note);
    ids.forEach(id => {
      const t = tickets.get(id) || { id, hours: 0, entries: 0, projects: new Set(), last: a.date };
      t.hours += a.hours / ids.length;
      t.entries++;
      t.projects.add(project.id);
      if (a.date > t.last) t.last = a.date;
      tickets.set(id, t);
    });
  }
  const groups = new Map();
  for (const row of projects.values()) {
    const g = groups.get(row.customer.id) || { customer: row.customer, hours: 0, rows: [] };
    g.hours += row.hours;
    g.rows.push(row);
    groups.set(row.customer.id, g);
  }
  const total = sum(items, a => a.hours);
  const billable = sum(items.filter(a => Store.project(a.projectId).billable), a => a.hours);
  return {
    total, billable, nonBillable: total - billable,
    consultants: new Set(items.map(a => a.userId)).size,
    groups: [...groups.values()].sort((a, b) => b.hours - a.hours).map(g => ({ ...g, rows: g.rows.sort((a, b) => b.hours - a.hours) })),
    tickets: [...tickets.values()].sort((a, b) => b.hours - a.hours),
  };
}

/* ---------- Doluluk: faturalanır saat / hedef saat ---------- */

// Doluluk bu oranın altındaysa uyarı verilir (tam sınırdaki uyarı sayılmaz)
const UTILIZATION_TARGET = 0.75;

// Raporun kapsadığı günler: geçmiş ayın tamamı; içinde bulunulan ayda ay başından düne kadar (bugün henüz bitmedi)
function utilizationRange(iso, today = todayISO()) {
  const from = monthStart(iso), end = monthEnd(iso);
  return { from, to: end < today ? end : addDays(today, -1) };
}

// Danışmanın doluluğu. Hedef saat izin, tatil ve köprü seçimi düşülmüş iş saatidir; işe girişten önceki günler sayılmaz.
// Payda hedef saat olduğu için eksik giriş oranı düşürür (girilen saate bölünseydi eksik giren yüksek görünürdü).
function utilization(user, iso, today = todayISO()) {
  const range = utilizationRange(iso, today);
  const from = user.startDate && user.startDate > range.from ? user.startDate : range.from, to = range.to;
  if (to < from) return { from, to, target: 0, logged: 0, billable: 0, internal: 0, pct: null, missing: 0, leave: 0, tone: 'muted' };
  const items = Store.activities({ userId: user.id, from, to });
  const target = sum(dateRange(from, to), d => dailyTarget(user.id, d));
  const logged = sum(items, a => a.hours);
  const billable = sum(items.filter(a => Store.project(a.projectId)?.billable), a => a.hours);
  const pct = target ? billable / target : null;
  const leave = sum(Store.leaves({ userId: user.id, status: 'onaylandi' }).filter(l => l.start <= to && l.end >= from),
    l => leaveDays({ ...l, start: l.start < from ? from : l.start, end: l.end > to ? to : l.end }));
  return {
    from, to, target, logged, billable, internal: logged - billable, pct, leave,
    missing: missingDays(user.id, from, to).length,
    tone: pct == null ? 'muted' : pct < UTILIZATION_TARGET ? 'warn' : 'ok',
  };
}

// Ekibin doluluğu: aktif ve o dönemde işe girmiş herkes; ekip oranı toplam faturalanır / toplam hedef
function teamUtilization(iso, today = todayISO()) {
  const { to } = utilizationRange(iso, today);
  const rows = Store.users().filter(u => u.active && (!u.startDate || u.startDate <= to)).map(u => ({ user: u, ...utilization(u, iso, today) }));
  const target = sum(rows, r => r.target), billable = sum(rows, r => r.billable), logged = sum(rows, r => r.logged);
  return { rows, target, billable, logged, pct: target ? billable / target : null, warn: rows.filter(r => r.tone === 'warn').length };
}

// Faturalanmayan saatler nereye gitti: proje bazında (eğitim, satış öncesi, idari işler…)
function internalBreakdown(iso, today = todayISO()) {
  const { from, to } = utilizationRange(iso, today), map = new Map();
  if (to >= from) {
    Store.activities({ from, to }).forEach(a => {
      const project = Store.project(a.projectId);
      if (!project || project.billable) return;
      const row = map.get(project.id) || { project, customer: Store.customer(project.customerId), hours: 0, users: new Map() };
      row.hours += a.hours;
      row.users.set(a.userId, (row.users.get(a.userId) || 0) + a.hours);
      map.set(project.id, row);
    });
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

/* ---------- Yetkinlikler ve sertifikalar ---------- */

const CERT_WARN_DAYS = 90;   // bitişe bu kadar gün ya da daha az kaldıysa "yakında doluyor"

// suresiz · gecerli · yakinda (≤ 90 gün) · doldu
function certStatus(cert, today = todayISO()) {
  if (!cert.expires) return 'suresiz';
  if (cert.expires < today) return 'doldu';
  return daysBetween(today, cert.expires) <= CERT_WARN_DAYS ? 'yakinda' : 'gecerli';
}
const certValid = (cert, today) => certStatus(cert, today) !== 'doldu';

// Son 12 ayda yetkinlik etiketli projelere yazılan saat: { skillId: saat }. Bir proje birden çok yetkinlik taşıyabilir.
function skillHours(userId, today = todayISO()) {
  const out = {};
  Store.activities({ userId, from: addMonths(today, -12), to: today }).forEach(a => {
    (Store.project(a.projectId)?.skills || []).forEach(s => { out[s] = (out[s] || 0) + a.hours; });
  });
  return out;
}

// Uygun danışman: seçilen yetkinliklerin hepsinde en az minLevel; certRequired ise her birinde geçerli sertifika.
// Sıra: seviye toplamı, sonra deneyim saati. available (yalnızca yönetici): bu ayın doluluğu %75 altında olanlar.
function findConsultants({ skills = [], minLevel = 1, certRequired = false, available = false } = {}, today = todayISO()) {
  if (!skills.length) return [];
  return Store.users().filter(u => u.active).map(u => {
    const levels = skills.map(s => u.skills?.[s] || 0), hours = skillHours(u.id, today);
    const certs = Store.certs({ userId: u.id }).filter(c => certValid(c, today));
    return {
      user: u, levels,
      hours: sum(skills, s => hours[s] || 0),
      certs: skills.map(s => certs.find(c => c.skillId === s) || null),
      util: available ? utilization(u, today, today) : null,
    };
  }).filter(r => r.levels.every(l => l >= minLevel) && (!certRequired || r.certs.every(Boolean))
    && (!available || (r.util.pct != null && r.util.pct < UTILIZATION_TARGET)))
    .sort((a, b) => sum(b.levels) - sum(a.levels) || b.hours - a.hours || a.user.name.localeCompare(b.user.name, 'tr'));
}

// CV için müşteri projeleri (son 24 ay, iç projeler hariç): en son çalışılan önce
function cvProjects(userId, today = todayISO()) {
  const map = new Map();
  Store.activities({ userId, from: addMonths(today, -24), to: today }).forEach(a => {
    const project = Store.project(a.projectId), customer = project && Store.customer(project.customerId);
    if (!project || customer?.internal) return;
    const row = map.get(project.id) || { project, customer, from: a.date, to: a.date, hours: 0 };
    row.hours += a.hours;
    if (a.date < row.from) row.from = a.date;
    if (a.date > row.to) row.to = a.date;
    map.set(project.id, row);
  });
  return [...map.values()].sort((a, b) => b.to.localeCompare(a.to));
}

/* ---------- Masraflar ---------- */

// Masraf taslağının sorunları (boşsa kaydedilebilir)
function expenseErrors(x, today = todayISO()) {
  const errors = [];
  if (!x.date) errors.push('Tarihi seç.');
  else if (x.date > today) errors.push('Masraf tarihi ileri bir gün olamaz.');
  if (!EXPENSE_CATEGORIES.some(c => c.id === x.category)) errors.push('Kategori seç.');
  if (!(x.amount > 0)) errors.push('Tutarı yaz (ör. 1.250,50).');
  else if (x.amount > EXPENSE_MAX) errors.push(`Tek masraf en fazla ${fmtMoney(EXPENSE_MAX)} olabilir.`);
  if (!x.description || x.description.trim().length < 3) errors.push('Kısa bir açıklama yaz (ne için?).');
  if (x.rebill && !x.projectId) errors.push('Müşteriye yansıtılacak masrafta proje seçilmeli.');
  return errors;
}

// Danışman yalnızca onay beklerken düzenler; reddedilen düzeltilip yeniden gönderilir
const canEditExpense = x => x.status === 'beklemede' || x.status === 'reddedildi';

// Aynı gün, aynı kategori ve tutarda başka bir masraf varsa (iki kez girilmiş olabilir)
const duplicateExpense = (x, ignoreId = null) => Store.expenses({ userId: x.userId, from: x.date, to: x.date })
  .find(o => o.id !== ignoreId && o.status !== 'reddedildi' && o.category === x.category && o.amount === x.amount) || null;

// Danışmanın özet kartları: bu ay, onay bekleyen, ödenecek, bu yıl ödenen
function expenseSummary(userId, today = todayISO()) {
  const mine = Store.expenses({ userId }).filter(x => x.status !== 'reddedildi');
  const total = list => sum(list, x => x.amount);
  return {
    month: total(mine.filter(x => x.date >= monthStart(today) && x.date <= today)),
    pending: total(mine.filter(x => x.status === 'beklemede')),
    toPay: total(mine.filter(x => x.status === 'onaylandi')),
    paidYear: total(mine.filter(x => x.status === 'odendi' && x.date.slice(0, 4) === today.slice(0, 4))),
  };
}

// Ayın masraf raporu (yönetici): kişi ve kategori bazında, müşteriye yansıtılacaklar müşteri bazında. Reddedilenler dışarıda.
function expenseMonthReport(iso) {
  const items = Store.expenses({ from: monthStart(iso), to: monthEnd(iso) }).filter(x => x.status !== 'reddedildi')
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const people = new Map(), customers = new Map();
  items.forEach(x => {
    const p = people.get(x.userId) || { user: Store.user(x.userId), total: 0, pending: 0, toPay: 0, paid: 0, byCategory: {}, noReceipt: 0 };
    p.total += x.amount;
    p[{ beklemede: 'pending', onaylandi: 'toPay', odendi: 'paid' }[x.status]] += x.amount;
    p.byCategory[x.category] = (p.byCategory[x.category] || 0) + x.amount;
    if (!x.receipt) p.noReceipt++;
    people.set(x.userId, p);
    if (x.rebill && x.projectId) {
      const project = Store.project(x.projectId), customer = Store.customer(project.customerId);
      const c = customers.get(customer.id) || { customer, total: 0, items: [] };
      c.total += x.amount;
      c.items.push(x);
      customers.set(customer.id, c);
    }
  });
  return {
    items, total: sum(items, x => x.amount),
    people: [...people.values()].sort((a, b) => b.total - a.total),
    rebill: [...customers.values()].sort((a, b) => b.total - a.total),
  };
}

const pendingExpenses = () => Store.expenses({ status: 'beklemede' }).length;

/* ---------- Müşteri sözleşmeleri ---------- */

const CONTRACT_WARN_PCT = 80;       // saat havuzunun bu yüzdesi kullanılınca uyarı
const CONTRACT_FORECAST_DAYS = 14;  // tükenme tahmini için en az bu kadar günlük kullanım gerekir

// baslamadi · aktif · yakinda (bitişe hatırlatma süresi kadar kaldı) · bitti · yenilendi
function contractStatus(c, today = todayISO()) {
  if (c.start > today) return 'baslamadi';
  if (c.renewedTo && Store.contract(c.renewedTo)) return 'yenilendi';
  if (c.end < today) return 'bitti';
  return daysBetween(today, c.end) <= (c.noticeDays ?? 60) ? 'yakinda' : 'aktif';
}

// Saat havuzu: bağlı projelere sözleşme döneminde yazılan saat (bütün danışmanlar).
// Tahmin: şimdiye kadarki günlük ortalama sürerse havuzun tükeneceği gün; bitişten önceyse uyarı.
function contractUsage(c, today = todayISO()) {
  const to = c.end < today ? c.end : today;
  const used = to < c.start ? 0 : sum(c.projectIds.flatMap(pid => Store.activities({ projectId: pid, from: c.start, to })), a => a.hours);
  if (!c.hours) return { used, hours: null, pct: null, remaining: null, runsOutOn: null, tone: 'muted' };
  const pct = (used / c.hours) * 100, remaining = c.hours - used;
  let runsOutOn = null;
  const elapsed = to < c.start ? 0 : daysBetween(c.start, to) + 1;
  if (c.end >= today && remaining > 0 && used > 0 && elapsed >= CONTRACT_FORECAST_DAYS) {
    const date = addDays(today, Math.ceil(remaining / (used / elapsed)));
    if (date < c.end) runsOutOn = date;
  }
  return { used, hours: c.hours, pct, remaining, runsOutOn, tone: pct >= 100 ? 'danger' : pct >= CONTRACT_WARN_PCT || runsOutOn ? 'warn' : 'ok' };
}

// İlgilenilmesi gereken sözleşmeler: bitişe yakın, havuz %80 / %100, bu hızla erken tükenecek
function contractAlerts(today = todayISO()) {
  const out = [];
  Store.contracts().forEach(c => {
    const st = contractStatus(c, today);
    if (st === 'bitti' || st === 'baslamadi' || (st === 'yenilendi' && c.end < today)) return;   // yenilenmiş ama sürmekte olanın havuzu yine izlenir
    const u = contractUsage(c, today), customer = Store.customer(c.customerId);
    if (st === 'yakinda') out.push({ contract: c, customer, kind: 'bitiyor', text: `${daysBetween(today, c.end)} gün sonra bitiyor (${fmtDate(c.end)})${c.renewal === 'otomatik' ? ' · otomatik yenilenir' : ''}` });
    if (u.pct != null && u.pct >= 100) out.push({ contract: c, customer, kind: 'asim', text: `Saat havuzu aşıldı: ${fmtNum(u.used)} / ${fmtNum(u.hours)} sa` });
    else if (u.pct != null && u.pct >= CONTRACT_WARN_PCT) out.push({ contract: c, customer, kind: 'havuz', text: `Saat havuzunun %${Math.round(u.pct)}'i kullanıldı (${fmtNum(u.remaining)} sa kaldı)` });
    else if (u.runsOutOn) out.push({ contract: c, customer, kind: 'hizli', text: `Bu hızla havuz ${fmtDate(u.runsOutOn)} tarihinde biter (bitişten ${daysBetween(u.runsOutOn, c.end)} gün önce)` });
  });
  return out;
}

// Aynı proje aynı dönemde iki sözleşmede olamaz (saatler iki kez sayılırdı)
function contractClash(draft, ignoreId = null) {
  return Store.contracts().filter(c => c.id !== ignoreId && c.start <= draft.end && draft.start <= c.end)
    .map(c => ({ contract: c, projects: c.projectIds.filter(pid => draft.projectIds.includes(pid)) }))
    .find(x => x.projects.length) || null;
}

// Müşterinin şu an geçerli (yoksa en son) sözleşmesi: müşteri kartındaki özet için
function currentContract(customerId, today = todayISO()) {
  const list = Store.contracts({ customerId }).filter(c => c.start <= today).sort((a, b) => b.end.localeCompare(a.end));
  return list.find(c => c.end >= today) || null;
}

/* ---------- Prim ve araba parası (yalnızca yönetici) ---------- */

// Ayın başında yürürlükte olan tutarlar (yoksa null)
function payRateFor(iso) {
  const m = monthStart(iso);
  return Store.payRates().filter(r => r.from <= m).pop() || null;
}

// Prim ve araba parası hakkı tarihlidir: perks = [{ from, bonus, car }], her kayıt o tarihten sonraki durumu söyler (tarihe göre sıralı).
// Geçmişi olmayan eski kayıtlarda işaretler işe girişten beri geçerli sayılır; böylece eski aylar değişmez.
function perkHistory(user) {
  if (user.perks) return user.perks.slice().sort((a, b) => a.from.localeCompare(b.from));
  return user.bonusEligible || user.carAllowance ? [{ from: user.startDate || LEAVE_START, bonus: !!user.bonusEligible, car: !!user.carAllowance }] : [];
}

// [from, to] aralığında hakkın ('bonus' | 'car') açık olduğu gün sayısı
function perkDays(user, key, from, to) {
  const list = perkHistory(user);
  return sum(list.map((p, i) => {
    if (!p[key]) return 0;
    const a = p.from > from ? p.from : from, end = list[i + 1] ? addDays(list[i + 1].from, -1) : to, b = end < to ? end : to;
    return b < a ? 0 : daysBetween(a, b) + 1;
  }), n => n);
}

// [from, to] içinde açılan ya da kapanan haklar: [{ date, key, on }]. İşe girişte başlayan hak değişiklik sayılmaz.
function perkChanges(user, from, to) {
  const list = perkHistory(user), out = [];
  list.forEach((p, i) => {
    const prev = list[i - 1] || { bonus: false, car: false };
    if (p.from < from || p.from > to || (i === 0 && p.from === user.startDate)) return;
    ['bonus', 'car'].forEach(key => { if (!!p[key] !== !!prev[key]) out.push({ date: p.from, key, on: !!p[key] }); });
  });
  return out;
}

// Kişinin ay hesabı. Prim: faturalanabilir saat ÷ 8, kesirli gün (203 sa = 25,375 gün); eşiği aşan gün × günlük prim, kuruşa yuvarlanır.
// Prim hakkı ayın herhangi bir gününde açıksa o ayın tamamı sayılır.
// Araba parası: araç yerine para alana aylık tutar; hakkın açık olduğu ve şirkette çalışılan takvim günü kadar (kıst: gün ÷ ayın günü).
// Kesinlik: ay kapanışı onaylıysa.
function payFor(user, iso, rate = payRateFor(iso)) {
  const from = monthStart(iso), to = monthEnd(iso);
  const billable = sum(Store.activities({ userId: user.id, from, to }).filter(a => Store.project(a.projectId)?.billable), a => a.hours);
  const days = billable / DAILY_HOURS;
  const bonusOn = perkDays(user, 'bonus', from, to) > 0;
  const over = rate ? Math.max(0, days - rate.bonusThreshold) : 0;
  const bonus = bonusOn && rate ? Math.round(over * rate.bonusDaily * 100) / 100 : 0;
  const monthDays = daysBetween(from, to) + 1;
  const workFrom = user.startDate && user.startDate > from ? user.startDate : from, workTo = user.endDate && user.endDate < to ? user.endDate : to;
  const carDays = workTo < workFrom ? 0 : perkDays(user, 'car', workFrom, workTo);
  const car = rate && carDays ? Math.round((rate.carMonthly * carDays / monthDays) * 100) / 100 : 0;
  return { user, billable, days, over, bonusOn, carOn: carDays > 0, bonus, car, carDays, monthDays, prorated: carDays < monthDays, total: bonus + car,
    final: periodStatus(user.id, iso) === 'onaylandi' };
}

// O ay şirkette olan kişi: işe girişi ay sonundan önce, çıkışı (varsa) ay başından sonra. Ayrılmış (pasif) kişi ayrıldığı ay listede kalır.
const employedIn = (u, iso) => (!u.startDate || u.startDate <= monthEnd(iso)) && (u.endDate ? u.endDate >= monthStart(iso) : u.active);

// Ayın listesi: o ay şirkette olan ve o ay prime tabi ya da araba parası hakkı açık olan kişiler
function payrollMonth(iso) {
  const rate = payRateFor(iso);
  const rows = Store.users().filter(u => employedIn(u, iso)).map(u => payFor(u, iso, rate)).filter(r => r.bonusOn || r.carOn)
    .sort((a, b) => b.total - a.total || a.user.name.localeCompare(b.user.name, 'tr'));
  return { rate, rows, bonus: sum(rows, r => r.bonus), car: sum(rows, r => r.car), total: sum(rows, r => r.total) };
}

/* ---------- Ay kapanışı ---------- */

function periodStatus(userId, iso) { return Store.period(userId, iso.slice(0, 7))?.status || 'acik'; }

// Onaya gönderilen ya da onaylanan ayın kayıtları değiştirilemez
function isLocked(userId, iso) {
  const s = periodStatus(userId, iso);
  return s === 'gonderildi' || s === 'onaylandi';
}

function lockMessage(userId, iso) {
  return periodStatus(userId, iso) === 'onaylandi'
    ? `${monthTitle(iso)} onaylandı ve kilitlendi.`
    : `${monthTitle(iso)} onaya gönderildi; değiştirmek için önce gönderimi geri çek.`;
}

// Bekleyen onaylar: izin talepleri + iptal talepleri + onaya gönderilmiş aylar (yönetici rozetinde)
function pendingApprovals() {
  return Store.leaves({ status: 'beklemede' }).length + cancelRequests().length + Store.periods({ status: 'gonderildi' }).length;
}

function nextWorkday(iso) {
  let d = addDays(iso, 1);
  while (isWeekend(d) || (getHoliday(d) && !getHoliday(d).half)) d = addDays(d, 1);
  return d;
}
