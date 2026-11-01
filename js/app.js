/**
 * Mathura Crackers - Core App Interactivity & Catalog Engine
 * Supports Dynamic Sections, PACKET vs BOX Inventory, Stock Badges, and Search/Filters
 */

window.localQtyState = window.localQtyState || {};
let isPageTransitioning = false;
let navProgressBar = null;
let isStickyHeaderBound = false;
let isBottomNavBound = false;
let isPageTransitionsBound = false;
let countdownIntervalId = null;

async function checkMaintenanceClientGuard() {
  const currentPath = window.location.pathname.toLowerCase();
  if (currentPath.includes('admin.html') || currentPath.includes('maintenance.html')) {
    return;
  }

  // Instant check from local cache
  try {
    if (localStorage.getItem('mathura_maintenance_mode') === 'on') {
      window.location.replace('maintenance.html');
      return;
    }
  } catch (e) {}

  if (window.AshwanthDB && AshwanthDB.getMaintenanceMode) {
    try {
      const isMaint = await AshwanthDB.getMaintenanceMode();
      try {
        localStorage.setItem('mathura_maintenance_mode', isMaint ? 'on' : 'off');
      } catch (e) {}
      if (isMaint) {
        window.location.replace('maintenance.html');
      }
    } catch (e) {}
  }
}

function startApp() {
  checkMaintenanceClientGuard();
  initDynamicStoreSettings();
  initStickyHeader();
  initBottomNav();
  initDiwaliCountdown();
  initCatalogEngine();
  initScrollAnimations();
  initPageTransitions();
}

/**
 * Dynamically binds Storewide Discount (%) and Price List PDF to all website places
 */
