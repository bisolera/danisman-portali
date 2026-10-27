// İş kuralları: izin günü, yasal izin, yedekleme, raporlar, aylık form içe/dışa aktarma, yapıştırma
(async () => {
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const throws = fn => { try { fn(); return false; } catch { return true; } };

  localStorage.clear();
  Store.init();

  // İzin günleri: hafta sonu ve tatil düşülmez, arife yarım gün
  ok('izin_cuma_pazartesi_2', countLeaveDays('2026-11-20', '2026-11-23') === 2, countLeaveDays('2026-11-20', '2026-11-23'));
  ok('izin_hafta_sonu_0', countLeaveDays('2026-11-21', '2026-11-22') === 0);
  ok('izin_arife_yarim_bayram_0', countLeaveDays('2026-10-28', '2026-10-29') === 0.5);
  ok('izin_bayram_haftasi_3_5', countLeaveDays('2026-10-26', '2026-10-30') === 3.5, countLeaveDays('2026-10-26', '2026-10-30'));
  ok('izin_kurban_2027_3', countLeaveDays('2027-05-14', '2027-05-21') === 3, countLeaveDays('2027-05-14', '2027-05-21'));
  ok('izin_yarim_gun', leaveDays({ start: '2026-11-18', end: '2026-11-18', halfDay: true }) === 0.5);
  ok('izin_yarim_gun_hafta_sonu_0', leaveDays({ start: '2026-11-21', end: '2026-11-21', halfDay: true }) === 0);

  // Kıdeme göre yasal asgari izin
  ok('yasal_izin', legalAnnualLeave('2024-06-03', '2026-10-27') === 14 && legalAnnualLeave('2021-10-27', '2026-10-27') === 20
    && legalAnnualLeave('2021-10-28', '2026-10-27') === 14 && legalAnnualLeave('2011-01-01', '2026-10-27') === 26);

  // Yedekleme: indir → sıfırla → geri yükle
  Store.addActivity({ userId: 'u2', projectId: 'p14', date: '2030-02-04', hours: 3, type: 'destek', note: 'Yedek testi' });
  Prefs.set('u2', { lastProject: 'p14' });
  const text = JSON.stringify(Backup.snapshot());
  const { summary } = Backup.inspect(text);
  ok('yedek_ozeti', summary.activities === Store.activities().length && summary.users === Store.users().length, summary);
  Store.reset();
  localStorage.removeItem('bisolera-prefs-u2');
  Backup.restore(Backup.inspect(text).backup);
  Store.init();
  ok('yedek_geri_yukle', Store.activities().some(a => a.note === 'Yedek testi') && Prefs.get('u2').lastProject === 'p14');
  const fake = data => JSON.stringify({ app: 'bisolera-portal', version: 4, data });
  ok('yedek_bozuk_reddedilir', throws(() => Backup.inspect('json değil')) && throws(() => Backup.inspect('{"app":"baska"}'))
    && throws(() => Backup.inspect(fake({ 'bisolera-portal-v1': '{}' })))
    && throws(() => Backup.inspect(fake({ 'bisolera-portal-v1': JSON.stringify({ users: [], activities: [] }), yabanci: 'x' })))
    && throws(() => Backup.inspect(JSON.stringify({ app: 'bisolera-portal', version: 99, data: { 'bisolera-portal-v1': JSON.stringify({ users: [], activities: [] }) } }))));

  // Raporlar: faturalanır/iç saat, sözleşme uyarısı, talep numaraları
  localStorage.clear();
  Store.init();
  const add = (projectId, date, hours, note) => Store.addActivity({ userId: 'u2', projectId, date, hours, type: 'destek', note });
  ['2030-03-04', '2030-03-05', '2030-03-06', '2030-03-07'].forEach(d => add('p2', d, 8, `Destek DST-1042 ${d}`));
  add('p2', '2030-03-08', 2, 'Kısa kontrol');
  add('p13', '2030-03-11', 10, 'İç toplantılar');
  add('p14', '2030-03-12', 4, 'İki talep AB-12 ve CD-34');
  const r = monthReport('2030-03-01');
  ok('rapor_toplamlar', r.total === 48 && r.billable === 38 && r.nonBillable === 10 && r.consultants === 1, { total: r.total, billable: r.billable });
  ok('rapor_talep_esit_bolme', r.tickets.find(t => t.id === 'AB-12')?.hours === 2 && r.tickets.find(t => t.id === 'DST-1042')?.entries === 4, r.tickets);
  ok('sozlesme_yuzde_85_uyari', budgetState(Store.project('p2'), '2030-03-01').tone === 'warn', budgetState(Store.project('p2'), '2030-03-01'));
  ok('talep_proje_kodu_karismaz', ticketIds('KZY-BW kodlu projede SM-2119038 ve CFR-102').join() === 'SM-2119038,CFR-102');

  // Aylık form: dışa aktar → geri oku → tekrar kontrolü; çok projeli müşteri eşleştirme bekler
  let wb;
  const orig = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportMonthlyForm(Store.user('u2'), '2030-03-01');
  XLSX.writeFile = orig;
  const sheets = workbookSheets(XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { cellNF: true }), XLSX);
  ok('form_musteri_sayfalari', wb.SheetNames.join() === ['Atlas Holding', 'Bisolera (İç)', 'Kuzey Elektronik'].join(), wb.SheetNames);
  const first = buildImportDrafts(sheets, 'u2', { month: '2030-03', defaultType: 'gelistirme', mapping: {} }).drafts;
  const st = ds => ds.reduce((m, d) => ((m[d.status] = (m[d.status] || 0) + 1), m), {});
  ok('form_cok_projeli_musteri_eslestirme_bekler', st(first).map === 6 && st(first).dup === 1, st(first));
  const mapped = buildImportDrafts(sheets, 'u2', { month: '2030-03', defaultType: 'gelistirme', mapping: { [fold('Atlas Holding')]: 'p2', [fold('Bisolera (İç)')]: 'p13' } }).drafts;
  ok('form_gidis_donus_hepsi_kayitli', st(mapped).dup === 7, st(mapped));
  ok('form_donem_dosya_adindan', monthFromFileName('Danışman Aylık Aktivite Formu_X_Eylül_2026.xlsx') === '2026-09');
  const noMonth = buildImportDrafts(sheets, 'u2', { month: null, defaultType: 'gelistirme', mapping: {} }).drafts;
  ok('form_donem_yoksa_hata', noMonth.every(d => d.errors.includes('Dönem (ay) seçilmeli')));

  // Excel'den yapıştırma: sekmeyle ayrılmış satır, Türkçe ondalık
  const pasted = buildImportDrafts([{ name: 'Yapıştırılan', rows: parseDelimited('04.02.2030\tKZY-BW\t1,5\tDestek\tYapıştırma testi') }], 'u2', { defaultType: 'gelistirme', mapping: {} }).drafts;
  ok('yapistirma', pasted.length === 1 && pasted[0].status === 'ok' && pasted[0].hours === 1.5 && pasted[0].projectId === 'p14', pasted[0]);

  // Yıl sınırındaki izin günlerine göre iki yıla bölünür (28–31 Aralık: 4 gün; 1 Ocak tatil, 4–5 Ocak: 2 gün)
  localStorage.clear();
  Store.init();
  const u2 = Store.user('u2'), used26 = leaveBalance(u2, 2026).used, used27 = leaveBalance(u2, 2027).used;
  Store.addLeave({ userId: 'u2', type: 'yillik', start: '2026-12-28', end: '2027-01-05', status: 'onaylandi' });
  ok('izin_yil_sinirinda_bolunur', leaveBalance(u2, 2026).used - used26 === 4 && leaveBalance(u2, 2027).used - used27 === 2,
    { y2026: leaveBalance(u2, 2026).used - used26, y2027: leaveBalance(u2, 2027).used - used27 });

  // İki sekme: diğer sekme veriyi değiştirince bu sekme yenilenir ve onun kaydını silmez
  const other = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  other.activities.push({ id: 'diger-sekme', userId: 'u2', projectId: 'p14', date: '2030-05-06', hours: 2, type: 'destek', note: 'Diğer sekme', createdAt: '2030-05-06T10:00' });
  const json = JSON.stringify(other);
  localStorage.setItem('bisolera-portal-v1', json);   // gerçekte diğer sekme yazar; olay bu sekmeye gelir
  window.dispatchEvent(new StorageEvent('storage', { key: 'bisolera-portal-v1', newValue: json }));
  ok('iki_sekme_yenilenir', !!Store.activity('diger-sekme'));
  Store.addActivity({ userId: 'u2', projectId: 'p14', date: '2030-05-07', hours: 1, type: 'destek', note: 'Bu sekme' });
  ok('iki_sekme_kayit_kaybolmaz', JSON.parse(localStorage.getItem('bisolera-portal-v1')).activities.some(a => a.id === 'diger-sekme'));

  // Depo doluysa sessiz kalmaz, kullanıcıya açık uyarı verir
  const realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { throw new DOMException('dolu', 'QuotaExceededError'); };
  Store.addActivity({ userId: 'u2', projectId: 'p14', date: '2030-05-08', hours: 1, type: 'destek', note: 'Sığmayan' });
  Storage.prototype.setItem = realSet;
  ok('depo_dolu_uyarisi', [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('KAYDEDİLEMEDİ')));
  ok('kullanim_olculur', Backup.usage() > 1000, Backup.usage());

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
