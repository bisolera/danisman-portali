# Sunucu ve veritabanına geçiş

## Neden gerekli
Prototip verisini her kullanıcının **kendi tarayıcısında** tutuyor. Bu yüzden:
- yönetici danışmanların kayıtlarını göremez; izin ve ay kapanışı onayı kişiler arasında çalışmaz;
- giriş gerçek değil: e-posta yazan herkes girebilir;
- tarayıcı verisi silinirse kayıtlar gider (geçici çözüm: Profil → Yedek indir).

## Mimari
```
Tarayıcı (bugünkü ekranlar) ──HTTPS──> API ──> Veritabanı
        │                               │
        └── Microsoft 365 girişi ───────┘ (token API'de doğrulanır)
```
Ekranlar aynı kalır. Değişen tek yer `js/store.js`: fonksiyonlar aynı adla API'yi çağırır ve sonuç dönene kadar bekler (async). Kilit, yetki ve onay kuralları **sunucuda** zorunlu olur; tarayıcıdaki kontroller yalnızca açıklayıcı mesaj için kalır.

## Seçenekler

| | A) Azure | B) Paylaşımlı hosting (ör. Güzel Hosting) |
|---|---|---|
| Arayüz | Azure Static Web Apps | Aynı hosting |
| API | Azure Functions (JavaScript ya da C#) | PHP 8 |
| Veritabanı | Azure SQL (serverless) | MySQL / MariaDB |
| Microsoft 365 girişi | Hazır (Standard plan) | Elle (OAuth 2.0, PHP) |
| Outlook takvimi | Microsoft Graph, kolay | Microsoft Graph, elle |
| Veri konumu | Avrupa | Türkiye seçilebilir |
| Bakım | Çoğu Microsoft'ta | Yedek ve güncellemeler bizde |

Karar verildikten sonra tasarım aynıdır; aşağıdaki şema ve API iki seçenekte de geçerli.

## Veritabanı şeması
| Tablo | Alanlar | Not |
|---|---|---|
| `users` | id, name, email (tekil), title, role (`consultant`/`admin`), annual_leave, start_date, active | email = Microsoft hesabı |
| `customers` | id, name, sector, color, internal | |
| `projects` | id, customer_id → customers, name, code (tekil), status, billable, monthly_budget | |
| `activities` | id, user_id → users, project_id → projects, date, hours (4,2), type, note, source_kind, source_key, created_at, updated_at | indeks: (user_id, date), (project_id, date) |
| `leaves` | id, user_id, type, start_date, end_date, half_day, note, status, decided_by, decided_at, created_at | |
| `periods` | id, user_id, month (`YYYY-MM`), status, note, review_note, submitted_at, decided_by, decided_at | tekil: (user_id, month) |
| `period_history` | id, period_id → periods, at, by_user, action, note | kim, ne zaman, ne yaptı |
| `holidays` | date (anahtar), name, half | her yıl Diyanet takvimiyle güncellenir |
| `user_prefs` | user_id, key, value (JSON) | son proje, Excel/takvim eşleştirmeleri |

## API
`store.js`'teki fonksiyonların karşılığı:

| İstek | Karşılığı | Yetki |
|---|---|---|
| `GET /api/me` | giriş yapan kullanıcı | herkes |
| `GET /api/activities?from&to[&userId]` | `Store.activities` | kendi kayıtları; yönetici herkesinkini |
| `POST /api/activities`, `PATCH/DELETE /api/activities/:id` | ekle, güncelle, sil | sahibi; **ay kilitliyse 423** |
| `GET/POST /api/leaves`, `POST /api/leaves/:id/decision` | izinler, onay/red | onay: yönetici |
| `POST /api/periods/:month/submit`, `…/withdraw` | ay kapanışı (danışman) | sahibi |
| `POST /api/periods/:userId/:month/approve`, `…/return`, `…/unlock` | ay kapanışı (yönetici) | yönetici |
| `GET/POST/PATCH /api/customers`, `/api/projects` | müşteri ve proje | yazma: yönetici |
| `GET/POST/PATCH /api/users` | kullanıcılar | yönetici |
| `GET /api/reports/:month` | `monthReport` | yönetici |

## Microsoft 365 girişi (Entra ID)
Şirketin Microsoft 365 yöneticisi yapar:
1. **Entra ID → App registrations → New registration**, ad: `Bisolera Danışman Portalı`, hesap türü: *yalnızca bu kuruluş*.
2. Yönlendirme adresi: `https://portal.bisolera.com/.auth/login/aad/callback` (Azure) ya da PHP'deki giriş adresi.
3. İzinler: `User.Read`. Outlook takvimi için ayrıca `Calendars.Read`, yönetici onayıyla.
4. **Gizli anahtar asla repoya yazılmaz:** Azure'da uygulama ayarı, hostingde `.env` (`.gitignore`'da).

## Mevcut verinin taşınması
Portalın **yedek dosyası (JSON)** taşıma kaynağıdır. Tek seferlik bir betik, yedekteki kullanıcıları, müşterileri, projeleri, aktiviteleri, izinleri ve ay kapanışlarını API'ye yükler. Kimlikler korunur, eşleştirme gerekmez. Deneme haftasındaki gerçek kayıtlar böylece kaybolmaz.

## Sıra
1. Hosting kararı ve Entra ID uygulama kaydı
2. Veritabanı ve API (kilit ve yetki kuralları dahil)
3. `store.js`'in API'ye geçmesi; ekranlarda bekleme durumları
4. Yedekten veri taşıma, 1 hafta paralel kullanım
5. Outlook takvimi (Graph) ve Teams/e-posta hatırlatmaları
