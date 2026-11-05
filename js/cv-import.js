/* CV'den aktar: hazır Word CV'deki bilgiler CV formuna aktarılır; dosya saklanmaz, CV yine formda durur.
   Şirketin "Consultant Profile" düzenini ve portalın kendi ürettiği Word CV'yi (Türkçe / İngilizce) tanır.
   Belge baştan sona okunur: başlık satırları (Profile, Project Experience, Personal Information …) bölümü belirler,
   iki sütunlu satırlar etiketine göre (Customer, Duration, Rol …) alana gider. Başlıklar ve ad bloğu tablo içinde de olabilir. */

const W_URI = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CV_IMPORT_MAX = 10 * 1024 * 1024;

// Paragraf metni: w:t, sekme, satır sonu (silinmiş değişiklik ve alan kodları girmez)
function wText(node) {
  let s = '';
  (function walk(e) {
    for (const c of e.children) {
      if (c.localName === 't') s += c.textContent;
      else if (c.localName === 'tab') s += '\t';
      else if (c.localName === 'br' || c.localName === 'cr') s += '\n';
      else if (c.localName !== 'tbl') walk(c);
    }
  })(node);
  return s;
}
const wLines = p => wText(p).split('\n').map(x => x.replace(/ /g, ' ').trim()).filter(Boolean);

// Belge → sıralı bloklar: { line } ya da { row: [etiket satırları, değer satırları] }.
// Tek dolu hücreli tablo satırı (başlık, ad bloğu, madde listesi) düz satır sayılır.
function cvBlocks(container) {
  const out = [];
  const cellLines = tc => [...tc.children].flatMap(c => (c.localName === 'p' ? wLines(c) : c.localName === 'tbl' ? cvBlocks({ children: [c] }).flatMap(b => b.line || b.row.flat()) : []));
  for (const el of container.children) {
    if (el.localName === 'p') wLines(el).forEach(line => out.push({ line }));
    else if (el.localName === 'sdt') out.push(...cvBlocks([...el.children].find(c => c.localName === 'sdtContent') || el));
    else if (el.localName === 'tbl') {
      for (const tr of el.children) {
        if (tr.localName !== 'tr') continue;
        const cells = [...tr.children].filter(c => c.localName === 'tc').map(cellLines), filled = cells.filter(c => c.length);
        if (filled.length >= 2 && cells[0].length) out.push({ row: [cells[0], cells.slice(1).flat()] });
        else filled.flat().forEach(line => out.push({ line }));
      }
    }
  }
  return out;
}

// Karşılaştırma için küçük harf. Türkçe küçültmede İngilizce "Information" → "ınformation" olur; ı da i sayılır (desenlerde yalnızca i var)
const lowTr = s => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim();
// Bölüm başlıkları (kısa satır). Sıra önemli: "SAP Experience – Summary" proje ya da iş deneyimi değil.
const CV_SECTION_RX = [
  ['areas', /(experience|deneyim)\s*[–—-]?\s*(summary|özeti)|key skills|uzmanlik alanlari/],
  ['projects', /proje\w*\s+(experience|deneyimi)|^projects?$|^projeler$/],
  ['experience', /professional experience|work experience|employment history|iş deneyimi|iş geçmişi|çalişma geçmişi/],
  ['personal', /personal information|personal details|kişisel bilgiler/],
  ['courses', /^educations?$|^trainings?$|courses|eğitimler|kurslar/],
  ['profile', /^(profile|profil|summary|özet|about me|hakkimda)$/],
];
const cvSectionOf = line => (line.length <= 60 ? CV_SECTION_RX.find(([, rx]) => rx.test(lowTr(line).replace(/[:.]$/, '')))?.[0] : null) || null;

