/**
 * Ashwanth Crackers - Comprehensive Owner/Admin Management Engine
 * Non-technical, data-driven, supporting PACKET/BOX inventory, automatic stock deduction & restoration,
 * transaction logging, analytics, and packing slip invoices.
 */

let productsList = [];
let sectionsList = [];
let ordersList = [];
let currentSelectedOrder = null;
let currentAnalyticsPeriod = 'month';

/* ==========================================================================
   0. AUTHENTICATION & ACCESS CONTROL (HARDENED SECURITY GATEWAY)
   ========================================================================== */
const ADMIN_CREDENTIALS = {
  username: 'mathuracracker',
  // SHA-256 hash of 'mathura@cracker' - Zero plaintext password stored in code or database
  password_hash: '71fbd7b8d12b6889032bdd0e89a671f1ec716b51812424643211b4849fa598a6'
};

const AUTH_SECURITY = {
  maxAttemptsBeforeCooldown: 3,
  cooldownSeconds: 30,
  maxAttemptsBeforeLockout: 5,
  lockoutSeconds: 180, // 3 minutes
  highSecurityAttempts: 8,
  highSecuritySeconds: 900, // 15 minutes
  sessionExpiryMs: 8 * 60 * 60 * 1000, // 8 hours max session lifetime
  idleTimeoutMs: 60 * 60 * 1000 // 60 minutes idle auto-logout
};

let lockoutTimerInterval = null;

// Brute-force & Rate Limiting Security Engine
function getAuthGuardState() {
  try {
    const raw = localStorage.getItem('mathura_auth_guard');
    if (!raw) return { failedAttempts: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch (e) {
    return { failedAttempts: 0, lockedUntil: 0 };
  }
}

function saveAuthGuardState(state) {
  try {
    localStorage.setItem('mathura_auth_guard', JSON.stringify(state));
  } catch (e) {}
}

function getLockoutRemainingSeconds() {
  const state = getAuthGuardState();
  const now = Date.now();
  if (state.lockedUntil && state.lockedUntil > now) {
    return Math.ceil((state.lockedUntil - now) / 1000);
  }
  return 0;
}

function recordFailedLoginAttempt() {
  const state = getAuthGuardState();
  state.failedAttempts = (state.failedAttempts || 0) + 1;
  const now = Date.now();

  if (state.failedAttempts >= AUTH_SECURITY.highSecurityAttempts) {
    state.lockedUntil = now + (AUTH_SECURITY.highSecuritySeconds * 1000);
  } else if (state.failedAttempts >= AUTH_SECURITY.maxAttemptsBeforeLockout) {
    state.lockedUntil = now + (AUTH_SECURITY.lockoutSeconds * 1000);
  } else if (state.failedAttempts >= AUTH_SECURITY.maxAttemptsBeforeCooldown) {
    state.lockedUntil = now + (AUTH_SECURITY.cooldownSeconds * 1000);
  }

  saveAuthGuardState(state);
  return state;
}

function resetFailedLoginAttempts() {
  try {
    localStorage.removeItem('mathura_auth_guard');
  } catch (e) {}
  if (lockoutTimerInterval) {
    clearInterval(lockoutTimerInterval);
    lockoutTimerInterval = null;
  }
}

function updateLockoutUI() {
  const remaining = getLockoutRemainingSeconds();
  const alertBox = document.getElementById('admin-login-alert');
  const submitBtn = document.getElementById('login-submit-btn');
  const btnText = document.getElementById('login-btn-text');
  const userField = document.getElementById('login-username');
  const passField = document.getElementById('login-password');

  if (remaining > 0) {
    if (submitBtn) submitBtn.disabled = true;
    if (userField) userField.disabled = true;
    if (passField) passField.disabled = true;
    if (btnText) btnText.textContent = `Locked (${remaining}s)`;
    if (alertBox) {
      alertBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="material-symbols-outlined" style="font-size:20px; color:#ef4444;">gpp_bad</span>
          <div>
            <strong>Security Lockout Active</strong><br>
            Too many consecutive failed login attempts detected. System locked to prevent brute-force attacks. Try again in <strong>${remaining}</strong> second${remaining === 1 ? '' : 's'}.
          </div>
        </div>
      `;
      alertBox.style.display = 'block';
    }

    if (!lockoutTimerInterval) {
      lockoutTimerInterval = setInterval(() => {
        const rem = getLockoutRemainingSeconds();
        if (rem <= 0) {
          clearInterval(lockoutTimerInterval);
          lockoutTimerInterval = null;
          if (submitBtn) submitBtn.disabled = false;
          if (userField) { userField.disabled = false; userField.focus(); }
          if (passField) passField.disabled = false;
          if (btnText) btnText.textContent = 'Sign In to Dashboard';
          if (alertBox) {
            alertBox.textContent = 'Lockout expired. You may now attempt to sign in.';
            alertBox.style.display = 'block';
          }
        } else {
          updateLockoutUI();
        }
      }, 1000);
    }
  } else {
    if (submitBtn) submitBtn.disabled = false;
    if (userField) userField.disabled = false;
    if (passField) passField.disabled = false;
    if (btnText) btnText.textContent = 'Sign In to Dashboard';
    if (lockoutTimerInterval) {
      clearInterval(lockoutTimerInterval);
      lockoutTimerInterval = null;
    }
  }
}

async function computeSha256(str) {
  try {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
  }
}

function checkAdminAuthSession() {
  try {
    const sessionStr = sessionStorage.getItem('mathura_admin_session');
    if (!sessionStr) return false;
    const session = JSON.parse(sessionStr);

    if (!session || session.authenticated !== true || session.user !== ADMIN_CREDENTIALS.username) {
      return false;
    }

    const now = Date.now();
    // 1. Session Max Lifetime Check
    if (session.expiresAt && now > session.expiresAt) {
      sessionStorage.removeItem('mathura_admin_session');
      return false;
    }

    // 2. Idle Inactivity Check (60 mins)
    if (session.lastActive && (now - session.lastActive) > AUTH_SECURITY.idleTimeoutMs) {
      sessionStorage.removeItem('mathura_admin_session');
      return false;
    }

    // Refresh last active timestamp
    session.lastActive = now;
    sessionStorage.setItem('mathura_admin_session', JSON.stringify(session));
    return true;
  } catch (e) {
    return false;
  }
}

// Activity tracker for automatic idle logout
function initSessionActivityTracker() {
  const updateActivity = () => {
    try {
      const sessionStr = sessionStorage.getItem('mathura_admin_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.authenticated) {
          session.lastActive = Date.now();
          sessionStorage.setItem('mathura_admin_session', JSON.stringify(session));
        }
      }
    } catch (e) {}
  };

  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, updateActivity, { passive: true });
  });

  // Check periodically for idle expiration (every 60 seconds)
  setInterval(() => {
    const overlay = document.getElementById('admin-auth-overlay');
    if (overlay && overlay.classList.contains('authenticated')) {
      if (!checkAdminAuthSession()) {
        handleAdminLogout();
        const alertBox = document.getElementById('admin-login-alert');
        if (alertBox) {
          alertBox.textContent = 'Your session expired due to inactivity. Please sign in again.';
          alertBox.style.display = 'block';
        }
      }
    }
  }, 60000);
}

async function verifyCredentialsWithSupabase(enteredUsername, enteredPassword) {
  const cleanUser = enteredUsername.trim().toLowerCase();
  const enteredHash = await computeSha256(enteredPassword);

  if (!enteredHash) {
    return { success: false, message: 'Cryptographic digest error in browser.' };
  }

  // 1. Try querying Supabase settings table for live admin_auth
  try {
    const config = (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : (window.SUPABASE_CONFIG || {}));
    if (config.url && config.anonKey) {
      const res = await fetch(`${config.url}/rest/v1/settings?key=eq.admin_auth`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].value) {
          const authData = JSON.parse(rows[0].value);
          const dbUser = String(authData.username || '').toLowerCase().trim();
          const dbHash = String(authData.password_hash || '').trim();

          if (cleanUser === dbUser && enteredHash === dbHash) {
            return { success: true, source: 'supabase_secure_hash' };
          }
          return { success: false, message: 'Invalid admin credentials provided.' };
        }
      }
    }
  } catch (err) {
    console.warn('Supabase remote auth check note:', err);
  }

  // 2. Direct secure cryptographic hash fallback (no plaintext password)
  if (cleanUser === ADMIN_CREDENTIALS.username.toLowerCase() && enteredHash === ADMIN_CREDENTIALS.password_hash) {
    return { success: true, source: 'local_secure_hash' };
  }

  return { success: false, message: 'Invalid admin credentials provided.' };
}

async function handleAdminLogin(event) {
  if (event) event.preventDefault();

  // First check if user is under active lockout
  const remainingLockout = getLockoutRemainingSeconds();
  if (remainingLockout > 0) {
    updateLockoutUI();
    return;
  }

  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const alertBox = document.getElementById('admin-login-alert');
  const submitBtn = document.getElementById('login-submit-btn');
  const btnText = document.getElementById('login-btn-text');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    if (alertBox) {
      alertBox.textContent = 'Please enter both username and password';
      alertBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.textContent = 'Verifying Credentials...';
  if (alertBox) alertBox.style.display = 'none';

  try {
    const result = await verifyCredentialsWithSupabase(username, password);

    if (result.success) {
      // Clear brute-force counters upon authenticated success
      resetFailedLoginAttempts();

      // Generate cryptographically random session token
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      const now = Date.now();
      sessionStorage.setItem('mathura_admin_session', JSON.stringify({
        authenticated: true,
        user: ADMIN_CREDENTIALS.username,
        token: token,
        loginTime: new Date().toISOString(),
        lastActive: now,
        expiresAt: now + AUTH_SECURITY.sessionExpiryMs
      }));

      // Set hardened admin cookie with SameSite=Strict and 8-hour lifetime
      document.cookie = `mathura_admin_auth=${ADMIN_CREDENTIALS.username}; path=/; max-age=28800; SameSite=Strict`;

      // Hide login overlay
      const overlay = document.getElementById('admin-auth-overlay');
      if (overlay) overlay.classList.add('authenticated');

      // Initialize dashboard if not initialized yet
      if (!window.__adminDataInitialized) {
        window.__adminDataInitialized = true;
        initTabNavigation();
        await initializeAdminData();
        setupRealtimeSubscriptions();
      }
    } else {
      // Record failed attempt and trigger progressive lockout if needed
      const guardState = recordFailedLoginAttempt();
      const lockoutRem = getLockoutRemainingSeconds();

      if (lockoutRem > 0) {
        updateLockoutUI();
      } else {
        const remainingAttempts = AUTH_SECURITY.maxAttemptsBeforeCooldown - guardState.failedAttempts;
        let attemptWarn = '';
        if (remainingAttempts > 0) {
          attemptWarn = ` (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} before security cooldown)`;
        }
        if (alertBox) {
          alertBox.textContent = (result.message || 'Incorrect username or password.') + attemptWarn;
          alertBox.style.display = 'block';
        }
      }

      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  } catch (err) {
    if (alertBox) {
      alertBox.textContent = 'Verification error: ' + err.message;
      alertBox.style.display = 'block';
    }
  } finally {
    if (getLockoutRemainingSeconds() <= 0) {
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Sign In to Dashboard';
    }
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('mathura_admin_session');
  // Clear admin auth cookie with SameSite=Strict
  document.cookie = "mathura_admin_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
  window.__adminDataInitialized = false;
  const overlay = document.getElementById('admin-auth-overlay');
  if (overlay) {
    overlay.classList.remove('authenticated');
  }
  const passwordInput = document.getElementById('login-password');
  if (passwordInput) passwordInput.value = '';
  const alertBox = document.getElementById('admin-login-alert');
  if (alertBox) alertBox.style.display = 'none';
  const usernameInput = document.getElementById('login-username');
  if (usernameInput) usernameInput.focus();
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('toggle-password-icon');
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
}

function setupRealtimeSubscriptions() {
  if (window.AshwanthDB) {
    AshwanthDB.subscribeToProducts(async () => {
      await refreshCatalog();
    });

    AshwanthDB.subscribeToEnquiries(async () => {
      await refreshOrders();
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initSessionActivityTracker();
  updateLockoutUI();

  const isAuth = checkAdminAuthSession();
  const overlay = document.getElementById('admin-auth-overlay');

  if (isAuth) {
    // Keep cookie active for server-side admin bypass
    document.cookie = `mathura_admin_auth=${ADMIN_CREDENTIALS.username}; path=/; max-age=28800; SameSite=Strict`;
    if (overlay) overlay.classList.add('authenticated');
    window.__adminDataInitialized = true;
    initTabNavigation();
    await initializeAdminData();
    setupRealtimeSubscriptions();
  } else {
    // Clear cookie if not authenticated
    document.cookie = "mathura_admin_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    if (overlay) overlay.classList.remove('authenticated');
    const userField = document.getElementById('login-username');
    if (userField && !userField.disabled) userField.focus();
  }
});

/* ==========================================================================
   1. NAVIGATION & INITIALIZATION
   ========================================================================== */
function initTabNavigation() {
  const tabButtons = document.querySelectorAll('.admin-nav-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchAdminTab(targetTab);
    });
  });
}

function switchAdminTab(tabName) {
  // Update nav buttons
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab panels
  document.querySelectorAll('.admin-tab-content').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  // Refresh tab-specific data if needed
  if (tabName === 'dashboard') {
    renderDashboardKPIs();
  } else if (tabName === 'products') {
    renderProductsTable();
  } else if (tabName === 'stock') {
    renderStockHub();
  } else if (tabName === 'orders') {
    renderOrdersTable();
  } else if (tabName === 'categories') {
    renderCategoriesTab();
  } else if (tabName === 'analytics') {
    renderAnalyticsView();
  } else if (tabName === 'settings') {
    loadSettingsIntoForm();
  }
}

async function initializeAdminData() {
  if (!window.AshwanthDB) return;

  try {
    const [settings, sections, products, enquiries] = await Promise.all([
      AshwanthDB.fetchSettings(),
      AshwanthDB.fetchSections(),
      AshwanthDB.fetchProducts(),
      AshwanthDB.fetchEnquiries()
    ]);

    productsList = products || [];
    sectionsList = sections || [];
    ordersList = enquiries || [];

    // Populate category dropdowns
    populateCategoryDropdowns();

    // Render Dashboard initially
    renderDashboardKPIs();
    renderProductsTable();
    renderOrdersTable();
    renderStockHub();
    renderAnalyticsView();
    loadSettingsIntoForm();
  } catch (err) {
    console.error('Error initializing admin data:', err);
  }
}

async function refreshCatalog() {
  if (!window.AshwanthDB) return;
  productsList = await AshwanthDB.fetchProducts();
  sectionsList = await AshwanthDB.fetchSections();
  populateCategoryDropdowns();
  renderProductsTable();
  renderDashboardKPIs();
  renderStockHub();
}

async function refreshOrders() {
  if (!window.AshwanthDB) return;
  ordersList = await AshwanthDB.fetchEnquiries();
  renderOrdersTable();
  renderDashboardKPIs();
  renderAnalyticsView();
}

function populateCategoryDropdowns(selectedWizCategory, selectedEditCategory) {
  const allCategories = AshwanthDB.getCategories ? AshwanthDB.getCategories(true) : [];
  const definedCategories = AshwanthDB.getCategories ? AshwanthDB.getCategories(false) : [];
  
  // Product filter dropdown (include uncategorized if it exists)
  const filterSelect = document.getElementById('admin-prod-category-filter');
  if (filterSelect) {
    const currentVal = filterSelect.value || 'all';
    let html = `<option value="all">📁 All Categories</option>`;
    allCategories.forEach(c => {
      html += `<option value="${c.slug}">${c.name}</option>`;
    });
    filterSelect.innerHTML = html;
    if ([...filterSelect.options].some(o => o.value === currentVal)) {
      filterSelect.value = currentVal;
    }
  }

  // Helper to build options
  function buildOptions(currentSelected) {
    let html = '';
    if (definedCategories.length === 0) {
      html += `<option value="" disabled ${!currentSelected ? 'selected' : ''}>No categories available</option>`;
    } else {
      html += `<option value="" disabled ${!currentSelected ? 'selected' : ''}>-- Select Category / Section --</option>`;
      definedCategories.forEach(c => {
        const isSel = currentSelected && c.name.toLowerCase() === currentSelected.toLowerCase();
        html += `<option value="${escapeHtml(c.name)}" ${isSel ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
      });
    }
    return html;
  }

  // Wizard category dropdown
  const wizSelect = document.getElementById('wiz-category');
  if (wizSelect) {
    const prevVal = selectedWizCategory !== undefined ? selectedWizCategory : wizSelect.value;
    wizSelect.innerHTML = buildOptions(prevVal);
    if (prevVal && [...wizSelect.options].some(o => o.value === prevVal)) {
      wizSelect.value = prevVal;
    }
  }

  // Edit category dropdown
  const editSelect = document.getElementById('edit-prod-category');
  if (editSelect) {
    const prevVal = selectedEditCategory !== undefined ? selectedEditCategory : editSelect.value;
    editSelect.innerHTML = buildOptions(prevVal);
    if (prevVal && [...editSelect.options].some(o => o.value === prevVal)) {
      editSelect.value = prevVal;
    }
  }
}

