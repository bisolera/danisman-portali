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
| `users` | id, name, email (tekil), title, role (`consultant`/`admin`), annual_leave, start_date, carry_in, active | email = Microsoft hesabı; carry_in = portal öncesinden devreden izin |
| `leave_entitlements` | user_id, year, days | izin hakkı değiştiği yıllar; eski yılların devri değişmesin |
| `customers` | id, name, sector, color, internal | |
| `projects` | id, customer_id → customers, name, code (tekil), status, billable, monthly_budget | |
| `activities` | id, user_id → users, project_id → projects, date, hours (4,2), type, note, source_kind, source_key, created_at, updated_at | indeks: (user_id, date), (project_id, date) |
| `leaves` | id, user_id, type, start_date, end_date, half_day, note, status, decided_by, decided_at, created_at, cancel_status, cancel_note, cancel_requested_at, cancel_decided_by, cancel_decided_at | iptal talebi: `cancel_*` alanları |
| `periods` | id, user_id, month (`YYYY-MM`), status, note, review_note, submitted_at, decided_by, decided_at | tekil: (user_id, month) |
| `period_history` | id, period_id → periods, at, by_user, action, note | kim, ne zaman, ne yaptı |
| `holidays` | id, date (tekil), name, kind (`resmi`/`sirket`/`kopru`), half | Yönetim → Tatiller'den yönetilir |
| `holiday_work` | holiday_id → holidays, user_id → users, mode (`half`/`full`), chosen_by, chosen_at | köprü izninde kim ne kadar çalışıyor; satırı olmayan izinli sayılır |
| `user_skills` | user_id, skill_id, level (1–3), updated_at | yetkinlik seviyeleri; özet metni `users.summary` |
| `certifications` | id, user_id, name, code, skill_id, issued, expires | bitişe 90 gün kala e-posta hatırlatması da buradan |
| `contracts` | id, customer_id, name, start_date, end_date, hours, notice_days, renewal, note, renewed_to → contracts | bağlı projeler `contract_projects` (contract_id, project_id) |
| `expenses` | id, user_id, date, category, amount (12,2), description, project_id, rebill, status, receipt_key, decided_by, decided_at, reject_reason, paid_at, paid_by, created_at | indeks: (user_id, date), (status) |
| `cv_files` | user_id (tekil), name, size, storage_key, uploaded_at, uploaded_by | dosyanın kendisi veritabanında değil, dosya deposunda (Azure Blob Storage / hosting'de web kökü dışındaki bir klasör) |
| `project_skills` | project_id, skill_id | deneyim saati bu etiketlerden hesaplanır |
| `user_prefs` | user_id, key, value (JSON) | son proje, Excel/takvim eşleştirmeleri |
| `notifications` | id, user_id, kind, ref, sent_at | aynı e-posta iki kez gitmesin (aşağıya bak) |

## API
`store.js`'teki fonksiyonların karşılığı:

| İstek | Karşılığı | Yetki |
|---|---|---|
| `GET /api/me` | giriş yapan kullanıcı | herkes |
| `GET /api/activities?from&to[&userId]` | `Store.activities` | kendi kayıtları; yönetici herkesinkini |
| `POST /api/activities`, `PATCH/DELETE /api/activities/:id` | ekle, güncelle, sil | sahibi; **ay kilitliyse 423** |
| `GET/POST /api/leaves`, `POST /api/leaves/:id/decision` | izinler, onay/red | onay: yönetici |
| `POST /api/leaves/:id/cancel-request`, `…/cancel-decision` | onaylı izin için iptal talebi, karar | talep: sahibi (izin başlamadan); karar: yönetici |
| `GET /api/holidays?year`, `POST/PATCH/DELETE /api/holidays` | tatiller | okuma: herkes; yazma: yönetici |
| `PUT/DELETE /api/holidays/:id/work` | köprü izninde seçim: yarım / tam gün çalışır, silinirse izinli | danışman kendisi (gün geçmeden, ay kilitli değilse); yönetici herkes için |
| `POST /api/periods/:month/submit`, `…/withdraw` | ay kapanışı (danışman) | sahibi |
| `POST /api/periods/:userId/:month/approve`, `…/return`, `…/unlock` | ay kapanışı (yönetici) | yönetici |
| `GET/POST/PATCH /api/customers`, `/api/projects` | müşteri ve proje | yazma: yönetici |
| `GET/POST/PATCH /api/users` | kullanıcılar | yönetici |
| `GET /api/reports/:month` | `monthReport` | yönetici |
| `GET /api/reports/:month/utilization` | `teamUtilization`, `internalBreakdown` | yönetici |
| `GET /api/skills`, `PUT /api/users/:id/skills`, `GET/POST/PATCH/DELETE /api/certifications` | yetkinlik ve sertifikalar | okuma: herkes; yazma: kendisi ya da yönetici |
| `GET /api/consultants/search?skills&minLevel&cert&available` | `findConsultants` | herkes; `available` (doluluk) yalnızca yönetici |
| `GET/POST/PATCH/DELETE /api/contracts`, `POST /api/contracts/:id/renew` | sözleşmeler ve yenileme; kullanım ve uyarılar sunucuda hesaplanır | yönetici |
| `GET/POST/PATCH/DELETE /api/expenses`, `PUT /api/expenses/:id/receipt` | masraf ve fişi | sahibi (yalnızca onay beklerken ya da reddedilmişken değiştirir); okuma: sahibi ve yönetici |
| `POST /api/expenses/decision` (`ids`, `approve`/`reject`, gerekçe), `POST /api/expenses/pay` (`userId`) | onay, red, ödendi | yönetici |
| `PUT/DELETE /api/users/:id/cv`, `GET /api/users/:id/cv` | Word CV yükle / sil / indir | kendisi ya da yönetici; sunucu .docx imzasını ve 10 MB sınırını yeniden kontrol eder, dosya kişiye özel geçici bağlantıyla verilir |

## Microsoft 365 girişi (Entra ID)
Şirketin Microsoft 365 yöneticisi yapar:
1. **Entra ID → App registrations → New registration**, ad: `Bisolera Danışman Portalı`, hesap türü: *yalnızca bu kuruluş*.
2. Yönlendirme adresi: `https://portal.bisolera.com/.auth/login/aad/callback` (Azure) ya da PHP'deki giriş adresi.
3. İzinler: `User.Read`. Outlook takvimi için ayrıca `Calendars.Read`, yönetici onayıyla.
4. **Gizli anahtar asla repoya yazılmaz:** Azure'da uygulama ayarı, hostingde `.env` (`.gitignore`'da).

