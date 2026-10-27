// Outlook takvim önerileri: .ics ayrıştırma, tekrarlar, eşleştirme, ekleme/öğrenme, kilit, arayüz
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  App.login(Store.user('u2'));
  const me = App.user, mon = weekStart(todayISO());
  const ymd = iso => iso.replace(/-/g, '');
  const day = n => addDays(mon, n);

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:ev1', 'SUMMARY:Kuzey rapor farkı\\, kontrol',
    `DTSTART;TZID=Turkey Standard Time:${ymd(day(0))}T100000`, `DTEND;TZID=Turkey Standard Time:${ymd(day(0))}T113000`,
    'ATTENDEE;CN=Emre;PARTSTAT=ACCEPTED:mailto:emre.aydin@bisolera.com', 'ATTENDEE;CN=Ekip:mailto:bw@kuzeyelektronik.example',
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'DESCRIPTION:Reminder', 'END:VALARM', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ev2', 'SUMMARY:Haftalık Mavi durum',
    `DTSTART:${ymd(day(-13))}T110000Z`, `DTEND:${ymd(day(-13))}T120000Z`, 'RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=10',
    `EXDATE:${ymd(day(-6))}T110000Z`, 'ATTENDEE:mailto:durum@maviseramik.example', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ev2', `RECURRENCE-ID:${ymd(day(1))}T110000Z`, 'SUMMARY:Haftalık Mavi durum (ertelendi)',
    `DTSTART:${ymd(day(2))}T130000Z`, `DTEND:${ymd(day(2))}T140000Z`, 'ATTENDEE:mailto:durum@maviseramik.example', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ev3', 'SUMMARY:Cumhuriyet Bayramı', `DTSTART;VALUE=DATE:${ymd(day(3))}`, `DTEND;VALUE=DATE:${ymd(day(4))}`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ev4', 'SUMMARY:Ada sync', 'STATUS:CANCELLED', `DTSTART:${ymd(day(0))}T150000`, `DTEND:${ymd(day(0))}T160000`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ev5', 'SUMMARY:Odak zamanı', 'TRANSP:TRANSPARENT', `DTSTART:${ymd(day(0))}T160000`, `DTEND:${ymd(day(0))}T170000`, 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ev6', 'SUMMARY:Uzun konu satırı katlanmış test toplant', ' ısı DMR-BW', `DTSTART:${ymd(day(4))}T090000`, 'DURATION:PT1H15M', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const events = parseICS(ics);
  ok('ics_etkinlik_sayisi', events.length === 7, events.length);
  ok('ics_kacis_ve_katlama', events[0].subject === 'Kuzey rapor farkı, kontrol' && events[6].subject === 'Uzun konu satırı katlanmış test toplantısı DMR-BW', [events[0].subject, events[6].subject]);
  ok('ics_valarm_atlandi', events[0].attendees.length === 2, events[0].attendees);
  ok('ics_utc_yerel', events[1].start === `${day(-13)}T14:00`, events[1].start);

  const on = d => eventsBetween(events, d, d).map(e => `${e.start.slice(11)} ${e.subject}`);
  ok('tekrar_hariç_gun', on(day(-6)).length === 0, on(day(-6)));
  ok('tekrar_onceki_hafta', on(day(-13)).join() === '14:00 Haftalık Mavi durum', on(day(-13)));
  ok('ertelenen_eski_gunde_yok', on(day(1)).length === 0, on(day(1)));
  ok('ertelenen_yeni_gunde', on(day(2)).join() === '16:00 Haftalık Mavi durum (ertelendi)', on(day(2)));
  ok('tekrar_sonraki_hafta', on(day(8)).join() === '14:00 Haftalık Mavi durum', on(day(8)));

  CalendarStore.set(me.id, { source: 'ics', name: 'test.ics', loadedAt: new Date().toISOString(), events });
  const monS = calendarSuggestions(me.id, day(0));
  ok('iptal_musait_tumgun_elenir', monS.length === 1 && monS[0].event.uid === 'ev1', monS.map(s => s.event.subject));
  ok('sure_1_5', monS[0].hours === 1.5, monS[0].hours);
  ok('alan_adi_eslesme', monS[0].projectId === 'p14' && monS[0].reason.includes('kuzeyelektronik.example'), monS[0]);
  const friS = calendarSuggestions(me.id, day(4));
  ok('proje_kodu_ve_sure', friS[0].projectId === 'p17' && friS[0].hours === 1.25, friS[0]);
  ok('tatil_gunu_bos', calendarSuggestions(me.id, day(3)).length === 0);

  // Arayüz: günlük görünümde ekle → kayıt + kaynak + öğrenme
  go(`#/aktiviteler?d=${day(0)}&v=gun`);
  ok('kart_gorunur', document.querySelectorAll('#calCard .sug-row').length === 1);
  document.querySelector('#calCard [data-sug-add]').click();
  await wait(100);
  const added = Store.activities({ userId: me.id, from: day(0), to: day(0) }).filter(a => a.source);
  ok('eklendi', added.length === 1 && added[0].hours === 1.5 && added[0].source?.kind === 'outlook' && added[0].type === 'toplanti', added);
  ok('eklendi_rozeti', document.querySelector('#calCard .sug-row.is-added') && document.querySelector('#dayList .act-src'));
  // Yeni günlük düzen: kayıtlar ve form aynı kartta, tarih alanı yok, tablo hafta içi 5 gün
  ok('gun_karti_tek', !!document.querySelector('.day-panel #dayList') && !!document.querySelector('.day-panel .composer #entryForm form'));
  ok('tarih_alani_gizli', document.querySelector('#entryForm input[name=date]').type === 'hidden');

  // Örnek takvim: şirket içi toplantı için proje seçilince öğrenilir, sonraki hafta otomatik gelir
  CalendarStore.set(me.id, { source: 'demo', name: 'Örnek takvim', loadedAt: new Date().toISOString(), events: demoCalendar(me) });
  const friDemo = () => calendarSuggestions(me.id, day(4)).find(s => s.event.uid === 'demo-ekip');
  ok('ic_toplanti_proje_bekler', friDemo() && !friDemo().projectId, friDemo());
  ok('ogle_arasi_elenir', !calendarSuggestions(me.id, day(0)).some(s => s.event.subject === 'Öğle arası'));
  go(`#/aktiviteler?d=${day(4)}&v=gun`);
  const row = [...document.querySelectorAll('#calCard .sug-row')].find(r => r.textContent.includes('ekip toplantısı'));
  ok('ekle_kapali_proje_yok', row.querySelector('[data-sug-add]').disabled);
  const sel = row.querySelector('[data-sug-proj]');
  sel.value = 'p13';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  const row2 = [...document.querySelectorAll('#calCard .sug-row')].find(r => r.textContent.includes('ekip toplantısı'));
  ok('ekle_acildi', !row2.querySelector('[data-sug-add]').disabled);
  row2.querySelector('[data-sug-add]').click();
  await wait(100);
  const next = calendarSuggestions(me.id, day(11)).find(s => s.event.uid === 'demo-ekip');
  ok('ogrenilen_eslestirme', next.projectId === 'p13' && next.reason.includes('Daha önce'), next);

  // Yoksay ve hepsini ekle
  go(`#/aktiviteler?d=${day(2)}&v=gun`);
  const before = document.querySelectorAll('#calCard .sug-row:not(.is-added)').length;
  document.querySelector('#calCard [data-sug-skip]').click();
  ok('yoksay', document.querySelectorAll('#calCard .sug-row:not(.is-added)').length === before - 1, before);
  go(`#/aktiviteler?d=${day(8)}&v=gun`);   // gelecek salı: stand-up (Kuzey Elektronik) + Mavi Seramik
  const allBtn = document.querySelector('#calCard [data-sug-all]');
  const nAll = allBtn ? Number(allBtn.textContent.match(/\d+/)[0]) : 0;
  allBtn?.click();
  await wait(100);
  const viaAll = Store.activities({ userId: me.id, from: day(8), to: day(8) }).filter(a => a.source).map(a => a.projectId).sort().join();
  ok('hepsini_ekle', nAll === 2 && viaAll === 'p14,p15', { nAll, viaAll });

  // Kilitli ayda öneri eklenemez
  const prev = addMonths(todayISO(), -1);
  const lockedDay = dateRange(monthStart(prev), monthEnd(prev)).find(d => !isWeekend(d) && !getHoliday(d));
  CalendarStore.set(me.id, { source: 'ics', name: 't', loadedAt: new Date().toISOString(),
    events: [{ uid: 'L', subject: 'Kuzey toplantı', start: `${lockedDay}T10:00`, end: `${lockedDay}T11:00`, attendees: ['a@kuzeyelektronik.example'], exdates: [] }] });
  Store.addActivity({ userId: me.id, projectId: 'p14', date: lockedDay, hours: 7, type: 'destek', note: 'x' });
  Store.setPeriod(me.id, prev.slice(0, 7), { status: 'gonderildi' }, { by: me.id, action: 'gonderildi' });
  go(`#/aktiviteler?d=${lockedDay}&v=gun`);
  ok('kilitli_ay_pasif', document.querySelector('#calCard .sug-row').textContent.includes('Ay kilitli') && !document.querySelector('#calCard [data-sug-add]'));

  // Özet: bugünün önerisi için kısa yol; takvim yoksa bağlan kartı
  CalendarStore.set(me.id, { source: 'demo', name: 'Örnek takvim', loadedAt: new Date().toISOString(), events: demoCalendar(me) });
  go('#/ozet');
  const hint = document.querySelector('#calHint').textContent;
  ok('ozet_kisayol', isWeekend(todayISO()) || getHoliday(todayISO()) || /Takviminde \d+ toplantı/.test(hint), hint);
  CalendarStore.clear(me.id);
  go(`#/aktiviteler?d=${day(0)}&v=gun`);
  ok('bagla_karti', !!document.querySelector('#calCard [data-cal-connect]') && document.querySelector('#calCard').textContent.includes('Takvimi bağla'));
  document.querySelector('#calCard [data-cal-connect]').click();
  const modal = [...document.querySelectorAll('.modal')].pop();
  modal.querySelector('[data-demo]').click();
  await wait(250);
  ok('ornek_takvim_yuklenir', CalendarStore.get(me.id)?.source === 'demo' && document.querySelectorAll('#calCard .sug-row').length >= 1);

  // Haftalık tablo: hafta sonu varsayılan gizli, "+ not" satırın altında not alanı açar, notlu hücre kaydı
  Prefs.set(me.id, { gridWeekend: false });
  go(`#/aktiviteler?d=${day(14)}&v=tablo`);
  ok('tablo_5_gun', document.querySelectorAll('.grid-table thead .day-col').length === 5, document.querySelectorAll('.grid-table thead .day-col').length);
  const firstRow = document.querySelector('.grid-table tbody tr[data-pid]');
  const pid = firstRow.dataset.pid;
  firstRow.querySelector('[data-note-toggle]').click();
  const noteInput = document.querySelector(`.note-row[data-pid="${pid}"] input`);
  ok('not_satiri_acilir', !!noteInput);
  noteInput.value = 'Tablodan not';
  noteInput.dispatchEvent(new Event('input', { bubbles: true }));
  const cell = document.querySelector(`.grid-table tr[data-pid="${pid}"] .ginput[data-c="0"]`);
  cell.value = '3';
  cell.dispatchEvent(new Event('change', { bubbles: true }));
  const made = Store.activities({ userId: me.id, from: day(14), to: day(14), projectId: pid }).find(a => a.note === 'Tablodan not');
  ok('not_ile_kayit', made?.hours === 3, made);
  document.querySelector('[data-weekend]').click();
  ok('hafta_sonu_acilir', document.querySelectorAll('.grid-table thead .day-col').length === 7);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: e.stack }; });