// Sıra önemli: "Date of Birth" dönem ("Date") sanılmasın diye doğum tarihi önce bakılır
const CV_LABEL_RX = {
  birth: /^(date of birth|birth|doğum)/,
  customer: /^(customer|client|müşteri)/, duration: /^(duration|period|date|dönem|süre|tarih)/, sector: /^(sector|industry|sektör)/,
  project: /^(project|proje)/, role: /^(role?|rol|position|pozisyon|görev)$/, work: /^(responsibilit|sorumluluk|tasks?|duties|görevler|yapilan)/,
  education: /^(education|eğitim)/, marital: /^(marital|medeni)/, nation: /^(nation|uyruk)/, languages: /^(languages?|diller?)$/,
};
const cvLabelOf = label => Object.keys(CV_LABEL_RX).find(k => CV_LABEL_RX[k].test(lowTr(label).replace(/[:.]$/, ''))) || null;

const stripBullet = s => s.replace(/^[-–—•▪·*]\s*/, '').trim();
// "05.2019 – 06.2020", "05.2019- 06.2019", "(03.2023 –)", "06.2026 –", "03.2021 - Present" → { from, to ('' = sürüyor), rest }.
// years: yalnızca yıl yazılmışsa ("2019 – 2020") başı ocak, sonu aralık sayılır (proje dönemi için)
function parseCvRange(text, years = false) {
  const s = String(text || '');
  let months = [...s.matchAll(/(\d{1,2})[./](\d{4})/g)].map(m => parseMonthInput(`${m[1]}.${m[2]}`)).filter(Boolean);
  if (!months.length && years) {
    const ys = [...s.matchAll(/\b((?:19|20)\d{2})\b/g)].map(m => m[1]);
    months = ys.length ? [`${ys[0]}-01`, ...(ys[1] ? [`${ys[1]}-12`] : [])] : [];
  }
  if (!months.length) return null;
  const ongoing = /present|current|today|now|devam|halen|hâlâ|günümüz/i.test(s) || /[–—-]\s*\)?\s*$/.test(s.replace(/\t.*$/, '').trim());
  let [from, to] = [months[0], months[1] || (ongoing ? '' : months[0])];
  if (to && to < from) [from, to] = [to, from];
  const rest = s.replace(/\(?\s*\d{1,2}[./]\d{4}\s*(?:[–—-]\s*(?:\d{1,2}[./]\d{4}|present|current|devam ediyor|halen|günümüz)?)?\s*\)?/gi, ' ').replace(/\s+/g, ' ').trim();
  return { from, to, rest };
}

const CV_DEGREE_RX = [['doktora', /phd|doctor|doktora/i], ['yuksek', /master|msc|mba|yüksek lisans/i], ['onlisans', /associate|ön ?lisans/i],
  ['lisans', /bachelor|lisans|undergraduate|bsc/i], ['lise', /high school|lise/i]];
// "Okul – Bölüm (Bachelor degree, 2016–2020)"
function parseCvEducation(line) {
  const paren = line.match(/\(([^)]*)\)\s*$/), inside = paren?.[1] || '', main = paren ? line.slice(0, paren.index).trim() : line.trim();
  const years = [...`${inside} ${main}`.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m => m[0]);
  const [school, ...dep] = main.replace(/\b(?:19|20)\d{2}\s*[–—-]\s*(?:19|20)\d{2}\b/, '').split(/\s+[–—-]\s+|,\s+/);
  return { school: school.trim(), department: dep.join(' – ').trim(), degree: CV_DEGREE_RX.find(([, rx]) => rx.test(inside) || rx.test(main))?.[0] || '', from: years[0] || '', to: years[1] || '' };
}

