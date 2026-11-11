/* CV: danışman Yetkinlikler → CV'de formdan doldurur; dosya yüklenmez. Çıktı şirketin "Consultant Profile" düzeninde:
   ad ve iletişim, profil yazısı, SAP deneyim özeti, her proje için bir tablo (müşteri, dönem, sektör, proje, rol, sorumluluklar),
   kurslar, iş deneyimi ve sertifikalar, kişisel bilgiler. Türkçe ya da İngilizce başlıklarla PDF (yazdır) ve Word (.docx).
   Veri kişi kaydında: user.summary (profil yazısı) ve user.resume (aşağıdaki alanlar). */

// CV'yi kendisi ve yönetici görür ve düzenler: telefon, doğum tarihi gibi kişisel bilgiler var (KVKK)
const canSeeCv = (viewer, owner) => viewer.role === 'admin' || viewer.id === owner.id;

const CV_TEXT = {
  tr: { title: 'Danışman Profili', profile: 'Profil', areas: 'SAP Deneyim Özeti', projects: 'SAP Proje Deneyimi', customer: 'Müşteri', duration: 'Dönem',
    sector: 'Sektör', project: 'Proje', role: 'Rol', work: 'Sorumluluklar', courses: 'Eğitimler ve Kurslar', experience: 'İş Deneyimi ve Sertifikalar',
    cert: 'Sertifika', personal: 'Kişisel Bilgiler', education: 'Eğitim', marital: 'Medeni durum', nation: 'Uyruk', birth: 'Doğum tarihi',
    languages: 'Diller', present: 'Devam ediyor', hidden: 'Müşteri adı gizli' },
  en: { title: 'Consultant Profile', profile: 'Profile', areas: 'SAP Experience – Summary', projects: 'SAP Project Experience', customer: 'Customer', duration: 'Duration',
    sector: 'Sector', project: 'Project', role: 'Role', work: 'Responsibilities', courses: 'Trainings', experience: 'Professional Experience and Certifications',
    cert: 'Certification', personal: 'Personal Information', education: 'Education', marital: 'Marital status', nation: 'Nationality', birth: 'Date of Birth',
    languages: 'Languages', present: 'Present', hidden: 'Confidential client' },
};

// CV görünümü: logo ve renkler, PDF ve Word'de aynı. Logo dosyaları img/cv/ altında, Word'e gömülür.
// ratio: logonun eni / boyu; h: logo yüksekliği (mm). soft: etiket sütununun zemini, line: satır çizgileri.
const CV_THEMES = {
  bisolera: { label: 'Bisolera', logo: 'img/cv/bisolera.png', ratio: 5.531, h: 8, accent: '2B8A3E', ink: '0A2E0F', soft: 'EEF7EE', line: '8CC596' },
  sap: { label: 'SAP', logo: 'img/cv/sap.png', ratio: 2.02, h: 12, accent: '0A6ED1', ink: '0B2D5C', soft: 'EAF2FB', line: '8DB8E6' },
  plain: { label: 'Logosuz', logo: null, ratio: 0, h: 0, accent: '333333', ink: '111111', soft: '', line: '9A9A9A' },
};
const cvThemeId = id => (CV_THEMES[id] ? id : 'bisolera');

/* ---------- Ay alanı: "aa.yyyy" yazılır, "yyyy-aa" saklanır ---------- */

const fmtMonthInput = ym => (ym ? `${ym.slice(5, 7)}.${ym.slice(0, 4)}` : '');
// "05.2019", "5/2019", "2019-05" → "2019-05"; olmayan ay → null
function parseMonthInput(text) {
  const s = String(text || '').trim();
  let m = s.match(/^(\d{1,2})[./\- ](\d{4})$/), mo, y;
  if (m) [mo, y] = [Number(m[1]), Number(m[2])];
  else if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) [y, mo] = [Number(m[1]), Number(m[2])];
  else return null;
  return mo >= 1 && mo <= 12 && y >= 1950 && y <= 2100 ? `${y}-${String(mo).padStart(2, '0')}` : null;
}
const cvPeriod = (r, lang = 'tr') => `${fmtMonthInput(r.from)} – ${r.to ? fmtMonthInput(r.to) : CV_TEXT[lang].present}`;

