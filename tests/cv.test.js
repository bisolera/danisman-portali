// CV: eski Word CV'den taşıma, formdan doldurma (alanlar, proje / iş / eğitim / kurs, portaldan ekleme, sil / geri al),
// eksikler, çıktı (Türkçe / İngilizce, müşteri gizleme, kişisel bilgi), Word dosyası, görme yetkisi, yedekte dosyalar
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const today = todayISO();

  // Sürüm 10 → 11: Word CV künyesi kalkar, boş CV açılır; eski CV dosyası depodan silinir
  localStorage.clear();
  Store.init();
  const old = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  old.version = 10;
  old.users.forEach(u => { delete u.resume; });
  old.users[1].cv = { name: 'Eski_CV.docx', size: 1200, uploadedAt: `${today}T10:00`, uploadedBy: 'u2' };
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(old));
  Store.init();
  ok('surum_tasima', !('cv' in Store.user('u2')) && Store.users().every(u => u.resume && typeof u.resume === 'object'));
  await Files.put('cv:u2', { name: 'Eski_CV.docx', type: 'x', size: 3, data: new Uint8Array([1, 2, 3]).buffer });
  await Files.put('receipt:x1', { name: 'fis.jpg', type: 'image/jpeg', size: 3, data: new Uint8Array([7, 8, 9]).buffer });
  await dropOldCvFiles();
  ok('eski_cv_dosyasi_silinir', !(await Files.get('cv:u2')) && !!(await Files.get('receipt:x1')));

  localStorage.clear();
  Store.init();
  // Portalda saat yazılmış ama CV'ye eklenmemiş bir müşteri projesi kesin olsun
  Store.addActivity({ userId: 'u2', projectId: 'p15', date: today, hours: 2, type: 'destek', note: 'Test' });

  // Ay alanı
  ok('ay_alani', parseMonthInput('05.2019') === '2019-05' && parseMonthInput('5/2019') === '2019-05' && parseMonthInput('2019-5') === '2019-05'
    && parseMonthInput('13.2019') === null && parseMonthInput('05.19') === null && fmtMonthInput('2019-05') === '05.2019');

  // Danışman: CV sekmesi, demo CV, Bisolera satırı portaldan, eksikler
  App.login(Store.user('u2'));
  go('#/yetkinlik?v=cv');
  const body = () => document.querySelector('#body');
  ok('cv_sekmesi', [...document.querySelectorAll('#modes [data-mode]')].map(b => b.dataset.mode).join() === 'ben,cv'
    && body().querySelectorAll('[data-cv-list="projects"] .cv-item').length === 2 && body().querySelector('.cv-item.is-auto')?.textContent.includes('Bisolera')
    && !!body().querySelector('[data-cv-export]'));
  const importable = portalCvImportable(Store.user('u2'));
  ok('portaldan_ekle_dugmesi', importable.some(r => r.project.id === 'p15') && !importable.some(r => r.project.id === 'p14')
    && body().querySelector('[data-cv-import]').textContent.includes(`(${importable.length})`));

  // Alanlar değişince hemen kaydedilir; eksik listesi güncellenir
  const field = k => body().querySelector(`[data-cv-field="${k}"]`);
  field('phone').value = '';
  field('phone').dispatchEvent(new Event('change', { bubbles: true }));
  ok('alan_kaydi', Store.user('u2').resume.phone === '' && body().querySelector('[data-cv-status]').textContent.includes('Telefon'));
  field('phone').value = '0555 111 22 33';
  field('phone').dispatchEvent(new Event('change', { bubbles: true }));
  field('headline').value = 'SAP BI Consultant';
  field('headline').dispatchEvent(new Event('change', { bubbles: true }));
  ok('unvan', Store.user('u2').resume.headline === 'SAP BI Consultant' && body().querySelector('[data-cv-headline]').textContent === 'SAP BI Consultant'
    && !body().querySelector('[data-cv-status]').textContent.includes('Telefon'));

  // SAP deneyim özeti: Orta ve Uzman yetkinlikler eklenir (Temel girmez), aynısı ikinci kez eklenmez
  field('areas').value = 'SAP BW 7.x';
  body().querySelector('[data-cv-areas]').click();
  const areas = Store.user('u2').resume.areas.split('\n');
  ok('yetkinlikten_doldur', areas.filter(x => x === 'SAP BW 7.x').length === 1 && areas.includes('ABAP / AMDP') && !areas.includes('Microsoft Fabric'), areas);

  // Proje ekle: zorunlu alanlar, ay biçimi, ileri ay, bitiş < başlangıç
  body().querySelector('[data-cv-add="projects"]').click();
  let m = lastModal(), f = m.querySelector('form');
  const submit = () => f.dispatchEvent(new Event('submit', { cancelable: true }));
  const err = () => !m.querySelector('.form-error').hidden && m.querySelector('.form-error').textContent;
  ok('rol_hazir_gelir', f.elements.role.value === 'SAP BI Consultant');
  submit();
  ok('zorunlu_alan', (err() || '').includes('Müşteri'));
  f.elements.customer.value = 'Deneme & Müşteri';
  f.elements.project.value = 'Rapor <geçişi>';
  f.elements.from.value = '13.2020';
  submit();
  ok('ay_bicimi', (err() || '').includes('05.2019'));
  f.elements.from.value = fmtMonthInput(addMonths(today, 2).slice(0, 7));
  submit();
  ok('ileri_ay', (err() || '').includes('ileri'));
  f.elements.from.value = '052020';
  f.elements.to.value = '03.2020';
  submit();
  ok('bitis_once', (err() || '').includes('önce'));
  f.elements.to.value = '12.2020';
  f.elements.work.value = 'Rapor geliştirme\n\n  Test ve canlıya alma  ';
  submit();
  await wait(250);
  const added = () => Store.user('u2').resume.projects.find(p => p.customer === 'Deneme & Müşteri');
  ok('proje_eklendi', added()?.from === '2020-05' && added().to === '2020-12' && added().work === 'Rapor geliştirme\nTest ve canlıya alma'
    && body().textContent.includes('Rapor <geçişi>'), added());

  // Düzenle
  body().querySelector(`[data-cv-item="${added().id}"] [data-cv-edit]`).click();
  m = lastModal(); f = m.querySelector('form');
  ok('duzenle_dolu_gelir', f.elements.from.value === '05.2020' && f.elements.customer.value === 'Deneme & Müşteri');
  f.elements.role.value = 'Proje lideri';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('duzenlendi', added().role === 'Proje lideri' && Store.user('u2').resume.projects.length === 3);

  // Sil ve geri al (aynı yere döner)
  const before = Store.user('u2').resume.projects.map(p => p.id).join();
  body().querySelector(`[data-cv-item="${added().id}"] [data-cv-del]`).click();
  ok('silindi', !added());
  [...document.querySelectorAll('.toast-btn')].pop().click();
  ok('geri_alindi', Store.user('u2').resume.projects.map(p => p.id).join() === before);

  // Portaldan ekle: seçilen projeler hazır gelir, sorumlulukları boş; eksiklerde görünür
  body().querySelector('[data-cv-import]').click();
  m = lastModal();
  const boxes = [...m.querySelectorAll('.print-pick input')];
  boxes.forEach(b => { b.checked = b.value === 'p15'; });
  m.querySelector('[data-import]').click();
  await wait(250);
  const p15 = Store.user('u2').resume.projects.find(p => p.portalId === 'p15');
  ok('portaldan_eklendi', p15?.customer === 'Mavi Seramik' && p15.sector === 'Yapı malzemeleri' && p15.to === '' && p15.from <= today.slice(0, 7)
    && p15.role === 'SAP BI Consultant' && !portalCvImportable(Store.user('u2')).some(r => r.project.id === 'p15'), p15);
  ok('eksik_sorumluluk', cvMissing(Store.user('u2')).includes('Proje sorumlulukları') && body().textContent.includes('Sorumluluklar yazılmadı'));
  saveResume('u2', { projects: Store.user('u2').resume.projects.map(p => (p.portalId === 'p15' ? { ...p, work: 'Raporlama desteği' } : p)) });

  // Eğitim: yıl kontrolü
  go('#/yetkinlik?v=cv');
  body().querySelector('[data-cv-add="education"]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.school.value = 'Deneme Üniversitesi';
  f.elements.from.value = '20';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('yil_kontrolu', !m.querySelector('.form-error').hidden && Store.user('u2').resume.education.length === 1);
  m.querySelector('[data-close]').click();
  await wait(250);

  // Çıktı: İngilizce başlıklar, sıra (süren proje önce), Bisolera satırı, geçerli sertifika; dolmuş sertifika girmez
  Store.addCert({ userId: 'u2', name: 'Eski sertifika', issued: '2019-01-01', expires: addDays(today, -3) });
  let printed = 0;
  const origPrint = window.print;
  window.print = () => { printed++; };
  printCv(Store.user('u2'), { lang: 'en' });
  let doc = document.querySelector('#print-root .cv-doc');
  const text = () => doc.textContent.replace(/\s+/g, ' ');
  ok('cv_ingilizce', printed === 1 && ['Consultant Profile', 'Emre Aydın', 'SAP BI Consultant', 'emre.aydin@bisolera.com', '0555 111 22 33', 'Profile',
    'SAP Experience – Summary', 'SAP Project Experience', 'Customer', 'Duration', 'Responsibilities', 'Present', 'Kuzey Elektronik', 'Professional Experience and Certifications',
    'Bisolera', 'Örnek Danışmanlık', 'SAP BW/4HANA Associate', 'Certification', "Bachelor's degree", 'Personal Information', 'Nationality', 'Türkiye']
    .every(x => text().includes(x)) && !text().includes('Eski sertifika') && document.title.startsWith('CV_Emre Aydın_EN'), text().slice(0, 400));
  const firstCustomer = doc.querySelector('.cv-table td').textContent;
  ok('suren_proje_once', ['Kuzey Elektronik', 'Mavi Seramik'].includes(firstCustomer), firstCustomer);
  ok('sorumluluk_maddeleri', [...doc.querySelectorAll('.cv-table td')].some(td => td.innerHTML.includes('– Süreç zinciri takibi ve hata çözümü<br>– BPC')));
  printCv(Store.user('u2'), { lang: 'tr', hideCustomers: true, contact: false, personal: false });
  doc = document.querySelector('#print-root .cv-doc');
  ok('cv_turkce_gizli', ['Danışman Profili', 'SAP Proje Deneyimi', 'Dönem', 'Devam ediyor', 'Müşteri adı gizli', 'Dayanıklı tüketim', 'Lisans', 'Diller'].every(x => text().includes(x))
    && !text().includes('Kuzey Elektronik') && !text().includes('0555 111 22 33') && !text().includes('emre.aydin@') && !text().includes('Uyruk'), text().slice(0, 400));

  // "CV'yi al" penceresi: dil seçimi hatırlanır
  go('#/yetkinlik?v=cv');
  body().querySelector('[data-cv-export]').click();
  m = lastModal();
  ok('pencere_eksik_yok', !m.querySelector('.callout.warn'));
  m.querySelector('#cvl-en').checked = true;
  m.querySelector('[data-print]').click();
  ok('pencereden_yazdir', printed === 3 && document.querySelector('#print-root .cv-doc').textContent.includes('Consultant Profile') && Prefs.get('u2').cvLang === 'en');
  window.print = origPrint;
  await wait(250);

  // Word: geçerli bir .docx (zip), XML'ler bozuk değil, "&" ve "<" kaçışlı, başlık sayfa üstünde
  saveResume('u2', { projects: [...Store.user('u2').resume.projects, { id: 'tx', customer: 'A & B', sector: '', project: 'X <Y>', role: '', from: '2019-01', to: '2019-02', work: '' }] });
  const blob = await cvDocxBlob(Store.user('u2'), { lang: 'en' });
  const zip = await JSZip.loadAsync(blob);
  const parts = {};
  for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/header1.xml']) parts[name] = await zip.file(name)?.async('string');
  const broken = Object.entries(parts).filter(([, x]) => !x || new DOMParser().parseFromString(x, 'application/xml').getElementsByTagName('parsererror').length).map(([k]) => k);
  ok('word_dosyasi', !broken.length && parts['word/header1.xml'].includes('Consultant Profile') && parts['word/document.xml'].includes('SAP Project Experience')
    && parts['word/document.xml'].includes('A &amp; B') && parts['word/document.xml'].includes('X &lt;Y&gt;') && parts['word/document.xml'].includes('Kuzey Elektronik'), broken);
  let downloaded = null;
  const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = () => 'blob:deneme';
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
  body().querySelector('[data-cv-export]').click();
  m = lastModal();
  ok('dil_hatirlandi', m.querySelector('#cvl-en').checked);
  m.querySelector('#cvl-tr').checked = true;
  m.querySelector('[data-word]').click();
  for (let i = 0; i < 40 && !downloaded; i++) await wait(50);
  ok('word_indirilir', downloaded === 'CV_Emre Aydın_TR.docx', downloaded);
  URL.createObjectURL = origCreate;
  HTMLAnchorElement.prototype.click = origClick;
  await wait(250);

  // Görme yetkisi: danışman başkasının CV'sini açamaz (?u= ile de kendisininkine düşer)
  App.login(Store.user('u3'));
  go('#/yetkinlik?v=cv&u=u2');
  ok('baskasi_goremez', !canSeeCv(Store.user('u3'), Store.user('u2')) && document.querySelector('.card-head').textContent.includes('Zeynep Kaya')
    && !body().textContent.includes('Kuzey Elektronik') && !location.hash.includes('u=u2') && !!body().querySelector('[data-cv-add="projects"]'));

  // Yönetici: başkasının CV'sini açar ve düzenler; boş CV'de eksikler; matriste CV durumu; aramadan CV
  App.login(Store.user('u1'));
  go('#/yetkinlik?v=cv&u=u4');
  ok('yonetici_acar', location.hash.includes('u=u4') && document.querySelector('.card-head').textContent.includes('Can Öztürk')
    && !!body().querySelector('[data-cv-add="projects"]') && body().querySelector('[data-cv-status]').textContent.includes('Proje'));
  go('#/yetkinlik?v=ekip');
  ok('matriste_cv', document.querySelector('tr[data-person-row="u4"] [data-cv-col]').textContent.includes('eksik')
    && document.querySelector('tr[data-person-row="u4"] [data-cv-col] .cv-miss').title.includes('Eğitim'));
  go('#/yetkinlik?v=ara');
  const box = document.querySelector('[data-search-skill][value="bw"]');
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('tr[data-person-row="u2"] [data-cv-of]').click();
  ok('aramadan_cv', lastModal().querySelector('h2').textContent.includes('Emre Aydın') && !!lastModal().querySelector('[data-word]'));
  lastModal().querySelector('[data-close]').click();
  await wait(250);

  // Yedek: dosya deposu (masraf fişleri) base64 olarak girer, geri yüklenince döner
  const snap = await Backup.snapshotFull();
  const { backup, summary } = Backup.inspect(JSON.stringify(snap));
  ok('yedekte_dosya', summary.files === 1 && typeof snap.files['receipt:x1'].data === 'string');
  await Files.clear();
  Backup.restore(backup);
  await Backup.restoreFiles(backup);
  const back = await Files.get('receipt:x1');
  ok('yedekten_dosya_doner', back?.name === 'fis.jpg' && new Uint8Array(back.data)[2] === 9);
  ok('bozuk_dosya_bolumu_reddedilir', (() => { try { Backup.inspect(JSON.stringify({ ...snap, files: { x: { name: 1 } } })); return false; } catch { return true; } })());

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