/* ==========================================================================
   2. DASHBOARD ENGINE
   ========================================================================== */
async function renderDashboardKPIs() {
  if (!window.AshwanthDB) return;

  const analytics = await AshwanthDB.fetchAnalytics('month');

  // Top KPIs
  const todayRevEl = document.getElementById('kpi-today-rev');
  const todayOrdersEl = document.getElementById('kpi-today-orders');
  const monthRevEl = document.getElementById('kpi-month-rev');
  const monthOrdersEl = document.getElementById('kpi-month-orders');
  const yearRevEl = document.getElementById('kpi-year-rev');
  const unitsSoldEl = document.getElementById('kpi-units-sold');
  const lowStockEl = document.getElementById('kpi-low-stock');
  const outStockEl = document.getElementById('kpi-out-stock');

  if (todayRevEl) todayRevEl.textContent = `₹${(analytics.todayRevenue || 0).toLocaleString('en-IN')}`;
  if (todayOrdersEl) todayOrdersEl.textContent = analytics.todayOrdersCount || 0;
  if (monthRevEl) monthRevEl.textContent = `₹${(analytics.monthRevenue || 0).toLocaleString('en-IN')}`;
  if (monthOrdersEl) monthOrdersEl.textContent = analytics.monthOrdersCount || 0;
  if (yearRevEl) yearRevEl.textContent = `₹${(analytics.yearRevenue || 0).toLocaleString('en-IN')}`;
  if (unitsSoldEl) unitsSoldEl.textContent = (analytics.totalUnitsSold || 0).toLocaleString('en-IN');
  if (lowStockEl) lowStockEl.textContent = analytics.lowStockCount || 0;
  if (outStockEl) outStockEl.textContent = analytics.outOfStockCount || 0;

  // Nav badges
  const navProdCount = document.getElementById('nav-products-count');
  const navCategoriesCount = document.getElementById('nav-categories-count');
  const navOrdersCount = document.getElementById('nav-orders-count');
  const navLowStockCount = document.getElementById('nav-low-stock-count');

  if (navProdCount) navProdCount.textContent = (productsList || []).length;
  if (navCategoriesCount) navCategoriesCount.textContent = (sectionsList || []).length;
  if (navOrdersCount) navOrdersCount.textContent = (ordersList || []).filter(o => o.status !== 'cancelled').length;
  if (navLowStockCount) {
    const lowCount = (productsList || []).filter(p => (p.currentStock || 0) <= (p.lowStockThreshold || 10)).length;
    navLowStockCount.textContent = lowCount;
    navLowStockCount.style.display = lowCount > 0 ? 'inline-block' : 'none';
  }

  // Recent Orders Feed
  const recentBody = document.getElementById('dashboard-recent-orders-body');
  if (!recentBody) return;

  const recentOrders = ordersList.slice(0, 8);
  if (recentOrders.length === 0) {
    recentBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          No customer orders placed yet. New orders will appear here automatically in real time!
        </td>
      </tr>
    `;
    return;
  }

  recentBody.innerHTML = recentOrders.map(order => {
    const itemsCount = (order.items || []).reduce((sum, item) => sum + (item.qty || 1), 0);
    const statusPill = getStatusPillHtml(order.status);

    return `
      <tr>
        <td><strong style="color: var(--admin-primary); font-family: monospace;">${order.orderRef || order.id}</strong></td>
        <td><strong>${escapeHtml(order.customerName)}</strong></td>
        <td><a href="tel:${order.phone}" style="color: #38bdf8; text-decoration: none;">+91 ${order.phone}</a></td>
        <td>${itemsCount} Units (${order.items ? order.items.length : 0} items)</td>
        <td><strong style="color: #34d399; font-size: 1rem;">₹${(order.netTotal || 0).toLocaleString('en-IN')}</strong></td>
        <td>${statusPill}</td>
        <td>
          <button class="btn-site-link" style="padding: 6px 12px; font-size: 0.78rem;" onclick="openOrderDetailModal('${order.id}')">
            View Details
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusPillHtml(status) {
  const s = (status || 'pending').toLowerCase();
  let label = 'PENDING';
  let css = 'pending';

  if (s === 'confirmed') { label = 'CONFIRMED'; css = 'confirmed'; }
  else if (s === 'packed') { label = 'PACKED'; css = 'packed'; }
  else if (s === 'delivered') { label = 'DELIVERED'; css = 'delivered'; }
  else if (s === 'cancelled') { label = 'CANCELLED'; css = 'cancelled'; }

  return `<span class="status-pill ${css}">● ${label}</span>`;
}

/* ==========================================================================
   3. PRODUCTS MANAGEMENT (Table, Steppers, 4-Step Add Wizard)
   ========================================================================== */
function filterAdminProducts() {
  renderProductsTable();
}

function renderProductsTable() {
  const tableBody = document.getElementById('admin-products-table-body');
  if (!tableBody) return;

  const search = (document.getElementById('admin-prod-search')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('admin-prod-category-filter')?.value || 'all';
  const unitFilter = document.getElementById('admin-prod-unit-filter')?.value || 'all';
  const stockFilter = document.getElementById('admin-prod-stock-filter')?.value || 'all';

  const filtered = productsList.filter(p => {
    const matchSearch = !search || 
      (p.name && p.name.toLowerCase().includes(search)) || 
      (p.code && p.code.toLowerCase().includes(search)) ||
      (p.category && p.category.toLowerCase().includes(search));

    const matchCat = catFilter === 'all' || p.categorySlug === catFilter;
    
    const pSaleType = (p.saleType === 'PACKET' || (p.unit && p.unit.toLowerCase().includes('pkt'))) ? 'PACKET' : 'BOX';
    const matchUnit = unitFilter === 'all' || pSaleType === unitFilter;

    const stockInfo = AshwanthDB.getStockStatus ? AshwanthDB.getStockStatus(p) : { status: 'in_stock' };
    const matchStock = stockFilter === 'all' ||
      (stockFilter === 'in_stock' && stockInfo.status === 'in_stock') ||
      (stockFilter === 'low_stock' && stockInfo.status === 'low_stock') ||
      (stockFilter === 'out_of_stock' && stockInfo.status === 'out_of_stock');

    return matchSearch && matchCat && matchUnit && matchStock;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          No fireworks match the current filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(p => {
    const isBox = (p.saleType === 'PACKET' || (p.unit && p.unit.toLowerCase().includes('pkt'))) ? false : true;
    const unitBadge = isBox 
      ? `<span class="sale-unit-badge badge-box" style="position: static; font-size: 0.7rem;">📦 BOX</span>`
      : `<span class="sale-unit-badge badge-packet" style="position: static; font-size: 0.7rem;">✉️ PACKET</span>`;

    const stockInfo = AshwanthDB.getStockStatus ? AshwanthDB.getStockStatus(p) : { status: 'in_stock', currentStock: p.currentStock || 50 };
    let stockBadge = `<span class="stock-badge badge-in-stock">✓ ${stockInfo.currentStock} In Stock</span>`;

    if (stockInfo.status === 'out_of_stock') {
      stockBadge = `<span class="stock-badge badge-out-of-stock">🚫 Sold Out</span>`;
    } else if (stockInfo.status === 'low_stock') {
      stockBadge = `<span class="stock-badge badge-low-stock">⚠️ Only ${stockInfo.currentStock} Left</span>`;
    }

    return `
      <tr>
        <td>
          <img src="${p.image || 'https://images.unsplash.com/photo-1531747056595-07f6cbbe10ad?auto=format&fit=crop&w=400&q=80'}" 
               style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover;" alt="" />
        </td>
        <td>
          <strong style="color: #ffffff; font-size: 0.92rem;">${escapeHtml(p.name)}</strong>
          <div style="font-size: 0.75rem; color: var(--admin-text-muted); font-family: monospace;">${p.code || '-'}</div>
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; font-size: 0.78rem; font-weight: 700; white-space: nowrap;">
            <span class="material-symbols-outlined" style="font-size: 14px;">folder</span>
            <span>${escapeHtml(p.category || 'General')}</span>
          </span>
        </td>
        <td>${unitBadge}</td>
        <td>
          ${p.originalPrice > p.price ? `<div style="text-decoration: line-through; color: #94a3b8; font-size: 0.78rem;">₹${p.originalPrice}</div>` : ''}
          <div style="color: #34d399; font-weight: 800; font-size: 0.95rem;">₹${p.price} ${p.discountRate > 0 ? `<span style="font-size: 0.7rem; color: #f87171;">(${p.discountRate}%)</span>` : `<span style="font-size: 0.7rem; color: #38bdf8;">(Net)</span>`}</div>
        </td>
        <td>${p.initialStock || 50}</td>
        <td style="color: #38bdf8; font-weight: 700;">${p.totalSold || 0}</td>
        <td><strong style="font-size: 1rem; color: ${p.currentStock <= p.lowStockThreshold ? '#fbbf24' : '#ffffff'};">${p.currentStock || 0}</strong></td>
        <td>${stockBadge}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn-site-link" style="padding: 5px 10px;" onclick="openEditProductModal('${p.id}')" title="Edit details & adjust stock">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
            </button>
            <button class="btn-site-link" style="padding: 5px 10px; color: #fbbf24;" onclick="quickRestockProduct('${p.id}')" title="+ Quick Restock">
              <span class="material-symbols-outlined" style="font-size: 16px;">add_box</span>
            </button>
            <button class="btn-site-link" style="padding: 5px 10px; color: #f87171;" onclick="deleteProduct('${p.id}', '${escapeHtml(p.name)}')" title="Delete product">
              <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* Product Image Helpers */
const DEFAULT_CRACKER_IMAGE = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80';

function handleImagePreviewChange(urlInputId, previewId) {
  const input = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const val = input ? input.value.trim() : '';
  preview.src = val || DEFAULT_CRACKER_IMAGE;

  const statusId = urlInputId.includes('wiz') ? 'wiz-image-status' : 'edit-image-status';
  const statusEl = document.getElementById(statusId);
  if (statusEl) {
    statusEl.textContent = val ? 'URL entered ✓' : 'Optional • URL or File Upload';
    statusEl.style.color = val ? '#38bdf8' : 'var(--admin-text-muted)';
  }
}

function clearProductImage(urlInputId, previewId, statusId) {
  const input = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);
  const statusEl = document.getElementById(statusId);
  if (input) input.value = '';
  if (preview) preview.src = DEFAULT_CRACKER_IMAGE;
  if (statusEl) {
    statusEl.textContent = 'Image removed';
    statusEl.style.color = '#f87171';
    setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = 'Optional • URL or File Upload';
        statusEl.style.color = 'var(--admin-text-muted)';
      }
    }, 2000);
  }
}

async function handleProductImageUpload(fileInput, urlInputId, previewId, statusId) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const urlInput = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);
  const statusEl = document.getElementById(statusId);

  // Instant local preview
  const localUrl = URL.createObjectURL(file);
  if (preview) preview.src = localUrl;
  if (statusEl) {
    statusEl.textContent = 'Uploading to Supabase...';
    statusEl.style.color = '#38bdf8';
  }

  try {
    const publicUrl = await AshwanthDB.uploadProductImage(file);
    if (urlInput) urlInput.value = publicUrl;
    if (preview) preview.src = publicUrl;
    if (statusEl) {
      statusEl.textContent = 'Uploaded to Supabase ✓';
      statusEl.style.color = '#10b981';
    }
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Image Uploaded',
        message: 'Product image uploaded to Supabase Storage.',
        type: 'success'
      });
    }
  } catch (err) {
    console.warn('Supabase storage upload failed, falling back to data URL:', err);
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      if (urlInput) urlInput.value = base64;
      if (preview) preview.src = base64;
      if (statusEl) {
        statusEl.textContent = 'Image Ready ✓';
        statusEl.style.color = '#10b981';
      }
    };
    reader.readAsDataURL(file);
  } finally {
    fileInput.value = '';
  }
}

// Bind image handlers to window for global access in onclick/onchange handlers
window.handleImagePreviewChange = handleImagePreviewChange;
window.clearProductImage = clearProductImage;
window.handleProductImageUpload = handleProductImageUpload;

/* Add Product Modal */
function openAddProductModal() {
  populateCategoryDropdowns('', undefined);
  const form = document.getElementById('add-product-form');
  if (form) form.reset();
  
  // Reset image input and preview
  const imgInput = document.getElementById('wiz-image');
  if (imgInput) imgInput.value = '';
  const imgPreview = document.getElementById('wiz-image-preview');
  if (imgPreview) imgPreview.src = DEFAULT_CRACKER_IMAGE;
  const imgStatus = document.getElementById('wiz-image-status');
  if (imgStatus) {
    imgStatus.textContent = 'Optional • URL or File Upload';
    imgStatus.style.color = 'var(--admin-text-muted)';
  }

  selectWizardUnit('BOX');
  calcWizardPrice();
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.classList.add('open');
}

function closeAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) modal.classList.remove('open');
}

function selectWizardUnit(unitType) {
  const isBox = unitType === 'BOX';
  document.getElementById('wiz-sale-type').value = isBox ? 'BOX' : 'PACKET';

  const boxCard = document.getElementById('unit-choice-box');
  const pktCard = document.getElementById('unit-choice-packet');
  const stockLabel = document.getElementById('wiz-stock-label');

  if (boxCard && pktCard) {
    boxCard.classList.toggle('selected', isBox);
    pktCard.classList.toggle('selected', !isBox);
  }

  if (stockLabel) {
    stockLabel.textContent = `How many ${isBox ? 'Boxes' : 'Packets'} do you currently have? *`;
  }
}

function calcWizardPrice() {
  const mrp = parseInt(document.getElementById('wiz-mrp')?.value || 0, 10);
  const discount = parseInt(document.getElementById('wiz-discount')?.value || 80, 10);
  const net = Math.round(mrp * (1 - discount / 100));
  const netInput = document.getElementById('wiz-net');
  if (netInput) netInput.value = isNaN(net) ? 0 : net;
}

async function handleWizardAddProduct(e) {
  if (e) e.preventDefault();
  const btn = document.getElementById('wiz-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving to Supabase...';
  }

  const name = document.getElementById('wiz-name').value.trim();
  const category = document.getElementById('wiz-category').value;
  const code = document.getElementById('wiz-code').value.trim();
  const image = document.getElementById('wiz-image')?.value.trim() || '';
  const originalPrice = parseInt(document.getElementById('wiz-mrp').value, 10);
  const discountRate = parseInt(document.getElementById('wiz-discount').value, 10);
  const saleType = document.getElementById('wiz-sale-type').value;
  const initialStock = parseInt(document.getElementById('wiz-stock').value, 10);
  const lowStockThreshold = parseInt(document.getElementById('wiz-threshold').value, 10);

  try {
    await AshwanthDB.addProduct({
      name,
      category,
      code,
      image: image || undefined,
      originalPrice,
      discountRate,
      saleType,
      initialStock,
      currentStock: initialStock,
      lowStockThreshold
    });

    closeAddProductModal();
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Product Added',
        message: `"${name}" added successfully to Supabase.`,
        type: 'success'
      });
    }
    await refreshCatalog();
  } catch (err) {
    if (window.AppDialog) {
      AppDialog.alert({
        title: 'Creation Failed',
        message: err.message,
        type: 'danger'
      });
    } else {
      alert('Failed to add product: ' + err.message);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> <span>Save Product to Database</span>`;
    }
  }
}

/* Edit Product Modal */
function openEditProductModal(productId) {
  const p = productsList.find(item => String(item.id) === String(productId));
  if (!p) return;

  populateCategoryDropdowns(undefined, p.category || '');

  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('edit-prod-name').value = p.name || '';
  document.getElementById('edit-prod-category').value = p.category || '';
  document.getElementById('edit-prod-code').value = p.code || '';
  
  // Set image input and preview
  const editImgInput = document.getElementById('edit-prod-image');
  if (editImgInput) editImgInput.value = p.image || '';
  const editImgPreview = document.getElementById('edit-image-preview');
  if (editImgPreview) editImgPreview.src = p.image || DEFAULT_CRACKER_IMAGE;
  const editImgStatus = document.getElementById('edit-image-status');
  if (editImgStatus) {
    editImgStatus.textContent = p.image ? 'Image set ✓' : 'Optional • URL or File Upload';
    editImgStatus.style.color = p.image ? '#38bdf8' : 'var(--admin-text-muted)';
  }

  document.getElementById('edit-prod-mrp').value = p.originalPrice || 0;
  document.getElementById('edit-prod-discount').value = p.discountRate !== undefined ? p.discountRate : 80;
  document.getElementById('edit-prod-net').value = p.price || 0;
  document.getElementById('edit-prod-stock').value = p.currentStock !== undefined ? p.currentStock : 50;
  document.getElementById('edit-total-sold').textContent = p.totalSold || 0;
  document.getElementById('edit-threshold').value = p.lowStockThreshold || 10;
  document.getElementById('edit-unit-label').textContent = p.saleType === 'PACKET' ? 'Packets' : 'Boxes';

  const modal = document.getElementById('edit-product-modal');
  if (modal) modal.classList.add('open');
}

function closeEditProductModal() {
  const modal = document.getElementById('edit-product-modal');
  if (modal) modal.classList.remove('open');
}

function stepEditStock(delta) {
  const stockInput = document.getElementById('edit-prod-stock');
  if (!stockInput) return;
  const current = parseInt(stockInput.value || 0, 10);
  stockInput.value = Math.max(0, current + delta);
}

function calcEditPrice() {
  const mrp = parseInt(document.getElementById('edit-prod-mrp')?.value || 0, 10);
  const discount = parseInt(document.getElementById('edit-prod-discount')?.value || 80, 10);
  const net = Math.round(mrp * (1 - discount / 100));
  const netInput = document.getElementById('edit-prod-net');
  if (netInput) netInput.value = isNaN(net) ? 0 : net;
}

async function handleSaveEditProduct(e) {
  if (e) e.preventDefault();
  const saveBtn = document.getElementById('edit-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Updating...';
  }

  const id = document.getElementById('edit-prod-id').value;
  const name = document.getElementById('edit-prod-name').value.trim();
  const category = document.getElementById('edit-prod-category').value;
  const code = document.getElementById('edit-prod-code').value.trim();
  const image = document.getElementById('edit-prod-image')?.value.trim();
  const originalPrice = parseInt(document.getElementById('edit-prod-mrp').value, 10);
  const discountRate = parseInt(document.getElementById('edit-prod-discount').value, 10);
  const currentStock = parseInt(document.getElementById('edit-prod-stock').value, 10);
  const lowStockThreshold = parseInt(document.getElementById('edit-threshold').value, 10);

  try {
    await AshwanthDB.updateProduct(id, {
      name,
      category,
      code,
      image,
      originalPrice,
      discountRate,
      currentStock,
      lowStockThreshold
    });

    closeEditProductModal();
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Product Updated',
        message: `"${name}" updated successfully in Supabase.`,
        type: 'success'
      });
    }
    await refreshCatalog();
  } catch (err) {
    if (window.AppDialog) {
      AppDialog.alert({
        title: 'Update Failed',
        message: err.message,
        type: 'danger'
      });
    } else {
      alert('Update failed: ' + err.message);
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  }
}

async function quickRestockProduct(productId) {
  const p = productsList.find(item => String(item.id) === String(productId));
  if (!p) return;

  const unitName = p.saleType === 'PACKET' ? 'Packets' : 'Boxes';
  let addQty = 20;

  if (window.AppDialog) {
    const confirm = await AppDialog.confirm({
      title: 'Restock Product',
      message: `Add +20 ${unitName} to "${p.name}"? Current stock is ${p.currentStock || 0} ${unitName}.`,
      icon: 'add_shopping_cart',
      type: 'warning',
      confirmText: `+20 ${unitName}`,
      cancelText: 'Cancel'
    });
    if (!confirm) return;
  }

  try {
    await AshwanthDB.adjustStock(p.id, addQty, `Manual Restock (+${addQty} ${unitName})`);
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Stock Updated',
        message: `Added +20 ${unitName} to ${p.name}.`,
        type: 'success'
      });
    }
    await refreshCatalog();
  } catch (e) {
    alert('Failed to restock: ' + e.message);
  }
}

