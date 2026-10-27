/* Veri katmanı. Şimdilik tarayıcının localStorage'ında tutuluyor.
   Sunucuya geçerken ekranlara dokunmadan yalnızca bu dosya API çağrılarıyla değiştirilir. */

const Store = (() => {
  const KEY = 'bisolera-portal-v1';
  let db = null;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.warn('Veri kaydedilemedi', e); }
  }

  // Yeni sürüme geçerken kullanıcının girdiği/içe aktardığı kayıtlar korunur, yalnızca eksik alanlar eklenir.
  // v3 öncesi yalnızca demo verisi içerdiği için yeniden oluşturulur.
  function migrate(d) {
    if (d.version < 4) d.periods = d.periods || [];
    d.version = DATA_VERSION;
    return d;
  }

  function init() {
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
    reset() { db = buildSeed(); persist(); },

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
  };
})();

// Kişiye özel küçük tercihler (son seçilen proje/tür). Kaybolsa da sorun olmaz.
const Prefs = {
  get(userId) {
    try { return JSON.parse(localStorage.getItem('bisolera-prefs-' + userId)) || {}; } catch { return {}; }
  },
  set(userId, changes) {
    try { localStorage.setItem('bisolera-prefs-' + userId, JSON.stringify({ ...Prefs.get(userId), ...changes })); } catch { /* yok say */ }
  },
};
