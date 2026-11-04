// Köprü düzeltme talebi: seçim süresi geçince danışman yöneticiden ister; geri alma, onay (izin bakiyesi düzelir),
// red, kapanmış ayda da talep, yönetici rozeti.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const go = h => { history.replaceState(null, '', h); App.route(); };
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };

  localStorage.clear();
  Store.init();
  // Geçmişte kalmış tam gün köprü (cuma); danışman seçim yapmadığı için izinli sayılır
  const day = ['2026-06-19', '2026-06-12', '2026-09-11'].find(d => !Store.holidaysOn(d).length);
  const br = Store.addHoliday({ date: day, name: 'Deneme köprüsü', kind: 'kopru' });
  const u3 = () => Store.user('u3'), bridge = () => Store.holidays().find(h => h.id === br.id);
  const usedBefore = bridgeDays(u3());
  ok('kurulum', !!br && day < todayISO() && bridgeOff(br, 'u3') === 1 && !canChooseBridge(br, 'u3') && canRequestBridge(br, u3()), day);

  // Danışman: İzinler'de geçmiş köprü, düzeltme talebi
  App.login(u3());
  go('#/izinler');
  const row = () => document.querySelector(`#bridges [data-bridge="${br.id}"]`);
  ok('gecmis_koprude_dugme', !!row()?.querySelector('[data-bridge-request]') && !row().querySelector('[data-bridge-work]')
    && document.querySelector('#bridges').textContent.includes('Geçmiş köprüler'));
  row().querySelector('[data-bridge-request]').click();
  let m = lastModal(), f = m.querySelector('form');
  ok('form', f.elements.choice.value === 'full' && m.textContent.includes('İzinliydim') && m.querySelector('[data-effect]').textContent.includes('düşmez')
    && m.querySelector('[data-effect]').textContent.includes('Aktiviteler'), m.querySelector('[data-effect]').textContent);
  f.querySelector('#brq-off').checked = true;
  f.dispatchEvent(new Event('change', { bubbles: true }));
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  ok('ayni_secim_engeli', !m.querySelector('.form-error').hidden && !bridge().requests?.u3);
  f.querySelector('#brq-full').checked = true;
  f.elements.note.value = 'Müşteride kurulum vardı';
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  ok('talep_gitti', bridge().requests?.u3?.status === 'beklemede' && bridge().requests.u3.choice === 'full' && bridge().requests.u3.note === 'Müşteride kurulum vardı'
    && row().textContent.includes('Talep yöneticide') && bridgeDays(u3()) === usedBefore);
  ok('beklerken_yeni_talep_yok', !canRequestBridge(bridge(), u3()) && !row().querySelector('[data-bridge-request]'));
  row().querySelector('[data-bridge-request-undo]').click();
  ok('geri_alindi', !bridge().requests?.u3 && !!row().querySelector('[data-bridge-request]'));
  row().querySelector('[data-bridge-request]').click();
  m = lastModal(); f = m.querySelector('form');
  f.dispatchEvent(new Event('submit', { cancelable: true }));   // hazır seçim: tam gün çalıştım
  await wait(250);

  // Yönetici: İzin onayları'nda talep, rozet, onay → seçim uygulanır, 1 gün bakiyeye döner
  App.login(Store.user('u1'));
  go('#/yonetim?tab=onaylar');
  const panel = () => document.querySelector('#panel');
  const req = () => panel().querySelector(`[data-bridge-req="${br.id}"][data-req-user="u3"]`);
  ok('onay_ekrani', req()?.textContent.includes('Tam gün çalıştım') && req().textContent.includes('şu an: İzinliydim')
    && req().textContent.includes('1 gün bakiyeye döner') && !!req().querySelector('.warn-text') && bridgeRequests().length === 1, req()?.textContent);
  ok('rozet', document.querySelector('[data-tab="onaylar"] .count')?.textContent.trim() !== '' && pendingApprovals() >= 1);
  req().querySelector('[data-bridge-decide="onaylandi"]').click();
  ok('onaylandi', bridgeWork(bridge(), 'u3') === 'full' && bridge().requests.u3.status === 'onaylandi' && bridge().requests.u3.decidedBy === 'u1'
    && bridgeDays(u3()) === usedBefore - 1 && !req(), [bridgeWork(bridge(), 'u3'), bridgeDays(u3()), usedBefore]);
  [...document.querySelectorAll('.toast-btn')].pop().click();
  ok('onay_geri_alinir', !bridgeWork(bridge(), 'u3') && bridge().requests.u3.status === 'beklemede' && !!req());
  req().querySelector('[data-bridge-decide="onaylandi"]').click();

  // Danışman sonucu görür; yeni talepte red seçimi değiştirmez
  App.login(u3());
  go('#/izinler');
  ok('danisman_onayi_gorur', row().textContent.includes('onayladı') && row().textContent.includes('Tam gün çalışıyorsun'));
  row().querySelector('[data-bridge-request]').click();
  m = lastModal(); f = m.querySelector('form');
  ok('yeni_talep_hazir_secim', f.elements.choice.value === 'off');
  f.dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(250);
  App.login(Store.user('u1'));
  go('#/yonetim?tab=onaylar');
  req().querySelector('[data-bridge-decide="reddedildi"]').click();
  ok('reddedildi', bridge().requests.u3.status === 'reddedildi' && bridgeWork(bridge(), 'u3') === 'full' && bridgeRequests().length === 0);
  App.login(u3());
  go('#/izinler');
  ok('danisman_reddi_gorur', row().textContent.includes('reddedildi') && !!row().querySelector('[data-bridge-request]'));

  // Kapanmış ay: talep yine gönderilir, formda uyarı çıkar
  Store.setPeriod('u3', day.slice(0, 7), { status: 'onaylandi' });
  go('#/izinler');
  row().querySelector('[data-bridge-request]').click();
  m = lastModal();
  ok('kapali_ayda_talep', m.textContent.includes('kapanışa gönderilmiş') && m.textContent.includes('yeniden hesaplanır'));
  m.querySelector('[data-close]').click();
  await wait(250);

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
