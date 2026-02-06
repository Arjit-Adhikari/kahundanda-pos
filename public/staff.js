let MENU = { categories: [] };
let cart = {};
let staffToken = localStorage.getItem("staff_token") || "";

const loginCard = document.getElementById("loginCard");
const staffCard = document.getElementById("staffCard");
const menuArea = document.getElementById("menuArea");
const selectedArea = document.getElementById("selectedArea");
const totalText = document.getElementById("totalText");
const msg = document.getElementById("msg");
const loginMsg = document.getElementById("loginMsg");

// ---------- HELPERS ----------
function money(n){ return "NPR " + (Number(n)||0); }
function calcTotal(){
  return Object.values(cart).reduce((s,i)=> s + i.price*i.qty, 0);
}

// ---------- SCREEN TOGGLE ----------
function showScreen(){
  if(staffToken){
    loginCard.style.display = "none";
    staffCard.style.display = "block";
    loadMenu();
  } else {
    loginCard.style.display = "block";
    staffCard.style.display = "none";
  }
}

// ---------- STAFF LOGIN ----------
async function staffLogin(){
  loginMsg.textContent = "Logging in...";
  const pin = document.getElementById("staffPin").value.trim();

  const res = await fetch("/api/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin })
  });

  const data = await res.json();
  if(!res.ok){
    loginMsg.textContent = "❌ " + (data.error || "Login failed");
    return;
  }

  staffToken = data.token;
  localStorage.setItem("staff_token", staffToken);
  loginMsg.textContent = "✅ Login successful";
  showScreen();
}

// ---------- LOGOUT ----------
function logout(){
  staffToken = "";
  localStorage.removeItem("staff_token");
  cart = {};
  showScreen();
}

// ---------- MENU ----------
async function loadMenu(){
  msg.textContent = "Loading menu...";
  const res = await fetch("/api/menu");
  const data = await res.json();

  if(!res.ok){
    msg.textContent = "❌ Menu load failed";
    return;
  }

  MENU = data;
  renderMenu();
  renderSelected();
  msg.textContent = "Menu loaded";
}

function renderMenu(){
  menuArea.innerHTML = "";

  MENU.categories.forEach(cat=>{
    const box = document.createElement("div");
    box.className = "cat";

    const header = document.createElement("div");
    header.className = "catHeader";
    header.textContent = cat.name;

    const itemsDiv = document.createElement("div");
    itemsDiv.className = "catItems";

    cat.items.forEach(it=>{
      const qty = cart[it.name]?.qty || 0;

      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div>
          <b>${it.name}</b><br>
          <small>${money(it.price)}</small>
        </div>
        <div class="qtyBox">
          <button data-n="${it.name}" data-p="${it.price}" data-a="-">-</button>
          <span>${qty}</span>
          <button data-n="${it.name}" data-p="${it.price}" data-a="+">+</button>
        </div>
      `;
      itemsDiv.appendChild(row);
    });

    header.onclick = ()=> itemsDiv.classList.toggle("open");

    box.appendChild(header);
    box.appendChild(itemsDiv);
    menuArea.appendChild(box);
  });

  menuArea.querySelectorAll("button").forEach(btn=>{
    btn.onclick = ()=>{
      const name = btn.dataset.n;
      const price = Number(btn.dataset.p);
      const act = btn.dataset.a;

      if(!cart[name]) cart[name] = { name, price, qty: 0 };
      cart[name].qty += act === "+" ? 1 : -1;
      if(cart[name].qty <= 0) delete cart[name];

      renderMenu();
      renderSelected();
    };
  });
}

function renderSelected(){
  selectedArea.innerHTML = "";
  Object.values(cart).forEach(i=>{
    const d = document.createElement("div");
    d.textContent = `${i.name} × ${i.qty}`;
    selectedArea.appendChild(d);
  });
  totalText.textContent = money(calcTotal());
}

// ---------- SEND ORDER ----------
document.getElementById("sendBtn").onclick = async ()=>{
  const table = document.getElementById("tableInput").value.trim();
  const items = Object.values(cart);

  if(!table){ msg.textContent = "❌ Table required"; return; }
  if(items.length===0){ msg.textContent = "❌ No items"; return; }

  const res = await fetch("/api/orders", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer " + staffToken
    },
    body: JSON.stringify({ table, items })
  });

  const data = await res.json();
  if(!res.ok){
    msg.textContent = "❌ " + (data.error || "Order failed");
    return;
  }

  msg.textContent = "✅ Order sent!";
  cart = {};
  renderMenu();
  renderSelected();
};

// ---------- BUTTON EVENTS ----------
document.getElementById("staffLoginBtn").addEventListener("click", staffLogin);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("clearBtn").addEventListener("click", ()=>{
  cart = {};
  renderMenu();
  renderSelected();
});

// ---------- INIT ----------
showScreen();
