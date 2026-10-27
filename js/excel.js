/* Excel ile toplu aktivite: içe aktarma (dosya ya da yapıştırma), şirketin aylık aktivite formu,
   boş şablon ve dışa aktarma. SheetJS (Apache 2.0, vendor/xlsx) yalnızca bir Excel dosyası
   açılırken/oluşturulurken yüklenir ve projeyle birlikte gelir; dışarıya istek gitmez. */

const XLSX_URL = 'vendor/xlsx/xlsx.full.min.js';
let xlsxPromise = null;

function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxPromise) {
    xlsxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = XLSX_URL;
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { xlsxPromise = null; reject(new Error('Excel kütüphanesi yüklenemedi (vendor/xlsx). Sayfayı yenileyip tekrar dene.')); };
      document.head.appendChild(s);
    });
  }
  return xlsxPromise;
}

// Excel tarihleri 30.12.1899'dan bu yana geçen gün sayısıdır
const EXCEL_EPOCH = '1899-12-30';
const serialToISO = serial => addDays(EXCEL_EPOCH, Math.floor(serial));
const isoToSerial = iso => daysBetween(EXCEL_EPOCH, iso);
const FORM_TITLE = 'Danışman Aylık Aktivite Formu';

/* ---------- Dosya / metin okuma → [{ name, rows }] ---------- */

// Yapıştırılan metin ya da CSV. Excel kopyası sekmeyle, Türkçe CSV noktalı virgülle ayrılır.
function parseDelimited(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const sample = lines.slice(0, 10).join('\n');
  const delim = sample.includes('\t') ? '\t' : sample.split(';').length >= sample.split(',').length ? ';' : ',';
  return lines.map(line => splitDelimitedLine(line, delim));
}

function splitDelimitedLine(line, delim) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && !cur.trim()) { quoted = true; cur = ''; }
    else if (ch === delim) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

async function readImportFile(file) {
  const name = file.name.toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name)) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1254').decode(buf);   // Türkçe Windows'ta kaydedilmiş CSV
    return [{ name: file.name, rows: parseDelimited(text) }];
  }
  if (!/\.(xlsx|xlsm|xls)$/.test(name)) throw new Error('Desteklenen dosyalar: .xlsx, .xls, .csv');
  const XLSX = await loadXLSX();
  return workbookSheets(XLSX.read(await file.arrayBuffer(), { cellNF: true }), XLSX);
}

// Tüm sayfalar okunur; aylık formda her müşteri ayrı bir sayfadadır
function workbookSheets(wb, XLSX) {
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return { name, rows: [] };
    const range = XLSX.utils.decode_range(ws['!ref']);
    const rows = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row = [];
      for (let c = 0; c <= range.e.c; c++) row.push(cellValue(ws[XLSX.utils.encode_cell({ r, c })], XLSX));
      rows.push(row);
    }
    return { name, rows };
  });
}

// Biçime bakarak tarih ve saat hücrelerini ayırır: 46321 (gg.aa.yyyy) → tarih, 0,25 (ss:dd) → 6 saat
function cellValue(cell, XLSX) {
  if (!cell) return '';
  if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
    const fmt = String(cell.z).toLowerCase().replace(/"[^"]*"|\[[^\]]*\]/g, '');
    return /[dy]/.test(fmt) ? { kind: 'date', serial: cell.v } : { kind: 'time', hours: cell.v * 24 };
  }
  return cell.v ?? '';
}

// "..._Eylül_2026.xlsx" → "2026-09"
function monthFromFileName(name) {
  const f = fold(name);
  const months = TR_MONTHS.map(fold);
  const near = f.match(new RegExp(`(${months.join('|')})[^a-z0-9]*(20\\d{2})`));
  if (near) return `${near[2]}-${String(months.indexOf(near[1]) + 1).padStart(2, '0')}`;
  const year = (f.match(/20\d{2}/) || [])[0], idx = months.findIndex(m => f.includes(m));
  return year && idx >= 0 ? `${year}-${String(idx + 1).padStart(2, '0')}` : null;
}

/* ---------- Sütunları tanıma ---------- */

const IMPORT_COLUMNS = {
  date: ['tarih', 'date', 'gun'],
  project: ['proje kodu', 'proje', 'kod', 'project', 'project code', 'code'],
  customer: ['musteri', 'firma', 'customer', 'client'],
  hours: ['sure', 'saat', 'efor', 'hours', 'hour', 'duration'],
  type: ['tur', 'aktivite turu', 'tip', 'kategori', 'type', 'activity type'],
  note: ['aciklama', 'not', 'yapilan is', 'is tanimi', 'description', 'note', 'notes'],
};
const DEFAULT_COLUMN_ORDER = ['date', 'project', 'hours', 'type', 'note'];   // başlıksız yapıştırmada

// Tekrar kontrolünde boşluk ve büyük/küçük harf farkı önemsenmez
const sameText = (a, b) => fold(a || '').replace(/\s+/g, ' ').trim() === fold(b || '').replace(/\s+/g, ' ').trim();

function cellText(c) {
  if (c && typeof c === 'object') return c.kind === 'date' ? fmtDate(serialToISO(c.serial)) : `${fmtNum(c.hours)} sa`;
  return String(c ?? '').trim();
}

