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

// Köprü izninde kişinin yıllık izninden düşen gün: izinli kalan kısım (1, 0,5 ya da 0).
// O gün başka türde onaylı izni varsa (rapor vb.) ya da henüz işe girmemişse düşülmez.
function bridgeDays(user, year) {
  const other = Store.leaves({ userId: user.id, status: 'onaylandi' }).filter(l => l.type !== 'yillik');
  return sum(Store.holidays({ from: `${year}-01-01`, to: `${year}-12-31` }).filter(h => h.kind === 'kopru' && !isWeekend(h.date)
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

// Kıdeme göre yasal asgari yıllık izin (4857 sayılı İş Kanunu md. 53):
// 1–5 yıl 14 gün, 5–15 yıl 20 gün, 15 yıl ve üzeri 26 gün. Yeni kullanıcıda varsayılan değer olarak kullanılır.
function legalAnnualLeave(startISO, today = todayISO()) {
  if (!startISO) return 14;
  const s = parseISO(startISO), t = parseISO(today);
  const years = t.getFullYear() - s.getFullYear() - (t < new Date(t.getFullYear(), s.getMonth(), s.getDate()) ? 1 : 0);
  return years >= 15 ? 26 : years >= 5 ? 20 : 14;
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

// Önceki yıldan bu yıla devreden yıllık izin (gün).
//  · İlk yıl: LEAVE_START_YEAR ya da kişinin işe girdiği yıl (hangisi sonraysa). Portal öncesinden kalan izin
//    yöneticinin girdiği user.carryIn'dir (işe portaldan sonra girende yoktur).
//  · Sonraki yıllar: bir önceki yılın kalanı, leaveBalance(user, year - 1).remaining
//  · İlk yıldan önceki yıllar: 0
// Kural: kalan olduğu gibi devreder; eksi bakiye (avans izin) de devreder ve ertesi yılın hakkından düşer; üst sınır yok
// (İş Kanunu md. 53–59: kullanılmayan yıllık izin yanmaz).
function carriedLeave(user, year) {
  const hired = user.startDate ? parseISO(user.startDate).getFullYear() : LEAVE_START_YEAR;
  const first = Math.max(LEAVE_START_YEAR, hired);
  if (year < first) return 0;
  if (year === first) return first === LEAVE_START_YEAR ? Number(user.carryIn) || 0 : 0;
  return leaveBalance(user, year - 1).remaining;   // ilk yıla inince durur
}

// Yıllık izin bakiyesi. Yıl sınırını aşan izin (28 Aralık – 5 Ocak) günlerine göre iki yıla bölünür.
function leaveBalance(user, year = parseISO(todayISO()).getFullYear()) {
  const y0 = `${year}-01-01`, y1 = `${year}-12-31`;
  const yearly = Store.leaves({ userId: user.id }).filter(l => l.type === 'yillik' && l.start <= y1 && l.end >= y0);
  const inYear = l => leaveDays({ ...l, start: l.start < y0 ? y0 : l.start, end: l.end > y1 ? y1 : l.end });
  const bridge = bridgeDays(user, year);
  const used = sum(yearly.filter(l => l.status === 'onaylandi'), inYear) + bridge;
  const pending = sum(yearly.filter(l => l.status === 'beklemede'), inYear);
  const total = entitlementFor(user, year), carried = carriedLeave(user, year);
  return { total, carried, used, bridge, pending, remaining: carried + total - used };
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
