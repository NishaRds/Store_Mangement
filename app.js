// app.js - Main application logic for StockFlow
// Beginner-friendly, organized into modular functions with clean comments

// Resolve API base URL from config.js
const API_BASE = window.STOCKFLOW_API || "http://localhost:3000/api";

// -------------------------------------------------------------
// Global Application State
// -------------------------------------------------------------
let currentUser = null;
let authToken = null;
let products = [];
let customers = [];
let sales = [];
let staffList = [];
let cart = []; // Current billing invoice items: { id, name, category, price, qty, maxStock, expiry }
let activeView = 'dashboard';

// -------------------------------------------------------------
// Authentication and Session Initialization
// -------------------------------------------------------------
function checkSession() {
  authToken = localStorage.getItem('stockflow_token');
  const userJson = localStorage.getItem('stockflow_user');

  if (!authToken || !userJson) {
    window.location.href = 'index.html';
    return false;
  }

  try {
    currentUser = JSON.parse(userJson);
  } catch (e) {
    localStorage.clear();
    window.location.href = 'index.html';
    return false;
  }

  // Update UI user profile elements
  document.getElementById('user-display-name').textContent = currentUser.ownerName || currentUser.username;
  document.getElementById('user-display-role').textContent = currentUser.role === 'owner' ? 'Shop Owner' : 'Billing Staff';
  document.getElementById('user-avatar-char').textContent = (currentUser.ownerName || currentUser.username).charAt(0).toUpperCase();
  document.getElementById('header-shop-name').textContent = currentUser.shopName || 'StockFlow Store';
  document.getElementById('dashboard-greeting').textContent = `Welcome back, ${currentUser.ownerName || currentUser.username}!`;

  // Server & Screen Role Enforcement: Staff can ONLY open billing
  if (currentUser.role === 'staff') {
    document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
    document.getElementById('nav-dashboard').parentElement.style.display = 'none';
    activeView = 'billing';
  }

  return true;
}

// Helper for authenticated API requests
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    ...(options.headers || {})
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expired or staff member deleted
      alert('Your session has expired or your account has been deactivated. Please sign in again.');
      logout();
      return null;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = (data && data.error) ? data.error : `Request failed (${response.status})`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

function logout() {
  localStorage.removeItem('stockflow_token');
  localStorage.removeItem('stockflow_user');
  window.location.href = 'index.html';
}

// -------------------------------------------------------------
// Navigation & Views
// -------------------------------------------------------------
function navigateToView(viewId) {
  // Role check: Staff is only permitted to access Billing and Settings
  if (currentUser.role === 'staff' && viewId !== 'billing' && viewId !== 'settings' && viewId !== 'inventory') {
    viewId = 'billing';
  }

  activeView = viewId;

  // Switch sidebar active state
  document.querySelectorAll('.menu-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-view') === viewId);
  });

  // Switch content view
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const targetSec = document.getElementById(`view-${viewId}`);
  if (targetSec) targetSec.classList.add('active');

  // Update page header title
  const titles = {
    dashboard: 'Dashboard',
    inventory: 'Product Inventory',
    billing: 'Billing & POS',
    customers: 'Customer Accounts & Udhaar Ledger',
    sales: 'Sales History & Daily Closing',
    staff: 'Staff Management',
    settings: 'Settings'
  };
  document.getElementById('page-heading').textContent = titles[viewId] || 'StockFlow';

  // Render view-specific data
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'inventory') renderInventoryTable();
  if (viewId === 'billing') renderBillingCatalog();
  if (viewId === 'customers') renderCustomersTable();
  if (viewId === 'sales') renderSalesTable();
  if (viewId === 'staff') renderStaffTable();

  // Close mobile sidebar if open
  document.getElementById('app-sidebar').classList.remove('open');
}

// -------------------------------------------------------------
// Data Fetching and Synchronization
// -------------------------------------------------------------
async function loadAllData() {
  try {
    const shopId = currentUser.shopId;
    
    // Fetch products and customers (needed by both owner and staff)
    const [fetchedProducts, fetchedCustomers] = await Promise.all([
      apiFetch(`/products/${shopId}`),
      apiFetch(`/customers/${shopId}`)
    ]);

    products = fetchedProducts || [];
    customers = fetchedCustomers || [];

    // Sales data
    if (currentUser.role === 'owner') {
      sales = await apiFetch(`/sales/${shopId}`) || [];
      await loadStaff();
    } else {
      // Staff only loads recent sales to compute billing if needed
      sales = await apiFetch(`/sales/${shopId}`) || [];
    }

    // Refresh active view
    navigateToView(activeView);
    updateCustomerDatalist();
  } catch (err) {
    console.error('Error loading initial data:', err);
  }
}

async function syncProductsToBackend() {
  try {
    await apiFetch(`/products-sync/${currentUser.shopId}`, {
      method: 'PUT',
      body: JSON.stringify({ products })
    });
  } catch (err) {
    alert('Failed to save products to server: ' + err.message);
  }
}

async function syncCustomersToBackend() {
  try {
    await apiFetch(`/customers-sync/${currentUser.shopId}`, {
      method: 'PUT',
      body: JSON.stringify({ customers })
    });
  } catch (err) {
    alert('Failed to save customers to server: ' + err.message);
  }
}

async function syncSalesToBackend() {
  try {
    await apiFetch(`/sales-sync/${currentUser.shopId}`, {
      method: 'PUT',
      body: JSON.stringify({ sales })
    });
  } catch (err) {
    alert('Failed to save sales to server: ' + err.message);
  }
}

