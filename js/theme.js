/* Görünüm: tema ve yoğunluk. Profilim → Görünüm'den seçilir, bu tarayıcıda saklanır (sunucuda kişinin ayarı olacak).
   Bu dosya <head>'de, stil dosyalarından önce yüklenir: sayfa önce yanlış renkte görünüp sonra değişmesin. */

const THEME_KEY = 'bisolera-theme';
const THEMES = [
  { id: 'klasik', name: 'Klasik', desc: 'Koyu kenar menü, Bisolera yeşili', swatch: ['#070707', '#66cc66', '#f5f6f4'], bar: '#070707' },
  { id: 'ferah', name: 'Açık & ferah', desc: 'Beyaz menü, ince çizgiler', swatch: ['#ffffff', '#66cc66', '#f7f8f7'], bar: '#ffffff' },
  { id: 'gece', name: 'Koyu mod', desc: 'Gece çalışması için koyu zemin', swatch: ['#090b0a', '#66cc66', '#161a18'], bar: '#090b0a' },
  { id: 'kurumsal', name: 'Kurumsal mavi', desc: 'Üstte menü çubuğu, mavi vurgular', swatch: ['#1d2d3e', '#0a6ed1', '#f5f6f7'], bar: '#1d2d3e' },
  { id: 'sicak', name: 'Sıcak & yumuşak', desc: 'Krem zemin, yuvarlak köşeler', swatch: ['#1f3a2a', '#66cc66', '#f7f3ec'], bar: '#1f3a2a' },
];
const DENSITIES = [['rahat', 'Rahat'], ['sik', 'Sıkı']];

const Theme = {
  get() {
    try { return { theme: 'klasik', density: 'rahat', ...JSON.parse(localStorage.getItem(THEME_KEY)) }; } catch { return { theme: 'klasik', density: 'rahat' }; }
  },
  apply({ theme, density } = Theme.get()) {
    const root = document.documentElement, t = THEMES.find(x => x.id === theme) || THEMES[0];
    if (t.id === 'klasik') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t.id);
    if (density === 'sik') root.setAttribute('data-density', 'sik'); else root.removeAttribute('data-density');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bar);   // telefonda üst çubuğun rengi
  },
  set(changes) {
    const next = { ...Theme.get(), ...changes };
    try { localStorage.setItem(THEME_KEY, JSON.stringify(next)); } catch { /* özel pencerede saklanamaz; yine uygulanır */ }
    Theme.apply(next);
    return next;
  },
};
Theme.apply();
