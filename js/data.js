/* Sabit tanımlar ve demo veriler.
   Canlıya geçerken buildSeed() kalkar; kullanıcı, müşteri ve proje verileri veritabanından gelir. */

const COMPANY_DOMAIN = 'bisolera.com';
const DATA_VERSION = 10;   // veri yapısı değişince artır; store.js → migrate() eski kaydı yeni yapıya taşır
const NOTE_MAX = 2000;    // aylık formlardaki açıklamalar birkaç yüz karakteri rahatça geçiyor

const BRAND = {
  logoOnDark: 'https://cdn.prod.website-files.com/61efd059117be97cc736bc2d/6231108fc186d4df713d8cc0_logo%20beyaz%20yazi%20(1).png',
};

const ACTIVITY_TYPES = [
  { id: 'gelistirme', name: 'Geliştirme' },
  { id: 'analiz', name: 'Analiz & Tasarım' },
  { id: 'toplanti', name: 'Toplantı' },
  { id: 'destek', name: 'Destek' },
  { id: 'test', name: 'Test' },
  { id: 'dokumantasyon', name: 'Dokümantasyon' },
  { id: 'egitim', name: 'Eğitim' },
  { id: 'proje_yonetimi', name: 'Proje Yönetimi' },
];
const activityTypeName = id => (ACTIVITY_TYPES.find(t => t.id === id) || { name: id }).name;

// deducts: yıllık izin bakiyesinden düşer mi?
const LEAVE_TYPES = [
  { id: 'yillik', name: 'Yıllık izin', deducts: true },
  { id: 'mazeret', name: 'Mazeret izni', deducts: false },
  { id: 'hastalik', name: 'Hastalık / Rapor', deducts: false },
  { id: 'ucretsiz', name: 'Ücretsiz izin', deducts: false },
];
const leaveTypeName = id => (LEAVE_TYPES.find(t => t.id === id) || { name: id }).name;

// Portalda izin takibinin başladığı yıl. Bu yıla kadar kullanılmamış izin, kullanıcıya "devreden izin" olarak elle girilir;
// sonraki yıllarda devir portaldaki kayıtlardan hesaplanır.
const LEAVE_START_YEAR = 2026;

const LEAVE_STATUS = {
  beklemede: { label: 'Onay bekliyor', tone: 'warn' },
  onaylandi: { label: 'Onaylandı', tone: 'ok' },
  reddedildi: { label: 'Reddedildi', tone: 'danger' },
  iptal: { label: 'İptal edildi', tone: 'muted' },
};

// Ay kapanışı: açık → onaya gönderildi (kilitli) → onaylandı (kilitli) · iade edilirse yeniden açılır
const PERIOD_STATUS = {
  acik: { label: 'Açık', tone: 'muted' },
  gonderildi: { label: 'Onay bekliyor', tone: 'warn' },
  onaylandi: { label: 'Onaylandı', tone: 'ok' },
  iade: { label: 'İade edildi', tone: 'danger' },
};
const PERIOD_ACTIONS = {
  gonderildi: 'onaya gönderdi', geri_cekildi: 'gönderimi geri çekti', iade: 'iade etti',
  onaylandi: 'onayladı', onay_geri_alindi: 'onayı geri aldı', kilit_acildi: 'kilidi açtı',
};

// Masraflar: TL, KDV dahil. Akış: beklemede → onaylandi (ödenecek) → odendi · reddedildi (gerekçeli; düzeltip yeniden gönderilir)
const EXPENSE_CATEGORIES = [
  { id: 'ulasim', name: 'Ulaşım', hint: 'uçak, tren, otobüs' },
  { id: 'taksi', name: 'Taksi' },
  { id: 'konaklama', name: 'Konaklama' },
  { id: 'yemek', name: 'Yemek' },
  { id: 'otopark', name: 'Otopark / otoyol' },
  { id: 'diger', name: 'Diğer' },
];
const expenseCategoryName = id => (EXPENSE_CATEGORIES.find(c => c.id === id) || { name: id }).name;
const EXPENSE_STATUS = {
  beklemede: { label: 'Onay bekliyor', tone: 'warn' },
  onaylandi: { label: 'Ödenecek', tone: 'info' },
  odendi: { label: 'Ödendi', tone: 'ok' },
  reddedildi: { label: 'Reddedildi', tone: 'danger' },
};
const EXPENSE_MAX = 100000;

