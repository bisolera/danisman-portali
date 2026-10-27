/* İzinler: bakiye, talep formu, taleplerim, ekipte kim izinli */

const LeaveView = {
  mount(el) {
    const me = App.user, today = todayISO();
    el.innerHTML = `
      <header class="page-head"><div><h1>İzinler</h1><p>Bakiyeni gör, talebini birkaç saniyede ilet.</p></div></header>
      <section class="grid balance" id="balance"></section>
      <div class="grid two-col section-gap">
        <div class="stack">
          <section class="card" id="mine"></section>
          <section class="card" id="team"></section>
        </div>
        <section class="card sticky" id="request"></section>
      </div>`;

    function renderBalance() {
      const b = leaveBalance(me);
      const cards = [
        ['Yıllık izin hakkı', b.total, `${parseISO(today).getFullYear()} yılı`],
        ['Kullanılan', fmtNum(b.used), 'Onaylanmış yıllık izin'],
        ['Onay bekleyen', fmtNum(b.pending), b.pending ? 'Yöneticinde bekliyor' : 'Bekleyen talep yok'],
        ['Kalan', fmtNum(b.remaining), b.pending ? `Onaylar sonrası ${fmtNum(b.remaining - b.pending)} gün` : 'Kullanılabilir', true],
      ];
      el.querySelector('#balance').innerHTML = cards.map(([label, val, sub, main]) =>
        `<div class="card bal${main ? ' is-main' : ''}"><span class="bal-label">${label}</span><span class="bal-val">${val}<small> gün</small></span><span class="bal-sub">${esc(sub)}</span></div>`).join('');
    }

    function renderMine() {
      const list = Store.leaves({ userId: me.id }).slice().sort((a, b) => b.start.localeCompare(a.start));
      el.querySelector('#mine').innerHTML = `
        <div class="card-head"><h2>Taleplerim</h2><span class="muted">${list.length} kayıt</span></div>
        ${list.length ? list.map(l => leaveRow(l, { actions: l.status === 'beklemede' ? '<button class="btn ghost sm" data-cancel>İptal et</button>' : '' })).join('')
          : emptyState('sun', 'Henüz izin talebin yok', 'Formdan ilk talebini oluşturabilirsin.')}`;
    }

    function renderTeam() {
      const end = addDays(today, 60);
      const others = Store.leaves()
        .filter(l => l.userId !== me.id && (l.status === 'onaylandi' || l.status === 'beklemede') && l.end >= today && l.start <= end)
        .sort((a, b) => a.start.localeCompare(b.start));
      const holidays = HOLIDAYS.filter(h => h.date >= today).slice(0, 4);
      el.querySelector('#team').innerHTML = `
        <div class="card-head"><h2>Ekipte kim izinli?</h2><span class="muted">Önümüzdeki 60 gün</span></div>
        ${others.length ? others.map(l => leaveRow(l, { user: Store.user(l.userId), showDetails: App.isAdmin() })).join('')
          : emptyState('users', 'Yakın zamanda ekipte izin yok')}
        <div class="sub-head">Yaklaşan resmi tatiller</div>
        <div class="hol-list">${holidays.map(h => `<span class="hol"><b>${fmtShort(h.date)}</b> ${esc(h.name)}${h.half ? ' <em>(yarım gün)</em>' : ''}</span>`).join('')}</div>`;
    }

    // ---- Talep formu ----
    const req = el.querySelector('#request');
    const first = nextWorkday(today);
    req.innerHTML = `
      <div class="card-head"><h2>Yeni izin talebi</h2></div>
      <form class="form-stack" novalidate>
        <div class="field"><span class="field-label">İzin türü</span>
          <div class="seg">${LEAVE_TYPES.map((t, i) => `<input type="radio" name="type" id="lt-${t.id}" value="${t.id}"${i ? '' : ' checked'}><label for="lt-${t.id}">${esc(t.name)}</label>`).join('')}</div>
        </div>
        <div class="form-grid">
          <label class="field"><span class="field-label">Başlangıç</span><input class="input" type="date" name="start" value="${first}"></label>
          <label class="field"><span class="field-label">Bitiş</span><input class="input" type="date" name="end" value="${first}"></label>
        </div>
        <label class="toggle" data-half><input type="checkbox" name="half"> Yarım gün</label>
        <label class="field"><span class="field-label">Not <span class="faint">(isteğe bağlı)</span></span>
          <textarea class="input" name="note" rows="2" maxlength="300" placeholder="Yöneticine iletmek istediğin bir not"></textarea></label>
        <div class="calc" data-calc></div>
        <button class="btn primary block lg" type="submit">Talebi gönder</button>
      </form>`;
    const f = req.querySelector('form'), calcEl = f.querySelector('[data-calc]'), halfWrap = f.querySelector('[data-half]');

    // Formdaki seçime göre gün sayısını hesaplar; gönderime engel bir sorun varsa error döner
    function evaluate() {
      const type = f.elements.type.value, start = f.elements.start.value, end = f.elements.end.value;
      const single = !!start && start === end;
      halfWrap.hidden = !single;
      if (!single) f.elements.half.checked = false;
      if (!start || !end) return { error: 'Başlangıç ve bitiş tarihini seç.' };
      if (end < start) return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
      const draft = { type, start, end, halfDay: f.elements.half.checked };
      const days = leaveDays(draft);
      const result = { ...draft, days };
      if (!(days > 0)) return { ...result, error: 'Seçtiğin aralıkta iş günü yok.' };
      const clash = overlappingLeave(me.id, start, end);
      if (clash) return { ...result, error: `Bu tarihlerde zaten bir talebin var (${fmtRange(clash.start, clash.end)}).` };
      if (type === 'yillik') {
        const b = leaveBalance(me), available = b.remaining - b.pending;
        if (days > available) return { ...result, error: `Bakiyen yetersiz: kullanılabilir ${fmtNum(available)} gün.` };
        result.info = `talep sonrası kalan ${fmtNum(available - days)} gün`;
      }
      return result;
    }

    function renderCalc() {
      const r = evaluate();
      if (r.error) {
        calcEl.className = 'calc err';
        calcEl.innerHTML = `${icon('alert', 16)}<span>${esc(r.error)}</span>`;
      } else {
        calcEl.className = 'calc';
        calcEl.innerHTML = `${icon('calendar', 16)}<span><strong>${fmtNum(r.days)} iş günü</strong> · ${r.info ? esc(r.info) : 'bakiyeden düşmez'}</span>`;
      }
      return r;
    }

    const onFormChange = e => {
      if (e.target.name === 'start' && f.elements.end.value < f.elements.start.value) f.elements.end.value = f.elements.start.value;
      renderCalc();
    };
    f.addEventListener('input', onFormChange);
    f.addEventListener('change', onFormChange);

    f.addEventListener('submit', e => {
      e.preventDefault();
      const r = renderCalc();
      if (r.error) {
        calcEl.classList.remove('shake'); void calcEl.offsetWidth; calcEl.classList.add('shake');
        return;
      }
      Store.addLeave({ userId: me.id, type: r.type, start: r.start, end: r.end, halfDay: r.halfDay, note: f.elements.note.value.trim() });
      f.elements.note.value = '';
      const approver = Store.users().find(u => u.role === 'admin' && u.active && u.id !== me.id);
      toast(approver ? `Talebin iletildi · Onaylayacak: ${approver.name}` : 'Talebin onaya gönderildi');
      refresh();
      App.refreshBadges();
    });

    el.querySelector('#mine').addEventListener('click', e => {
      if (!e.target.closest('[data-cancel]')) return;
      const id = e.target.closest('[data-id]').dataset.id;
      Store.updateLeave(id, { status: 'iptal' });
      refresh();
      App.refreshBadges();
      toast('Talep iptal edildi', { tone: 'info', action: { label: 'Geri al', fn: () => { Store.updateLeave(id, { status: 'beklemede' }); refresh(); App.refreshBadges(); } } });
    });

    function refresh() { renderBalance(); renderMine(); renderTeam(); renderCalc(); }
    refresh();
  },
};
