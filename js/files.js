/* Dosya deposu: masraf fişleri.
   Dosyalar tarayıcının IndexedDB'sinde tutulur: kayıt deposu (localStorage) ~5 MB ile sınırlı, birkaç fotoğrafla dolar.
   Dosyanın künyesi (ad, boyut) masraf kaydında durur; içerik burada. Yedek dosyasına da girer (Backup). */

const Files = (() => {
  const DB = 'bisolera-files', STORE = 'files';
  let opening = null;
  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('Bu tarayıcı dosya saklamayı desteklemiyor.'));
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      opening.catch(() => { opening = null; });
    }
    return opening;
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onabort = t.onerror = () => reject(t.error || new Error('Dosya kaydedilemedi; tarayıcı deposu dolu olabilir.'));
    });
  }
  return {
    // value: { name, type, size, data: ArrayBuffer }
    put: (key, value) => run('readwrite', s => s.put(value, key)),
    get: key => run('readonly', s => s.get(key)),
    remove: key => run('readwrite', s => s.delete(key)),
    keys: () => run('readonly', s => s.getAllKeys()),
    clear: () => run('readwrite', s => s.clear()),
  };
})();

// Yedek dosyasında dosya içeriği base64 metin olarak durur
function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function base64ToBuffer(b64) {
  const s = atob(b64), bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}
const readFileBuffer = file => (file.arrayBuffer ? file.arrayBuffer() : new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsArrayBuffer(file);
}));

/* ---------- Masraf fişi / faturası ---------- */

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const receiptKey = expenseId => `receipt:${expenseId}`;

// Fotoğraf en uzun kenarı 1600 px olacak şekilde JPEG'e küçültülür (telefondaki 4–8 MB fotoğraf ~300 KB olur).
// Küçültülemezse (eski tarayıcı) olduğu gibi saklanır.
async function shrinkImage(file) {
  try {
    if (!window.createImageBitmap) return null;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? blob : null;
  } catch { return null; }
}

// Fişi doğrular ve okur: { name, type, size, data } — kaydetmeden önce formda tutulur
async function readReceipt(file) {
  const type = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
  if (!RECEIPT_TYPES.includes(type)) throw new Error('Fiş fotoğraf (JPG, PNG) ya da PDF olmalı.');
  if (file.size > RECEIPT_MAX_BYTES) throw new Error('Dosya 10 MB’tan büyük.');
  let blob = file, outType = type, name = file.name;
  if (type.startsWith('image/')) {
    const small = await shrinkImage(file);
    if (small) { blob = small; outType = 'image/jpeg'; name = `${name.replace(/\.\w+$/, '')}.jpg`; }
  }
  const data = await readFileBuffer(blob);
  if (type === 'application/pdf' && String.fromCharCode(...new Uint8Array(data, 0, Math.min(4, data.byteLength))) !== '%PDF') {
    throw new Error('PDF dosyası açılamadı: bozuk ya da gerçek bir PDF değil.');
  }
  return { name, type: outType, size: data.byteLength, data };
}

// Fişi masrafa bağlar; künye masraf kaydında, içerik dosya deposunda
async function attachReceipt(expenseId, receipt) {
  await Files.put(receiptKey(expenseId), receipt);
  Store.updateExpense(expenseId, { receipt: { name: receipt.name, type: receipt.type, size: receipt.size } });
}
async function detachReceipt(expenseId) {
  await Files.remove(receiptKey(expenseId));
  Store.updateExpense(expenseId, { receipt: null });
}

// Fiş önizleme: fotoğraf doğrudan, PDF tarayıcının kendi PDF görüntüleyicisinde
function openReceiptPreview(expense) {
  let url = null;
  openModal({
    title: `Fiş · ${fmtDate(expense.date)} · ${fmtMoney(expense.amount)}`,
    size: 'doc',
    body: `<div class="doc-preview receipt-preview" data-preview><div class="doc-loading">${icon('clock', 16)} Hazırlanıyor…</div></div>`,
    footer: `<span class="muted small-text ellipsis">${esc(expense.receipt?.name || '')}${expense.receipt ? ` · ${fmtSize(expense.receipt.size)}` : ''}</span><span class="grow"></span>
      <button class="btn ghost" data-close>Kapat</button><button class="btn primary" data-download>${icon('download', 15)} İndir</button>`,
    onClose: () => url && URL.revokeObjectURL(url),
    onMount(m) {
      const box = m.querySelector('[data-preview]');
      Files.get(receiptKey(expense.id)).then(file => {
        if (!file) throw new Error('Fiş bu tarayıcıda bulunamadı; başka bir bilgisayardan eklenmiş olabilir.');
        const blob = new Blob([file.data], { type: file.type });
        url = URL.createObjectURL(blob);
        m.querySelector('[data-download]').onclick = () => downloadBlob(file.name, blob);
        box.innerHTML = file.type === 'application/pdf'
          ? `<object class="doc-frame" data="${url}" type="application/pdf"><p class="doc-loading"><a class="link" href="${url}" target="_blank" rel="noopener">PDF'i yeni sekmede aç</a></p></object>`
          : `<img class="receipt-img" src="${url}" alt="Fiş">`;
      }).catch(e => {
        m.querySelector('[data-download]').disabled = true;
        box.innerHTML = `<div class="callout warn">${icon('alert', 16)}<div>${esc(e.message)}</div></div>`;
      });
    },
  });
}

// Word CV yükleme kalktı (CV artık formdan doldurulur, js/cv.js): eski sürümde yüklenmiş CV dosyaları depodan silinir
async function dropOldCvFiles() {
  const keys = await Files.keys();
  for (const k of keys) if (String(k).startsWith('cv:')) await Files.remove(k);
}
