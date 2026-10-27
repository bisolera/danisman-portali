// Tatiller (Yönetim → Tatiller), onaylı izin için iptal talebi, aylık formun yazdırılması
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const lastToastBtn = () => [...document.querySelectorAll('.toast-btn')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  // İzni olmayan bir kişi: demo izinleri tarih hesaplarını karıştırmasın
  const t = Store.addUser({ name: 'Deneme Kişi', email: 'deneme.kisi@bisolera.com', title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2024-01-01' });

  // Tatiller veritabanında; gün hesapları buradan
  ok('tatil_varsayilan', Store.holidays().length === HOLIDAYS.length && getHoliday('2026-10-29')?.name === 'Cumhuriyet Bayramı');
  ok('tatil_arife_yarim', dailyTarget(t.id, '2026-10-28') === 4);

  // Şirket tatili (köprü günü): hedef 0, izinden düşmez; silinince yeniden iş günü
  const bridge = Store.addHoliday({ date: '2026-10-30', name: 'Köprü günü', kind: 'sirket' });
  ok('kopru_hedef_0', dailyTarget(t.id, '2026-10-30') === 0 && dayOffReason(t.id, '2026-10-30') === 'Köprü günü');
  ok('kopru_izinden_dusmez', countLeaveDays('2026-10-26', '2026-10-30') === 2.5, countLeaveDays('2026-10-26', '2026-10-30'));
  ok('ayni_gune_ikinci_tatil_yok', Store.addHoliday({ date: '2026-10-30', name: 'Tekrar' }) === null);
  Store.deleteHoliday(bridge.id);
  ok('kopru_silinince_is_gunu', dailyTarget(t.id, '2026-10-30') === 8 && countLeaveDays('2026-10-26', '2026-10-30') === 3.5);

  // 2028 kod değiştirmeden: sabit tatiller tek tıkla, bayram tarih aralığı + arife ile
  App.login(Store.user('u1'));
  go('#/yonetim?tab=tatiller');
  const panel = () => document.querySelector('#panel');
  panel().querySelector('[data-hol-year="1"]').click();
  panel().querySelector('[data-hol-year="1"]').click();
  ok('tatil_2028_bos', panel().textContent.includes('2028 için tatil girilmemiş') && !!panel().querySelector('[data-hol-fixed]'));
  panel().querySelector('[data-hol-fixed]').click();
  ok('sabit_tatiller_2028', Store.holidays({ from: '2028-01-01', to: '2028-12-31' }).length === 8
    && dailyTarget(t.id, '2028-05-19') === 0 && dailyTarget(t.id, '2028-05-01') === 0 && dailyTarget(t.id, '2028-04-24') === 8);
  ok('bayram_uyarisi', !!panel().querySelector('.callout.warn')?.textContent.includes('Ramazan ve Kurban'));

  panel().querySelector('[data-hol-add]').click();
  let m = lastModal(), f = m.querySelector('form');
  f.elements.name.value = 'Deneme Bayramı';
  f.elements.start.value = '2028-06-06';
  f.elements.end.value = '2028-06-08';
  f.elements.eve.checked = true;
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  const feast = Store.holidays({ from: '2028-06-05', to: '2028-06-08' });
  ok('bayram_aralik_arife', feast.length === 4 && feast[0].half && feast[0].name === 'Deneme Bayramı Arifesi' && !feast[1].half, feast);
  ok('bayram_hesaplari', dailyTarget(t.id, '2028-06-05') === 4 && countLeaveDays('2028-06-05', '2028-06-09') === 1.5, countLeaveDays('2028-06-05', '2028-06-09'));

  panel().querySelector('[data-hol-add]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.name.value = 'Çakışan';
  f.elements.start.value = '2028-06-07';
  f.elements.end.value = '2028-06-07';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('tatil_cakisma_uyarisi', !m.querySelector('.form-error').hidden && m.querySelector('.form-error').textContent.includes('Deneme Bayramı'), m.querySelector('.form-error').textContent);
  m.querySelector('[data-close]').click();
  await wait(250);

  panel().querySelector(`tr[data-hol="${feast[1].id}"] [data-hol-del]`).click();
  ok('tatil_silindi', !Store.holiday('2028-06-06'));
  lastToastBtn().click();
  ok('tatil_geri_alindi', Store.holiday('2028-06-06')?.id === feast[1].id);

  panel().querySelector(`tr[data-hol="${feast[1].id}"] [data-hol-edit]`).click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.kind.value = 'sirket';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('tatil_duzenlendi', Store.holiday('2028-06-06').kind === 'sirket' && panel().textContent.includes('Şirket tatili'));

  // Sürüm taşıma: v4 verisinde tatil yok → varsayılanlar eklenir, kayıtlar korunur
  const snap = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  delete snap.holidays;
  snap.version = 4;
  const n = snap.activities.length;
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap));
  Store.init();
  ok('tasima_tatiller', Store.holidays().length === HOLIDAYS.length && Store.activities().length === n && getHoliday('2027-03-09')?.name === 'Ramazan Bayramı');

  // Onaylı izin → iptal talebi → yönetici onayı → günler bakiyeye döner (2030: demo verisiyle karışmaz)
  localStorage.clear();
  Store.init();
  const u2 = Store.user('u2');
  const L = Store.addLeave({ userId: 'u2', type: 'yillik', start: '2030-04-08', end: '2030-04-10', status: 'onaylandi' });
  const used0 = leaveBalance(u2, 2030).used;
  App.login(u2);
  go('#/izinler');
  const mineRow = () => document.querySelector(`#mine [data-id="${L.id}"]`);
  ok('iptal_talebi_butonu', !!mineRow().querySelector('[data-cancel-req]'));
  mineRow().querySelector('[data-cancel-req]').click();
  m = lastModal();
  m.querySelector('[data-note]').value = 'Teslim öne çekildi';
  m.querySelector('[data-send]').click();
  await wait(250);
  ok('iptal_beklerken_izin_gecerli', Store.leave(L.id).status === 'onaylandi' && Store.leave(L.id).cancel?.status === 'beklemede'
    && leaveBalance(u2, 2030).used === used0 && dailyTarget('u2', '2030-04-08') === 0);
  ok('iptal_talebi_gorunur', mineRow().textContent.includes('İptal talebi onayda') && !!mineRow().querySelector('[data-cancel-undo]'));
  const pending0 = pendingApprovals();

  App.login(Store.user('u1'));
  go('#/yonetim?tab=onaylar');
  ok('yonetici_iptal_listesi', panel().textContent.includes('İptal talepleri') && panel().textContent.includes('Teslim öne çekildi')
    && document.querySelector('#tabs [data-tab=onaylar] .count')?.textContent === String(Store.leaves({ status: 'beklemede' }).length + 1));
  panel().querySelector(`[data-id="${L.id}"] [data-cancel-decide="onaylandi"]`).click();
  ok('iptal_onaylandi', Store.leave(L.id).status === 'iptal' && leaveBalance(u2, 2030).used === used0 - 3
    && dailyTarget('u2', '2030-04-08') === 8 && pendingApprovals() === pending0 - 1, { used: leaveBalance(u2, 2030).used, used0 });
  lastToastBtn().click();
  ok('iptal_geri_alindi', Store.leave(L.id).status === 'onaylandi' && Store.leave(L.id).cancel?.status === 'beklemede');
  panel().querySelector(`[data-id="${L.id}"] [data-cancel-decide="reddedildi"]`).click();
  ok('iptal_reddedildi', Store.leave(L.id).status === 'onaylandi' && Store.leave(L.id).cancel.status === 'reddedildi' && pendingApprovals() === pending0 - 1);
  ok('baslamis_izin_iptal_istenemez', !canRequestCancel({ status: 'onaylandi', start: addDays(todayISO(), -1) }) && canRequestCancel({ status: 'onaylandi', start: todayISO() }));

  // Kullanıcı formu: devreden izin girilir; hak değişince eski yıllar eski hakla kalır
  go('#/yonetim?tab=kullanicilar');
  panel().querySelector('[data-edit-user="u3"]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.annualLeave.value = '20';
  f.elements.carryIn.value = '2.5';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  const u3 = Store.user('u3'), y = parseISO(todayISO()).getFullYear();
  ok('kullanici_devir_ve_hak_gecmisi', u3.carryIn === 2.5 && entitlementFor(u3, y) === 20 && (y === LEAVE_START_YEAR || entitlementFor(u3, LEAVE_START_YEAR) === 14)
    && panel().querySelector('[data-edit-user="u3"]').closest('tr').textContent.includes('devir'), u3.entitlements);

  // Aylık form yazdırma: müşteri başına sayfa, aynı gün tek satır, imza alanı, PDF dosya adı
  localStorage.clear();
  Store.init();
  ['2030-03-04', '2030-03-05'].forEach(d => Store.addActivity({ userId: 'u2', projectId: 'p14', date: d, hours: 6, type: 'destek', note: `Destek ${d}` }));
  Store.addActivity({ userId: 'u2', projectId: 'p15', date: '2030-03-05', hours: 2, type: 'destek', note: 'Rapor kontrolü' });
  Store.addActivity({ userId: 'u2', projectId: 'p14', date: '2030-03-05', hours: 1, type: 'toplanti', note: 'Durum görüşmesi' });
  let printed = 0;
  const origPrint = window.print;
  window.print = () => { printed++; };
  App.login(Store.user('u2'));
  openPrintDialog(Store.user('u2'), '2030-03-01');
  m = lastModal();
  ok('yazdir_musteri_secimi', m.querySelectorAll('.print-pick input').length === 2);
  m.querySelector('[data-print]').click();
  const pages = document.querySelectorAll('#print-root .print-page');
  ok('yazdir_sayfa_basina_musteri', printed === 1 && pages.length === 2 && pages[0].textContent.includes('Kuzey Elektronik') && pages[1].textContent.includes('Mavi Seramik'), pages.length);
  ok('yazdir_gun_birlesir', pages[0].querySelectorAll('tbody tr').length === 2 && pages[0].querySelector('tfoot').textContent.includes('13'), pages[0].querySelector('tfoot')?.textContent);
  ok('yazdir_imza_ve_durum', !!pages[0].querySelector('.print-sign') && pages[0].textContent.includes('Taslak'));
  ok('yazdir_dosya_adi', document.title.startsWith('Danışman Aylık Aktivite Formu_Emre Aydın_Mart_2030'), document.title);
  window.dispatchEvent(new Event('afterprint'));
  await wait(1100);
  ok('yazdir_sonra_temizlenir', !document.getElementById('print-root') && !document.title.startsWith('Danışman'));
  printMonthlyForm(Store.user('u2'), '2030-03-01', { customerIds: ['c7'], signature: false });
  ok('yazdir_secilen_musteri', document.querySelectorAll('#print-root .print-page').length === 1 && !document.querySelector('#print-root .print-sign'));
  window.print = origPrint;

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
