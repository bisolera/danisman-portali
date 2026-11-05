/* Yetkinlikler: kim neyi biliyor, sertifikalar, CV (formdan doldurulur, js/cv.js), uygun danışman arama.
   Danışman yalnızca kendi profilini ve CV'sini görür ve düzenler. Başkasınınkiler, ekip matrisi, uygun danışman araması ve doluluk yalnızca yöneticide. */

const SkillsView = {
  mount(el, { query }) {
    const me = App.user, admin = App.isAdmin();
    const MODES = admin ? [['ben', 'Profil'], ['cv', 'CV'], ['ekip', 'Ekip matrisi'], ['ara', 'Uygun danışman']] : [['ben', 'Profil'], ['cv', 'CV']];
    let mode = MODES.some(([k]) => k === query.v) ? query.v : 'ben';
    let personId = admin && Store.user(query.u)?.active ? query.u : me.id;     // başkasının profilini yalnızca yönetici açar; danışman ?u= ile de kendisine düşer
    const search = { skills: [], minLevel: 2, certRequired: false, available: false };
    const groups = [...new Set(SKILLS.map(s => s.group))];

    el.innerHTML = `
      <header class="page-head"><div><h1>Yetkinlikler</h1><p>Kim neyi biliyor, sertifikalar ve teklif için CV.</p></div></header>
      <div class="tabs admin-tabs" id="modes"></div>
      <div id="certAlert"></div>
      <div id="body"></div>`;
    const body = el.querySelector('#body');
    const canEdit = () => admin || personId === me.id;
    const perPerson = () => mode === 'ben' || mode === 'cv';
    const setHash = () => history.replaceState(null, '', `#/yetkinlik?v=${mode}${perPerson() && personId !== me.id ? `&u=${personId}` : ''}`);
    if ((query.u && query.u !== personId) || (query.v && query.v !== mode)) setHash();     // izin verilmeyen adres: gösterilen ekrana düzelt

    function render() {
      el.querySelector('#modes').hidden = MODES.length < 2;
      el.querySelector('#modes').innerHTML = MODES.map(([k, label]) => `<button class="${k === mode ? 'is-active' : ''}" data-mode="${k}">${label}</button>`).join('');
      renderCertAlert();
      ({ ben: renderProfile, cv: renderCv, ekip: renderMatrix, ara: renderSearch })[mode]();
    }

    // Süresi dolan / yaklaşan sertifikalar: yönetici ekibin hepsini, danışman kendisininkini görür
    function renderCertAlert() {
      const list = Store.certs(admin ? {} : { userId: me.id })
        .filter(c => ['yakinda', 'doldu'].includes(certStatus(c)) && Store.user(c.userId)?.active)
        .sort((a, b) => a.expires.localeCompare(b.expires));
      el.querySelector('#certAlert').innerHTML = list.length ? `<div class="callout warn">${icon('alert', 16)}<div>
        <strong>${list.length} sertifika ${list.some(c => certStatus(c) === 'doldu') ? 'dolmuş ya da dolmak üzere' : 'dolmak üzere'}</strong>
        <div class="cert-alert">${list.map(c => `<span>${admin ? `${esc(firstName(Store.user(c.userId).name))} · ` : ''}${esc(c.name)} · ${certStatus(c) === 'doldu'
          ? `<b>${fmtDate(c.expires)} doldu</b>` : `${fmtDate(c.expires)} (${daysBetween(todayISO(), c.expires)} gün)`}</span>`).join('')}</div></div></div>` : '';
    }

    // Yönetici başka birinin profiline / CV'sine geçer
    function personSelect(u) {
      if (!admin) return '';
      const people = Store.users().filter(x => x.active).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      return `<select class="input sm-select" data-person aria-label="Kişi seç">${people.map(x => `<option value="${x.id}"${x.id === u.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
    }
    const viewingNote = u => (canEdit() ? '' : `<p class="muted small-text">${icon('lock', 13)} ${esc(firstName(u.name))} kendisi düzenler; sen görüntülüyorsun.</p>`);

    /* ---------- Profil: seviyeler, sertifikalar ---------- */

    function renderProfile() {
      const u = Store.user(personId), edit = canEdit(), hours = skillHours(u.id);
      const certs = Store.certs({ userId: u.id }).slice().sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
      body.innerHTML = `
        <section class="card">
          <div class="card-head">
            <span class="cell-user">${avatar(u, 40)}<span><strong>${esc(u.name)}</strong><small>${esc(u.title)}${u.startDate ? ` · ${tenureText(u)}` : ''}</small></span></span>
            <div class="row-gap">${personSelect(u)}</div>
          </div>
          ${viewingNote(u)}
          <div class="skill-groups">${groups.map(g => `<div class="skill-group"><div class="sub-head">${esc(g)}</div>
            ${SKILLS.filter(s => s.group === g).map(s => {
              const level = u.skills?.[s.id] || 0, h = hours[s.id] || 0;
              return `<div class="skill-row" data-skill="${s.id}">
                <span class="skill-name">${esc(s.name)}</span>
                <div class="lvl-seg${edit ? '' : ' is-readonly'}" role="group" aria-label="${esc(s.name)} seviyesi">${SKILL_LEVELS.map((label, n) =>
                  `<button class="${n === level ? 'is-active' : ''}" data-level="${n}"${edit ? '' : ' disabled'} aria-pressed="${n === level}">${label}</button>`).join('')}</div>
                <span class="skill-hours${h ? '' : ' faint'}" title="Son 12 ayda bu yetkinlikteki projelere yazılan saat">${h ? `${fmtNum(h)} sa` : '—'}</span>
              </div>`;
            }).join('')}</div>`).join('')}</div>
          <p class="muted small-text">Saat: son 12 ayda bu yetkinlikle etiketli projelere yazılan süre (portaldan kendiliğinden). Seviye: Temel · Orta = bağımsız çalışır · Uzman = proje yönetir, öğretir.</p>
        </section>
        <section class="card section-gap">
          <div class="card-head"><h2>Sertifikalar</h2>${edit ? `<button class="btn ghost sm" data-add-cert>${icon('plus', 15)} Sertifika ekle</button>` : ''}</div>
          ${certs.length ? certs.map(c => {
            const st = CERT_STATUS[certStatus(c)];
            return `<div class="cert-row" data-cert="${c.id}">
              <span class="cert-ic">${icon('shield', 16)}</span>
              <div class="grow min0"><strong>${esc(c.name)}</strong>${c.code ? ` <span class="code">${esc(c.code)}</span>` : ''}
                <small class="muted block-sm">${[c.skillId ? skillName(c.skillId) : '', c.issued ? `Alındı ${fmtDate(c.issued)}` : '', c.expires ? `Geçerlilik ${fmtDate(c.expires)}` : 'Süresiz'].filter(Boolean).join(' · ')}</small></div>
              ${pill(st.label, st.tone)}
              ${edit ? `<button class="icon-btn sm" data-edit-cert title="Düzenle" aria-label="Düzenle">${icon('pencil', 15)}</button>
                <button class="icon-btn sm" data-del-cert title="Sil" aria-label="Sil">${icon('trash', 15)}</button>` : ''}
            </div>`;
          }).join('') : emptyState('shield', 'Sertifika girilmemiş', edit ? 'SAP ya da Microsoft sertifikalarını bitiş tarihiyle ekle; dolmadan önce hatırlatılır.' : '')}
        </section>`;
    }

    /* ---------- CV: formdan doldurulur; "CV'yi al" ile şirketin düzeninde PDF / Word (js/cv.js) ---------- */

    function renderCv() {
      const u = Store.user(personId), edit = canEdit(), r = resumeOf(u), dis = edit ? '' : ' disabled', opt = ' <span class="faint">(isteğe bağlı)</span>';
      const imports = edit ? portalCvImportable(u).length : 0;
      const input = (key, label, attrs = '') => `<label class="field"><span class="field-label">${label}</span><input class="input" data-cv-field="${key}" value="${esc(r[key] || '')}"${attrs}${dis}></label>`;
      // Bisolera satırı portaldan gelir (giriş tarihi, unvan); kişi kendisi eklerse onunki geçerli
      const bisolera = u.startDate && !r.jobs.some(j => /bisolera/i.test(j.company))
        ? `<div class="cv-item is-auto"><div class="cv-item-main"><span class="cv-item-title"><strong>Bisolera</strong>${pill('Portaldan', 'muted')}</span>
            <small>${esc(r.headline || u.title)} · ${fmtMonthInput(u.startDate.slice(0, 7))} – devam ediyor</small></div></div>` : '';
      const certs = Store.certs({ userId: u.id }).filter(c => certValid(c, todayISO()));
      body.innerHTML = `
        <section class="card">
          <div class="card-head">
            <span class="cell-user">${avatar(u, 40)}<span><strong>${esc(u.name)}</strong><small data-cv-headline>${esc(r.headline || u.title)}</small></span></span>
            <div class="row-gap">${personSelect(u)}<button class="btn primary sm" data-cv-export>${icon('download', 15)} CV'yi al</button></div>
          </div>
          <div data-cv-status>${cvStatusHtml(u)}</div>
          ${viewingNote(u)}
          <div class="form-grid">
            ${input('headline', 'CV’deki unvan', ` maxlength="80" placeholder="${esc(u.title)}"`)}
            <label class="field"><span class="field-label">E-posta</span><input class="input" value="${esc(u.email)}" disabled></label>
            ${input('phone', 'Telefon', ' maxlength="30" inputmode="tel" placeholder="05xx xxx xx xx"')}
            ${input('languages', 'Diller', ' maxlength="120" placeholder="Türkçe (ana dil), İngilizce (iyi)"')}
            <label class="field"><span class="field-label">Doğum tarihi${opt}</span><input class="input" type="date" data-cv-field="birthDate" value="${r.birthDate || ''}"${dis}></label>
            ${input('nationality', `Uyruk${opt}`, ' maxlength="40" placeholder="Türkiye"')}
            <label class="field"><span class="field-label">Medeni durum${opt}</span><select class="input" data-cv-field="marital"${dis}><option value="">—</option>
              ${Object.entries(CV_MARITAL).map(([k, [tr]]) => `<option value="${k}"${r.marital === k ? ' selected' : ''}>${tr}</option>`).join('')}</select></label>
          </div>
          <p class="muted small-text cv-note">CV'yi yalnızca sen ve yönetici görürsünüz. Doğum tarihi, medeni durum ve uyruk, CV alınırken istenirse dışarıda bırakılır.</p>
        </section>
        <section class="card section-gap">
          <div class="card-head"><h2>Profil</h2></div>
          <div class="form-stack">
            <label class="field"><span class="field-label">Profil yazısı <span class="faint">(CV'nin başında)</span></span>
              <textarea class="input" rows="4" maxlength="1500" data-summary${dis} placeholder="Örn. 6 yıllık SAP BW deneyimi; BW/4HANA geçişi, Datasphere ve BPC planlama projelerinde çalıştı.">${esc(u.summary || '')}</textarea></label>
            <label class="field"><span class="field-label">SAP deneyim özeti <span class="faint">(her satır bir madde)</span></span>
              <textarea class="input" rows="5" maxlength="1500" data-cv-field="areas"${dis} placeholder="SAP BW/4HANA geliştirme&#10;SAP Datasphere&#10;ABAP CDS View">${esc(r.areas || '')}</textarea></label>
            ${edit ? `<div><button class="btn ghost sm" data-cv-areas>${icon('award', 15)} Yetkinliklerimden doldur</button></div>` : ''}
          </div>
        </section>
        ${cvListCard('projects', 'Proje deneyimi', r.projects.slice().sort(byNewest), p => `
          <span class="cv-item-title"><strong>${esc(p.project)}</strong>${p.portalId ? pill('Portaldan', 'muted') : ''}</span>
          <small>${esc([p.customer, cvPeriod(p), p.role, p.sector].filter(Boolean).join(' · '))}</small>
          ${textLines(p.work).length ? `<ul class="cv-work">${textLines(p.work).map(x => `<li>${esc(x.replace(/^[-–•]\s*/, ''))}</li>`).join('')}</ul>`
            : '<span class="warn-text small-text">Sorumluluklar yazılmadı</span>'}`,
          imports ? `<button class="btn ghost sm" data-cv-import>${icon('clock', 15)} Portaldan ekle (${imports})</button>` : '')}
        ${cvListCard('jobs', 'İş deneyimi', r.jobs.slice().sort(byNewest), j => `<strong>${esc(j.company)}</strong><small>${esc(`${j.title} · ${cvPeriod(j)}`)}</small>`, '', bisolera)}
        ${cvListCard('education', 'Eğitim', r.education, e => `<strong>${esc(e.school)}</strong>
          <small>${esc([e.department, CV_DEGREES[e.degree]?.[0], [e.from, e.to].filter(Boolean).join('–')].filter(Boolean).join(' · '))}</small>`)}
        ${cvListCard('courses', 'Kurslar ve eğitimler', r.courses, c => `<strong>${esc(c.name)}</strong>${c.detail ? `<small>${esc(c.detail)}</small>` : ''}`)}
        <section class="card section-gap">
          <div class="card-head"><h2>Sertifikalar</h2><button class="btn ghost sm" data-mode="ben">Profil'de düzenle</button></div>
          <p class="muted small-text">Profil sekmesindeki geçerli sertifikalar CV'ye kendiliğinden girer.${certs.length ? '' : ' Şu an geçerli sertifika yok.'}</p>
          ${certs.length ? `<ul class="cv-work">${certs.map(c => `<li>${esc(c.name)}${c.issued ? ` <span class="faint">· ${fmtMonthInput(c.issued.slice(0, 7))}</span>` : ''}</li>`).join('')}</ul>` : ''}
        </section>`;
    }

    // Proje, iş, eğitim, kurs listeleri: her satırda düzenle / sil
    function cvListCard(kind, title, items, line, extra = '', lead = '') {
      const K = CV_KINDS[kind], edit = canEdit();
      const rows = lead + items.map(it => `<div class="cv-item" data-cv-item="${it.id}"><div class="cv-item-main">${line(it)}</div>
        ${edit ? `<div class="cv-item-actions"><button class="icon-btn sm" data-cv-edit title="Düzenle" aria-label="Düzenle">${icon('pencil', 15)}</button>
          <button class="icon-btn sm" data-cv-del title="Sil" aria-label="Sil">${icon('trash', 15)}</button></div>` : ''}</div>`).join('');
      return `<section class="card section-gap" data-cv-list="${kind}">
        <div class="card-head"><h2>${title}</h2>${edit ? `<div class="row-gap">${extra}<button class="btn ghost sm" data-cv-add="${kind}">${icon('plus', 15)} ${K.add}</button></div>` : ''}</div>
        ${rows ? `<div class="cv-items">${rows}</div>` : emptyState(K.icon, K.empty, edit ? K.emptyHint : '')}
      </section>`;
    }

    const cvStatusHtml = u => {
      const miss = cvMissing(u);
      return miss.length ? `<div class="callout warn">${icon('alert', 16)}<div><strong>CV'de eksik:</strong> ${esc(miss.join(', '))}</div></div>`
        : `<div class="callout ok">${icon('check', 16)}<div>CV tamam. "CV'yi al" ile PDF ya da Word olarak indirebilirsin.</div></div>`;
    };
    const refreshCvStatus = () => { const box = body.querySelector('[data-cv-status]'); if (box) box.innerHTML = cvStatusHtml(Store.user(personId)); };
    // Ekip matrisinde: CV tamamsa işaret, değilse eksik sayısı (üstüne gelince ne eksik)
    const cvCell = u => {
      const miss = cvMissing(u);
      return miss.length ? `<span class="cv-miss" title="${esc(`CV'de eksik: ${miss.join(', ')}`)}">${miss.length} eksik</span>`
        : `<span class="cv-yes" title="CV tamam">${icon('check', 14)}</span>`;
    };

    // Alan değişince hemen kaydedilir; sayfa yeniden çizilmez, yoksa Tab ile sonraki alana geçerken imleç kaybolurdu
    function saveCvField(field) {
      const key = field.dataset.cvField;
      let value = field.value.trim();
      if (key === 'areas') value = textLines(value).join('\n');
      if (key === 'birthDate' && value && (value > todayISO() || value < '1940-01-01')) return toast('Doğum tarihi geçerli değil', { tone: 'danger' });
      saveResume(personId, { [key]: value });
      if (key === 'headline') body.querySelector('[data-cv-headline]').textContent = value || Store.user(personId).title;
      refreshCvStatus();
      toast('Kaydedildi');
    }

    function handleCvClick(t) {
      const u = Store.user(personId), redraw = () => { if (mode === 'cv') renderCv(); };
      if (t.hasAttribute('data-cv-export')) return openCvDialog(u);
      if (!canEdit()) return;
      if (t.dataset.cvAdd) return cvItemModal(u.id, t.dataset.cvAdd, null, redraw);
      if (t.hasAttribute('data-cv-import')) return cvPortalImportModal(u, redraw);
      if (t.hasAttribute('data-cv-areas')) {
        const box = body.querySelector('[data-cv-field="areas"]'), have = textLines(box.value), all = skillAreaLines(u);
        const add = all.filter(x => !have.some(h => h.toLocaleLowerCase('tr') === x.toLocaleLowerCase('tr')));
        if (!add.length) return toast(all.length ? 'Yetkinliklerin zaten listede' : 'Profil sekmesinde Orta ya da Uzman seviyede yetkinlik yok', { tone: 'info' });
        box.value = [...have, ...add].join('\n');
        return saveCvField(box);
      }
      const kind = t.closest('[data-cv-list]')?.dataset.cvList, id = t.closest('[data-cv-item]')?.dataset.cvItem;
      const list = resumeOf(u)[kind] || [], item = list.find(x => x.id === id);
      if (!item) return;
      if (t.hasAttribute('data-cv-edit')) return cvItemModal(u.id, kind, item, redraw);
      const at = list.indexOf(item);
      saveResume(u.id, { [kind]: list.filter(x => x !== item) });
      redraw();
      toast(`${item.project || item.company || item.school || item.name} silindi`, { tone: 'info', action: { label: 'Geri al', fn: () => {
        const now = resumeOf(Store.user(u.id))[kind].slice();
        now.splice(at, 0, item);
        saveResume(u.id, { [kind]: now });
        redraw();
      } } });
    }

    /* ---------- Ekip matrisi: satır = kişi, sütun = yetkinlik ---------- */

    function renderMatrix() {
      const users = Store.users().filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const hoursBy = Object.fromEntries(users.map(u => [u.id, skillHours(u.id)]));
      const count = (s, min) => users.filter(u => (u.skills?.[s.id] || 0) >= min).length;
      body.innerHTML = `<section class="card">
        <div class="card-head"><div><h2>Ekip matrisi</h2><p class="sub">Kutunun üstüne gelince seviye ve son 12 aydaki saat görünür. Bir kişiye tıkla, profiline git.</p></div></div>
        <div class="table-wrap"><table class="table skill-matrix">
          <thead><tr><th class="sticky-col">Danışman</th>${SKILLS.map(s => `<th class="sm-col" title="${esc(s.name)}">${esc(s.short)}</th>`).join('')}<th class="num">Sertifika</th><th class="sm-col">CV</th></tr></thead>
          <tbody>${users.map(u => {
            const certs = Store.certs({ userId: u.id }), bad = certs.filter(c => ['yakinda', 'doldu'].includes(certStatus(c))).length;
            return `<tr data-person-row="${u.id}">
              <td class="sticky-col"><span class="cell-user">${avatar(u, 26)}<strong>${esc(u.name)}</strong></span></td>
              ${SKILLS.map(s => {
                const n = u.skills?.[s.id] || 0, h = hoursBy[u.id][s.id] || 0;
                return `<td class="sm-col"><span class="lvl lvl-${n}" title="${esc(`${s.name} · ${SKILL_LEVELS[n]}${h ? ` · ${fmtNum(h)} sa (12 ay)` : ''}`)}">${n ? n : h ? '·' : ''}</span></td>`;
              }).join('')}
              <td class="num nowrap">${certs.length ? `${certs.length}${bad ? ` ${pill(`${bad} uyarı`, 'warn')}` : ''}` : '<span class="faint">—</span>'}</td>
              <td class="sm-col nowrap" data-cv-col>${cvCell(u)}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr><td class="sticky-col muted">Uzman / orta ve üstü</td>${SKILLS.map(s => {
            const expert = count(s, 3), mid = count(s, 2);
            return `<td class="sm-col${!mid ? ' gap' : ''}" title="${esc(`${s.name}: ${expert} uzman, ${mid} orta ve üstü`)}">${expert}/${mid}</td>`;
          }).join('')}<td></td><td></td></tr></tfoot>
        </table></div>
        <div class="heat-legend"><span><i class="lvl lvl-1">1</i>Temel</span><span><i class="lvl lvl-2">2</i>Orta</span><span><i class="lvl lvl-3">3</i>Uzman</span><span><i class="lvl lvl-0">·</i>Seviye yok ama saat var</span><span><i class="gap-key"></i>Orta ve üstü kimse yok</span><span><span class="cv-yes">${icon('check', 14)}</span>CV tamam (değilse eksik sayısı)</span></div>
      </section>`;
    }

    /* ---------- Uygun danışman ---------- */

    function renderSearch() {
      const rows = findConsultants(search);
      const chosen = search.skills.map(id => SKILLS.find(s => s.id === id));
      body.innerHTML = `<section class="card">
        <div class="card-head"><div><h2>Uygun danışman bul</h2><p class="sub">Seçtiğin yetkinliklerin hepsinde istenen seviyede olanlar; seviye toplamı ve son 12 aydaki deneyime göre sıralı.</p></div></div>
        <div class="field"><span class="field-label">Yetkinlikler</span>
          <div class="chips">${SKILLS.map(s => `<label class="chip"><input type="checkbox" data-search-skill value="${s.id}"${search.skills.includes(s.id) ? ' checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div></div>
        <div class="search-opts">
          <div class="field"><span class="field-label">En az seviye</span>
            <div class="lvl-seg">${[1, 2, 3].map(n => `<button class="${search.minLevel === n ? 'is-active' : ''}" data-min-level="${n}">${SKILL_LEVELS[n]}</button>`).join('')}</div></div>
          <label class="toggle"><input type="checkbox" data-cert-required${search.certRequired ? ' checked' : ''}> İlgili yetkinlikte geçerli sertifikası olsun</label>
          <label class="toggle"><input type="checkbox" data-available${search.available ? ' checked' : ''}> Bu ay müsait (doluluk %${Math.round(UTILIZATION_TARGET * 100)} altında)</label>
        </div>
      </section>
      <section class="card section-gap">
        ${!chosen.length ? emptyState('search', 'Yetkinlik seç', 'Örn. SAP Datasphere + SAC raporlama, en az Orta.')
          : rows.length ? `<div class="card-head"><h2>${rows.length} danışman uyuyor</h2></div><div class="table-wrap"><table class="table">
            <thead><tr><th>Danışman</th>${chosen.map(s => `<th>${esc(s.name)}</th>`).join('')}<th class="num">Deneyim (12 ay)</th>${search.available ? '<th class="num">Bu ay doluluk</th>' : ''}<th></th></tr></thead>
            <tbody>${rows.map(r => `<tr data-person-row="${r.user.id}">
              <td><span class="cell-user">${avatar(r.user, 30)}<span><strong>${esc(r.user.name)}</strong><small>${esc(r.user.title)}</small></span></span></td>
              ${r.levels.map((n, i) => `<td class="nowrap"><span class="lvl lvl-${n}">${n}</span> ${SKILL_LEVELS[n]}${r.certs[i] ? ` <span class="cert-ok" title="${esc(r.certs[i].name)}">${icon('shield', 13)} sertifikalı</span>` : ''}</td>`).join('')}
              <td class="num">${fmtNum(r.hours)} sa</td>
              ${search.available ? `<td class="num">%${Math.round(r.util.pct * 100)}</td>` : ''}
              <td class="num nowrap"><button class="btn ghost sm" data-cv-of="${r.user.id}">${icon('download', 15)} CV</button></td>
            </tr>`).join('')}</tbody>
          </table></div>`
          : emptyState('users', 'Bu şartlara uyan danışman yok', 'Seviyeyi düşürmeyi ya da bir yetkinliği çıkarmayı dene.')}
      </section>`;
    }

    /* ---------- Olaylar ---------- */

    el.addEventListener('click', e => {
      const cv = e.target.closest('[data-cv-export], [data-cv-add], [data-cv-edit], [data-cv-del], [data-cv-import], [data-cv-areas]');
      if (cv) return handleCvClick(cv);
      const t = e.target.closest('[data-mode], [data-level], [data-cv-of], [data-add-cert], [data-edit-cert], [data-del-cert], [data-min-level], [data-person-row]');
      if (!t) return;
      if (t.dataset.mode) { mode = t.dataset.mode; setHash(); return render(); }
      if (t.dataset.level && canEdit()) {
        const u = Store.user(personId), skills = { ...(u.skills || {}) }, id = t.closest('[data-skill]').dataset.skill, n = Number(t.dataset.level);
        if (n) skills[id] = n; else delete skills[id];
        Store.updateUser(u.id, { skills });
        return renderProfile();
      }
      if (t.dataset.cvOf) return openCvDialog(Store.user(t.dataset.cvOf));
      if (t.hasAttribute('data-add-cert')) return certModal(null, personId, render);
      const certRow = t.closest('[data-cert]');
      if (certRow && t.hasAttribute('data-edit-cert')) return certModal(Store.certs().find(c => c.id === certRow.dataset.cert), personId, render);
      if (certRow && t.hasAttribute('data-del-cert')) {
        const removed = Store.deleteCert(certRow.dataset.cert);
        render();
        return toast(`${removed.name} silindi`, { tone: 'info', action: { label: 'Geri al', fn: () => { Store.addCert(removed); render(); } } });
      }
      if (t.dataset.minLevel) { search.minLevel = Number(t.dataset.minLevel); return renderSearch(); }
      if (admin && t.dataset.personRow) { personId = t.dataset.personRow; mode = 'ben'; setHash(); return render(); }
    });

    el.addEventListener('change', e => {
      if (admin && e.target.matches('[data-person]')) { personId = e.target.value; setHash(); return render(); }
      if (e.target.matches('[data-summary]') && canEdit()) {
        Store.updateUser(personId, { summary: e.target.value.trim() });
        refreshCvStatus();
        return toast('Profil yazısı kaydedildi');
      }
      if (e.target.matches('[data-cv-field]') && canEdit()) return saveCvField(e.target);
      if (e.target.matches('[data-search-skill]')) search.skills = [...el.querySelectorAll('[data-search-skill]:checked')].map(x => x.value);
      else if (e.target.matches('[data-cert-required]')) search.certRequired = e.target.checked;
      else if (e.target.matches('[data-available]')) search.available = e.target.checked;
      else return;
      renderSearch();
    });

    render();
  },
};

// "Bisolera'da 3 yıl" — CV ve profil başlığında
function tenureText(user, today = todayISO()) {
  const years = Math.floor(daysBetween(user.startDate, today) / 365.25);
  return years >= 1 ? `Bisolera'da ${years} yıl` : 'Bisolera\'da 1 yıldan az';
}

function certModal(cert, userId, onSave) {
  openModal({
    title: cert ? 'Sertifikayı düzenle' : 'Sertifika ekle',
    body: `<form class="form-stack" id="certForm" novalidate>
      <label class="field"><span class="field-label">Sertifika adı</span><input class="input" name="name" value="${esc(cert?.name || '')}" maxlength="100" placeholder="Örn. SAP Certified Associate – SAP Datasphere"></label>
      <div class="form-grid">
        <label class="field"><span class="field-label">Kod <span class="faint">(isteğe bağlı)</span></span><input class="input" name="code" value="${esc(cert?.code || '')}" maxlength="30"></label>
        <label class="field"><span class="field-label">İlgili yetkinlik</span>
          <select class="input" name="skillId"><option value="">—</option>${SKILLS.map(s => `<option value="${s.id}"${cert?.skillId === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">Alındığı tarih</span><input class="input" type="date" name="issued" value="${cert?.issued || ''}"></label>
        <label class="field"><span class="field-label">Geçerlilik bitişi <span class="faint">(süresizse boş)</span></span><input class="input" type="date" name="expires" value="${cert?.expires || ''}"></label>
      </div>
      <p class="muted small-text">Bitişe ${CERT_WARN_DAYS} gün kala Özet'te ve Yetkinlikler'de hatırlatılır. "Uygun danışman" aramasındaki sertifika şartı, ilgili yetkinliğe bakar.</p>
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="certForm">${cert ? 'Kaydet' : 'Ekle'}</button>`,
    onMount(m, close) {
      const f = m.querySelector('form'), el = f.elements;
      el.name.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const data = { name: el.name.value.trim(), code: el.code.value.trim(), skillId: el.skillId.value || null, issued: el.issued.value || null, expires: el.expires.value || null };
        if (!data.name) return formError(f, 'Sertifikanın adını yaz.', el.name);
        if (data.issued && data.expires && data.expires < data.issued) return formError(f, 'Geçerlilik bitişi alındığı tarihten önce olamaz.', el.expires);
        if (cert) Store.updateCert(cert.id, data); else Store.addCert({ userId, ...data });
        close();
        onSave();
        toast(cert ? 'Sertifika güncellendi' : `${data.name} eklendi`);
      });
    },
  });
}