function columnKey(header) {
  const h = fold(header).replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!h) return null;
  for (const [key, names] of Object.entries(IMPORT_COLUMNS)) if (names.includes(h)) return key;
  for (const [key, names] of Object.entries(IMPORT_COLUMNS)) if (names.some(n => h.startsWith(n + ' '))) return key;
  return null;
}

// İlk 25 satırda başlık arar (aylık formda başlık 6. satırda). Tarih ve süre sütunu olmayan
// sayfalar (ör. şablondaki "Projeler" listesi) aktivite tablosu sayılmaz.
function detectColumns(rows, { allowPositional }) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const keys = rows[i].map(c => (typeof c === 'string' ? columnKey(c) : null));
    if (keys.filter(Boolean).length < 2) continue;
    const map = { projectCols: [] };
    keys.forEach((k, col) => {
      if (k === 'project') {
        if (/kod|code/.test(fold(rows[i][col]))) map.projectCols.unshift(col); else map.projectCols.push(col);
      } else if (k && map[k] == null) map[k] = col;
    });
    if (map.date == null || map.hours == null) return null;
    return { map, body: rows.slice(i + 1).map((cells, k) => ({ cells, line: i + k + 2 })) };
  }
  if (!allowPositional) return null;
  const first = rows.findIndex(r => r.some(c => cellText(c)));
  if (first < 0) return null;
  const map = { projectCols: [DEFAULT_COLUMN_ORDER.indexOf('project')] };
  DEFAULT_COLUMN_ORDER.forEach((k, i) => { if (k !== 'project') map[k] = i; });
  return { map, body: rows.slice(first).map((cells, k) => ({ cells, line: first + k + 1 })) };
}

/* ---------- Değerleri çözme ---------- */

// month ('2026-09') verilirse yalnızca gün numarası olan hücreler (aylık form) o aya yerleşir
function parseDateCell(c, month) {
  if (c && typeof c === 'object') return c.kind === 'date' ? { iso: serialToISO(c.serial) } : null;
  const s = String(c ?? '').trim().toLocaleLowerCase('tr');
  if (/^\d{1,2}$/.test(s) && Number(s) >= 1 && Number(s) <= 31) {
    if (!month) return null;
    const iso = `${month}-${s.padStart(2, '0')}`;
    return toISO(parseISO(iso)) === iso ? { iso, dayNumber: true } : null;
  }
  if (typeof c === 'number') return c > 20000 && c < 80000 ? { iso: serialToISO(c) } : null;
  let y, m, d, x;
  if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/))) {
    [d, m, y] = [+x[1], +x[2], +x[3]];
    if (m > 12 && d <= 12) [d, m] = [m, d];   // ABD biçimi (ay/gün/yıl)
  } else if ((x = s.match(/^(\d{1,2})\s+(\S+?)\.?\s+(\d{4})$/))) {
    const i = TR_MONTHS.findIndex((name, k) => fold(name) === fold(x[2]) || fold(TR_MONTHS_SHORT[k]) === fold(x[2]));
    if (i < 0) return null;
    [d, m, y] = [+x[1], i + 1, +x[3]];
  } else return null;
  if (y < 100) y += 2000;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return y >= 2000 && y <= 2100 && toISO(new Date(y, m - 1, d)) === iso ? { iso } : null;
}

function parseHoursCell(c) {
  if (c && typeof c === 'object') return c.kind === 'time' ? c.hours : NaN;
  if (typeof c === 'number') return c;
  return parseHours(String(c ?? '').trim().replace(/\s*(saat|sa|h|s)\.?$/i, ''));
}

// Proje sütunu olan dosyalar: kod → ad → "Müşteri · Proje" → kısmi eşleşme
function resolveProject(values, customerText) {
  const texts = values.map(cellText).filter(Boolean);
  if (!texts.length) return { error: 'Proje boş' };
  const all = Store.projects();
  const cust = p => Store.customer(p.customerId).name;
  const cf = fold(customerText || '');
  for (const text of texts) {
    const t = fold(text);
    let hits = all.filter(p => fold(p.code) === t);
    if (!hits.length) hits = all.filter(p => [p.name, `${cust(p)} · ${p.name}`, `${cust(p)} - ${p.name}`].some(s => fold(s) === t));
    if (!hits.length) hits = all.filter(p => fold(`${cust(p)} ${p.name} ${p.code}`).includes(t));
    if (hits.length > 1 && cf) hits = hits.filter(p => fold(cust(p)).includes(cf));
    if (hits.length === 1) {
      const p = hits[0];
      return p.status === 'aktif' ? { project: p } : { error: `${p.name} aktif değil` };
    }
    if (hits.length > 1) return { error: `"${text}" birden fazla projeyle eşleşiyor; proje kodunu yaz` };
  }
  return { error: `"${texts[0]}" adında proje bulunamadı` };
}

// Yalnızca müşteri adı olan dosyalar (aylık form): önce kayıtlı eşleştirme, sonra müşterinin tek aktif projesi
function resolveCustomer(text, mapping) {
  const t = fold(text);
  if (!t) return { choose: true, reason: 'Müşteri boş' };
  const mapped = mapping[t] && Store.project(mapping[t]);
  if (mapped?.status === 'aktif') return { project: mapped };
  const customers = Store.customers();
  let hits = customers.filter(c => fold(c.name) === t);
  if (!hits.length) hits = customers.filter(c => fold(c.name).includes(t) || t.includes(fold(c.name)));
  if (hits.length !== 1) return { choose: true, reason: hits.length ? 'Birden fazla müşteriyle eşleşiyor' : 'Sistemde bu adla müşteri yok' };
  const projects = Store.projects({ customerId: hits[0].id, activeOnly: true });
  if (projects.length === 1) return { project: projects[0] };
  return { choose: true, reason: projects.length ? `${hits[0].name} için ${projects.length} aktif proje var` : `${hits[0].name} için aktif proje yok` };
}

