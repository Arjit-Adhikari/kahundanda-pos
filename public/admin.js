let adminToken = localStorage.getItem("admin_token") || "";

const msg = document.getElementById("msg");
const panel = document.getElementById("panel");
const list = document.getElementById("ordersList");

function money(n){ return "NPR " + (Number(n)||0); }

async function adminLogin(){
  msg.textContent = "";
  const pin = document.getElementById("adminPin").value.trim();

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ pin })
  });

  const data = await res.json();
  if(!res.ok){
    msg.textContent = "❌ " + (data.error || "Login failed");
    return;
  }

  adminToken = data.token; // "admin-ok"
  localStorage.setItem("admin_token", adminToken);
  msg.textContent = "✅ Logged in!";
  panel.style.display = "block";
  await loadOrders();
}

async function loadOrders(){
  if(!adminToken) return;

  const res = await fetch("/api/admin/orders", {
    headers: { "Authorization": "Bearer " + adminToken }
  });

  if(res.status === 401){
    msg.textContent = "❌ Session expired. Login again.";
    adminToken = "";
    localStorage.removeItem("admin_token");
    panel.style.display = "none";
    return;
  }

  const orders = await res.json();
  renderOrders(orders);
}

function renderOrders(orders){
  list.innerHTML = "";

  if(!orders || orders.length === 0){
    list.innerHTML = `<div class="muted">No orders yet.</div>`;
    return;
  }

  orders.forEach(o=>{
    const div = document.createElement("div");
    div.className = "orderCard";

    const itemsHtml = (o.items || []).map(i =>
      `<div class="muted">• ${i.name} × ${i.qty} (${money(i.price*i.qty)})</div>`
    ).join("");

    div.innerHTML = `
      <div class="orderTop">
        <div>
          <div><b>Table:</b> ${o.table}</div>
          <div class="muted">${new Date(o.createdAt).toLocaleString()}</div>
        </div>
        <div><span class="badge"><b>${o.status}</b></span></div>
      </div>
      <hr/>
      <div>${itemsHtml}</div>
      <div class="muted"><b>Total:</b> ${money(o.total)}</div>

      <div style="height:10px"></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        ${["Pending","Preparing","Served","Paid","Cancelled"].map(s=>`
          <button class="small ${s===o.status ? "secondary":""}" data-id="${o.id}" data-status="${s}">
            ${s}
          </button>
        `).join("")}

        <button class="small danger" data-del="${o.id}">🗑 Delete</button>
      </div>
    `;

    list.appendChild(div);
  });

  // status buttons
  list.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      const status = btn.dataset.status;

      await fetch("/api/admin/orders/" + id, {
        method: "PATCH",
        headers: {
          "Content-Type":"application/json",
          "Authorization": "Bearer " + adminToken
        },
        body: JSON.stringify({ status })
      });

      await loadOrders();
    });
  });

  // ✅ delete buttons (SEPARATE DELETE PIN)
  list.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.del;

      const ok = confirm("Delete this order permanently?");
      if(!ok) return;

      const pin = prompt("Enter DELETE PIN:");
      if(pin === null) return;

      // ✅ verify delete pin (needs admin auth)
      const verify = await fetch("/api/admin/verify-delete-pin", {
        method: "POST",
        headers: {
          "Content-Type":"application/json",
          "Authorization": "Bearer " + adminToken
        },
        body: JSON.stringify({ pin: pin.trim() })
      });

      const vdata = await verify.json();
      if(!verify.ok){
        alert("❌ " + (vdata.error || "Wrong DELETE PIN"));
        return;
      }

      // proceed delete
      const res = await fetch("/api/admin/orders/" + id, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + adminToken }
      });

      const data = await res.json();
      if(!res.ok){
        alert(data.error || "Delete failed");
        return;
      }

      alert("✅ Order deleted");
      await loadOrders();
    });
  });
}

document.getElementById("adminLoginBtn").addEventListener("click", adminLogin);

// auto show panel if already logged in
if(adminToken){
  panel.style.display = "block";
  loadOrders();
}
setInterval(loadOrders, 3000);
