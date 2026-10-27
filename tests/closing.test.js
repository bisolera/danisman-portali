// Ay kapanışı uçtan uca: gönder → kilit → iade → düzelt → yeniden gönder → onay → form → kilidi aç → taşıma
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  Prefs.set('u2', { lastProject: 'p14' });
  App.login(Store.user('u2'));

  const prev = addMonths(todayISO(), -1), pm = prev.slice(0, 7);
  const workdays = dateRange(monthStart(prev), monthEnd(prev)).filter(d => dailyTarget('u2', d) > 0);
  const missing = workdays.slice(-2);
  workdays.slice(0, -2).forEach(d => Store.addActivity({ userId: 'u2', projectId: 'p14', date: d, hours: 8, type: 'destek', note: 'Test' }));

  go('#/ozet');
  ok('hatirlatma_acik', document.querySelector('.reminder')?.textContent.includes('henüz kapatılmadı'), document.querySelector('.reminder')?.textContent);

  // Danışman gönderir
  go(`#/aktiviteler?d=${prev}&v=ay`);
  document.querySelector('[data-period=submit]').click();
  let m = lastModal();
  ok('onaysiz_gonder_kapali', m.querySelector('[data-send]').disabled === true);
  m.querySelector('[data-ack]').click();
  ok('onayla_gonder_acik', m.querySelector('[data-send]').disabled === false);
  m.querySelector('[data-note]').value = 'Not';
  m.querySelector('[data-send]').click();
  await wait(250);
  ok('gonderildi', periodStatus('u2', prev) === 'gonderildi');

  // Kilit: veri katmanı, içe aktarma ve form
  ok('store_ekleme_red', Store.addActivity({ userId: 'u2', projectId: 'p14', date: missing[0], hours: 8, type: 'destek', note: 'x' }) === null);
  ok('store_silme_red', Store.deleteActivity(Store.activities({ userId: 'u2', from: workdays[0], to: workdays[0] })[0].id) === null);
  const d0 = buildImportDrafts([{ name: 'x', rows: [['Tarih', 'Proje Kodu', 'Süre', 'Tür', 'Açıklama'], [missing[0].split('-').reverse().join('.'), 'KZY-BW', 8, 'Destek', 'y']] }],
    'u2', { defaultType: 'gelistirme', mapping: {} }).drafts[0];
  ok('ice_aktarma_kilitli_hata', d0.status === 'error' && d0.errors.join().includes('kilitli'), d0.errors);
  go('#/ozet');
  const f = document.querySelector('#quick form');
  f.elements.date.value = missing[0];
  f.elements.hours.value = '8';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('form_kilit_mesaji', document.querySelector('#quick .ef-error').textContent.includes('onaya gönderildi'), document.querySelector('#quick .ef-error').textContent);
  go(`#/aktiviteler?d=${workdays[0]}&v=gun`);
  ok('gunluk_form_gizli', document.querySelector('#entryForm').hidden && !document.querySelector('#lockBanner').hidden);
  ok('hafta_kopyala_yok', !document.querySelector('[data-copy-week]'));

  // Yönetici iade eder
  App.login(Store.user('u1'));
  ok('rozet_5', document.querySelector('.nav-badge').textContent === '5', document.querySelector('.nav-badge').textContent);
  go('#/yonetim?tab=kapanis');
  ok('kapanis_sekme_sayisi', document.querySelector('#tabs [data-tab=kapanis]').textContent.includes('3'), document.querySelector('#tabs [data-tab=kapanis]').textContent);
  document.querySelector('#panel tr[data-user="u2"] [data-review]').click();
  m = lastModal();
  ok('inceleme_takvim', !!m.querySelector('.cal-grid') && m.querySelector('.quote')?.textContent.includes('Not'));
  m.querySelector('[data-return]').click();
  ok('iade_nedensiz_olmaz', periodStatus('u2', prev) === 'gonderildi' && !m.querySelector('[data-reason-error]').hidden);
  m.querySelector('[data-reason]').value = 'İzin girilmemiş';
  m.querySelector('[data-return]').click();
  await wait(250);
  ok('iade_edildi', periodStatus('u2', prev) === 'iade' && Store.period('u2', pm).reviewNote === 'İzin girilmemiş');
  ok('rozet_4', document.querySelector('.nav-badge').textContent === '4', document.querySelector('.nav-badge').textContent);

  // Danışman düzeltir ve yeniden gönderir
  App.login(Store.user('u2'));
  ok('hatirlatma_iade', document.querySelector('.reminder')?.textContent.includes('iade edildi') && document.querySelector('.reminder').textContent.includes('İzin girilmemiş'));
  ok('iadede_kilit_acik', !!Store.addActivity({ userId: 'u2', projectId: 'p14', date: missing[0], hours: 8, type: 'destek', note: 'Düzeltme' }));
  go(`#/aktiviteler?d=${prev}&v=ay`);
  document.querySelector('[data-period=submit]').click();
  m = lastModal();
  m.querySelector('[data-ack]')?.click();
  m.querySelector('[data-send]').click();
  await wait(250);
  ok('yeniden_gonderildi', periodStatus('u2', prev) === 'gonderildi');

  // Yönetici onaylar → form onay bilgisini taşır
  App.login(Store.user('u1'));
  go('#/yonetim?tab=kapanis');
  document.querySelector('#panel tr[data-user="u2"] [data-review]').click();
  lastModal().querySelector('[data-approve]').click();
  await wait(250);
  ok('onaylandi', periodStatus('u2', prev) === 'onaylandi' && Store.period('u2', pm).decidedBy === 'u1');
  let wb;
  const orig = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportMonthlyForm(Store.user('u2'), prev);
  XLSX.writeFile = orig;
  const d3 = wb.Sheets[wb.SheetNames[0]].D3.v;
  ok('form_onay_bilgisi', d3.includes('Onaylandı') && d3.includes('Ayşe Yılmaz'), d3);

  App.login(Store.user('u2'));
  go(`#/aktiviteler?d=${prev}&v=ay`);
  ok('panel_onaylandi', document.querySelector('#monthCard .period').textContent.includes('Onaylandı'));
  go('#/ozet');
  ok('onayda_hatirlatma_yok', !document.querySelector('.reminder'));

  // Yönetici kilidi açar (iki tık)
  App.login(Store.user('u1'));
  go('#/yonetim?tab=kapanis');
  document.querySelector('#panel tr[data-user="u2"] [data-review]').click();
  const ub = lastModal().querySelector('[data-unlock]');
  ub.click();
  ok('kilit_ilk_tik_bekler', periodStatus('u2', prev) === 'onaylandi');
  ub.click();
  await wait(250);
  ok('kilit_acildi', periodStatus('u2', prev) === 'acik');
  const hist = Store.period('u2', pm).history.map(h => h.action).join('>');
  ok('gecmis', hist === 'gonderildi>iade>gonderildi>onaylandi>kilit_acildi', hist);

  // Sürüm taşıma: v3 verisi (periods yok) silinmeden taşınır
  const snap = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  delete snap.periods;
  snap.version = 3;
  const n = snap.activities.length;
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap));
  Store.init();
  ok('tasima_veriyi_korur', Store.activities().length === n && Array.isArray(Store.periods()) && JSON.parse(localStorage.getItem('bisolera-portal-v1')).version === 4);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: e.stack }; });