/* ---------- Veri ---------- */

// user.resume: { headline, phone, languages, birthDate, nationality, marital, areas (satır satır),
//   projects: [{ id, customer, sector, project, role, from, to, work, portalId? }], jobs: [{ id, company, title, from, to }],
//   education: [{ id, school, department, degree, from, to }], courses: [{ id, name, detail }] }   (to boşsa "devam ediyor")
const resumeOf = user => ({ projects: [], jobs: [], education: [], courses: [], ...(user.resume || {}) });
function saveResume(userId, changes) {
  Store.updateUser(userId, { resume: { ...resumeOf(Store.user(userId)), ...changes } });
}
const textLines = text => String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
// Sürenler önce, sonra bitişi yeni olan
const byNewest = (a, b) => (b.to || '9999').localeCompare(a.to || '9999') || (b.from || '').localeCompare(a.from || '');

// Portalda saat yazılmış müşteri projeleri (iç projeler hariç): CV'ye tek tıkla eklenir. Son 31 günde saati olan sürüyor sayılır.
function portalCvProjects(userId, today = todayISO()) {
  const map = new Map();
  Store.activities({ userId, to: today }).forEach(a => {
    const project = Store.project(a.projectId), customer = project && Store.customer(project.customerId);
    if (!project || !customer || customer.internal) return;
    const row = map.get(project.id) || { project, customer, from: a.date, to: a.date, hours: 0 };
    row.hours += a.hours;
    if (a.date < row.from) row.from = a.date;
    if (a.date > row.to) row.to = a.date;
    map.set(project.id, row);
  });
  return [...map.values()].map(r => ({ ...r, ongoing: r.to >= addDays(today, -31) })).sort((a, b) => b.to.localeCompare(a.to));
}
// Henüz CV'ye eklenmemiş olanlar
const portalCvImportable = user => {
  const linked = new Set(resumeOf(user).projects.map(p => p.portalId).filter(Boolean));
  return portalCvProjects(user.id).filter(r => !linked.has(r.project.id));
};
const cvProjectFromPortal = (r, user) => ({
  id: uid(), customer: r.customer.name, sector: r.customer.sector || '', project: r.project.name, role: resumeOf(user).headline || user.title,
  from: r.from.slice(0, 7), to: r.ongoing ? '' : r.to.slice(0, 7), work: '', portalId: r.project.id,
});

// "SAP deneyim özeti" önerisi: Orta ve Uzman yetkinlikler, önce Uzman
const skillAreaLines = user => [3, 2].flatMap(n => SKILLS.filter(s => (user.skills?.[s.id] || 0) === n).map(s => s.name));

// CV'de eksik olanlar: CV sekmesinin başında ve ekip matrisinde gösterilir
function cvMissing(user) {
  const r = resumeOf(user), miss = [];
  if (!user.summary) miss.push('Profil yazısı');
  if (!r.projects.length) miss.push('Proje');
  else if (r.projects.some(p => !textLines(p.work).length)) miss.push('Proje sorumlulukları');
  if (!r.education.length) miss.push('Eğitim');
  if (!r.phone) miss.push('Telefon');
  if (!r.languages) miss.push('Diller');
  return miss;
}

/* ---------- Çıktı ---------- */

