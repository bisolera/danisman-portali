/* Uygulama kabuğu: oturum, menü ve sayfa yönlendirme (#/ozet, #/aktiviteler?d=2026-10-22 …) */

const SESSION_KEY = 'bisolera-session';

const ROUTES = {
  ozet: { title: 'Özet', icon: 'home', view: DashboardView },
  aktiviteler: { title: 'Aktiviteler', icon: 'clock', view: ActivitiesView },
  izinler: { title: 'İzinler', icon: 'sun', view: LeaveView },
  musteriler: { title: 'Müşteriler & Projeler', short: 'Projeler', icon: 'building', view: CustomersView },
  yonetim: { title: 'Yönetim', icon: 'shield', view: AdminView, admin: true },
};

function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: path || 'ozet', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

const App = {
  user: null,
  cleanup: null,

  start() {
    Store.init();
    let id = null;
    try { id = localStorage.getItem(SESSION_KEY); } catch { /* yok say */ }
    const u = id && Store.user(id);
    App.user = u && u.active ? u : null;
    window.addEventListener('hashchange', () => App.route());
    App.route();
  },

  isAdmin: () => App.user?.role === 'admin',

  login(user) {
    App.user = user;
    try { localStorage.setItem(SESSION_KEY, user.id); } catch { /* yok say */ }
    history.replaceState(null, '', '#/ozet');
    App.renderShell();                     // menü ve profil yeni kullanıcıya göre kurulsun
    App.route();
  },

  logout() {
    App.user = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* yok say */ }
    history.replaceState(null, '', '#/');
    App.route();
  },

  route() {
    App.cleanup?.();
    App.cleanup = null;
    const root = document.getElementById('app');
    if (!App.user) { LoginView.mount(root); return; }
    if (!root.querySelector('.shell')) App.renderShell();

    const { name, query } = parseHash();
    const key = ROUTES[name] && (!ROUTES[name].admin || App.isAdmin()) ? name : 'ozet';
    const route = ROUTES[key];
    root.querySelectorAll('[data-route]').forEach(a => a.classList.toggle('is-active', a.dataset.route === key));
    document.title = `${route.title} · Bisolera Portal`;

    // Her sayfaya temiz bir <main> ver: önceki sayfanın olay dinleyicileri birikmesin
    const old = document.getElementById('view');
    const main = old.cloneNode(false);
    main.classList.add('view-enter');
    old.replaceWith(main);
    App.cleanup = route.view.mount(main, { query }) || null;
    window.scrollTo(0, 0);
    App.refreshBadges();
  },

  renderShell() {
    const u = App.user;
    const links = Object.entries(ROUTES).filter(([, r]) => !r.admin || App.isAdmin());
    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="side">
          <a class="side-brand" href="#/ozet"><img data-logo src="${BRAND.logoOnDark}" alt="Bisolera"></a>
          <div class="side-label">Danışman Portalı</div>
          <nav class="side-nav">
            ${links.map(([k, r]) => `<a class="nav-link" data-route="${k}" href="#/${k}">${icon(r.icon)}<span>${r.title}</span>${r.admin ? '<span class="nav-badge" data-badge hidden></span>' : ''}</a>`).join('')}
          </nav>
          <div class="side-foot">
            <button class="side-user" data-profile>${avatar(u, 34)}<span class="side-user-text"><strong>${esc(u.name)}</strong><small>${esc(u.title)}</small></span></button>
          </div>
        </aside>
        <header class="topbar">
          <a href="#/ozet"><img data-logo src="${BRAND.logoOnDark}" alt="Bisolera"></a>
          <button class="topbar-user" data-profile aria-label="Profilim">${avatar(u, 32)}</button>
        </header>
        <main class="main" id="view"></main>
        <nav class="tabbar">
          ${links.map(([k, r]) => `<a class="tab" data-route="${k}" href="#/${k}">${icon(r.icon, 20)}<span>${r.short || r.title}</span>${r.admin ? '<span class="tab-badge" data-badge hidden></span>' : ''}</a>`).join('')}
        </nav>
      </div>`;
    document.querySelectorAll('[data-profile]').forEach(b => b.addEventListener('click', openProfile));
  },

  refreshBadges() {
    const n = App.isAdmin() ? pendingApprovals() : 0;
    document.querySelectorAll('[data-badge]').forEach(b => { b.hidden = !n; b.textContent = n; });
  },
};

function openProfile() {
  const u = App.user, bal = leaveBalance(u);
  openModal({
    title: 'Profilim',
    body: `
      <div class="profile">${avatar(u, 56)}<div><h3>${esc(u.name)}</h3><p class="muted">${esc(u.title)}</p></div></div>
      <dl class="info-list">
        <div><dt>E-posta</dt><dd>${esc(u.email)}</dd></div>
        <div><dt>Rol</dt><dd>${u.role === 'admin' ? 'Yönetici' : 'Danışman'}</dd></div>
        <div><dt>İşe giriş</dt><dd>${u.startDate ? fmtDate(u.startDate) : '—'}</dd></div>
        <div><dt>Yıllık izin</dt><dd>${u.annualLeave} gün hak · ${fmtNum(bal.remaining)} gün kalan</dd></div>
      </dl>
      <div class="backup-box">
        <div class="backup-head">${icon('download', 16)}<div><strong>Verilerin bu tarayıcıda duruyor</strong>
          <p data-backup-info></p></div></div>
        <div class="row-gap">
          <button class="btn primary sm" data-backup>${icon('download', 15)} Yedek indir</button>
          <label class="btn ghost sm">${icon('upload', 15)} Yedekten geri yükle<input type="file" accept=".json,application/json" data-restore hidden></label>
        </div>
        <div class="backup-confirm" data-restore-confirm hidden></div>
        <p class="form-error" data-backup-error hidden></p>
      </div>`,
    footer: `<button class="btn ghost sm" data-reset>${icon('refresh', 15)} Demo verilerini sıfırla</button><span class="grow"></span><button class="btn dark sm" data-logout>${icon('logout', 15)} Çıkış yap</button>`,
    onMount(m, close) {
      m.querySelector('[data-logout]').addEventListener('click', () => { close(); App.logout(); });

      // Yedekleme
      const info = m.querySelector('[data-backup-info]'), err = m.querySelector('[data-backup-error]'), confirmBox = m.querySelector('[data-restore-confirm]');
      const showInfo = () => {
        const last = Backup.lastAt();
        info.textContent = last ? `Son yedek: ${daysAgoText(last)} (${fmtStamp(last)}). Tarayıcı verisi silinirse kayıtların gider; düzenli yedek al.`
          : 'Henüz yedek almadın. Tarayıcı verisi silinirse kayıtların gider; düzenli yedek al.';
      };
      const fileName = suffix => `bisolera-portal-yedek-${todayISO()}${suffix}.json`;
      showInfo();
      m.querySelector('[data-backup]').addEventListener('click', () => {
        downloadText(fileName(''), JSON.stringify(Backup.snapshot(), null, 1));
        Backup.markDone();
        showInfo();
        toast('Yedek indirildi; dosyayı güvenli bir yerde sakla');
      });
      m.querySelector('[data-restore]').addEventListener('change', async e => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        err.hidden = true;
        try {
          const { backup, summary } = Backup.inspect(await file.text());
          confirmBox.hidden = false;
          confirmBox.innerHTML = `<p><strong>${esc(file.name)}</strong> · ${summary.exportedAt ? fmtStamp(summary.exportedAt) : 'tarih yok'}<br>
            ${summary.users} kişi · ${summary.activities} aktivite · ${summary.leaves} izin kaydı</p>
            <p class="warn-text">Bu tarayıcıdaki mevcut verilerin yerini alacak. Güvenlik için önce mevcut verinin yedeği indirilecek.</p>
            <div class="row-gap"><button class="btn danger-ghost sm" data-restore-go>${icon('upload', 15)} Geri yükle</button><button class="btn ghost sm" data-restore-cancel>Vazgeç</button></div>`;
          confirmBox.querySelector('[data-restore-cancel]').onclick = () => { confirmBox.hidden = true; };
          confirmBox.querySelector('[data-restore-go]').onclick = () => {
            downloadText(fileName('-geri-yukleme-oncesi'), JSON.stringify(Backup.snapshot(), null, 1));
            Backup.restore(backup);
            toast('Yedek geri yüklendi; sayfa yenileniyor');
            setTimeout(() => location.reload(), 600);
          };
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
      });
      const reset = m.querySelector('[data-reset]');
      reset.addEventListener('click', () => {
        if (!reset.dataset.armed) {          // yanlışlıkla sıfırlamayı önlemek için ikinci tık
          reset.dataset.armed = '1';
          reset.classList.replace('ghost', 'danger-ghost');
          reset.innerHTML = `${icon('alert', 15)} Emin misin? Tekrar tıkla`;
          return;
        }
        Store.reset();
        close();
        App.logout();
        toast('Demo verileri sıfırlandı');
      });
    },
  });
}

// Logo yüklenemezse (çevrimdışı vb.) yazıyla göster
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.hasAttribute('data-logo')) {
    const span = document.createElement('span');
    span.className = 'wordmark';
    span.textContent = 'BISOLERA';
    img.replaceWith(span);
  }
}, true);

document.addEventListener('DOMContentLoaded', App.start);