// Müşteri sözleşmeleri: tarih ve saat havuzu (bedel tutulmaz)
const CONTRACT_STATUS = {
  baslamadi: { label: 'Başlamadı', tone: 'muted' },
  aktif: { label: 'Aktif', tone: 'ok' },
  yakinda: { label: 'Bitişe yakın', tone: 'warn' },
  bitti: { label: 'Bitti', tone: 'muted' },
  yenilendi: { label: 'Yenilendi', tone: 'info' },
};
const CONTRACT_RENEWAL = { manuel: 'Manuel', otomatik: 'Otomatik yenilenir' };

// Yetkinlik kataloğu: danışman seviyesini girer, projeler bu kimliklerle etiketlenir (deneyim saati buradan hesaplanır)
const SKILLS = [
  { id: 'bw', name: 'SAP BW 7.x', short: 'BW', group: 'SAP BW' },
  { id: 'bw4', name: 'SAP BW/4HANA', short: 'BW/4', group: 'SAP BW' },
  { id: 'abap', name: 'ABAP / AMDP', short: 'ABAP', group: 'SAP BW' },
  { id: 'hana', name: 'HANA modelleme · CDS', short: 'HANA', group: 'SAP BW' },
  { id: 'dsp', name: 'SAP Datasphere', short: 'DSP', group: 'SAP bulut' },
  { id: 'sac', name: 'SAC raporlama', short: 'SAC', group: 'SAP bulut' },
  { id: 'sacp', name: 'SAC planlama', short: 'SAC-P', group: 'SAP bulut' },
  { id: 'bpc', name: 'SAP BPC', short: 'BPC', group: 'Planlama' },
  { id: 'papm', name: 'SAP PaPM', short: 'PaPM', group: 'Planlama' },
  { id: 'ea', name: 'Embedded Analytics', short: 'EA', group: 'SAP bulut' },
  { id: 'fabric', name: 'Microsoft Fabric', short: 'Fabric', group: 'Microsoft' },
  { id: 'pbi', name: 'Power BI', short: 'PBI', group: 'Microsoft' },
  { id: 'pm', name: 'Proje yönetimi', short: 'PM', group: 'Genel' },
];
const skillName = id => (SKILLS.find(s => s.id === id) || { name: id }).name;
const SKILL_LEVELS = ['—', 'Temel', 'Orta', 'Uzman'];   // 0 yok · 1 temel · 2 bağımsız çalışır · 3 proje yönetir, öğretir
const CERT_STATUS = {
  suresiz: { label: 'Süresiz', tone: 'muted' },
  gecerli: { label: 'Geçerli', tone: 'ok' },
  yakinda: { label: 'Yakında doluyor', tone: 'warn' },
  doldu: { label: 'Süresi doldu', tone: 'danger' },
};

// Demo projelerinin yetkinlik etiketleri (sürüm 7'ye geçerken mevcut veride de bu projelere eklenir)
const SEED_PROJECT_SKILLS = {
  p1: ['bw4', 'hana'], p2: ['bw'], p3: ['sacp'], p4: ['pbi'], p5: ['dsp'], p6: ['bw', 'hana'], p7: ['papm'], p8: ['bpc'],
  p9: ['ea', 'hana'], p10: ['bw4', 'dsp'], p14: ['bw', 'bpc'], p15: ['bw'], p16: ['bw', 'fabric'], p17: ['bw', 'abap'],
};

const PROJECT_STATUS = {
  aktif: { label: 'Aktif', tone: 'ok' },
  beklemede: { label: 'Beklemede', tone: 'warn' },
  tamamlandi: { label: 'Tamamlandı', tone: 'muted' },
};

