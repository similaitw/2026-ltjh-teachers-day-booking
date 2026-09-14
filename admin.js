(() => {
  const cfg = window.BOOKING_CONFIG;
  const slots = [];
  for (let t = 13 * 60; t < 16 * 60; t += 15) slots.push(`${fmt(t)}–${fmt(t+15)}`);
  function fmt(n){return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}

  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('adminDashboard');
  const loginForm = document.getElementById('adminLoginForm');
  const loginStatus = document.getElementById('loginStatus');

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store'
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok || !data.ok) {
      const err = new Error(data.message || '操作失敗');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function load(){
    try {
      const qs = new URLSearchParams({ eventId: cfg.eventId });
      const data = await fetchJson(`/api/admin-list?${qs.toString()}`, { method: 'GET' });
      loginPanel.classList.add('hidden');
      dashboard.classList.remove('hidden');
      render(data.rows || []);
    } catch (e) {
      if (e.status === 401) {
        dashboard.classList.add('hidden');
        loginPanel.classList.remove('hidden');
        return;
      }
      alert(e.message);
    }
  }

  function render(sourceRows){
    const rows = sourceRows.slice().sort((a,b) => {
      const slotDiff = slots.indexOf(a.slot) - slots.indexOf(b.slot);
      if (slotDiff !== 0) return slotDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
    });

    const booked = rows.length; const total = slots.length * cfg.capacityPerSlot;
    document.getElementById('bookedCount').textContent = booked;
    document.getElementById('remainingCount').textContent = total - booked;
    document.getElementById('slotTable').innerHTML = slots.map(s=>{
      const r = rows.filter(x=>x.slot===s); const left = cfg.capacityPerSlot-r.length;
      return `<tr><td><b>${s}</b></td><td>${r.length} / ${cfg.capacityPerSlot}</td><td>${left}</td><td>${r.length ? r.map(x=>escapeHtml(x.name)).join('、') : '<span class="empty-cell">—</span>'}</td></tr>`;
    }).join('');

    document.getElementById('bookingTableBody').innerHTML = rows.length ? rows.map((r, idx) => {
      const slotOptions = slots.map(slot => {
        const current = slot === r.slot;
        const remaining = Math.max(0, cfg.capacityPerSlot - rows.filter(row => row.slot === slot).length);
        return `<option value="${escapeHtml(slot)}" ${current ? 'selected' : ''} ${!current && remaining === 0 ? 'disabled' : ''}>${escapeHtml(slot)}（${current ? '目前時段' : remaining === 0 ? '已額滿' : `剩 ${remaining} 名`}）</option>`;
      }).join('');
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td><b>${escapeHtml(r.slot)}</b></td>
        <td>${formatDate(r.createdAt)}</td>
        <td><div class="admin-edit-slot"><select data-slot-for="${escapeHtml(r.id)}">${slotOptions}</select><button type="button" class="admin-edit-button" data-booking-id="${escapeHtml(r.id)}">更新</button></div></td>
        <td><button type="button" class="danger-btn" data-cancel-id="${escapeHtml(r.id)}">取消預約</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7" class="empty-cell">目前尚無預約資料</td></tr>`;
    document.getElementById('bookingTableBody').querySelectorAll('[data-booking-id]').forEach(button => {
      button.addEventListener('click', () => changeSlot(button.dataset.bookingId));
    });
    window.__rows = rows;
    document.getElementById('bookingTableBody').querySelectorAll('[data-cancel-id]').forEach(button => {
      button.addEventListener('click', () => cancelBooking(button.dataset.cancelId));
    });
  }

  function setRowBusy(bookingId, busy) {
    const button = document.querySelector(`[data-booking-id="${bookingId}"]`);
    button?.closest('tr').querySelectorAll('button, select').forEach(control => { control.disabled = busy; });
  }

  async function cancelBooking(bookingId) {
    const booking = (window.__rows || []).find(row => row.id === bookingId);
    if (!booking || !confirm(`確定取消「${booking.name}」老師 ${booking.slot} 的預約嗎？取消後將釋出名額。`)) return;
    setRowBusy(bookingId, true);
    try {
      await fetchJson('/api/admin-cancel', {
        method: 'POST',
        body: JSON.stringify({ eventId: cfg.eventId, bookingId })
      });
      await load();
    } catch (err) {
      alert(err.message);
      await load();
    } finally {
      setRowBusy(bookingId, false);
    }
  }

  async function changeSlot(bookingId) {
    const select = document.querySelector(`[data-slot-for="${bookingId}"]`);
    if (!select) return;
    setRowBusy(bookingId, true);
    try {
      await fetchJson('/api/admin-change', {
        method: 'POST',
        body: JSON.stringify({ eventId: cfg.eventId, bookingId, slot: select.value })
      });
      await load();
    } catch (err) {
      alert(err.message);
      await load();
    } finally {
      setRowBusy(bookingId, false);
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginStatus.textContent = '';
    const button = loginForm.querySelector('button');
    button.disabled = true;
    try {
      await fetchJson('/api/admin-login', {
        method: 'POST',
        body: JSON.stringify({ password: document.getElementById('adminPassword').value })
      });
      document.getElementById('adminPassword').value = '';
      await load();
    } catch (err) {
      loginStatus.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('refreshBtn').onclick=()=>load();
  document.getElementById('logoutBtn').onclick=async()=>{
    await fetchJson('/api/admin-logout', { method: 'POST', body: '{}' });
    dashboard.classList.add('hidden');
    loginPanel.classList.remove('hidden');
  };
  document.getElementById('exportBtn').onclick=()=>{
    const rows=window.__rows||[]; const head=['姓名','Email','時段','建立時間'];
    const csv=[head,...rows.map(r=>[r.name,r.email,r.slot,r.createdAt||''])].map(a=>a.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='教師節按摩預約名單.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  function formatDate(v){
    if(!v) return '—';
    const d = new Date(v);
    if(Number.isNaN(d.getTime())) return escapeHtml(v);
    return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]||c));}

  load();
})();
