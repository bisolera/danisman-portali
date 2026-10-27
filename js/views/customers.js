/* Müşteriler & Projeler: danışman için rehber, yönetici için yönetim ekranı */

const CustomersView = {
  mount(el) {
    const me = App.user, admin = App.isAdmin();
    let q = '', status = 'aktif';
    const FILTERS = [['aktif', 'Aktif'], ['beklemede', 'Beklemede'], ['tamamlandi', 'Tamamlanan'], ['hepsi', 'Tümü']];

    el.innerHTML = `
      <header class="page-head">
        <div><h1>Müşteriler & Projeler</h1><p>${admin ? 'Müşterileri ve projeleri buradan yönet. Aktif projeler aktivite girişinde seçilebilir.' : 'Aktivite girerken seçebileceğin müşteri ve projeler.'}</p></div>
        ${admin ? `<div class="row-gap"><button class="btn ghost" data-add-customer>${icon('plus', 16)} Müşteri</button><button class="btn primary" data-add-project>${icon('plus', 16)} Proje</button></div>` : ''}
      </header>
      <div class="toolbar">
        <div class="search">${icon('search', 16)}<input class="input" id="q" placeholder="Müşteri, proje veya kod ara…" autocomplete="off"></div>
        <div class="tabs" id="filter"></div>
      </div>
      <div class="cust-grid" id="list"></div>`;
    const listEl = el.querySelector('#list');

    function render() {
      el.querySelector('#filter').innerHTML = FILTERS.map(([k, label]) => `<button class="${k === status ? 'is-active' : ''}" data-filter="${k}">${label}</button>`).join('');
      const acts = admin ? Store.activities() : Store.activities({ userId: me.id });
      const hours = acts.reduce((m, a) => ((m[a.projectId] = (m[a.projectId] || 0) + a.hours), m), {});
      const terms = fold(q).split(/\s+/).filter(Boolean);
      const customers = Store.customers().slice()
        .sort((a, b) => (a.internal ? 1 : 0) - (b.internal ? 1 : 0) || a.name.localeCompare(b.name, 'tr'));

      const cards = customers.map(c => {
        const nameHit = terms.length > 0 && terms.every(t => fold(c.name).includes(t));
        const projects = Store.projects({ customerId: c.id }).filter(p =>
          (status === 'hepsi' || p.status === status) &&
          (!terms.length || nameHit || terms.every(t => fold(`${c.name} ${p.name} ${p.code}`).includes(t))));
        // Yönetici "Tümü"nde projesi olmayan müşteriyi de görsün ki proje ekleyebilsin
        if (!projects.length && !(admin && status === 'hepsi' && (!terms.length || nameHit))) return '';
        const activeCount = Store.projects({ customerId: c.id, activeOnly: true }).length;
        return `<article class="card">
          <header class="cust-head">
            <span class="cust-logo" style="background:${c.color}">${esc(c.name[0])}</span>
            <div class="grow min0"><h3>${esc(c.name)}</h3><small class="muted">${c.sector ? esc(c.sector) + ' · ' : ''}${activeCount} aktif proje</small></div>
            ${admin ? `<button class="icon-btn sm" data-edit-customer="${c.id}" title="Müşteriyi düzenle" aria-label="Müşteriyi düzenle">${icon('pencil', 15)}</button>` : ''}
          </header>
          ${projects.length ? projects.map(p => `<div class="proj-row">
              <div class="min0">
                <div class="proj-name">${esc(p.name)}</div>
                <div class="proj-meta"><span class="code">${esc(p.code)}</span>${p.billable ? '' : '<span class="tag">İç proje</span>'}<span>${admin ? 'Ekip' : 'Sen'}: ${fmtHours(hours[p.id] || 0)}</span>${p.skills?.length ? `<span class="faint">${esc(p.skills.map(id => SKILLS.find(s => s.id === id)?.short || id).join(' · '))}</span>` : ''}</div>
                ${budgetBar(p)}
              </div>
              ${projectStatusPill(p.status)}
              ${admin ? `<button class="icon-btn sm" data-edit-project="${p.id}" title="Projeyi düzenle" aria-label="Projeyi düzenle">${icon('pencil', 15)}</button>` : ''}
            </div>`).join('') : '<p class="faint pad">Bu filtrede proje yok</p>'}
        </article>`;
      }).join('');
      listEl.innerHTML = cards || emptyState('search', 'Sonuç bulunamadı', 'Aramayı ya da filtreyi değiştirmeyi dene.');
    }

    el.querySelector('#q').addEventListener('input', e => { q = e.target.value; render(); });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-filter], [data-add-customer], [data-add-project], [data-edit-customer], [data-edit-project]');
      if (!t) return;
      if (t.dataset.filter) { status = t.dataset.filter; render(); }
      else if (t.hasAttribute('data-add-customer')) customerModal(null, render);
      else if (t.hasAttribute('data-add-project')) projectModal(null, render);
      else if (t.dataset.editCustomer) customerModal(Store.customer(t.dataset.editCustomer), render);
      else if (t.dataset.editProject) projectModal(Store.project(t.dataset.editProject), render);
    });
    render();
  },
};

