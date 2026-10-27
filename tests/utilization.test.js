// Doluluk raporu: faturalanır saat / hedef saat, %75 altı uyarı (Mart 2025: demo verisi ve tatil kaydı yok, 21 iş günü)
(async () => {
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  const u = Store.addUser({ name: 'Doluluk Deneme', email: 'doluluk.deneme@bisolera.com', title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2024-01-01' });
  const work = dateRange('2025-03-01', '2025-03-31').filter(d => !isWeekend(d));
  work.slice(0, 15).forEach(d => Store.addActivity({ userId: u.id, projectId: 'p14', date: d, hours: 8, type: 'destek', note: 'Faturalanır iş' }));
  work.slice(15, 18).forEach(d => Store.addActivity({ userId: u.id, projectId: 'p11', date: d, hours: 8, type: 'egitim', note: 'İç eğitim' }));

  // 120 faturalanır / 168 hedef = %71 → uyarı; 3 gün hiç girilmemiş
  let x = utilization(u, '2025-03-01');
  ok('doluluk_hesap', work.length === 21 && x.target === 168 && x.logged === 144 && x.billable === 120 && x.internal === 24
    && x.missing === 3 && Math.abs(x.pct - 120 / 168) < 1e-9 && x.tone === 'warn', x);
  ok('doluluk_payda_hedef', x.pct < x.billable / x.logged);   // girilen saate bölünseydi %83 görünürdü

  // Girilmemiş son gün izinliyse hedef düşer: 120 / 160 = tam %75 → uyarı yok
  Store.addLeave({ userId: u.id, type: 'yillik', start: work[20], end: work[20], status: 'onaylandi' });
  x = utilization(u, '2025-03-01');
  ok('doluluk_izin_hedeften_duser', x.target === 160 && x.pct === 0.75 && x.tone === 'ok' && x.leave === 1 && x.missing === 2, x);

  // Köprü izninde izinli olan için hedef düşer, tam gün çalışan için düşmez
  const br = Store.addHoliday({ date: work[19], name: 'Deneme köprü', kind: 'kopru' });
  ok('doluluk_kopru_izinli', utilization(u, '2025-03-01').target === 152);
  Store.updateHoliday(br.id, { work: { [u.id]: 'full' } });
  ok('doluluk_kopru_calisan', utilization(u, '2025-03-01').target === 160);
  Store.deleteHoliday(br.id);

  // Ay ortasında işe giren: girişten önceki günler hedefe sayılmaz (17–31 Mart: 11 iş günü)
  const late = Store.addUser({ name: 'Yeni Doluluk', email: 'yeni.doluluk@bisolera.com', title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2025-03-17' });
  work.filter(d => d >= '2025-03-17').forEach(d => Store.addActivity({ userId: late.id, projectId: 'p15', date: d, hours: 8, type: 'destek', note: 'Destek' }));
  ok('doluluk_sonradan_giren', utilization(late, '2025-03-01').target === 88 && utilization(late, '2025-03-01').pct === 1, utilization(late, '2025-03-01'));
  ok('doluluk_henuz_girmemis_listede_yok', !teamUtilization('2025-02-01').rows.some(r => r.user.id === late.id)
    && teamUtilization('2025-03-01').rows.some(r => r.user.id === late.id));

  // İçinde bulunulan ay düne kadar sayılır; gelecek ay boş
  const r = utilizationRange(todayISO());
  ok('doluluk_bu_ay_dune_kadar', r.from === monthStart(todayISO()) && r.to === addDays(todayISO(), -1));
  ok('doluluk_gelecek_ay_bos', utilization(u, addMonths(todayISO(), 1)).pct === null);

  // Ekip oranı: toplam faturalanır / toplam hedef
  const team = teamUtilization('2025-03-01');
  ok('doluluk_ekip', team.target === sum(team.rows, x => x.target) && Math.abs(team.pct - team.billable / team.target) < 1e-9 && team.warn >= 1);

  // Yönetim → Doluluk: bağlantıyla ay, en düşük oran üstte, uyarı rengi, 6 ay eğilimi, faturalanmayanlar
  App.login(Store.user('u1'));
  go('#/yonetim?tab=doluluk&ay=2025-03');
  const panel = document.querySelector('#panel');
  const row = panel.querySelector(`tr[data-util-user="${u.id}"]`);
  ok('doluluk_ekrani', panel.querySelector('h2').textContent.includes('Mart 2025') && row?.textContent.includes('%75') && !!row.querySelector('.util-ok')
    && row.textContent.includes('1 gün izin') && row.textContent.includes('2 gün eksik giriş') && row.querySelectorAll('.spark i').length === 6, row?.textContent);
  ok('doluluk_sekme_aktif', !!document.querySelector('#tabs [data-tab=doluluk].is-active'));
  const order = [...panel.querySelectorAll('tr[data-util-user]')].map(tr => tr.dataset.utilUser);
  ok('doluluk_en_dusuk_ustte', order.indexOf(u.id) > order.indexOf('u2') && order[order.length - 1] === late.id, order);
  ok('doluluk_faturalanmayan', panel.textContent.includes('Faturalanmayan saatler nereye gitti?') && panel.textContent.includes('Eğitim & Sertifikasyon'));
  panel.querySelector('[data-util-month="-1"]').click();
  ok('doluluk_ay_gezinme', document.querySelector('#panel h2').textContent.includes('Şubat 2025') && location.hash.includes('ay=2025-02'));

  // Excel
  let wb;
  const orig = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportUtilization('2025-03-01');
  XLSX.writeFile = orig;
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets.Doluluk, { header: 1 });
  ok('doluluk_excel', wb.SheetNames.join() === 'Doluluk,Faturalanmayan' && aoa.some(x => x[0] === 'Doluluk Deneme' && x[1] === 160 && x[3] === 120 && x[5] === 75), aoa);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