function resolveType(value) {
  const t = fold(cellText(value));
  if (!t) return { id: null };
  const hit = ACTIVITY_TYPES.find(x => x.id === t || fold(x.name) === t)
    || ACTIVITY_TYPES.find(x => fold(x.name).startsWith(t) || t.startsWith(fold(x.name).split(' ')[0]));
  return hit ? { id: hit.id } : { id: null, unknown: cellText(value) };
}

/* ---------- Satırları doğrulama ----------
   status: ok · warn (aktarılabilir) · map (proje seçilmeli) · dup (zaten var) · sample (şablon örneği) · error */
function buildImportDrafts(sheets, userId, { month = null, defaultType, mapping = {} } = {}) {
  const existing = Store.activities({ userId });
  const dayHours = {};
  const drafts = [];
  const info = { usesDayNumbers: false, usesDefaultType: false, sheets: [] };

  sheets.forEach((sheet, si) => {
    const detected = detectColumns(sheet.rows, { allowPositional: sheets.length === 1 });
    if (!detected) return;
    const { map, body } = detected;
    info.sheets.push(sheet.name);
    const byCustomer = !map.projectCols.length;

    for (const { cells, line } of body) {
      const get = key => (map[key] == null ? '' : cells[map[key]]);
      // Aylık formda çalışılmayan günler yalnızca gün numarasıyla durur: süre ve açıklama yoksa atla
      if (!cellText(get('hours')) && !cellText(get('note'))) continue;

      const d = {
        key: `${si}:${line}`, line: sheets.length > 1 ? `${sheet.name} · ${line}` : String(line), errors: [], warnings: [],
        raw: {
          date: cellText(get('date')),
          // Müşteri hücresi boşsa sayfa adı kullanılır (aylık formda her sayfa bir müşteri)
          project: byCustomer ? cellText(get('customer')) || (sheets.length > 1 ? sheet.name : '') : map.projectCols.map(i => cellText(cells[i])).filter(Boolean).join(' / '),
          hours: cellText(get('hours')),
        },
      };

      const date = parseDateCell(get('date'), month);
      if (date && isLocked(userId, date.iso)) { d.date = date.iso; d.errors.push(`${monthTitle(date.iso)} kapatılmış (kilitli)`); }
      else if (date) { d.date = date.iso; if (date.dayNumber) info.usesDayNumbers = true; }
      else if (/^\d{1,2}$/.test(d.raw.date) && !month) { info.usesDayNumbers = true; d.errors.push('Dönem (ay) seçilmeli'); }
      else d.errors.push(d.raw.date ? `Tarih okunamadı: ${d.raw.date}` : 'Tarih boş');

      if (byCustomer) {
        d.customerKey = fold(d.raw.project);
        const r = resolveCustomer(d.raw.project, mapping);
        if (r.project) d.projectId = r.project.id; else d.mapReason = r.reason;
      } else {
        const r = resolveProject(map.projectCols.map(i => cells[i]), cellText(get('customer')));
        if (r.error) d.errors.push(r.error); else d.projectId = r.project.id;
      }

      const h = Math.round(parseHoursCell(get('hours')) * 4) / 4;   // çeyrek saate yuvarla
      if (h > 0 && h <= 24) d.hours = h;
      else d.errors.push(d.raw.hours ? `Süre geçersiz: ${d.raw.hours}` : 'Süre boş');

      const ty = resolveType(get('type'));
      if (!ty.id) info.usesDefaultType = true;
      d.type = ty.id || defaultType;
      if (ty.unknown) d.warnings.push(`"${ty.unknown}" türü tanınmadı → ${activityTypeName(d.type)}`);
      d.note = cellText(get('note')).slice(0, NOTE_MAX).trim();

      if (!d.errors.length && d.projectId) {
        d.duplicate = existing.some(a => a.date === d.date && a.projectId === d.projectId && a.hours === d.hours && sameText(a.note, d.note));
        d.sample = fold(d.note).startsWith('ornek satir');
        if (!d.duplicate && !d.sample) {
          dayHours[d.date] = (dayHours[d.date] ?? hoursOn(userId, d.date)) + d.hours;
          if (dayHours[d.date] > 12) d.warnings.push(`${fmtShort(d.date)} toplamı ${fmtNum(dayHours[d.date])} sa`);
        }
        const off = dailyTarget(userId, d.date) === 0 ? dayOffReason(userId, d.date) : null;
        if (off) d.warnings.push(off);
      }
      d.status = d.errors.length ? 'error' : !d.projectId ? 'map' : d.duplicate ? 'dup' : d.sample ? 'sample' : d.warnings.length ? 'warn' : 'ok';
      d.include = d.status === 'ok' || d.status === 'warn';
      drafts.push(d);
    }
  });
  return { drafts, info };
}

/* ---------- İçe aktarma penceresi ---------- */