async function initDynamicStoreSettings() {
  function applyStoreSettings(settings) {
    if (!settings) return;
    const discount = parseInt(settings.default_discount, 10) || 80;
    const isPdfActive = !!(settings.pdf_url && settings.pdf_url.trim() !== '' && String(settings.pdf_enabled || '').toLowerCase() !== 'false');
    const pdfUrl = settings.pdf_url || '';
    const pdfFilename = settings.pdf_filename || 'Mathura_Crackers_Price_List_2026.pdf';

    // 1. Control visibility of PDF download buttons across the entire website
    const pdfElements = document.querySelectorAll('#mobile-sub-header-strip, #floating-pdf-cta-btn, .mobile-sub-header-strip, .floating-pdf-cta');
    if (!isPdfActive) {
      document.body.classList.add('pdf-disabled');
      pdfElements.forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('aria-hidden', 'true');
      });
    } else {
      document.body.classList.remove('pdf-disabled');
      pdfElements.forEach(el => {
        el.style.removeProperty('display');
        el.removeAttribute('aria-hidden');
      });
    }

    // 2. Dynamic Discount Badges on Mobile Strip, Desktop CTA, and Hero
    document.querySelectorAll('.sub-strip-discount').forEach(el => {
      el.textContent = `${discount}% OFF`;
    });

    document.querySelectorAll('.floating-pdf-subline').forEach(el => {
      el.textContent = `Download PDF • ${discount}% OFF`;
    });

    document.querySelectorAll('.hero-float-badge-main').forEach(el => {
      el.textContent = `FLAT ${discount}% OFF`;
    });

    document.querySelectorAll('.dynamic-discount-val').forEach(el => {
      el.textContent = `${discount}%`;
    });

    // 3. Net Payable discount label in enquiry / estimate summary if present
    const netPayLabel = document.getElementById('enquiry-net-payable-label');
    if (netPayLabel) {
      netPayLabel.textContent = `Net Payable (${discount}% Off)`;
    }

    // 4. Dynamic PDF Download URL, filename, and titles across all pages (only if active)
    if (isPdfActive) {
      const pdfLinks = document.querySelectorAll('#mobile-sub-header-strip, #floating-pdf-cta-btn, a[href*="price_list.pdf"], a[download*="price_list" i], a[download*="Price_List" i]');
      pdfLinks.forEach(link => {
        link.href = pdfUrl;
        link.setAttribute('download', pdfFilename);
        link.setAttribute('title', `Download 2026 Price List PDF (${discount}% OFF)`);
        const aria = link.getAttribute('aria-label');
        if (aria && aria.includes('discount')) {
          link.setAttribute('aria-label', `Download Mathura Crackers 2026 Price List PDF with ${discount}% discount`);
        }
      });
    }
  }

  // Instant render from local cache if available (zero flicker)
  try {
    const cached = localStorage.getItem('mathura_store_settings');
    if (cached) {
      applyStoreSettings(JSON.parse(cached));
    }
  } catch (e) {}

  // Fetch latest settings from Supabase Cloud DB
  if (window.AshwanthDB && AshwanthDB.fetchSettings) {
    try {
      const s = await AshwanthDB.fetchSettings();
      if (s) {
        applyStoreSettings(s);
        try {
          localStorage.setItem('mathura_store_settings', JSON.stringify(s));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('initDynamicStoreSettings fetch notice:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

/* 1. Sticky Header */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  if (isStickyHeaderBound) return;
  isStickyHeaderBound = true;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

/* 2. Mobile Bottom Navigation - Smooth Transitions & Active State */
function initBottomNav() {
  const navContainer = document.querySelector('.mobile-bottom-nav-container');
  if (!navContainer) return;

  const items = Array.from(navContainer.querySelectorAll('.bottom-nav-item'));
  if (items.length === 0) return;

  // Determine active item dynamically based on current window location
  const currentPath = window.location.pathname.replace(/^\//, '').split('?')[0].split('#')[0] || 'index.html';
  items.forEach(item => {
    const href = (item.getAttribute('href') || '').replace(/^\//, '').split('?')[0].split('#')[0] || 'index.html';
    if (href === currentPath || (currentPath === 'index.html' && (href === '' || href === 'index.html'))) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    } else {
      item.classList.remove('active');
      item.removeAttribute('aria-current');
    }
  });

  if (isBottomNavBound) return;
  isBottomNavBound = true;

  // Handle tap / click on bottom navigation items with event delegation
  navContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.bottom-nav-item');
    if (!item) return;

    // Don't intercept modified clicks (new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.which === 2) return;

    const targetHref = item.getAttribute('href');
    if (!targetHref) return;

    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to prevent duplicate document click handler invocation

    const cur = window.location.pathname.replace(/^\//, '').split('?')[0].split('#')[0] || 'index.html';
    const dest = targetHref.replace(/^\//, '').split('?')[0].split('#')[0] || 'index.html';

    // Same page click: smoothly scroll to top
    if (cur === dest) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Immediately update active visual classes
    items.forEach(it => {
      if (it === item) {
        it.classList.add('active');
        it.setAttribute('aria-current', 'page');
      } else {
        it.classList.remove('active');
        it.removeAttribute('aria-current');
      }
    });

    if (typeof window.navigateToPage === 'function') {
      window.navigateToPage(targetHref);
    } else {
      window.location.href = targetHref;
    }
  });
}

/* 3. Diwali Festive Countdown Timer (Synced with Database Settings) */
async function initDiwaliCountdown() {
  const daysEl = document.getElementById('timer-days');
  const hoursEl = document.getElementById('timer-hours');
  const minsEl = document.getElementById('timer-minutes');
  const secsEl = document.getElementById('timer-seconds');
  const titleEl = document.getElementById('sale-banner-title');

  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }

  if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

  let targetDate = new Date('2026-11-08T23:59:59');

  if (window.AshwanthDB) {
    try {
      const settings = await AshwanthDB.fetchSettings();
      if (settings && settings.countdown_end) {
        const parsed = new Date(settings.countdown_end);
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed;
        }
      }
      if (settings && settings.sale_title && titleEl) {
        titleEl.textContent = settings.sale_title;
      }
    } catch (e) {}
  }

  function updateTimer() {
    const current = new Date().getTime();
    const diff = targetDate.getTime() - current;

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(minutes).padStart(2, '0');
    secsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateTimer();
  countdownIntervalId = setInterval(updateTimer, 1000);
}

/* 4. Quantity Selection & Enquiry Actions (Image-Free Accessible Shopping) */
window.localQtyState = window.localQtyState || {};

window.getLocalQty = function(id) {
  if (!id) return 1;
  const inCart = (window.AshwanthCart && window.AshwanthCart.cart && window.AshwanthCart.cart[id]) || 0;
  if (inCart > 0) return inCart;
  if (typeof window.localQtyState[id] === 'number') {
    return Math.max(1, window.localQtyState[id]);
  }
  return 1;
};

window.changeLocalQty = function(id, delta) {
  if (!id) return;
  const item = (window.AshwanthCart && window.AshwanthCart.getItem) ? window.AshwanthCart.getItem(id) : null;
  const maxStock = (item && typeof item.currentStock === 'number') ? item.currentStock : 9999;
  const isBox = !item || item.saleType !== 'PACKET';
  const unitSingle = isBox ? 'BOX' : 'PKT';
  const unitPlural = isBox ? 'BOXES' : 'PKTS';

  const inCart = (window.AshwanthCart && window.AshwanthCart.cart && window.AshwanthCart.cart[id]) || 0;

  if (inCart > 0) {
    // If product is already in the enquiry list, adjusting updates the live cart
    const newQty = inCart + delta;
    if (newQty <= 0) {
      window.removeFromEnquiryFromCard(id);
    } else {
      if (newQty > maxStock) {
        if (window.AppDialog && AppDialog.toast) {
          AppDialog.toast({
            title: 'Stock Limit Reached',
            message: `Only ${maxStock} ${isBox ? 'Boxes' : 'Packets'} available in stock.`,
            type: 'warning'
          });
        }
        return;
      }
      window.AshwanthCart.setQty(id, newQty);
      window.localQtyState[id] = newQty;
    }
  } else {
    // Product is NOT yet in enquiry list:
    // DO NOT add product to enquiry list accidentally! Just change selected quantity on card.
    const current = window.localQtyState[id] || 1;
    let next = current + delta;
    if (next < 1) next = 1; // Cannot be negative or zero before adding
    if (next > maxStock) {
      next = maxStock;
      if (window.AppDialog && AppDialog.toast) {
        AppDialog.toast({
          title: 'Stock Limit Reached',
          message: `Only ${maxStock} ${isBox ? 'Boxes' : 'Packets'} available in stock.`,
          type: 'warning'
        });
      }
    }
    window.localQtyState[id] = next;

    // Immediately update DOM on card
    const numEl = document.getElementById(`qty-num-${id}`);
    const unitEl = document.getElementById(`qty-unit-${id}`);
    if (numEl) numEl.textContent = next;
    if (unitEl) unitEl.textContent = next === 1 ? unitSingle : unitPlural;
  }
};

window.addToEnquiryFromCard = function(id) {
  if (!id || !window.AshwanthCart) return;
  const item = window.AshwanthCart.getItem(id);
  const targetQty = window.localQtyState[id] || 1;
  window.AshwanthCart.setQty(id, targetQty);

  if (window.AppDialog && AppDialog.toast) {
    AppDialog.toast({
      title: 'Added to Enquiry List',
      message: `${item ? item.name : 'Product'} (${targetQty} ${targetQty === 1 ? (item && item.saleType === 'PACKET' ? 'Packet' : 'Box') : (item && item.saleType === 'PACKET' ? 'Packets' : 'Boxes')}) added.`,
      type: 'success'
    });
  }
};

window.removeFromEnquiryFromCard = function(id) {
  if (!id || !window.AshwanthCart) return;
  const item = window.AshwanthCart.getItem(id);
  window.AshwanthCart.setQty(id, 0);
  window.localQtyState[id] = 1;

  if (window.AppDialog && AppDialog.toast) {
    AppDialog.toast({
      title: 'Removed from Enquiry',
      message: `${item ? item.name : 'Product'} removed from your enquiry list.`,
      type: 'info'
    });
  }
};

window.clearCatalogSearch = window.clearCatalogSearch || function() {};
window.resetCatalogFilters = window.resetCatalogFilters || function() {};

/* Catalog Dynamic Render & Filtering Engine */
function initCatalogEngine() {
  const catalogContainer = document.getElementById('catalog-products-container');
  if (!catalogContainer) return;

  let activeCategory = 'all';
  let activeUnitFilter = 'all'; // 'all', 'PACKET', 'BOX'
  let activeStockFilter = 'all'; // 'all', 'in_stock', 'low_stock'
  let searchQuery = '';

  const searchInput = document.getElementById('catalog-search-input');
  const searchClearBtn = document.getElementById('catalog-search-clear');
  const resetFiltersBtn = document.getElementById('catalog-reset-filters-btn');
  const countBadge = document.getElementById('catalog-count-badge');
  const categoryChipsContainer = document.getElementById('catalog-category-chips');
  const unitFilterChipsContainer = document.getElementById('catalog-unit-filter-chips');

  // Filter Reset & Search Clear Global Functions
  window.clearCatalogSearch = function() {
    if (searchInput) {
      searchInput.value = '';
    }
    searchQuery = '';
    renderProducts();
    if (searchInput) searchInput.focus();
  };

  window.resetCatalogFilters = function() {
    if (searchInput) {
      searchInput.value = '';
    }
    searchQuery = '';
    activeCategory = 'all';
    activeUnitFilter = 'all';
    activeStockFilter = 'all';

    if (categoryChipsContainer) {
      const chips = categoryChipsContainer.querySelectorAll('.category-chip');
      chips.forEach(c => {
        if (c.dataset.category === 'all') c.classList.add('active');
        else c.classList.remove('active');
      });
    }

    if (unitFilterChipsContainer) {
      const unitChips = unitFilterChipsContainer.querySelectorAll('.filter-btn');
      unitChips.forEach(b => {
        if (b.dataset.unit === 'all') b.classList.add('active');
        else b.classList.remove('active');
      });
    }

    renderProducts();
  };

  function getProductList() {
    if (window.AshwanthDB && Array.isArray(AshwanthDB.productsCache)) {
      return AshwanthDB.productsCache;
    }
    return [];
  }

  function getCategoryIcon(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('sound')) return '💥';
    if (lower.includes('chakkar')) return '🌀';
    if (lower.includes('flower') || lower.includes('pot')) return '🌺';
    if (lower.includes('child') || lower.includes('novelty')) return '🌟';
    if (lower.includes('rocket')) return '🚀';
    if (lower.includes('chain') || lower.includes('bijili')) return '⚡';
    if (lower.includes('bomb')) return '💣';
    if (lower.includes('shot') || lower.includes('repeat')) return '🎆';
    if (lower.includes('sky')) return '🌌';
    if (lower.includes('fountain')) return '🌈';
    if (lower.includes('sparkler')) return '✨';
    if (lower.includes('match')) return '📦';
    if (lower.includes('gift')) return '🎁';
    if (lower.includes('digital') || lower.includes('garland')) return '🎊';
    return '✨';
  }

  function renderCategoryChips() {
    if (!categoryChipsContainer) return;

    const categories = window.AshwanthDB ? AshwanthDB.getCategories() : [];
    
    let html = `<button class="category-chip ${activeCategory === 'all' ? 'active' : ''}" data-category="all">✨ All Products</button>`;
    
    categories.forEach(cat => {
      const icon = getCategoryIcon(cat.name);
      const isActive = activeCategory === cat.slug ? 'active' : '';
      const countLabel = cat.count > 0 ? ` (${cat.count})` : '';
      html += `<button class="category-chip ${isActive}" data-category="${cat.slug}">${icon} ${cat.name}${countLabel}</button>`;
    });

    categoryChipsContainer.innerHTML = html;

    // Attach click listeners
    const chips = categoryChipsContainer.querySelectorAll('.category-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.dataset.category || 'all';
        renderProducts();
      });
    });
  }

  function renderUnitFilterChips() {
    if (!unitFilterChipsContainer) return;

    const unitChips = unitFilterChipsContainer.querySelectorAll('.filter-btn');
    unitChips.forEach(btn => {
      btn.addEventListener('click', () => {
        unitChips.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeUnitFilter = btn.dataset.unit || 'all';
        renderProducts();
      });
    });
  }

  // Load from Supabase on init
  if (window.AshwanthDB) {
    Promise.all([
      AshwanthDB.fetchSettings(),
      AshwanthDB.fetchSections(),
      AshwanthDB.fetchProducts()
    ]).then(() => {
      renderCategoryChips();
      renderUnitFilterChips();
      renderProducts();

      // Realtime DB Sync
      AshwanthDB.subscribeToProducts(() => {
        renderCategoryChips();
        renderProducts();
      });
    }).catch(err => {
      console.warn('Initial Supabase fetch fallback:', err);
      renderCategoryChips();
      renderUnitFilterChips();
      renderProducts();
    });
  }

  function renderProducts() {
    catalogContainer.innerHTML = '';
    const allProducts = getProductList();

    // Filter products
    const filtered = allProducts.filter(product => {
      const matchCat = activeCategory === 'all' || product.categorySlug === activeCategory;
      
      const pSaleType = (product.saleType === 'PACKET' || (product.unit && product.unit.toLowerCase().includes('pkt'))) ? 'PACKET' : 'BOX';
      const matchUnit = activeUnitFilter === 'all' || pSaleType === activeUnitFilter;

      const stockInfo = AshwanthDB.getStockStatus ? AshwanthDB.getStockStatus(product) : { status: 'in_stock' };
      const matchStock = activeStockFilter === 'all' || 
        (activeStockFilter === 'in_stock' && stockInfo.status !== 'out_of_stock') ||
        (activeStockFilter === 'low_stock' && stockInfo.status === 'low_stock');

      const matchSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        product.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchUnit && matchStock && matchSearch;
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} Products Found`;
    }

    if (searchClearBtn) {
      searchClearBtn.style.display = searchQuery.length > 0 ? 'flex' : 'none';
    }

    if (resetFiltersBtn) {
      const hasActiveFilters = (activeCategory !== 'all' || activeUnitFilter !== 'all' || activeStockFilter !== 'all' || searchQuery.length > 0);
      resetFiltersBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
    }

    if (filtered.length === 0) {
      catalogContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; grid-column: 1 / -1; color: var(--outline);">
          <span class="material-symbols-outlined" style="font-size: 56px; opacity: 0.5;">search_off</span>
          <h3 style="margin-top: 12px; color: var(--primary);">No fireworks found</h3>
          <p style="font-size: 0.95rem; margin-top: 4px; margin-bottom: 16px;">Try adjusting your search query or reset your filters.</p>
          <button type="button" class="btn btn-secondary btn-sm" onclick="resetCatalogFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    // Group by category if viewing 'all' and no search / specific unit filter
    if (activeCategory === 'all' && searchQuery === '' && activeUnitFilter === 'all' && activeStockFilter === 'all') {
      const grouped = {};
      filtered.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
      });

      for (let [catName, products] of Object.entries(grouped)) {
        const block = document.createElement('div');
        block.className = 'category-block reveal-up';
        block.id = `cat-${products[0].categorySlug}`;

        block.innerHTML = `
          <div class="category-header-banner">
            <span class="category-header-title">
              <span class="material-symbols-outlined">flare</span>
              ${catName}
            </span>
            <span style="font-size: 0.85rem; font-weight: 700; opacity: 0.9;">${products.length} Items</span>
          </div>
          <div class="products-grid">
            ${products.map(p => createProductCardHtml(p)).join('')}
          </div>
        `;

        catalogContainer.appendChild(block);
      }
    } else {
      // Single Grid view
      const grid = document.createElement('div');
      grid.className = 'products-grid';
      grid.innerHTML = filtered.map(p => createProductCardHtml(p)).join('');
      catalogContainer.appendChild(grid);
    }

    // Refresh scroll reveal animations for newly mounted category blocks
    initScrollAnimations();

    // Synchronize quantities with cart state
    if (window.AshwanthCart) {
      AshwanthCart.updateUI();
    }
  }

  function createProductCardHtml(p) {
    const qtyInCart = (window.AshwanthCart && AshwanthCart.cart && AshwanthCart.cart[p.id]) || 0;
    const isAdded = qtyInCart > 0;
    const inCartClass = isAdded ? 'in-cart' : '';

    const discount = (p.discountRate !== undefined && p.discountRate !== null) ? p.discountRate : (p.originalPrice && p.price && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0);
    const origPrice = p.originalPrice !== undefined ? p.originalPrice : (p.price || 0);
    const netPrice = (typeof p.price === 'number') ? p.price : origPrice;

    // Stock Status Evaluation
    const stockInfo = (window.AshwanthDB && AshwanthDB.getStockStatus) ? AshwanthDB.getStockStatus(p) : {
      status: (typeof p.currentStock === 'number' && p.currentStock <= 0) ? 'out_of_stock' : 'in_stock',
      currentStock: (typeof p.currentStock === 'number') ? p.currentStock : 9999,
      maxQty: (typeof p.currentStock === 'number') ? p.currentStock : 9999,
      saleType: p.saleType || 'BOX',
      unitPlural: (p.saleType === 'PACKET' ? 'Packets' : 'Boxes')
    };

    const isBox = (stockInfo.saleType === 'BOX');
    const unitLabel = isBox ? 'Box' : 'Packet';
    const packagingText = p.unit || (isBox ? '1 Box' : '1 Packet');
    const unitSingle = isBox ? 'BOX' : 'PKT';
    const unitPlural = isBox ? 'BOXES' : 'PKTS';

    const isOutOfStock = stockInfo.status === 'out_of_stock' || (typeof stockInfo.currentStock === 'number' && stockInfo.currentStock <= 0);

    const displayQty = isOutOfStock ? 0 : (isAdded ? qtyInCart : (typeof window.getLocalQty === 'function' ? window.getLocalQty(p.id) : ((window.localQtyState && window.localQtyState[p.id]) || 1)));
    const unitTag = displayQty === 1 ? unitSingle : unitPlural;

    // 6. Availability Badge HTML
    let stockBadgeHtml = '';
    if (isOutOfStock) {
      stockBadgeHtml = `<span class="stock-badge badge-out-of-stock"><span class="material-symbols-outlined" style="font-size: 15px;">cancel</span> Out of Stock</span>`;
    } else if (stockInfo.status === 'low_stock' || (stockInfo.currentStock > 0 && stockInfo.currentStock <= 15)) {
      stockBadgeHtml = `<span class="stock-badge badge-low-stock"><span class="material-symbols-outlined" style="font-size: 15px;">warning</span> Only ${stockInfo.currentStock} ${stockInfo.unitPlural} Left</span>`;
    } else if (stockInfo.currentStock && stockInfo.currentStock < 9000) {
      stockBadgeHtml = `<span class="stock-badge badge-in-stock"><span class="material-symbols-outlined" style="font-size: 15px;">check_circle</span> Available: ${stockInfo.currentStock} ${stockInfo.unitPlural}</span>`;
    } else {
      stockBadgeHtml = `<span class="stock-badge badge-in-stock"><span class="material-symbols-outlined" style="font-size: 15px;">check_circle</span> In Stock</span>`;
    }

    // 8. Action Area HTML
    let actionHtml = '';
    if (isOutOfStock) {
      actionHtml = `
        <button type="button" class="btn-add-to-enquiry" disabled style="opacity: 0.55; background: #64748b; cursor: not-allowed; box-shadow: none;">
          <span class="material-symbols-outlined" style="font-size: 19px;">block</span>
          <span>OUT OF STOCK</span>
        </button>
      `;
    } else if (isAdded) {
      actionHtml = `
        <div class="card-added-action-group">
          <button type="button" class="btn-card-added" onclick="AshwanthCart.openCheckoutModal()" title="View Enquiry List">
            <span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span>
            <span>IN ENQUIRY LIST (${qtyInCart})</span>
          </button>
          <button type="button" class="btn-card-remove" onclick="removeFromEnquiryFromCard('${p.id}')" title="Remove from enquiry list">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
            <span>REMOVE</span>
          </button>
        </div>
      `;
    } else {
      actionHtml = `
        <button type="button" class="btn-add-to-enquiry" onclick="addToEnquiryFromCard('${p.id}')">
          <span class="material-symbols-outlined" style="font-size: 19px;">add_shopping_cart</span>
          <span>ADD TO ENQUIRY</span>
        </button>
      `;
    }

    return `
      <div class="product-card ${inCartClass}" data-product-id="${p.id}">
        <!-- 1. Product category badge -->
        <div class="product-category-row">
          <span class="product-category-tag">${p.category || 'Crackers'}</span>
          <span class="product-in-cart-indicator" id="cart-badge-${p.id}" style="${isAdded ? '' : 'display: none;'}">
            <span class="material-symbols-outlined" style="font-size: 11px;">check</span> IN ENQUIRY
          </span>
        </div>

        <!-- 2. Product name -->
        <h3 class="product-title" title="${p.name}">${p.name}</h3>

        <!-- 3. Product code and packaging unit -->
        <div class="product-code-unit-row">
          <span class="code-badge">${p.code || ''}</span>
          <span class="unit-badge">${packagingText}</span>
        </div>

        <!-- 4. Prominent selling price -->
        <div class="product-selling-price-box">
          <span class="price-currency">₹</span>
          <span class="price-amount">${netPrice}</span>
          <span class="price-per-unit">/ ${unitLabel}</span>
        </div>

        <!-- 5. MRP and valid discount -->
        <div class="product-mrp-discount-row">
          ${origPrice > netPrice ? `<span class="mrp-strikethrough">MRP ₹${origPrice}</span>` : ''}
          ${discount > 0 ? `<span class="discount-pill">${discount}% OFF</span>` : ''}
        </div>

        <!-- 6. Stock availability, when provided by existing data -->
        <div class="product-stock-row">
          ${stockBadgeHtml}
        </div>

        <!-- 7. Quantity selector -->
        <div class="product-qty-section">
          <span class="qty-section-title">QUANTITY</span>
          <div class="qty-selector-row">
            <button type="button" class="btn-qty-control" onclick="changeLocalQty('${p.id}', -1)" aria-label="Decrease quantity" ${isOutOfStock ? 'disabled' : ''}>
              <span class="material-symbols-outlined" style="font-size: 18px;">remove</span>
            </button>
            <div class="qty-display-badge">
              <span class="qty-value-number" id="qty-num-${p.id}">${displayQty}</span>
              <span class="qty-value-unit" id="qty-unit-${p.id}">${unitTag}</span>
            </div>
            <button type="button" class="btn-qty-control" onclick="changeLocalQty('${p.id}', 1)" aria-label="Increase quantity" ${isOutOfStock || (displayQty >= stockInfo.maxQty) ? 'disabled' : ''}>
              <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
            </button>
          </div>
        </div>

        <!-- 8. Full-width ADD TO ENQUIRY button -->
        <div class="product-action-section" id="action-wrap-${p.id}">
          ${actionHtml}
        </div>
      </div>
    `;
  }

  // Bind Search Input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderProducts();
    });
  }

  // Initial chip & product render
  renderCategoryChips();
  renderUnitFilterChips();
  renderProducts();
}

/* 5. Scroll-Triggered Reveal Engine (Section 4 & 5) */
function initScrollAnimations() {
  const revealElements = document.querySelectorAll(
    '.reveal-up, .reveal-fade, .reveal-left, .reveal-right, .reveal-scale, .animate-on-scroll'
  );
  if (!revealElements.length) return;

  // Check reduced motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealElements.forEach(el => el.classList.add('is-revealed', 'is-visible'));
    return;
  }

  // Progressive enhancement: activate reveal hiding in CSS now that JS is running
  document.body.classList.add('reveal-ready');

  // Immediately reveal elements already inside or near the current viewport to guarantee fast LCP
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const toObserve = [];

  revealElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top <= viewportHeight + 40 && rect.bottom >= -40) {
      el.classList.add('is-revealed', 'is-visible');
    } else if (!el.classList.contains('is-revealed')) {
      toObserve.push(el);
    }
  });

  if (!toObserve.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed', 'is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.08
  });

  toObserve.forEach(el => observer.observe(el));
}

/* 6. Seamless Page-to-Page Navigation Transitions (Luxury SPA Engine) */
function getProgressBar() {
  if (!navProgressBar) {
    navProgressBar = document.getElementById('luxury-nav-progress');
    if (!navProgressBar && typeof document !== 'undefined' && document.body) {
      navProgressBar = document.createElement('div');
      navProgressBar.id = 'luxury-nav-progress';
      document.body.appendChild(navProgressBar);
    }
  }
  return navProgressBar;
}

function startProgressBar() {
  const bar = getProgressBar();
  if (!bar) return;
  bar.classList.remove('complete');
  bar.classList.add('active');
  bar.style.width = '0%';
  requestAnimationFrame(() => {
    bar.style.width = '68%';
  });
}

function completeProgressBar() {
  const bar = getProgressBar();
  if (!bar) return;
  bar.style.width = '100%';
  bar.classList.add('complete');
  setTimeout(() => {
    bar.classList.remove('active', 'complete');
    bar.style.width = '0%';
  }, 420);
}

function updateNavigationActiveStates(targetPath) {
  const cleanTarget = targetPath.replace(/^\//, '').split('?')[0].split('#')[0] || 'index.html';

  // 1. Desktop / Header Navigation
  const headerLinks = document.querySelectorAll('.site-header .nav-link');
  headerLinks.forEach(link => {
    const href = (link.getAttribute('href') || '').replace(/^\//, '').split('?')[0].split('#')[0];
    if (href === cleanTarget || (cleanTarget === 'index.html' && (href === '' || href === 'index.html'))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 2. Mobile Bottom Navigation
  const bottomNavItems = document.querySelectorAll('.mobile-bottom-nav .bottom-nav-item');
  bottomNavItems.forEach(item => {
    const href = (item.getAttribute('href') || '').replace(/^\//, '').split('?')[0].split('#')[0];
    if (href === cleanTarget || (cleanTarget === 'index.html' && (href === '' || href === 'index.html'))) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    } else {
      item.classList.remove('active');
      item.removeAttribute('aria-current');
    }
  });
}

async function navigateToPage(targetUrl, isPopState = false) {
  if (isPageTransitioning) return;

  const currentUrl = new URL(window.location.href);
  const destUrl = new URL(targetUrl, window.location.href);

  // If same exact URL, smooth scroll to anchor or top
  if (destUrl.pathname === currentUrl.pathname && destUrl.search === currentUrl.search) {
    if (destUrl.hash) {
      const targetEl = document.querySelector(destUrl.hash);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Admin page requires standard navigation
  if (destUrl.pathname.includes('admin.html')) {
    window.location.href = destUrl.href;
    return;
  }

  isPageTransitioning = true;
  startProgressBar();

  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    window.location.href = destUrl.href;
    return;
  }

  try {
    // 1. Fetch new HTML document concurrently with smooth exit animation
    const fetchPromise = fetch(destUrl.href, {
      headers: { 'X-Requested-With': 'MathuraSpa' }
    }).then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });

    mainContent.classList.add('page-transition-exit');

    const [htmlText] = await Promise.all([
      fetchPromise,
      new Promise(r => setTimeout(r, 140))
    ]);

    // 2. Parse new HTML
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlText, 'text/html');
    const newMain = newDoc.getElementById('main-content');

    if (!newMain) {
      window.location.href = destUrl.href;
      return;
    }

    if (newDoc.title) {
      document.title = newDoc.title;
    }

    // Sync any page-specific inline styles from newDoc into document.head
    document.querySelectorAll('style[data-dynamic-page-style]').forEach(el => el.remove());
    newDoc.querySelectorAll('head style').forEach(styleEl => {
      const clone = styleEl.cloneNode(true);
      clone.setAttribute('data-dynamic-page-style', 'true');
      document.head.appendChild(clone);
    });

    if (!isPopState) {
      history.pushState({ url: destUrl.href }, newDoc.title, destUrl.href);
    }

    // 3. Swap DOM content
    mainContent.innerHTML = newMain.innerHTML;
    window.scrollTo({ top: 0, behavior: 'instant' });

    // 4. Update Navigation Active States on all nav bars
    updateNavigationActiveStates(destUrl.pathname);

    // 5. Re-initialize components safely with try/catch
    try { initStickyHeader(); } catch (e) { console.warn('Header init error:', e); }
    try { initBottomNav(); } catch (e) { console.warn('Bottom nav init error:', e); }
    try { initDiwaliCountdown(); } catch (e) { console.warn('Countdown init error:', e); }
    try { initCatalogEngine(); } catch (e) { console.warn('Catalog engine init error:', e); }
    try { initScrollAnimations(); } catch (e) { console.warn('Scroll anim init error:', e); }
    try {
      if (typeof window.initHeroFireworks === 'function') {
        window.initHeroFireworks();
      }
    } catch (e) { console.warn('Hero fireworks init error:', e); }

    try {
      if (window.AshwanthCart && typeof window.AshwanthCart.updateUI === 'function') {
        window.AshwanthCart.updateUI();
      }
    } catch (e) { console.warn('Cart updateUI error:', e); }

    // Check if intro is requested via hash or param (e.g., #playIntro)
    if (destUrl.searchParams.get('playIntro') === '1' || destUrl.hash === '#playIntro') {
      if (typeof window.playBrandIntro === 'function') {
        setTimeout(() => window.playBrandIntro(), 150);
      }
    }

    if (window.dispatchEvent) {
      window.dispatchEvent(new Event('resize'));
    }

    // 6. Smooth entrance animation
    mainContent.classList.remove('page-transition-exit');
    mainContent.classList.add('page-transition-enter');

    setTimeout(() => {
      mainContent.classList.remove('page-transition-enter');
      mainContent.style.opacity = '1';
      isPageTransitioning = false;
    }, 320);

    completeProgressBar();
  } catch (err) {
    console.warn('Page transition fallback to reload:', err);
    completeProgressBar();
    if (mainContent) {
      mainContent.classList.remove('page-transition-exit', 'page-transition-enter');
      mainContent.style.opacity = '1';
    }
    isPageTransitioning = false;
    window.location.href = destUrl.href;
  }
}

window.navigateToPage = navigateToPage;

function initPageTransitions() {
  getProgressBar();

  if (isPageTransitionsBound) return;
  isPageTransitionsBound = true;

  // Browser back / forward button handling
  window.addEventListener('popstate', () => {
    navigateToPage(window.location.href, true);
  });

  // Intercept clicks on internal page navigation links
  document.addEventListener('click', (e) => {
    // If click is within mobile bottom nav, let initBottomNav handle it
    if (e.target.closest('.mobile-bottom-nav')) return;

    const link = e.target.closest('a');
    if (!link) return;

    // Respect modifier keys, new tabs, and downloads
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.which === 2) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Preserve hash links, external protocols, WhatsApp, phone, email
    if (href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    if (href.includes('api.whatsapp.com') || href.includes('wa.me')) return;

    try {
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const isHtmlPage = url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '';
      if (!isHtmlPage) return;

      e.preventDefault();
      navigateToPage(url.href);
    } catch (err) {}
  });

  // Handle browser back/forward (bfcache) navigation
  window.addEventListener('pageshow', () => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.classList.remove('page-transition-exit', 'page-transition-enter');
      mainContent.style.opacity = '1';
    }
    isPageTransitioning = false;
  });
}

// Global WhatsApp direct contact handler
window.handleDirectContact = function (e) {
  if (e) e.preventDefault();
  const nameEl = document.getElementById('contact-name');
  const phoneEl = document.getElementById('contact-phone');
  const cityEl = document.getElementById('contact-city');
  const msgEl = document.getElementById('contact-msg');

  const name = nameEl ? nameEl.value.trim() : '';
  const phone = phoneEl ? phoneEl.value.trim() : '';
  const city = cityEl ? cityEl.value.trim() : '';
  const msg = msgEl ? msgEl.value.trim() : '';

  const text = `*✨ MATHURA CRACKERS - SIVAKASI DIRECT ENQUIRY ✨*\n` +
               `*Name:* ${name}\n` +
               `*Phone:* ${phone}\n` +
               `*Location:* ${city}\n` +
               `*Message:* ${msg}`;

  const whatsappUrl = `https://api.whatsapp.com/send?phone=917010317389&text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
};

