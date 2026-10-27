// Yetkinlikler: sertifika durumu, deneyim saati, uygun danışman, profil düzenleme yetkisi, CV, proje etiketi, sürüm taşıma
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  const today = todayISO();

  // Sertifika durumu: bitişe 90 gün ve daha az kaldıysa "yakında doluyor"
  ok('sertifika_durumu', certStatus({ expires: addDays(today, 90) }) === 'yakinda' && certStatus({ expires: addDays(today, 91) }) === 'gecerli'
    && certStatus({ expires: today }) === 'yakinda' && certStatus({ expires: addDays(today, -1) }) === 'doldu' && certStatus({}) === 'suresiz');
  ok('demo_sertifikalar', certStatus(Store.certs({ userId: 'u3' })[0]) === 'yakinda' && certStatus(Store.certs({ userId: 'u4' })[0]) === 'doldu');

  // Deneyim: son 12 ayda etiketli projelere yazılan saat; bir proje birden çok yetkinliğe sayılır, eskisi sayılmaz
  const t = Store.addUser({ name: 'Yetkinlik Deneme', email: 'yetkinlik.deneme@bisolera.com', title: 'Danışman', role: 'consultant', annualLeave: 14, startDate: '2020-01-01', skills: { bw: 3, fabric: 2 } });
  Store.addActivity({ userId: t.id, projectId: 'p16', date: addDays(today, -30), hours: 6, type: 'gelistirme', note: 'Fabric aktarımı' });
  Store.addActivity({ userId: t.id, projectId: 'p16', date: addMonths(today, -13), hours: 9, type: 'gelistirme', note: 'Eski' });
  Store.addActivity({ userId: t.id, projectId: 'p13', date: addDays(today, -20), hours: 4, type: 'proje_yonetimi', note: 'İç' });
  const h = skillHours(t.id);
  ok('deneyim_saati', h.fabric === 6 && h.bw === 6 && !h.pm, h);

  // Uygun danışman: hepsinde en az seviye, seviye toplamına göre sıra, sertifika şartı
  ok('arama_seviye', findConsultants({ skills: ['dsp'], minLevel: 2 }).map(r => r.user.id).join() === 'u4,u1');
  ok('arama_sertifika_sarti', findConsultants({ skills: ['dsp'], minLevel: 2, certRequired: true }).length === 0);   // u4'ünki dolmuş, u1'in yok
  const multi = findConsultants({ skills: ['bw', 'fabric'], minLevel: 1 });
  ok('arama_cok_yetkinlik', multi[0]?.user.id === t.id && multi.some(r => r.user.id === 'u2') && !multi.some(r => r.user.id === 'u3'), multi.map(r => [r.user.id, r.levels]));
  ok('arama_musait', findConsultants({ skills: ['bw', 'fabric'], minLevel: 1, available: true }).every(r => r.util.pct < UTILIZATION_TARGET));

  // Profil: danışman kendi seviyesini ve sertifikasını girer
  App.login(Store.user('u2'));
  go('#/yetkinlik');
  ok('sekme_menude', !!document.querySelector('.side-nav [data-route=yetkinlik]') && !!document.querySelector('.tabbar [data-route=yetkinlik]'));
  document.querySelector('[data-skill="dsp"] [data-level="2"]').click();
  ok('seviye_kaydedilir', Store.user('u2').skills.dsp === 2 && document.querySelector('[data-skill="dsp"] .is-active')?.dataset.level === '2');
  document.querySelector('[data-skill="dsp"] [data-level="0"]').click();
  ok('seviye_silinir', !('dsp' in Store.user('u2').skills));

  document.querySelector('[data-add-cert]').click();
  let m = lastModal(), f = m.querySelector('form');
  f.elements.name.value = 'Deneme Fabric sertifikası';
  f.elements.skillId.value = 'fabric';
  f.elements.issued.value = addDays(today, -100);
  f.elements.expires.value = addDays(today, 30);
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('sertifika_eklendi', Store.certs({ userId: 'u2' }).some(c => c.name === 'Deneme Fabric sertifikası' && c.skillId === 'fabric')
    && document.querySelector('#body').textContent.includes('Yakında doluyor'));
  ok('sertifika_uyarisi_sayfada', document.querySelector('#certAlert').textContent.includes('Deneme Fabric'));
  document.querySelector('[data-add-cert]').click();
  m = lastModal(); f = m.querySelector('form');
  f.elements.name.value = 'Ters tarih';
  f.elements.issued.value = today;
  f.elements.expires.value = addDays(today, -5);
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('sertifika_tarih_kontrolu', !m.querySelector('.form-error').hidden && !Store.certs().some(c => c.name === 'Ters tarih'));
  m.querySelector('[data-close]').click();
  await wait(250);

  go('#/ozet');
  ok('ozette_sertifika_hatirlatma', document.querySelector('#certReminder').textContent.includes('Deneme Fabric'));

  // Başkasının profili: görülür, düzenlenemez
  go('#/yetkinlik?v=ben&u=u4');
  ok('baskasi_salt_okunur', document.querySelector('[data-skill="dsp"] [data-level="1"]').disabled && !document.querySelector('[data-add-cert]')
    && document.querySelector('[data-summary]').disabled && document.querySelector('.card-head').textContent.includes('Can Öztürk'));

  // Ekip matrisi ve uygun danışman yalnızca yöneticide: danışman adresle açsa da kendi profiline düşer, sekmeler görünmez
  go('#/yetkinlik?v=ekip');
  ok('danisman_matris_goremez', !document.querySelector('.skill-matrix') && document.querySelector('#modes').hidden && !!document.querySelector('[data-summary]'));
  go('#/yetkinlik?v=ara');
  ok('danisman_arama_goremez', !document.querySelector('[data-search-skill]') && !document.querySelector('[data-available]'));

  App.login(Store.user('u1'));
  // Ekip matrisi: herkes bir satır; altta yetkinlik başına uzman / orta ve üstü sayısı
  go('#/yetkinlik?v=ekip');
  ok('ekip_matrisi', !document.querySelector('#modes').hidden && document.querySelectorAll('.skill-matrix tbody tr').length === Store.users().filter(u => u.active).length
    && document.querySelectorAll('.skill-matrix tfoot td.sm-col').length === SKILLS.length);
  document.querySelector('.skill-matrix tbody tr[data-person-row="u5"]').click();
  ok('matristen_profile', document.querySelector('.card-head').textContent.includes('Elif Şahin') && location.hash.includes('u=u5'));

  // Uygun danışman ekranı: doluluk filtresiyle
  go('#/yetkinlik?v=ara');
  ok('yonetici_doluluk_filtresi', !!document.querySelector('[data-available]'));
  const box = document.querySelector('[data-search-skill][value="dsp"]');
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  ok('arama_ekrani', document.querySelectorAll('#body tr[data-person-row]').length === 2);
  go('#/yetkinlik?v=ben&u=u4');
  document.querySelector('[data-skill="fabric"] [data-level="1"]').click();
  ok('yonetici_duzenler', Store.user('u4').skills.fabric === 1);
  ok('yonetici_ekip_uyarisi', document.querySelector('#certAlert').textContent.includes('Can'));

  // CV: özet, uzmanlıklar, geçerli sertifikalar, müşteri projeleri; dolmuş sertifika ve iç proje girmez; müşteri adı gizlenebilir
  let printed = 0;
  const origPrint = window.print;
  window.print = () => { printed++; };
  Store.updateUser('u2', { summary: 'Deneme özeti' });
  Store.addCert({ userId: 'u2', name: 'Eski sertifika', expires: addDays(today, -3) });
  printCv(Store.user('u2'));
  let cv = document.querySelector('#print-root .cv');
  ok('cv_icerik', printed === 1 && cv.textContent.includes('Emre Aydın') && cv.textContent.includes('Deneme özeti') && cv.textContent.includes('SAP BW 7.x')
    && cv.textContent.includes('Deneme Fabric sertifikası') && !cv.textContent.includes('Eski sertifika') && cv.textContent.includes('Kuzey Elektronik')
    && document.title.startsWith('CV_Emre Aydın'), cv.textContent.slice(0, 300));
  printCv(Store.user('u2'), { hideCustomers: true });
  cv = document.querySelector('#print-root .cv');
  ok('cv_musteri_gizli', !cv.textContent.includes('Kuzey Elektronik') && cv.textContent.includes('Dayanıklı tüketim sektörü'));
  openCvDialog(Store.user('u4'));
  lastModal().querySelector('[data-print]').click();
  ok('cv_penceresi', printed === 3 && document.querySelector('#print-root .cv').textContent.includes('Can Öztürk'));
  window.print = origPrint;
  await wait(250);

  // Proje formunda yetkinlik etiketi
  go('#/musteriler');
  document.querySelector('[data-edit-project="p12"]').click();
  m = lastModal(); f = m.querySelector('form');
  f.querySelector('[name=skills][value="pm"]').checked = true;
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('proje_yetkinlik_etiketi', Store.project('p12').skills.join() === 'pm');

  // Sürüm taşıma: v6 verisine sertifika listesi ve demo projelerin etiketleri eklenir, kayıtlar korunur
  const snap = JSON.parse(localStorage.getItem('bisolera-portal-v1'));
  snap.version = 6;
  delete snap.certs;
  snap.projects.forEach(p => delete p.skills);
  const n = snap.activities.length;
  localStorage.setItem('bisolera-portal-v1', JSON.stringify(snap));
  Store.init();
  ok('tasima_yetkinlik', Store.certs().length === 0 && Store.project('p16').skills.join() === 'bw,fabric' && Store.project('p12').skills.length === 0
    && Store.activities().length === n && JSON.parse(localStorage.getItem('bisolera-portal-v1')).version === DATA_VERSION);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
