// server.js - StockFlow backend API using Node.js, Express, SQLite, and HMAC tokens
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve or generate a persistent JWT Secret using Node crypto
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const secretPath = path.join(__dirname, '.jwt-secret');
  if (fs.existsSync(secretPath)) {
    JWT_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
  } else {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretPath, JWT_SECRET, 'utf8');
    } catch (e) {
      // Ignore if write restricted
    }
  }
}

// Setup CORS support for frontend origins
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow during development
    }
  },
  credentials: true
}));

app.use(express.json());

// Token helpers using Node's built-in HMAC-SHA256 (no external JWT package)
function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64url');
  return `${encHeader}.${encPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64url');
  
  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// In-memory rate limiter for login: 10 wrong attempts per 15 minutes per IP + username
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getRateLimitKey(ip, username) {
  return `${ip || 'unknown'}:${(username || '').toLowerCase().trim()}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  const timestamps = (loginAttempts.get(key) || []).filter(t => now - t < WINDOW_MS);
  loginAttempts.set(key, timestamps);
  return timestamps.length >= MAX_FAILED_ATTEMPTS;
}

function recordFailedLogin(key) {
  const now = Date.now();
  const timestamps = (loginAttempts.get(key) || []).filter(t => now - t < WINDOW_MS);
  timestamps.push(now);
  loginAttempts.set(key, timestamps);
}

function clearRateLimit(key) {
  loginAttempts.delete(key);
}

// Authentication middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  // Ensure user still exists in DB: "A removed staff member is blocked immediately"
  const user = db.prepare('SELECT id, role, ownerId, shopName, ownerName, username, email FROM users WHERE id = ?').get(payload.id);
  if (!user) {
    return res.status(401).json({ error: 'User account has been removed or deactivated' });
  }

  req.user = {
    id: user.id,
    role: user.role,
    ownerId: user.ownerId,
    shopId: user.role === 'owner' ? user.id : user.ownerId,
    username: user.username,
    shopName: user.shopName,
    ownerName: user.ownerName,
    email: user.email
  };

  next();
}

// Shop access verification middleware: shopId must match token
function requireShopAccess(req, res, next) {
  const shopId = parseInt(req.params.shopId, 10);
  if (isNaN(shopId) || shopId !== req.user.shopId) {
    return res.status(403).json({ error: 'Access denied: You can only access your own shop data' });
  }
  next();
}

// Owner-only permission middleware
function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Access denied: Owner permission required' });
  }
  next();
}

// Helper validation functions
function isValidDateString(str) {
  if (!str) return true; // Optional
  // dd-mm-yyyy format check
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = str.match(regex);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 2000 || year > 2100) return false;
  return true;
}

// -------------------------------------------------------------
// Open Endpoints
// -------------------------------------------------------------

// Root welcome & status check
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'StockFlow Backend API',
    status: 'online',
    healthCheck: '/api/health'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Register shop owner (3-step form submission)