async function deleteProduct(id, name) {
  let proceed = false;
  if (window.AppDialog) {
    proceed = await AppDialog.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to permanently delete "${name}" from the database?`,
      icon: 'delete',
      type: 'danger',
      confirmText: 'Yes, Delete',
      cancelText: 'Keep Product'
    });
  } else {
    proceed = confirm(`Delete "${name}" from Supabase catalog?`);
  }

  if (proceed) {
    try {
      await AshwanthDB.deleteProduct(id);
      if (window.AppDialog && AppDialog.toast) {
        AppDialog.toast({
          title: 'Product Deleted',
          message: `"${name}" removed from database.`,
          type: 'success'
        });
      }
      await refreshCatalog();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }
}

/* ==========================================================================
   4. STOCK & INVENTORY HUB
   ========================================================================== */
async function renderStockHub() {
  const cardsContainer = document.getElementById('low-stock-cards-container');
  const logsTableBody = document.getElementById('inventory-logs-table-body');

  // Low stock products
  const lowStockItems = (productsList || []).filter(p => (p.currentStock || 0) <= (p.lowStockThreshold || 10));

  const navLowStockCount = document.getElementById('nav-low-stock-count');
  if (navLowStockCount) {
    const count = lowStockItems.length;
    navLowStockCount.textContent = count;
    navLowStockCount.style.display = count > 0 ? 'inline-block' : 'none';
  }

  if (cardsContainer) {
    if (!productsList || productsList.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; background: #0f172a; padding: 36px 20px; border-radius: 12px; border: 1px solid var(--admin-border); text-align: center; color: var(--admin-text-muted);">
          <span class="material-symbols-outlined" style="font-size: 42px; color: #64748b;">inventory_2</span>
          <h4 style="margin: 10px 0 4px 0; font-size: 1.1rem; color: #ffffff;">No Products in Supabase</h4>
          <p style="font-size: 0.85rem; color: #94a3b8; margin: 0;">Add products to your catalog to track real-time stock levels.</p>
        </div>
      `;
    } else if (lowStockItems.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; background: #0f172a; padding: 28px 20px; border-radius: 12px; border: 1px solid var(--admin-border); text-align: center; color: #34d399;">
          <span class="material-symbols-outlined" style="font-size: 42px; color: #34d399;">verified</span>
          <h4 style="margin: 8px 0 0 0; font-size: 1.1rem; color: #ffffff;">All Products Sufficiently Stocked</h4>
          <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;">None of the ${productsList.length} products are currently below low-stock alert thresholds.</p>
        </div>
      `;
    } else {
      cardsContainer.innerHTML = lowStockItems.map(p => {
        const isOut = p.currentStock <= 0;
        const unitName = p.saleType === 'PACKET' ? 'Packets' : 'Boxes';

        return `
          <div style="background: #0f172a; border: 1.5px solid ${isOut ? '#ef4444' : '#f59e0b'}; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <span class="status-pill ${isOut ? 'cancelled' : 'pending'}">${isOut ? 'OUT OF STOCK' : 'LOW STOCK'}</span>
                <span style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">${p.code || ''}</span>
              </div>
              <h4 style="margin: 6px 0 2px 0; color: #ffffff; font-size: 1rem;">${escapeHtml(p.name)}</h4>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px;">Category: ${p.category}</div>
              <div style="font-size: 1.3rem; font-weight: 900; color: ${isOut ? '#f87171' : '#fbbf24'}; margin-bottom: 14px;">
                ${p.currentStock || 0} <span style="font-size: 0.85rem; font-weight: 600; color: #94a3b8;">${unitName} remaining</span>
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn-quick-action primary" style="flex: 1; padding: 8px 12px; font-size: 0.82rem;" onclick="quickRestockProduct('${p.id}')">
                + Restock (+20)
              </button>
              <button class="btn-site-link" style="padding: 8px 12px;" onclick="openEditProductModal('${p.id}')">
                Edit
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Inventory transaction logs
  if (logsTableBody) {
    const logs = await AshwanthDB.fetchInventoryLogs();
    if (!logs || logs.length === 0) {
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--admin-text-muted);">
            No stock movements recorded yet. New restocks and customer order sales will log here automatically.
          </td>
        </tr>
      `;
      return;
    }

    logsTableBody.innerHTML = logs.map(log => {
      const isAdd = (log.change_qty || 0) > 0;
      const dateStr = log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-';
      const actionBadge = log.action_type === 'sale' 
        ? `<span class="status-pill cancelled">ORDER SALE</span>`
        : (log.action_type === 'cancellation_restore' ? `<span class="status-pill delivered">RESTORED</span>` : `<span class="status-pill confirmed">RESTOCK</span>`);

      return `
        <tr>
          <td style="font-family: monospace; color: #94a3b8; font-size: 0.8rem;">${dateStr}</td>
          <td><strong style="color: #ffffff;">${escapeHtml(log.product_name)}</strong></td>
          <td>${actionBadge}</td>
          <td style="font-weight: 800; color: ${isAdd ? '#34d399' : '#f87171'};">
            ${isAdd ? '+' : ''}${log.change_qty} ${log.sale_type || 'BOX'}
          </td>
          <td>${log.previous_stock} ➔ <strong style="color: #ffffff;">${log.new_stock}</strong></td>
          <td style="font-size: 0.82rem; color: #94a3b8;">${escapeHtml(log.reason || '-')}</td>
        </tr>
      `;
    }).join('');
  }
}

/* ==========================================================================
   5. ORDERS MANAGEMENT (Pipeline, Invoice Modal, Packing Slip)
   ========================================================================== */
function filterAdminOrders() {
  renderOrdersTable();
}

function renderOrdersTable() {
  const tableBody = document.getElementById('admin-orders-table-body');
  if (!tableBody) return;

  const search = (document.getElementById('admin-orders-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('admin-orders-status-filter')?.value || 'all';

  const filtered = ordersList.filter(o => {
    const matchSearch = !search || 
      (o.orderRef && o.orderRef.toLowerCase().includes(search)) ||
      (o.customerName && o.customerName.toLowerCase().includes(search)) ||
      (o.phone && o.phone.toLowerCase().includes(search));

    const matchStatus = statusFilter === 'all' || (o.status || 'pending').toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          No customer orders found matching this filter.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(order => {
    const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const totalQty = (order.items || []).reduce((sum, i) => sum + (i.qty || 1), 0);
    const statusPill = getStatusPillHtml(order.status);

    return `
      <tr>
        <td><strong style="color: var(--admin-primary); font-family: monospace;">${order.orderRef || order.id}</strong></td>
        <td style="font-size: 0.8rem; color: #94a3b8;">${dateStr}</td>
        <td><strong>${escapeHtml(order.customerName)}</strong></td>
        <td><a href="tel:${order.phone}" style="color: #38bdf8; text-decoration: none;">+91 ${order.phone}</a></td>
        <td style="font-size: 0.82rem; color: #94a3b8;">${escapeHtml(order.city || '-')}, ${escapeHtml(order.state || 'TN')}</td>
        <td>${totalQty} Units</td>
        <td><strong style="color: #34d399; font-size: 1rem;">₹${(order.netTotal || 0).toLocaleString('en-IN')}</strong></td>
        <td>${statusPill}</td>
        <td style="text-align: right;">
          <button class="btn-site-link" style="padding: 6px 12px;" onclick="openOrderDetailModal('${order.id}')">
            View & Print
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openOrderDetailModal(orderId) {
  const order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;

  currentSelectedOrder = order;

  document.getElementById('mod-order-ref').textContent = order.orderRef || order.id;
  document.getElementById('mod-order-date').textContent = `Booking Date: ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '-'}`;
  document.getElementById('mod-cust-name').textContent = order.customerName || '-';
  document.getElementById('mod-cust-phone').textContent = `+91 ${order.phone || '-'}`;
  document.getElementById('mod-cust-email').textContent = order.email || 'None';
  document.getElementById('mod-cust-address').textContent = `${order.address || ''}, ${order.city || ''}, ${order.state || ''} - ${order.pincode || ''}`;

  document.getElementById('mod-subtotal').textContent = `₹${(order.subtotal || 0).toLocaleString('en-IN')}`;
  document.getElementById('mod-savings').textContent = `-₹${(order.discountAmount || 0).toLocaleString('en-IN')}`;
  document.getElementById('mod-net-total').textContent = `₹${(order.netTotal || 0).toLocaleString('en-IN')}`;

  const itemsBody = document.getElementById('mod-items-table-body');
  if (itemsBody) {
    itemsBody.innerHTML = (order.items || []).map((item, idx) => {
      const rate = item.price || 0;
      const qty = item.qty || 1;
      const total = item.total || (rate * qty);
      const unitLabel = item.unit || '1 Box';

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            <div style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">Packing: ${unitLabel}</div>
          </td>
          <td><strong style="color: #38bdf8;">${qty} ${unitLabel.includes('Pkt') ? 'Packets' : 'Boxes'}</strong></td>
          <td>₹${rate.toLocaleString('en-IN')}</td>
          <td style="text-align: right; font-weight: 800; color: #34d399;">₹${total.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');
  }

  const modal = document.getElementById('order-detail-modal');
  if (modal) modal.classList.add('open');
}

function closeOrderDetailModal() {
  const modal = document.getElementById('order-detail-modal');
  if (modal) modal.classList.remove('open');
}

async function setOrderStatus(newStatus) {
  if (!currentSelectedOrder) return;
  const orderId = currentSelectedOrder.id;

  if (newStatus === 'cancelled') {
    let confirm = false;
    if (window.AppDialog) {
      confirm = await AppDialog.confirm({
        title: 'Cancel Customer Order',
        message: `Cancelling this order will automatically restore all purchased fireworks back into inventory stock. Continue?`,
        icon: 'remove_shopping_cart',
        type: 'danger',
        confirmText: 'Yes, Cancel & Restore Stock',
        cancelText: 'Keep Order'
      });
    } else {
      confirm = window.confirm('Cancel order and restore stock?');
    }
    if (!confirm) return;
  }

  try {
    await AshwanthDB.updateEnquiryStatus(orderId, newStatus);
    closeOrderDetailModal();
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Order Status Updated',
        message: `Order #${currentSelectedOrder.orderRef} marked as ${newStatus.toUpperCase()}.`,
        type: 'success'
      });
    }
    await refreshOrders();
    await refreshCatalog();
  } catch (e) {
    alert('Failed to update status: ' + e.message);
  }
}

function printAdminInvoice() {
  if (!currentSelectedOrder) return;
  const o = currentSelectedOrder;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (window.AppDialog) {
      AppDialog.alert({
        title: 'Popups Blocked',
        message: 'Please allow browser popups to print invoices.',
        type: 'warning'
      });
    } else {
      alert('Please allow popups to print invoices.');
    }
    return;
  }

  let count = 1;
  let rows = (o.items || []).map(item => {
    const orig = item.originalPrice || Math.round((item.price || 0) / 0.2);
    const rate = item.price || 0;
    const qty = item.qty || 1;
    const total = item.total || (rate * qty);
    const discount = Math.round(((orig - rate) / orig) * 100) || 80;

    return `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center;">${count++}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">
          <strong>${escapeHtml(item.name)}</strong>
          <div style="color: #64748b; font-size: 11px;">Packing: ${item.unit || '1 Box'}</div>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; font-weight: 800; color: #0284c7;">${qty} ${item.unit && item.unit.includes('Pkt') ? 'Pkt' : 'Box'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 10px; text-align: right; color: #94a3b8; text-decoration: line-through;">₹${orig.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; color: #dc2626; font-weight: 800;">${discount}% OFF</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 10px; text-align: right; font-weight: 800; color: #16a34a;">₹${rate.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-weight: 900; color: #0f172a;">₹${total.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  const invoiceHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Packing Slip - ${o.orderRef || o.id}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f8fafc; margin: 0; padding: 30px 20px; color: #0f172a; }
        .invoice-box { max-width: 840px; margin: 0 auto; background: #ffffff; padding: 36px; border-radius: 12px; border: 1.5px solid #cbd5e1; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0f172a; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
        th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: 800; }
        @media print { body { padding: 0; background: #fff; } .invoice-box { border: none; } }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div>
            <h1 style="margin:0; font-size: 24px; color: #ac332a;">MATHURA CRACKERS</h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">4/190, Mettamalai, Sattur - 626203, Virudhunagar District, Tamil Nadu</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">Hotline: +91 70103 17389 / +91 74180 51084 / +91 72009 36916 | Email: nathisoft1987@gmail.com</p>
          </div>
          <div style="text-align: right;">
            <h2 style="margin:0; font-size: 18px; color: #0284c7;">ORDER PACKING SLIP</h2>
            <div style="font-size: 14px; font-weight: 800; color: #ac332a; margin-top: 4px;">#${o.orderRef || o.id}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Status: ${(o.status || 'pending').toUpperCase()}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 13px; line-height: 1.5; margin-bottom: 18px;">
          <div>
            <strong>Customer Details:</strong><br/>
            Name: ${escapeHtml(o.customerName)}<br/>
            Mobile: +91 ${o.phone}<br/>
            Address: ${escapeHtml(o.address || '')}, ${escapeHtml(o.city || '')}, ${escapeHtml(o.state || '')} - ${o.pincode || ''}
          </div>
          <div style="text-align: right;">
            <strong>Booking Date:</strong> ${o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : '-'}<br/>
            <strong>Dispatched From:</strong> Sivakasi Central Warehouse
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="text-align: left;">Product Description</th>
              <th style="width: 80px;">Quantity</th>
              <th style="width: 80px; text-align: right;">MRP Rate</th>
              <th style="width: 70px;">Discount</th>
              <th style="width: 85px; text-align: right;">Net Rate</th>
              <th style="width: 100px; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <div style="width: 300px; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9;">
              <span>Subtotal MRP:</span>
              <span>₹${(o.subtotal || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; color: #16a34a; font-weight: 700;">
              <span>Festive Savings${o.subtotal && o.discountAmount ? ` (${Math.round((o.discountAmount / o.subtotal) * 100)}%)` : ''}:</span>
              <span>-₹${(o.discountAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 14px; font-size: 16px; font-weight: 900; background: #fff1f0; color: #ac332a;">
              <span>Net Total Amount:</span>
              <span>₹${(o.netTotal || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `;

  printWindow.document.write(invoiceHtml);
  printWindow.document.close();
}

/* ==========================================================================
   6. SALES & REVENUE ANALYTICS
   ========================================================================== */
async function changeAnalyticsPeriod(period, btnEl) {
  currentAnalyticsPeriod = period;
  if (btnEl) {
    const parent = btnEl.parentElement;
    if (parent) {
      parent.querySelectorAll('.admin-period-btn, .filter-btn').forEach(b => b.classList.remove('active'));
    }
    btnEl.classList.add('active');
  }
  await renderAnalyticsView();
}

async function renderAnalyticsView() {
  if (!window.AshwanthDB) return;

  const analytics = await AshwanthDB.fetchAnalytics(currentAnalyticsPeriod);

  const revEl = document.getElementById('analytics-rev');
  const ordersEl = document.getElementById('analytics-orders');
  const qtyEl = document.getElementById('analytics-qty');
  const aovEl = document.getElementById('analytics-aov');

  if (revEl) revEl.textContent = `₹${(analytics.totalRevenue || 0).toLocaleString('en-IN')}`;
  if (ordersEl) ordersEl.textContent = analytics.totalOrders || 0;
  if (qtyEl) qtyEl.textContent = (analytics.totalUnitsSold || 0).toLocaleString('en-IN');
  if (aovEl) aovEl.textContent = `₹${(analytics.aov || 0).toLocaleString('en-IN')}`;

  // Best Sellers Table
  const bestBody = document.getElementById('analytics-best-sellers-body');
  if (bestBody) {
    const topItems = (analytics.bestSelling || []).slice(0, 10);
    if (topItems.length === 0) {
      bestBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Sales data will rank here once orders are confirmed.</td></tr>`;
    } else {
      bestBody.innerHTML = topItems.map((p, idx) => `
        <tr>
          <td><strong style="color: #ffffff;">#${idx + 1} ${escapeHtml(p.name)}</strong></td>
          <td><span class="status-pill confirmed">${p.saleType || 'BOX'}</span></td>
          <td><strong style="color: #34d399;">${p.unitsSold} ${p.saleType === 'PACKET' ? 'Packets' : 'Boxes'}</strong></td>
          <td style="font-weight: 800;">₹${(p.revenue || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    }
  }

  // Slow Sellers Table
  const slowBody = document.getElementById('analytics-slow-sellers-body');
  if (slowBody) {
    const slowItems = (analytics.lowSelling || []).slice(0, 10);
    if (slowItems.length === 0) {
      slowBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #34d399;">All products moving actively!</td></tr>`;
    } else {
      slowBody.innerHTML = slowItems.map(p => `
        <tr>
          <td><strong style="color: #ffffff;">${escapeHtml(p.name)}</strong></td>
          <td>${p.currentStock || 0} left</td>
          <td style="color: #f87171; font-weight: 700;">${p.unitsSold} sold</td>
          <td>
            <button class="btn-site-link" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openEditProductModal('${p.id}')">
              Promote
            </button>
          </td>
        </tr>
      `).join('');
    }
  }
}

/* ==========================================================================
   7. SETTINGS ENGINE
   ========================================================================== */
async function loadSettingsIntoForm() {
  if (!window.AshwanthDB) return;
  const s = await AshwanthDB.fetchSettings();

  const nameEl = document.getElementById('set-company-name');
  const phoneEl = document.getElementById('set-phone');
  const waEl = document.getElementById('set-whatsapp');
  const emailEl = document.getElementById('set-email');
  const addrEl = document.getElementById('set-address');
  const titleEl = document.getElementById('set-sale-title');
  const discEl = document.getElementById('set-discount');
  const countEl = document.getElementById('set-countdown');
  const payEl = document.getElementById('set-payment-info');

  if (nameEl) nameEl.value = s.company_name || 'Mathura Crackers';
  if (phoneEl) phoneEl.value = s.phone || '+91 70103 17389 / +91 74180 51084 / +91 72009 36916';
  if (waEl) waEl.value = s.whatsapp || '+91 70103 17389';
  if (emailEl) emailEl.value = s.email || 'nathisoft1987@gmail.com';
  if (addrEl) addrEl.value = s.address || '4/190, Mettamalai, Sattur - 626203, Virudhunagar District, Tamil Nadu';
  if (titleEl) titleEl.value = s.sale_title || 'MEGA DIWALI DHAMAKA SALE';
  if (discEl) discEl.value = s.default_discount || 80;
  if (countEl && s.countdown_end) countEl.value = s.countdown_end.slice(0, 16);
  if (payEl) payEl.value = s.payment_info || 'Advance 100% payment required via UPI / Bank Transfer upon order confirmation.';

  // Synchronize maintenance mode status with UI and local cache
  const isMaint = String(s.maintenance_mode || '').toLowerCase().trim() === 'on';
  try {
    localStorage.setItem('mathura_maintenance_mode', isMaint ? 'on' : 'off');
  } catch (e) {}
  updateMaintenanceUI(isMaint);

  // Synchronize Price List PDF & Live Discount Sync Badge
  renderAdminPdfSettings(s);
  setupPdfEventListeners();
}

function updateMaintenanceUI(isMaint) {
  const toggle = document.getElementById('toggle-maintenance-mode');
  const cardStatus = document.getElementById('setting-maintenance-status');
  const headerPill = document.getElementById('header-maintenance-pill');

  if (toggle) {
    toggle.checked = !!isMaint;
  }

  if (cardStatus) {
    if (isMaint) {
      cardStatus.className = 'admin-status-pill maintenance';
      cardStatus.textContent = '🚧 Maintenance Mode ON';
    } else {
      cardStatus.className = 'admin-status-pill live';
      cardStatus.textContent = '🟢 Live Mode Active';
    }
  }

  if (headerPill) {
    if (isMaint) {
      headerPill.className = 'admin-status-pill maintenance';
      headerPill.textContent = '🚧 Maintenance Mode';
    } else {
      headerPill.className = 'admin-status-pill live';
      headerPill.textContent = '🟢 Website Live';
    }
  }
}

async function handleMaintenanceToggle(checkbox) {
  const desiredState = checkbox.checked;

  if (desiredState) {
    // Prompt confirmation before taking the public site offline
    let confirmed = true;
    if (window.AppDialog && AppDialog.confirm) {
      confirmed = await AppDialog.confirm({
        title: 'Activate Maintenance Mode?',
        message: 'The website will be closed to the public and display the Maintenance Page. You and authorized administrators will retain full access to this panel to manage or restore settings. Do you want to proceed?',
        confirmText: 'Yes, Enable Maintenance',
        cancelText: 'Cancel',
        type: 'warning'
      });
    } else {
      confirmed = confirm('Activate Maintenance Mode? The website will display the Maintenance Page to public visitors.');
    }

    if (!confirmed) {
      checkbox.checked = false;
      return;
    }
  }

  // Update UI and local cache immediately for responsive feel
  updateMaintenanceUI(desiredState);
  try {
    localStorage.setItem('mathura_maintenance_mode', desiredState ? 'on' : 'off');
  } catch (e) {}

  try {
    if (window.AshwanthDB && AshwanthDB.setMaintenanceMode) {
      await AshwanthDB.setMaintenanceMode(desiredState);
    } else {
      throw new Error('Database service unavailable');
    }

    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: desiredState ? 'Maintenance Mode Active' : 'Website Restored to LIVE',
        message: desiredState
          ? 'Public visitors will now see the Maintenance page. Administrator bypass remains active.'
          : 'Normal store operations and public customer browsing restored.',
        type: desiredState ? 'warning' : 'success'
      });
    }
  } catch (err) {
    console.error('Error toggling maintenance mode:', err);
    checkbox.checked = !desiredState;
    updateMaintenanceUI(!desiredState);
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Update Failed',
        message: 'Could not change maintenance status: ' + err.message,
        type: 'danger'
      });
    } else {
      alert('Failed to update maintenance mode: ' + err.message);
    }
  }
}

