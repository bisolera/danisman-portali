# İş kuralları — onay bekleyenler

Portaldaki kurallar şu an **varsayım**. Yönetimin her maddeyi onaylaması ya da düzeltmesi gerekiyor. Parantez içinde kuralın kodda nerede olduğu yazıyor; değişiklik genelde tek satır.

## Çalışma süresi
- [ ] Günlük hedef **8 saat** (`DAILY_HOURS`, `js/rules.js`)
- [ ] Arife günü hedef **4 saat**, resmi tatilde **0** (`dailyTarget`)
- [ ] Şirketin kapattığı günler için iki tür var (Yönetim → Tatiller):
  - **Şirket tatili:** resmi tatil gibi; kimsenin izninden düşmez.
  - **Köprü izni:** şirket kapalı; her danışman kendisi seçer: **izinli** → tamamı yıllık izninden düşer (1 gün), **yarım gün çalışır** → 0,5 gün düşer (hedef 4 saat), **tam gün çalışır** → düşmez (hedef 8 saat). Yarım gün köprüde iki seçenek kalır: izinli (0,5 düşer) ya da çalışır (düşmez). Seçimi danışman o güne kadar kendisi yapar (Özet, İzinler, Aktiviteler); ay kapanışa gönderildiyse ya da gün geçtiyse yalnızca yönetici değiştirir. O gün raporlu/başka türde izinliyse ya da henüz işe girmemişse düşmez. Aynı günü kapsayan izin talebinde köprü günü ikinci kez sayılmaz. (`bridgeDays`, `holidayFor`)
  - Köprü **tam gün** ya da **yarım gün** olabilir. Arife gibi zaten yarım gün tatil olan bir güne eklenen köprü, günün diğer yarısını kapsar: ikisi birlikte tam gün tatil olur, çalışmayandan 0,5 gün düşer, çalışan o yarım günü çalışır. Bir güne en fazla iki yarım tatil girilir.
- [ ] Aynı güne birden fazla müşteriye saat yazılabilir. Gün toplamı 12 saati geçince uyarı verilir, engellenmez (aylık formlarda bir günde 20–30 saat görülüyor).
- [ ] Hafta sonu çalışması girilebilir, hedefe sayılmaz
- [ ] Süreler çeyrek saate yuvarlanır (1,3 → 1,25)

## Aktivite
- [ ] Açıklama **zorunlu değil**. Aylık form müşteriye gidiyorsa zorunlu olmalı mı?
- [ ] Aktivite türleri: Geliştirme, Analiz & Tasarım, Toplantı, Destek, Test, Dokümantasyon, Eğitim, Proje Yönetimi (`ACTIVITY_TYPES`, `js/data.js`)
- [ ] Talep numarası biçimi: `HARF-RAKAM`, en az 2 rakam (SM-2119038, CFR-102) (`ticketIds`)

## İzin
- [x] **Hak ediş işe giriş yıldönümünde:** ilk izin işe girişten 1 yıl sonra kazanılır, sonra her yıl işe giriş gününde eklenir; ilk yıl dolmadan bakiye 0 (`accruals`, `js/rules.js`)
- [x] Tutar İş Kanunu md. 53'e göre: 1–5. yıl (5 dahil) 14, 6–14. yıl 20, 15. yıl ve sonrası 26 gün; kıdemle kendiliğinden artar. Şirket daha fazla veriyorsa kullanıcı formundaki "Yıllık hak ediş" geçerli, ama yasal asgarinin altına inmez (`accrualAmount`). 18 yaş altı ve 50 yaş üstü için 20 gün alt sınırı doğum tarihi tutulmadığı için uygulanmıyor.
- [x] **Yürüyen bakiye:** açılış bakiyesi (1 Ocak 2026, portal öncesinden kalan) + hak edişler − onaylı yıllık izinler − köprü izinleri; takvim yılı ayrımı yok, kalan kendiliğinden devreder (`leaveBalance`)
- [x] **Avans (kredi) izin:** bakiye eksiye düşebilir ve sonraki hak edişten düşülür (−3 iken 14 gelince 11). Talep, başladığı güne kadar gelecek hak edişi hesaba katar (`leaveProjection`)
- [ ] Avans sınırı: en fazla bir sonraki hak ediş kadar eksiye inilir (ör. −14); ilk yılını doldurmamış biri de bu sınıra kadar avans alabilir. Doğru mu?
- [ ] Hafta sonu ve resmi tatil izinden düşülmez, **arife yarım gün** düşülür (`countLeaveDays`)
- [ ] Yarım gün izin alınabilir
- [ ] Yalnızca **yıllık izin** bakiyeden düşer; mazeret, hastalık ve ücretsiz izin düşmez
- [ ] Onaylayan: yönetici rolündeki herkes. Yönetici kendi talebini onaylayabilir mi?
- [ ] Onaylı izin, **başlamadan** (en geç ilk günü) iptal talebiyle geri alınabilir; yönetici onaylarsa günler bakiyeye döner. Başlamış izin kısaltılamaz; gerekirse yönetici düzeltir. Talep beklerken izin geçerli sayılır. (`canRequestCancel`)
- [ ] Hastalık izninde nota sağlık bilgisi yazılmaz (KVKK: sağlık verisi özel nitelikli kişisel veri). Rapor belgesi nerede tutulacak?
- [ ] Ekip takviminde danışmanlar birbirlerinin yalnızca tarihini görür; izin türünü ve notu yalnızca yönetici görür

