// Uygulama olarak kurma kutusu: cihaza göre adımlar (iPhone, Android, başka uygulamanın içindeki tarayıcı, bilgisayar);
// tarayıcı kuruluma izin verince (beforeinstallprompt) Profilim açıkken düğme kendiliğinden gelir.
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const realUA = navigator.userAgent;
  const as = ua => Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });

  localStorage.clear();
  Store.init();
  App.login(Store.user('u2'));

  as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  let html = installBoxHtml();
  ok('iphone_adimlar', html.includes('Ana Ekrana Ekle') && html.includes('Paylaş') && html.includes('install-steps') && !html.includes('data-install'));
  as('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36');
  html = installBoxHtml();
  ok('android_adimlar', html.includes('Uygulamayı yükle') && html.includes('⋮') && html.includes('install-steps'));
  as('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0');
  html = installBoxHtml();
  ok('uygulama_ici_tarayici', html.includes('başka bir uygulamanın içinde') && html.includes('Safari') && !html.includes('install-steps'));
  as(realUA);
  ok('bilgisayar', installBoxHtml().includes('kurulum simgesine'));

  // Profilim açıkken tarayıcı izin verir → düğme gelir; düğme kurulum penceresini açar
  openProfile();
  const modal = () => [...document.querySelectorAll('.modal')].pop();
  ok('once_dugme_yok', !!modal().querySelector('.install-box') && !modal().querySelector('[data-install]'));
  let prompted = 0;
  const ev = new Event('beforeinstallprompt', { cancelable: true });
  ev.prompt = () => { prompted++; };
  ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(ev);
  ok('dugme_kendiliginden_gelir', !!modal().querySelector('[data-install]') && ev.defaultPrevented);
  modal().querySelector('[data-install]').click();
  await wait(50);
  ok('kurulum_penceresi', prompted === 1);
  modal().querySelector('[data-close]')?.click();
  await wait(250);
  window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt() {}, userChoice: Promise.resolve({}) }));
  ok('kapaninca_dinlemez', !document.querySelector('.install-box'));

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
