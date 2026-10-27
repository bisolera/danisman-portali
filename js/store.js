/* Veri katmanı. Şimdilik tarayıcının localStorage'ında tutuluyor.
   Sunucuya geçerken ekranlara dokunmadan yalnızca bu dosya API çağrılarıyla değiştirilir. */

const Store = (() => {
  const KEY = 'bisolera-portal-v1';
  let db = null, lastSaveError = 0;
  let holidayIndex = null;   // tarih → o günün tatilleri; gün hesapları çok sık sorduğu için bir kez kurulur
  const externalListeners = [];
  const holidaysByDate = () => holidayIndex || (holidayIndex = db.holidays.reduce((m, h) => ((m[h.date] = m[h.date] || []).push(h), m), {}));
  // Bir güne ya tek tatil ya da iki yarım tatil düşer (ör. arife öğleden sonra resmi + sabah köprü izni)
  const fits = (date, half, selfId = null) => {
    const others = (holidaysByDate()[date] || []).filter(x => x.id !== selfId);
    return !others.length || (others.length === 1 && others[0].half && half);
  };
  const holidaysChanged = () => { holidayIndex = null; persist(); };

  // Kayıt yazılamazsa (depo dolu vb.) kullanıcıya açıkça söylenir; yoksa "eklendi" görüp kaydın durduğunu sanır
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) {
      console.warn('Veri kaydedilemedi', e);
      if (Date.now() - lastSaveError > 60000 && typeof toast === 'function') {
        toast('Değişiklik KAYDEDİLEMEDİ: tarayıcı depolama alanı dolu. Profilim → Yedek indir, sonra yöneticine haber ver.', { tone: 'danger', duration: 12000 });
      }
      lastSaveError = Date.now();
      return false;
    }
  }

  // Portal başka bir sekmede de açıksa: o sekme veriyi değiştirince bellekteki kopya yenilenir.
  // Aksi halde bu sekme eski kopyasını yazıp diğer sekmede girilen kayıtları silerdi.
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { db = JSON.parse(e.newValue); } catch { return; }
    holidayIndex = null;
    externalListeners.forEach(fn => fn());
  });

  // Yeni sürüme geçerken kullanıcının girdiği/içe aktardığı kayıtlar korunur, yalnızca eksik alanlar eklenir.
  // v3 öncesi yalnızca demo verisi içerdiği için yeniden oluşturulur.
  function migrate(d) {
    if (d.version < 4) d.periods = d.periods || [];
    if (d.version < 5) d.holidays = d.holidays || defaultHolidays();   // tatiller koddan veritabanına taşındı
    if (d.version < 6) d.holidays.forEach(h => {                        // köprüde "çalışacaklar" listesi → kişi başına tam/yarım gün seçimi
      if (h.workers?.length) h.work = Object.fromEntries(h.workers.map(id => [id, 'full']));
      delete h.workers;
    });
    if (d.version < 7) {                                                // yetkinlikler ve sertifikalar
      d.certs = d.certs || [];
      d.projects.forEach(p => { if (!p.skills) p.skills = SEED_PROJECT_SKILLS[p.id] || []; });
    }
    if (d.version < 8) d.expenses = d.expenses || [];                   // masraflar
    if (d.version < 9) d.contracts = d.contracts || [];                 // müşteri sözleşmeleri
    d.version = DATA_VERSION;
    return d;
  }

  function init() {
    holidayIndex = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    if (!db || typeof db.version !== 'number' || db.version < 3) { db = buildSeed(); persist(); }
    else if (db.version < DATA_VERSION) { db = migrate(db); persist(); }
  }

  const byId = (list, id) => list.find(x => x.id === id) || null;
  const patch = (list, id, changes) => { Object.assign(byId(list, id), changes); persist(); };

  // Onaya gönderilmiş ya da onaylanmış ayın kayıtları değiştirilemez. Arayüz kullanıcıya
  // açıklayıcı mesaj gösterir; bu kontrol son güvencedir (canlıda sunucuda yapılır).
  const locked = (userId, date) => db.periods.some(p => p.userId === userId && p.month === String(date).slice(0, 7) && (p.status === 'gonderildi' || p.status === 'onaylandi'));
  const refuse = (what, a) => { console.warn(`Kilitli ay: ${what} reddedildi`, a); return null; };

  return {
    init,
    reset() { db = buildSeed(); holidayIndex = null; persist(); },
    onExternalChange: fn => externalListeners.push(fn),

    // Kullanıcılar
    users: () => db.users,
    user: id => byId(db.users, id),
    userByEmail: email => db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null,
    addUser(u) { const user = { id: uid(), active: true, ...u }; db.users.push(user); persist(); return user; },
    updateUser: (id, changes) => patch(db.users, id, changes),

    // Müşteriler & projeler
    customers: () => db.customers,
    customer: id => byId(db.customers, id),
    addCustomer(c) {
      const customer = { id: uid(), color: CUSTOMER_COLORS[db.customers.length % CUSTOMER_COLORS.length], ...c };
      db.customers.push(customer); persist(); return customer;
    },
    updateCustomer: (id, changes) => patch(db.customers, id, changes),
    projects: ({ customerId, activeOnly } = {}) =>
      db.projects.filter(p => (!customerId || p.customerId === customerId) && (!activeOnly || p.status === 'aktif')),
    project: id => byId(db.projects, id),
    addProject(p) { const project = { id: uid(), ...p }; db.projects.push(project); persist(); return project; },
    updateProject: (id, changes) => patch(db.projects, id, changes),

    // Aktiviteler
    activities: ({ userId, from, to, projectId } = {}) =>
      db.activities.filter(a => (!userId || a.userId === userId) && (!from || a.date >= from) && (!to || a.date <= to) && (!projectId || a.projectId === projectId)),
    activity: id => byId(db.activities, id),
    addActivity(a) {
      if (locked(a.userId, a.date)) return refuse('ekleme', a);
      const act = { id: uid(), createdAt: new Date().toISOString(), ...a };
      db.activities.push(act); persist(); return act;
    },
    updateActivity(id, changes) {
      const act = byId(db.activities, id);
      if (!act || locked(act.userId, act.date) || (changes.date && locked(act.userId, changes.date))) return refuse('güncelleme', act);
      patch(db.activities, id, changes);
      return act;
    },
    deleteActivity(id) {
      const i = db.activities.findIndex(a => a.id === id);
      if (i < 0) return null;
      if (locked(db.activities[i].userId, db.activities[i].date)) return refuse('silme', db.activities[i]);
      const [removed] = db.activities.splice(i, 1);
      persist();
      return removed;
    },
    restoreActivity(a) {
      if (locked(a.userId, a.date)) return refuse('geri alma', a);
      db.activities.push(a); persist(); return a;
    },

    // İzinler
    leaves: ({ userId, status } = {}) =>
      db.leaves.filter(l => (!userId || l.userId === userId) && (!status || l.status === status)),
    leave: id => byId(db.leaves, id),
    addLeave(l) {
      const leave = { id: uid(), status: 'beklemede', halfDay: false, createdAt: new Date().toISOString(), ...l };
      db.leaves.push(leave); persist(); return leave;
    },
    updateLeave: (id, changes) => patch(db.leaves, id, changes),

    // Ay kapanışları (month: 'YYYY-MM'). entry → geçmişe eklenen kayıt: { by, action, note }
    periods: ({ userId, month, status } = {}) =>
      db.periods.filter(p => (!userId || p.userId === userId) && (!month || p.month === month) && (!status || p.status === status)),
    period: (userId, month) => db.periods.find(p => p.userId === userId && p.month === month) || null,
    setPeriod(userId, month, changes, entry) {
      let p = db.periods.find(x => x.userId === userId && x.month === month);
      if (!p) { p = { id: uid(), userId, month, status: 'acik', history: [] }; db.periods.push(p); }
      Object.assign(p, changes);
      if (entry) p.history.push({ at: new Date().toISOString(), ...entry });
      persist();
      return p;
    },

    // Masraflar: { userId, date, category, amount, description, projectId?, rebill, status, receipt?, decidedBy/At, rejectReason, paidAt }
    expenses: ({ userId, status, from, to } = {}) =>
      db.expenses.filter(x => (!userId || x.userId === userId) && (!status || x.status === status) && (!from || x.date >= from) && (!to || x.date <= to)),
    expense: id => byId(db.expenses, id),
    addExpense(x) {
      const expense = { id: uid(), status: 'beklemede', rebill: false, receipt: null, createdAt: new Date().toISOString(), ...x };
      db.expenses.push(expense); persist(); return expense;
    },
    updateExpense: (id, changes) => patch(db.expenses, id, changes),
    deleteExpense(id) {
      const i = db.expenses.findIndex(x => x.id === id);
      if (i < 0) return null;
      const [removed] = db.expenses.splice(i, 1);
      persist();
      return removed;
    },
    restoreExpense(x) { db.expenses.push(x); persist(); return x; },

    // Sözleşmeler: { customerId, name, start, end, hours?, projectIds, noticeDays, renewal, note, renewedTo? }
    contracts: ({ customerId } = {}) => db.contracts.filter(c => !customerId || c.customerId === customerId),
    contract: id => byId(db.contracts, id),
    addContract(c) { const contract = { id: uid(), projectIds: [], noticeDays: 60, renewal: 'manuel', note: '', ...c }; db.contracts.push(contract); persist(); return contract; },
    updateContract: (id, changes) => patch(db.contracts, id, changes),
    deleteContract(id) {
      const i = db.contracts.findIndex(c => c.id === id);
      if (i < 0) return null;
      const [removed] = db.contracts.splice(i, 1);
      persist();
      return removed;
    },
    restoreContract(c) { db.contracts.push(c); persist(); return c; },

    // Sertifikalar: { userId, name, code?, skillId?, issued?, expires? }
    certs: ({ userId } = {}) => db.certs.filter(c => !userId || c.userId === userId),
    addCert(c) { const cert = { id: uid(), ...c }; db.certs.push(cert); persist(); return cert; },
    updateCert: (id, changes) => patch(db.certs, id, changes),
    deleteCert(id) {
      const i = db.certs.findIndex(c => c.id === id);
      if (i < 0) return null;
      const [removed] = db.certs.splice(i, 1);
      persist();
      return removed;
    },

    // Tatiller (resmi, şirket, köprü). Bir tarihte tek tatil ya da iki yarım tatil olur.
    holidays: ({ from, to } = {}) =>
      db.holidays.filter(h => (!from || h.date >= from) && (!to || h.date <= to)).sort((a, b) => a.date.localeCompare(b.date)),
    holidaysOn: date => holidaysByDate()[date] || [],
    holiday: date => (holidaysByDate()[date] || [])[0] || null,
    addHoliday(h) {
      const holiday = { id: uid(), kind: 'resmi', half: false, ...h };
      if (!fits(holiday.date, holiday.half)) return null;
      db.holidays.push(holiday); holidaysChanged(); return holiday;
    },
    updateHoliday(id, changes) {
      const h = byId(db.holidays, id);
      if (!h || !fits(changes.date ?? h.date, changes.half ?? h.half, id)) return null;
      Object.assign(h, changes); holidaysChanged(); return h;
    },
    deleteHoliday(id) {
      const i = db.holidays.findIndex(h => h.id === id);
      if (i < 0) return null;
      const [removed] = db.holidays.splice(i, 1);
      holidaysChanged();
      return removed;
    },
  };
})();