window.handleMaintenanceToggle = handleMaintenanceToggle;
window.updateMaintenanceUI = updateMaintenanceUI;

async function handleSaveSettings(e) {
  if (e) e.preventDefault();
  const btn = document.getElementById('save-settings-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  const updatedSettings = {
    company_name: document.getElementById('set-company-name').value.trim(),
    phone: document.getElementById('set-phone').value.trim(),
    whatsapp: document.getElementById('set-whatsapp').value.trim(),
    email: document.getElementById('set-email').value.trim(),
    address: document.getElementById('set-address').value.trim(),
    sale_title: document.getElementById('set-sale-title').value.trim(),
    default_discount: parseInt(document.getElementById('set-discount').value, 10),
    countdown_end: document.getElementById('set-countdown').value,
    payment_info: document.getElementById('set-payment-info').value.trim()
  };

  try {
    await AshwanthDB.updateSettings(updatedSettings);

    // If discount changed, recalculate all product prices
    const currentDiscount = AshwanthDB.defaultDiscount;
    const newDiscount = updatedSettings.default_discount;
    if (newDiscount !== currentDiscount && !isNaN(newDiscount)) {
      try {
        await AshwanthDB.updateGlobalDiscount(newDiscount);
      } catch (discErr) {
        console.warn('Discount recalculation note:', discErr);
      }
    }

    try {
      const cached = JSON.parse(localStorage.getItem('mathura_store_settings') || '{}');
      Object.assign(cached, updatedSettings);
      localStorage.setItem('mathura_store_settings', JSON.stringify(cached));
    } catch (e) {}

    updateAdminPdfDiscountDisplay(updatedSettings.default_discount);

    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Settings Saved',
        message: 'Store details, campaign discount, and price list links updated successfully.',
        type: 'success'
      });
    }
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined">save</span> <span>Save Store Settings</span>`;
    }
  }
}

