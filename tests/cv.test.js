// Word CV: yükleme kuralları, önizleme (güvenli çerçeve), indirme, görme yetkisi, silme / geri alma, yedekte dosyalar
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 4000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); return fn(); };
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const rejects = async p => { try { await p; return null; } catch (e) { return e.message; } };

  localStorage.clear();
  Store.init();

  // Gerçek bir .docx (zip) üret
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Deneme CV metni</w:t></w:r></w:p><w:sectPr/></w:body></w:document>');
  const docx = await zip.generateAsync({ type: 'arraybuffer' });
  const file = (bytes, name) => new File([bytes], name, { type: DOCX_TYPE });

  // Yükleme kuralları
  ok('doc_reddedilir', (await rejects(saveCv('u2', file(docx, 'eski.doc'), 'u2')))?.includes('.docx'));
  ok('pdf_reddedilir', (await rejects(saveCv('u2', file(docx, 'cv.pdf'), 'u2')))?.includes('Word belgesi'));
  ok('sahte_docx_reddedilir', (await rejects(saveCv('u2', file('düz metin', 'sahte.docx'), 'u2')))?.includes('bozuk'));
  ok('buyuk_dosya_reddedilir', (await rejects(saveCv('u2', file(new Uint8Array(CV_MAX_BYTES + 1), 'buyuk.docx'), 'u2')))?.includes('10 MB'));
  ok('reddedilince_kayit_yok', !Store.user('u2').cv && !(await Files.get(cvKey('u2'))));
  await saveCv('u2', file(docx, 'Emre_Aydin_CV.docx'), 'u2');
  const stored = await Files.get(cvKey('u2'));
  ok('cv_kaydedildi', Store.user('u2').cv?.name === 'Emre_Aydin_CV.docx' && stored?.size === docx.byteLength && Store.user('u2').cv.uploadedBy === 'u2');
  ok('kunye_kayit_deposunda_icerik_degil', !localStorage.getItem('bisolera-portal-v1').includes('Deneme CV metni') && localStorage.getItem('bisolera-portal-v1').length < 2e6);

  // Profil: CV kutusu, önizleme penceresi (sandbox çerçeve), indirme
  App.login(Store.user('u2'));
  go('#/yetkinlik');
  ok('cv_kutusu', document.querySelector('.cv-box').textContent.includes('Emre_Aydin_CV.docx') && !!document.querySelector('[data-cv-preview]') && !!document.querySelector('[data-cv-file]'));
  document.querySelector('[data-cv-preview]').click();
  const m = lastModal();
  const frame = await until(() => m.querySelector('iframe.doc-frame'));
  ok('onizleme_cercevesi', !!frame && frame.getAttribute('sandbox') === '' && frame.srcdoc.includes('Deneme CV metni'), m.querySelector('[data-preview]')?.textContent);
  let downloaded = null;
  const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = () => 'blob:deneme';
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
  m.querySelector('[data-download]').click();
  await until(() => downloaded);
  ok('onizlemeden_indir', downloaded === 'Emre_Aydin_CV.docx', downloaded);
  m.querySelector('[data-close]').click();
  await wait(250);

  // Görme yetkisi: başka danışman göremez (yalnızca yüklü olduğunu bilir), yönetici görür ve değiştirebilir
  App.login(Store.user('u3'));
  go('#/yetkinlik?v=ben&u=u2');
  ok('baskasi_cv_goremez', !document.querySelector('[data-cv-preview]') && !document.querySelector('[data-cv-file]') && document.querySelector('.cv-box').textContent.includes('yalnızca kendisi ve yönetici'));
  go('#/yetkinlik?v=ara');
  let box = document.querySelector('[data-search-skill][value="bw"]');
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  ok('aramada_danisman_ozet_gorur', !!document.querySelector('tr[data-person-row="u2"] [data-cv-of]') && !document.querySelector('tr[data-person-row="u2"] [data-cv-preview-of]'));
  App.login(Store.user('u1'));
  go('#/yetkinlik?v=ara');
  box = document.querySelector('[data-search-skill][value="bw"]');
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  ok('aramada_yonetici_cv_gorur', !!document.querySelector('tr[data-person-row="u2"] [data-cv-preview-of]'));
  go('#/yetkinlik?v=ekip');
  ok('matriste_cv_isareti', !!document.querySelector('tr[data-person-row="u2"] [data-cv-col] .cv-yes') && !document.querySelector('tr[data-person-row="u3"] [data-cv-col] .cv-yes'));
  go('#/yetkinlik?v=ben&u=u2');
  ok('yonetici_degistirebilir', !!document.querySelector('[data-cv-file]') && !!document.querySelector('[data-cv-delete]'));

  // Sil ve geri al
  document.querySelector('[data-cv-delete]').click();
  await until(() => !Store.user('u2').cv);
  ok('cv_silindi', !Store.user('u2').cv && !(await Files.get(cvKey('u2'))) && document.querySelector('.cv-box').textContent.includes('Henüz yüklenmedi'));
  [...document.querySelectorAll('.toast-btn')].pop().click();
  await until(() => Store.user('u2').cv);
  ok('cv_geri_alindi', Store.user('u2').cv?.name === 'Emre_Aydin_CV.docx' && (await Files.get(cvKey('u2')))?.size === docx.byteLength);

  // Yedek: CV dosyaları base64 olarak girer; geri yüklenince dosya deposu da döner
  const snap = await Backup.snapshotFull();
  const { backup, summary } = Backup.inspect(JSON.stringify(snap));
  ok('yedekte_cv', summary.files === 1 && typeof snap.files['cv:u2'].data === 'string');
  await Files.clear();
  Backup.restore(backup);
  await Backup.restoreFiles(backup);
  const back = await Files.get(cvKey('u2'));
  ok('yedekten_cv_doner', back?.name === 'Emre_Aydin_CV.docx' && new Uint8Array(back.data)[0] === 0x50 && back.data.byteLength === docx.byteLength);
  ok('bozuk_dosya_bolumu_reddedilir', (() => { try { Backup.inspect(JSON.stringify({ ...snap, files: { x: { name: 1 } } })); return false; } catch { return true; } })());

  URL.createObjectURL = origCreate;
  HTMLAnchorElement.prototype.click = origClick;
  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