// Bu ayın sözleşme saati kullanımı (ekip toplamı); sözleşme saati girilmemiş projede gösterilmez
function budgetBar(p) {
  const b = budgetState(p, todayISO());
  if (!b) return '';
  return `<div class="budget budget-${b.tone}" title="${esc(monthTitle(todayISO()))} sözleşme kullanımı">
    <div class="meter"><span style="width:${Math.min(100, b.pct)}%"></span></div>
    <span>Bu ay ${fmtNum(b.used)} / ${fmtNum(b.budget)} sa${b.pct >= 100 ? ' · aşıldı' : b.pct >= 80 ? ' · %80 geçti' : ''}</span>
  </div>`;
}

function customerModal(c, onSave) {
  openModal({
    title: c ? 'Müşteriyi düzenle' : 'Yeni müşteri',
    body: `<form class="form-stack" id="customerForm" novalidate>
      <label class="field"><span class="field-label">Müşteri adı</span><input class="input" name="name" value="${esc(c?.name || '')}" maxlength="80"></label>
      <label class="field"><span class="field-label">Sektör</span><input class="input" name="sector" value="${esc(c?.sector || '')}" maxlength="60" placeholder="Örn. Perakende"></label>
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="customerForm">Kaydet</button>`,
    onMount(m, close) {
      const f = m.querySelector('form');
      f.elements.name.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = f.elements.name.value.trim();
        if (!name) return formError(f, 'Müşteri adı zorunlu.', f.elements.name);
        const data = { name, sector: f.elements.sector.value.trim() };
        if (c) Store.updateCustomer(c.id, data); else Store.addCustomer(data);
        close();
        onSave();
        toast(c ? 'Müşteri güncellendi' : 'Müşteri eklendi');
      });
    },
  });
}

function projectModal(p, onSave) {
  const customers = Store.customers().slice().sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  openModal({
    title: p ? 'Projeyi düzenle' : 'Yeni proje',
    body: `<form class="form-stack" id="projectForm" novalidate>
      <label class="field"><span class="field-label">Müşteri</span>
        <select class="input" name="customerId">${customers.map(c => `<option value="${c.id}"${p?.customerId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">Proje adı</span><input class="input" name="name" value="${esc(p?.name || '')}" maxlength="80" placeholder="Örn. SAC Planlama"></label>
      <div class="form-grid">
        <label class="field"><span class="field-label">Proje kodu</span><input class="input" name="code" value="${esc(p?.code || '')}" maxlength="16" placeholder="ABC-SAC"></label>
        <label class="field"><span class="field-label">Durum</span>
          <select class="input" name="status">${Object.entries(PROJECT_STATUS).map(([k, s]) => `<option value="${k}"${(p?.status || 'aktif') === k ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label>
      </div>
      <label class="toggle"><input type="checkbox" name="billable"${p?.billable === false ? '' : ' checked'}> Müşteriye faturalanır</label>
      <label class="field"><span class="field-label">Aylık sözleşme saati <span class="faint">(isteğe bağlı; destek paketi gibi)</span></span>
        <input class="input" name="monthlyBudget" type="number" min="0" max="2000" step="1" value="${p?.monthlyBudget || ''}" placeholder="Örn. 80"></label>
      <div class="field"><span class="field-label">Yetkinlikler <span class="faint">(bu projede çalışılan saat, danışmanın deneyimine sayılır)</span></span>
        <div class="chips">${SKILLS.map(s => `<label class="chip"><input type="checkbox" name="skills" value="${s.id}"${p?.skills?.includes(s.id) ? ' checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div></div>
      <p class="form-error" hidden></p>
    </form>`,
    footer: `<span class="grow"></span><button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" type="submit" form="projectForm">Kaydet</button>`,
    onMount(m, close) {
      const f = m.querySelector('form');
      (p ? f.elements.name : f.elements.customerId).focus();
      f.elements.code.addEventListener('input', e => { e.target.value = e.target.value.toLocaleUpperCase('tr'); });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = f.elements.name.value.trim(), code = f.elements.code.value.trim();
        if (!name) return formError(f, 'Proje adı zorunlu.', f.elements.name);
        if (!code) return formError(f, 'Proje kodu zorunlu.', f.elements.code);
        if (Store.projects().some(x => x.id !== p?.id && x.code.toLowerCase() === code.toLowerCase())) return formError(f, 'Bu kod başka bir projede kullanılıyor.', f.elements.code);
        const budget = Number(f.elements.monthlyBudget.value);
        if (f.elements.monthlyBudget.value && !(budget > 0 && budget <= 2000)) return formError(f, 'Sözleşme saati 1–2000 arasında olmalı ya da boş bırakılmalı.', f.elements.monthlyBudget);
        const skills = [...f.querySelectorAll('[name=skills]:checked')].map(x => x.value);
        const data = { customerId: f.elements.customerId.value, name, code, status: f.elements.status.value, billable: f.elements.billable.checked, monthlyBudget: budget || null, skills };
        if (p) Store.updateProject(p.id, data); else Store.addProject(data);
        close();
        onSave();
        toast(p ? 'Proje güncellendi' : 'Proje eklendi');
      });
    },
  });
}
