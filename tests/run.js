// Portalı jsdom içinde (tarayıcı açmadan) yükler ve bir test dosyasını sayfa bağlamında çalıştırır.
// Test dosyası sonuçları window.__result'a { testAdı: 'OK' | 'FAIL …' } olarak yazar.
process.env.TZ = 'Europe/Istanbul';   // tatil ve gün hesapları Türkiye saatine göre
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

async function runTestFile(testFile) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
  vc.on('error', (...a) => errors.push(a.join(' ')));
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div><div id="toasts"></div></body></html>',
    { url: 'http://localhost:4399/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};
  const inject = code => { const s = window.document.createElement('script'); s.textContent = code; window.document.body.appendChild(s); };

  // Excel kütüphanesi önceden yüklenir; uygulamanın kendi yükleyicisi bunu kullanır
  inject(fs.readFileSync(path.join(ROOT, 'vendor/xlsx/xlsx.full.min.js'), 'utf8'));
  for (const src of scripts) inject(fs.readFileSync(path.join(ROOT, src), 'utf8'));
  inject(fs.readFileSync(testFile, 'utf8'));

  for (let i = 0; i < 150 && !window.__result; i++) await new Promise(r => setTimeout(r, 100));
  const result = window.__result || { ZAMAN_ASIMI: 'FAIL test 15 saniyede bitmedi' };
  window.close();
  return { result, errors };
}

module.exports = { runTestFile };

if (require.main === module) {
  runTestFile(path.resolve(process.argv[2])).then(out => console.log(JSON.stringify(out, null, 2)));
}
