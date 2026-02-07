let adminToken = localStorage.getItem("admin_token") || "";

const msg = document.getElementById("msg");
const panel = document.getElementById("panel");
const list = document.getElementById("ordersList");

function money(n){ return "NPR " + (Number(n)||0); }

// ---------------- LOGIN ----------------
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

  adminToken = data.token;
  localStorage.setItem("admin_token", adminToken);
  msg.textContent = "✅ Logged in!";
  panel.style.display = "block";
  await loadOrders();
}

// ---------------- LOAD ORDERS ----------------
async function loadOrders(){
  if(!adminToken) return;

  const res = await fetch("/api/admin/orders", {
    headers: { "Authorization":"Bearer " + adminToken }
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

    const itemsHtml = (o.items||[]).map(i =>
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

  // Status update
  list.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.onclick = async ()=>{
      await fetch("/api/admin/orders/" + btn.dataset.id, {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer " + adminToken
        },
        body: JSON.stringify({ status: btn.dataset.status })
      });
      loadOrders();
    };
  });

  // Delete with separate PIN
  list.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.dataset.del;
      if(!confirm("Delete this order permanently?")) return;

      const pin = prompt("Enter DELETE PIN:");
      if(pin === null) return;

      const verify = await fetch("/api/admin/verify-delete-pin", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer " + adminToken
        },
        body: JSON.stringify({ pin: pin.trim() })
      });

      const vdata = await verify.json();
      if(!verify.ok){
        alert("❌ " + (vdata.error || "Wrong DELETE PIN"));
        return;
      }

      const res = await fetch("/api/admin/orders/" + id, {
        method:"DELETE",
        headers:{ "Authorization":"Bearer " + adminToken }
      });

      const data = await res.json();
      if(!res.ok){
        alert(data.error || "Delete failed");
        return;
      }

      alert("✅ Order deleted");
      loadOrders();
    };
  });
}

// ---------------- TODAY SALES PRINT (A4) ----------------
function isSameLocalDay(a, b){
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

async function printTodaySales(){
  if(!adminToken){
    alert("Login first");
    return;
  }

  // fetch latest orders
  const res = await fetch("/api/admin/orders", {
    headers: { "Authorization":"Bearer " + adminToken }
  });
  const orders = await res.json();

  const now = new Date();
  const todayOrders = (orders || []).filter(o=>{
    const d = new Date(o.createdAt);
    return isSameLocalDay(d, now);
  });

  // summary
  let grandTotal = 0;
  const byTable = {}; // table -> { total, count, itemsMap }
  todayOrders.forEach(o=>{
    grandTotal += Number(o.total) || 0;
    const t = o.table || "Unknown";
    if(!byTable[t]) byTable[t] = { total: 0, count: 0, itemsMap: {} };
    byTable[t].total += Number(o.total) || 0;
    byTable[t].count += 1;

    (o.items || []).forEach(it=>{
      const key = it.name;
      byTable[t].itemsMap[key] = (byTable[t].itemsMap[key] || 0) + (Number(it.qty)||0);
    });
  });

  const tableNames = Object.keys(byTable).sort((a,b)=>a.localeCompare(b));

  // build printable HTML
  const dateText = now.toLocaleDateString() + " " + now.toLocaleTimeString();

  const rows = tableNames.map((t, idx)=>{
    const itemsList = Object.entries(byTable[t].itemsMap)
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([name, qty])=>`${name} × ${qty}`)
      .join("<br>");

    return `
      <tr>
        <td>${idx+1}</td>
        <td><b>${t}</b><br><span style="color:#555">Orders: ${byTable[t].count}</span></td>
        <td>${itemsList || "-"}</td>
        <td style="text-align:right"><b>${money(byTable[t].total)}</b></td>
      </tr>
    `;
  }).join("");

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Today Sales</title>
<style>
  body{ font-family: Arial, sans-serif; padding: 18px; }
  h1{ margin:0 0 6px 0; font-size:20px; }
  .meta{ color:#444; font-size:12px; margin-bottom:14px; }
  .box{ border:1px solid #ddd; padding:12px; border-radius:10px; }
  table{ width:100%; border-collapse: collapse; margin-top:10px; }
  th, td{ border:1px solid #ddd; padding:8px; vertical-align: top; font-size:12px; }
  th{ background:#f5f5f5; text-align:left; }
  .totals{ margin-top:12px; font-size:13px; }
  @media print{
    body{ padding:0; }
    .noPrint{ display:none; }
  }
</style>
</head>
<body>
  <div class="noPrint" style="margin-bottom:10px;">
    <button onclick="window.print()">Print</button>
    <button onclick="window.close()">Close</button>
  </div>

  <h1>Kahundanda Resort Tappu — Today Sales Report</h1>
  <div class="meta">Generated: ${dateText}</div>

  <div class="box">
    <div class="totals">
      <b>Total Orders Today:</b> ${todayOrders.length}<br>
      <b>Grand Total:</b> ${money(grandTotal)}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th style="width:160px;">Table</th>
          <th>Items Summary</th>
          <th style="width:120px; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4">No orders today.</td></tr>`}
      </tbody>
    </table>
  </div>

<script>
  // wait a bit then open print dialog (more reliable)
  setTimeout(()=>window.print(), 400);
</script>
</body>
</html>
  `;

  // ✅ open print window/tab
  const w = window.open("", "_blank");
  if(!w){
    alert("Popup blocked! Browser settings -> Allow popups for this site.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ---------------- EVENTS ----------------
document.getElementById("adminLoginBtn").addEventListener("click", adminLogin);

const printBtn = document.getElementById("printTodayBtn");
if(printBtn){
  printBtn.addEventListener("click", printTodaySales);
}

// auto show panel if already logged in
if(adminToken){
  panel.style.display = "block";
  loadOrders();
}
setInterval(loadOrders, 3000);