// Bloklardan CV verisi. Bisolera satırı ve sertifikalar atlanır (portalda zaten var).
function parseCvBlocks(blocks) {
  const r = { name: '', headline: '', phone: '', summary: '', areas: [], projects: [], jobs: [], education: [], courses: [], languages: '', nationality: '', marital: '', birthDate: '' };
  const head = [];
  let section = null, cur = null, pending = null;
  const flush = () => { if (cur && (cur.customer || cur.project)) r.projects.push({ customer: '', sector: '', project: '', role: '', from: '', to: '', work: '', ...cur }); cur = null; };
  const addJob = (company, range, title) => {
    if (!company || /bisolera/i.test(company)) return;
    r.jobs.push({ company, title: title || '', from: range.from, to: range.to });
  };
  for (const b of blocks) {
    if (b.line) {
      const sec = cvSectionOf(b.line);
      if (sec) { flush(); section = sec; pending = null; continue; }
      if (!section) head.push(b.line);
      else if (section === 'profile') r.summary = r.summary ? `${r.summary} ${b.line}` : b.line;
      else if (section === 'areas') r.areas.push(stripBullet(b.line));
      else if (section === 'experience') {
        // "Şirket" satırı, sonra "04.2015-02.2019 <sekme> Unvan" satırı
        const range = parseCvRange(b.line);
        if (range && pending) { addJob(pending, range, range.rest); pending = null; } else pending = range ? null : b.line.length <= 80 ? b.line : null;
      }
      continue;
    }
    const [labelLines, value] = b.row, label = labelLines.join(' '), kind = cvLabelOf(label), text = value.join(' ');
    if (section === 'personal' || (!section && ['education', 'marital', 'nation', 'birth', 'languages'].includes(kind))) {
      // Bölümü, derecesi, yılı olmayan ve okul adı gibi durmayan satır not sayılır ("Yatay geçiş" gibi)
      if (kind === 'education') r.education.push(...value.map(parseCvEducation).filter(e => e.school && (e.department || e.degree || e.from
        || /üniversite|universit|college|lise|school|okul|fakülte|faculty|institut|enstitü|akademi|academy/i.test(e.school))));
      else if (kind === 'marital') r.marital = /single|bekar|bekâr/i.test(text) ? 'bekar' : /married|evli/i.test(text) ? 'evli' : '';
      else if (kind === 'nation') r.nationality = text;
      else if (kind === 'birth') r.birthDate = parseDateInput(text, true) || '';
      else if (kind === 'languages') r.languages = value.join(', ');
    } else if (['customer', 'duration', 'sector', 'project', 'role', 'work'].includes(kind) && (section === 'projects' || kind === 'customer' || cur)) {
      const field = kind === 'duration' ? 'from' : kind;
      if (!cur || kind === 'customer' || field in cur) { flush(); cur = {}; }
      if (kind === 'duration') { const range = parseCvRange(text, true); Object.assign(cur, range ? { from: range.from, to: range.to } : { from: '' }); }
      else if (kind === 'work') cur.work = value.map(stripBullet).filter(Boolean).join('\n');
      else cur[kind] = value.join(kind === 'customer' ? ', ' : ' ');
    } else if (section === 'experience') {
      if (/^(certification|sertifika)$/i.test(text)) continue;
      const range = parseCvRange(label);
      if (range) addJob(labelLines.filter(l => !parseCvRange(l)).join(' ') || range.rest, range, text);
    } else if (section === 'courses') r.courses.push({ name: label, detail: text });
  }
  flush();
  // Ad bloğu: ad, unvan, e-posta, telefon (başlıktaki "Consultant Profile" yazısı atlanır)
  const info = head.filter(l => !/^(consultant profile|danışman profili|bisolera)$/i.test(l));
  r.phone = info.find(l => /^\+?[\d\s()\-]{9,}$/.test(l)) || '';
  const plain = info.filter(l => !l.includes('@') && l !== r.phone);
  [r.name = '', r.headline = ''] = plain;
  r.areas = r.areas.filter(Boolean).join('\n');
  r.projects = r.projects.filter(p => p.from || p.project);
  return r;
}

// Dosyayı doğrular ve okur; tanınmayan biçimde açıklayıcı hata fırlatır
async function parseCvFile(file) {
  if (file.size > CV_IMPORT_MAX) throw new Error('Dosya 10 MB’tan büyük.');
  const data = await readFileBuffer(file), head = new Uint8Array(data, 0, Math.min(4, data.byteLength));
  if (head[0] === 0xd0 && head[1] === 0xcf || /\.doc$/i.test(file.name)) throw new Error('Eski Word biçimi (.doc) okunamıyor. Dosyayı Word’de aç, Dosya → Farklı Kaydet → Word Belgesi (.docx) seç ve onu yükle.');
  if (String.fromCharCode(...head) === '%PDF') throw new Error('PDF okunamıyor; CV’nin Word (.docx) hâlini yükle.');
  if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error('Dosya açılamadı: Word belgesi (.docx) değil.');
  let xml;
  try { xml = await (await (await loadJSZip()).loadAsync(data)).file('word/document.xml')?.async('string'); } catch { xml = null; }
  if (!xml) throw new Error('Dosya açılamadı: bozuk ya da Word belgesi değil.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml'), body = doc.getElementsByTagNameNS(W_URI, 'body')[0];
  if (!body || doc.getElementsByTagName('parsererror').length) throw new Error('Word belgesi okunamadı.');
  return parseCvBlocks(cvBlocks(body));
}

