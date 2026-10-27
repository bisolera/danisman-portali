/* İş kuralları: hedef saat, izin günleri, bakiye, eksik giriş.
   Ekranlar hesaplamaları buradan alır; bir kural değişirse değişecek tek yer burası. */

const DAILY_HOURS = 8;

function getHoliday(iso) { return HOLIDAYS_BY_DATE[iso] || null; }

// Kullanıcının o güne denk gelen onaylı izni (yoksa null)
function approvedLeaveOn(userId, iso) {
  return Store.leaves({ userId, status: 'onaylandi' }).find(l => iso >= l.start && iso <= l.end) || null;
}

// O gün için beklenen çalışma saati: hafta sonu ve tatil 0, arife yarım, izinli gün düşülür
function dailyTarget(userId, iso) {
  if (isWeekend(iso)) return 0;
  const holiday = getHoliday(iso);
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
  const holiday = getHoliday(iso);
  if (holiday && !holiday.half) return holiday.name;
  const leave = approvedLeaveOn(userId, iso);
  if (leave && !leave.halfDay) return leaveTypeName(leave.type);
  if (isWeekend(iso)) return 'Hafta sonu';
  return null;
}

// İzin talebinde bakiyeden düşülecek gün sayısı (başlangıç ve bitiş dahil).
// Kullanılabilir yardımcılar: dateRange(a, b) → ['2026-11-16', ...], isWeekend(iso), getHoliday(iso) → { name, half } | null
function countLeaveDays(startISO, endISO) {
  // TODO(human): Hafta sonlarını ve resmi tatilleri sayma. Arifeler (half: true) nasıl sayılmalı?
  // Geçici olarak takvim günü döndürüyor; bu yüzden "Cuma–Pazartesi" talebi 4 gün görünüyor.
  return daysBetween(startISO, endISO) + 1;
}

function leaveDays(leave) {
  const days = countLeaveDays(leave.start, leave.end);
  return leave.halfDay ? Math.min(0.5, days) : days;
}

// Yıllık izin bakiyesi (izinler başlangıç tarihinin yılına sayılır)
function leaveBalance(user, year = parseISO(todayISO()).getFullYear()) {
  const yearly = Store.leaves({ userId: user.id }).filter(l => l.type === 'yillik' && l.start.startsWith(String(year)));
  const used = sum(yearly.filter(l => l.status === 'onaylandi'), leaveDays);
  const pending = sum(yearly.filter(l => l.status === 'beklemede'), leaveDays);
  return { total: user.annualLeave, used, pending, remaining: user.annualLeave - used };
}

// Hedefin altında kalan günler (genelde ay başından düne kadar sorulur)
function missingDays(userId, fromISO, toISO) {
  return dateRange(fromISO, toISO)
    .map(date => ({ date, target: dailyTarget(userId, date), logged: hoursOn(userId, date) }))
    .filter(d => d.target > 0 && d.logged < d.target);
}

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

// Bekleyen onaylar: izin talepleri + onaya gönderilmiş aylar (yönetici rozetinde)
function pendingApprovals() {
  return Store.leaves({ status: 'beklemede' }).length + Store.periods({ status: 'gonderildi' }).length;
}

function nextWorkday(iso) {
  let d = addDays(iso, 1);
  while (isWeekend(d) || (getHoliday(d) && !getHoliday(d).half)) d = addDays(d, 1);
  return d;
}