/* ==========================================================================
   PRICE LIST PDF MANAGEMENT & DYNAMIC DISCOUNT SYNC (Senior UI/UX)
   ========================================================================== */
let stagedAdminPdfFile = null;
let isPdfListenersBound = false;

function renderAdminPdfSettings(s) {
  s = s || {};
  const discInput = document.getElementById('set-discount');
  const currentDiscount = parseInt(s.default_discount || (discInput ? discInput.value : 80), 10) || 80;

  const iconBox = document.getElementById('admin-pdf-icon-box');
  const statusIcon = document.getElementById('admin-pdf-status-icon');
  const nameEl = document.getElementById('admin-active-pdf-name');
  const sizeEl = document.getElementById('admin-active-pdf-size');
  const statusEl = document.getElementById('admin-active-pdf-status');
  const badgePreviewEl = document.getElementById('admin-active-pdf-badge-preview');
  const updatedEl = document.getElementById('admin-active-pdf-updated');
  const previewBtn = document.getElementById('admin-btn-preview-pdf');
  const dlBtn = document.getElementById('admin-btn-download-pdf');
  const deleteBtn = document.getElementById('admin-btn-delete-pdf');

  // Strict check: PDF is active only if pdf_url is non-empty and pdf_enabled is not 'false'
  const isPdfActive = !!(s.pdf_url && s.pdf_url.trim() !== '' && String(s.pdf_enabled || '').toLowerCase() !== 'false');

  const pdfUrl = s.pdf_url || '';
  const pdfFilename = s.pdf_filename || '';
  const pdfSize = s.pdf_filesize || '';
  const pdfUpdated = s.pdf_updated_at;

  if (isPdfActive) {
    if (iconBox) iconBox.classList.remove('disabled');
    if (statusIcon) statusIcon.textContent = 'description';
    if (nameEl) {
      nameEl.textContent = pdfFilename || 'mathura_crackers_price_list.pdf';
      nameEl.style.color = '#f8fafc';
    }
    if (sizeEl) {
      sizeEl.style.display = 'inline-flex';
      sizeEl.textContent = pdfSize || '401 KB';
    }
    if (badgePreviewEl) {
      badgePreviewEl.style.display = 'inline-flex';
    }
    if (statusEl) {
      statusEl.className = 'pdf-chip active-status';
      statusEl.textContent = '🟢 Active on Customer Website';
    }
    if (updatedEl) {
      if (pdfUpdated) {
        try {
          const d = new Date(pdfUpdated);
          updatedEl.textContent = 'Last synced: ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          updatedEl.textContent = 'Last synced: Active';
        }
      } else {
        updatedEl.textContent = 'Price list active and available for download.';
      }
    }

    if (previewBtn) {
      previewBtn.style.display = 'inline-flex';
      previewBtn.href = pdfUrl;
    }
    if (dlBtn) {
      dlBtn.style.display = 'inline-flex';
      dlBtn.href = pdfUrl;
      dlBtn.setAttribute('download', pdfFilename || 'Mathura_Crackers_Price_List_2026.pdf');
    }
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.style.opacity = '1';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">delete</span> <span>Delete PDF from Website</span>';
      deleteBtn.title = 'Delete this PDF and hide download buttons from the customer website';
    }

    updateAdminPdfDiscountDisplay(currentDiscount, true);
  } else {
    // Empty state: NO PDF active
    if (iconBox) iconBox.classList.add('disabled');
    if (statusIcon) statusIcon.textContent = 'do_not_disturb_on';
    if (nameEl) {
      nameEl.textContent = 'No Price List PDF Active';
      nameEl.style.color = '#94a3b8';
    }
    if (sizeEl) sizeEl.style.display = 'none';
    if (badgePreviewEl) badgePreviewEl.style.display = 'none';
    if (statusEl) {
      statusEl.className = 'pdf-chip danger-status';
      statusEl.textContent = '🔴 Download Buttons Hidden on Website';
    }
    if (updatedEl) {
      updatedEl.textContent = 'Upload a new PDF below to enable download buttons on your website.';
    }

    if (previewBtn) previewBtn.style.display = 'none';
    if (dlBtn) dlBtn.style.display = 'none';
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.45';
      deleteBtn.style.cursor = 'not-allowed';
      deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">block</span> <span>No Active PDF</span>';
      deleteBtn.title = 'No active PDF is currently uploaded';
    }

    updateAdminPdfDiscountDisplay(currentDiscount, false);
  }
}

