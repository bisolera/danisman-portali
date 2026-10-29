// Faturalama: sözleşme başına tutar (saatlik / günlük), saat havuzu (harcanan / peşin ödendi, aşım), ücret tanımsız saatler,
// taslak / kesin, ekran yalnızca yöneticide, Excel ve PDF. Ücretler UYDURMADIR (şirketin gerçek ücretleri repoya yazılmaz).
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const day = (m, d) => `2025-${m}-${String(d).padStart(2, '0')}`;
  const log = (userId, projectId, m, d, hours) => Store.addActivity({ userId, projectId, date: day(m, d), hours, type: 'destek', note: 'Fatura deneme' });

  localStorage.clear();
  Store.init();
  const year = { start: '2025-01-01', end: '2025-12-31' };
  // Peşin ödenmiş 100 saatlik havuz, saatlik 2.000: Şubat'ta 80 sa (havuzdan), Mart'ta 40 sa → 20 sa aşım
  const pre = Store.addContract({ customerId: 'c6', name: 'Destek 2025', ...year, hours: 100, projectIds: ['p14'], billingUnit: 'saat', rate: 2000, poolBilling: 'asim' });
  // Havuzsuz, günlük 15.000: Mart'ta 92 sa = 11,5 gün
  const daily = Store.addContract({ customerId: 'c1', name: 'Migrasyon 2025', ...year, hours: null, projectIds: ['p1'], billingUnit: 'gun', rate: 15000 });
  // Harcanan saat faturalanan 50 saatlik havuz, saatlik 1.800: Mart'ta 60 sa → hepsi faturalanır, havuz aşıldı uyarısı
  const used = Store.addContract({ customerId: 'c7', name: 'Raporlama 2025', ...year, hours: 50, projectIds: ['p15'], billingUnit: 'saat', rate: 1800, poolBilling: 'harcanan' });
  // Ücreti girilmemiş sözleşme
  const noRate = Store.addContract({ customerId: 'c3', name: 'Health Check 2025', ...year, hours: null, projectIds: ['p6'] });

  for (let d = 1; d <= 10; d++) log('u2', 'p14', '02', d, 8);           // 80 sa
  for (let d = 3; d <= 5; d++) log('u2', 'p14', '03', d, 10);           // 30 sa
  log('u3', 'p14', '03', 6, 10);                                         // 10 sa → Mart toplam 40
  for (let d = 1; d <= 11; d++) log('u5', 'p1', '03', d, 8);            // 88 sa
  log('u5', 'p1', '03', 12, 4);                                          // 92 sa
  for (let d = 1; d <= 6; d++) log('u2', 'p15', '03', d + 10, 10);      // 60 sa
  log('u4', 'p3', '03', 20, 12);                                         // sözleşme yok
  log('u4', 'p6', '03', 21, 8);                                          // ücret yok
  log('u4', 'p13', '03', 22, 8);                                         // iç iş: faturaya girmez
  Store.setPeriod('u5', '2025-03', { status: 'onaylandi' });

  const feb = invoiceMonth('2025-02-01'), mar = invoiceMonth('2025-03-01');
  const line = (r, c) => r.lines.find(l => l.contract.id === c.id);
  const fPre = line(feb, pre), mPre = line(mar, pre), mDay = line(mar, daily), mUsed = line(mar, used);
  ok('pesin_havuzdan', fPre.hours === 80 && fPre.billed === 0 && fPre.amount === 0 && fPre.pool.inPool === 80 && fPre.pool.used === 80, fPre);
  ok('pesin_asim', mPre.hours === 40 && mPre.billed === 20 && mPre.amount === 40000 && mPre.pool.inPool === 20 && mPre.pool.used === 120, mPre);
  ok('gunluk_kesirli', mDay.hours === 92 && mDay.qty === 11.5 && mDay.amount === 172500 && mDay.unit === 'gun', mDay);
  ok('harcanan_havuz', mUsed.billed === 60 && mUsed.amount === 108000 && mUsed.pool.over === 10 && !mUsed.pool.prepaid, mUsed);
  ok('toplam', mar.total === 40000 + 172500 + 108000 && mar.customers === 3, mar.total);
  ok('ucret_tanimsiz', mar.unpriced.length === 2 && mar.unpricedHours === 20
    && mar.unpriced.some(u => u.project.id === 'p3' && u.reason === 'Sözleşme yok' && u.hours === 12)
    && mar.unpriced.some(u => u.project.id === 'p6' && u.reason === 'Sözleşmede ücret yok' && u.contract.id === noRate.id), mar.unpriced.map(u => [u.project.id, u.reason, u.hours]));
  ok('ic_is_girmez', !mar.lines.some(l => l.contract.projectIds.includes('p13')) && !mar.unpriced.some(u => u.project.id === 'p13'));
  ok('kesin_taslak', mDay.final && !mPre.final && mPre.pending === 2 && mar.pending === 2, [mDay.final, mPre.pending]);
  ok('danisman_dokumu', mPre.users.get('u2') === 30 && mPre.users.get('u3') === 10);

  // Ekran: yalnızca yönetici
  App.login(Store.user('u1'));
  go('#/yonetim?tab=fatura&ay=2025-03');
  const panel = () => document.querySelector('#panel');
  const row = c => panel().querySelector(`tr[data-inv-row="${c.id}"]`);
  ok('sekme', !!document.querySelector('[data-tab="fatura"].is-active') && panel().querySelector('.month-label').textContent.includes('Mart 2025'));
  ok('ekran_satirlar', row(pre)?.textContent.includes('40.000,00 ₺') && row(pre).textContent.includes('havuz bitti')
    && row(daily)?.textContent.includes('11,5 gün') && row(daily).textContent.includes('172.500,00 ₺') && row(daily).textContent.includes('Kesin')
    && row(used)?.textContent.includes('havuz aşıldı') && row(pre).textContent.includes('Taslak'), row(pre)?.textContent);
  ok('ekran_toplam', panel().querySelector('.pay-sum-main').textContent.includes(fmtMoney(mar.total)));
  ok('ekran_tanimsiz', panel().querySelector('.inv-missing')?.textContent.includes('Sözleşme yok') && panel().querySelector('.inv-missing').textContent.includes('Sözleşmede ücret yok'));
  panel().querySelector('[data-tab-go="sozlesmeler"]').click();
  ok('sozlesmelere_git', !!document.querySelector('[data-tab="sozlesmeler"].is-active') && location.hash.includes('tab=sozlesmeler'));

  // Excel ve PDF aynı satırlardan
  let wb;
  const orig = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportInvoices('2025-03-01');
  XLSX.writeFile = orig;
  const sum1 = XLSX.utils.sheet_to_json(wb.Sheets['Fatura özeti'], { header: 1 });
  const miss = XLSX.utils.sheet_to_json(wb.Sheets['Ücret tanımsız'], { header: 1 });
  ok('excel', sum1.some(r => r[1] === 'Migrasyon 2025' && r[2] === 'Günlük' && r[3] === 92 && r[6] === '11,5 gün' && r[7] === 15000 && r[8] === 172500)
    && sum1.some(r => r[1] === 'Destek 2025' && r[4] === 20 && r[5] === 20 && r[8] === 40000) && miss.length === 3, sum1.slice(0, 3));
  const origPrint = window.print;
  window.print = () => {};
  printReport(invoiceData('2025-03-01'));
  window.print = origPrint;
  const out = document.querySelector('#print-root .print-report');
  ok('pdf', out?.querySelector('h1').textContent === 'Fatura taslağı' && out.textContent.includes('172.500,00 ₺') && out.textContent.includes('15.000,00 ₺'));
  window.dispatchEvent(new Event('afterprint'));

  // Sözleşme formu: ücret, birim ve havuz faturalaması kaydedilir; Türkçe tutar okunur
  go('#/yonetim?tab=sozlesmeler');
  panel().querySelector('[data-contract-filter="hepsi"]').click();
  panel().querySelector(`tr[data-contract="${pre.id}"] [data-edit-contract]`).click();
  let m = lastModal(), f = m.querySelector('form');
  ok('form_dolu', f.elements.rate.value === '2.000,00' && f.elements.billingUnit.value === 'saat' && f.elements.poolBilling.value === 'asim'
    && !m.querySelector('[data-pool-billing]').hidden && m.querySelector('[data-rate-unit]').textContent === '₺ / sa', f.elements.rate.value);
  f.querySelector('#cb-gun').checked = true;
  f.querySelector('#cb-gun').dispatchEvent(new Event('change', { bubbles: true }));
  ok('birim_soneki', m.querySelector('[data-rate-unit]').textContent === '₺ / gün');
  f.elements.rate.value = 'abc';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('ucret_kontrolu', !m.querySelector('.form-error').hidden && Store.contract(pre.id).rate === 2000);
  f.elements.rate.value = '16.250,50';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('form_kaydedildi', Store.contract(pre.id).rate === 16250.5 && Store.contract(pre.id).billingUnit === 'gun' && Store.contract(pre.id).poolBilling === 'asim', Store.contract(pre.id));
  ok('listede_ucret', panel().querySelector(`tr[data-contract="${pre.id}"]`).textContent.includes('16.250,50 ₺ / gün · havuz peşin')
    && panel().querySelector(`tr[data-contract="${noRate.id}"]`).textContent.includes('Ücret girilmemiş'));

  // Danışman ücret görmez: Faturalama sekmesi yok, müşteri ekranında ücret yok
  App.login(Store.user('u2'));
  go('#/yonetim?tab=fatura&ay=2025-03');
  ok('danisman_goremez', !document.querySelector('[data-inv-row]') && !document.querySelector('[data-tab="fatura"]'));
  go('#/musteriler');
  // Yalnızca görünen öğeler: test sayfasına gömülen <script> kaynak kodları sayılmaz
  const hit = [...document.querySelectorAll('body *:not(script):not(style)')].filter(n => !n.children.length && /16\.250,50|Ücret girilmemiş|₺ \/ (sa|gün)/.test(n.textContent))
    .map(n => [n.tagName, n.className, n.textContent.slice(0, 80)]);
  ok('musteride_ucret_yok', document.querySelector('#view')?.textContent.length > 0 && !hit.length, hit);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
