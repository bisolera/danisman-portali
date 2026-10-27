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
  const used0 = leaveBalance(u2).used;
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
    && leaveBalance(u2).used === used0 && dailyTarget('u2', '2030-04-08') === 0);
  ok('iptal_talebi_gorunur', mineRow().textContent.includes('İptal talebi onayda') && !!mineRow().querySelector('[data-cancel-undo]'));
  const pending0 = pendingApprovals();

  App.login(Store.user('u1'));
  go('#/yonetim?tab=onaylar');
  ok('yonetici_iptal_listesi', panel().textContent.includes('İptal talepleri') && panel().textContent.includes('Teslim öne çekildi')
    && document.querySelector('#tabs [data-tab=onaylar] .count')?.textContent === String(Store.leaves({ status: 'beklemede' }).length + 1));
  panel().querySelector(`[data-id="${L.id}"] [data-cancel-decide="onaylandi"]`).click();
  ok('iptal_onaylandi', Store.leave(L.id).status === 'iptal' && leaveBalance(u2).used === used0 - 3
    && dailyTarget('u2', '2030-04-08') === 8 && pendingApprovals() === pending0 - 1, { used: leaveBalance(u2).used, used0 });
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
    && panel().querySelector('[data-edit-user="u3"]').closest('tr').textContent.includes(fmtDate(leaveBalance(u3).next.date)), u3.entitlements);

  // Köprü izni: Perşembe resmi tatil, şirket Cuma'yı köprü yapar. Hiç çalışmayandan 1 gün, yarım gün çalışandan 0,5 gün düşer,
  // tam gün çalışandan düşmez.
  localStorage.clear();
  Store.init();
  Store.addHoliday({ date: '2030-05-02', name: 'Deneme resmi tatil' });
  const br = Store.addHoliday({ date: '2030-05-03', name: 'Köprü izni', kind: 'kopru' });
  const [ka, kb] = ['kopru.a', 'kopru.b'].map(e => Store.addUser({ name: `Köprü ${e.slice(-1).toUpperCase()}`, email: `${e}@bisolera.com`, title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2024-01-01' }));
  ok('kopru_varsayilan_izinden_duser', leaveBalance(ka).used === 1 && leaveBalance(ka).bridge === 1 && dailyTarget(ka.id, '2030-05-03') === 0
    && dayOffReason(ka.id, '2030-05-03') === 'Köprü izni', leaveBalance(ka));

  App.login(ka);
  go('#/izinler');
  const opt = v => document.querySelector(`#bridges [data-bridge="${br.id}"] [data-bridge-work="${v}"]`);
  ok('kopru_uc_secenek', !document.querySelector('#bridges').hidden && !!opt('off') && !!opt('half') && !!opt('full') && opt('off').classList.contains('is-active'));
  opt('half').click();
  ok('kopru_yarim_gun_calisandan_yarim_duser', bridgeWork(Store.holiday('2030-05-03'), ka.id) === 'half' && leaveBalance(ka).used === 0.5
    && dailyTarget(ka.id, '2030-05-03') === 4, { used: leaveBalance(ka).used, target: dailyTarget(ka.id, '2030-05-03') });
  ok('kopru_yarim_gun_ekrani', opt('half').classList.contains('is-active') && document.querySelector(`#bridges [data-bridge="${br.id}"]`).textContent.includes('Yarım gün çalışıyorsun'));
  opt('full').click();
  ok('kopru_tam_gun_calisandan_dusmez', leaveBalance(ka).used === 0 && dailyTarget(ka.id, '2030-05-03') === 8
    && leaveBalance(kb).used === 1 && dailyTarget(kb.id, '2030-05-03') === 0);
  go('#/aktiviteler?d=2030-05-03&v=gun');
  ok('kopru_gunluk_gorunum', document.querySelector('#dayList [data-bridge]')?.textContent.includes('Tam gün çalışıyorsun') && document.querySelector('#dayHead').textContent.includes('8'));

  // Pzt–Cuma izin, Perşembe resmi tatil: köprü günü çift düşmez
  // (hiç çalışmayan 3 + köprü 1 = 4; tam gün çalışan 4 + 0 = 4; yarım gün çalışan 3,5 + 0,5 = 4)
  const lb = Store.addLeave({ userId: kb.id, type: 'yillik', start: '2030-04-29', end: '2030-05-03', status: 'onaylandi' });
  const la = Store.addLeave({ userId: ka.id, type: 'yillik', start: '2030-04-29', end: '2030-05-03', status: 'onaylandi' });
  ok('kopru_izinle_cift_dusmez', leaveDays(lb) === 3 && leaveBalance(kb).used === 4 && leaveDays(la) === 4 && leaveBalance(ka).used === 4,
    { lb: leaveDays(lb), kb: leaveBalance(kb).used, la: leaveDays(la), ka: leaveBalance(ka).used });
  Store.updateHoliday(br.id, { work: { [ka.id]: 'half' } });
  ok('kopru_yarim_calisan_izinle_cift_dusmez', leaveDays(la) === 3.5 && leaveBalance(ka).used === 4, { la: leaveDays(la), ka: leaveBalance(ka).used });
  Store.updateHoliday(br.id, { work: { [ka.id]: 'full' } });
  Store.updateLeave(lb.id, { status: 'iptal' });
  Store.updateLeave(la.id, { status: 'iptal' });

  // Raporluysa köprü yıllık izinden düşmez; ay kapanışa gönderildiyse seçim değişmez
  const sick = Store.addLeave({ userId: kb.id, type: 'hastalik', start: '2030-05-03', end: '2030-05-03', status: 'onaylandi' });
  ok('kopru_raporluya_dusmez', leaveBalance(kb).used === 0);
  Store.updateLeave(sick.id, { status: 'iptal' });
  Store.setPeriod(ka.id, '2030-05', { status: 'gonderildi' });
  go('#/izinler');
  ok('kopru_kilitli_ayda_secilmez', !document.querySelector(`#bridges [data-bridge="${br.id}"] [data-bridge-work]`)
    && document.querySelector(`#bridges [data-bridge="${br.id}"]`).textContent.includes('kapanışa'));
  Store.setPeriod(ka.id, '2030-05', { status: 'acik' });
  go('#/izinler');
  opt('off').click();
  ok('kopru_izinliyim', bridgeWork(Store.holiday('2030-05-03'), ka.id) === null && leaveBalance(ka).used === 1);

  // Yönetici: Tatiller'de kimin çalışacağını görür ve işaretler
  App.login(Store.user('u1'));
  go('#/yonetim?tab=tatiller');
  for (let i = parseISO(todayISO()).getFullYear(); i < 2030; i++) panel().querySelector('[data-hol-year="1"]').click();
  ok('kopru_tatiller_listesi', panel().textContent.includes('Herkesin yıllık izninden düşer'), panel().querySelector('h2').textContent);
  panel().querySelector(`tr[data-hol="${br.id}"] [data-hol-edit]`).click();
  m = lastModal(); f = m.querySelector('form');
  ok('kopru_calisacaklar_listesi', !m.querySelector('[data-workers-wrap]').hidden);
  f.querySelector(`[name=work][data-user="${kb.id}"]`).value = 'half';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('kopru_yonetici_isaretler', JSON.stringify(Store.holiday('2030-05-03').work) === JSON.stringify({ [kb.id]: 'half' }) && leaveBalance(kb).used === 0.5
    && panel().querySelector(`tr[data-hol="${br.id}"]`).textContent.includes('Yarım gün: Köprü'), Store.holiday('2030-05-03').work);

  // Özet: 30 gün içindeki köprü günü en üstte sorulur
  const soon = dateRange(addDays(todayISO(), 2), addDays(todayISO(), 20)).find(d => !isWeekend(d) && !getHoliday(d));
  Store.addHoliday({ date: soon, name: 'Yakın köprü', kind: 'kopru' });
  App.login(ka);
  go('#/ozet');
  ok('kopru_ozette_sorulur', document.querySelector('#bridges')?.textContent.includes('Yakın köprü') && !!document.querySelector('#bridges [data-bridge-work="full"]'));

  // Arife öğleden sonra resmi tatil + şirket sabahı köprü yapar → tam gün. Tam gün köprü de girilebilir.
  localStorage.clear();
  Store.init();
  Store.addHoliday({ date: '2030-05-02', name: 'Deneme Arifesi', half: true });
  const kc = Store.addUser({ name: 'Arife Deneme', email: 'arife.deneme@bisolera.com', title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2024-01-01' });
  App.login(Store.user('u1'));
  go('#/yonetim?tab=tatiller');
  for (let i = parseISO(todayISO()).getFullYear(); i < 2030; i++) panel().querySelector('[data-hol-year="1"]').click();
  panel().querySelector('[data-hol-add]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.name.value = 'Köprü (sabah)';
  f.elements.kind.value = 'kopru';
  f.elements.start.value = '2030-05-02';
  f.elements.end.value = '2030-05-02';
  f.dispatchEvent(new Event('input'));
  ok('arife_eslesme_uyarisi', !m.querySelector('[data-pair]').hidden && m.querySelector('[data-pair]').textContent.includes('Deneme Arifesi')
    && m.querySelector('[data-half-wrap]').hidden && f.elements.dur.value === 'half');
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('arife_kopru_tam_gun', Store.holidaysOn('2030-05-02').length === 2 && getHoliday('2030-05-02').half === false
    && dailyTarget(kc.id, '2030-05-02') === 0 && leaveBalance(kc).bridge === 0.5 && countLeaveDays('2030-05-02', '2030-05-02', kc.id) === 0);
  ok('arife_kopru_tabloda', panel().textContent.includes('birlikte tam gün'));
  const morning = Store.holidaysOn('2030-05-02').find(x => x.kind === 'kopru');
  Store.updateHoliday(morning.id, { work: { [kc.id]: 'full' } });
  ok('arife_kopru_calisan_sabah_calisir', dailyTarget(kc.id, '2030-05-02') === 4 && leaveBalance(kc).bridge === 0
    && countLeaveDays('2030-05-02', '2030-05-02', kc.id) === 0.5);
  ok('ucuncu_tatil_eklenmez', Store.addHoliday({ date: '2030-05-02', name: 'Fazla', half: true }) === null
    && Store.addHoliday({ date: '2030-05-02', name: 'Fazla tam' }) === null);

  panel().querySelector('[data-hol-add]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.name.value = 'Köprü (tam gün)';
  f.elements.kind.value = 'kopru';
  f.elements.start.value = '2030-05-10';
  f.elements.end.value = '2030-05-10';
  f.dispatchEvent(new Event('input'));
  ok('kopru_sure_secimi_gorunur', !m.querySelector('[data-half-wrap]').hidden && f.elements.dur.value === 'full');
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('kopru_tam_gun', Store.holiday('2030-05-10')?.half === false && leaveBalance(kc).bridge === 1 && dailyTarget(kc.id, '2030-05-10') === 0);
  App.login(kc);
  go('#/izinler');
  ok('yarim_kopru_iki_secenek', document.querySelectorAll(`#bridges [data-bridge="${morning.id}"] [data-bridge-work]`).length === 2
    && document.querySelectorAll(`#bridges [data-bridge="${Store.holiday('2030-05-10').id}"] [data-bridge-work]`).length === 3);

  // Sürüm taşıma: eski "çalışacaklar" listesi tam gün çalışma seçimine dönüşür
  const snap6 = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  snap6.version = 5;
  snap6.holidays.push({ id: 'eski-kopru', date: '2030-06-07', name: 'Eski köprü', kind: 'kopru', half: false, workers: [kc.id] });
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap6));
  Store.init();
  ok('tasima_kopru_secimleri', bridgeWork(Store.holiday('2030-06-07'), kc.id) === 'full' && !('workers' in Store.holiday('2030-06-07'))
    && dailyTarget(kc.id, '2030-06-07') === 8 && JSON.parse(localStorage.getItem('bisolera-portal-v1')).version === DATA_VERSION);

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