## E-posta bildirimleri
Tarayıcıdaki prototip e-posta gönderemez; sunucuyla birlikte eklenir. Gönderim **Microsoft Graph `sendMail`** ile şirketin kendi Microsoft 365'inden yapılır: `portal@bisolera.com` gibi paylaşılan bir posta kutusu, uygulama izni `Mail.Send`, Exchange'de *application access policy* ile yalnızca o kutuya sınırlı. Ek ücret yok, mailler şirket alan adından çıktığı için spam'e düşmez.

| Olay | Kime | Ne zaman |
|---|---|---|
| İzin talebi geldi | Yönetici | anında |
| İzin onaylandı / reddedildi | Danışman | anında |
| İzin iptal talebi geldi / sonuçlandı | Yönetici / danışman | anında |
| Ay onaya gönderildi | Yönetici | anında |
| Ay iade edildi | Danışman | anında, iade nedeniyle |
| Ay onaylandı | Danışman | anında; aylık form ekli (isteğe bağlı) |
| Ay sonu yaklaşıyor | Ayı açık danışmanlar | ayın son iş günü 15:00 |
| Geçen ay hâlâ açık | Danışman, yöneticiye özet | yeni ayın 2. ve 5. iş günü |
| Geçen hafta eksik giriş | Danışman | Pazartesi 09:00, eksik gün varsa |
| Onay bekleyenler özeti | Yönetici | her iş günü 09:00, bekleyen varsa |
| Sertifika dolmak üzere | Danışman, yöneticiye özet | bitişe 90 ve 30 gün kala |
| Masraf onaylandı / reddedildi / ödendi | Danışman | anında (reddedilende gerekçeyle) |
| Onay bekleyen masraflar | Yönetici | günlük özete eklenir |
| Sözleşme bitişe yaklaşıyor / saat havuzu %80 / aşıldı / erken tükenecek | Yönetici | ilk kez olduğunda ve haftalık özet |

- Zamanlanmış gönderimler: Azure Functions *timer trigger* (A) ya da hosting cron (B).
- Tatil ve izin dikkate alınır (`rules.js` → `nextWorkday`, `missingDays`): izinli kişiye "eksik giriş" gitmez, tatile denk gelen hatırlatma bir sonraki iş gününe kayar.
- `notifications` tablosu aynı hatırlatmanın iki kez gitmesini önler (kind + ref tekil, ör. `ay_sonu` + `2026-10`).
- Hatırlatmalar Profilim'den kapatılabilir; onay/ret bildirimleri kapatılamaz.
- KVKK: e-postada izin türü yazılmaz (hastalık izni de yalnızca "izin" görünür); ayrıntı portalda.
- E-postadaki buton ilgili sayfayı açar: `#/yonetim?tab=onaylar`, `#/aktiviteler?v=ay`, `#/izinler`.
- Aynı olaylar ileride Teams sohbetine de gönderilebilir (Graph, ayrı izin).

## Telefona kurulum (PWA)
`manifest.webmanifest` ve `sw.js` hazır. Canlıda **HTTPS zorunlu** (service worker yalnızca HTTPS ya da localhost'ta çalışır). `sw.js` "ağ önce" çalışır: bağlantı varken her zaman sunucudaki güncel dosya alınır, yalnızca bağlantı yokken önbellek kullanılır; yeni sürümde kimse eski kodda kalmaz. Sunucuya geçince API istekleri (`/api/…`) önbelleğe alınmamalı; `sw.js`'te bu yol hariç tutulur.

## Mevcut verinin taşınması
Portalın **yedek dosyası (JSON)** taşıma kaynağıdır; Word CV'ler de içinde (base64, `files` bölümü). Tek seferlik bir betik, yedekteki kullanıcıları, müşterileri, projeleri, aktiviteleri, izinleri ve ay kapanışlarını API'ye yükler. Kimlikler korunur, eşleştirme gerekmez. Deneme haftasındaki gerçek kayıtlar böylece kaybolmaz.

## Sıra
1. Hosting kararı ve Entra ID uygulama kaydı
2. Veritabanı ve API (kilit ve yetki kuralları dahil)
3. `store.js`'in API'ye geçmesi; ekranlarda bekleme durumları
4. Yedekten veri taşıma, 1 hafta paralel kullanım
5. E-posta bildirimleri (Graph `sendMail`), Outlook takvimi (Graph), istenirse Teams