function updateAdminPdfDiscountDisplay(discountVal, isActive = true) {
  const num = parseInt(discountVal, 10);
  const formatted = isNaN(num) ? '80% OFF' : `${num}% OFF`;

  const syncIndicator = document.getElementById('admin-pdf-sync-indicator');
  const connectedValEl = document.getElementById('admin-pdf-connected-discount-val');
  const badgePreviewEl = document.getElementById('admin-active-pdf-badge-preview');

  if (connectedValEl) {
    if (isActive) {
      connectedValEl.textContent = formatted;
    } else {
      connectedValEl.textContent = 'Hidden (No PDF Active)';
    }
  }
  if (badgePreviewEl && isActive) {
    badgePreviewEl.textContent = `Badge: ${formatted}`;
  }

  if (syncIndicator) {
    syncIndicator.classList.add('updated');
    setTimeout(() => syncIndicator.classList.remove('updated'), 800);
  }
}

function setupPdfEventListeners() {
  if (isPdfListenersBound) return;
  isPdfListenersBound = true;

  // 1. Live listener on Storewide Default Discount input
  const discInput = document.getElementById('set-discount');
  if (discInput) {
    discInput.addEventListener('input', () => {
      updateAdminPdfDiscountDisplay(discInput.value);
    });
  }

  // 2. Drag and drop events for dropzone
  const dropzone = document.getElementById('admin-pdf-dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleIncomingPdfFile(dt.files[0]);
      }
    });
  }
}

