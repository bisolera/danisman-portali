// Prim ve araba parası: faturalanabilir saat ÷ 8 (kesirli gün), eşik üstü gün × günlük prim; araba parası; yürürlük tarihli tutarlar;
// yalnızca yönetici. Tutarlar UYDURMADIR (şirketin gerçek tutarları repoya yazılmaz).
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  Store.addPayRate({ from: '2025-01-01', bonusThreshold: 18, bonusDaily: 1000, carMonthly: 10000 });
  Store.addPayRate({ from: '2025-06-01', bonusThreshold: 17, bonusDaily: 1200, carMonthly: 11000 });
  const person = (name, extra) => Store.addUser({ name, email: `${fold(name).replace(/\W+/g, '.')}@bisolera.com`, title: 'Kıdemli Danışman', role: 'consultant', annualLeave: 20, startDate: '2020-01-01', ...extra });
  const p = person('Prim Deneme', { bonusEligible: true });
  const q = person('Araba Deneme', { carAllowance: true });
  const late = person('Sonra Giren', { bonusEligible: true, startDate: '2025-04-01' });
  for (let d = 1; d <= 25; d++) Store.addActivity({ userId: p.id, projectId: 'p14', date: `2025-03-${String(d).padStart(2, '0')}`, hours: 8, type: 'destek', note: 'Faturalanabilir' });
  Store.addActivity({ userId: p.id, projectId: 'p14', date: '2025-03-26', hours: 3, type: 'destek', note: 'Kesirli' });
  Store.addActivity({ userId: p.id, projectId: 'p13', date: '2025-03-27', hours: 16, type: 'proje_yonetimi', note: 'İç iş sayılmaz' });

  // Hesap: 203 faturalanabilir saat → 25,375 gün (kesirli) → 25,375 − 18 = 7,375 × 1.000 = 7.375
  const x = payFor(p, '2025-03-01');
  ok('prim_hesabi', x.billable === 203 && x.days === 25.375 && x.over === 7.375 && x.bonus === 7375 && x.car === 0 && !x.final, x);
  ok('kesirli_gun_gosterimi', fmtDays(25.375) === '25,375' && fmtDays(25) === '25');
  ok('ic_isler_sayilmaz', x.billable === 203);
  ok('araba_parasi', payFor(q, '2025-03-01').car === 10000 && payFor(q, '2025-03-01').bonus === 0);
  ok('esik_alti_prim_yok', payFor(p, '2025-02-01').bonus === 0);
  ok('yururluk_tarihi', payRateFor('2025-05-15').bonusDaily === 1000 && payRateFor('2025-06-01').bonusDaily === 1200 && payRateFor('2024-12-01') === null);
  const month = payrollMonth('2025-03-01');
  ok('ay_listesi', month.rows.some(r => r.user.id === p.id) && month.rows.some(r => r.user.id === q.id) && !month.rows.some(r => r.user.id === late.id)
    && month.total === sum(month.rows, r => r.total), month.rows.map(r => [r.user.name, r.total]));
  Store.setPeriod(p.id, '2025-03', { status: 'onaylandi' });
  ok('onayli_ay_kesin', payFor(p, '2025-03-01').final);

  // Ekran: yalnızca yönetici
  App.login(Store.user('u1'));
  go('#/yonetim?tab=prim&ay=2025-03');
  const panel = () => document.querySelector('#panel');
  const row = panel().querySelector(`tr[data-pay-row="${p.id}"]`);
  ok('ekran', panel().querySelector('h2').textContent.includes('Mart 2025') && row?.textContent.includes('7.375,00 ₺') && row.textContent.includes('25,375') && row.textContent.includes('Kesin')
    && panel().querySelector(`tr[data-pay-row="${q.id}"]`)?.textContent.includes('Taslak') && panel().querySelector('.pay-rate').textContent.includes('1.000,00 ₺'), row?.textContent);
  go('#/yonetim?tab=prim&ay=2024-11');
  ok('tutar_yok_uyarisi', panel().textContent.includes('tutar girilmemiş'));

  // Tutar ekleme: Türkçe tutar okunur, aynı tarihe ikinci tutar girilmez
  panel().querySelector('[data-pay-rates]').click();
  let m = lastModal(), f = m.querySelector('form');
  f.elements.from.value = '2025-09-01';
  f.elements.threshold.value = '16';
  f.elements.daily.value = '1.250,50';
  f.elements.car.value = '12.000';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  const added = Store.payRates().find(r => r.from === '2025-09-01');
  ok('tutar_eklendi', added?.bonusThreshold === 16 && added.bonusDaily === 1250.5 && added.carMonthly === 12000, added);
  f.elements.from.value = '2025-09-01';
  f.elements.threshold.value = '15';
  f.elements.daily.value = '1';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('ayni_tarih_engeli', !m.querySelector('.form-error').hidden && Store.payRates().filter(r => r.from === '2025-09-01').length === 1);
  m.querySelector('[data-close]').click();
  await wait(250);

  // Excel
  let wb;
  const orig = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportPayroll('2025-03-01');
  XLSX.writeFile = orig;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Prim ve yan haklar'], { header: 1 });
  ok('excel', rows.some(r => r[0] === 'Prim Deneme' && r[3] === 203 && r[4] === 25.375 && r[6] === 7.375 && r[8] === 7375 && r[11].startsWith('Kesin')), rows.slice(0, 3));

  // Kullanıcı formu: işaretler kaydedilir
  go('#/yonetim?tab=kullanicilar');
  panel().querySelector('[data-edit-user="u3"]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.bonusEligible.checked = true;
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('form_isaretleri', Store.user('u3').bonusEligible === true && Store.user('u3').carAllowance === false);

  // Danışman göremez
  App.login(Store.user('u2'));
  go('#/yonetim?tab=prim&ay=2025-03');
  ok('danisman_goremez', !document.querySelector('[data-pay-row]') && !document.querySelector('[data-pay-rates]'));

  // Sürüm taşıma: v9 verisine boş tutar listesi eklenir, kayıtlar korunur
  const snap = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  snap.version = 9;
  delete snap.payRates;
  const acts = snap.activities.length;
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap));
  Store.init();
  ok('tasima', Store.payRates().length === 0 && Store.activities().length === acts && JSON.parse(localStorage.getItem('bisolera-portal-v1')).version === DATA_VERSION);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
