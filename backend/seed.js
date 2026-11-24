// seed.js - Pre-seed demo accounts and inventory for immediate testing
const db = require('./db.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const salt = bcrypt.genSaltSync(10);
const ownerHash = bcrypt.hashSync('admin123', salt);
const staffHash = bcrypt.hashSync('staff123', salt);

// Check if admin already exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

if (!existing) {
  // 1. Insert Demo Shop Owner
  const ownerRes = db.prepare(`
    INSERT INTO users (
      role, ownerId, shopName, ownerName, shopType,
      ownerPhone, phone, address, pincode, email, username, password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'owner',
    null,
    'Sri Laxmi Kirana & General Store',
    'Ramesh Kumar',
    'Grocery',
    '9876543210',
    '080-23456789',
    '12, Market Main Road, Gandhi Bazaar',
    '560004',
    'owner@stockflow.com',
    'admin',
    ownerHash
  );

  const ownerId = ownerRes.lastInsertRowid;

  // 2. Insert Demo Staff
  db.prepare(`
    INSERT INTO users (
      role, ownerId, shopName, ownerName, shopType,
      ownerPhone, phone, address, pincode, email, username, password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'staff',
    ownerId,
    'Sri Laxmi Kirana & General Store',
    'Suresh (Billing)',
    'Grocery',
    '',
    '9845011223',
    '',
    '',
    'staff@stockflow.com',
    'staff',
    staffHash
  );

  // 3. Seed Sample Products from CSV
  const csvPath = path.join(__dirname, '..', 'sample_inventory.csv');
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const insertProd = db.prepare(`
      INSERT INTO products (id, shopId, name, category, price, qty, lowLimit, expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      if (parts.length >= 4) {
        insertProd.run(
          'p_' + i,
          ownerId,
          parts[0],
          parts[1] || 'General',
          parseFloat(parts[2]) || 0,
          parseInt(parts[3], 10) || 0,
          parseInt(parts[4], 10) || 5,
          parts[5] || ''
        );
      }
    }
  }

  // 4. Seed Sample Customers
  const insertCust = db.prepare('INSERT INTO customers (id, shopId, name, phone) VALUES (?, ?, ?, ?)');
  insertCust.run('c_1', ownerId, 'Anand Rao', '9845112233');
  insertCust.run('c_2', ownerId, 'Priya Sharma', '9845223344');
  insertCust.run('c_3', ownerId, 'Mohammed Ali', '9845334455');

  // 5. Seed a couple of sample sales with past 7 days spread for the line chart
  const insertSale = db.prepare(`
    INSERT INTO sales (
      id, shopId, customerId, customerName, customerPhone,
      items, total, staff, date, paid, paymentType, payments
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  
  // Sale 1: Yesterday
  const d1 = new Date(now);
  d1.setDate(now.getDate() - 1);
  insertSale.run(
    'INV-1001',
    ownerId,
    'c_1',
    'Anand Rao',
    '9845112233',
    JSON.stringify([
      { id: 'p_1', name: 'Aashirvaad Shudh Chakki Atta 5kg', price: 245, qty: 2, total: 490 },
      { id: 'p_2', name: 'Tata Salt Iodized 1kg', price: 28, qty: 1, total: 28 }
    ]),
    518,
    'Ramesh Kumar',
    d1.toISOString(),
    518,
    'full',
    JSON.stringify([{ amount: 518, date: d1.toISOString(), staff: 'Ramesh Kumar' }])
  );

  // Sale 2: Today (with partial Udhaar)
  const d2 = new Date(now);
  insertSale.run(
    'INV-1002',
    ownerId,
    'c_2',
    'Priya Sharma',
    '9845223344',
    JSON.stringify([
      { id: 'p_3', name: 'Fortune Sunlite Sunflower Oil 1L', price: 135, qty: 2, total: 270 },
      { id: 'p_11', name: 'Amul Butter 100g', price: 56, qty: 2, total: 112 }
    ]),
    382,
    'Suresh (Billing)',
    d2.toISOString(),
    200,
    'partial',
    JSON.stringify([{ amount: 200, date: d2.toISOString(), staff: 'Suresh (Billing)' }])
  );

  console.log('✅ Demo accounts (admin & staff), sample products, customers, and sales seeded successfully!');
} else {
  console.log('ℹ️ Demo accounts already exist.');
}
