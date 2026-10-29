/* Uygulama kabuğu: oturum, menü ve sayfa yönlendirme (#/ozet, #/aktiviteler?d=2026-10-22 …) */

const SESSION_KEY = 'bisolera-session';

// short: telefonun alt çubuğundaki kısa ad · badge: yöneticiye gösterilen bekleyen iş sayısı
const ROUTES = {
  ozet: { title: 'Özet', icon: 'home', view: DashboardView },
  aktiviteler: { title: 'Aktiviteler', short: 'Aktivite', icon: 'clock', view: ActivitiesView },
  izinler: { title: 'İzinler', short: 'İzin', icon: 'sun', view: LeaveView },
  masraflar: { title: 'Masraflar', short: 'Masraf', icon: 'wallet', view: ExpensesView, badge: () => pendingExpenses() },
  musteriler: { title: 'Müşteriler & Projeler', short: 'Projeler', icon: 'building', view: CustomersView },
  yetkinlik: { title: 'Yetkinlikler', short: 'Yetkinlik', icon: 'award', view: SkillsView },
  yonetim: { title: 'Yönetim', icon: 'shield', view: AdminView, admin: true, badge: () => pendingApprovals() },
};

// Uygulama olarak kurma (PWA): tarayıcı kuruluma hazır olduğunu bildirince pencere bekletilir, Profilim'den açılır
let installPrompt = null, refreshInstall = null;   // refreshInstall: Profilim açıkken kurulum kutusunu yeniden çizer
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; refreshInstall?.(); });
window.addEventListener('appinstalled', () => { installPrompt = null; refreshInstall?.(); });
const isStandalone = () => !!window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;

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
    // Başka sekmede değişiklik olunca ekranı yenile (açık bir pencere varsa içindekini silmemek için dokunma)
    Store.onExternalChange(() => {
      if (!App.user) return;
      App.user = Store.user(App.user.id) || App.user;
      if (document.querySelector('.modal-wrap')) return;
      App.route();
      toast('Başka bir sekmede yapılan değişiklikler yüklendi', { tone: 'info' });
    });
    // Çevrimdışı açılış ve uygulama olarak kurma için (yalnızca http/https; dosyadan açılınca çalışmaz)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker kaydedilemedi', e));
    }
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
            ${links.map(([k, r]) => `<a class="nav-link" data-route="${k}" href="#/${k}">${icon(r.icon)}<span>${r.title}</span>${r.badge ? `<span class="nav-badge" data-badge="${k}" hidden></span>` : ''}</a>`).join('')}
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
          ${links.map(([k, r]) => `<a class="tab" data-route="${k}" href="#/${k}">${icon(r.icon, 20)}<span>${r.short || r.title}</span>${r.badge ? `<span class="tab-badge" data-badge="${k}" hidden></span>` : ''}</a>`).join('')}
        </nav>
      </div>`;
    document.querySelectorAll('[data-profile]').forEach(b => b.addEventListener('click', openProfile));
  },

  // Bekleyen iş sayıları yalnızca yöneticiye gösterilir (izin, ay kapanışı, masraf onayları)
  refreshBadges() {
    document.querySelectorAll('[data-badge]').forEach(b => {
      const n = App.isAdmin() ? ROUTES[b.dataset.badge].badge() : 0;
      b.hidden = !n;
      b.textContent = n;
    });
  },
};

// Profilim → Görünüm: tema ve yoğunluk; seçim anında uygulanır (js/theme.js)
function lookBoxHtml() {
  const { theme, density } = Theme.get();
  return `<div class="look-box" data-look>
    <div class="backup-head">${icon('eye', 16)}<div><strong>Görünüm</strong><p>Seçince bütün sayfalar anında değişir; bu tarayıcıda saklanır.</p></div></div>
    <div class="theme-grid">${THEMES.map(t => `<button type="button" class="theme-opt${t.id === theme ? ' is-active' : ''}" data-theme-id="${t.id}" aria-pressed="${t.id === theme}">
      <span class="theme-swatch">${t.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span><strong>${esc(t.name)}</strong><small>${esc(t.desc)}</small></span>
    </button>`).join('')}</div>
    <div class="theme-density"><span>Yoğunluk</span><div class="tabs">${DENSITIES.map(([k, label]) =>
      `<button type="button" class="${k === density ? 'is-active' : ''}" data-density-id="${k}">${label}</button>`).join('')}</div></div>
  </div>`;
}

// Profilim'deki "uygulama olarak kur" kutusu; zaten uygulama olarak açıksa gösterilmez.
// Kurulum düğmesi yalnızca tarayıcı izin verince (beforeinstallprompt) çıkar: iPhone/iPad'de hiç çıkmaz (Apple izin vermez,
// Paylaş menüsünden eklenir), Android Chrome'da sayfa açıldıktan biraz sonra gelebilir. O zamana kadar cihaza göre adımlar gösterilir.
function installBoxHtml() {
  if (isStandalone()) return '';
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS kendini Mac diye tanıtır
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|LinkedInApp|GSA\//i.test(ua);                                   // başka bir uygulamanın içindeki tarayıcı
  const steps = list => `<ol class="install-steps">${list.map(s => `<li>${s}</li>`).join('')}</ol>`;
  const how = installPrompt ? `<button class="btn ghost sm" data-install>${icon('phone', 15)} Uygulama olarak yükle</button>`
    : inApp ? `<p class="small-text">Bu sayfa başka bir uygulamanın içinde açık; oradan kurulamaz. Bağlantıyı ${ios ? '<strong>Safari</strong>' : '<strong>Chrome</strong>'}’da açıp tekrar dene (sağ üstteki menüden “Tarayıcıda aç”).</p>`
    : ios ? `${steps(['Safari’de alttaki <strong>Paylaş</strong> simgesine dokun (yukarı oklu kare)', 'Listeden <strong>Ana Ekrana Ekle</strong>’yi seç (görünmüyorsa aşağı kaydır)', 'Sağ üstte <strong>Ekle</strong>’ye dokun'])}
      <p class="small-text muted">iPhone’da ana ekrandaki uygulama Safari’deki kayıtları görmez; sunucuya geçene kadar tek yerden kullan.</p>`
    : /android/i.test(ua) ? steps(['Chrome’da sağ üstteki <strong>⋮</strong> menüsüne dokun', '<strong>Uygulamayı yükle</strong> ya da <strong>Ana ekrana ekle</strong>’yi seç', '<strong>Yükle</strong>’ye dokun'])
    : '<p class="small-text">Adres çubuğunun sağındaki kurulum simgesine ya da tarayıcı menüsündeki <strong>Uygulamayı yükle</strong>’ye tıkla.</p>';
  return `<div class="install-box">
    <div class="backup-head">${icon('phone', 16)}<div><strong>Telefona / masaüstüne uygulama olarak kur</strong>
      <p>Kendi simgesiyle açılır; bağlantı yokken de çalışır.</p></div></div>
    ${how}
  </div>`;
}

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
        <div><dt>Yıllık izin</dt><dd>${fmtNum(bal.remaining)} gün kalan${bal.advance ? ' (avans)' : ''}${bal.next ? ` · ${fmtDate(bal.next.date)} +${fmtNum(bal.next.days)} gün` : ''}</dd></div>
      </dl>
      ${lookBoxHtml()}
      <div class="backup-box">
        <div class="backup-head">${icon('download', 16)}<div><strong>Verilerin bu tarayıcıda duruyor</strong>
          <p data-backup-info></p></div></div>
        <div class="row-gap">
          <button class="btn primary sm" data-backup>${icon('download', 15)} Yedek indir</button>
          <label class="btn ghost sm">${icon('upload', 15)} Yedekten geri yükle<input type="file" accept=".json,application/json" data-restore hidden></label>
        </div>
        <div class="backup-confirm" data-restore-confirm hidden></div>
        <p class="form-error" data-backup-error hidden></p>
      </div>
      ${installBoxHtml()}`,
    footer: `<button class="btn ghost sm" data-reset>${icon('refresh', 15)} Demo verilerini sıfırla</button><span class="grow"></span><button class="btn dark sm" data-logout>${icon('logout', 15)} Çıkış yap</button>`,
    onClose() { refreshInstall = null; },
    onMount(m, close) {
      m.querySelector('[data-logout]').addEventListener('click', () => { close(); App.logout(); });
      // Görünüm kutusu her seçimde yeniden çizildiği için dinleyici pencerede
      m.addEventListener('click', e => {
        const t = e.target.closest('[data-look] [data-theme-id]'), d = e.target.closest('[data-look] [data-density-id]');
        if (!t && !d) return;
        Theme.set(t ? { theme: t.dataset.themeId } : { density: d.dataset.densityId });
        m.querySelector('[data-look]').outerHTML = lookBoxHtml();
      });
      m.addEventListener('click', async e => {
        if (!e.target.closest('[data-install]') || !installPrompt) return;
        const prompt = installPrompt;
        installPrompt = null;               // kurulum penceresi yalnızca bir kez açılabilir
        prompt.prompt();
        if ((await prompt.userChoice).outcome === 'accepted') { close(); toast('Portal uygulama olarak yüklendi'); }
      });
      // Tarayıcı kuruluma pencere açıkken izin verirse adımların yerine düğme gelir
      refreshInstall = () => { const box = m.querySelector('.install-box'); if (box) box.outerHTML = installBoxHtml(); };

      // Yedekleme
      const info = m.querySelector('[data-backup-info]'), err = m.querySelector('[data-backup-error]'), confirmBox = m.querySelector('[data-restore-confirm]');
      const showInfo = () => {
        const last = Backup.lastAt(), mb = Backup.usage() / 1048576;
        const space = `Kullanılan alan: ${fmtNum(Math.round(mb * 10) / 10 || 0.1)} MB / yaklaşık 5 MB${mb > 4 ? ' — dolmak üzere, yedek al ve yöneticine haber ver' : ''}.`;
        info.textContent = `${last ? `Son yedek: ${daysAgoText(last)} (${fmtStamp(last)}).` : 'Henüz yedek almadın.'} Tarayıcı verisi silinirse kayıtların gider; düzenli yedek al. ${space}`;
        info.classList.toggle('warn-text', mb > 4);
      };
      const fileName = suffix => `bisolera-portal-yedek-${todayISO()}${suffix}.json`;
      showInfo();
      m.querySelector('[data-backup]').addEventListener('click', async () => {
        const snap = await Backup.snapshotFull();
        downloadText(fileName(''), JSON.stringify(snap, null, 1));
        Backup.markDone();
        showInfo();
        const n = Object.keys(snap.files).length;
        toast(`Yedek indirildi${n ? ` (${n} CV dosyası dahil)` : ''}; dosyayı güvenli bir yerde sakla`);
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
            ${summary.users} kişi · ${summary.activities} aktivite · ${summary.leaves} izin kaydı${summary.files ? ` · ${summary.files} CV dosyası` : ''}</p>
            <p class="warn-text">Bu tarayıcıdaki mevcut verilerin yerini alacak. Güvenlik için önce mevcut verinin yedeği indirilecek.</p>
            <div class="row-gap"><button class="btn danger-ghost sm" data-restore-go>${icon('upload', 15)} Geri yükle</button><button class="btn ghost sm" data-restore-cancel>Vazgeç</button></div>`;
          confirmBox.querySelector('[data-restore-cancel]').onclick = () => { confirmBox.hidden = true; };
          confirmBox.querySelector('[data-restore-go]').onclick = async () => {
            downloadText(fileName('-geri-yukleme-oncesi'), JSON.stringify(await Backup.snapshotFull(), null, 1));
            Backup.restore(backup);
            try { await Backup.restoreFiles(backup); } catch (e) { toast(`CV dosyaları geri yüklenemedi: ${e.message}`, { tone: 'danger' }); }
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
        Files.clear().catch(() => { /* dosya deposu yoksa sorun değil */ });
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