app.post('/api/register', (req, res) => {
  try {
    const {
      shopName, ownerName, shopType,
      ownerPhone, phone, address, pincode,
      email, username, password
    } = req.body;

    // Field validations
    if (!shopName || !shopName.trim()) return res.status(400).json({ error: 'Shop name is required' });
    if (!ownerName || !ownerName.trim()) return res.status(400).json({ error: 'Owner name is required' });
    if (!username || username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken. Please choose another.' });
    }

    // Hash password with bcryptjs
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const insert = db.prepare(`
      INSERT INTO users (
        role, ownerId, shopName, ownerName, shopType,
        ownerPhone, phone, address, pincode, email, username, password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      'owner',
      null,
      shopName.trim(),
      ownerName.trim(),
      shopType || 'General Store',
      ownerPhone || '',
      phone || '',
      address || '',
      pincode || '',
      email.trim().toLowerCase(),
      username.trim(),
      hashedPassword
    );

    res.status(201).json({
      ok: true,
      message: 'Shop registration successful. Please log in with your credentials.',
      userId: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login endpoint (accepts username or email)
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const rateKey = getRateLimitKey(clientIp, username);

    // Enforce 10 wrong attempts per 15 minutes per IP + username
    if (checkRateLimit(rateKey)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Please wait 15 minutes before trying again.'
      });
    }

    // Look up user by username or email
    const user = db.prepare(`
      SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
    `).get(username.trim(), username.trim());

    if (!user || !bcrypt.compareSync(password, user.password)) {
      recordFailedLogin(rateKey);
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Reset rate limiter on success
    clearRateLimit(rateKey);

    // Resolve shop details
    let shopId = user.id;
    let shopName = user.shopName;
    if (user.role === 'staff') {
      shopId = user.ownerId;
      const owner = db.prepare('SELECT shopName FROM users WHERE id = ?').get(user.ownerId);
      if (owner) shopName = owner.shopName;
    }

    // Generate 7-day token signed with HMAC-SHA256
    const payload = {
      id: user.id,
      role: user.role,
      ownerId: user.ownerId,
      shopId: shopId,
      username: user.username,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    const token = signToken(payload);

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        role: user.role,
        shopId: shopId,
        username: user.username,
        shopName: shopName || 'My Store',
        ownerName: user.ownerName || '',
        email: user.email || ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
});

// Demo password reset code verification & update
app.post('/api/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email' });
    }

    // Hash and update password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

    res.json({ ok: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed: ' + err.message });
  }
});

// -------------------------------------------------------------
// Authenticated Endpoints
// -------------------------------------------------------------

// Products: Get list for a shop
app.get('/api/products/:shopId', requireAuth, requireShopAccess, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products WHERE shopId = ? ORDER BY name ASC').all(req.user.shopId);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// Products: Full replacement sync inside a transaction
app.put('/api/products-sync/:shopId', requireAuth, requireShopAccess, (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Payload must include products array' });
    }

    // Role check: Staff can only open billing (reduce stock), not add/delete products or alter prices
    if (req.user.role === 'staff') {
      const existingProducts = db.prepare('SELECT * FROM products WHERE shopId = ?').all(req.user.shopId);
      const existingMap = new Map(existingProducts.map(p => [p.id, p]));

      // Ensure staff doesn't remove products or alter prices/names
      for (const p of products) {
        const exist = existingMap.get(p.id);
        if (!exist) {
          return res.status(403).json({ error: 'Staff is not permitted to create new products' });
        }
        if (exist.price !== p.price || exist.name !== p.name) {
          return res.status(403).json({ error: 'Staff is not permitted to modify product prices or details' });
        }
      }
      if (products.length < existingProducts.length) {
        return res.status(403).json({ error: 'Staff is not permitted to delete products' });
      }
    }

    // Validate all products
    for (const p of products) {
      if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
        return res.status(400).json({ error: 'Every product must have a valid name' });
      }
      if (typeof p.price !== 'number' || p.price < 0 || isNaN(p.price)) {
        return res.status(400).json({ error: `Invalid price for product "${p.name}". Must be >= 0` });
      }
      if (!Number.isInteger(p.qty) || p.qty < 0) {
        return res.status(400).json({ error: `Quantity for "${p.name}" must be a whole non-negative number` });
      }
      const lowLimit = p.lowLimit !== undefined ? p.lowLimit : 5;
      if (!Number.isInteger(lowLimit) || lowLimit < 0) {
        return res.status(400).json({ error: `Low-stock limit for "${p.name}" must be a whole non-negative number` });
      }
      if (p.expiry && !isValidDateString(p.expiry)) {
        return res.status(400).json({ error: `Expiry date for "${p.name}" must be typed as dd-mm-yyyy` });
      }
    }

    // Run full sync inside a SQLite transaction
    const syncTransaction = db.transaction((items) => {
      db.prepare('DELETE FROM products WHERE shopId = ?').run(req.user.shopId);
      const insert = db.prepare(`
        INSERT INTO products (id, shopId, name, category, price, qty, lowLimit, expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        insert.run(
          String(item.id || crypto.randomUUID()),
          req.user.shopId,
          item.name.trim(),
          item.category || 'General',
          Number(item.price),
          Number(item.qty),
          Number(item.lowLimit !== undefined ? item.lowLimit : 5),
          item.expiry || ''
        );
      }
    });

    syncTransaction(products);
    res.json({ ok: true, count: products.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync products: ' + err.message });
  }
});

// Customers: Get list for a shop
app.get('/api/customers/:shopId', requireAuth, requireShopAccess, (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers WHERE shopId = ? ORDER BY name ASC').all(req.user.shopId);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers: ' + err.message });
  }
});

