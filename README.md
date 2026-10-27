# Bisolera Danışman Portalı (prototip)

Danışmanların şirket e-postasıyla girip **aktivite**, **izin** ve **müşteri/proje** bilgilerini tek yerden yönettiği iç portal.

## Çalıştırma

Kurulum gerekmez. Klasörde `python serve.py` çalıştırıp http://localhost:4321 adresini aç.

`serve.py`, tarayıcının güncellenmiş dosyalar yerine eski kopyaları kullanmasını engeller. Veriler adrese bağlı tutulur: `index.html`'e çift tıklamak ya da başka port kullanmak, girdiğin kayıtları göstermez.

Giriş ekranında bir demo hesap seç (Ayşe Yılmaz = yönetici) ya da e-postanın `@` öncesini yaz (`emre.aydin`). Müşteri ve kişi adları kurgusaldır.

**Veriler tarayıcıda durur** (kayıtlar localStorage'da, Word CV'ler ve masraf fişleri IndexedDB'de). Tarayıcı verisi silinirse kayıtlar gider. **Profilim → Yedek indir** ile CV ve fişler dahil tek bir JSON dosyası alınır, **Yedekten geri yükle** ile geri yüklenir; geri yüklemeden önce mevcut verinin yedeği kendiliğinden indirilir. **Demo verilerini sıfırla** baştan başlatır.

## Ekranlar

| Ekran | Ne yapar |
|---|---|
| Özet | Bugün/hafta saatleri, **aylık takvim** (girilen / girilmeyen günler), kalan izin, hızlı giriş, aylık formu indirme ve **yazdırma / PDF** |
| Aktiviteler | Üç görünüm: **Günlük** (klavyeyle hızlı giriş, önceki günü kopyala), **Haftalık tablo** (CATS tarzı; hücreye saat yaz, Excel'den yapıştır), **Aylık** takvim ve ay kapanışı. Excel'den yükle, Excel'e aktar |
| İzinler | Bakiye (**devreden izin** dahil), talep formu (hafta sonu/tatil düşülmez, arife yarım gün), taleplerim, onaylı izin için **iptal talebi**, ekipte kim izinli |
| Masraflar | Masraf girişi (kategori, tutar, proje, **müşteriye yansıtılacak**, fiş fotoğrafı ya da PDF), onay ve ödeme durumu, aylık **masraf formu** (yazdır / PDF). Yöneticide: **onay** (tek tek ya da toplu, gerekçeli red), **ödenecekler** (kişi bazında "ödendi"), **rapor** (kişi × kategori, müşteriye yansıtılacaklar, Excel) |
| Müşteriler & Projeler | Danışman için rehber, projelerde bu ayın sözleşme saati kullanımı; yönetici müşteri/proje ekler, durum, sözleşme saati ve **yetkinlik etiketlerini** belirler |
| Yetkinlikler | **Profil** (seviye: Temel / Orta / Uzman, son 12 ayın deneyim saati, sertifikalar ve bitiş uyarısı, **Word CV**: yükle, açılır pencerede önizle, indir), **ekip matrisi** (kim neyi biliyor, kimin CV'si var), **uygun danışman** arama (seviye, sertifika şartı; yöneticide "bu ay müsait" ve CV önizleme), **yetkinlik özeti** (portaldaki bilgilerden PDF, müşteri adlarını gizleme) |
| Yönetim (yönetici) | İzin ve iptal talebi onayı, **ay kapanışı onayı**, **raporlar** (faturalanır/iç saat, müşteri → proje → danışman, sözleşme kullanımı, talep bazında saat, Excel), **doluluk** (faturalanır saat ÷ hedef saat, %75 altı uyarı, son 6 ay, faturalanmayan saatlerin dökümü, Excel), ekibin haftalık ve aylık durumu, **tatiller** (resmi tatil ve şirketin köprü günleri), kullanıcılar |

## Tatiller

**Yönetim → Tatiller**'den yıl yıl yönetilir; kod değiştirmek gerekmez. Sabit tarihli resmi tatiller (Yılbaşı, 23 Nisan, 1 ve 19 Mayıs, 15 Temmuz, 30 Ağustos, 28–29 Ekim) tek tıkla eklenir. Ramazan ve Kurban Bayramı her yıl değiştiği için Diyanet takviminden bakılıp tarih aralığıyla girilir; "önceki gün arife" seçeneği arifeyi yarım gün ekler. **Şirket tatili** resmi tatil gibi işler: o gün hedef saat düşer ve kimsenin yıllık izninden düşülmez. **Köprü izni** ise kişiye göre çalışır: danışman Özet, İzinler ya da Aktiviteler'den **İzinliyim** (1 gün düşer), **Yarım gün çalışacağım** (0,5 gün düşer) ya da **Tam gün çalışacağım** (düşmez) seçer; yönetici de Tatiller'de herkes için seçebilir. Köprü tam gün ya da yarım gün olabilir; arife gibi zaten yarım gün tatil olan bir güne eklenirse günün diğer yarısını kapsar ve ikisi birlikte tam gün tatil olur. Kapanmış bir ayda tatil değişirse hedef saatler yeniden hesaplanır, girilen kayıtlar değişmez.

## Yazdırma / PDF ve telefona kurulum

- **Aylık formu yazdır / PDF:** Özet, Aktiviteler → Dışa aktar, ay kapanışı paneli ve Yönetim → Ay kapanışı'ndan. Müşteri başına bir A4 sayfa, altta danışman ve müşteri onayı için imza alanı. Yazdır penceresinde "PDF olarak kaydet" seçilince PDF olur.
- **Uygulama olarak kur:** Profilim → *Uygulama olarak yükle* (Chrome, Edge, Android) ya da Safari'de Paylaş → Ana Ekrana Ekle. Kendi simgesiyle açılır, bağlantı yokken de çalışır (`sw.js`, `manifest.webmanifest`). iPhone'da ana ekrandaki uygulama Safari'deki kayıtları görmez; sunucuya geçene kadar tek yerden kullan.

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
- Excel işlemleri SheetJS 0.20.3 (Apache 2.0) ile yapılır; kütüphane `vendor/xlsx`'te projeyle gelir ve yalnızca gerektiğinde yüklenir. Word CV önizlemesi docx-preview 0.3.7 (Apache 2.0) ve JSZip 3.10.1 (MIT) ile yapılır (`vendor/docx-preview`, `vendor/jszip`); belge, komut çalıştıramayan ayrı bir çerçevede (sandbox) gösterilir. Yazı tipleri (Inter, Montserrat; OFL) de `vendor/fonts`'ta; portal çalışırken dışarıya istek gitmez.

## Testler

```
npm install      # bir kez: test aracı (jsdom)
npm test         # tüm testler, tarayıcı açmadan
```

`tests/*.test.js` dosyaları portalı sanal bir tarayıcıda açıp akışları uçtan uca dener: izin günleri, yedekleme, raporlar, aylık form içe/dışa aktarma ve yazdırma, ay kapanışı, takvim önerileri, tatiller, izin iptali. Ayrıca `manifest.webmanifest` ve `sw.js`'in önbellek listesi dosyalarla karşılaştırılır (yeni bir JS dosyası eklenip listeye yazılmazsa test kırılır). GitHub'da her gönderimde ve pull request'te otomatik çalışır (**Actions → Testler**); kırmızıysa birleştirmeden önce düzeltilmeli.

## Belgeler

- [İş kuralları ve deneme planı](docs/is-kurallari.md): yönetimin onaylaması gereken varsayımlar
- [Sunucu ve veritabanına geçiş](docs/sunucu-gecisi.md): şema, API, Microsoft 365 girişi, veri taşıma

## Kod yapısı

```
js/utils.js      tarih, sayı, arama yardımcıları
js/data.js       sabitler (izin türleri, varsayılan resmi tatiller) + demo veriler
js/store.js      veri katmanı — sunucuya geçerken değişecek tek dosya
js/rules.js      iş kuralları: hedef saat, izin günü, bakiye, eksik gün, iptal talebi
js/ui.js         ortak bileşenler: proje seçici, aktivite formu, aylık takvim, pencere, menü, bildirim
js/excel.js      Excel/CSV içe aktarma, aylık form, şablon ve dışa aktarma
js/print.js      aylık form ve yetkinlik özetinin yazdırılabilir / PDF hali
js/files.js      dosya deposu (IndexedDB): Word CV ve masraf fişleri; yükleme, önizleme, indirme
js/closing.js    ay kapanışı: gönderme, onay/iade, kilit, geçmiş
js/calendar.js   Outlook takvimi (.ics) okuma, tekrarlar, toplantı → proje önerileri
js/views/*.js    ekranlar
js/app.js        oturum, menü, yönlendirme, profil, yedekleme, uygulama olarak kurma
sw.js            çevrimdışı açılış (ağ önce, yoksa önbellek)
manifest.webmanifest, icons/   telefona / masaüstüne kurulum
vendor/          SheetJS ve yazı tipleri (lisanslarıyla)
tests/           uçtan uca testler (npm test)
docs/            iş kuralları, sunucu geçişi
```

## Canlıya geçiş

Ayrıntılar [docs/sunucu-gecisi.md](docs/sunucu-gecisi.md)'de. Kısaca: hosting kararı ve Entra ID uygulama kaydı → veritabanı ve API → `store.js`'in API'ye geçmesi → yedek dosyasından veri taşıma → e-posta bildirimleri. Dini bayramlar her yıl Diyanet takvimine göre **Yönetim → Tatiller**'den girilmeli.

**Public repo kuralı:** Gerçek müşteri adları, kişisel bilgiler, Excel formları ve şifreler repoya girmez. Demo verisi kurgusaldır; `.gitignore` Excel, takvim ve `.env` dosyalarını dışarıda tutar.
