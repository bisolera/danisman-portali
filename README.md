# Bisolera Danışman Portalı (prototip)

Danışmanların şirket e-postasıyla girip **aktivite**, **izin** ve **müşteri/proje** bilgilerini tek yerden yönettiği iç portal.

## Çalıştırma

Kurulum gerekmez. Klasörde `python serve.py` çalıştırıp http://localhost:4321 adresini aç.

`serve.py`, tarayıcının güncellenmiş dosyalar yerine eski kopyaları kullanmasını engeller. Veriler adrese bağlı tutulur: `index.html`'e çift tıklamak ya da başka port kullanmak, girdiğin kayıtları göstermez.

Giriş ekranında bir demo hesap seç (Ayşe Yılmaz = yönetici) ya da e-postanın `@` öncesini yaz (`emre.aydin`). Müşteri ve kişi adları kurgusaldır.
Veriler tarayıcının localStorage'ında durur; **Profilim → Demo verilerini sıfırla** ile baştan başlatılır.

## Ekranlar

| Ekran | Ne yapar |
|---|---|
| Özet | Bugün/hafta saatleri, **aylık takvim** (girilen / girilmeyen günler), kalan izin, hızlı giriş, aylık formu indirme |
| Aktiviteler | Üç görünüm: **Günlük** (klavyeyle hızlı giriş, önceki günü kopyala), **Haftalık tablo** (CATS tarzı; hücreye saat yaz, Excel'den yapıştır), **Aylık** takvim ve ay kapanışı. Excel'den yükle, Excel'e aktar |
| İzinler | Bakiye, talep formu (iş günü hesabı ve çakışma kontrolü), taleplerim, ekipte kim izinli |
| Müşteriler & Projeler | Danışman için rehber; yönetici müşteri/proje ekler, durum değiştirir |
| Yönetim (yönetici) | İzin onay/red, **ay kapanışı onayı**, ekibin haftalık durumu, ekibin aylık doluluk haritası, kullanıcı hesapları |

## Ay kapanışı

1. Danışman ay sonunda **Aktiviteler → Aylık**'tan ayı onaya gönderir (eksik gün varsa ayrıca onaylaması gerekir). Gönderim anında ay **kilitlenir**; onaydan önce geri çekilebilir.
2. Yönetici **Yönetim → Ay kapanışı**'nda takvimi, proje özetini ve notu inceler; **onaylar** ya da gerekçesiyle **iade eder**. İade edilen ay yeniden açılır, danışman Özet'te uyarı görür.
3. Onaylanan ayın aylık formu indirilebilir; formun üstüne onaylayan ve tarih yazılır. Gerekirse yönetici kilidi açar.
4. Her adım (kim, ne zaman, hangi notla) geçmişte saklanır. Kilit veri katmanında zorunludur; canlıda sunucuda uygulanmalı.

## Outlook takviminden öneriler

- **Aktiviteler → Günlük**'te seçili günün toplantıları öneri olarak çıkar; süre ve proje hazır gelir, tek tıkla ya da "hepsini ekle" ile kayda dönüşür.
- Proje bulma sırası: daha önce öğrenilen eşleştirme → konudaki proje kodu → katılımcı alan adı (@kuzeyelektronik.com → Kuzey Elektronik) → konudaki müşteri adı. Seçtiğin proje o toplantı için öğrenilir.
- Kaynak şimdilik Outlook'tan dışa aktarılan **.ics** dosyası (Dosya → Takvimi Kaydet) ya da örnek takvim. Tekrarlayan toplantılar (günlük/haftalık/aylık), hariç tutulan ve ertelenen örnekler açılır; iptal edilen, "müsait" işaretli ve tüm gün etkinlikleri önerilmez.
- Canlıda Microsoft Graph ile otomatik okunur: Entra ID'de uygulama kaydı ve `Calendars.Read` izni gerekir.

## Excel ile toplu giriş

- **İçe aktarma** (Aktiviteler → Excel'den yükle): şirketin *Danışman Aylık Aktivite Formu* doğrudan okunur. Her sayfa bir müşteri; GÜN satırları dosya adındaki aya yerleşir (`..._Eylül_2026.xlsx`). Müşteri → proje eşleştirmesi bir kez seçilir, sonraki aylarda hatırlanır. Tarih · Proje Kodu · Süre · Tür · Açıklama sütunlu her tablo ya da Excel'den yapıştırılan satırlar da olur. Önizlemede hatalı, zaten kayıtlı ve uyarılı satırlar ayrı gösterilir.
- **Dışa aktarma:** aynı aylık form, müşteri başına sayfa ve TOPLAM formülüyle üretilir. Ayrıca kayıt listesi (hafta/ay) ve proje özeti alınabilir.
- Excel işlemleri SheetJS 0.20.3 ile yapılır ve kütüphane yalnızca gerektiğinde yüklenir. Canlıda bu kütüphane proje içine alınmalı.

## Kod yapısı

```
js/utils.js      tarih, sayı, arama yardımcıları
js/data.js       sabitler (izin türleri, resmi tatiller) + demo veriler
js/store.js      veri katmanı — sunucuya geçerken değişecek tek dosya
js/rules.js      iş kuralları: hedef saat, izin günü, bakiye, eksik gün
js/ui.js         ortak bileşenler: proje seçici, aktivite formu, aylık takvim, pencere, menü, bildirim
js/excel.js      Excel/CSV içe aktarma, aylık form, şablon ve dışa aktarma
js/closing.js    ay kapanışı: gönderme, onay/iade, kilit, geçmiş
js/calendar.js   Outlook takvimi (.ics) okuma, tekrarlar, toplantı → proje önerileri
js/views/*.js    ekranlar
js/app.js        oturum, menü, yönlendirme
```

## Canlıya geçiş için sonraki adımlar

1. **Giriş:** Şirket Microsoft 365 kullanıyor → Microsoft Entra ID (Azure AD) uygulama kaydı + MSAL ile tek tıkla giriş; yalnızca `@bisolera.com` kiracısı.
2. **Sunucu + veritabanı:** `store.js` içindeki fonksiyonlar aynı isimle bir API'ye (ör. Node/.NET + PostgreSQL ya da SQL Server) bağlanır; yetki kontrolü sunucuda yapılır.
3. **Raporlama:** Aktivite verisi müşteri/proje bazında Excel'e veya SAC / Power BI'a aktarılabilir.
4. **Resmi tatiller:** Dini bayram tarihleri her yıl Diyanet takvimine göre güncellenmeli (`data.js` → `HOLIDAYS`).
