// Dosya düzeyinde kontroller (tarayıcı gerekmez): telefona kurulum manifesti ve service worker'ın önbellek listesi.
// Yeni bir JS/CSS dosyası eklenip sw.js → SHELL'e yazılmazsa bu kontrol kırılır; yoksa çevrimdışı açılış bozulur.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));

module.exports = function staticChecks() {
  const R = {};
  const ok = (name, cond, info) => { R[name] = cond ? 'OK' : `FAIL ${JSON.stringify(info ?? '')}`; };
  const html = read('index.html');

  let manifest = null;
  try { manifest = JSON.parse(read('manifest.webmanifest')); } catch { /* aşağıda FAIL olur */ }
  ok('manifest_gecerli', !!manifest && manifest.display === 'standalone' && !!manifest.start_url && !!manifest.short_name);
  const icons = manifest?.icons || [];
  ok('manifest_simgeleri', ['192x192', '512x512'].every(s => icons.some(i => i.sizes === s)) && icons.some(i => i.purpose === 'maskable')
    && icons.every(i => exists(i.src)), icons.filter(i => !exists(i.src)).map(i => i.src));
  ok('index_manifest_bagli', html.includes('<link rel="manifest" href="manifest.webmanifest">') && exists('icons/apple-touch-icon.png'));

  const list = read('sw.js').match(/const SHELL = (\[[\s\S]*?\]);/);
  const shell = list ? Function(`return ${list[1]}`)() : [];
  ok('sw_dosyalari_var', shell.length > 0 && shell.filter(f => f !== './').every(exists), shell.filter(f => f !== './' && !exists(f)));
  const needed = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map(m => m[1])
    .concat([...read('css/fonts.css').matchAll(/url\('\.\.\/([^']+)'\)/g)].map(m => m[1]));
  ok('sw_listesi_eksiksiz', needed.length > 10 && needed.every(f => shell.includes(f)), needed.filter(f => !shell.includes(f)));
  return R;
};
