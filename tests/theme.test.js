// Görünüm (Profilim): tema ve yoğunluk anında uygulanır, bu tarayıcıda saklanır, varsayılan "Klasik"
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const root = document.documentElement;
  const lastModal = () => [...document.querySelectorAll('.modal')].pop();

  localStorage.clear();
  Store.init();
  Theme.apply();
  ok('varsayilan_klasik', !root.hasAttribute('data-theme') && !root.hasAttribute('data-density'));
  ok('yuzen_dugme_yok', !document.querySelector('.theme-fab'));

  App.login(Store.user('u2'));
  document.querySelector('.side-user[data-profile]').click();
  let m = lastModal();
  const look = () => m.querySelector('[data-look]');
  ok('profilde_gorunum', !!look() && look().querySelectorAll('[data-theme-id]').length === THEMES.length
    && look().querySelector('[data-theme-id="klasik"]').classList.contains('is-active'));

  look().querySelector('[data-theme-id="gece"]').click();
  ok('tema_uygulanir', root.getAttribute('data-theme') === 'gece' && JSON.parse(localStorage.getItem(THEME_KEY)).theme === 'gece'
    && look().querySelector('[data-theme-id="gece"]').classList.contains('is-active'));
  look().querySelector('[data-density-id="sik"]').click();
  ok('yogunluk', root.getAttribute('data-density') === 'sik' && root.getAttribute('data-theme') === 'gece'
    && look().querySelector('[data-density-id="sik"]').classList.contains('is-active'));
  look().querySelector('[data-theme-id="kurumsal"]').click();
  ok('ikinci_secim', root.getAttribute('data-theme') === 'kurumsal');

  // Sayfa yeniden açılınca saklanan seçim uygulanır
  root.removeAttribute('data-theme');
  root.removeAttribute('data-density');
  Theme.apply();
  ok('saklanan_secim', root.getAttribute('data-theme') === 'kurumsal' && root.getAttribute('data-density') === 'sik');

  look().querySelector('[data-theme-id="klasik"]').click();
  look().querySelector('[data-density-id="rahat"]').click();
  ok('klasige_donus', !root.hasAttribute('data-theme') && !root.hasAttribute('data-density'));
  m.querySelector('[data-close]').click();
  await wait(250);

  // Yedeğe girer; bilinmeyen tema adı (eski kayıt) klasiğe düşer
  Theme.set({ theme: 'sicak' });
  ok('yedekte_gorunum', JSON.parse(Backup.snapshot().data[THEME_KEY]).theme === 'sicak');
  localStorage.setItem(THEME_KEY, JSON.stringify({ theme: 'yok-boyle-tema' }));
  Theme.apply();
  ok('bilinmeyen_tema', !root.hasAttribute('data-theme'));
  localStorage.removeItem(THEME_KEY);
  Theme.apply();

  window.__result = R;
})().catch(e => { window.__result = { CRASH: `FAIL ${e.stack}` }; });
