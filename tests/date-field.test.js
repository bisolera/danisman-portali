// Tarih alanı: tarayıcının dili ne olursa olsun gg.aa.yyyy gösterir; asıl kutu ISO değeri ve olaylarıyla aynen çalışır;
// Türkçe, pazartesiyle başlayan takvim; en erken / en geç tarih; Excel içe aktarmada Türkçe ay listesi
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const type = (text, value, inputType = 'insertText') => { text.value = value; text.dispatchEvent(new InputEvent('input', { bubbles: true, inputType })); };

  localStorage.clear();
  Store.init();

  // Okuma: yazıldığı gibi değil, gün.ay.yıl olarak
  ok('okuma', parseDateInput('23.10.2026') === '2026-10-23' && parseDateInput('3/1/2026') === '2026-01-03' && parseDateInput('23-10-2026') === '2026-10-23'
    && parseDateInput('23102026') === '2026-10-23' && parseDateInput('31.02.2026') === null && parseDateInput('10/23/2026') === null);
  ok('iki_haneli_yil_yalnizca_bitince', parseDateInput('23.10.26') === null && parseDateInput('23.10.26', true) === '2026-10-23');
  ok('gosterim', fmtDateInput('2026-03-05') === '05.03.2026' && fmtDateInput('') === '');

  // Sayfaya eklenen tarih kutusu kendiliğinden dönüşür
  document.body.insertAdjacentHTML('beforeend', '<form id="tf"><label class="field"><span>Tarih</span><input class="input" type="date" name="d" min="2026-10-10" max="2026-10-20" value="2026-10-15"></label></form>');
  await wait(0);
  const f = document.querySelector('#tf'), native = f.elements.d, text = f.querySelector('.date-text');
  const events = [];
  f.addEventListener('change', e => events.push(e.target === native ? 'change' : 'text-change'));
  ok('donusur', !!text && native.closest('.date-field') === text.closest('.date-field') && text.value === '15.10.2026' && text.placeholder === 'gg.aa.yyyy' && native.tabIndex === -1);
  ok('etiket_gorunen_kutuda', f.querySelector('label').control === text);

  // Kod değeri yazınca görünen kutu da değişir; ISO okunur
  native.value = '2026-10-12';
  ok('kod_yazinca_gosterir', text.value === '12.10.2026' && native.value === '2026-10-12');

  // Yazma: noktalar kendiliğinden gelir; tarih tamamlanınca asıl kutuya geçer ve form change alır
  type(text, '18');
  ok('nokta_kendiliginden', text.value === '18.');
  type(text, '18.10');
  ok('ikinci_nokta', text.value === '18.10.');
  type(text, '18.10.2026');
  ok('yazinca_asil_kutuya', native.value === '2026-10-18' && events.includes('change'), [native.value, events]);
  type(text, '19.10.20');
  ok('yazarken_yarim_yil_alinmaz', native.value === '2026-10-18');
  text.dispatchEvent(new Event('blur'));
  ok('bitince_iki_haneli_yil', native.value === '2020-10-19' && text.value === '19.10.2020', [native.value, text.value]);
  type(text, '31.02.2026');
  text.dispatchEvent(new Event('blur'));
  ok('olmayan_tarih_geri_doner', native.value === '2020-10-19' && text.value === '19.10.2020');
  type(text, '', 'deleteContentBackward');
  ok('silinince_bos', native.value === '' && text.value === '');

  // Takvim: Türkçe, pazartesiyle başlar; en erken / en geç dışı günler seçilemez
  native.value = '2026-10-15';
  f.querySelector('.date-btn').click();
  let pop = document.querySelector('.date-pop');
  ok('takvim_acilir', !!pop && pop.querySelector('.dp-head strong').textContent === 'Ekim 2026' && pop.querySelector('.dp-wd').textContent === 'Pzt'
    && pop.querySelectorAll('.dp-day').length === 42 && pop.querySelector('.dp-day.is-sel')?.dataset.dpDay === '2026-10-15', pop?.textContent.slice(0, 80));
  ok('ilk_gun_pazartesi', parseISO(pop.querySelector('.dp-day').dataset.dpDay).getDay() === 1);
  ok('sinir_disi_secilemez', pop.querySelector('[data-dp-day="2026-10-09"]').disabled && pop.querySelector('[data-dp-day="2026-10-21"]').disabled
    && !pop.querySelector('[data-dp-day="2026-10-10"]').disabled && !pop.querySelector('[data-dp-day="2026-10-20"]').disabled);
  pop.querySelector('[data-dp-day="2026-10-09"]').click();
  ok('sinir_disi_tiklama_yok', native.value === '2026-10-15' && !!document.querySelector('.date-pop'));
  pop.querySelector('[data-dp-nav="1"]').click();
  ok('sonraki_ay', pop.querySelector('.dp-head strong').textContent === 'Kasım 2026');
  pop.querySelector('[data-dp-nav="-1"]').click();
  events.length = 0;
  pop.querySelector('[data-dp-day="2026-10-20"]').click();
  ok('takvimden_secilir', native.value === '2026-10-20' && text.value === '20.10.2026' && !document.querySelector('.date-pop') && events.includes('change'));

  // Esc ve dışarı tıklama kapatır; Esc açık pencereyi kapatmaz
  text.click();
  ok('kutuya_tiklayinca_acilir', !!document.querySelector('.date-pop'));
  let escSeen = false;
  const onEsc = e => { if (e.key === 'Escape') escSeen = true; };
  document.addEventListener('keydown', onEsc);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.removeEventListener('keydown', onEsc);
  ok('esc_kapatir', !document.querySelector('.date-pop') && !escSeen);
  f.querySelector('.date-btn').click();
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  ok('disari_tiklama_kapatir', !document.querySelector('.date-pop'));
  f.querySelector('.date-btn').click();
  pop = document.querySelector('.date-pop');
  pop.querySelector('[data-dp-clear]').click();
  ok('temizle', native.value === '' && text.value === '');
  f.remove();

  // Gerçek form: kullanıcı formunda tarih yazılır, ISO kaydedilir; hatada görünen kutu kırmızı ve odakta
  App.login(Store.user('u1'));
  go('#/yonetim?tab=kullanicilar');
  document.querySelector('[data-edit-user="u3"]').click();
  await wait(0);
  let m = lastModal(), uf = m.querySelector('form');
  const startText = uf.elements.startDate.closest('.date-field').querySelector('.date-text');
  const endText = uf.elements.endDate.closest('.date-field').querySelector('.date-text');
  ok('formda_gun_ay_yil', startText.value === fmtDateInput(Store.user('u3').startDate), startText.value);
  type(startText, '01.02.2021');
  type(endText, '15.01.2020');
  uf.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('hata_gorunen_kutuda', !m.querySelector('.form-error').hidden && uf.elements.endDate.classList.contains('is-invalid') && document.activeElement === endText,
    document.activeElement?.outerHTML.slice(0, 80));
  type(endText, '', 'deleteContentBackward');
  uf.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('iso_kaydedilir', Store.user('u3').startDate === '2021-02-01' && !Store.user('u3').endDate, Store.user('u3').startDate);

  // Özet'teki hızlı giriş: <label for> görünen kutuya bağlı
  go('#/ozet');
  await wait(0);
  const efLabel = document.querySelector('#quick .ef-date label');
  ok('hizli_giris_etiketi', !!efLabel && efLabel.control?.classList.contains('date-text') && efLabel.control.value === fmtDateInput(todayISO()));

  // Excel içe aktarma: dönem Türkçe ay adlarıyla seçilir, değer 'YYYY-MM' kalır
  const opts = monthOptions('2026-09');
  ok('excel_ay_listesi', opts.includes('<option value="2026-09" selected>Eylül 2026</option>') && !opts.includes('Ay seç') && monthOptions(null).startsWith('<option value="">Ay seç'));

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
