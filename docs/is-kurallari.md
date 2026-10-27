# İş kuralları — onay bekleyenler

Portaldaki kurallar şu an **varsayım**. Yönetimin her maddeyi onaylaması ya da düzeltmesi gerekiyor. Parantez içinde kuralın kodda nerede olduğu yazıyor; değişiklik genelde tek satır.

## Çalışma süresi
- [ ] Günlük hedef **8 saat** (`DAILY_HOURS`, `js/rules.js`)
- [ ] Arife günü hedef **4 saat**, resmi tatilde **0** (`dailyTarget`)
- [ ] **Şirket tatili (köprü günü)** resmi tatil gibi işler: hedef 0, izinden düşmez. Köprü günü yıllık izinden mi düşülmeli? Düşülecekse Tatiller'e girilmez, herkes izin talebi açar. (Yönetim → Tatiller)
- [ ] Aynı güne birden fazla müşteriye saat yazılabilir. Gün toplamı 12 saati geçince uyarı verilir, engellenmez (aylık formlarda bir günde 20–30 saat görülüyor).
- [ ] Hafta sonu çalışması girilebilir, hedefe sayılmaz
- [ ] Süreler çeyrek saate yuvarlanır (1,3 → 1,25)

## Aktivite
- [ ] Açıklama **zorunlu değil**. Aylık form müşteriye gidiyorsa zorunlu olmalı mı?
- [ ] Aktivite türleri: Geliştirme, Analiz & Tasarım, Toplantı, Destek, Test, Dokümantasyon, Eğitim, Proje Yönetimi (`ACTIVITY_TYPES`, `js/data.js`)
- [ ] Talep numarası biçimi: `HARF-RAKAM`, en az 2 rakam (SM-2119038, CFR-102) (`ticketIds`)

## İzin
- [ ] Yeni kullanıcıda yıllık izin, kıdeme göre yasal asgariyle dolar: 1–5 yıl 14, 5–15 yıl 20, 15+ yıl 26 gün. Şirket daha fazla veriyor mu? (`legalAnnualLeave`)
- [x] Bakiye **takvim yılına** göre hesaplanır; **kullanılmayan izin ertesi yıla olduğu gibi devreder**, eksi bakiye (avans izin) de devreder ve ertesi yılın hakkından düşer, üst sınır yok (`carriedLeave`). Portal öncesinden kalan izin, kullanıcı formunda "Devreden izin · 2026 başı" alanına girilir. İzin hakkı değişince (kıdem) eski yıllar eski hakla kalır.
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