// -------------------------------------------------------------
// Date & Currency Formatting Helpers
// -------------------------------------------------------------
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseDdMmYyyy(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function isDateExpired(dateStr) {
  const d = parseDdMmYyyy(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isDateExpiringSoon(dateStr, daysAhead = 30) {
  const d = parseDdMmYyyy(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);
  return d >= today && d <= target;
}

// -------------------------------------------------------------
// 1. DASHBOARD LOGIC & WEEKLY SALES CHART
// -------------------------------------------------------------
function renderDashboard() {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Calculate today's sales and bills
  let todaySalesTotal = 0;
  let todayBillsCount = 0;
  sales.forEach(s => {
    if (s.date && s.date.slice(0, 10) === todayStr) {
      todaySalesTotal += Number(s.total || 0);
      todayBillsCount += 1;
    }
  });

  document.getElementById('stat-today-sales').textContent = formatCurrency(todaySalesTotal);
  document.getElementById('stat-today-bills').textContent = `${todayBillsCount} bills generated today`;

  // Weekly Units Sold (last 7 days)
  const now = new Date();
  const dayBuckets = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const ymd = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    dayBuckets.push({ ymd, label, units: 0, revenue: 0 });
  }

  let totalWeeklyUnits = 0;
  sales.forEach(s => {
    const sYmd = (s.date || '').slice(0, 10);
    const bucket = dayBuckets.find(b => b.ymd === sYmd);
    if (bucket) {
      const items = Array.isArray(s.items) ? s.items : [];
      const unitsInSale = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      bucket.units += unitsInSale;
      bucket.revenue += Number(s.total || 0);
      totalWeeklyUnits += unitsInSale;
    }
  });

  document.getElementById('stat-weekly-units').textContent = totalWeeklyUnits;

  // Render SVG Weekly Sales Line Chart
  renderWeeklySalesChart(dayBuckets);

  // Stock Alerts List (qty <= lowLimit)
  const lowStockItems = products.filter(p => Number(p.qty) <= Number(p.lowLimit || 5));
  document.getElementById('stat-low-stock').textContent = lowStockItems.length;
  document.getElementById('badge-low-stock-count').textContent = `${lowStockItems.length} items`;
  
  const lowStockTbody = document.getElementById('dash-low-stock-tbody');
  if (lowStockItems.length === 0) {
    lowStockTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">All inventory stock levels are healthy.</td></tr>';
  } else {
    lowStockTbody.innerHTML = lowStockItems.map(p => `
      <tr>
        <td style="font-weight: 600;">${p.name}</td>
        <td>
          <span class="badge ${p.qty === 0 ? 'badge-danger' : 'badge-warning'}">
            ${p.qty} left
          </span>
        </td>
        <td>${p.lowLimit || 5}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openRestockModal('${p.id}')">Restock</button>
        </td>
      </tr>
    `).join('');
  }

  // Expiring-Soon List
  const expiringItems = products.filter(p => p.expiry && (isDateExpired(p.expiry) || isDateExpiringSoon(p.expiry, 30)));
  document.getElementById('badge-expiring-count').textContent = `${expiringItems.length} items`;
  const expiringTbody = document.getElementById('dash-expiring-tbody');

  if (expiringItems.length === 0) {
    expiringTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No products expiring soon.</td></tr>';
  } else {
    expiringTbody.innerHTML = expiringItems.map(p => {
      const expired = isDateExpired(p.expiry);
      return `
        <tr>
          <td style="font-weight: 600;">${p.name}</td>
          <td>${p.expiry}</td>
          <td>
            <span class="badge ${expired ? 'badge-danger' : 'badge-warning'}">
              ${expired ? 'EXPIRED' : 'Expiring Soon'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Recent Sales Table (last 5)
  const recentSales = [...sales].slice(0, 5);
  const recentTbody = document.getElementById('dash-recent-sales-tbody');
  if (recentSales.length === 0) {
    recentTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No transactions recorded yet.</td></tr>';
  } else {
    recentTbody.innerHTML = recentSales.map(s => `
      <tr>
        <td style="font-weight: 600;">#${s.id}</td>
        <td>${s.customerName || 'Walk-in'}</td>
        <td style="font-weight: 700;">${formatCurrency(s.total)}</td>
        <td>
          <span class="badge ${s.paid >= s.total ? 'badge-success' : 'badge-danger'}">
            ${s.paid >= s.total ? 'PAID' : 'UDHAAR'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // Pending Payments (Udhaar Ledger)
  const customerUdhaarMap = calculateCustomerBalances();
  let totalUdhaarAmount = 0;
  const pendingList = [];

  for (const [key, info] of Object.entries(customerUdhaarMap)) {
    if (info.pending > 0.05) {
      totalUdhaarAmount += info.pending;
      pendingList.push(info);
    }
  }

  document.getElementById('stat-pending-udhaar').textContent = formatCurrency(totalUdhaarAmount);
  document.getElementById('dash-total-udhaar-badge').textContent = `Total: ${formatCurrency(totalUdhaarAmount)}`;

  const pendingTbody = document.getElementById('dash-pending-payments-tbody');
  if (pendingList.length === 0) {
    pendingTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No outstanding customer balances.</td></tr>';
  } else {
    pendingTbody.innerHTML = pendingList.map(item => `
      <tr>
        <td style="font-weight: 600;">${item.name}</td>
        <td>${item.phone || '-'}</td>
        <td style="color: var(--accent-red); font-weight: 700;">${formatCurrency(item.pending)}</td>
        <td>
          <button class="btn btn-sm btn-orange" onclick="openReceivePaymentModal('${item.id}', '${item.name}', ${item.pending})">
            Collect
          </button>
        </td>
      </tr>
    `).join('');
  }
}

// Draw interactive SVG line chart
function renderWeeklySalesChart(dayBuckets) {
  const svg = document.getElementById('weekly-sales-chart');
  if (!svg) return;

  const width = 700;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;

  const maxVal = Math.max(...dayBuckets.map(d => d.units), 10);
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Compute (x, y) coordinates for each point
  const points = dayBuckets.map((d, index) => {
    const x = paddingLeft + (index / (dayBuckets.length - 1)) * chartW;
    const y = paddingTop + chartH - (d.units / maxVal) * chartH;
    return { ...d, x, y };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // SVG elements: Grid lines, labels, polyline, dots, tooltips
  let svgContent = `
    <!-- Grid Lines -->
    <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5" />
    <line x1="${paddingLeft}" y1="${paddingTop + chartH / 2}" x2="${width - paddingRight}" y2="${paddingTop + chartH / 2}" stroke="var(--border-color)" stroke-dasharray="4" />
    <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="var(--border-color)" stroke-dasharray="4" />

    <!-- Y-Axis Labels -->
    <text x="${paddingLeft - 10}" y="${paddingTop + chartH + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">0</text>
    <text x="${paddingLeft - 10}" y="${paddingTop + chartH / 2 + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">${Math.round(maxVal / 2)}</text>
    <text x="${paddingLeft - 10}" y="${paddingTop + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">${maxVal}</text>

    <!-- Trend Line Area Gradient Fill -->
    <defs>
      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#28513f" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#28513f" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <polygon points="${paddingLeft},${paddingTop + chartH} ${polylinePoints} ${width - paddingRight},${paddingTop + chartH}" fill="url(#chartGradient)" />

    <!-- Polyline -->
    <polyline fill="none" stroke="#28513f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />
  `;

  // Draw dots and day labels
  points.forEach(p => {
    svgContent += `
      <!-- Day Label -->
      <text x="${p.x}" y="${height - 12}" fill="var(--text-main)" font-size="11" font-weight="600" text-anchor="middle">${p.label}</text>

      <!-- Value Dot -->
      <circle cx="${p.x}" cy="${p.y}" r="5" fill="#fffefa" stroke="#28513f" stroke-width="3" />
      <text x="${p.x}" y="${p.y - 10}" fill="#28513f" font-size="11" font-weight="700" text-anchor="middle">${p.units}</text>
    `;
  });

  svg.innerHTML = svgContent;
}

// -------------------------------------------------------------
// 2. INVENTORY VIEW LOGIC
// -------------------------------------------------------------
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-tbody');
  const search = (document.getElementById('inventory-search').value || '').toLowerCase().trim();
  const catFilter = document.getElementById('inventory-category-filter').value;
  const stockFilter = document.getElementById('inventory-stock-filter').value;

  // Update Category Dropdown options
  updateCategoryDropdown('inventory-category-filter', catFilter);

  // Filter products
  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) && !(p.category || '').toLowerCase().includes(search)) {
      return false;
    }
    if (catFilter !== 'ALL' && p.category !== catFilter) {
      return false;
    }
    if (stockFilter === 'LOW' && Number(p.qty) > Number(p.lowLimit || 5)) {
      return false;
    }
    if (stockFilter === 'OUT' && Number(p.qty) > 0) {
      return false;
    }
    if (stockFilter === 'EXPIRED' && !isDateExpired(p.expiry)) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No products match the selected filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isLow = Number(p.qty) <= Number(p.lowLimit || 5);
    const isOut = Number(p.qty) <= 0;
    const isExp = isDateExpired(p.expiry);

    return `
      <tr>
        <td style="font-weight: 600;">${p.name}</td>
        <td><span class="badge badge-info">${p.category || 'General'}</span></td>
        <td style="font-weight: 700;">${formatCurrency(p.price)}</td>
        <td>
          <span class="badge ${isOut ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-success')}">
            ${p.qty} units
          </span>
        </td>
        <td>${p.lowLimit || 5}</td>
        <td>
          ${p.expiry ? `
            <span style="${isExp ? 'color: var(--accent-red); font-weight: 700;' : ''}">
              ${p.expiry}
            </span>
          ` : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            ${currentUser.role === 'owner' ? `<button class="btn btn-sm btn-outline" title="Edit" onclick="openEditProductModal('${p.id}')">Edit</button>` : ''}
            <button class="btn btn-sm btn-outline" title="Restock" onclick="openRestockModal('${p.id}')">Restock</button>
            ${currentUser.role === 'owner' ? `<button class="btn btn-sm btn-danger" title="Delete" onclick="deleteProduct('${p.id}')">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateCategoryDropdown(selectId, currentValue = 'ALL') {
  const select = document.getElementById(selectId);
  if (!select) return;

  const categories = Array.from(new Set(products.map(p => p.category || 'General').filter(Boolean))).sort();
  let html = '<option value="ALL">All Categories</option>';
  categories.forEach(c => {
    html += `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`;
  });
  select.innerHTML = html;
}

// Add/Edit Product Modal Handlers
function openAddProductModal() {
  document.getElementById('modal-product-title').textContent = 'Add New Product';
  document.getElementById('form-product').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-lowLimit').value = '5';
  openModal('modal-product');
}

function openEditProductModal(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('modal-product-title').textContent = 'Edit Product';
  document.getElementById('prod-id').value = prod.id;
  document.getElementById('prod-name').value = prod.name;
  document.getElementById('prod-category').value = prod.category || '';
  document.getElementById('prod-price').value = prod.price;
  document.getElementById('prod-qty').value = prod.qty;
  document.getElementById('prod-lowLimit').value = prod.lowLimit !== undefined ? prod.lowLimit : 5;
  document.getElementById('prod-expiry').value = prod.expiry || '';
  openModal('modal-product');
}

// Quick Restock & Set Expiry Modal
function openRestockModal(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('quick-prod-id').value = prod.id;
  document.getElementById('quick-prod-name').textContent = prod.name;
  document.getElementById('quick-prod-current').textContent = `Current Stock: ${prod.qty} units`;
  document.getElementById('quick-add-qty').value = 0;
  document.getElementById('quick-expiry').value = prod.expiry || '';
  openModal('modal-restock-expiry');
}

async function deleteProduct(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  if (!confirm(`Are you sure you want to delete "${prod.name}" from inventory?`)) return;

  products = products.filter(p => p.id !== id);
  await syncProductsToBackend();
  renderInventoryTable();
}

// CSV Import Logic: columns: Name, Category, Price, Quantity, Low Stock Limit, Expiry Date
// "existing products only get their expiry updated"
async function handleCsvImport(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        alert('CSV file appears to be empty or has no data rows');
        return;
      }

      // Parse header line
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let addedCount = 0;
      let updatedExpiryCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim());
        if (row.length < 4) continue;

        const name = row[0];
        const category = row[1] || 'General';
        const price = parseFloat(row[2]) || 0;
        const qty = parseInt(row[3], 10) || 0;
        const lowLimit = parseInt(row[4], 10) || 5;
        const expiry = row[5] || '';

        // Check if product already exists by name (case-insensitive)
        const existing = products.find(p => p.name.toLowerCase() === name.toLowerCase());

        if (existing) {
          // Requirement: "existing products only get their expiry updated"
          if (expiry) {
            existing.expiry = expiry;
            updatedExpiryCount++;
          }
        } else {
          // Add new product
          products.push({
            id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            shopId: currentUser.shopId,
            name,
            category,
            price,
            qty,
            lowLimit,
            expiry
          });
          addedCount++;
        }
      }

      await syncProductsToBackend();
      renderInventoryTable();
      alert(`CSV Import Complete:\n- Added ${addedCount} new products\n- Updated expiry dates for ${updatedExpiryCount} existing products.`);
    } catch (err) {
      alert('Error parsing CSV file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// 3. BILLING & POS LOGIC
// -------------------------------------------------------------
function renderBillingCatalog() {
  const catalogGrid = document.getElementById('billing-catalog-grid');
  const search = (document.getElementById('billing-search').value || '').toLowerCase().trim();
  const catFilter = document.getElementById('billing-category-filter').value;

  updateCategoryDropdown('billing-category-filter', catFilter);

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) && !(p.category || '').toLowerCase().includes(search)) {
      return false;
    }
    if (catFilter !== 'ALL' && p.category !== catFilter) {
      return false;
    }
    return true;
  });

  document.getElementById('catalog-count-badge').textContent = `${filtered.length} Items`;

  if (filtered.length === 0) {
    catalogGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No products found.</div>';
    return;
  }

  catalogGrid.innerHTML = filtered.map(p => {
    const isOut = Number(p.qty) <= 0;
    const isExp = isDateExpired(p.expiry);

    return `
      <div class="product-item-card ${isOut ? 'out-of-stock' : ''}" onclick="addToCart('${p.id}')">
        <div>
          <div class="item-name">${p.name}</div>
          <span class="badge badge-info" style="font-size: 0.7rem;">${p.category || 'General'}</span>
          ${isExp ? '<span class="badge badge-danger" style="font-size: 0.7rem; margin-left: 0.2rem;">EXPIRED</span>' : ''}
        </div>
        <div>
          <div class="item-meta">
            <span>Stock: <strong>${p.qty}</strong></span>
            <span class="item-price">${formatCurrency(p.price)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addToCart(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  // Requirement: "block quantities above available stock"
  if (prod.qty <= 0) {
    alert(`Cannot add "${prod.name}" - this item is currently out of stock.`);
    return;
  }

  // Requirement: "ask for confirmation if a product is expired"
  if (isDateExpired(prod.expiry)) {
    const proceed = confirm(`Warning: "${prod.name}" expired on ${prod.expiry}.\n\nDo you want to proceed with adding this expired item to the invoice?`);
    if (!proceed) return;
  }

  const existingInCart = cart.find(item => item.id === prod.id);

  if (existingInCart) {
    if (existingInCart.qty + 1 > prod.qty) {
      alert(`Cannot add more than available stock (${prod.qty} units available).`);
      return;
    }
    existingInCart.qty += 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      price: Number(prod.price),
      qty: 1,
      maxStock: Number(prod.qty),
      expiry: prod.expiry
    });
  }

  renderCart();
}

function updateCartQty(productId, newQty) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  newQty = parseInt(newQty, 10);
  if (isNaN(newQty) || newQty <= 0) {
    removeFromCart(productId);
    return;
  }

  // Enforce available stock limit
  if (newQty > item.maxStock) {
    alert(`Available stock limit is ${item.maxStock} units.`);
    item.qty = item.maxStock;
  } else {
    item.qty = newQty;
  }

  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
        Cart is empty.<br>Click items from catalog to add.
      </div>
    `;
    document.getElementById('bill-items-count').textContent = '0 items (0 units)';
    document.getElementById('bill-grand-total').textContent = '₹0.00';
    updatePartialPaymentDisplay(0);
    return;
  }

  let totalUnits = 0;
  let grandTotal = 0;

  container.innerHTML = cart.map(item => {
    const lineTotal = item.qty * item.price;
    totalUnits += item.qty;
    grandTotal += lineTotal;

    return `
      <div class="cart-row">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 0.86rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${item.name}
          </div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">
            ${formatCurrency(item.price)} each
          </div>
        </div>

        <!-- Quantity Stepper -->
        <div class="cart-qty-ctrl">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty - 1})">-</button>
          <input type="number" class="qty-input" value="${item.qty}" min="1" max="${item.maxStock}" onchange="updateCartQty('${item.id}', this.value)">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty + 1})">+</button>
        </div>

        <div style="font-weight: 700; font-size: 0.9rem; min-width: 65px; text-align: right;">
          ${formatCurrency(lineTotal)}
        </div>

        <button class="btn btn-sm btn-outline" style="padding: 0.2rem 0.4rem; color: var(--accent-red);" onclick="removeFromCart('${item.id}')">
          Remove
        </button>
      </div>
    `;
  }).join('');

  document.getElementById('bill-items-count').textContent = `${cart.length} items (${totalUnits} units)`;
  document.getElementById('bill-grand-total').textContent = formatCurrency(grandTotal);

  updatePartialPaymentDisplay(grandTotal);
}

function updatePartialPaymentDisplay(grandTotal) {
  const isPartial = document.getElementById('pay-type-partial').checked;
  const partialBox = document.getElementById('partial-payment-box');
  partialBox.style.display = isPartial ? 'block' : 'none';

  if (isPartial) {
    const paidInput = document.getElementById('bill-amount-paid');
    const entered = parseFloat(paidInput.value) || 0;
    const pendingUdhaar = Math.max(0, grandTotal - entered);
    document.getElementById('bill-udhaar-pending').textContent = `Udhaar: ${formatCurrency(pendingUdhaar)}`;
  }
}

// Generate bill & receipt
async function generateBill() {
  if (cart.length === 0) {
    alert('Cannot generate bill: Cart is empty.');
    return;
  }

  const grandTotal = cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
  let customerName = (document.getElementById('bill-customer-name').value || '').trim();
  let customerPhone = (document.getElementById('bill-customer-phone').value || '').trim();

  // If customer name is empty, default to Walk-in
  if (!customerName) {
    customerName = 'Walk-in Customer';
  }

  // Check if customer exists or is new:
  // "type the customer name (new names open an Add Customer form)"
  let existingCust = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
  let customerId = null;

  if (customerName !== 'Walk-in Customer') {
    if (!existingCust) {
      // Prompt user to save new customer details
      const saveNew = confirm(`"${customerName}" is a new customer. Would you like to register them in your customer list?`);
      if (saveNew) {
        customerId = 'c_' + Date.now();
        existingCust = {
          id: customerId,
          shopId: currentUser.shopId,
          name: customerName,
          phone: customerPhone
        };
        customers.push(existingCust);
        await syncCustomersToBackend();
        updateCustomerDatalist();
      }
    } else {
      customerId = existingCust.id;
      if (!customerPhone && existingCust.phone) {
        customerPhone = existingCust.phone;
      }
    }
  }

  // Payment Calculation
  const isPartial = document.getElementById('pay-type-partial').checked;
  let paidAmount = grandTotal;
  let paymentType = 'full';

  if (isPartial) {
    paymentType = 'partial';
    paidAmount = parseFloat(document.getElementById('bill-amount-paid').value) || 0;
    if (paidAmount < 0) paidAmount = 0;
    if (paidAmount > grandTotal) paidAmount = grandTotal;
  }

  // Generate unique Invoice ID
  const billId = 'INV-' + Date.now().toString().slice(-6);
  const nowIso = new Date().toISOString();

  // Build sale record
  const saleRecord = {
    id: billId,
    shopId: currentUser.shopId,
    customerId: customerId,
    customerName: customerName,
    customerPhone: customerPhone,
    items: cart.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      total: i.qty * i.price
    })),
    total: grandTotal,
    paid: paidAmount,
    paymentType: paymentType,
    staff: currentUser.ownerName || currentUser.username,
    date: nowIso,
    payments: [{
      amount: paidAmount,
      date: nowIso,
      staff: currentUser.ownerName || currentUser.username
    }]
  };

  // Requirement: "reduce stock automatically"
  for (const item of cart) {
    const prod = products.find(p => p.id === item.id);
    if (prod) {
      prod.qty = Math.max(0, prod.qty - item.qty);
    }
  }

  // Append sale record
  sales.unshift(saleRecord);

  // Sync products and sales with backend
  await Promise.all([
    syncProductsToBackend(),
    syncSalesToBackend()
  ]);

  // Display printable receipt modal
  showReceipt(saleRecord);

  // Reset cart and inputs
  clearCart();
  document.getElementById('bill-customer-name').value = '';
  document.getElementById('bill-customer-phone').value = '';
  document.getElementById('bill-amount-paid').value = '';
  document.getElementById('pay-type-full').checked = true;
  updatePartialPaymentDisplay(0);

  // Re-render catalog to reflect reduced stock
  renderBillingCatalog();
}

