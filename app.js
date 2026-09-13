(() => {
  const cfg = window.BOOKING_CONFIG;
  const slots = buildSlots("13:00", "16:00", 15);
  const grid = document.getElementById("slotsGrid");
  const summaryPill = document.getElementById("summaryPill");
  const modal = document.getElementById("bookingModal");
  const closeModal = document.getElementById("closeModal");
  const selectedSlotEl = document.getElementById("selectedSlot");
  const form = document.getElementById("bookingForm");
  const formStatus = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const toast = document.getElementById("toast");
  const myBookingCard = document.getElementById("myBookingCard");
  let selectedSlot = null;
  let state = { counts: {}, booking: null };

  const manageTokenKey = `${cfg.eventId}:manage-token`;

  function buildSlots(start, end, minutes) {
    const result = [];
    let [h, m] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let current = h * 60 + m;
    const stop = eh * 60 + em;
    while (current < stop) {
      const next = current + minutes;
      result.push(`${fmt(current)}–${fmt(next)}`);
      current = next;
    }
    return result;
  }

  function fmt(total) {
    return `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
  }

  async function request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      cache: "no-store"
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok || !data.ok) throw new Error(data.message || "操作失敗");
    return data;
  }

  async function api(action, payload = {}) {
    const manageToken = localStorage.getItem(manageTokenKey) || "";
    if (action === "status") {
      const qs = new URLSearchParams({ eventId: cfg.eventId });
      if (manageToken) qs.set("manageToken", manageToken);
      return request(`/api/status?${qs.toString()}`, { method: "GET" });
    }
    if (action === "book") {
      return request("/api/book", { method: "POST", body: JSON.stringify({ eventId: cfg.eventId, ...payload }) });
    }
    if (action === "change") {
      return request("/api/change", { method: "POST", body: JSON.stringify({ eventId: cfg.eventId, manageToken, ...payload }) });
    }
    if (action === "cancel") {
      return request("/api/cancel", { method: "POST", body: JSON.stringify({ eventId: cfg.eventId, manageToken }) });
    }
    throw new Error("未知操作");
  }

  async function refresh() {
    try {
      const data = await api("status");
      state = { counts: data.counts || {}, booking: data.booking || null };
      render();
    } catch (e) {
      summaryPill.textContent = "暫時無法載入";
      showToast(e.message);
    }
  }

  function render() {
    const totalBooked = slots.reduce((sum, s) => sum + (state.counts[s] || 0), 0);
    const totalCapacity = slots.length * cfg.capacityPerSlot;
    summaryPill.textContent = `已預約 ${totalBooked} / ${totalCapacity}`;
    grid.innerHTML = slots.map(slot => {
      const used = state.counts[slot] || 0;
      const left = Math.max(0, cfg.capacityPerSlot - used);
      const full = left === 0;
      const cls = full ? "full" : left <= 2 ? "low" : "good";
      const label = full ? "已額滿" : `尚有 ${left} 名`;
      return `<article class="slot-card">
        <div class="slot-card-head">
          <div class="slot-time">${slot}</div>
          <div class="slot-icon" aria-hidden="true">💆</div>
        </div>
        <div class="slot-meta"><span>⏱ 15 分鐘</span><span>👥 ${used}/${cfg.capacityPerSlot}</span><span class="status ${cls}">${label}</span></div>
        <button class="slot-btn" data-slot="${slot}" ${full ? "disabled" : ""}>${full ? "已額滿" : state.booking ? "更改至此" : "選這時段"}</button>
      </article>`;
    }).join("");

    grid.querySelectorAll("[data-slot]").forEach(btn => btn.addEventListener("click", () => openBooking(btn.dataset.slot)));
    renderMyBooking();
  }

  function renderMyBooking() {
    if (!state.booking) { myBookingCard.classList.add("hidden"); return; }
    myBookingCard.classList.remove("hidden");
    myBookingCard.innerHTML = `<div class="my-booking-top">
      <div><p class="section-kicker">✅ 我的預約</p><h2>${escapeHtml(state.booking.name)}老師</h2><div class="my-booking-time">${state.booking.slot}</div></div>
      <div aria-hidden="true" style="font-size:2rem">💗</div>
    </div>
    <p class="muted">${cfg.eventLabel}・${cfg.venue}${state.booking.bringCup ? "・已勾選自備杯 ☕" : ""}</p>
    <div class="booking-actions"><button class="secondary-btn" id="changeHint">更改時段</button><button class="danger-btn" id="cancelBtn">取消預約</button></div>`;
    document.getElementById("changeHint").onclick = () => { document.querySelector(".slots-grid").scrollIntoView({behavior:"smooth"}); showToast("請直接選擇新的時段"); };
    document.getElementById("cancelBtn").onclick = cancelBooking;
  }

  function openBooking(slot) {
    selectedSlot = slot;
    selectedSlotEl.textContent = `${cfg.eventLabel} ${slot}｜${cfg.venue}`;
    formStatus.textContent = "";
    if (state.booking) {
      document.getElementById("nameInput").value = state.booking.name || "";
      document.getElementById("emailInput").value = state.booking.email || "";
      document.getElementById("emailInput").disabled = true;
      document.getElementById("cupInput").checked = !!state.booking.bringCup;
      submitBtn.textContent = "確認更改時段";
    } else {
      document.getElementById("emailInput").disabled = false;
      document.getElementById("nameInput").value = "";
      document.getElementById("emailInput").value = "";
      document.getElementById("cupInput").checked = false;
      submitBtn.textContent = "確認預約";
    }
    modal.classList.remove("hidden");
  }

  function hideModal() { modal.classList.add("hidden"); selectedSlot = null; }
  closeModal.onclick = hideModal;
  modal.addEventListener("click", e => { if (e.target === modal) hideModal(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!selectedSlot) return;
    submitBtn.disabled = true; formStatus.textContent = "";
    try {
      if (state.booking) {
        await api("change", { slot: selectedSlot, bringCup: document.getElementById("cupInput").checked });
        showToast("時段已更新");
      } else {
        const email = document.getElementById("emailInput").value.trim().toLowerCase();
        const booked = await api("book", {
          name: document.getElementById("nameInput").value,
          email,
          slot: selectedSlot,
          bringCup: document.getElementById("cupInput").checked
        });
        if (booked.manageToken) localStorage.setItem(manageTokenKey, booked.manageToken);
        showToast("預約成功！期待活動當天見");
      }
      hideModal(); await refresh();
    } catch (err) {
      formStatus.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function cancelBooking() {
    if (!confirm("確定要取消目前的按摩預約嗎？")) return;
    try {
      await api("cancel");
      localStorage.removeItem(manageTokenKey);
      showToast("預約已取消");
      await refresh();
    } catch (e) { showToast(e.message); }
  }

  function showToast(text) {
    toast.textContent = text; toast.classList.remove("hidden");
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
  }
  function escapeHtml(v) { return String(v || "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  refresh();
  setInterval(refresh, 30000);
})();
