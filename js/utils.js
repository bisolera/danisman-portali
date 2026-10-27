/* Ortak yardımcılar: tarih, sayı biçimleri, arama, HTML kaçışı */

const DAY_MS = 86400000;
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Tarihler her yerde yerel saatle 'YYYY-MM-DD' metni olarak tutulur.
// toISOString() bilerek kullanılmıyor: UTC'ye çevirdiği için Türkiye'de (UTC+3) gece yarısı bir önceki güne kayar.
function toISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function weekStart(iso) {             // haftanın pazartesisi
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}
function monthStart(iso) { return iso.slice(0, 8) + '01'; }
function monthEnd(iso) {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
// Ay ekler; gün yeni ayda yoksa ayın son gününe çekilir (31 Ekim + 1 ay → 30 Kasım)
function addMonths(iso, n) {
  const d = parseISO(iso);
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return toISO(t);
}
function monthTitle(iso) {
  const d = parseISO(iso);
  return `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function isWeekend(iso) {
  const g = parseISO(iso).getDay();
  return g === 0 || g === 6;
}
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY_MS); }
function dateRange(startISO, endISO) {
  const out = [];
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) out.push(d);
  return out;
}

function fmtDate(iso, { year = true, weekday = false } = {}) {
  const d = parseISO(iso);
  let s = `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`;
  if (year) s += ` ${d.getFullYear()}`;
  return weekday ? `${TR_DAYS[d.getDay()]}, ${s}` : s;
}
function fmtShort(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]}`;
}
function fmtRange(a, b) {
  if (a === b) return fmtDate(a);
  const da = parseISO(a), db = parseISO(b);
  if (da.getFullYear() !== db.getFullYear()) return `${fmtDate(a)} – ${fmtDate(b)}`;
  if (da.getMonth() === db.getMonth()) return `${da.getDate()}–${db.getDate()} ${TR_MONTHS[db.getMonth()]} ${db.getFullYear()}`;
  return `${fmtShort(a)} – ${fmtShort(b)} ${db.getFullYear()}`;
}
function dayName(iso, short = false) {
  const g = parseISO(iso).getDay();
  return short ? TR_DAYS_SHORT[g] : TR_DAYS[g];
}

// 7.5 → "7,5" (Türkçe ondalık virgül)
function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',');
}
function fmtHours(h) { return `${fmtNum(h)} sa`; }
const MONEY = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtMoney(n) { return `${MONEY.format(n || 0)} ₺`; }
// "1.250,50", "1250,5", "1250.50", "₺ 1.250" → sayı; anlaşılmazsa NaN
function parseAmount(input) {
  let s = String(input ?? '').replace(/[\s₺]|TL/gi, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // "1.250" binlik ayraç
  return /^\d+(\.\d+)?$/.test(s) ? Math.round(Number(s) * 100) / 100 : NaN;
}
function fmtSize(bytes) { return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${fmtNum(Math.round(bytes / 104857.6) / 10)} MB`; }

// Kullanıcının yazdığı süreyi saate çevirir: "2", "1,5", "1.5" veya "1:30"
function parseHours(input) {
  const s = String(input).trim().replace(',', '.');
  if (!s) return NaN;
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  return Number(s);
}

// Büyük/küçük harf ve Türkçe karakterden bağımsız arama: "gida" → "Toros Gıda"
function fold(str) {
  return String(str).toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
// İlk ad + soyadın baş harfi: "Ayşe Nur Yılmaz" → "AY"
function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map(w => w[0]).join('').toLocaleUpperCase('tr');
}
function firstName(name) { return name.split(' ')[0]; }
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
// Kayıt zaman damgası (ISO, yerel ya da UTC) → "27 Eki 14:05"
function fmtStamp(stamp) {
  const d = new Date(stamp);
  return `${fmtShort(toISO(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function sum(arr, fn = x => x) { return arr.reduce((t, x) => t + fn(x), 0); }
function newestFirst(a, b) { return (b.date + b.createdAt).localeCompare(a.date + a.createdAt); }
