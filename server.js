const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const MENU_PATH = path.join(__dirname, "menu.json");
const ORDERS_PATH = path.join(__dirname, "orders.json");

function readJSON(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

function requireStaff(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== "staff-ok") return res.status(401).json({ error: "Staff unauthorized" });
  next();
}
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== "admin-ok") return res.status(401).json({ error: "Admin unauthorized" });
  next();
}

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Menu
app.get("/api/menu", (req, res) => {
  try {
    const menu = readJSON(MENU_PATH, { categories: [] });
    res.json(menu);
  } catch (e) {
    res.status(500).json({ error: "Menu read failed", detail: String(e) });
  }
});

// Staff login
app.post("/api/staff/login", (req, res) => {
  const { pin } = req.body;
  const correct = process.env.STAFF_PIN || "0000";
  if (String(pin || "") !== String(correct)) {
    return res.status(401).json({ error: "Wrong staff PIN" });
  }
  return res.json({ ok: true, role: "staff", token: "staff-ok" });
});

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { pin } = req.body;
  const correct = process.env.ADMIN_PIN || "6969";
  if (String(pin || "") !== String(correct)) {
    return res.status(401).json({ error: "Wrong admin PIN" });
  }
  return res.json({ ok: true, role: "admin", token: "admin-ok" });
});

// Staff -> Create order
app.post("/api/orders", requireStaff, (req, res) => {
  const { table, items, note } = req.body;

  if (!table || String(table).trim() === "") {
    return res.status(400).json({ error: "Table is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items required" });
  }

  const cleaned = items
    .filter(i => i && i.name && Number(i.qty) > 0)
    .map(i => ({
      name: String(i.name),
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 0
    }));

  if (cleaned.length === 0) return res.status(400).json({ error: "No valid items" });

  const total = cleaned.reduce((s, i) => s + i.price * i.qty, 0);

  const orders = readJSON(ORDERS_PATH, []);
  const order = {
    id: Date.now().toString(), // simple unique id
    table: String(table).trim(),
    items: cleaned,
    note: note ? String(note) : "",
    total,
    status: "Pending",
    createdAt: new Date().toISOString()
  };

  orders.unshift(order);
  writeJSON(ORDERS_PATH, orders);

  res.json({ ok: true, orderId: order.id });
});

// Admin -> List orders
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_PATH, []);
  res.json(orders);
});

// Admin -> Update status
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const { status } = req.body;
  const allowed = ["Pending", "Preparing", "Served", "Paid", "Cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const orders = readJSON(ORDERS_PATH, []);
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders[idx].status = status;
  writeJSON(ORDERS_PATH, orders);

  res.json({ ok: true, updated: orders[idx] });
});

// ✅ Admin -> Delete order (WORKING)
app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_PATH, []);
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders.splice(idx, 1);
  writeJSON(ORDERS_PATH, orders);

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running: http://localhost:${PORT}`);
  console.log(`✅ Staff: http://localhost:${PORT}/staff.html`);
  console.log(`✅ Admin: http://localhost:${PORT}/admin.html`);
});
