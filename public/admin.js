let adminToken = localStorage.getItem("admin_token") || "";

const msg = document.getElementById("msg");
const panel = document.getElementById("panel");
const list = document.getElementById("ordersList");

// OPTIONAL: if you added the button in admin.html
const printBtn = document.getElementById("printSalesBtn");

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
      ${o.note ? `<div class="muted"><b>Note:</b> ${o.note}</div>` : ""}
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



 // ✅ delete buttons (PIN required)
list.querySelectorAll("button[data-del]").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    const id = btn.dataset.del;

    const ok = confirm("Delete this order permanently?");
    if(!ok) return;

    // 🔐 Ask admin PIN again
    const pin = prompt("Enter ADMIN PIN to delete:");
    if(pin === null) return; // cancelled

    // verify pin with server
    const loginRes = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ pin: pin.trim() })
    });

    const loginData = await loginRes.json();
    if(!loginRes.ok){
      alert("❌ Wrong PIN. Delete blocked.");
      return;
    }

    // proceed delete
    const res = await fetch("/api/admin/orders/" + id, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + adminToken
      }
    });

    const data = await res.json();
    if(!res.ok){
      alert(data.error || "Delete failed");
      return;
    }

    alert("✅ Deleted");
    await loadOrders();
  });
});


      const data = await res.json();
      if(!res.ok){
        alert(data.error || "Delete failed");
        return;
      }

      await loadOrders();
    });
  });
}

// ✅ TODAY SALES PRINT (A4)
async function printTodaySales(){
  if(!adminToken){
    alert("Login first!");
    return;
  }

  const res = await fetch("/api/admin/orders", {
    headers: { "Authorization": "Bearer " + adminToken }
  });

  if(!res.ok){
    alert("Failed to load orders for print");
    return;
  }

  const orders = await res.json();

  // Today filter (local date)
  const now = new Date();
  const yy = now.getFullYear();
  const mm = now.getMonth();
  const dd = now.getDate();

  const isToday = (iso) => {
    const dt = new Date(iso);
    return dt.getFullYear() === yy && dt.getMonth() === mm && dt.getDate() === dd;
  };

  const todaysOrders = (orders || []).filter(o => o.createdAt && isToday(o.createdAt));

  // Summary
  const tableMap = {};
  let grandTotal = 0;
  let totalOrders = todaysOrders.length;

  todaysOrders.forEach(o=>{
    const t = o.table || "Unknown";
    const val = Number(o.total) || 0;
    tableMap[t] = (tableMap[t] || 0) + val;
    grandTotal += val;
  });

  // Build rows
  let rows = "";
  const tables = Object.keys(tableMap).sort((a,b)=> a.localeCompare(b));
  tables.forEach(t=>{
    rows += `
      <tr>
        <td>${t}</td>
        <td>NPR ${tableMap[t]}</td>
      </tr>
    `;
  });

  if(!rows){
    rows = `<tr><td colspan="2">No orders today</td></tr>`;
  }

  const win = window.open("", "", "width=800,height=1000");
  win.document.write(`
    <html>
    <head>
      <title>Today Sales Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 18mm; }
        h1, h2 { text-align:center; margin: 0; }
        .meta { margin-top: 14px; font-size: 14px; }
        .meta b { display:inline-block; min-width: 120px; }
        table { width:100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border:1px solid #000; padding:8px; text-align:left; }
        th { background:#f1f1f1; }
        .totals { margin-top: 12px; font-size: 15px; }
        @page { size: A4; margin: 18mm; }
      </style>
    </head>
    <body>
      <h1>Kahundanda Resort Tappu</h1>
      <h2>Today Sales Report</h2>

      <div class="meta">
        <div><b>Date:</b> ${new Date().toLocaleDateString()}</div>
        <div class="totals">
          <b>Total Orders:</b> ${totalOrders} &nbsp;&nbsp; | &nbsp;&nbsp;
          <b>Grand Total:</b> NPR ${grandTotal}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Table</th>
            <th>Total Sales</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr>
            <th>Grand Total</th>
            <th>NPR ${grandTotal}</th>
          </tr>
        </tfoot>
      </table>

      <script>
        window.print();
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

document.getElementById("adminLoginBtn").addEventListener("click", adminLogin);

// Print button (only if exists in HTML)
if(printBtn){
  printBtn.addEventListener("click", printTodaySales);
}

// auto show panel if already logged in
if(adminToken){
  panel.style.display = "block";
  loadOrders();
}
setInterval(loadOrders, 3000);
