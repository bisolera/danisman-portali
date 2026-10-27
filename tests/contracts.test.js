// Sözleşmeler: durum, saat havuzu, tükenme tahmini, uyarılar, çakışma, yenileme, ekranlar (yalnızca yönetici), taşıma
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const lastToastBtn = () => [...document.querySelectorAll('.toast-btn')].pop();
  const submit = f => f.dispatchEvent(new Event('submit', { cancelable: true }));
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  const today = todayISO();
  // İzni ve kilitli ayı olmayan bir danışman: son 20 günde günde 4 saat = 80 saat
  const t = Store.addUser({ name: 'Sözleşme Deneme', email: 'sozlesme.deneme@bisolera.com', title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2020-01-01' });
  const work = (projectId, hours = 4) => { for (let k = 1; k <= 20; k++) Store.addActivity({ userId: t.id, projectId, date: addDays(today, -k), hours, type: 'destek', note: 'Sözleşme testi' }); };
  ['p6', 'p10', 'p9'].forEach(p => work(p));
  Store.addActivity({ userId: t.id, projectId: 'p6', date: addDays(today, -40), hours: 8, type: 'destek', note: 'Dönem öncesi' });

  const A = Store.addContract({ customerId: 'c3', name: 'Havuz %80', start: addDays(today, -30), end: addDays(today, 200), hours: 100, projectIds: ['p6'] });
  const B = Store.addContract({ customerId: 'c5', name: 'Hızlı tükenen', start: addDays(today, -30), end: addDays(today, 400), hours: 1000, projectIds: ['p10'] });
  const C = Store.addContract({ customerId: 'c2', name: '2026 Bitişe yakın', start: addDays(today, -100), end: addDays(today, 30), hours: null, projectIds: ['p4'], noticeDays: 60 });
  const D = Store.addContract({ customerId: 'c4', name: 'Başlamadı', start: addDays(today, 10), end: addDays(today, 300), hours: 200, projectIds: ['p7'] });
  const E = Store.addContract({ customerId: 'c5', name: 'Aşıldı', start: addDays(today, -30), end: addDays(today, 100), hours: 60, projectIds: ['p9'] });

  // Durum ve kullanım
  ok('durum', contractStatus(A) === 'aktif' && contractStatus(C) === 'yakinda' && contractStatus(D) === 'baslamadi'
    && contractStatus({ ...A, start: addDays(today, -40), end: addDays(today, -1) }) === 'bitti');
  const ua = contractUsage(A);
  ok('havuz_kullanimi', ua.used === 80 && ua.pct === 80 && ua.remaining === 20 && ua.tone === 'warn', ua);   // dönem öncesi 8 saat sayılmaz
  const ub = contractUsage(B);
  ok('tukenme_tahmini', ub.pct === 8 && !!ub.runsOutOn && ub.runsOutOn < B.end && ub.tone === 'warn', ub);
  ok('asim', contractUsage(E).tone === 'danger' && contractUsage(E).pct > 100);
  ok('baslamamis_kullanim_yok', contractUsage(D).used === 0 && contractUsage(D).runsOutOn === null);

  // Uyarılar
  const kinds = id => contractAlerts().filter(a => a.contract.id === id).map(a => a.kind).join();
  ok('uyarilar', kinds(A.id) === 'havuz' && kinds(B.id) === 'hizli' && kinds(C.id) === 'bitiyor' && kinds(E.id) === 'asim' && kinds(D.id) === '',
    { A: kinds(A.id), B: kinds(B.id), C: kinds(C.id), D: kinds(D.id), E: kinds(E.id) });

  // Çakışma ve yenileme dönemi
  ok('cakisma', contractClash({ start: today, end: addDays(today, 10), projectIds: ['p6', 'p5'] })?.contract.id === A.id
    && !contractClash({ start: addDays(today, 201), end: addDays(today, 300), projectIds: ['p6'] }));
  const r1 = renewalDraft({ name: '2026 Destek', start: '2026-01-01', end: '2026-12-31' });
  const r2 = renewalDraft({ name: 'Paket', start: '2026-03-15', end: '2026-06-14' });
  ok('yenileme_donemi', r1.start === '2027-01-01' && r1.end === '2027-12-31' && r1.name === '2027 Destek' && r2.start === '2026-06-15' && r2.end === addDays('2026-06-15', 91), [r1, r2]);

  // Yönetim → Sözleşmeler
  App.login(Store.user('u1'));
  go('#/yonetim?tab=sozlesmeler');
  const panel = () => document.querySelector('#panel');
  const nAlerts = new Set(contractAlerts().map(a => a.contract.id)).size;
  ok('sekme_sayisi', document.querySelector('#tabs [data-tab=sozlesmeler] .count')?.textContent === String(nAlerts));
  ok('liste', [A, B, C, D, E].every(c => panel().querySelector(`tr[data-contract="${c.id}"]`)) && panel().textContent.includes('İlgilenilmesi gerekenler')
    && panel().querySelector(`tr[data-contract="${A.id}"]`).textContent.includes('80 / 100 sa'));

  // Ekle: havuz var ama proje yok → hata; çakışan proje → hata; doğru giriş → eklenir
  panel().querySelector('[data-add-contract]').click();
  let m = lastModal(), f = m.querySelector('form');
  f.elements.customerId.value = 'c3';
  f.elements.customerId.dispatchEvent(new Event('change'));
  f.elements.name.value = 'Deneme Sözleşmesi';
  f.elements.start.value = today;
  f.elements.end.value = addDays(today, 90);
  f.elements.hours.value = '200';
  submit(f);
  ok('havuz_proje_ister', m.querySelector('.form-error').textContent.includes('en az bir proje'));
  f.querySelector('[name=projectIds][value="p6"]').checked = true;
  submit(f);
  ok('cakisma_engeli', m.querySelector('.form-error').textContent.includes('EGE-HC') && m.querySelector('.form-error').textContent.includes('Havuz %80'), m.querySelector('.form-error').textContent);
  f.querySelector('[name=projectIds][value="p6"]').checked = false;
  f.querySelector('[name=projectIds][value="p5"]').checked = true;
  submit(f);
  await wait(250);
  const added = Store.contracts().find(c => c.name === 'Deneme Sözleşmesi');
  ok('eklendi', added?.hours === 200 && added.projectIds.join() === 'p5' && added.customerId === 'c3' && !!panel().querySelector(`tr[data-contract="${added.id}"]`));

  // Yenile: yeni dönem açılır, eski sözleşme bitiş uyarısı vermez; geri alınabilir
  panel().querySelector(`tr[data-contract="${C.id}"] [data-renew-contract]`).click();
  m = lastModal(); f = m.querySelector('form');
  const renewName = C.name.replace(C.start.slice(0, 4), addDays(C.end, 1).slice(0, 4));   // yıl yalnızca yeni dönem başka yıldaysa ilerler
  ok('yenile_formu', m.querySelector('.modal-head').textContent.includes('Yenile') && f.elements.start.value === addDays(C.end, 1) && f.elements.name.value === renewName,
    { start: f.elements.start.value, name: f.elements.name.value });
  submit(f);
  await wait(250);
  const renewed = Store.contract(Store.contract(C.id).renewedTo);
  ok('yenilendi', !!renewed && renewed.start === addDays(C.end, 1) && contractStatus(Store.contract(C.id)) === 'yenilendi' && !contractAlerts().some(a => a.contract.id === C.id));
  lastToastBtn().click();
  ok('yenileme_geri_alindi', !Store.contract(C.id).renewedTo && !Store.contract(renewed.id) && contractStatus(Store.contract(C.id)) === 'yakinda');

  // Sil ve geri al
  panel().querySelector(`tr[data-contract="${D.id}"] [data-del-contract]`).click();
  ok('silindi', !Store.contract(D.id));
  lastToastBtn().click();
  ok('silme_geri_alindi', !!Store.contract(D.id));

  // Excel
  let wb;
  const orig = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportContracts();
  XLSX.writeFile = orig;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sözleşmeler'], { header: 1 });
  ok('excel', rows.some(r => r[1] === 'Havuz %80' && r[7] === 80 && r[9] === 80 && r[11] === 'Aktif'), rows.slice(0, 2));

  // Özet ve müşteri kartı: yalnızca yönetici
  go('#/ozet');
  ok('ozette_uyari', document.querySelector('#contractReminder').textContent.includes('sözleşme ilgilenilmeyi bekliyor'));
  go('#/musteriler');
  ok('musteri_kartinda', [...document.querySelectorAll('.cust-contract')].some(a => a.textContent.includes('80 / 100 sa')));
  App.login(Store.user('u2'));
  go('#/ozet');
  ok('danisman_ozette_gormez', !document.querySelector('#contractReminder').textContent.trim());
  go('#/musteriler');
  ok('danisman_kartta_gormez', !document.querySelector('.cust-contract'));
  go('#/yonetim?tab=sozlesmeler');
  ok('danisman_yonetime_giremez', !document.querySelector('[data-add-contract]'));

  // Sürüm taşıma: v8 verisine sözleşme listesi eklenir, kayıtlar korunur
  const snap = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  snap.version = 8;
  delete snap.contracts;
  const acts = snap.activities.length;
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap));
  Store.init();
  ok('tasima', Store.contracts().length === 0 && Store.activities().length === acts && JSON.parse(localStorage.getItem('bisolera-portal-v1')).version === DATA_VERSION);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
