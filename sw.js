/* Service worker: portal telefona/masaüstüne uygulama gibi kurulabilsin ve bağlantı yokken de açılsın.
   Bağlantı varken her dosya sunucudan güncel alınır (ağ önce); yalnızca bağlantı yoksa önbellekteki kopya kullanılır.
   Böylece yeni sürüm yayınlandığında kimse eski kodda kalmaz. Yeni dosya eklenince SHELL listesine de ekle
   (npm test eksik dosyayı yakalar). */

const CACHE = 'bisolera-portal-v2';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/styles.css',
  'js/utils.js',
  'js/data.js',
  'js/store.js',
  'js/rules.js',
  'js/ui.js',
  'js/excel.js',
  'js/print.js',
  'js/files.js',
  'js/closing.js',
  'js/calendar.js',
  'js/views/login.js',
  'js/views/dashboard.js',
  'js/views/activities.js',
  'js/views/leave.js',
  'js/views/customers.js',
  'js/views/skills.js',
  'js/views/admin.js',
  'js/app.js',
  'vendor/fonts/inter-latin.woff2',
  'vendor/fonts/inter-latin-ext.woff2',
  'vendor/fonts/montserrat-latin.woff2',
  'vendor/fonts/montserrat-latin-ext.woff2',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // dış adresler (logo vb.) tarayıcıya kalır
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