## Ay kapanışı
- [ ] Ay **gönderilince kilitlenir**; eksik günle de gönderilebilir (danışman ayrıca onaylar)
- [ ] Son gönderim tarihi (ör. ayın 3. iş günü) şu an yok. Olmalı mı? Hatırlatma ne zaman gitmeli?
- [ ] Onaylayan yönetici kilidi açabilir; her adım geçmişe yazılır
- [ ] Aylık form müşteri başına sayfa; aynı gün aynı müşterideki kayıtlar tek satırda birleşir
- [ ] Yazdırılan / PDF form: müşteri başına A4 sayfa, altta danışman ve müşteri onayı imza alanı; onaylanmamış ayda üstte "Taslak" ya da "Onay bekliyor" yazar

## Doluluk
- [x] Doluluk = **faturalanır saat ÷ hedef saat**; **%75 altı uyarı** (tam %75 uyarı değil) (`utilization`, `UTILIZATION_TARGET`, `js/rules.js`)
- [x] Hedef saat: iş günleri × 8; izin, tatil ve köprü seçimi düşülür; işe girişten önceki günler sayılmaz. Payda hedef olduğu için eksik giriş oranı düşürür.
- [x] İçinde bulunulan ay, ay başından **düne kadar** hesaplanır
- [x] **Yalnızca yönetici görür** (Yönetim → Doluluk); danışman kendi oranını görmez. Sunucuya geçince `GET /api/reports/:month/utilization` yalnızca yöneticiye açılır.
- [ ] Yönetici rolündekiler de listede. Faturalanır iş beklenmeyen kişiler (ör. yalnızca yönetim) listeden çıkarılsın mı?

## Yetkinlikler
- [x] Yetkinlik listesi: BW 7.x, BW/4HANA, ABAP/AMDP, HANA·CDS, Datasphere, SAC raporlama, SAC planlama, BPC, PaPM, Embedded Analytics, Fabric, Power BI, Proje yönetimi (`SKILLS`, `js/data.js`)
- [x] Seviye: Temel / Orta (bağımsız çalışır) / Uzman (proje yönetir, öğretir). Danışman kendisi girer, **yönetici onayı gerekmez**; yönetici gerekirse herkesinkini düzenler. Beyan edilen seviyenin yanında portaldan gelen deneyim saati de görünür.
- [x] Deneyim: son 12 ayda o yetkinlikle etiketli projelere yazılan saat (kendiliğinden); etiketleri yönetici proje formunda verir
- [x] Sertifika: bitişe **90 gün** kala "yakında doluyor" (Özet'te ve Yetkinlikler'de uyarı), bitince "süresi doldu" ve CV'ye girmez (`certStatus`, `CERT_WARN_DAYS`)
- [x] Uygun danışman: seçilen yetkinliklerin hepsinde en az istenen seviye; sıralama seviye toplamı, sonra deneyim. "Bu ay müsait" (doluluk %75 altı) filtresi yalnızca yöneticide
- [x] Herkes ekibin yetkinliklerini ve CV'sini görür; düzenleme kendisi ve yönetici
- [x] Yetkinlik özeti (portalın ürettiği PDF): son 24 ayın müşteri projeleri (iç projeler hariç); "müşteri adlarını gizle" seçilince müşteri yerine sektör yazar
- [x] **Word CV:** her danışmanın tek bir .docx CV'si (en fazla 10 MB); yenisi eskisinin yerine geçer; eski .doc kabul edilmez. Yükleme kendisi ve yönetici (`saveCv`, `js/files.js`)
- [x] Word CV'yi **yalnızca kendisi ve yönetici** görür / indirir (KVKK: CV'de telefon, adres gibi kişisel bilgi olur). Diğer danışmanlar yalnızca yüklü olup olmadığını görür (`canSeeCv`). Sunucuya geçince `GET /api/users/:id/cv` de yalnızca bu ikisine açılır.