/* ---------- Pencere: dosya seç → ne geleceğini gör, seç → aktar ---------- */

const cvImportKey = {
  projects: p => `${lowTr(p.customer)}|${lowTr(p.project)}|${p.from}`, jobs: j => `${lowTr(j.company)}|${j.from}`,
  education: e => lowTr(e.school), courses: c => lowTr(c.name),
};
const CV_IMPORT_FIELDS = [['headline', 'CV’deki unvan'], ['phone', 'Telefon'], ['summary', 'Profil yazısı'], ['areas', 'SAP deneyim özeti'],
  ['languages', 'Diller'], ['nationality', 'Uyruk'], ['marital', 'Medeni durum'], ['birthDate', 'Doğum tarihi']];
const cvImportCurrent = (user, key) => (key === 'summary' ? user.summary || '' : resumeOf(user)[key] || '');
const cvImportShow = (key, v) => (key === 'marital' ? CV_MARITAL[v]?.[0] || '' : key === 'birthDate' ? fmtDateInput(v) : key === 'areas' ? v.split('\n').join(' · ') : v);
const sameName = (a, b) => { const t = s => lowTr(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').split(' ').filter(Boolean); const x = t(a), y = t(b); return x.some(w => y.includes(w)); };

function cvImportPreview(user, p) {
  const r = resumeOf(user);
  const fields = CV_IMPORT_FIELDS.filter(([k]) => p[k] && p[k] !== cvImportCurrent(user, k)).map(([k, label]) => {
    const now = cvImportCurrent(user, k);
    return `<label class="toggle"><input type="checkbox" data-imp-field="${k}"${now ? '' : ' checked'}><span><strong>${label}:</strong> ${esc(cvImportShow(k, p[k]).slice(0, 140))}${cvImportShow(k, p[k]).length > 140 ? '…' : ''}
      ${now ? '<span class="faint"> (şu anki yerine geçer)</span>' : ''}</span></label>`;
  });
  const list = (kind, title, line) => {
    if (!p[kind].length) return '';
    const have = new Set(r[kind].map(cvImportKey[kind]));
    return `<div class="sub-head">${title} (${p[kind].length})</div><div class="print-pick imp-list">${p[kind].map((x, i) => {
      const dup = have.has(cvImportKey[kind](x));
      return `<label class="toggle"><input type="checkbox" data-imp-item="${kind}:${i}"${dup ? ' disabled' : ' checked'}><span>${line(x)}${dup ? ' <span class="faint">· zaten var</span>' : ''}</span></label>`;
    }).join('')}</div>`;
  };
  const found = fields.length + p.projects.length + p.jobs.length + p.education.length + p.courses.length;
  if (!found) return `<div class="callout warn">${icon('alert', 16)}<div>Bu dosyada aktarılacak yeni bilgi bulunamadı. Şirketin CV düzeninde değilse bilgileri elle gir.</div></div>`;
  return `${p.name && !sameName(p.name, user.name) ? `<div class="callout warn">${icon('alert', 16)}<div>CV'deki ad <strong>${esc(p.name)}</strong>; bilgiler <strong>${esc(user.name)}</strong> kişisinin CV'sine aktarılacak. Doğru kişi mi?</div></div>` : ''}
    ${fields.length ? `<div class="sub-head">Bilgiler</div><div class="print-pick imp-list">${fields.join('')}</div>` : ''}
    ${list('projects', 'Projeler', x => `<strong>${esc(x.project || '—')}</strong> · ${esc(x.customer)} <span class="faint">· ${x.from ? cvPeriod(x) : 'tarih yok'}</span>`)}
    ${list('jobs', 'İş deneyimi', x => `<strong>${esc(x.company)}</strong> · ${esc(x.title)} <span class="faint">· ${cvPeriod(x)}</span>`)}
    ${list('education', 'Eğitim', x => `<strong>${esc(x.school)}</strong>${x.department ? ` · ${esc(x.department)}` : ''}${x.degree ? ` <span class="faint">· ${CV_DEGREES[x.degree][0]}</span>` : ''}`)}
    ${list('courses', 'Kurslar ve eğitimler', x => `<strong>${esc(x.name)}</strong>${x.detail ? ` <span class="faint">· ${esc(x.detail)}</span>` : ''}`)}
    <p class="muted small-text">Sertifikalar ve Bisolera satırı portaldan geldiği için aktarılmaz. Aktardıktan sonra her şeyi düzeltebilirsin.</p>`;
}

function openCvImportModal(user, onSave) {
  let parsed = null;
  openModal({
    title: 'CV’den aktar',
    size: 'wide',
    body: `<div class="form-stack">
      <p class="muted">Hazır Word CV'ndeki projeler, iş deneyimi, eğitim ve kişisel bilgiler CV formuna aktarılır. Dosya saklanmaz; aktarmadan önce neyin geleceğini görüp seçersin.</p>
      <div><label class="btn primary">${icon('upload', 15)} Word dosyası seç (.docx)<input type="file" accept=".docx,${DOCX_TYPE}" data-imp-file hidden></label></div>
      <p class="muted small-text">Şirketin "Consultant Profile" düzenindeki CV'leri ve portaldan alınan Word CV'yi tanır. Eski .doc dosyasını Word'de açıp Farklı Kaydet → Word Belgesi (.docx) ile kaydet.</p>
      <p class="form-error" hidden></p>
      <div data-imp-preview></div>
    </div>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-imp-apply disabled>Aktar</button>`,
    onMount(m, close) {
      const preview = m.querySelector('[data-imp-preview]'), err = m.querySelector('.form-error'), apply = m.querySelector('[data-imp-apply]');
      const checked = () => [...m.querySelectorAll('[data-imp-field]:checked, [data-imp-item]:checked')];
      m.addEventListener('change', async e => {
        if (!e.target.matches('[data-imp-file]')) { apply.disabled = !checked().length; return; }
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        err.hidden = true;
        preview.innerHTML = `<p class="muted">${icon('clock', 15)} Okunuyor…</p>`;
        try {
          parsed = await parseCvFile(file);
          preview.innerHTML = cvImportPreview(Store.user(user.id), parsed);
        } catch (x) {
          parsed = null;
          preview.innerHTML = '';
          err.textContent = x.message;
          err.hidden = false;
        }
        apply.disabled = !checked().length;
      });
      apply.addEventListener('click', () => {
        const fresh = Store.user(user.id), r = resumeOf(fresh), changes = {}, counts = {};
        checked().forEach(box => {
          if (box.dataset.impField) {
            const k = box.dataset.impField;
            if (k === 'summary') Store.updateUser(user.id, { summary: parsed.summary }); else changes[k] = parsed[k];
            counts.bilgi = (counts.bilgi || 0) + 1;
          } else {
            const [kind, i] = box.dataset.impItem.split(':');
            changes[kind] = changes[kind] || r[kind].slice();
            changes[kind].push({ id: uid(), ...parsed[kind][i] });
            counts[kind] = (counts[kind] || 0) + 1;
          }
        });
        saveResume(user.id, changes);
        close();
        onSave();
        const names = { projects: 'proje', jobs: 'iş', education: 'eğitim', courses: 'kurs', bilgi: 'bilgi' };
        toast(`${Object.entries(counts).map(([k, n]) => `${n} ${names[k]}`).join(', ')} aktarıldı; kontrol edip eksikleri tamamla`, { duration: 6000 });
      });
    },
  });
}
