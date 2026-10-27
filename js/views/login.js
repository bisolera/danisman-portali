/* Giriş ekranı. Prototipte e-posta ile, canlı sürümde Microsoft 365 (Entra ID) ile giriş. */

const MS_LOGO = '<svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>';

const LoginView = {
  mount(root) {
    const demo = Store.users().filter(u => u.active);
    root.innerHTML = `
      <div class="login">
        <section class="login-hero">
          <img class="login-logo" data-logo src="${BRAND.logoOnDark}" alt="Bisolera">
          <div class="login-copy">
            <span class="eyebrow">Danışman Portalı</span>
            <h1>Aktivite, izin ve projelerin<br><span class="accent">tek ekranda.</span></h1>
            <ul class="login-points">
              <li>${icon('clock')} Günlük aktiviteni saniyeler içinde gir</li>
              <li>${icon('sun')} İzin bakiyeni gör, talebini anında ilet</li>
              <li>${icon('building')} Müşterilere ve aktif projelere hızlı erişim</li>
            </ul>
          </div>
          <p class="login-foot">© ${new Date().getFullYear()} Bisolera · Business Intelligence Solutions Era</p>
        </section>

        <section class="login-panel">
          <form class="login-card" novalidate>
            <h2>Giriş yap</h2>
            <p class="muted">Şirket e-posta adresinle devam et.</p>
            <button type="button" class="btn ms-btn" data-ms>${MS_LOGO} Microsoft 365 ile giriş yap</button>
            <div class="or"><span>veya</span></div>
            <label class="field">
              <span class="field-label">E-posta</span>
              <input class="input lg" type="email" name="email" placeholder="ad.soyad@${COMPANY_DOMAIN}" autocomplete="username">
            </label>
            <p class="form-error" hidden></p>
            <button class="btn primary lg block" type="submit">Devam et ${icon('arrow-right', 16)}</button>
            <div class="demo">
              <span class="demo-title">Demo hesaplar — tıkla, gir</span>
              <div class="demo-list">
                ${demo.map(u => `<button type="button" class="demo-user" data-email="${esc(u.email)}">${avatar(u, 30)}<span><strong>${esc(u.name)}</strong><small>${u.role === 'admin' ? 'Yönetici' : esc(u.title)}</small></span></button>`).join('')}
              </div>
            </div>
          </form>
          <p class="login-note">${icon('info', 14)} Prototip sürüm: veriler yalnızca bu tarayıcıda saklanır.</p>
        </section>
      </div>`;

    const form = root.querySelector('form');
    const email = form.elements.email;
    const err = form.querySelector('.form-error');
    const fail = msg => { err.textContent = msg; err.hidden = false; email.classList.add('is-invalid'); email.focus(); };

    form.addEventListener('submit', e => {
      e.preventDefault();
      let value = email.value.trim().toLowerCase();
      if (!value) return fail('E-posta adresini yaz.');
      if (!value.includes('@')) value += '@' + COMPANY_DOMAIN;   // "ad.soyad" yazmak yeterli
      if (!value.endsWith('@' + COMPANY_DOMAIN)) return fail(`Yalnızca @${COMPANY_DOMAIN} adresleriyle giriş yapılabilir.`);
      const user = Store.userByEmail(value);
      if (!user) return fail('Bu adresle kayıtlı bir danışman yok. Yöneticinden hesabını açmasını iste.');
      if (!user.active) return fail('Hesabın pasif durumda. Yöneticinle iletişime geç.');
      App.login(user);
    });
    email.addEventListener('input', () => { err.hidden = true; email.classList.remove('is-invalid'); });
    root.querySelector('[data-ms]').addEventListener('click', () =>
      toast('Canlı sürümde Microsoft 365 hesabınla tek tıkla gireceksin. Şimdilik e-postanı yaz ya da bir demo hesap seç.', { tone: 'info', duration: 6000 }));
    root.querySelectorAll('[data-email]').forEach(b => b.addEventListener('click', () => App.login(Store.userByEmail(b.dataset.email))));
    email.focus();
  },
};