// -------------------------------------------------------------
// Receipt Formatting & Printing
// -------------------------------------------------------------
function showReceipt(sale) {
  const container = document.getElementById('receipt-content');
  const items = Array.isArray(sale.items) ? sale.items : [];
  const dateFormatted = new Date(sale.date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const udhaarPending = Math.max(0, sale.total - sale.paid);

  container.innerHTML = `
    <div class="receipt-header">
      <h3>${currentUser.shopName || 'StockFlow Store'}</h3>
      <p style="font-size: 0.8rem;">Kirana & General Store</p>
      <p style="font-size: 0.75rem;">Phone: ${currentUser.phone || currentUser.ownerPhone || 'N/A'}</p>
    </div>

    <div class="receipt-meta">
      <div><strong>Bill #:</strong> ${sale.id}</div>
      <div><strong>Date:</strong> ${dateFormatted}</div>
    </div>
    <div class="receipt-meta">
      <div><strong>Customer:</strong> ${sale.customerName || 'Walk-in'}</div>
      <div><strong>Billed By:</strong> ${sale.staff}</div>
    </div>

    <table class="receipt-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Rate</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(it => `
          <tr>
            <td>${it.name}</td>
            <td style="text-align: center;">${it.qty}</td>
            <td style="text-align: right;">${Number(it.price).toFixed(2)}</td>
            <td style="text-align: right;">${(it.qty * it.price).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="receipt-totals">
      <div class="line">
        <span>Subtotal:</span>
        <span>${formatCurrency(sale.total)}</span>
      </div>
      <div class="line" style="font-weight: 700;">
        <span>Amount Paid:</span>
        <span>${formatCurrency(sale.paid)}</span>
      </div>
      ${udhaarPending > 0 ? `
        <div class="line" style="color: #b94c3e; font-weight: 700;">
          <span>Pending Udhaar:</span>
          <span>${formatCurrency(udhaarPending)}</span>
        </div>
      ` : ''}
    </div>

    <div class="receipt-footer">
      <p>Thank you for shopping with us! Visit again.</p>
    </div>
  `;

  openModal('modal-receipt');
}

// -------------------------------------------------------------
// 4. CUSTOMERS & UDHAAR LEDGER
// -------------------------------------------------------------
function calculateCustomerBalances() {
  const map = {};

  // Initialize customers
  customers.forEach(c => {
    map[c.id] = {
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      totalBills: 0,
      totalBilled: 0,
      totalPaid: 0,
      pending: 0
    };
  });

  // Tally sales
  sales.forEach(s => {
    const custId = s.customerId || s.customerName;
    if (!map[custId]) {
      map[custId] = {
        id: custId,
        name: s.customerName || 'Walk-in',
        phone: s.customerPhone || '',
        totalBills: 0,
        totalBilled: 0,
        totalPaid: 0,
        pending: 0
      };
    }
    map[custId].totalBills += 1;
    map[custId].totalBilled += Number(s.total || 0);
    map[custId].totalPaid += Number(s.paid || 0);
    map[custId].pending += Math.max(0, Number(s.total || 0) - Number(s.paid || 0));
  });

  return map;
}

function renderCustomersTable() {
  const tbody = document.getElementById('customers-table-tbody');
  const search = (document.getElementById('customer-search-input').value || '').toLowerCase().trim();
  const balances = calculateCustomerBalances();

  const list = Object.values(balances).filter(c => {
    if (search && !c.name.toLowerCase().includes(search) && !c.phone.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No customers found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td style="font-weight: 600;">${c.name}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.totalBills}</td>
      <td style="font-weight: 700;">${formatCurrency(c.totalBilled)}</td>
      <td style="color: var(--primary-green); font-weight: 700;">${formatCurrency(c.totalPaid)}</td>
      <td style="${c.pending > 0.05 ? 'color: var(--accent-red); font-weight: 800;' : ''}">
        ${formatCurrency(c.pending)}
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          ${c.pending > 0.05 ? `
            <button class="btn btn-sm btn-orange" onclick="openReceivePaymentModal('${c.id}', '${c.name}', ${c.pending})">
              Receive Payment
            </button>
          ` : ''}
          <button class="btn btn-sm btn-outline" onclick="openCustomerHistoryModal('${c.id}', '${c.name}')">
            History
          </button>
          ${customers.some(x => x.id === c.id) ? `
            <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.id}')">
              Delete
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function updateCustomerDatalist() {
  const datalist = document.getElementById('customer-datalist');
  if (!datalist) return;
  datalist.innerHTML = customers.map(c => `<option value="${c.name}">${c.phone ? ' (' + c.phone + ')' : ''}</option>`).join('');
}

// Receive Payment: "a payment clears the oldest pending bills first"
function openReceivePaymentModal(customerId, customerName, pendingAmount) {
  document.getElementById('pay-customer-id').value = customerId;
  document.getElementById('pay-customer-name').textContent = customerName;
  document.getElementById('pay-customer-balance').textContent = `Total Pending Udhaar: ${formatCurrency(pendingAmount)}`;
  document.getElementById('pay-amount-input').value = pendingAmount.toFixed(2);
  document.getElementById('pay-amount-input').max = pendingAmount;
  openModal('modal-receive-payment');
}

async function handleReceivePaymentSubmit(e) {
  e.preventDefault();
  const customerId = document.getElementById('pay-customer-id').value;
  let paymentAmount = parseFloat(document.getElementById('pay-amount-input').value) || 0;

  if (paymentAmount <= 0) {
    alert('Please enter a valid payment amount greater than zero.');
    return;
  }

  // Find all unpaid or partially paid bills for this customer, sorted chronologically (oldest first)
  const pendingSales = sales
    .filter(s => (s.customerId === customerId || s.customerName === customerId) && s.paid < s.total)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (pendingSales.length === 0) {
    alert('This customer does not have any pending bills.');
    closeModal('modal-receive-payment');
    return;
  }

  let remainingPayment = paymentAmount;
  const nowIso = new Date().toISOString();

  // Clear oldest pending bills first
  for (const sale of pendingSales) {
    if (remainingPayment <= 0) break;

    const owedOnThisBill = sale.total - sale.paid;
    const allocated = Math.min(remainingPayment, owedOnThisBill);

    sale.paid += allocated;
    remainingPayment -= allocated;

    if (!Array.isArray(sale.payments)) {
      sale.payments = typeof sale.payments === 'string' ? JSON.parse(sale.payments) : [];
    }

    sale.payments.push({
      amount: allocated,
      date: nowIso,
      staff: currentUser.ownerName || currentUser.username
    });

    if (sale.paid >= sale.total) {
      sale.paymentType = 'full';
    }
  }

  await syncSalesToBackend();
  closeModal('modal-receive-payment');
  renderCustomersTable();
  alert(`Payment of ${formatCurrency(paymentAmount)} received successfully and allocated against oldest pending invoices.`);
}

function openCustomerHistoryModal(customerId, customerName) {
  document.getElementById('cust-history-title').textContent = `Purchase History: ${customerName}`;
  const tbody = document.getElementById('cust-history-tbody');

  const customerSales = sales.filter(s => s.customerId === customerId || s.customerName === customerName);

  if (customerSales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No purchase history found for this customer.</td></tr>';
  } else {
    tbody.innerHTML = customerSales.map(s => `
      <tr>
        <td style="font-weight: 600;">#${s.id}</td>
        <td>${new Date(s.date).toLocaleDateString('en-IN')}</td>
        <td style="font-weight: 700;">${formatCurrency(s.total)}</td>
        <td style="color: var(--primary-green); font-weight: 700;">${formatCurrency(s.paid)}</td>
        <td style="${s.total - s.paid > 0 ? 'color: var(--accent-red); font-weight: 700;' : ''}">
          ${formatCurrency(Math.max(0, s.total - s.paid))}
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="showReceipt(sales.find(x => x.id === '${s.id}'))">
            View Receipt
          </button>
        </td>
      </tr>
    `).join('');
  }

  openModal('modal-customer-history');
}

async function deleteCustomer(id) {
  const cust = customers.find(c => c.id === id);
  if (!cust) return;

  if (!confirm(`Are you sure you want to delete customer "${cust.name}"? Past invoice records will remain intact.`)) return;

  customers = customers.filter(c => c.id !== id);
  await syncCustomersToBackend();
  updateCustomerDatalist();
  renderCustomersTable();
}

// -------------------------------------------------------------
// 5. SALES HISTORY & DAILY CLOSING
// -------------------------------------------------------------
function renderSalesTable() {
  const tbody = document.getElementById('sales-table-tbody');
  const search = (document.getElementById('sales-search-input').value || '').toLowerCase().trim();
  const dateFilter = document.getElementById('sales-date-filter').value;

  const filtered = sales.filter(s => {
    if (search && !s.id.toLowerCase().includes(search) && !(s.customerName || '').toLowerCase().includes(search)) {
      return false;
    }
    if (dateFilter && s.date.slice(0, 10) !== dateFilter) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No sales records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const items = Array.isArray(s.items) ? s.items : [];
    const itemCount = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    const balance = Math.max(0, s.total - s.paid);
    const dtFormatted = new Date(s.date).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    return `
      <tr>
        <td style="font-weight: 700;">#${s.id}</td>
        <td>${dtFormatted}</td>
        <td>${s.customerName || 'Walk-in'}</td>
        <td>${items.length} items (${itemCount} units)</td>
        <td style="font-weight: 700;">${formatCurrency(s.total)}</td>
        <td style="color: var(--primary-green); font-weight: 700;">${formatCurrency(s.paid)}</td>
        <td style="${balance > 0 ? 'color: var(--accent-red); font-weight: 700;' : ''}">${formatCurrency(balance)}</td>
        <td><span class="badge badge-info">${s.staff || 'Staff'}</span></td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-outline" onclick="showReceipt(sales.find(x => x.id === '${s.id}'))">
              Receipt
            </button>
            <button class="btn btn-sm btn-danger" onclick="cancelBill('${s.id}')">
              Cancel Bill
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Cancel a bill: "Cancel a bill (stock is added back!)"
async function cancelBill(billId) {
  const saleIndex = sales.findIndex(s => s.id === billId);
  if (saleIndex === -1) return;
  const sale = sales[saleIndex];

  const confirmMsg = `Are you sure you want to cancel Bill #${billId}?\nTotal: ${formatCurrency(sale.total)}\n\n* All item quantities in this bill will be automatically returned to inventory stock.`;
  if (!confirm(confirmMsg)) return;

  // Restore inventory quantities for each item in the cancelled bill
  const items = Array.isArray(sale.items) ? sale.items : [];
  for (const it of items) {
    const prod = products.find(p => p.id === it.id || p.name.toLowerCase() === it.name.toLowerCase());
    if (prod) {
      prod.qty += Number(it.qty) || 0;
    }
  }

  // Remove bill from sales list
  sales.splice(saleIndex, 1);

  // Sync to database
  await Promise.all([
    syncProductsToBackend(),
    syncSalesToBackend()
  ]);

  renderSalesTable();
  alert(`Bill #${billId} has been successfully cancelled and stock returned to inventory.`);
}

// Export sales to CSV
function exportSalesToCsv() {
  if (sales.length === 0) {
    alert('No sales data to export.');
    return;
  }

  let csvContent = 'Bill ID,Date & Time,Customer Name,Phone,Total (INR),Paid (INR),Udhaar Pending (INR),Payment Type,Staff,Items\n';

  sales.forEach(s => {
    const items = Array.isArray(s.items) ? s.items : [];
    const itemsSummary = items.map(i => `${i.name} x${i.qty}`).join('; ');
    const balance = Math.max(0, s.total - s.paid);

    const row = [
      `"${s.id}"`,
      `"${s.date}"`,
      `"${(s.customerName || 'Walk-in').replace(/"/g, '""')}"`,
      `"${s.customerPhone || ''}"`,
      s.total,
      s.paid,
      balance,
      `"${s.paymentType}"`,
      `"${s.staff}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`
    ];

    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `StockFlow_Sales_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

// Daily Closing Report that can be printed
function openDailyClosingReport() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.date && s.date.slice(0, 10) === todayStr);

  let totalRevenue = 0;
  let totalCashCollected = 0;
  let totalUdhaarIssued = 0;
  let totalItemsSold = 0;
  const categorySummary = {};

  todaySales.forEach(s => {
    totalRevenue += Number(s.total || 0);
    totalCashCollected += Number(s.paid || 0);
    totalUdhaarIssued += Math.max(0, Number(s.total || 0) - Number(s.paid || 0));

    const items = Array.isArray(s.items) ? s.items : [];
    items.forEach(it => {
      totalItemsSold += Number(it.qty) || 0;
      const cat = it.category || 'General';
      categorySummary[cat] = (categorySummary[cat] || 0) + (Number(it.total) || (it.qty * it.price));
    });
  });

  const reportContainer = document.getElementById('printable-closing-report');
  reportContainer.innerHTML = `
    <div class="receipt-header">
      <h3>DAILY CLOSING REPORT</h3>
      <p style="font-weight: 700; font-size: 1.1rem;">${currentUser.shopName || 'StockFlow Store'}</p>
      <p>Report Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="font-size: 0.8rem;">Generated By: ${currentUser.ownerName || currentUser.username}</p>
    </div>

    <div style="margin: 1rem 0; border-bottom: 1px dashed #444; padding-bottom: 0.75rem;">
      <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">SALES RECONCILIATION SUMMARY</h4>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>Total Invoices Generated:</span>
        <strong>${todaySales.length} bills</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>Total Units Sold:</span>
        <strong>${totalItemsSold} units</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>Total Sales Revenue:</span>
        <strong>${formatCurrency(totalRevenue)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #28513f;">
        <span>Cash / Payments Collected:</span>
        <strong>${formatCurrency(totalCashCollected)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #b94c3e;">
        <span>Credit / Udhaar Issued Today:</span>
        <strong>${formatCurrency(totalUdhaarIssued)}</strong>
      </div>
    </div>

    <div style="margin: 1rem 0; border-bottom: 1px dashed #444; padding-bottom: 0.75rem;">
      <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">CATEGORY BREAKDOWN</h4>
      ${Object.entries(categorySummary).map(([cat, amount]) => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span>${cat}:</span>
          <span>${formatCurrency(amount)}</span>
        </div>
      `).join('')}
    </div>

    <div class="receipt-footer">
      <p style="margin-top: 1.5rem; display: flex; justify-content: space-between;">
        <span>Manager Signature: __________________</span>
        <span>Register Closed: 21:00</span>
      </p>
    </div>
  `;

  openModal('modal-closing-report');
}

function printClosingReport() {
  window.print();
}

// -------------------------------------------------------------
// 6. STAFF MANAGEMENT (Owner Only)
// -------------------------------------------------------------
async function loadStaff() {
  if (currentUser.role !== 'owner') return;
  try {
    staffList = await apiFetch('/staff') || [];
    renderStaffTable();
  } catch (err) {
    console.error('Failed to load staff list:', err);
  }
}

function renderStaffTable() {
  const tbody = document.getElementById('staff-table-tbody');
  if (!tbody) return;

  if (staffList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No staff accounts created yet. Click "Create Staff Account" above.</td></tr>';
    return;
  }

  tbody.innerHTML = staffList.map(s => `
    <tr>
      <td style="font-weight: 600;">${s.name}</td>
      <td><code>${s.username}</code></td>
      <td>${s.phone || '-'}</td>
      <td><span class="badge badge-info">Billing Staff</span></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="removeStaffMember(${s.id}, '${s.name}')">
          Remove (Block)
        </button>
      </td>
    </tr>
  `).join('');
}

async function removeStaffMember(id, name) {
  if (!confirm(`Are you sure you want to remove staff member "${name}"?\n\nThey will be blocked immediately from accessing the system.`)) return;

  try {
    await apiFetch(`/staff/${id}`, { method: 'DELETE' });
    staffList = staffList.filter(s => s.id !== id);
    renderStaffTable();
    alert(`Staff account "${name}" has been removed and immediately blocked.`);
  } catch (err) {
    alert('Failed to remove staff: ' + err.message);
  }
}

// -------------------------------------------------------------
// 7. SETTINGS & PREFERENCES
// -------------------------------------------------------------
function loadSettings() {
  // Theme
  const theme = localStorage.getItem('stockflow_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const themeRadio = document.querySelector(`input[name="setting-theme"][value="${theme}"]`);
  if (themeRadio) themeRadio.checked = true;
  document.getElementById('theme-btn').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

  // Font Size
  const fontSize = localStorage.getItem('stockflow_font_size') || '15px';
  document.documentElement.style.setProperty('--font-size-base', fontSize);
  const fontSelect = document.getElementById('setting-font-size');
  if (fontSelect) fontSelect.value = fontSize;

  // Font Style
  const fontFamily = localStorage.getItem('stockflow_font_family') || "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
  document.documentElement.style.setProperty('--font-base', fontFamily);
  const familySelect = document.getElementById('setting-font-family');
  if (familySelect) familySelect.value = fontFamily;

  // Store profile text
  const storeInfo = document.getElementById('settings-store-info');
  if (storeInfo && currentUser) {
    storeInfo.innerHTML = `
      <strong>Shop Name:</strong> ${currentUser.shopName || 'N/A'}<br>
      <strong>Owner:</strong> ${currentUser.ownerName || currentUser.username}<br>
      <strong>Email:</strong> ${currentUser.email || 'N/A'}<br>
      <strong>Role:</strong> ${currentUser.role === 'owner' ? 'Shop Owner (Full Access)' : 'Billing Counter Staff'}<br>
      <strong>Backend API:</strong> <code>${API_BASE}</code>
    `;
  }
}

// -------------------------------------------------------------
// Modal Dialog Utility Helpers
// -------------------------------------------------------------
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('show');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('show');
}

// -------------------------------------------------------------
// DOM Event Listeners & Bootstrapping
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (!checkSession()) return;

  loadSettings();
  loadAllData();

  // Mobile sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('app-sidebar').classList.toggle('open');
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Topbar theme quick toggle
  document.getElementById('theme-btn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('stockflow_theme', next);
    loadSettings();
  });

  // Navigation clicks
  document.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      navigateToView(view);
    });
  });

  // -----------------------------------------------------------
  // Inventory Event Handlers
  // -----------------------------------------------------------
  document.getElementById('inventory-search').addEventListener('input', renderInventoryTable);
  document.getElementById('inventory-category-filter').addEventListener('change', renderInventoryTable);
  document.getElementById('inventory-stock-filter').addEventListener('change', renderInventoryTable);

  document.getElementById('btn-add-product').addEventListener('click', openAddProductModal);

  // CSV Import Trigger
  document.getElementById('btn-import-csv').addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
  });

  document.getElementById('csv-file-input').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleCsvImport(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Product Form Save (Add / Edit)
  document.getElementById('form-product').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value.trim() || 'General';
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const qty = parseInt(document.getElementById('prod-qty').value, 10) || 0;
    const lowLimit = parseInt(document.getElementById('prod-lowLimit').value, 10) || 5;
    const expiry = document.getElementById('prod-expiry').value.trim();

    if (!name) {
      alert('Product name is required');
      return;
    }

    if (id) {
      // Edit existing product
      const p = products.find(item => item.id === id);
      if (p) {
        p.name = name;
        p.category = category;
        p.price = price;
        p.qty = qty;
        p.lowLimit = lowLimit;
        p.expiry = expiry;
      }
    } else {
      // Add new product
      products.push({
        id: 'p_' + Date.now(),
        shopId: currentUser.shopId,
        name,
        category,
        price,
        qty,
        lowLimit,
        expiry
      });
    }

    await syncProductsToBackend();
    closeModal('modal-product');
    renderInventoryTable();
  });

  // Quick Restock & Expiry Form Submit
  document.getElementById('form-quick-update').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('quick-prod-id').value;
    const addQty = parseInt(document.getElementById('quick-add-qty').value, 10) || 0;
    const expiry = document.getElementById('quick-expiry').value.trim();

    const p = products.find(item => item.id === id);
    if (p) {
      p.qty += addQty;
      if (expiry) p.expiry = expiry;
    }

    await syncProductsToBackend();
    closeModal('modal-restock-expiry');
    renderInventoryTable();
    if (activeView === 'dashboard') renderDashboard();
  });

  // -----------------------------------------------------------
  // Billing Event Handlers
  // -----------------------------------------------------------
  document.getElementById('billing-search').addEventListener('input', renderBillingCatalog);
  document.getElementById('billing-category-filter').addEventListener('change', renderBillingCatalog);

  document.querySelectorAll('input[name="payment-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const grandTotal = cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
      updatePartialPaymentDisplay(grandTotal);
    });
  });

  document.getElementById('bill-amount-paid').addEventListener('input', () => {
    const grandTotal = cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
    updatePartialPaymentDisplay(grandTotal);
  });

  document.getElementById('btn-clear-cart').addEventListener('click', clearCart);
  document.getElementById('btn-generate-bill').addEventListener('click', generateBill);

  // Auto-fill phone when selecting customer from datalist
  document.getElementById('bill-customer-name').addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    const found = customers.find(c => c.name.toLowerCase() === val);
    if (found && found.phone) {
      document.getElementById('bill-customer-phone').value = found.phone;
    }
  });

  // -----------------------------------------------------------
  // Customers Event Handlers
  // -----------------------------------------------------------
  document.getElementById('customer-search-input').addEventListener('input', renderCustomersTable);
  document.getElementById('btn-add-customer-modal').addEventListener('click', () => {
    document.getElementById('form-customer').reset();
    openModal('modal-customer');
  });

  document.getElementById('form-customer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();

    if (!name) {
      alert('Customer name is required');
      return;
    }

    customers.push({
      id: 'c_' + Date.now(),
      shopId: currentUser.shopId,
      name,
      phone
    });

    await syncCustomersToBackend();
    updateCustomerDatalist();
    closeModal('modal-customer');
    renderCustomersTable();
  });

  document.getElementById('form-receive-payment').addEventListener('submit', handleReceivePaymentSubmit);

  // -----------------------------------------------------------
  // Sales History Event Handlers
  // -----------------------------------------------------------
  document.getElementById('sales-search-input').addEventListener('input', renderSalesTable);
  document.getElementById('sales-date-filter').addEventListener('change', renderSalesTable);
  document.getElementById('btn-export-sales-csv').addEventListener('click', exportSalesToCsv);
  document.getElementById('btn-daily-closing-report').addEventListener('click', openDailyClosingReport);

  // -----------------------------------------------------------
  // Staff Event Handlers
  // -----------------------------------------------------------
  const btnAddStaff = document.getElementById('btn-add-staff-modal');
  if (btnAddStaff) {
    btnAddStaff.addEventListener('click', () => {
      document.getElementById('form-staff').reset();
      openModal('modal-staff');
    });
  }

  const formStaff = document.getElementById('form-staff');
  if (formStaff) {
    formStaff.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('staff-name').value.trim();
      const username = document.getElementById('staff-username').value.trim();
      const phone = document.getElementById('staff-phone').value.trim();
      const password = document.getElementById('staff-password').value;

      if (!name || !username || !password) {
        alert('Name, username, and password are required');
        return;
      }
      if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
      }

      try {
        const created = await apiFetch('/staff', {
          method: 'POST',
          body: JSON.stringify({ name, username, password, phone })
        });

        staffList.unshift(created);
        renderStaffTable();
        closeModal('modal-staff');
        alert(`Staff account for ${name} (${username}) created successfully.`);
      } catch (err) {
        alert('Error creating staff account: ' + err.message);
      }
    });
  }

  // -----------------------------------------------------------
  // Settings Event Handlers
  // -----------------------------------------------------------
  document.querySelectorAll('input[name="setting-theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      localStorage.setItem('stockflow_theme', e.target.value);
      loadSettings();
    });
  });

  document.getElementById('setting-font-size').addEventListener('change', (e) => {
    localStorage.setItem('stockflow_font_size', e.target.value);
    loadSettings();
  });

  document.getElementById('setting-font-family').addEventListener('change', (e) => {
    localStorage.setItem('stockflow_font_family', e.target.value);
    loadSettings();
  });

});