// PDF ve Word aynı içeriği kullanır. Tablo satırı: [etiket, değer]; ikisi de metin ya da satır listesi olabilir.
// opts: lang 'tr' | 'en', theme 'bisolera' | 'sap' | 'plain', hideCustomers (başka müşteriye giden teklif), contact (e-posta, telefon),
// personal (doğum tarihi, medeni durum, uyruk)
function cvDoc(user, { lang = 'tr', theme = 'bisolera', hideCustomers = false, contact = true, personal = true } = {}, today = todayISO()) {
  const T = CV_TEXT[lang], r = resumeOf(user), pick = (map, id) => map[id]?.[lang === 'en' ? 1 : 0] || '';
  const headline = r.headline || user.title;
  const bullets = text => { const l = textLines(text); return l.length > 1 ? l.map(x => (/^[-–•]/.test(x) ? x : `– ${x}`)) : l; };
  // Bisolera satırı portaldan gelir (giriş tarihi ve unvan); kişi kendisi eklediyse onunki kullanılır
  const jobs = user.startDate && !r.jobs.some(j => /bisolera/i.test(j.company))
    ? [{ company: 'Bisolera', title: headline, from: user.startDate.slice(0, 7), to: '' }, ...r.jobs] : r.jobs;
  const certs = Store.certs({ userId: user.id }).filter(c => certValid(c, today)).sort((a, b) => (b.issued || '').localeCompare(a.issued || ''));
  const education = r.education.slice().sort((a, b) => (b.to || b.from || '').localeCompare(a.to || a.from || '')).map(e => {
    const extra = [pick(CV_DEGREES, e.degree), [e.from, e.to].filter(Boolean).join('–')].filter(Boolean).join(', ');
    return `${[e.school, e.department].filter(Boolean).join(' – ')}${extra ? ` (${extra})` : ''}`;
  });
  const personalRows = [
    [T.education, education],
    ...(personal ? [[T.marital, pick(CV_MARITAL, r.marital)], [T.nation, r.nationality || ''], [T.birth, r.birthDate ? fmtDateInput(r.birthDate) : '']] : []),
    [T.languages, r.languages || ''],
  ].filter(([, v]) => [].concat(v).some(Boolean));
  const experience = [
    ...jobs.slice().sort(byNewest).map(j => [[j.company, cvPeriod(j, lang)], j.title]),
    ...certs.map(c => [[`${c.name}${c.code ? ` (${c.code})` : ''}`, c.issued ? fmtMonthInput(c.issued.slice(0, 7)) : ''], T.cert]),
  ];
  return {
    T, lang, themeId: cvThemeId(theme), theme: CV_THEMES[cvThemeId(theme)], name: user.name, headline, contact: contact ? [user.email, r.phone].filter(Boolean) : [],
    sections: [
      user.summary && { title: T.profile, text: user.summary },
      textLines(r.areas).length && { title: T.areas, list: textLines(r.areas) },
      r.projects.length && { title: T.projects, tables: r.projects.slice().sort(byNewest).map(p => [
        [T.customer, hideCustomers ? T.hidden : p.customer], [T.duration, cvPeriod(p, lang)], [T.sector, p.sector || ''],
        [T.project, p.project], [T.role, p.role || ''], [T.work, bullets(p.work)]]) },
      r.courses.length && { title: T.courses, tables: [r.courses.map(c => [c.name, c.detail || ''])] },
      experience.length && { title: T.experience, tables: [experience] },
      personalRows.length && { title: T.personal, tables: [personalRows] },
    ].filter(Boolean),
  };
}

