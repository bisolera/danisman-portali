/* Dosya deposu ve Word CV.
   Dosyalar tarayıcının IndexedDB'sinde tutulur: kayıt deposu (localStorage) ~5 MB ile sınırlı, birkaç CV'yle dolar.
   Dosyanın künyesi (ad, boyut, tarih) kullanıcı kaydında durur; içerik burada. Yedek dosyasına da girer (Backup). */

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

/* ---------- Word CV ---------- */

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CV_MAX_BYTES = 10 * 1024 * 1024;
const cvKey = userId => `cv:${userId}`;

// CV'yi kendisi ve yönetici görür: CV'lerde telefon, adres gibi kişisel bilgiler olur (KVKK)
const canSeeCv = (viewer, owner) => viewer.role === 'admin' || viewer.id === owner.id;
const canEditCv = (viewer, owner) => viewer.role === 'admin' || viewer.id === owner.id;

// Dosyayı doğrular ve kaydeder; künye kullanıcı kaydına yazılır. Sorun varsa açıklayıcı hata fırlatır.
async function saveCv(userId, file, byUserId) {
  if (/\.doc$/i.test(file.name)) throw new Error('Eski .doc biçimi açılamıyor. Word’de Dosya → Farklı Kaydet → Word Belgesi (.docx) seç.');
  if (!/\.docx$/i.test(file.name)) throw new Error('Yalnızca Word belgesi (.docx) yüklenebilir.');
  if (file.size > CV_MAX_BYTES) throw new Error('Dosya 10 MB’tan büyük; içindeki resimleri küçültüp yeniden kaydet.');
  const data = await readFileBuffer(file);
  const head = new Uint8Array(data, 0, Math.min(2, data.byteLength));
  if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error('Dosya açılamadı: bozuk ya da gerçek bir Word belgesi değil.');   // .docx bir zip'tir ("PK")
  await Files.put(cvKey(userId), { name: file.name, type: DOCX_TYPE, size: data.byteLength, data });
  Store.updateUser(userId, { cv: { name: file.name, size: data.byteLength, uploadedAt: new Date().toISOString(), uploadedBy: byUserId } });
}

// Siler; geri almak için silinen dosyayı ve künyesini döndürür
async function deleteCv(userId) {
  const file = await Files.get(cvKey(userId)), meta = Store.user(userId).cv;
  await Files.remove(cvKey(userId));
  Store.updateUser(userId, { cv: null });
  return { file, meta };
}
async function restoreCv(userId, { file, meta }) {
  if (file) await Files.put(cvKey(userId), file);
  Store.updateUser(userId, { cv: meta });
}

async function downloadCv(owner) {
  const file = await Files.get(cvKey(owner.id));
  if (!file) throw new Error('CV dosyası bu tarayıcıda bulunamadı.');
  downloadBlob(file.name, new Blob([file.data], { type: file.type || DOCX_TYPE }));
}

// Word önizleme kütüphanesi (docx-preview + JSZip) yalnızca gerektiğinde yüklenir
let docxPromise = null;
function loadDocxPreview() {
  if (window.docx?.renderAsync) return Promise.resolve(window.docx);
  const script = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Word önizleme kütüphanesi yüklenemedi (vendor/docx-preview). Sayfayı yenileyip tekrar dene.'));
    document.head.appendChild(s);
  });
  if (!docxPromise) {
    docxPromise = (window.JSZip ? Promise.resolve() : script('vendor/jszip/jszip.min.js'))
      .then(() => script('vendor/docx-preview/docx-preview.min.js'))
      .then(() => window.docx);
    docxPromise.catch(() => { docxPromise = null; });
  }
  return docxPromise;
}

// Önizleme: belge ayrı bir çerçevede gösterilir. Çerçeve "sandbox" olduğu için belgenin içindeki bağlantı ya da
// kod portal verisine erişemez; resimler belgenin içinden (base64) gelir, dışarıya istek gitmez.
async function renderDocxPreview(data, box) {
  const docx = await loadDocxPreview();
  const holder = document.createElement('div'), styles = document.createElement('div');
  const bytes = new Uint8Array(data).slice();   // sayfanın kendi kopyası: depodan gelen tampon başka bağlamdan olabilir
  await docx.renderAsync(bytes, holder, styles, {
    className: 'docx', inWrapper: true, breakPages: true, useBase64URL: true,
    ignoreWidth: window.innerWidth < 900, renderHeaders: true, renderFooters: true,
  });
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', '');
  frame.title = 'CV önizleme';
  frame.className = 'doc-frame';
  frame.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>html,body{margin:0;background:#e9ece9}.docx-wrapper{padding:16px!important;background:#e9ece9!important}</style>${styles.innerHTML}</head><body>${holder.innerHTML}</body></html>`;
  box.replaceChildren(frame);
  return frame;
}

function openCvPreview(owner) {
  const meta = owner.cv;
  if (!meta) return;
  openModal({
    title: `${owner.name} · CV`,
    size: 'doc',
    body: `<div class="doc-preview" data-preview><div class="doc-loading">${icon('clock', 16)} Belge hazırlanıyor…</div></div>`,
    footer: `<span class="muted small-text ellipsis">${esc(meta.name)} · ${fmtSize(meta.size)} · ${fmtStamp(meta.uploadedAt)}</span><span class="grow"></span>
      <button class="btn ghost" data-close>Kapat</button><button class="btn primary" data-download>${icon('download', 15)} İndir</button>`,
    onMount(m) {
      const box = m.querySelector('[data-preview]');
      m.querySelector('[data-download]').addEventListener('click', () => downloadCv(owner).catch(e => toast(e.message, { tone: 'danger' })));
      Files.get(cvKey(owner.id))
        .then(file => {
          if (!file) throw new Error('CV dosyası bu tarayıcıda bulunamadı; başka bir bilgisayardan yüklenmiş olabilir. Sunucuya geçince her yerden görünecek.');
          return renderDocxPreview(file.data, box);
        })
        .catch(e => { box.innerHTML = `<div class="callout warn">${icon('alert', 16)}<div>${esc(e.message || 'Belge gösterilemedi.')} <br>İndirip Word’de açabilirsin.</div></div>`; });
    },
  });
}
