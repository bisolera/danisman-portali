// CV'den aktar: portalın kendi Word CV'si geri okunur (Türkçe / İngilizce); şirket düzenindeki bir CV'nin tuhaflıkları
// (başlıklar ve ad bloğu tablo içinde, "Rol", "06.2026 –", sekmeyle ayrılmış unvan, gizli not satırı); pencere: önizle, seç, aktar,
// tekrar aktarınca çoğalmaz; .doc, PDF ve bozuk dosya açıklamayla reddedilir. Bilgiler uydurmadır.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const rejects = async p => { try { await p; return null; } catch (e) { return e.message; } };

  localStorage.clear();
  Store.init();
  App.login(Store.user('u1'));

  // 1) Portalın ürettiği Word CV geri okunur: aynı bilgiler döner (Bisolera satırı ve sertifika hariç)
  const u2 = Store.user('u2'), r2 = resumeOf(u2);
  for (const lang of ['en', 'tr']) {
    const blob = await cvDocxBlob(u2, { lang });
    const p = await parseCvFile(new File([blob], `CV_${lang}.docx`));
    const proj = r2.projects.slice().sort(byNewest).map(({ id, portalId, ...x }) => x);
    ok(`geri_okuma_${lang}`, p.name === u2.name && p.headline === u2.title && p.phone === r2.phone && p.summary === u2.summary && p.areas === r2.areas
      && JSON.stringify(p.projects) === JSON.stringify(proj)
      && JSON.stringify(p.jobs) === JSON.stringify(r2.jobs.map(({ id, ...x }) => x))
      && JSON.stringify(p.education) === JSON.stringify(r2.education.map(({ id, ...x }) => x))
      && JSON.stringify(p.courses) === JSON.stringify(r2.courses.map(({ id, ...x }) => x))
      && p.languages === r2.languages && p.nationality === r2.nationality, p);
  }

  // 2) Şirket düzeninde, elle yazılmış bir CV
  const t = x => `<w:t xml:space="preserve">${x}</w:t>`;
  const para = x => `<w:p><w:r>${x.split('\t').map(t).join('<w:tab/>')}</w:r></w:p>`;
  const cell = (...lines) => `<w:tc>${(lines.length ? lines : ['']).map(para).join('')}</w:tc>`;
  const row = (...cells) => `<w:tr>${cells.join('')}</w:tr>`;
  const tbl = (...rows) => `<w:tbl>${rows.join('')}</w:tbl>`;
  const pair = (a, ...b) => row(cell(...[].concat(a)), cell(...b));
  const project = (customer, duration, sector, name, role, ...work) => tbl(pair('Customer', customer), pair('Duration', duration), pair('Sector', sector),
    pair('Project', name), pair('Rol', role), pair('Responsibilities', ...work));
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    ${tbl(row(cell(), cell('Deniz Örnek', 'SAP BI Consultant', 'deniz@ornek.example', '0555 123 45 67')))}
    ${tbl(row(cell('Profile')), row(cell('Deniz has 5 years of experience in BW.')), row(cell('SAP Experience – Summary')))}
    ${tbl(row(cell('Business Warehouse (BW) Consultant', '– SAP Datasphere')))}
    ${tbl(row(cell('SAP Projectct Experience')))}
    ${project('Örnek Enerji, İstanbul', '05.2019- 06.2019', 'Energy', 'Support', 'Jr. BI Consultant', '-Technical Development', '-Documentation')}
    ${project('Örnek Holding', '06.2026 –', '', 'Migration', 'BI Consultant', 'Support')}
    ${project('Örnek Gıda', '2017 - 2018', 'Food', 'Reporting', 'Intern', 'Reports')}
    ${tbl(row(cell('Educations')), pair('General English', '8 Months, Örnek Dil Okulu'))}
    ${tbl(row(cell('PROFESSIONAL EXPERIENCE AND CERTIFICATIONS')), row(cell('Freelance', '04.2015-02.2019\t      Web Designer')),
      pair(['Örnek Danışmanlık', '02.2019-05.2019'], 'Intern'), pair(['Bisolera Consulting', '(03.2023 –)'], 'BI Consultant'),
      row(cell('Language school in Örnek City'), cell()))}
    ${tbl(row(cell('Personal Information')), pair('Education', 'Örnek Üniversitesi – Management Information System (Bachelor degree)', 'Yatay geçiş'),
      pair('Marital status', 'Single'), pair('Nation', 'Turkiye'), pair('Date of Birth', '03.01.1990'), pair('Language', 'English and Turkish'))}
    <w:sectPr/></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('word/document.xml', xml);
  const sampleFile = new File([await zip.generateAsync({ type: 'uint8array' })], 'Deniz_CV.docx');
  const p = await parseCvFile(sampleFile);
  ok('ad_blogu', p.name === 'Deniz Örnek' && p.headline === 'SAP BI Consultant' && p.phone === '0555 123 45 67', p);
  ok('profil_ve_ozet', p.summary === 'Deniz has 5 years of experience in BW.' && p.areas === 'Business Warehouse (BW) Consultant\nSAP Datasphere', p.areas);
  ok('projeler', p.projects.length === 3 && p.projects[0].customer === 'Örnek Enerji, İstanbul' && p.projects[0].from === '2019-05' && p.projects[0].to === '2019-06'
    && p.projects[0].role === 'Jr. BI Consultant' && p.projects[0].work === 'Technical Development\nDocumentation' && p.projects[0].sector === 'Energy', p.projects);
  ok('suren_proje', p.projects[1].from === '2026-06' && p.projects[1].to === '' && p.projects[1].sector === '');
  ok('yalnizca_yil', p.projects[2].from === '2017-01' && p.projects[2].to === '2018-12', p.projects[2]);
  ok('isler', JSON.stringify(p.jobs) === JSON.stringify([
    { company: 'Freelance', title: 'Web Designer', from: '2015-04', to: '2019-02' }, { company: 'Örnek Danışmanlık', title: 'Intern', from: '2019-02', to: '2019-05' }]), p.jobs);
  ok('kurslar', p.courses.length === 1 && p.courses[0].name === 'General English' && p.courses[0].detail === '8 Months, Örnek Dil Okulu');
  ok('kisisel', p.education.length === 1 && p.education[0].school === 'Örnek Üniversitesi' && p.education[0].department === 'Management Information System'
    && p.education[0].degree === 'lisans' && p.marital === 'bekar' && p.nationality === 'Turkiye' && p.birthDate === '1990-01-03' && p.languages === 'English and Turkish', p);

  // 3) Reddedilen dosyalar
  ok('doc_reddedilir', (await rejects(parseCvFile(new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2])], 'eski.doc'))))?.includes('Farklı Kaydet'));
  ok('pdf_reddedilir', (await rejects(parseCvFile(new File(['%PDF-1.7 deneme'], 'cv.pdf'))))?.includes('PDF'));
  ok('baska_dosya_reddedilir', (await rejects(parseCvFile(new File(['düz metin'], 'cv.docx'))))?.includes('.docx'));
  const empty = new JSZip();
  empty.file('a.txt', 'x');
  ok('bozuk_docx_reddedilir', (await rejects(parseCvFile(new File([await empty.generateAsync({ type: 'uint8array' })], 'cv.docx'))))?.includes('bozuk'));

  // 4) Pencere: boş CV'ye aktar; ad farklıysa uyarı; dolu alan varsayılan seçili değil; tekrar aktarınca çoğalmaz
  App.login(Store.user('u4'));
  go('#/yetkinlik?v=cv');
  const choose = async (m, file) => {
    const input = m.querySelector('[data-imp-file]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 60 && !m.querySelector('[data-imp-preview]').textContent.match(/Proje|bulunamadı|Bilgiler/); i++) await wait(50);
  };
  document.querySelector('[data-cv-upload]').click();
  let m = lastModal();
  ok('pencere', m.querySelector('[data-imp-apply]').disabled && !!m.querySelector('[data-imp-file]'));
  await choose(m, new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], 'eski.doc'));
  await wait(100);
  ok('pencerede_hata', !m.querySelector('.form-error').hidden && m.querySelector('.form-error').textContent.includes('.docx'));
  await choose(m, sampleFile);
  const box = sel => m.querySelector(sel);
  ok('onizleme', box('.callout.warn')?.textContent.includes('Deniz Örnek') && box('[data-imp-field="phone"]').checked && !box('[data-imp-field="summary"]').checked
    && m.querySelectorAll('[data-imp-item^="projects:"]:checked').length === 3 && m.querySelector('.form-error').hidden
    && !box('[data-imp-apply]').disabled, m.querySelector('[data-imp-preview]').textContent.slice(0, 200));
  box('[data-imp-item="projects:2"]').checked = false;
  box('[data-imp-item="projects:2"]').dispatchEvent(new Event('change', { bubbles: true }));
  const summaryBefore = Store.user('u4').summary;
  box('[data-imp-apply]').click();
  await wait(250);
  const r4 = () => resumeOf(Store.user('u4'));
  ok('aktarildi', r4().projects.length === 2 && r4().jobs.length === 2 && r4().education.length === 1 && r4().courses.length === 1 && r4().phone === '0555 123 45 67'
    && r4().marital === 'bekar' && r4().birthDate === '1990-01-03' && Store.user('u4').summary === summaryBefore
    && document.querySelectorAll('[data-cv-list="projects"] .cv-item').length === 2, r4());
  document.querySelector('[data-cv-upload]').click();
  m = lastModal();
  await choose(m, sampleFile);
  ok('tekrar_aktarinca_coğalmaz', m.querySelectorAll('[data-imp-item^="projects:"]:disabled').length === 2 && m.querySelectorAll('[data-imp-item^="projects:"]:checked').length === 1
    && m.querySelector('[data-imp-preview]').textContent.includes('zaten var') && !m.querySelector('[data-imp-field="phone"]'));
  m.querySelector('[data-close]').click();
  await wait(250);

  // Danışman başkasının CV'sine aktaramaz: ?u= ile de kendi CV'sine düşer, düğme kendi CV'sine aktarır
  App.login(Store.user('u3'));
  go('#/yetkinlik?v=cv&u=u4');
  ok('baskasina_aktaramaz', document.querySelector('.card-head').textContent.includes('Zeynep Kaya') && !document.querySelector('.card-head').textContent.includes('Can Öztürk')
    && !!document.querySelector('[data-cv-upload]'));

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