/* Yedekleme: bu tarayıcıdaki tüm portal verisi (kayıtlar, tercihler, takvim, CV dosyaları) tek JSON dosyasında.
   Sunucuya geçene kadar tarayıcı verisinin silinmesine karşı tek güvence budur. */
const Backup = {
  PREFIX: 'bisolera-',
  META: 'bisolera-meta',
  APP: 'bisolera-portal',

  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(Backup.PREFIX) && k !== Backup.META) out.push(k);
    }
    return out;
  },

  snapshot() {
    return { app: Backup.APP, version: DATA_VERSION, exportedAt: new Date().toISOString(),
      data: Object.fromEntries(Backup.keys().map(k => [k, localStorage.getItem(k)])) };
  },

  // Kayıtlar + dosya deposundaki dosyalar (CV); dosya içeriği base64
  async snapshotFull() {
    const snap = Backup.snapshot(), files = {};
    try {
      for (const key of await Files.keys()) {
        const f = await Files.get(key);
        if (f) files[key] = { name: f.name, type: f.type, size: f.size, data: bufferToBase64(f.data) };
      }
    } catch (e) { console.warn('Dosyalar yedeğe eklenemedi', e); }
    return { ...snap, files };
  },

  // Dosyayı doğrular ve geri yüklemeden önce gösterilecek özeti çıkarır; sorun varsa hata fırlatır
  inspect(text) {
    let b;
    try { b = JSON.parse(text); } catch { throw new Error('Dosya okunamadı: geçerli bir yedek dosyası değil.'); }
    if (b?.app !== Backup.APP || !b.data || typeof b.data !== 'object') throw new Error('Bu dosya bir portal yedeği değil.');
    if (Object.entries(b.data).some(([k, v]) => !k.startsWith(Backup.PREFIX) || typeof v !== 'string')) throw new Error('Yedekte tanınmayan bilgi var; dosya değiştirilmiş olabilir.');
    let db = null;
    try { db = JSON.parse(b.data['bisolera-portal-v1']); } catch { /* aşağıda yakalanır */ }
    if (!db || !Array.isArray(db.users) || !Array.isArray(db.activities)) throw new Error('Yedekte portal verisi eksik ya da bozuk.');
    if (Number(b.version) > DATA_VERSION) throw new Error('Bu yedek portalın daha yeni bir sürümünden; önce portalı güncelle.');
    if (b.files != null && (typeof b.files !== 'object' || Object.values(b.files).some(f => typeof f?.name !== 'string' || typeof f.data !== 'string'))) {
      throw new Error('Yedekteki dosyalar bozuk; dosya değiştirilmiş olabilir.');
    }
    return { backup: b, summary: { exportedAt: b.exportedAt, users: db.users.length, activities: db.activities.length, leaves: (db.leaves || []).length, files: Object.keys(b.files || {}).length } };
  },

  // Mevcut portal verisini tamamen yedektekiyle değiştirir (sayfa yeniden yüklenmeli)
  restore(backup) {
    Backup.keys().forEach(k => localStorage.removeItem(k));
    Object.entries(backup.data).forEach(([k, v]) => localStorage.setItem(k, v));
  },

  // Yedekte dosya bölümü varsa dosya deposu da onunla değiştirilir (dosyasız eski yedekte mevcut dosyalar kalır)
  async restoreFiles(backup) {
    if (!backup.files) return;
    await Files.clear();
    for (const [key, f] of Object.entries(backup.files)) await Files.put(key, { name: f.name, type: f.type, size: f.size, data: base64ToBuffer(f.data) });
  },

  // Portalın tarayıcıda kapladığı yer (bayt, yaklaşık). Tarayıcılar site başına ~5 MB izin verir.
  usage() {
    return sum(Backup.keys().concat(Backup.META), k => ((localStorage.getItem(k) || '').length + k.length) * 2);
  },

  markDone() { try { localStorage.setItem(Backup.META, JSON.stringify({ lastBackupAt: new Date().toISOString() })); } catch { /* yok say */ } },
  lastAt() { try { return JSON.parse(localStorage.getItem(Backup.META))?.lastBackupAt || null; } catch { return null; } },
};

// Kişiye özel küçük tercihler (son seçilen proje/tür). Kaybolsa da sorun olmaz.
const Prefs = {
  get(userId) {
    try { return JSON.parse(localStorage.getItem('bisolera-prefs-' + userId)) || {}; } catch { return {}; }
  },
  set(userId, changes) {
    try { localStorage.setItem('bisolera-prefs-' + userId, JSON.stringify({ ...Prefs.get(userId), ...changes })); } catch { /* yok say */ }
  },
};
