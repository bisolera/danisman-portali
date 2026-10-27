// Masraflar: tutar okuma, doğrulama, akış (gönder → red → düzelt → yeniden gönder → toplu onay → ödendi), fiş, yetki, rapor, form, Excel, taşıma
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 3000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); return fn(); };
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const lastToastBtn = () => [...document.querySelectorAll('.toast-btn')].pop();
  const submit = f => f.dispatchEvent(new Event('submit', { cancelable: true }));
  const form = () => document.querySelector('#expForm form');
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const rejects = async p => { try { await p; return null; } catch (e) { return e.message; } };

  localStorage.clear();
  Store.init();
  const today = todayISO();

  // Tutar okuma ve biçim
  ok('tutar_okuma', parseAmount('1.250,50') === 1250.5 && parseAmount('1250,5') === 1250.5 && parseAmount('1250.50') === 1250.5
    && parseAmount('₺ 1.250') === 1250 && parseAmount('12 TL') === 12 && Number.isNaN(parseAmount('abc')) && Number.isNaN(parseAmount('')));
  ok('para_bicimi', fmtMoney(1250.5) === '1.250,50 ₺', fmtMoney(1250.5));

  // Doğrulama
  const base = { userId: 'u2', date: today, category: 'taksi', amount: 300, description: 'Havalimanı taksisi', projectId: null, rebill: false };
  ok('dogrulama_gecerli', expenseErrors(base).length === 0);
  ok('dogrulama_hatalar', expenseErrors({ ...base, date: addDays(today, 1) })[0].includes('ileri') && expenseErrors({ ...base, amount: 0 })[0].includes('Tutar')
    && expenseErrors({ ...base, amount: EXPENSE_MAX + 1 })[0].includes('en fazla') && expenseErrors({ ...base, description: 'a' })[0].includes('açıklama')
    && expenseErrors({ ...base, rebill: true })[0].includes('proje'));
  ok('fis_turu_kontrolu', (await rejects(readReceipt(new File(['x'], 'a.gif', { type: 'image/gif' }))))?.includes('JPG')
    && (await rejects(readReceipt(new File(['düz metin'], 'sahte.pdf', { type: 'application/pdf' }))))?.includes('PDF'));

  // Danışman: fişli masraf gönderir
  App.login(Store.user('u2'));
  go('#/masraflar');
  ok('sekme_menude', !!document.querySelector('.side-nav [data-route=masraflar]') && !document.querySelector('#modes'));
  let f = form();
  f.elements.amount.value = '1.250,50';
  f.elements.category.value = 'konaklama';
  f.elements.description.value = 'Ankara otel, 1 gece';
  f.elements.projectId.value = 'p14';
  f.elements.rebill.checked = true;
  const fileInput = f.querySelector('[data-receipt-file]');
  Object.defineProperty(fileInput, 'files', { value: [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])], 'fis.png', { type: 'image/png' })], configurable: true });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.querySelector('.receipt-chip'));
  ok('fis_secildi', document.querySelector('.receipt-chip')?.textContent.includes('fis.png'));
  submit(f);
  await until(() => Store.expenses({ userId: 'u2' }).some(e => e.description === 'Ankara otel, 1 gece' && e.receipt));
  const x = Store.expenses({ userId: 'u2' }).find(e => e.description === 'Ankara otel, 1 gece');
  ok('masraf_gonderildi', x?.amount === 1250.5 && x.status === 'beklemede' && x.rebill && x.receipt?.name === 'fis.png' && !!(await Files.get(receiptKey(x.id))), x);
  ok('listede', document.querySelector(`[data-exp="${x.id}"]`)?.textContent.includes('1.250,50 ₺'));
  ok('yalniz_kendi_masraflari', [...document.querySelectorAll('[data-exp]')].every(r => Store.expense(r.dataset.exp).userId === 'u2'));

  // Hatalı form ve aynı masraf uyarısı
  f = form();
  f.elements.description.value = 'Deneme';
  submit(f);
  ok('form_hata', !f.querySelector('[data-exp-msg]').hidden && f.querySelector('[data-exp-msg]').textContent.includes('Tutar'));
  f.elements.amount.value = '1250,50';
  f.elements.category.value = 'konaklama';
  f.elements.description.value = 'Tekrar otel';
  submit(f);
  await wait(50);
  ok('ayni_masraf_uyarisi', f.querySelector('[data-exp-msg]').textContent.includes('aynı tutarda') && !Store.expenses().some(e => e.description === 'Tekrar otel'));
  submit(f);
  await until(() => Store.expenses().some(e => e.description === 'Tekrar otel'));
  const dup = Store.expenses().find(e => e.description === 'Tekrar otel');
  ok('ikinci_gonderimde_kaydeder', !!dup);

  // Sil ve geri al
  document.querySelector(`[data-exp="${dup.id}"] [data-delete]`).click();
  await until(() => !Store.expense(dup.id));
  ok('silindi', !Store.expense(dup.id));
  lastToastBtn().click();
  await until(() => Store.expense(dup.id));
  ok('silme_geri_alindi', !!Store.expense(dup.id));
  Store.deleteExpense(dup.id);

  // Bekleyen masrafı düzenler
  go('#/masraflar');
  document.querySelector(`[data-exp="${x.id}"] [data-edit]`).click();
  f = form();
  ok('duzenle_formu', document.querySelector('#expForm h2').textContent.includes('düzenle') && f.elements.amount.value === '1.250,50' && f.elements.projectId.value === 'p14');
  f.elements.description.value = 'Ankara otel, 1 gece (düzenlendi)';
  submit(f);
  await until(() => Store.expense(x.id).description.includes('düzenlendi'));
  ok('duzenlendi', Store.expense(x.id).status === 'beklemede' && Store.expense(x.id).receipt?.name === 'fis.png');

  // Danışman onay ekranına giremez
  go('#/masraflar?v=onay');
  ok('danisman_onay_goremez', !document.querySelector('[data-approve]') && !document.querySelector('#modes'));

  // Yönetici: rozet, gerekçeli red
  App.login(Store.user('u1'));
  ok('yonetici_rozeti', document.querySelector('.nav-badge[data-badge=masraflar]')?.textContent === String(pendingExpenses()));
  go('#/masraflar?v=onay');
  ok('onay_listesi', document.querySelectorAll('#body [data-exp]').length === pendingExpenses());
  document.querySelector(`[data-exp="${x.id}"] [data-reject]`).click();
  let m = lastModal();
  m.querySelector('[data-do-reject]').click();
  ok('red_gerekcesiz_olmaz', Store.expense(x.id).status === 'beklemede' && !m.querySelector('[data-reason-error]').hidden);
  m.querySelector('[data-reason]').value = 'Fatura şirket adına kesilmeli';
  m.querySelector('[data-do-reject]').click();
  await wait(250);
  ok('reddedildi', Store.expense(x.id).status === 'reddedildi' && Store.expense(x.id).rejectReason.includes('şirket adına'));

  // Danışman gerekçeyi görür, düzeltip yeniden gönderir
  App.login(Store.user('u2'));
  go('#/masraflar');
  ok('red_gerekcesi_gorunur', document.querySelector(`[data-exp="${x.id}"]`).textContent.includes('şirket adına'));
  document.querySelector(`[data-exp="${x.id}"] [data-edit]`).click();
  ok('duzelt_formu', document.querySelector('#expForm h2').textContent.includes('yeniden gönder'));
  f = form();
  f.elements.description.value = 'Ankara otel, 1 gece (şirket faturası)';
  submit(f);
  await until(() => Store.expense(x.id).status === 'beklemede');
  ok('yeniden_gonderildi', Store.expense(x.id).status === 'beklemede' && !Store.expense(x.id).rejectReason && Store.expense(x.id).receipt?.name === 'fis.png');

  // Yönetici toplu onaylar (geri alınabilir), sonra ödendi işaretler
  App.login(Store.user('u1'));
  go('#/masraflar?v=onay');
  const n = pendingExpenses();
  const all = document.querySelector('[data-select-all]');
  all.checked = true;
  all.dispatchEvent(new Event('change', { bubbles: true }));
  ok('tumunu_sec', document.querySelector('[data-approve-selected]').textContent.includes(`(${n} ·`));
  document.querySelector('[data-approve-selected]').click();
  ok('toplu_onay', pendingExpenses() === 0 && Store.expense(x.id).status === 'onaylandi' && Store.expense(x.id).decidedBy === 'u1');
  lastToastBtn().click();
  ok('onay_geri_alindi', pendingExpenses() === n);
  document.querySelector(`[data-exp="${x.id}"] [data-approve]`).click();
  ok('tek_onay', Store.expense(x.id).status === 'onaylandi');
  go('#/masraflar?v=odeme');
  ok('odenecekler', document.querySelector('[data-pay-user="u2"]')?.textContent.includes('1.250,50'));
  document.querySelector('[data-pay-user="u2"] [data-pay]').click();
  ok('odendi', Store.expense(x.id).status === 'odendi' && !!Store.expense(x.id).paidAt && Store.expenses({ userId: 'u2', status: 'onaylandi' }).length === 0);

  // Rapor, fiş önizleme, masraf formu, Excel
  const origCreate = URL.createObjectURL;
  URL.createObjectURL = () => 'blob:fis';
  URL.revokeObjectURL = () => {};
  go('#/masraflar?v=rapor');
  const r = expenseMonthReport(today);
  ok('rapor', r.rebill.some(c => c.customer.id === 'c6' && c.total >= 1250.5) && r.people.some(p => p.user.id === 'u2') && !r.items.some(i => i.status === 'reddedildi'));
  ok('rapor_ekrani', document.querySelector('#body').textContent.includes('Kuzey Elektronik') && !!document.querySelector('[data-report-user="u2"]'));
  document.querySelector(`[data-exp="${x.id}"] [data-receipt]`).click();
  m = lastModal();
  await until(() => m.querySelector('.receipt-img'));
  ok('fis_onizleme', m.querySelector('.receipt-img')?.getAttribute('src') === 'blob:fis');
  m.querySelector('[data-close]').click();
  await wait(250);
  URL.createObjectURL = origCreate;

  let printed = 0;
  const origPrint = window.print;
  window.print = () => { printed++; };
  document.querySelector('[data-report-user="u2"] [data-print-user]').click();
  const page = document.querySelector('#print-root .print-page');
  ok('masraf_formu', printed === 1 && page.textContent.includes('Masraf Formu') && page.textContent.includes('1.250,50 ₺')
    && page.textContent.includes('Ayşe Yılmaz') && document.title.startsWith('Masraf Formu_Emre Aydın'), page?.textContent.slice(0, 200));
  window.print = origPrint;

  let wb;
  const origWrite = XLSX.writeFile;
  XLSX.writeFile = w => { wb = w; };
  await exportExpenses(today);
  XLSX.writeFile = origWrite;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Masraflar, { header: 1 });
  ok('masraf_excel', wb.SheetNames.join() === 'Masraflar,Kişi özeti,Müşteriye yansıtılacak' && rows.some(row => String(row[3]).includes('şirket faturası') && row[9] === 1250.5), rows.slice(0, 3));

  // Yedekte fiş dosyası; sürüm taşıma
  ok('yedekte_fis', !!(await Backup.snapshotFull()).files[receiptKey(x.id)]);
  const snap = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  snap.version = 7;
  delete snap.expenses;
  const acts = snap.activities.length;
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap));
  Store.init();
  ok('tasima_masraf', Store.expenses().length === 0 && Store.activities().length === acts && JSON.parse(localStorage.getItem('bisolera-portal-v1')).version === DATA_VERSION);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