// Customers: Full replacement sync inside a transaction
app.put('/api/customers-sync/:shopId', requireAuth, requireShopAccess, (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: 'Payload must include customers array' });
    }

    // If staff, ensure existing customers are not deleted
    if (req.user.role === 'staff') {
      const existing = db.prepare('SELECT id FROM customers WHERE shopId = ?').all(req.user.shopId);
      const newIds = new Set(customers.map(c => c.id));
      for (const e of existing) {
        if (!newIds.has(e.id)) {
          return res.status(403).json({ error: 'Staff is not permitted to delete customer records' });
        }
      }
    }

    // Validate customers
    for (const c of customers) {
      if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
        return res.status(400).json({ error: 'Customer name is required' });
      }
    }

    const syncTransaction = db.transaction((list) => {
      db.prepare('DELETE FROM customers WHERE shopId = ?').run(req.user.shopId);
      const insert = db.prepare(`
        INSERT INTO customers (id, shopId, name, phone)
        VALUES (?, ?, ?, ?)
      `);
      for (const c of list) {
        insert.run(
          String(c.id || crypto.randomUUID()),
          req.user.shopId,
          c.name.trim(),
          c.phone ? c.phone.trim() : ''
        );
      }
    });

    syncTransaction(customers);
    res.json({ ok: true, count: customers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync customers: ' + err.message });
  }
});

// Sales: Get list for a shop
app.get('/api/sales/:shopId', requireAuth, requireShopAccess, (req, res) => {
  try {
    // If staff, server ensures staff cannot view entire historical business data beyond billing needs
    const sales = db.prepare('SELECT * FROM sales WHERE shopId = ? ORDER BY date DESC').all(req.user.shopId);
    
    // Parse JSON fields
    const parsed = sales.map(s => ({
      ...s,
      items: typeof s.items === 'string' ? JSON.parse(s.items) : s.items,
      payments: typeof s.payments === 'string' ? JSON.parse(s.payments) : s.payments
    }));

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales: ' + err.message });
  }
});

