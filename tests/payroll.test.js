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
  ok('araba_parasi', payFor(q, '2025-03-01').car === 10000 && payFor(q, '2025-03-01').bonus === 0 && !payFor(q, '2025-03-01').prorated);

  // Kıst: ay ortasında giren (16 Mart: 31 günün 16'sı) ve ayrılan (10 Mart'ta çıkmış, hesabı pasif)
  const joiner = person('Ortada Giren', { carAllowance: true, startDate: '2025-03-16' });
  const leaver = person('Ortada Ayrilan', { carAllowance: true, endDate: '2025-03-10', active: false });
  const j = payFor(joiner, '2025-03-01'), l = payFor(leaver, '2025-03-01');
  ok('kist_giren', j.car === 5161.29 && j.carDays === 16 && j.monthDays === 31 && j.prorated, j);
  ok('kist_ayrilan', l.car === 3225.81 && l.carDays === 10, l);
  ok('ayrilan_ayrildigi_ay_listede', payrollMonth('2025-03-01').rows.some(r => r.user.id === leaver.id)
    && !payrollMonth('2025-04-01').rows.some(r => r.user.id === leaver.id) && payFor(joiner, '2025-04-01').car === 10000);
  ok('esik_alti_prim_yok', payFor(p, '2025-02-01').bonus === 0);

  // Hak sonradan gelir: önceki aylarda prim ve araba parası yok, kişi o ayların listesinde görünmez.
  // Hak ayın ortasında (15 Mart) başlarsa prim o ayın tamamından, araba parası hakkın açık olduğu günler kadar (17/31).
  const later = person('Sonradan Hak', { perks: [{ from: '2025-03-15', bonus: true, car: true }] });
  for (let d = 1; d <= 25; d++) {
    Store.addActivity({ userId: later.id, projectId: 'p14', date: `2025-02-${String(d).padStart(2, '0')}`, hours: 8, type: 'destek', note: 'Hak öncesi' });
    Store.addActivity({ userId: later.id, projectId: 'p14', date: `2025-03-${String(d).padStart(2, '0')}`, hours: 8, type: 'destek', note: 'Hak ayı' });
  }
  const feb = payFor(later, '2025-02-01'), mar = payFor(later, '2025-03-01');
  ok('hak_oncesi_ay_bos', !feb.bonusOn && !feb.carOn && feb.bonus === 0 && feb.car === 0 && !payrollMonth('2025-02-01').rows.some(r => r.user.id === later.id), feb);
  ok('hak_ayi_prim_tam_ay', mar.bonusOn && mar.billable === 200 && mar.bonus === 7000, mar);
  ok('hak_ayi_araba_kist', mar.carDays === 17 && mar.car === 5483.87 && mar.prorated, mar);
  ok('hak_degisikligi', JSON.stringify(perkChanges(later, '2025-03-01', '2025-03-31')) === JSON.stringify([{ date: '2025-03-15', key: 'bonus', on: true }, { date: '2025-03-15', key: 'car', on: true }]));
  // Hak biter: 11 Mart'ta şirket aracı aldı → Mart'ta 10 gün araba parası, Nisan'da listede yok
  const carEnds = person('Arac Aldi', { perks: [{ from: '2020-01-01', bonus: false, car: true }, { from: '2025-03-11', bonus: false, car: false }] });
  ok('hak_bitti', payFor(carEnds, '2025-03-01').carDays === 10 && payFor(carEnds, '2025-03-01').car === 3225.81
    && !payrollMonth('2025-04-01').rows.some(r => r.user.id === carEnds.id) && payFor(carEnds, '2025-02-01').car === 10000);
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
  ok('ekran', panel().querySelector('.month-label').textContent.includes('Mart 2025') && row?.textContent.includes('7.375,00 ₺') && row.textContent.includes('25,375') && row.textContent.includes('Kesin')
    && row.textContent.includes('+7,375 gün eşik üstü') && row.querySelector('.pday .over')
    && panel().querySelector(`tr[data-pay-row="${q.id}"]`)?.textContent.includes('Taslak') && panel().querySelector(`tr[data-pay-row="${q.id}"]`).textContent.includes('Prime tabi değil')
    && panel().querySelector('.pay-rate').textContent.includes('1.000,00 ₺') && panel().querySelector('.pay-sum-main').textContent.includes(fmtMoney(payrollMonth('2025-03-01').total)), row?.textContent);
  ok('kist_ekranda', panel().querySelector(`tr[data-pay-row="${joiner.id}"]`)?.textContent.includes('kıst 16/31 gün')
    && panel().querySelector(`tr[data-pay-row="${leaver.id}"]`)?.textContent.includes('ayrıldı'));
  ok('hak_ekranda', panel().querySelector(`tr[data-pay-row="${later.id}"]`)?.textContent.includes('Prim 15 Mar itibarıyla başladı')
    && panel().querySelector(`tr[data-pay-row="${carEnds.id}"]`)?.textContent.includes('Araba parası 11 Mar itibarıyla bitti'),
    panel().querySelector(`tr[data-pay-row="${later.id}"]`)?.textContent);
  go('#/yonetim?tab=prim&ay=2024-11');
  ok('tutar_yok_uyarisi', panel().textContent.includes('tutar girilmemiş'));

  // Tutar ekleme: Türkçe tutar okunur, aynı tarihe ikinci tutar girilmez
  panel().querySelector('[data-pay-rates]').click();
  let m = lastModal(), f = m.querySelector('form');
  // Örnek veride en son tutar bu yılın 1 Ocak'ı (1.000 ₺); form onunla dolar ve o satır "şu an geçerli" işaretlidir
  const latest = Store.payRates().slice(-1)[0];
  ok('tutar_formu_dolu_gelir', f.elements.daily.value === MONEY.format(latest.bonusDaily) && f.elements.threshold.value === String(latest.bonusThreshold)
    && f.elements.car.value === MONEY.format(latest.carMonthly) && m.querySelectorAll('[data-rate] .pill-ok').length === 1
    && m.querySelector('[data-rate] .pill-ok').closest('tr').dataset.rate === latest.id, [f.elements.daily.value, latest]);
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
  ok('tarih_kutusu_gizli', m.querySelector('[data-perk-when]').hidden);
  f.elements.bonusEligible.checked = true;
  f.elements.bonusEligible.dispatchEvent(new Event('change', { bubbles: true }));
  ok('tarih_kutusu_acilir', !m.querySelector('[data-perk-when]').hidden && f.elements.perkFrom.value === monthStart(todayISO()));
  f.elements.endDate.value = '2020-01-01';   // işe girişten önce: kabul edilmez
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('cikis_tarihi_kontrolu', !m.querySelector('.form-error').hidden && !Store.user('u3').endDate);
  f.elements.endDate.value = '2030-06-30';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('form_isaretleri', Store.user('u3').bonusEligible === true && Store.user('u3').carAllowance === false && Store.user('u3').endDate === '2030-06-30');
  // Hak bu aydan açıldı: geçen ay prim yok, bu ay var; geçmişte tarihiyle kayıtlı
  const thisMonth = monthStart(todayISO()), u3 = Store.user('u3');
  ok('form_hak_tarihli', JSON.stringify(u3.perks) === JSON.stringify([{ from: thisMonth, bonus: true, car: false }])
    && !payFor(u3, addMonths(thisMonth, -1)).bonusOn && payFor(u3, thisMonth).bonusOn, u3.perks);

  // Yanlış kayıt geçmişten silinir; hak geri kapanır
  panel().querySelector('[data-edit-user="u3"]').click();
  m = lastModal(); f = m.querySelector('form');
  ok('hak_gecmisi_listede', m.querySelectorAll('.perk-list li').length === 1 && f.elements.bonusEligible.checked);
  m.querySelector('.perk-list [data-del-perk]').click();
  f.elements.bonusEligible.checked = false;
  f.elements.bonusEligible.dispatchEvent(new Event('change', { bubbles: true }));
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('hak_kaydi_silindi', Store.user('u3').perks.length === 0 && Store.user('u3').bonusEligible === false, Store.user('u3').perks);

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
