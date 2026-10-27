// npm test: tests/*.test.js dosyalarının hepsini ve dosya kontrollerini çalıştırır; bir hata varsa çıkış kodu 1 olur (CI için)
const fs = require('fs');
const path = require('path');
const { runTestFile } = require('./run');
const staticChecks = require('./static-checks');

(async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
  let failed = 0, total = 0;
  for (const f of [...files, 'static-checks.js']) {
    const { result, errors } = f === 'static-checks.js' ? { result: staticChecks(), errors: [] } : await runTestFile(path.join(__dirname, f));
    const entries = Object.entries(result);
    const bad = entries.filter(([, v]) => v !== 'OK');
    total += entries.length;
    failed += bad.length + errors.length;
    console.log(`${bad.length || errors.length ? '✗' : '✓'} ${f}: ${entries.length - bad.length}/${entries.length} geçti${errors.length ? `, ${errors.length} JS hatası` : ''}`);
    bad.forEach(([k, v]) => console.log(`    ${k}: ${v}`));
    errors.forEach(e => console.log(`    JS: ${e}`));
  }
  console.log(failed ? `\n${failed} sorun var (${total} kontrol)` : `\nHepsi geçti (${total} kontrol)`);
  process.exit(failed ? 1 : 0);
})();