// Sales: Full replacement sync inside a transaction
app.put('/api/sales-sync/:shopId', requireAuth, requireShopAccess, (req, res) => {
  try {
    const { sales } = req.body;
    if (!Array.isArray(sales)) {
      return res.status(400).json({ error: 'Payload must include sales array' });
    }

    // Staff role restriction: Staff can add a sale in billing, but CANNOT cancel/delete past sales
    if (req.user.role === 'staff') {
      const existingSales = db.prepare('SELECT id FROM sales WHERE shopId = ?').all(req.user.shopId);
      const newIds = new Set(sales.map(s => s.id));
      for (const s of existingSales) {
        if (!newIds.has(s.id)) {
          return res.status(403).json({ error: 'Staff is not permitted to delete or cancel previous sales records' });
        }
      }
    }

    // Validate all sales records
    for (const s of sales) {
      if (typeof s.total !== 'number' || s.total < 0 || isNaN(s.total)) {
        return res.status(400).json({ error: 'Sale total must be a valid non-negative number' });
      }
      if (typeof s.paid !== 'number' || s.paid < 0 || isNaN(s.paid) || s.paid > (s.total + 0.05)) {
        return res.status(400).json({ error: 'Paid amount must be between 0 and total bill amount' });
      }
      const items = Array.isArray(s.items) ? s.items : (typeof s.items === 'string' ? JSON.parse(s.items) : []);
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Sale must contain at least one item' });
      }
      for (const it of items) {
        if (!it.name) return res.status(400).json({ error: 'Sale item missing name' });
        if (!Number.isInteger(it.qty) || it.qty <= 0) return res.status(400).json({ error: `Item "${it.name}" quantity must be an integer >= 1` });
        if (typeof it.price !== 'number' || it.price < 0) return res.status(400).json({ error: `Item "${it.name}" price must be >= 0` });
      }
    }

    const syncTransaction = db.transaction((list) => {
      db.prepare('DELETE FROM sales WHERE shopId = ?').run(req.user.shopId);
      const insert = db.prepare(`
        INSERT INTO sales (
          id, shopId, customerId, customerName, customerPhone,
          items, total, staff, date, paid, paymentType, payments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of list) {
        insert.run(
          String(s.id || crypto.randomUUID()),
          req.user.shopId,
          s.customerId ? String(s.customerId) : null,
          s.customerName ? String(s.customerName).trim() : 'Walk-in Customer',
          s.customerPhone ? String(s.customerPhone).trim() : '',
          typeof s.items === 'string' ? s.items : JSON.stringify(s.items || []),
          Number(s.total),
          s.staff ? String(s.staff) : req.user.username,
          s.date || new Date().toISOString(),
          Number(s.paid),
          s.paymentType || 'full',
          typeof s.payments === 'string' ? s.payments : JSON.stringify(s.payments || [])
        );
      }
    });

    syncTransaction(sales);
    res.json({ ok: true, count: sales.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync sales: ' + err.message });
  }
});

// Staff Management (Owner Only)
app.get('/api/staff', requireAuth, requireOwner, (req, res) => {
  try {
    const staffMembers = db.prepare(`
      SELECT id, role, ownerId, shopName, ownerName as name, username, phone, email, createdAt
      FROM users
      WHERE role = 'staff' AND ownerId = ?
      ORDER BY id DESC
    `).all(req.user.id);
    res.json(staffMembers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list staff: ' + err.message });
  }
});

app.post('/api/staff', requireAuth, requireOwner, (req, res) => {
  try {
    const { name, username, password, phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Staff member name is required' });
    if (!username || username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Check uniqueness
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'Username already in use' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const insert = db.prepare(`
      INSERT INTO users (role, ownerId, shopName, ownerName, phone, username, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      'staff',
      req.user.id,
      req.user.shopName,
      name.trim(),
      phone ? phone.trim() : '',
      username.trim(),
      hashedPassword
    );

    res.status(201).json({
      ok: true,
      id: result.lastInsertRowid,
      name: name.trim(),
      username: username.trim(),
      role: 'staff'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create staff account: ' + err.message });
  }
});

// Remove staff member - blocked immediately
app.delete('/api/staff/:id', requireAuth, requireOwner, (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    if (isNaN(staffId)) return res.status(400).json({ error: 'Invalid staff ID' });

    // Ensure staff belongs to this owner
    const staff = db.prepare("SELECT id FROM users WHERE id = ? AND ownerId = ? AND role = 'staff'").get(staffId, req.user.id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found or does not belong to your shop' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(staffId);
    res.json({ ok: true, message: 'Staff member removed. Account is immediately blocked.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete staff: ' + err.message });
  }
});

// Central error-handling middleware (clean JSON errors, never a crash page)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred'
  });
});

// Catch-all 404 handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Start listening
app.listen(PORT, () => {
  console.log(`StockFlow backend server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