// Tatil türleri:
//  resmi  → herkes için hedef saat düşer, izinden düşülmez
//  sirket → şirketin verdiği tatil: resmi tatil gibi, kimsenin izninden düşmez
//  kopru  → köprü izni: şirket kapalı. Kişi başına seçim (work): hiç çalışmayandan tamamı, yarım gün
//           çalışandan yarım gün düşer, tam gün çalışandan düşmez
const HOLIDAY_KINDS = {
  resmi: { label: 'Resmi tatil', tone: 'info' },
  sirket: { label: 'Şirket tatili', tone: 'ok' },
  kopru: { label: 'Köprü izni', tone: 'warn' },
};

// Her yıl aynı tarihe gelen resmi tatiller: Yönetim → Tatiller'de tek tıkla eklenir
const FIXED_HOLIDAYS = [
  ['01-01', 'Yılbaşı'],
  ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'],
  ['05-01', 'Emek ve Dayanışma Günü'],
  ['05-19', 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı'],
  ['07-15', 'Demokrasi ve Millî Birlik Günü'],
  ['08-30', 'Zafer Bayramı'],
  ['10-28', 'Cumhuriyet Bayramı Arifesi', true],
  ['10-29', 'Cumhuriyet Bayramı'],
];

// İlk kurulumda veritabanına yazılan resmi tatiller; sonrası Yönetim → Tatiller'den yönetilir.
// half: true → yarım gün (arife). Dini bayramlar Diyanet takvimine göredir (2027 doğrulandı).
const HOLIDAYS = [
  { date: '2026-01-01', name: 'Yılbaşı' },
  { date: '2026-03-19', name: 'Ramazan Bayramı Arifesi', half: true },
  { date: '2026-03-20', name: 'Ramazan Bayramı' },
  { date: '2026-03-21', name: 'Ramazan Bayramı' },
  { date: '2026-03-22', name: 'Ramazan Bayramı' },
  { date: '2026-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2026-05-01', name: 'Emek ve Dayanışma Günü' },
  { date: '2026-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2026-05-26', name: 'Kurban Bayramı Arifesi', half: true },
  { date: '2026-05-27', name: 'Kurban Bayramı' },
  { date: '2026-05-28', name: 'Kurban Bayramı' },
  { date: '2026-05-29', name: 'Kurban Bayramı' },
  { date: '2026-05-30', name: 'Kurban Bayramı' },
  { date: '2026-07-15', name: 'Demokrasi ve Millî Birlik Günü' },
  { date: '2026-08-30', name: 'Zafer Bayramı' },
  { date: '2026-10-28', name: 'Cumhuriyet Bayramı Arifesi', half: true },
  { date: '2026-10-29', name: 'Cumhuriyet Bayramı' },
  { date: '2027-01-01', name: 'Yılbaşı' },
  { date: '2027-03-08', name: 'Ramazan Bayramı Arifesi', half: true },
  { date: '2027-03-09', name: 'Ramazan Bayramı' },
  { date: '2027-03-10', name: 'Ramazan Bayramı' },
  { date: '2027-03-11', name: 'Ramazan Bayramı' },
  { date: '2027-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2027-05-01', name: 'Emek ve Dayanışma Günü' },
  { date: '2027-05-15', name: 'Kurban Bayramı Arifesi', half: true },
  { date: '2027-05-16', name: 'Kurban Bayramı' },
  { date: '2027-05-17', name: 'Kurban Bayramı' },
  { date: '2027-05-18', name: 'Kurban Bayramı' },
  { date: '2027-05-19', name: 'Kurban Bayramı · 19 Mayıs' },
  { date: '2027-07-15', name: 'Demokrasi ve Millî Birlik Günü' },
  { date: '2027-08-30', name: 'Zafer Bayramı' },
  { date: '2027-10-28', name: 'Cumhuriyet Bayramı Arifesi', half: true },
  { date: '2027-10-29', name: 'Cumhuriyet Bayramı' },
];
const HOLIDAYS_BY_DATE = Object.fromEntries(HOLIDAYS.map(h => [h.date, h]));   // yalnızca demo verisi üretirken
const defaultHolidays = () => HOLIDAYS.map(h => ({ id: uid(), kind: 'resmi', ...h, half: !!h.half }));

const CUSTOMER_COLORS = ['#3b82f6', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/* ---------- Demo veriler (kurgusal müşteriler ve kişiler) ---------- */

// Demo aktivitelerinde kullanılan iş tanımları: [tür, açıklama]
const SEED_TASKS = {
  p1: [['gelistirme', 'ADSO ve CompositeProvider modelleme'], ['gelistirme', 'AMDP transformasyon rutini düzeltmesi'], ['analiz', 'BW 7.5 veri akışlarının envanter analizi'], ['test', 'Migrasyon sonrası veri karşılaştırma testleri'], ['toplanti', 'Müşteriyle haftalık durum toplantısı'], ['proje_yonetimi', 'Proje planı ve risk listesinin güncellenmesi']],
  p2: [['destek', 'Gece process chain hatalarının analizi ve çözümü (DST-1042)'], ['destek', 'Delta yükleme hatasının düzeltilmesi (DST-1057)'], ['destek', 'Kullanıcı yetki talebinin incelenmesi (DST-1061)'], ['toplanti', 'Destek taleplerinin gözden geçirilmesi']],
  p3: [['gelistirme', 'Planlama modeli ve veri aksiyonları geliştirme'], ['gelistirme', 'Story ve dashboard tasarımı'], ['analiz', 'Satış planlama sürecinin analizi'], ['toplanti', 'Kullanıcılarla demo toplantısı']],
  p5: [['gelistirme', 'Graphical view ve analytic model geliştirme'], ['gelistirme', 'Replication flow kurulumu'], ['analiz', 'Space ve yetki yapısının tasarımı'], ['dokumantasyon', 'Teknik tasarım dokümanı']],
  p7: [['gelistirme', 'Maliyet dağıtım fonksiyonlarının geliştirilmesi'], ['analiz', 'Karlılık analizi gereksinimlerinin çıkarılması'], ['test', 'Dağıtım sonuçlarının mutabakatı']],
  p8: [['gelistirme', 'Konsolidasyon kurallarının düzenlenmesi'], ['gelistirme', 'Bütçe input formu geliştirme'], ['destek', 'Bütçe dönemi kullanıcı desteği']],
  p9: [['gelistirme', 'CDS view ve analitik sorgu geliştirme'], ['analiz', 'Rapor ihtiyaçlarının analizi'], ['test', 'Kullanıcı kabul testleri']],
  p11: [['egitim', 'SAP Datasphere sertifika çalışması'], ['egitim', 'İç eğitim: SAC planlama']],
  p12: [['analiz', 'Teklif için kapsam ve efor çalışması'], ['toplanti', 'Potansiyel müşteri sunumu']],
  p13: [['proje_yonetimi', 'Haftalık ekip toplantısı'], ['dokumantasyon', 'Aylık proje raporlarının hazırlanması']],
  p14: [['destek', 'Rapor farkı incelemesi ve kullanıcı desteği (KZT-2201)'], ['gelistirme', 'BPC veri akışı düzenlemesi (KZT-2214)'], ['destek', 'Process chain hata takibi'], ['toplanti', 'Kullanıcılarla durum görüşmesi']],
  p15: [['destek', 'Stok raporu veri kontrolü (MVT-318)'], ['gelistirme', 'Rapora alan ekleme geliştirmesi (MVT-331)'], ['analiz', 'Kaynak tablo karşılaştırması']],
  p16: [['gelistirme', 'Composite yapılarının Fabric’e aktarımı'], ['test', 'Pipeline veri kontrolleri'], ['analiz', 'Kaynak nesne analizi']],
  p17: [['gelistirme', 'Tartım verisi için BW veri akışı geliştirme'], ['gelistirme', 'Datasource append geliştirmesi'], ['test', 'Geliştirme ortamında veri doğrulama']],
};
// Her danışmanın demo verisinde ağırlıklı çalıştığı projeler (ilk sıradaki ana proje)
const SEED_ROUTINE = { u1: ['p1', 'p12', 'p13'], u2: ['p14', 'p15', 'p16', 'p17'], u3: ['p3', 'p9', 'p12'], u4: ['p5', 'p1', 'p11'], u5: ['p7', 'p8', 'p13'] };

function buildSeed() {
  const users = [
    { id: 'u1', name: 'Ayşe Yılmaz', email: 'ayse.yilmaz@bisolera.com', title: 'Kıdemli Proje Yöneticisi', role: 'admin', annualLeave: 20, startDate: '2022-03-01', active: true },
    { id: 'u2', name: 'Emre Aydın', email: 'emre.aydin@bisolera.com', title: 'SAP BW Danışmanı', role: 'consultant', annualLeave: 14, startDate: '2023-02-13', active: true, carryIn: 3 },
    { id: 'u3', name: 'Zeynep Kaya', email: 'zeynep.kaya@bisolera.com', title: 'SAP Analytics Cloud Danışmanı', role: 'consultant', annualLeave: 14, startDate: '2023-09-04', active: true },
    { id: 'u4', name: 'Can Öztürk', email: 'can.ozturk@bisolera.com', title: 'Datasphere Danışmanı', role: 'consultant', annualLeave: 14, startDate: '2024-06-03', active: true },
    { id: 'u5', name: 'Elif Şahin', email: 'elif.sahin@bisolera.com', title: 'SAP BPC / PaPM Danışmanı', role: 'consultant', annualLeave: 20, startDate: '2022-05-16', active: true, carryIn: 6 },
  ];

  const customers = [
    { id: 'c1', name: 'Atlas Holding', sector: 'Holding', color: '#3b82f6' },
    { id: 'c2', name: 'Lale Perakende', sector: 'Perakende', color: '#f59e0b' },
    { id: 'c3', name: 'Ege Enerji', sector: 'Enerji', color: '#06b6d4' },
    { id: 'c4', name: 'Toros Gıda', sector: 'Gıda', color: '#ef4444' },
    { id: 'c5', name: 'Poyraz Lojistik', sector: 'Lojistik', color: '#8b5cf6' },
    { id: 'c6', name: 'Kuzey Elektronik', sector: 'Dayanıklı tüketim', color: '#e11d48' },
    { id: 'c7', name: 'Mavi Seramik', sector: 'Yapı malzemeleri', color: '#0ea5e9' },
    { id: 'c8', name: 'Ada İçecek', sector: 'İçecek', color: '#16a34a' },
    { id: 'c9', name: 'Demir Maden', sector: 'Maden / metal', color: '#a16207' },
    { id: 'c0', name: 'Bisolera (İç)', sector: 'Şirket içi', color: '#66cc66', internal: true },
  ];

  const projects = [
    { id: 'p1', customerId: 'c1', name: 'BW/4HANA Migrasyonu', code: 'ATL-BW4', status: 'aktif', billable: true },
    { id: 'p2', customerId: 'c1', name: 'Process Chain İzleme & Destek', code: 'ATL-SUP', status: 'aktif', billable: true, monthlyBudget: 40 },
    { id: 'p3', customerId: 'c2', name: 'SAC Satış Planlama', code: 'LAL-SAC', status: 'aktif', billable: true, monthlyBudget: 160 },
    { id: 'p4', customerId: 'c2', name: 'Power BI Mağaza Raporları', code: 'LAL-PBI', status: 'tamamlandi', billable: true },
    { id: 'p5', customerId: 'c3', name: 'Datasphere Kurulumu', code: 'EGE-DSP', status: 'aktif', billable: true },
    { id: 'p6', customerId: 'c3', name: 'Health Check & Optimizasyon', code: 'EGE-HC', status: 'beklemede', billable: true },
    { id: 'p7', customerId: 'c4', name: 'PaPM Karlılık Analizi', code: 'TRS-PAPM', status: 'aktif', billable: true },
    { id: 'p8', customerId: 'c4', name: 'BPC Bütçe Konsolidasyonu', code: 'TRS-BPC', status: 'aktif', billable: true },
    { id: 'p9', customerId: 'c5', name: 'Embedded Analytics Raporlama', code: 'PYZ-EA', status: 'aktif', billable: true },
    { id: 'p10', customerId: 'c5', name: 'Assessment & Roadmap', code: 'PYZ-ASR', status: 'tamamlandi', billable: true },
    { id: 'p11', customerId: 'c0', name: 'Eğitim & Sertifikasyon', code: 'BIS-EGT', status: 'aktif', billable: false },
    { id: 'p12', customerId: 'c0', name: 'Satış Öncesi / Teklif', code: 'BIS-PRE', status: 'aktif', billable: false },
    { id: 'p13', customerId: 'c0', name: 'İdari İşler', code: 'BIS-ADM', status: 'aktif', billable: false },
    { id: 'p14', customerId: 'c6', name: 'SAP BW & BPC Destek', code: 'KZY-BW', status: 'aktif', billable: true, monthlyBudget: 60 },
    { id: 'p15', customerId: 'c7', name: 'SAP BW Raporlama Destek', code: 'MAV-BW', status: 'aktif', billable: true, monthlyBudget: 40 },
    { id: 'p16', customerId: 'c8', name: 'BW → Fabric Geçişi', code: 'ADA-FAB', status: 'aktif', billable: true },
    { id: 'p17', customerId: 'c9', name: 'SAP BW Geliştirme', code: 'DMR-BW', status: 'aktif', billable: true },
  ];

  // İzinler bugünün haftasına göre yerleştirilir ki demo her zaman güncel görünsün
  const monday = weekStart(todayISO());
  const d = n => addDays(monday, n);
  const leaves = [
    { id: 'l1', userId: 'u2', type: 'yillik', start: d(-77), end: d(-73), note: 'Yaz tatili', status: 'onaylandi' },
    { id: 'l2', userId: 'u2', type: 'yillik', start: d(-17), end: d(-17), note: '', status: 'onaylandi' },
    { id: 'l3', userId: 'u2', type: 'yillik', start: d(21), end: d(28), note: 'Aile ziyareti', status: 'beklemede' },
    { id: 'l4', userId: 'u3', type: 'yillik', start: d(4), end: d(4), note: 'Köprü izni', status: 'onaylandi' },
    { id: 'l5', userId: 'u3', type: 'yillik', start: d(56), end: d(58), note: '', status: 'beklemede' },
    { id: 'l6', userId: 'u4', type: 'hastalik', start: d(-13), end: d(-12), note: 'Doktor raporu', status: 'onaylandi' },
    { id: 'l7', userId: 'u5', type: 'yillik', start: d(7), end: d(11), note: '', status: 'onaylandi' },
    { id: 'l8', userId: 'u1', type: 'mazeret', start: d(-6), end: d(-6), halfDay: true, note: 'Resmi işlem', status: 'onaylandi' },
  ].map(l => ({ halfDay: false, createdAt: `${addDays(l.start, -10)}T10:00`, ...l }));

  // Geçen ayın kapanışları: bir danışman onaylanmış, ikisi onay bekliyor (u2 ve Ayşe henüz göndermedi)
  const prev = addMonths(todayISO(), -1).slice(0, 7);
  const stamp = (n, time) => `${[addDays(monthStart(todayISO()), n), todayISO()].sort()[0]}T${time}`;
  const periods = [
    { id: 'm1', userId: 'u4', month: prev, status: 'onaylandi', note: '', submittedAt: stamp(0, '17:20'), decidedBy: 'u1', decidedAt: stamp(1, '09:05'),
      history: [{ at: stamp(0, '17:20'), by: 'u4', action: 'gonderildi' }, { at: stamp(1, '09:05'), by: 'u1', action: 'onaylandi' }] },
    { id: 'm2', userId: 'u3', month: prev, status: 'gonderildi', note: 'Ay boyunca ağırlıklı Lale Perakende planlama projesindeydim.', submittedAt: stamp(1, '18:10'),
      history: [{ at: stamp(1, '18:10'), by: 'u3', action: 'gonderildi' }] },
    { id: 'm3', userId: 'u5', month: prev, status: 'gonderildi', note: '', submittedAt: stamp(2, '10:30'),
      history: [{ at: stamp(2, '10:30'), by: 'u5', action: 'gonderildi' }] },
  ];

  projects.forEach(p => { p.skills = SEED_PROJECT_SKILLS[p.id] || []; });

  // Yetkinlikler ve sertifikalar (demo): bitiş tarihleri bugüne göre, uyarılar görünsün
  const skills = {
    u1: { bw4: 3, bw: 3, dsp: 2, pm: 3, hana: 2 },
    u2: { bw: 3, bw4: 2, bpc: 2, abap: 2, fabric: 1, hana: 2 },
    u3: { sac: 3, sacp: 3, dsp: 1, ea: 2 },
    u4: { dsp: 3, bw4: 2, hana: 2, sac: 1 },
    u5: { bpc: 3, papm: 3, sacp: 2, bw: 1 },
  };
  const summaries = {
    u2: 'SAP BW ve BPC destek ve geliştirme projelerinde deneyimli; BW verilerinin Microsoft Fabric’e taşınmasında çalışıyor.',
    u4: 'SAP Datasphere kurulumu, veri modelleme ve replikasyon akışlarında uzman.',
  };
  users.forEach(u => { u.skills = skills[u.id] || {}; u.summary = summaries[u.id] || ''; });
  const today = todayISO();
  const certs = [
    { id: 'k1', userId: 'u1', name: 'SAP BW/4HANA Associate', skillId: 'bw4', issued: '2023-05-10', expires: addDays(today, 300) },
    { id: 'k2', userId: 'u2', name: 'SAP BW/4HANA Associate', skillId: 'bw4', issued: '2024-03-18', expires: addDays(today, 410) },
    { id: 'k3', userId: 'u3', name: 'SAP Analytics Cloud Associate', skillId: 'sac', issued: '2023-11-02', expires: addDays(today, 40) },
    { id: 'k4', userId: 'u4', name: 'SAP Datasphere Associate', skillId: 'dsp', issued: '2024-01-15', expires: addDays(today, -12) },
    { id: 'k5', userId: 'u5', name: 'SAP BPC Associate', skillId: 'bpc', issued: '2021-09-20', expires: null },
  ];

  // Masraflar (demo): bu ay ve geçen ay, farklı durumlarda
  const day = n => [addDays(monthStart(today), n), addDays(today, -1)].sort()[0];
  const pm = monthStart(addMonths(today, -1));
  const expenses = [
    { id: 'x1', userId: 'u2', date: day(2), category: 'ulasim', amount: 2480, description: 'İstanbul – Kayseri uçak bileti, müşteri ziyareti', projectId: 'p17', rebill: true, status: 'beklemede' },
    { id: 'x2', userId: 'u2', date: day(3), category: 'konaklama', amount: 3150, description: 'Kayseri otel, 1 gece', projectId: 'p17', rebill: true, status: 'beklemede' },
    { id: 'x3', userId: 'u2', date: day(1), category: 'taksi', amount: 420, description: 'Havalimanı – müşteri ofisi', projectId: 'p17', rebill: false, status: 'onaylandi', decidedBy: 'u1', decidedAt: `${day(4)}T10:00` },
    { id: 'x4', userId: 'u3', date: addDays(pm, 8), category: 'yemek', amount: 860, description: 'Müşteriyle iş yemeği (3 kişi)', projectId: 'p3', rebill: false, status: 'odendi', decidedBy: 'u1', decidedAt: `${addDays(pm, 10)}T09:30`, paidAt: `${addDays(pm, 20)}T12:00` },
    { id: 'x5', userId: 'u5', date: addDays(pm, 14), category: 'otopark', amount: 150, description: 'Müşteri otoparkı', projectId: 'p8', rebill: false, status: 'reddedildi', decidedBy: 'u1', decidedAt: `${addDays(pm, 16)}T11:00`, rejectReason: 'Fiş eksik; fişi ekleyip yeniden gönder.' },
  ].map(x => ({ createdAt: `${x.date}T18:00`, receipt: null, ...x }));

  // Sözleşmeler (demo): biri yıllık havuzlu, biri bitişe yakın, biri bitmiş ve yenilenmiş
  const year = today.slice(0, 4);
  const contracts = [
    { id: 'k-kzy', customerId: 'c6', name: `${year} BW & BPC Destek Sözleşmesi`, start: `${year}-01-01`, end: `${year}-12-31`, hours: 500, projectIds: ['p14'], noticeDays: 60, renewal: 'otomatik', note: '' },
    { id: 'k-mav', customerId: 'c7', name: 'Raporlama Destek Paketi', start: addMonths(monthStart(today), -5), end: addDays(today, 40), hours: 120, projectIds: ['p15'], noticeDays: 60, renewal: 'manuel', note: 'Yenileme için teklif hazırlanacak' },
    { id: 'k-atl1', customerId: 'c1', name: 'BW/4HANA Migrasyon – 1. faz', start: addMonths(monthStart(today), -14), end: addDays(monthStart(today), -1), hours: null, projectIds: ['p1'], noticeDays: 60, renewal: 'manuel', note: '', renewedTo: 'k-atl2' },
    { id: 'k-atl2', customerId: 'c1', name: 'BW/4HANA Migrasyon – 2. faz', start: monthStart(today), end: addDays(addMonths(monthStart(today), 6), -1), hours: 900, projectIds: ['p1'], noticeDays: 60, renewal: 'manuel', note: '' },
  ];

  // Prim ve araba parası (demo): tutarlar UYDURMADIR. Şirketin gerçek tutarları repoya yazılmaz, Yönetim'den girilir.
  Object.assign(users.find(u => u.id === 'u1'), { bonusEligible: true });
  Object.assign(users.find(u => u.id === 'u5'), { bonusEligible: true, carAllowance: true });
  Object.assign(users.find(u => u.id === 'u2'), { carAllowance: true });
  const payRates = [{ id: 'r1', from: `${today.slice(0, 4)}-01-01`, bonusThreshold: 18, bonusDaily: 1000, carMonthly: 10000 }];

  return { version: DATA_VERSION, users, customers, projects, leaves, periods, certs, expenses, contracts, payRates, holidays: defaultHolidays(), activities: generateActivities(users, leaves, monday) };
}

// Son 5 haftanın aktivitelerini üretir: hafta sonu, tatil ve izin günleri atlanır
function generateActivities(users, leaves, monday) {
  const rand = mulberry32(42);   // sabit tohum: demo her sıfırlamada aynı görünsün
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const SPLITS = {
    8: [[8], [6, 2], [5, 3], [4, 4], [4, 3, 1], [3.5, 3, 1.5]],
    6: [[6], [4, 2]],
    4: [[4], [3, 1], [2.5, 1.5]],
    2: [[2]],
  };
  // Demo hesabında birkaç eksik gün olsun ki "eksik giriş" uyarısı görülsün
  const gaps = { u2: { [addDays(monday, -4)]: 6, [addDays(monday, -12)]: 0 } };
  const yesterday = addDays(todayISO(), -1);
  const out = [];

  users.forEach(u => {
    const routine = SEED_ROUTINE[u.id] || [];
    if (!routine.length) return;
    // Diğerlerinde geçen ay tam dolu (ay kapanışı incelenebilsin); u2'nin geçen ayı boş
    // bırakılır ki aylık Excel formu içe aktarılıp ay kapatılarak denenebilsin
    const start = u.id === 'u2' ? monthStart(todayISO()) : monthStart(addMonths(todayISO(), -1));
    for (let day = start; day <= yesterday; day = addDays(day, 1)) {
      if (isWeekend(day)) continue;
      const holiday = HOLIDAYS_BY_DATE[day];
      if (holiday && !holiday.half) continue;
      const leave = leaves.find(l => l.userId === u.id && l.status === 'onaylandi' && day >= l.start && day <= l.end);
      if (leave && !leave.halfDay) continue;
      let target = holiday ? 4 : 8;
      if (leave) target /= 2;
      if (gaps[u.id] && day in gaps[u.id]) target = gaps[u.id][day];
      if (!target) continue;

      const used = new Set();
      pick(SPLITS[target]).forEach((hours, i) => {
        let pid = i === 0 && rand() < 0.7 ? routine[0] : pick(routine);
        if (used.has(pid)) pid = routine.find(p => !used.has(p)) || pid;
        used.add(pid);
        const [type, note] = pick(SEED_TASKS[pid]);
        out.push({ id: uid(), userId: u.id, projectId: pid, date: day, hours, type, note, createdAt: `${day}T${String(9 + i * 2).padStart(2, '0')}:00` });
      });
    }
  });
  return out;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