function projectOptions(selectedId) {
  return groupByCustomer(Store.projects({ activeOnly: true })).map(g =>
    `<optgroup label="${esc(g.title)}">${g.items.map(p => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${esc(p.name)} · ${esc(p.code)}</option>`).join('')}</optgroup>`).join('');
}

function openImportDialog(userId, onDone, { defaultMonth = null } = {}) {
  const recent = recentProjectIds(userId).map(id => Store.project(id)).filter(p => p?.status === 'aktif');
  const [p1, p2] = [recent[0], recent[1] || recent[0]].map(p => p?.code || 'KZY-BW');
  const day = todayISO().split('-').reverse().join('.');
  const example = `${day}\t${p1}\t6\tGeliştirme\tADSO modelleme\n${day}\t${p2}\t2\tToplantı\tHaftalık durum toplantısı`;

  let sheets = [], source = '';
  const opts = {
    month: null,
    defaultType: Prefs.get(userId).lastType || ACTIVITY_TYPES[0].id,
    mapping: { ...(Prefs.get(userId).importMap || {}) },   // müşteri adı → proje; sonraki aylarda hatırlanır
  };
  const overrides = {};   // kullanıcının satır seçimi: key → true/false
  let drafts = [], info = {};

  openModal({
    title: 'Excel’den toplu aktivite yükle',
    size: 'wide',
    body: `
      <div data-step="input">
        <label class="dropzone" data-drop>
          <input type="file" accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt" hidden>
          <span class="dz-ic">${icon('sheet', 26)}</span>
          <strong data-dz-title>Aylık aktivite formunu ya da herhangi bir Excel/CSV dosyasını buraya sürükle</strong>
          <span class="muted">veya <span class="link">bilgisayarından seç</span> · .xlsx, .xls, .csv</span>
        </label>
        <div class="or import-or"><span>ya da</span></div>
        <label class="field">
          <span class="field-label">Excel’de satırları seç, kopyala (Ctrl+C) ve buraya yapıştır (Ctrl+V)</span>
          <textarea class="input mono" rows="4" data-paste placeholder="${esc(example)}"></textarea>
        </label>
        <div class="import-help">
          <span><strong>Tanınan biçimler:</strong> şirketin <em>${FORM_TITLE}</em> (müşteri başına sayfa, GÜN · MÜŞTERİ · AÇIKLAMA · SÜRE) ya da Tarih · Proje Kodu · Süre · Tür · Açıklama sütunlu her tablo.</span>
          <button type="button" class="btn ghost sm" data-template>${icon('download', 15)} Boş şablonu indir</button>
        </div>
        <p class="form-error" hidden></p>
      </div>
      <div data-step="preview" hidden></div>`,
    footer: `<span class="import-summary" data-summary></span><span class="grow"></span>
      <button class="btn ghost" data-back hidden>${icon('chevron-left', 15)} Geri</button>
      <button class="btn ghost" data-preview>Önizle</button>
      <button class="btn primary" data-run hidden></button>`,
    onMount(m, close) {
      const inputStep = m.querySelector('[data-step="input"]'), previewStep = m.querySelector('[data-step="preview"]');
      const fileInput = m.querySelector('input[type=file]'), drop = m.querySelector('[data-drop]'), dzTitle = m.querySelector('[data-dz-title]');
      const dzText = dzTitle.textContent;
      const paste = m.querySelector('[data-paste]'), err = m.querySelector('.form-error'), summary = m.querySelector('[data-summary]');
      const btnBack = m.querySelector('[data-back]'), btnPreview = m.querySelector('[data-preview]'), btnRun = m.querySelector('[data-run]');
      const fail = msg => { err.textContent = msg; err.hidden = false; };

      function load(newSheets, newSource, fileMonth) {
        sheets = newSheets;
        source = newSource;
        opts.month = fileMonth || defaultMonth;
        rebuild();
        if (!drafts.length) return fail('Okunacak satır bulunamadı. Başlık satırında Tarih/Gün ve Süre sütunları olduğundan emin ol.');
        err.hidden = true;
        inputStep.hidden = btnPreview.hidden = true;
        previewStep.hidden = btnBack.hidden = btnRun.hidden = false;
        renderPreview();
      }
      function rebuild() {
        ({ drafts, info } = buildImportDrafts(sheets, userId, opts));
        drafts.forEach(d => { if (d.key in overrides && d.status !== 'error' && d.status !== 'map') d.include = overrides[d.key]; });
      }
      async function loadFile(file) {
        if (!file) return;
        drop.classList.add('is-busy');
        dzTitle.textContent = `${file.name} okunuyor…`;
        try { load(await readImportFile(file), file.name, monthFromFileName(file.name)); }
        catch (e) { fail(e.message || 'Dosya okunamadı.'); }
        finally { drop.classList.remove('is-busy'); dzTitle.textContent = dzText; fileInput.value = ''; }
      }
      const loadPaste = () => (paste.value.trim()
        ? load([{ name: 'Yapıştırılan veri', rows: parseDelimited(paste.value) }], 'Yapıştırılan veri', null)
        : fail('Önce bir dosya seç ya da Excel’den satır yapıştır.'));

      fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
      m.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
      m.addEventListener('dragleave', e => { if (!m.contains(e.relatedTarget)) drop.classList.remove('is-over'); });
      m.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-over'); if (!inputStep.hidden) loadFile(e.dataTransfer.files[0]); });
      paste.addEventListener('paste', () => setTimeout(() => paste.value.trim() && loadPaste()));
      btnPreview.addEventListener('click', loadPaste);
      m.querySelector('[data-template]').addEventListener('click', () => downloadTemplate(userId).catch(e => toast(e.message, { tone: 'danger' })));
      btnBack.addEventListener('click', () => {
        previewStep.hidden = btnBack.hidden = btnRun.hidden = true;
        inputStep.hidden = btnPreview.hidden = false;
        summary.textContent = '';
        paste.focus();
      });

      function mappingGroups() {
        const groups = new Map();
        drafts.filter(d => d.customerKey !== undefined).forEach(d => {
          const g = groups.get(d.customerKey) || { key: d.customerKey, label: d.raw.project || '(boş)', count: 0, projectId: d.projectId, reason: d.mapReason };
          g.count++;
          groups.set(d.customerKey, g);
        });
        return [...groups.values()];
      }

      function renderPreview() {
        const count = st => drafts.filter(d => d.status === st).length;
        const stat = (st, label, tone) => (count(st) ? pill(`${count(st)} ${label}`, tone) : '');
        const groups = mappingGroups();
        previewStep.innerHTML = `
          <div class="import-head">
            <span class="muted">${esc(source)} · ${info.sheets.length > 1 ? `${info.sheets.length} sayfa (${esc(info.sheets.join(', '))}) · ` : ''}${drafts.length} dolu satır</span>
            <div class="row-gap">${stat('ok', 'hazır', 'ok')}${stat('warn', 'uyarılı', 'warn')}${stat('map', 'proje bekliyor', 'warn')}${stat('dup', 'zaten kayıtlı', 'muted')}${stat('sample', 'şablon örneği', 'muted')}${stat('error', 'hatalı', 'danger')}</div>
          </div>
          ${info.usesDayNumbers || info.usesDefaultType ? `<div class="import-options">
            ${info.usesDayNumbers ? `<label class="field"><span class="field-label">Dönem <span class="faint">(GÜN sütunu bu aya yerleşir)</span></span><input class="input" type="month" data-opt="month" value="${opts.month || ''}"></label>` : ''}
            ${info.usesDefaultType ? `<label class="field"><span class="field-label">Türü belirtilmeyen satırlar</span><select class="input" data-opt="type">${ACTIVITY_TYPES.map(t => `<option value="${t.id}"${t.id === opts.defaultType ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
          </div>` : ''}
          ${groups.length ? `<div class="import-map">
            <div class="import-map-title"><strong>Müşteri → proje eşleştirmesi</strong><span class="muted">Bir kez seç; sonraki aylarda hatırlanır.</span></div>
            ${groups.map(g => `<div class="map-row${g.projectId ? '' : ' is-pending'}">
              <span class="map-name"><strong>${esc(g.label)}</strong><small>${g.count} satır</small></span>
              <span class="map-arrow">${icon('arrow-right', 16)}</span>
              <select class="input" data-map="${esc(g.key)}"><option value="">Proje seç…</option>${projectOptions(g.projectId)}</select>
              ${g.projectId ? `<span class="map-ok">${icon('check', 15)}</span>` : `<small class="warn-text">${esc(g.reason || 'Proje seç')}</small>`}
            </div>`).join('')}
          </div>` : ''}
          <div class="import-table"><table class="table">
            <thead><tr><th><input type="checkbox" data-all aria-label="Tümünü seç"></th><th>Satır</th><th>Tarih</th><th>Proje</th><th class="num">Süre</th><th>Tür</th><th>Açıklama</th><th>Durum</th></tr></thead>
            <tbody>${drafts.map(draftRow).join('')}</tbody>
          </table></div>`;
        syncSelection();
      }

      function draftRow(d, i) {
        const p = d.projectId && Store.project(d.projectId), c = p && Store.customer(p.customerId);
        const tone = { ok: 'ok', warn: 'warn', map: 'warn', dup: 'muted', sample: 'muted', error: 'danger' }[d.status];
        const label = { ok: 'Hazır', warn: 'Uyarı', map: 'Proje seç', dup: 'Zaten var', sample: 'Örnek', error: 'Hata' }[d.status];
        const msg = [...d.errors, ...d.warnings].join(' · ') || (d.status === 'dup' ? 'Aynı kayıt sistemde var' : d.status === 'sample' ? 'Şablondaki örnek satır' : d.status === 'map' ? 'Yukarıdan müşterinin projesini seç' : '');
        const bad = v => `<span class="err-text">${esc(v || '—')}</span>`;
        const locked = d.status === 'error' || d.status === 'map';
        return `<tr class="is-${d.status}">
          <td><input type="checkbox" data-i="${i}"${d.include ? ' checked' : ''}${locked ? ' disabled' : ''} aria-label="Satır ${esc(d.line)}"></td>
          <td class="muted nowrap">${esc(d.line)}</td>
          <td class="nowrap">${d.date ? `${dayName(d.date, true)} ${fmtShort(d.date)}` : bad(d.raw.date)}</td>
          <td>${p ? `<span class="cell-proj"><span class="dot" style="background:${c.color}"></span><span><strong>${esc(p.name)}</strong><small>${esc(c.name)}</small></span></span>` : `<span class="warn-text">${esc(d.raw.project || '—')}</span>`}</td>
          <td class="num">${d.hours ? fmtNum(d.hours) : bad(d.raw.hours)}</td>
          <td class="nowrap">${esc(activityTypeName(d.type))}</td>
          <td class="import-note" title="${esc(d.note)}">${esc(d.note) || '<span class="faint">—</span>'}</td>
          <td><span class="import-status">${pill(label, tone)}${msg ? `<small>${esc(msg)}</small>` : ''}</span></td>
        </tr>`;
      }

      function syncSelection() {
        const chosen = drafts.filter(d => d.include), selectable = drafts.filter(d => d.status !== 'error' && d.status !== 'map');
        btnRun.disabled = !chosen.length;
        btnRun.innerHTML = `${icon('check', 15)} ${chosen.length} kaydı içe aktar`;
        summary.textContent = chosen.length ? `${chosen.length} kayıt · toplam ${fmtNum(sum(chosen, d => d.hours))} sa` : 'Aktarılacak satır seçilmedi';
        const all = previewStep.querySelector('[data-all]');
        all.checked = selectable.length > 0 && selectable.every(d => d.include);
        all.indeterminate = !all.checked && chosen.length > 0;
        all.disabled = !selectable.length;
      }

      previewStep.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.opt === 'month') { opts.month = t.value || null; rebuild(); return renderPreview(); }
        if (t.dataset.opt === 'type') { opts.defaultType = t.value; rebuild(); return renderPreview(); }
        if (t.dataset.map !== undefined) {
          if (t.value) opts.mapping[t.dataset.map] = t.value; else delete opts.mapping[t.dataset.map];
          rebuild();
          return renderPreview();
        }
        if (t.matches('[data-all]')) drafts.forEach(d => { if (d.status !== 'error' && d.status !== 'map') { d.include = t.checked; overrides[d.key] = t.checked; } });
        else if (t.dataset.i) { const d = drafts[Number(t.dataset.i)]; d.include = t.checked; overrides[d.key] = t.checked; }
        previewStep.querySelectorAll('[data-i]').forEach(cb => { cb.checked = drafts[Number(cb.dataset.i)].include; });
        syncSelection();
      });

      btnRun.addEventListener('click', () => {
        const created = drafts.filter(d => d.include).map(d =>
          Store.addActivity({ userId, projectId: d.projectId, date: d.date, hours: d.hours, type: d.type, note: d.note }));
        // Yalnızca elle seçilen eşleştirmeler saklanır; otomatik olanlar zaten her seferinde bulunur
        const saved = { ...(Prefs.get(userId).importMap || {}) };
        mappingGroups().forEach(g => { if (opts.mapping[g.key]) saved[g.key] = opts.mapping[g.key]; });
        Prefs.set(userId, { importMap: saved });
        close();
        onDone(created);
      });

      paste.focus();
    },
  });
}

/* ---------- Şablon ve dışa aktarma ---------- */

function dateColumnToExcel(ws, XLSX, rowCount) {
  for (let r = 1; r < rowCount; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[ref]) ws[ref] = { t: 'n', v: isoToSerial(ws[ref].v), z: 'dd.mm.yyyy' };
  }
}

const sheetName = name => name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
const fileSafe = name => name.replace(/[\\/:*?"<>|]+/g, ' ').trim();

async function downloadTemplate(userId) {
  const XLSX = await loadXLSX();
  const active = Store.projects({ activeOnly: true });
  const recent = recentProjectIds(userId).map(id => Store.project(id)).find(p => p?.status === 'aktif') || active[0];
  const rows = [
    ['Tarih', 'Proje Kodu', 'Süre (saat)', 'Tür', 'Açıklama'],
    [todayISO(), recent.code, 8, ACTIVITY_TYPES[0].name, 'ÖRNEK SATIR — silebilirsin, içe aktarılmaz'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  dateColumnToExcel(ws, XLSX, rows.length);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 11 }, { wch: 18 }, { wch: 50 }];

  const projects = XLSX.utils.aoa_to_sheet([['Proje Kodu', 'Proje', 'Müşteri'], ...active.map(p => [p.code, p.name, Store.customer(p.customerId).name])]);
  projects['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 22 }];
  const types = XLSX.utils.aoa_to_sheet([['Tür'], ...ACTIVITY_TYPES.map(t => [t.name])]);
  types['!cols'] = [{ wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aktiviteler');
  XLSX.utils.book_append_sheet(wb, projects, 'Projeler');
  XLSX.utils.book_append_sheet(wb, types, 'Türler');
  XLSX.writeFile(wb, 'bisolera-aktivite-sablonu.xlsx');
}

// Onaylanmış ayda formun üstüne onaylayan ve tarih yazılır (Excel ve yazdırılan form)
function formApprovalText(user, iso) {
  const period = Store.period(user.id, iso.slice(0, 7));
  if (period?.status === 'onaylandi') return `Onaylandı: ${fmtDate(toISO(new Date(period.decidedAt)))} (${Store.user(period.decidedBy)?.name || ''})`;
  return period?.status === 'gonderildi' ? 'Onay bekliyor' : 'Taslak';
}

// Şirketin aylık formu: müşteri başına bir sayfa, D2 başlık, D5 toplam, 6. satır başlık, 7. satırdan itibaren ayın günleri
async function exportMonthlyForm(user, iso) {
  const from = monthStart(iso), to = monthEnd(iso);
  const items = Store.activities({ userId: user.id, from, to });
  if (!items.length) { toast(`${monthTitle(iso)} için kayıt yok`, { tone: 'info' }); return; }
  const XLSX = await loadXLSX();
  const days = dateRange(from, to);
  const byCustomer = new Map();
  items.forEach(a => {
    const cid = Store.project(a.projectId).customerId;
    if (!byCustomer.has(cid)) byCustomer.set(cid, []);
    byCustomer.get(cid).push(a);
  });

  const approval = ` · ${formApprovalText(user, iso)}`;
  const wb = XLSX.utils.book_new();
  [...byCustomer].map(([cid, list]) => [Store.customer(cid), list])
    .sort((a, b) => a[0].name.localeCompare(b[0].name, 'tr'))
    .forEach(([customer, list]) => {
      const aoa = [[], [null, null, null, FORM_TITLE], [null, null, null, `${user.name} · ${monthTitle(iso)}${approval}`], [], [null, null, 'TOPLAM', null], ['GÜN', 'MÜŞTERİ', 'AÇIKLAMA', 'SÜRE (SAAT)']];
      days.forEach(d => {
        const dayItems = list.filter(a => a.date === d).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const n = parseISO(d).getDate();
        aoa.push(dayItems.length ? [n, customer.name, dayItems.map(a => a.note).filter(Boolean).join(' '), sum(dayItems, a => a.hours)] : [n]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const last = 6 + days.length;
      ws.D5 = { t: 'n', v: sum(list, a => a.hours), f: `SUM(D7:D${last})`, z: '0.00' };
      for (let r = 7; r <= last; r++) if (ws[`D${r}`]) ws[`D${r}`].z = '0.00';
      ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 100 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName(customer.name));
    });
  XLSX.writeFile(wb, fileSafe(`${FORM_TITLE}_${user.name}_${TR_MONTHS[parseISO(iso).getMonth()]}_${parseISO(iso).getFullYear()}.xlsx`));
  toast(`${monthTitle(iso)} aylık formu indirildi · ${byCustomer.size} müşteri sayfası`);
}

// Yönetim raporu: müşteri/proje, danışman bazında ve talep bazında saatler (faturalama için)
async function exportMonthReport(iso) {
  const r = monthReport(iso);
  if (!r.total) { toast(`${monthTitle(iso)} için kayıt yok`, { tone: 'info' }); return; }
  const XLSX = await loadXLSX();
  const projectRows = [['Müşteri', 'Proje', 'Proje Kodu', 'Faturalanır', 'Saat', 'Sözleşme saati', 'Kullanım %']];
  const userRows = [['Danışman', 'Müşteri', 'Proje', 'Proje Kodu', 'Faturalanır', 'Saat']];
  r.groups.forEach(g => g.rows.forEach(row => {
    const b = budgetState(row.project, iso);
    projectRows.push([g.customer.name, row.project.name, row.project.code, row.project.billable ? 'Evet' : 'Hayır', row.hours, b ? b.budget : '', b ? Math.round(b.pct) : '']);
    row.users.forEach((h, uid) => userRows.push([Store.user(uid)?.name || uid, g.customer.name, row.project.name, row.project.code, row.project.billable ? 'Evet' : 'Hayır', h]));
  }));
  projectRows.push([], ['', '', '', 'Faturalanır', r.billable], ['', '', '', 'Faturalanmaz', r.nonBillable], ['', '', '', 'Toplam', r.total]);
  const ticketRows = [['Talep', 'Proje', 'Kayıt sayısı', 'Saat', 'Son çalışma'],
    ...r.tickets.map(t => [t.id, [...t.projects].map(pid => Store.project(pid).name).join(', '), t.entries, Math.round(t.hours * 100) / 100, t.last])];

  const wb = XLSX.utils.book_new();
  const add = (rows, name, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = cols.map(wch => ({ wch })); XLSX.utils.book_append_sheet(wb, ws, name); };
  add(projectRows, 'Müşteri-Proje', [20, 32, 12, 11, 10, 14, 11]);
  add(userRows, 'Danışman-Proje', [24, 20, 32, 12, 11, 10]);
  add(ticketRows, 'Talepler', [16, 40, 12, 10, 12]);
  XLSX.writeFile(wb, `bisolera-rapor-${iso.slice(0, 7)}.xlsx`);
  toast(`${monthTitle(iso)} raporu indirildi`);
}

// Doluluk raporu: danışman bazında hedef / girilen / faturalanır / doluluk ve faturalanmayan saatlerin dökümü
async function exportUtilization(iso) {
  const t = teamUtilization(iso);
  if (!t.target) { toast(`${monthTitle(iso)} için hedef saat yok`, { tone: 'info' }); return; }
  const XLSX = await loadXLSX();
  const { from, to } = utilizationRange(iso);
  const pct = p => (p == null ? '' : Math.round(p * 100));
  const rows = [['Danışman', 'Hedef (sa)', 'Girilen (sa)', 'Faturalanır (sa)', 'Faturalanmayan (sa)', 'Doluluk %', 'Eksik gün', 'İzin (gün)'],
    ...t.rows.map(r => [r.user.name, r.target, r.logged, r.billable, r.internal, pct(r.pct), r.missing, r.leave]),
    [],
    ['Ekip', t.target, t.logged, t.billable, t.logged - t.billable, pct(t.pct)],
    ['Dönem', `${fmtDate(from)} – ${fmtDate(to)}`],
    ['Uyarı sınırı', `%${Math.round(UTILIZATION_TARGET * 100)} altı`]];
  const internal = [['Proje', 'Müşteri', 'Saat', 'Danışmanlar (saat)'],
    ...internalBreakdown(iso).map(r => [r.project.name, r.customer.name, r.hours, [...r.users].map(([id, h]) => `${Store.user(id)?.name || id} ${h}`).join(', ')])];

  const wb = XLSX.utils.book_new();
  const add = (aoa, name, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map(wch => ({ wch })); XLSX.utils.book_append_sheet(wb, ws, name); };
  add(rows, 'Doluluk', [24, 11, 12, 15, 18, 10, 10, 10]);
  add(internal, 'Faturalanmayan', [32, 20, 10, 50]);
  XLSX.writeFile(wb, `bisolera-doluluk-${iso.slice(0, 7)}.xlsx`);
  toast(`${monthTitle(iso)} doluluk raporu indirildi`);
}

// Masraf raporu (muhasebe için): tüm kalemler, kişi özeti, müşteriye yansıtılacaklar. Reddedilenler hariç.
async function exportExpenses(iso) {
  const r = expenseMonthReport(iso);
  if (!r.items.length) { toast(`${monthTitle(iso)} için masraf yok`, { tone: 'info' }); return; }
  const XLSX = await loadXLSX();
  const where = x => { const p = x.projectId && Store.project(x.projectId); return p ? [Store.customer(p.customerId).name, p.name] : ['', '']; };
  const rows = [['Tarih', 'Danışman', 'Kategori', 'Açıklama', 'Müşteri', 'Proje', 'Müşteriye yansıtılacak', 'Fiş', 'Durum', 'Tutar (TL)'],
    ...r.items.map(x => [x.date, Store.user(x.userId)?.name || x.userId, expenseCategoryName(x.category), x.description, ...where(x),
      x.rebill ? 'Evet' : 'Hayır', x.receipt ? 'Var' : 'Yok', EXPENSE_STATUS[x.status].label, x.amount])];
  const cats = EXPENSE_CATEGORIES.filter(c => r.people.some(p => p.byCategory[c.id]));
  const people = [['Danışman', ...cats.map(c => c.name), 'Toplam', 'Onay bekleyen', 'Ödenecek', 'Ödendi', 'Fişsiz kalem'],
    ...r.people.map(p => [p.user.name, ...cats.map(c => p.byCategory[c.id] || 0), p.total, p.pending, p.toPay, p.paid, p.noReceipt]),
    [], ['Toplam', ...cats.map(c => sum(r.people, p => p.byCategory[c.id] || 0)), r.total]];
  const rebill = [['Müşteri', 'Proje', 'Tarih', 'Danışman', 'Kategori', 'Açıklama', 'Tutar (TL)'],
    ...r.rebill.flatMap(c => [...c.items.map(x => [c.customer.name, where(x)[1], x.date, Store.user(x.userId)?.name || '', expenseCategoryName(x.category), x.description, x.amount]),
      [c.customer.name, 'Toplam', '', '', '', '', c.total], []])];

  const wb = XLSX.utils.book_new();
  const add = (aoa, name, cols, dateCol) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (dateCol) dateColumnToExcel(ws, XLSX, aoa.length);
    ws['!cols'] = cols.map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(rows, 'Masraflar', [12, 22, 16, 44, 20, 28, 12, 8, 14, 12], true);
  add(people, 'Kişi özeti', [22, ...cats.map(() => 14), 14, 14, 14, 14, 12]);
  add(rebill, 'Müşteriye yansıtılacak', [22, 28, 12, 22, 16, 44, 12]);
  XLSX.writeFile(wb, `bisolera-masraf-${iso.slice(0, 7)}.xlsx`);
  toast(`${monthTitle(iso)} masraf raporu indirildi`);
}

// Ham liste: her kayıt bir satır + proje bazında özet sayfası
async function exportActivities(user, from, to, tag) {
  const items = Store.activities({ userId: user.id, from, to }).slice().sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  if (!items.length) { toast('Bu aralıkta dışa aktarılacak kayıt yok', { tone: 'info' }); return; }
  const XLSX = await loadXLSX();

  const rows = [['Tarih', 'Müşteri', 'Proje', 'Proje Kodu', 'Tür', 'Süre (saat)', 'Açıklama', 'Faturalanır']];
  items.forEach(a => {
    const p = Store.project(a.projectId), c = Store.customer(p.customerId);
    rows.push([a.date, c.name, p.name, p.code, activityTypeName(a.type), a.hours, a.note, p.billable ? 'Evet' : 'Hayır']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  dateColumnToExcel(ws, XLSX, rows.length);
  ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 11 }, { wch: 50 }, { wch: 11 }];
  ws['!autofilter'] = { ref: `A1:H${rows.length}` };

  const byProject = {};
  items.forEach(a => { byProject[a.projectId] = (byProject[a.projectId] || 0) + a.hours; });
  const summary = XLSX.utils.aoa_to_sheet([['Müşteri', 'Proje', 'Proje Kodu', 'Toplam saat'],
    ...Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([pid, h]) => {
      const p = Store.project(pid);
      return [Store.customer(p.customerId).name, p.name, p.code, h];
    }),
    [],
    ['', '', 'Genel toplam', sum(items, a => a.hours)]]);
  summary['!cols'] = [{ wch: 20 }, { wch: 32 }, { wch: 14 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aktiviteler');
  XLSX.utils.book_append_sheet(wb, summary, 'Özet');
  XLSX.writeFile(wb, `aktiviteler-${fold(user.name).replace(/[^a-z0-9]+/g, '-')}-${tag}.xlsx`);
  toast(`${items.length} kayıt Excel'e aktarıldı`);
}