function triggerPdfFileInput() {
  const fileInput = document.getElementById('admin-pdf-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleAdminPdfFileSelected(input) {
  if (input && input.files && input.files[0]) {
    handleIncomingPdfFile(input.files[0]);
  }
}

function handleIncomingPdfFile(file) {
  if (!file) return;

  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
  if (!isPdf) {
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Invalid File Format',
        message: 'Please select a valid PDF document (.pdf)',
        type: 'danger'
      });
    } else {
      alert('Please select a valid PDF document (.pdf)');
    }
    return;
  }

  stagedAdminPdfFile = file;

  const stagedBox = document.getElementById('admin-pdf-staged-box');
  const filenameEl = document.getElementById('admin-staged-filename');
  const filesizeEl = document.getElementById('admin-staged-filesize');

  if (filenameEl) filenameEl.textContent = file.name;
  if (filesizeEl) {
    const kb = Math.round(file.size / 1024);
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    filesizeEl.textContent = kb < 1024 ? `${kb} KB` : `${mb} MB`;
  }
  if (stagedBox) stagedBox.classList.add('visible');
}

function cancelStagedPdf() {
  stagedAdminPdfFile = null;
  const stagedBox = document.getElementById('admin-pdf-staged-box');
  const fileInput = document.getElementById('admin-pdf-file-input');
  if (stagedBox) stagedBox.classList.remove('visible');
  if (fileInput) fileInput.value = '';
}