// Yazdır / PDF: başlık ("Consultant Profile") tablonun başlığı olduğu için her sayfada tekrarlanır
function cvHtml(user, opts = {}) {
  const d = cvDoc(user, opts), t = d.theme;
  const cell = v => [].concat(v).filter(Boolean).map(esc).join('<br>');
  const table = rows => `<table class="cv-table">${rows.map(([k, v]) => `<tr><th>${cell(k)}</th><td>${cell(v)}</td></tr>`).join('')}</table>`;
  const colors = `--cv-accent:#${t.accent};--cv-ink:#${t.ink};--cv-soft:${t.soft ? `#${t.soft}` : 'transparent'};--cv-line:#${t.line};--cv-logo-h:${t.h}mm`;
  return `<table class="cv-doc cv-${d.themeId}" lang="${d.lang}" style="${colors}">
    <thead><tr><td><div class="cv-run">${t.logo ? `<img class="cv-logo" src="${t.logo}" alt="${esc(t.label)}" onerror="this.remove()">` : '<span></span>'}<strong>${esc(d.T.title)}</strong></div></td></tr></thead>
    <tbody><tr><td>
      <div class="cv-id"><h1>${esc(d.name)}</h1>${[d.headline, ...d.contact].filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('')}</div>
      ${d.sections.map(s => `<section class="cv-sec"><h2>${esc(s.title)}</h2>
        ${s.text ? `<p class="cv-text">${esc(s.text)}</p>` : ''}${s.list ? `<ul class="cv-list">${s.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${(s.tables || []).map(table).join('')}</section>`).join('')}
    </td></tr></tbody></table>`;
}

// "CV_Ad Soyad_EN", SAP ve logosuz görünüm ayrıca belirtilir: aynı kişinin iki CV'si karışmasın
const cvFileName = (user, { lang = 'tr', theme = 'bisolera' } = {}, ext = '') =>
  `CV_${user.name}_${lang.toUpperCase()}${{ sap: '_SAP', plain: '_logosuz' }[theme] || ''}${ext}`;
function printCv(user, opts = {}) {
  printPages(cvHtml(user, opts), cvFileName(user, opts));
}

/* ---------- Word (.docx) ----------
   Word belgesi bir zip'tir: içinde XML dosyaları. JSZip (vendor/jszip) yalnızca Word istenince yüklenir.
   Yazı Arial 10, A4; logo ve "Consultant Profile" sayfa başlığında (her sayfada). Proje tabloları bölünmesin diye satırlar
   bir sonrakine bağlıdır (keepNext). Renkler görünüme göre (CV_THEMES). */

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
let jszipPromise = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/jszip/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => { jszipPromise = null; reject(new Error('Word kütüphanesi yüklenemedi (vendor/jszip). Sayfayı yenileyip tekrar dene.')); };
      document.head.appendChild(s);
    });
  }
  return jszipPromise;
}

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const W_TEXT = 9638, W_LABEL = 3000;   // A4 (11906) − 2 × 2 cm kenar boşluğu; etiket sütunu (twip: 1/20 punto)
const xmlEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wRun = (text, { b, size, color } = {}) => `<w:r><w:rPr>${b ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
// pPr içindeki sıra Word için önemli: keepNext, pBdr, tabs, spacing, ind, jc
// border: { color, sz } — alt çizgi (sz: sekizde bir punto)
const wPara = (runs, { keep, border, tabs, before = 0, after = 0, indent, align } = {}) => `<w:p><w:pPr>${keep ? '<w:keepNext/>' : ''}`
  + `${border ? `<w:pBdr><w:bottom w:val="single" w:sz="${border.sz || 6}" w:space="1" w:color="${border.color || '7F7F7F'}"/></w:pBdr>` : ''}${tabs || ''}`
  + `<w:spacing w:before="${before}" w:after="${after}"/>${indent ? `<w:ind w:left="${indent}" w:hanging="${indent}"/>` : ''}${align ? `<w:jc w:val="${align}"/>` : ''}</w:pPr>${runs}</w:p>`;

// Etiket sütunu görünümün açık renginde (soft), satırlar noktalı çizgiyle ayrılır, üst çizgi ana renkte
function wTable(rows, t) {
  const cell = (v, w, keep, label) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${label && t.soft ? `<w:shd w:val="clear" w:color="auto" w:fill="${t.soft}"/>` : ''}</w:tcPr>${
    ([].concat(v).filter(Boolean).length ? [].concat(v).filter(Boolean) : ['']).map(x => wPara(wRun(x, label ? { color: t.ink } : {}), { keep })).join('')}</w:tc>`;
  const line = (val, sz, color) => `w:val="${val}" w:sz="${sz}" w:space="0" w:color="${color}"`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${W_TEXT}" w:type="dxa"/><w:tblBorders><w:top ${line('single', 10, t.accent)}/><w:bottom ${line('dotted', 6, t.line)}/><w:insideH ${line('dotted', 4, t.line)}/></w:tblBorders>`
    + `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid><w:gridCol w:w="${W_LABEL}"/><w:gridCol w:w="${W_TEXT - W_LABEL}"/></w:tblGrid>`
    + rows.map(([k, v], i) => { const keep = i < rows.length - 1; return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(k, W_LABEL, keep, true)}${cell(v, W_TEXT - W_LABEL, keep)}</w:tr>`; }).join('')
    + '</w:tbl>' + wPara('', { after: 200 });   // iki tablo arasında boş paragraf olmazsa Word onları birleştirir
}

// Sayfa başlığındaki logo (satır içi resim). Boyut EMU: 1 mm = 36000
function wImage(rid, mmWide, mmHigh) {
  const cx = Math.round(mmWide * 36000), cy = Math.round(mmHigh * 36000);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">`
    + `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
    + '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + `<pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// Logo dosyası okunamazsa (çevrimdışı, dosya yok) Word logosuz üretilir
async function cvLogoBytes(path) {
  try { const res = await fetch(path); return res.ok ? new Uint8Array(await res.arrayBuffer()) : null; } catch { return null; }
}

async function cvDocxBlob(user, opts = {}) {
  const JSZip = await loadJSZip(), d = cvDoc(user, opts), t = d.theme, logo = t.logo ? await cvLogoBytes(t.logo) : null;
  const body = [
    wPara(wRun(d.name, { b: true, size: 26 }), { align: 'center', before: 120 }),
    ...[d.headline, ...d.contact].filter(Boolean).map(x => wPara(wRun(x, { b: true }), { align: 'center' })),
    ...d.sections.map(s => wPara(wRun(s.title, { b: true, color: t.accent }), { keep: true, border: { color: t.accent, sz: 10 }, before: 360, after: 100 })
      + (s.text ? wPara(wRun(s.text), { align: 'both', after: 80 }) : '')
      + (s.list || []).map(x => wPara(wRun(`–\t${x}`), { indent: 284, tabs: '<w:tabs><w:tab w:val="left" w:pos="284"/></w:tabs>' })).join('')
      + (s.tables || []).map(rows => wTable(rows, t)).join('')),
  ].join('');
  const header = `<w:hdr ${W_NS}>${wPara((logo ? wImage('rIdLogo', t.h * t.ratio, t.h) : '') + '<w:r><w:tab/></w:r>' + wRun(d.T.title, { b: true, size: 36, color: t.accent }),
    { tabs: `<w:tabs><w:tab w:val="right" w:pos="${W_TEXT}"/></w:tabs>`, border: { color: t.accent, sz: 18 }, after: 120 })}</w:hdr>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>');
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr>`
    + `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="${d.lang === 'en' ? 'en-US' : 'tr-TR'}"/></w:rPr></w:rPrDefault>`
    + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>');
  zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${header}`);
  if (logo) {
    zip.file('word/media/logo.png', logo);
    zip.file('word/_rels/header1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>');
  }
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body}`
    + '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/>'
    + '<w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>');
  return zip.generateAsync({ type: 'blob', mimeType: DOCX_TYPE });
}

async function downloadCvDocx(user, opts = {}) {
  downloadBlob(fileSafe(cvFileName(user, opts, '.docx')), await cvDocxBlob(user, opts));
}

// "CV'yi al": görünüm (Bisolera / SAP / logosuz), dil ve neyin gireceği seçilir, sonra PDF ya da Word. Son seçimler kişiye göre hatırlanır.
function openCvDialog(user) {
  const me = App.user, lang = Prefs.get(me.id).cvLang || 'tr', theme = cvThemeId(Prefs.get(me.id).cvTheme), miss = cvMissing(user);
  openModal({
    title: `${user.name} · CV`,
    body: `<form class="form-stack" id="cvOut">
      ${miss.length ? `<div class="callout warn">${icon('alert', 16)}<div>CV'de eksik: ${esc(miss.join(', '))}. Yine de alınabilir.</div></div>` : ''}
      <div class="field"><span class="field-label">Görünüm</span>
        <div class="seg">${Object.entries(CV_THEMES).map(([k, x]) => `<input type="radio" name="theme" id="cvt-${k}" value="${k}"${k === theme ? ' checked' : ''}><label for="cvt-${k}">${x.logo ? `${x.label} logolu` : x.label}</label>`).join('')}</div>
        <span class="field-hint">Bisolera: yeşil ağırlıklı · SAP: SAP mavisi · Logosuz: sade siyah-gri</span></div>
      <div class="field"><span class="field-label">Dil <span class="faint">(başlıklar ve tarihler; yazdıkların olduğu gibi kalır)</span></span>
        <div class="seg">${[['tr', 'Türkçe'], ['en', 'English']].map(([k, label]) => `<input type="radio" name="lang" id="cvl-${k}" value="${k}"${k === lang ? ' checked' : ''}><label for="cvl-${k}">${label}</label>`).join('')}</div></div>
      <label class="toggle"><input type="checkbox" name="contact" checked> İletişim bilgileri (e-posta, telefon)</label>
      <label class="toggle"><input type="checkbox" name="personal" checked> Kişisel bilgiler (doğum tarihi, medeni durum, uyruk)</label>
      <label class="toggle"><input type="checkbox" name="hideCustomers"> Müşteri adlarını gizle <span class="faint">(başka müşteriye giden teklifte; sektör kalır)</span></label>
      <p class="muted small-text">PDF için yazdır penceresinde <strong>PDF olarak kaydet</strong>'i seç. Word dosyası teklife göre son düzeltmeler içindir.</p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button>
      <button class="btn ghost" data-word>${icon('sheet', 15)} Word</button><button class="btn primary" data-print>${icon('printer', 15)} PDF / Yazdır</button>`,
    onMount(m, close) {
      const f = m.querySelector('form');
      const opts = () => ({ lang: f.elements.lang.value, theme: f.elements.theme.value, contact: f.elements.contact.checked, personal: f.elements.personal.checked,
        hideCustomers: f.elements.hideCustomers.checked });
      const go = fn => { const o = opts(); Prefs.set(me.id, { cvLang: o.lang, cvTheme: o.theme }); close(); fn(o); };
      m.querySelector('[data-print]').addEventListener('click', () => go(o => printCv(user, o)));
      m.querySelector('[data-word]').addEventListener('click', () => go(o => downloadCvDocx(user, o)
        .then(() => toast('Word CV indirildi'))
        .catch(e => toast(e.message, { tone: 'danger' }))));
    },
  });
}

/* ---------- Düzenleme pencereleri ---------- */

// Alan türleri: text, textarea, month (aa.yyyy), year (yyyy), select
const CV_KINDS = {
  projects: { one: 'Proje', add: 'Proje ekle', icon: 'list', empty: 'Proje girilmemiş', emptyHint: 'Çalıştığın projeleri ekle. Hazır Word CV’n varsa "CV’den aktar" ile, Bisolera projelerin "Portaldan ekle" ile hazır gelir.', fields: [
    { name: 'customer', label: 'Müşteri', required: true, placeholder: 'Örn. Atlas Holding' },
    { name: 'sector', label: 'Sektör', placeholder: 'Örn. Enerji' },
    { name: 'project', label: 'Proje', required: true, full: true, placeholder: 'Örn. BW/4HANA geçişi' },
    { name: 'role', label: 'Rol', full: true, placeholder: 'Örn. SAP BW Danışmanı' },
    { name: 'from', label: 'Başlangıç', type: 'month', required: true },
    { name: 'to', label: 'Bitiş', type: 'month', hint: 'Sürüyorsa boş bırak' },
    { name: 'work', label: 'Sorumluluklar', type: 'textarea', full: true, hint: 'Her satır bir madde', placeholder: 'Teknik geliştirme\nSüreç zinciri takibi ve destek' },
  ] },
  jobs: { one: 'İş deneyimi', add: 'Ekle', icon: 'building', empty: 'Önceki iş girilmemiş', emptyHint: 'Bisolera\'dan önce çalıştığın şirketleri ekle.', fields: [
    { name: 'company', label: 'Şirket', required: true, full: true, placeholder: 'Örn. Örnek Danışmanlık' },
    { name: 'title', label: 'Unvan', required: true, full: true, placeholder: 'Örn. SAP BW Danışmanı' },
    { name: 'from', label: 'Başlangıç', type: 'month', required: true },
    { name: 'to', label: 'Bitiş', type: 'month', hint: 'Sürüyorsa boş bırak' },
  ] },
  education: { one: 'Eğitim', add: 'Ekle', icon: 'award', empty: 'Eğitim girilmemiş', emptyHint: 'Üniversite ve bölümünü ekle.', fields: [
    { name: 'school', label: 'Okul', required: true, full: true, placeholder: 'Örn. Örnek Üniversitesi' },
    { name: 'department', label: 'Bölüm', full: true, placeholder: 'Örn. Yönetim Bilişim Sistemleri' },
    { name: 'degree', label: 'Derece', type: 'select', options: Object.entries(CV_DEGREES).map(([k, [tr]]) => [k, tr]) },
    { name: 'from', label: 'Başlangıç yılı', type: 'year' },
    { name: 'to', label: 'Bitiş yılı', type: 'year' },
  ] },
  courses: { one: 'Kurs / eğitim', add: 'Ekle', icon: 'award', empty: 'Kurs girilmemiş', emptyHint: 'Dil okulu, proje yönetimi, SAP eğitimi gibi.', fields: [
    { name: 'name', label: 'Kurs / eğitim', required: true, full: true, placeholder: 'Örn. Proje yönetimi eğitimi' },
    { name: 'detail', label: 'Süre, yer', full: true, placeholder: 'Örn. 1 yıl, İstanbul' },
  ] },
};

function cvItemModal(userId, kind, item, onSave) {
  const K = CV_KINDS[kind], user = Store.user(userId), thisMonth = todayISO().slice(0, 7), year = Number(todayISO().slice(0, 4));
  const value = f => (item ? (f.type === 'month' ? fmtMonthInput(item[f.name]) : item[f.name] || '') : (kind === 'projects' && f.name === 'role' ? resumeOf(user).headline || user.title : ''));
  const input = f => {
    const attrs = `class="input" name="${f.name}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}`;
    if (f.type === 'textarea') return `<textarea ${attrs} rows="5" maxlength="1500">${esc(value(f))}</textarea>`;
    if (f.type === 'select') return `<select ${attrs}><option value="">—</option>${f.options.map(([k, label]) => `<option value="${k}"${value(f) === k ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    if (f.type === 'month') return `<input ${attrs.replace(/ placeholder="[^"]*"/, '')} placeholder="aa.yyyy" inputmode="numeric" maxlength="7" autocomplete="off" value="${esc(value(f))}">`;
    if (f.type === 'year') return `<input ${attrs} placeholder="yyyy" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(value(f))}">`;
    return `<input ${attrs} maxlength="${f.full ? 160 : 80}" value="${esc(value(f))}">`;
  };
  openModal({
    title: `${K.one} ${item ? 'düzenle' : 'ekle'}`,
    body: `<form class="form-stack" id="cvItem" novalidate><div class="form-grid">
      ${K.fields.map(f => `<label class="field${f.full ? ' full' : ''}"><span class="field-label">${esc(f.label)}${f.required ? '' : ' <span class="faint">(isteğe bağlı)</span>'}</span>${input(f)}${f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : ''}</label>`).join('')}
      </div>${item?.portalId ? `<p class="muted small-text">${icon('info', 13)} Portaldaki projeden eklendi; tarihleri ve rolü CV'ye göre düzeltebilirsin.</p>` : ''}
      <p class="form-error" hidden></p></form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="cvItem">${item ? 'Kaydet' : 'Ekle'}</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      el[K.fields[0].name].focus();
      // "052019" → "05.2019"
      f.addEventListener('blur', e => {
        if (!e.target.matches('[maxlength="7"]')) return;
        const raw = e.target.value.trim(), ym = parseMonthInput(/^\d{6}$/.test(raw) ? `${raw.slice(0, 2)}.${raw.slice(2)}` : raw);
        if (ym) e.target.value = fmtMonthInput(ym);
      }, true);
      f.addEventListener('submit', e => {
        e.preventDefault();
        const data = {};
        for (const fd of K.fields) {
          const field = el[fd.name], raw = field.value.trim();
          if (fd.required && !raw) return formError(f, `${fd.label} boş olamaz.`, field);
          if (fd.type === 'month' && raw) {
            const ym = parseMonthInput(/^\d{6}$/.test(raw) ? `${raw.slice(0, 2)}.${raw.slice(2)}` : raw);
            if (!ym) return formError(f, `${fd.label}: ay.yıl biçiminde yaz (ör. 05.2019).`, field);
            if (ym > thisMonth) return formError(f, fd.name === 'to' ? 'Bitiş ileri bir ay olamaz; sürüyorsa boş bırak.' : `${fd.label} ileri bir ay olamaz.`, field);
            data[fd.name] = ym;
          } else if (fd.type === 'year' && raw) {
            if (!/^\d{4}$/.test(raw) || Number(raw) < 1950 || Number(raw) > year + 8) return formError(f, `${fd.label}: dört haneli yıl yaz (ör. 2020).`, field);
            data[fd.name] = raw;
          } else data[fd.name] = fd.type === 'textarea' ? textLines(raw).join('\n') : raw;
        }
        if (data.from && data.to && data.to < data.from) return formError(f, 'Bitiş başlangıçtan önce olamaz.', el.to);
        const list = resumeOf(Store.user(userId))[kind].slice();
        if (item) list[list.findIndex(x => x.id === item.id)] = { ...item, ...data };
        else list.push({ id: uid(), ...data });
        saveResume(userId, { [kind]: list });
        close();
        onSave();
        toast(item ? 'Kaydedildi' : `${K.one} eklendi`);
      });
    },
  });
}

// Portalda saat yazılan müşteri projelerinden seçilenler CV'ye eklenir; sorumlulukları kişi sonra yazar
function cvPortalImportModal(user, onSave) {
  const rows = portalCvImportable(user);
  openModal({
    title: 'Portaldaki projelerden ekle',
    body: `<div class="form-stack">
      <p class="muted">Bisolera'da saat yazdığın müşteri projeleri. Müşteri, sektör, proje adı ve dönem hazır gelir; eklenince sorumlulukları yazman yeter.</p>
      <div class="print-pick">${rows.map(r => `<label class="toggle"><input type="checkbox" value="${r.project.id}" checked>
        <span class="dot" style="background:${r.customer.color}"></span>${esc(r.customer.name)} · ${esc(r.project.name)}
        <span class="faint">${fmtMonthInput(r.from.slice(0, 7))} – ${r.ongoing ? 'sürüyor' : fmtMonthInput(r.to.slice(0, 7))} · ${fmtNum(Math.round(r.hours))} sa</span></label>`).join('')}</div>
    </div>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-import>Ekle</button>`,
    onMount(m, close) {
      const btn = m.querySelector('[data-import]'), boxes = [...m.querySelectorAll('.print-pick input')];
      m.addEventListener('change', () => { btn.disabled = !boxes.some(b => b.checked); });
      btn.addEventListener('click', () => {
        const chosen = rows.filter(r => boxes.find(b => b.value === r.project.id)?.checked);
        saveResume(user.id, { projects: [...resumeOf(Store.user(user.id)).projects, ...chosen.map(r => cvProjectFromPortal(r, user))] });
        close();
        onSave();
        toast(`${chosen.length} proje eklendi; sorumlulukları yaz`);
      });
    },
  });
}
