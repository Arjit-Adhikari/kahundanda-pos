const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ====== ENV ======
const STAFF_PIN = process.env.STAFF_PIN || "0000";
const ADMIN_PIN = process.env.ADMIN_PIN || "6969";

// ====== FILE PATHS ======
const MENU_PATH = path.join(__dirname, "menu.json");
const ORDERS_PATH = path.join(__dirname, "orders.json");

// ====== HELPERS ======
function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function requireStaff(req, res, next) {
  const auth = req.headers.authorization || "";
  if (auth !== "Bearer staff-ok") {
    return res.status(401).json({ error: "Staff unauthorized" });
  }
  next();
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  if (auth !== "Bearer admin-ok") {
    return res.status(401).json({ error: "Admin unauthorized" });
  }
  next();
}

// ====== HEALTH ======
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ====== MENU ======
app.get("/api/menu", (req, res) => {
  const menu = readJSON(MENU_PATH, { categories: [] });
  res.json(menu);
});

// ====== STAFF LOGIN ======
app.post("/api/staff/login", (req, res) => {
  const pin = String(req.body?.pin || "");
  if (pin !== STAFF_PIN) {
    return res.status(401).json({ error: "Invalid staff PIN" });
  }
  res.json({ ok: true, role: "staff", token: "staff-ok" });
});

// ====== ADMIN LOGIN ======
app.post("/api/admin/login", (req, res) => {
  const pin = String(req.body?.pin || "");
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: "Invalid admin PIN" });
  }
  res.json({ ok: true, role: "admin", token: "admin-ok" });
});

// ====== CREATE ORDER (STAFF) ======
app.post("/api/orders", requireStaff, (req, res) => {
  const { table, items } = req.body;

  if (!table) return res.status(400).json({ error: "Table required" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items required" });
  }

  const cleanItems = items.map(i => ({
    name: String(i.name),
    price: Number(i.price) || 0,
    qty: Number(i.qty) || 0
  })).filter(i => i.qty > 0);

  if (cleanItems.length === 0) {
    return res.status(400).json({ error: "No valid items" });
  }

  const total = cleanItems.reduce((s, i) => s + i.price * i.qty, 0);

  const orders = readJSON(ORDERS_PATH, []);
  const order = {
    id: Date.now().toString(),
    table: String(table),
    items: cleanItems,
    total,
    status: "Pending",
    createdAt: new Date().toISOString()
  };

  orders.unshift(order);
  writeJSON(ORDERS_PATH, orders);

  res.json({ ok: true, orderId: order.id });
});

// ====== LIST ORDERS (ADMIN) ======
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_PATH, []);
  res.json(orders);
});

// ====== UPDATE STATUS (ADMIN) ======
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const { status } = req.body;
  const allowed = ["Pending", "Preparing", "Served", "Paid", "Cancelled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const orders = readJSON(ORDERS_PATH, []);
  const idx = orders.findIndex(o => o.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders[idx].status = status;
  writeJSON(ORDERS_PATH, orders);

  res.json({ ok: true });
});

// ====== DELETE ORDER (ADMIN) ======
app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_PATH, []);
  const idx = orders.findIndex(o => o.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders.splice(idx, 1);
  writeJSON(ORDERS_PATH, orders);

  res.json({ ok: true });
});

// ====== START SERVER (RENDER FIX) ======
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Staff: /staff.html`);
  console.log(`✅ Admin: /admin.html`);
});
