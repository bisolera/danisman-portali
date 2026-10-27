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
  // Dosya deposu (IndexedDB) jsdom'da yok: her test dosyasına boş ve ayrı bir sahte depo
  const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;
  // JSZip'in zamanlayıcısı jsdom'un postMessage'ında takılıyor; gerçek tarayıcıda gerek yok
  window.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
  const inject = code => { const s = window.document.createElement('script'); s.textContent = code; window.document.body.appendChild(s); };

  // Excel ve Word önizleme kütüphaneleri önceden yüklenir; uygulamanın kendi yükleyicileri bunları kullanır
  for (const lib of ['vendor/xlsx/xlsx.full.min.js', 'vendor/jszip/jszip.min.js', 'vendor/docx-preview/docx-preview.min.js']) {
    inject(fs.readFileSync(path.join(ROOT, lib), 'utf8'));
  }
  for (const src of scripts) inject(fs.readFileSync(path.join(ROOT, src), 'utf8'));
  // Test, gerçek tarayıcıdaki gibi sayfa açıldıktan (App.start) sonra başlar; yoksa açılış testin ortasında ekranı yeniden kurar
  if (window.document.readyState === 'loading') await new Promise(r => window.document.addEventListener('DOMContentLoaded', r, { once: true }));
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