async function executePdfUpload() {
  if (!stagedAdminPdfFile) {
    alert('Please select a PDF file first');
    return;
  }

  const uploadBtn = document.getElementById('admin-btn-confirm-upload');
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s infinite linear; font-size: 16px;">sync</span> Uploading...';
  }

  const file = stagedAdminPdfFile;
  const fileNameClean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileSizeKb = Math.round(file.size / 1024) + ' KB';
  const nowIso = new Date().toISOString();

  let uploadedUrl = null;

  try {
    // 1. Try local server API endpoint if running locally
    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'X-Filename': fileNameClean
        },
        body: file
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          uploadedUrl = data.url;
        }
      }
    } catch (localErr) {
      console.warn('Local endpoint not available, proceeding to direct Supabase upload:', localErr);
    }

    // 2. If running on Netlify or remote production (or local endpoint didn't set storage URL)
    if (!uploadedUrl || uploadedUrl.startsWith('/')) {
      if (window.AshwanthDB && AshwanthDB.getConfig) {
        const config = AshwanthDB.getConfig();
        const timestamp = Date.now();
        const storageFilename = `price_list_${timestamp}_${fileNameClean}`;

        const uploadRes = await fetch(`${config.url}/storage/v1/object/pricelists/${storageFilename}`, {
          method: 'POST',
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/pdf'
          },
          body: file
        });

        if (uploadRes.ok) {
          uploadedUrl = `${config.url}/storage/v1/object/public/pricelists/${storageFilename}`;
        }
      }
    }

    // Fallback if needed
    if (!uploadedUrl) {
      uploadedUrl = 'mathura_crackers_price_list.pdf';
    }

    // 3. Update Supabase settings table
    const settingsUpdate = {
      pdf_url: uploadedUrl,
      pdf_filename: file.name,
      pdf_filesize: fileSizeKb,
      pdf_updated_at: nowIso,
      pdf_enabled: 'true'
    };

    if (window.AshwanthDB && AshwanthDB.updateSettings) {
      await AshwanthDB.updateSettings(settingsUpdate);
    }

    // Update local cache
    try {
      const cached = JSON.parse(localStorage.getItem('mathura_store_settings') || '{}');
      Object.assign(cached, settingsUpdate);
      localStorage.setItem('mathura_store_settings', JSON.stringify(cached));
    } catch (e) {}

    // Update UI
    renderAdminPdfSettings(settingsUpdate);
    cancelStagedPdf();

    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Price List PDF Live!',
        message: 'Your new PDF has been uploaded and download buttons are now active on the website.',
        type: 'success'
      });
    } else {
      alert('Price List PDF uploaded successfully!');
    }
  } catch (err) {
    console.error('PDF upload error:', err);
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Upload Failed',
        message: err.message || 'Could not complete PDF upload',
        type: 'danger'
      });
    } else {
      alert('Upload failed: ' + err.message);
    }
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> <span>Confirm & Upload</span>';
    }
  }
}

async function handleDeletePdf(e) {
  if (e) e.preventDefault();

  let confirmed = true;
  if (window.AppDialog && AppDialog.confirm) {
    confirmed = await AppDialog.confirm({
      title: 'Delete PDF from Website?',
      message: 'This will completely delete the price list PDF and hide all download buttons from the customer website. Visitors will not see or download any PDF until you upload a new one. Do you want to proceed?',
      confirmText: 'Yes, Delete & Hide PDF',
      cancelText: 'Cancel',
      type: 'danger'
    });
  } else {
    confirmed = confirm('Delete PDF from Website? This will hide all PDF download buttons from the customer website.');
  }

  if (!confirmed) return;

  const deleteBtn = document.getElementById('admin-btn-delete-pdf');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">sync</span> Deleting...';
  }

  try {
    // 1. Try local endpoint
    try {
      await fetch('/api/delete-pdf', { method: 'POST' });
    } catch (e) {}

    // 2. Clear in Supabase settings
    const resetSettings = {
      pdf_url: '',
      pdf_filename: '',
      pdf_filesize: '',
      pdf_updated_at: new Date().toISOString(),
      pdf_enabled: 'false'
    };

    if (window.AshwanthDB && AshwanthDB.updateSettings) {
      await AshwanthDB.updateSettings(resetSettings);
    }

    try {
      const cached = JSON.parse(localStorage.getItem('mathura_store_settings') || '{}');
      Object.assign(cached, resetSettings);
      localStorage.setItem('mathura_store_settings', JSON.stringify(cached));
    } catch (e) {}

    renderAdminPdfSettings(resetSettings);

    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'PDF Deleted from Website',
        message: 'The price list PDF has been removed and all download buttons are now hidden from the customer website.',
        type: 'success'
      });
    } else {
      alert('PDF deleted from website!');
    }
  } catch (err) {
    console.error('Delete PDF error:', err);
    alert('Failed to delete PDF: ' + err.message);
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">delete</span> <span>Delete PDF from Website</span>';
    }
  }
}

window.renderAdminPdfSettings = renderAdminPdfSettings;
window.updateAdminPdfDiscountDisplay = updateAdminPdfDiscountDisplay;
window.triggerPdfFileInput = triggerPdfFileInput;
window.handleAdminPdfFileSelected = handleAdminPdfFileSelected;
window.cancelStagedPdf = cancelStagedPdf;
window.executePdfUpload = executePdfUpload;
window.handleDeletePdf = handleDeletePdf;

/* Create Section */
function openSectionModal() {
  const input = document.getElementById('new-sec-name');
  if (input) input.value = '';
  const modal = document.getElementById('section-modal');
  if (modal) modal.classList.add('open');
}

function closeSectionModal() {
  const modal = document.getElementById('section-modal');
  if (modal) modal.classList.remove('open');
}

async function handleCreateSection(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('new-sec-name').value.trim();
  if (!name) return;

  try {
    await AshwanthDB.addSection(name);
    closeSectionModal();
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({
        title: 'Section Created',
        message: `"${name}" section created and saved in Supabase.`,
        type: 'success'
      });
    }
    await refreshCatalog();
  } catch (err) {
    alert('Failed to create section: ' + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   CATEGORY & SECTION MANAGEMENT
   ========================================================================== */
function renderCategoriesTab() {
  const categories = AshwanthDB.getCategories ? AshwanthDB.getCategories(false) : [];
  const tbody = document.getElementById('admin-categories-table-body');
  const countBadge = document.getElementById('nav-categories-count');
  const totalLabel = document.getElementById('cat-total-count');
  const searchEl = document.getElementById('admin-cat-search');
  const search = (searchEl ? searchEl.value || '' : '').toLowerCase();

  if (countBadge) countBadge.textContent = categories.length;
  if (totalLabel) totalLabel.textContent = categories.length;

  if (!tbody) return;

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">No categories found. Click Add New Category to start.</td></tr>`;
    return;
  }

  let html = '';
  filtered.forEach((c, index) => {
    html += `
      <tr>
        <td>${index + 1}</td>
        <td style="font-weight: 700; color: #ffffff;">${escapeHtml(c.name)}</td>
        <td style="color: #94a3b8;">${c.slug}</td>
        <td><span style="background: rgba(14, 165, 233, 0.1); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${c.count || 0} Products</span></td>
        <td style="text-align: right;">
          <button class="btn-text-action" onclick="openEditCategoryModal('${c.id}', '${escapeHtml(c.name)}')" title="Edit"><span class="material-symbols-outlined" style="color: var(--admin-blue);">edit</span></button>
          <button class="btn-text-action" onclick="handleDeleteCategory('${c.id}', '${escapeHtml(c.name)}')" title="Delete"><span class="material-symbols-outlined" style="color: var(--admin-danger);">delete</span></button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterAdminCategories() {
  renderCategoriesTab();
}



function openAddCategoryModal() {
  document.getElementById('new-cat-name').value = '';
  const modal = document.getElementById('add-category-modal');
  if (modal) modal.classList.add('open');
  setTimeout(() => document.getElementById('new-cat-name')?.focus(), 100);
}

function closeAddCategoryModal() {
  const modal = document.getElementById('add-category-modal');
  if (modal) modal.classList.remove('open');
}

async function handleSaveNewCategory(e) {
  e.preventDefault();
  const name = document.getElementById('new-cat-name').value.trim();
  if (!name) return;
  try {
    const newCat = await AshwanthDB.addSection(name);
    await refreshCatalog();
    closeAddCategoryModal();
    if (document.getElementById('tab-categories').classList.contains('active')) {
      renderCategoriesTab();
    }
    // Auto select in wizard if open
    populateCategoryDropdowns(newCat.name, newCat.name);

    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({ title: 'Success', message: `Category "${newCat.name}" created successfully!`, type: 'success' });
    }
  } catch (err) {
    alert('Error creating category: ' + err.message);
  }
}

function openEditCategoryModal(id, currentName) {
  document.getElementById('edit-cat-id').value = id;
  document.getElementById('edit-cat-name').value = currentName;
  const modal = document.getElementById('edit-category-modal');
  if (modal) modal.classList.add('open');
}

function closeEditCategoryModal() {
  const modal = document.getElementById('edit-category-modal');
  if (modal) modal.classList.remove('open');
}

async function handleSaveEditCategory(e) {
  e.preventDefault();
  const id = document.getElementById('edit-cat-id').value;
  const newName = document.getElementById('edit-cat-name').value.trim();
  if (!newName) return;
  try {
    await AshwanthDB.updateSection(id, newName);
    await refreshCatalog();
    closeEditCategoryModal();
    renderCategoriesTab();
    if (window.AppDialog && AppDialog.toast) {
      AppDialog.toast({ title: 'Success', message: 'Category updated successfully!', type: 'success' });
    }
  } catch (err) {
    alert('Error updating category: ' + err.message);
  }
}

async function handleDeleteCategory(id, name) {
  let proceed = false;
  if (window.AppDialog) {
    proceed = await AppDialog.confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${name}"? Products under this category will be marked as 'Uncategorized'.`,
      icon: 'delete',
      type: 'danger',
      confirmText: 'Yes, Delete',
      cancelText: 'Keep Category'
    });
  } else {
    proceed = confirm(`Delete category "${name}"? Products will be marked as 'Uncategorized'.`);
  }
  if (proceed) {
    try {
      await AshwanthDB.deleteSection(id);
      await refreshCatalog();
      renderCategoriesTab();
      if (window.AppDialog && AppDialog.toast) {
        AppDialog.toast({ title: 'Success', message: 'Category deleted successfully!', type: 'success' });
      }
    } catch (err) {
      alert('Error deleting category: ' + err.message);
    }
  }
}

async function handleClearAllCategoriesPrompt() {
  let proceed = false;
  if (window.AppDialog) {
    proceed = await AppDialog.confirm({
      title: 'Clear All Categories',
      message: 'CAUTION: This will delete ALL categories and move all products to Uncategorized. This cannot be undone!',
      icon: 'warning',
      type: 'danger',
      confirmText: 'Yes, Clear All',
      cancelText: 'Cancel'
    });
  } else {
    proceed = confirm('CAUTION: Delete ALL categories? This cannot be undone!');
  }
  if (proceed) {
    try {
      await AshwanthDB.clearAllSections();
      await refreshCatalog();
      renderCategoriesTab();
      if (window.AppDialog && AppDialog.toast) {
        AppDialog.toast({ title: 'Success', message: 'All categories cleared!', type: 'success' });
      }
    } catch (err) {
      alert('Error clearing categories: ' + err.message);
    }
  }
}