## Masraflar
- [x] Kategoriler: Ulaşım (uçak, tren, otobüs) · Taksi · Konaklama · Yemek · Otopark / otoyol · Diğer (`EXPENSE_CATEGORIES`, `js/data.js`)
- [x] Tutar TL ve KDV dahil; tek masraf en fazla 100.000 TL (`EXPENSE_MAX`); tarih ileri olamaz. Döviz ve kendi aracıyla km başına ödeme **yok**
- [x] Fiş / fatura **isteğe bağlı**; fişsiz masraf "fişsiz" etiketiyle görünür, yönetici onaylarken ve ödeme listesinde görür
- [x] "Müşteriye yansıtılacak" işaretlenirse proje zorunlu; yönetici raporunda müşteri bazında toplanır
- [x] Akış: onay bekliyor → onaylandı (ödenecek) → ödendi; reddedilen gerekçesiyle danışmana döner, düzeltilip yeniden gönderilir. Onaylanan ve ödenen değiştirilemez (`canEditExpense`)
- [x] Onaylayan: yönetici rolündeki herkes; **yönetici kendi masrafını da onaylayabilir** (onaylayan kayıtta ve masraf formunda görünür)
- [x] Danışman kendi masraflarını, yönetici herkesinkini görür
- [x] Aynı gün, aynı kategori ve tutarda ikinci masrafta uyarı çıkar (iki kez girilmiş olabilir); ikinci gönderimde kaydedilir

## Sözleşmeler
- [x] Sözleşme: müşteri, ad, başlangıç–bitiş, isteğe bağlı saat havuzu, bağlı projeler, hatırlatma süresi (varsayılan 60 gün), yenileme (manuel / otomatik), not. Bedel tutulmaz
- [x] Kullanılan saat: bağlı projelere sözleşme döneminde yazılan tüm saatler (`contractUsage`)
- [x] Uyarılar: bitişe hatırlatma süresi kadar kala; havuzun %80'inde (uyarı) ve %100'ünde (aşım); bu kullanım hızıyla havuz bitişten önce tükenecekse (en az 14 günlük veriyle) (`contractAlerts`)
- [x] Aynı proje aynı dönemde iki sözleşmede olamaz (`contractClash`)
- [x] Yenile: yeni dönem aynı ayarlarla açılır (tam ay süren sözleşme aynı sayıda ay uzar, adındaki yıl ilerler); eski sözleşme bitiş uyarısı vermez, ama sürüyorsa saat havuzu izlenmeye devam eder
- [x] Yalnızca yönetici görür (Yönetim → Sözleşmeler, Özet'te uyarı, müşteri kartında özet)

## Müşteri ve proje
- [ ] Faturalanır / faturalanmaz ayrımı **proje bazında**
- [ ] Aylık sözleşme saati: %80'de uyarı, %100'de aşım (`budgetState`)
- [ ] Danışman bütün aktif projeleri seçebilir. Yalnızca atandığı projeleri mi görmeli?

---

## Deneme planı (1 hafta)

1. **Kimler:** 2–3 danışman ve 1 yönetici.
2. **Danışmanlar:** Her gün aktivitelerini portala girer. Hafta başında kendi son aylık Excel formunu içe aktarır, sonucu formla karşılaştırır.
3. **Yönetici:** En az bir izin talebini ve bir ay kapanışını onaylar ya da iade eder. Raporlar sekmesini faturalama gözüyle inceler.
4. **Yedek:** Veriler şimdilik tarayıcıda. Herkes her gün sonunda **Profil → Yedek indir** der.
5. **Geri bildirim:** GitHub **Issues**'a yazılır. Her konu ayrı bir issue: neyi yapmak zordu, ne eksik, ne yanlış hesaplandı.
6. **Hafta sonunda:** Bu listedeki kurallar netleşir, sunucu ve hosting kararı verilir (bkz. [sunucu-gecisi.md](sunucu-gecisi.md)).
