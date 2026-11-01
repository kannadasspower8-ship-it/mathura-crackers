/**
 * Ashwanth Crackers - Supabase Pure Cloud Database Service
 * 100% Direct Supabase PostgreSQL + Complete Inventory & Order Engine
 * With PACKET vs BOX Inventory, Cloud Stock Sync, and Zero Schema Mismatch
 */

const AshwanthDB = {
  productsCache: [],
  sectionsCache: [],
  stockMetadataCache: {}, // { [productId]: { saleType, initialStock, currentStock, lowStockThreshold, totalSold } }
  inventoryLogsCache: [],
  defaultDiscount: 80,
  isLoaded: false,

  getConfig() {
    if (typeof SUPABASE_CONFIG !== 'undefined') return SUPABASE_CONFIG;
    if (typeof window !== 'undefined' && window.SUPABASE_CONFIG) return window.SUPABASE_CONFIG;
    return {
      url: 'https://dejjfscjvvfokpwjcgvp.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlampmc2NqdnZmb2twd2pjZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTE2NjYsImV4cCI6MjEwMjk2NzY2Nn0.U4XNG3ngSF6MDvI1v56WkojMhucoRExeYERlcDcZdhk'
    };
  },

  getHeaders() {
    const config = this.getConfig();
    return {
      'apikey': config.anonKey,
      'Authorization': `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json'
    };
  },

  /**
   * Helper: Format unit string (e.g., 'Box' vs 'Boxes', 'Packet' vs 'Packets')
   */
  formatUnit(saleType, qty = 1) {
    const isPkt = String(saleType || '').toUpperCase() === 'PACKET';
    if (isPkt) {
      return qty === 1 ? 'Packet' : 'Packets';
    }
    return qty === 1 ? 'Box' : 'Boxes';
  },

  /**
   * Helper: Calculate Stock Badge & Order Availability
   */
  getStockStatus(product) {
    const saleType = (product.saleType === 'PACKET' || (product.unit && product.unit.toLowerCase().includes('pkt'))) ? 'PACKET' : 'BOX';
    const currentStock = parseInt(product.currentStock !== undefined ? product.currentStock : (product.inStock !== false ? 50 : 0), 10);
    const threshold = parseInt(product.lowStockThreshold || 10, 10);
    const unitPlural = this.formatUnit(saleType, currentStock);

    if (currentStock <= 0) {
      return {
        status: 'out_of_stock',
        label: 'OUT OF STOCK',
        badgeText: 'Out of Stock',
        cssClass: 'out-of-stock',
        canOrder: false,
        maxQty: 0,
        currentStock: 0,
        saleType: saleType,
        unitPlural: unitPlural
      };
    }

    if (currentStock <= threshold) {
      return {
        status: 'low_stock',
        label: `ONLY ${currentStock} ${unitPlural.toUpperCase()} LEFT`,
        badgeText: `Only ${currentStock} ${unitPlural} Left`,
        cssClass: 'low-stock',
        canOrder: true,
        maxQty: currentStock,
        currentStock: currentStock,
        saleType: saleType,
        unitPlural: unitPlural
      };
    }

    return {
      status: 'in_stock',
      label: 'IN STOCK',
      badgeText: `${currentStock} ${unitPlural} Available`,
      cssClass: 'in-stock',
      canOrder: true,
      maxQty: currentStock,
      currentStock: currentStock,
      saleType: saleType,
      unitPlural: unitPlural
    };
  },

  /**
   * Load stock metadata from Supabase settings
   */
  async loadStockMetadata() {
    const config = this.getConfig();
    try {
      const res = await fetch(`${config.url}/rest/v1/settings?key=eq.product_stocks_map`, {
        headers: this.getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data[0] && data[0].value) {
          this.stockMetadataCache = JSON.parse(data[0].value);
          return this.stockMetadataCache;
        }
      }
    } catch (e) {
      console.warn('Stock metadata remote load note:', e);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('ashwanth_stock_metadata');
        if (stored) {
          this.stockMetadataCache = JSON.parse(stored);
        }
      } catch (err) {}
    }

    return this.stockMetadataCache;
  },

  /**
   * Save stock metadata to Supabase settings
   */
  async saveStockMetadata() {
    const config = this.getConfig();
    const jsonStr = JSON.stringify(this.stockMetadataCache);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('ashwanth_stock_metadata', jsonStr);
      } catch (e) {}
    }

    try {
      await fetch(`${config.url}/rest/v1/settings`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify([{
          key: 'product_stocks_map',
          value: jsonStr,
          updated_at: new Date().toISOString()
        }])
      });
    } catch (err) {
      console.warn('Stock metadata remote save note:', err);
    }
  },

  /**
   * Fetch all products strictly from Supabase
   */
  async fetchProducts() {
    const config = this.getConfig();
    await this.loadStockMetadata();

    try {
      const res = await fetch(`${config.url}/rest/v1/products?select=*&order=sort_order.asc,code.asc`, {
        headers: this.getHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase products fetch error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const formatted = (data || []).map(p => {
        const isPkt = (p.sale_type && p.sale_type.toUpperCase() === 'PACKET') || 
                      (p.unit && p.unit.toLowerCase().includes('pkt')) || 
                      (p.code && p.code.toLowerCase().includes('pkt'));
        const saleType = isPkt ? 'PACKET' : 'BOX';
        
        // Pure Supabase real stock values - no fake hardcoded dummy items
        const currStock = (p.current_stock !== undefined && p.current_stock !== null) 
          ? parseInt(p.current_stock, 10) 
          : (p.in_stock === false ? 0 : 50);
        const initStock = (p.initial_stock !== undefined && p.initial_stock !== null) 
          ? parseInt(p.initial_stock, 10) 
          : currStock;
        const lowThreshold = (p.low_stock_threshold !== undefined && p.low_stock_threshold !== null) 
          ? parseInt(p.low_stock_threshold, 10) 
          : 10;
        const sold = (p.total_sold !== undefined && p.total_sold !== null) 
          ? parseInt(p.total_sold, 10) 
          : 0;

        return {
          id: p.id,
          category: p.category,
          categorySlug: p.category_slug,
          code: p.code,
          name: p.name,
          description: p.description || '',
          originalPrice: p.original_price,
          discountRate: p.discount_rate !== undefined ? p.discount_rate : this.defaultDiscount,
          price: p.price,
          saleType: p.sale_type || saleType,
          unit: isPkt ? '1 Pkt' : '1 Box',
          initialStock: initStock,
          currentStock: currStock,
          lowStockThreshold: lowThreshold,
          totalSold: sold,
          image: p.image || 'https://images.unsplash.com/photo-1531747056595-07f6cbbe10ad?auto=format&fit=crop&w=400&q=80',
          inStock: currStock > 0 && p.in_stock !== false,
          isActive: true,
          sortOrder: p.sort_order
        };
      });

      this.productsCache = formatted;
      this.isLoaded = true;

      if (typeof window !== 'undefined') {
        window.PRODUCTS_DATA = formatted;
      }

      return formatted;
    } catch (err) {
      console.error('Supabase fetchProducts error:', err);
      this.productsCache = [];
      return [];
    }
  },

  /**
   * Fetch all sections strictly from Supabase
   */
  async fetchSections() {
    const config = this.getConfig();
    try {
      const res = await fetch(`${config.url}/rest/v1/sections?select=*&order=name.asc`, {
        headers: this.getHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase sections fetch error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      this.sectionsCache = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug
      }));

      return this.sectionsCache;
    } catch (err) {
      console.error('Supabase fetchSections error:', err);
      return this.sectionsCache || [];
    }
  },

  /**
   * Create a new section directly in Supabase
   */
  async addSection(sectionName) {
    const config = this.getConfig();
    const cleanName = sectionName.trim();
    if (!cleanName) throw new Error('Section name cannot be empty');

    if (!this.sectionsCache || this.sectionsCache.length === 0) {
      await this.fetchSections();
    }
    const existing = this.sectionsCache.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const id = 'sec_' + Date.now();

    try {
      const res = await fetch(`${config.url}/rest/v1/sections`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify([{ id, name: cleanName, slug, sort_order: this.sectionsCache.length + 1 }])
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase addSection error (${res.status}): ${errText}`);
      }
    } catch (e) {
      console.error('Supabase addSection exception:', e);
      throw e;
    }

    await this.fetchSections();
    return { id, name: cleanName, slug };
  },

  /**
   * Update/rename an existing section in Supabase and cascade to products
   */
  async updateSection(sectionId, newName) {
    const config = this.getConfig();
    const cleanName = (newName || '').trim();
    if (!cleanName) throw new Error('Section name cannot be empty');

    const existing = this.sectionsCache.find(s => s.id === sectionId);
    if (!existing) throw new Error('Section not found');
    const oldName = existing.name;
    const oldSlug = existing.slug;

    const newSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    try {
      const res = await fetch(`${config.url}/rest/v1/sections?id=eq.${encodeURIComponent(sectionId)}`, {
        method: 'PATCH',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ name: cleanName, slug: newSlug })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to update section in Supabase: ${errText}`);
      }

      // Cascade update to products with this category
      if (oldName !== cleanName) {
        await fetch(`${config.url}/rest/v1/products?category=eq.${encodeURIComponent(oldName)}`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ category: cleanName, category_slug: newSlug })
        });
      }
    } catch (e) {
      console.error('Supabase updateSection exception:', e);
      throw e;
    }

    await this.fetchSections();
    await this.fetchProducts();
    return { id: sectionId, name: cleanName, slug: newSlug };
  },

  /**
   * Delete a section from Supabase and mark affected products as Uncategorized
   */
  async deleteSection(sectionId) {
    const config = this.getConfig();
    const existing = this.sectionsCache.find(s => s.id === sectionId);
    if (!existing) throw new Error('Section not found');

    try {
      const res = await fetch(`${config.url}/rest/v1/sections?id=eq.${encodeURIComponent(sectionId)}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to delete section: ${errText}`);
      }

      // Reassign affected products to Uncategorized
      await fetch(`${config.url}/rest/v1/products?category=eq.${encodeURIComponent(existing.name)}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ category: 'Uncategorized', category_slug: 'uncategorized' })
      });
    } catch (e) {
      console.error('Supabase deleteSection exception:', e);
      throw e;
    }

    await this.fetchSections();
    await this.fetchProducts();
    return true;
  },

  /**
   * Delete ALL sections from Supabase to start fresh
   */
  async clearAllSections() {
    const config = this.getConfig();
    try {
      const res = await fetch(`${config.url}/rest/v1/sections?id=neq.none`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to clear sections: ${errText}`);
      }

      await fetch(`${config.url}/rest/v1/products?id=neq.none`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ category: 'Uncategorized', category_slug: 'uncategorized' })
      });
    } catch (e) {
      console.error('Supabase clearAllSections exception:', e);
      throw e;
    }

    await this.fetchSections();
    await this.fetchProducts();
    return true;
  },

  /**
   * Fetch store settings
   */
  async fetchSettings() {
    const config = this.getConfig();
    const defaultSettings = {
      company_name: 'Mathura Crackers',
      phone: '+91 70103 17389 / +91 74180 51084 / +91 72009 36916',
      whatsapp: '+91 70103 17389',
      email: 'nathisoft1987@gmail.com',
      address: '4/190, Mettamalai, Sattur - 626203, Virudhunagar District, Tamil Nadu',
      proprietor: 'Kannadass T',
      default_discount: 80,
      min_order_tn: 3000,
      min_order_other: 5000,
      sale_title: 'MEGA DIWALI DHAMAKA SALE',
      countdown_end: '2026-11-08T23:59:59',
      payment_info: 'Advance 100% payment required via UPI / Bank Transfer upon order confirmation.'
    };

    try {
      const res = await fetch(`${config.url}/rest/v1/settings?select=*`, {
        headers: this.getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        data.forEach(item => {
          if (item.key && item.key !== 'product_stocks_map') {
            defaultSettings[item.key] = item.value;
          }
        });
        this.defaultDiscount = parseInt(defaultSettings.default_discount, 10) || 80;
      }
      return defaultSettings;
    } catch (e) {
      console.warn('Supabase fetchSettings error:', e);
      return defaultSettings;
    }
  },

  /**
   * Update Settings in Supabase
   */
  async updateSettings(settingsObj) {
    const config = this.getConfig();
    const rows = Object.entries(settingsObj).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));

    try {
      await fetch(`${config.url}/rest/v1/settings`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(rows)
      });
    } catch (e) {
      console.error('Supabase updateSettings error:', e);
    }
    return settingsObj;
  },

  /**
   * Get Maintenance Mode state directly from Supabase
   */
  async getMaintenanceMode() {
    const config = this.getConfig();
    try {
      const res = await fetch(`${config.url}/rest/v1/settings?key=eq.maintenance_mode&select=value`, {
        headers: this.getHeaders()
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          return String(rows[0].value || '').toLowerCase().trim() === 'on';
        }
      }
    } catch (err) {
      console.warn('Supabase getMaintenanceMode error:', err);
    }
    return false;
  },

  /**
   * Set Maintenance Mode state (on/off) in Supabase
   */
  async setMaintenanceMode(enabled) {
    const val = enabled ? 'on' : 'off';
    await this.updateSettings({ maintenance_mode: val });
    return enabled;
  },

  /**
   * Update global default discount and recalculate all products in Supabase
   */
  async updateGlobalDiscount(newDiscountRate) {
    const config = this.getConfig();
    const discount = parseInt(newDiscountRate, 10);
    if (isNaN(discount) || discount < 0 || discount > 99) {
      throw new Error('Discount percentage must be between 0 and 99');
    }

    this.defaultDiscount = discount;

    // 1. Update settings table in Supabase
    await this.updateSettings({ default_discount: discount });

    // 2. Batch update all products in Supabase
    if (this.productsCache.length > 0) {
      const updates = this.productsCache.map(p => {
        const newNetPrice = Math.round(p.originalPrice * (1 - discount / 100));
        return {
          id: p.id,
          category: p.category,
          category_slug: p.categorySlug,
          code: p.code,
          name: p.name,
          original_price: p.originalPrice,
          discount_rate: discount,
          price: newNetPrice,
          unit: p.unit,
          image: p.image,
          in_stock: p.currentStock > 0,
          sort_order: p.sortOrder
        };
      });

      const res = await fetch(`${config.url}/rest/v1/products`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('Failed to update products discount: ' + errText);
      }
    }

    await this.fetchProducts();
    return discount;
  },

  /**
   * Get all active categories strictly from Supabase sections
   */
  getCategories(includeUncategorized = false) {
    const map = new Map();

    // Sections explicitly defined in Supabase
    this.sectionsCache.forEach(s => {
      map.set(s.slug, {
        id: s.id,
        slug: s.slug,
        name: s.name,
        count: 0
      });
    });

    // Count products under each section
    let uncategorizedCount = 0;
    this.productsCache.forEach(p => {
      if (p.categorySlug && map.has(p.categorySlug)) {
        map.get(p.categorySlug).count++;
      } else {
        uncategorizedCount++;
      }
    });

    if (includeUncategorized && uncategorizedCount > 0) {
      map.set('uncategorized', {
        id: 'sec_uncategorized',
        slug: 'uncategorized',
        name: 'Uncategorized',
        count: uncategorizedCount
      });
    }

    return Array.from(map.values());
  },

  /**
   * Upload product image to Supabase Storage bucket ('product-images')
   * @param {File|Blob} file
   * @returns {Promise<string>} Public URL of uploaded image
   */
  async uploadProductImage(file) {
    const config = this.getConfig();
    if (!config || !config.url || !config.anonKey) {
      throw new Error('Supabase configuration missing');
    }

    const ext = (file.name && file.name.split('.').pop()) || 'jpg';
    const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;

    const res = await fetch(`${config.url}/storage/v1/object/product-images/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
        'Content-Type': file.type || 'image/jpeg'
      },
      body: file
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Upload failed (${res.status}): ${errText}`);
    }

    return `${config.url}/storage/v1/object/public/product-images/${fileName}`;
  },

  /**
   * Add a new product directly to Supabase with exact schema compatibility
   */
  async addProduct(product) {
    const config = this.getConfig();
    const id = product.id || ('prod_' + Date.now());
    const categorySlug = product.categorySlug || product.category.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const isPkt = (product.saleType === 'PACKET') || (product.unit && product.unit.toLowerCase().includes('pkt'));
    const saleType = isPkt ? 'PACKET' : 'BOX';
    const discountRate = (product.discountRate !== undefined) ? parseInt(product.discountRate, 10) : this.defaultDiscount;
    const originalPrice = parseInt(product.originalPrice, 10) || 0;
    const price = product.price || Math.round(originalPrice * (1 - discountRate / 100));
    const initStock = parseInt(product.initialStock || product.currentStock || (isPkt ? 100 : 50), 10);
    const currStock = parseInt(product.currentStock !== undefined ? product.currentStock : initStock, 10);
    const lowStockThreshold = parseInt(product.lowStockThreshold || 10, 10);
    const sortOrder = product.sortOrder || (this.productsCache.length + 1);

    try {
      await this.addSection(product.category);
    } catch (e) {}

    // Exact schema fields including Supabase stock columns
    const record = {
      id: id,
      category: product.category,
      category_slug: categorySlug,
      code: product.code || `AC${String(sortOrder).padStart(2, '0')} / 1${isPkt ? 'PKT' : 'BOX'}`,
      name: product.name,
      original_price: originalPrice,
      discount_rate: discountRate,
      price: price,
      unit: isPkt ? '1 Pkt' : '1 Box',
      sale_type: saleType,
      current_stock: currStock,
      initial_stock: initStock,
      low_stock_threshold: lowStockThreshold,
      total_sold: 0,
      image: product.image || 'https://images.unsplash.com/photo-1531747056595-07f6cbbe10ad?auto=format&fit=crop&w=400&q=80',
      in_stock: currStock > 0,
      sort_order: sortOrder
    };

    const res = await fetch(`${config.url}/rest/v1/products`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([record])
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to add product (${res.status}): ${errText}`);
    }

    // Save stock metadata
    this.stockMetadataCache[id] = {
      saleType,
      initialStock: initStock,
      currentStock: currStock,
      lowStockThreshold: lowStockThreshold,
      totalSold: 0
    };
    await this.saveStockMetadata();

    // Log initial stock creation
    await this.addInventoryLog({
      productId: id,
      productName: product.name,
      changeQty: currStock,
      saleType: saleType,
      actionType: 'initial',
      previousStock: 0,
      newStock: currStock,
      reason: `Initial stock added (${currStock} ${this.formatUnit(saleType, currStock)})`
    });

    const data = await res.json();
    await this.fetchProducts();
    return data;
  },

  /**
   * Update an existing product in Supabase
   */
  async updateProduct(productId, updates) {
    const config = this.getConfig();
    const existing = this.productsCache.find(p => String(p.id) === String(productId));
    const record = {};

    if (updates.category) {
      record.category = updates.category;
      record.category_slug = updates.categorySlug || updates.category.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      try {
        await this.addSection(updates.category);
      } catch (e) {}
    }
    if (updates.code) record.code = updates.code;
    if (updates.name) record.name = updates.name;
    if (updates.originalPrice !== undefined) record.original_price = parseInt(updates.originalPrice, 10);
    if (updates.discountRate !== undefined) record.discount_rate = parseInt(updates.discountRate, 10);
    if (updates.price !== undefined) {
      record.price = parseInt(updates.price, 10);
    } else if (updates.originalPrice !== undefined && updates.discountRate !== undefined) {
      record.price = Math.round(updates.originalPrice * (1 - updates.discountRate / 100));
    }
    if (updates.saleType) {
      record.sale_type = updates.saleType;
      record.unit = updates.saleType === 'PACKET' ? '1 Pkt' : '1 Box';
    } else if (updates.unit) {
      record.unit = updates.unit;
    }
    if (updates.image !== undefined) record.image = updates.image;
    if (updates.currentStock !== undefined) {
      record.current_stock = parseInt(updates.currentStock, 10);
      record.in_stock = record.current_stock > 0;
    } else if (updates.inStock !== undefined) {
      record.in_stock = updates.inStock;
    }
    if (updates.initialStock !== undefined) record.initial_stock = parseInt(updates.initialStock, 10);
    if (updates.lowStockThreshold !== undefined) record.low_stock_threshold = parseInt(updates.lowStockThreshold, 10);
    if (updates.totalSold !== undefined) record.total_sold = parseInt(updates.totalSold, 10);
    record.updated_at = new Date().toISOString();

    const res = await fetch(`${config.url}/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(record)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update product (${res.status}): ${errText}`);
    }

    // Update stock metadata cache
    if (!this.stockMetadataCache[productId]) {
      this.stockMetadataCache[productId] = {
        saleType: existing ? existing.saleType : 'BOX',
        initialStock: existing ? existing.initialStock : 50,
        currentStock: existing ? existing.currentStock : 50,
        lowStockThreshold: 10,
        totalSold: existing ? existing.totalSold : 0
      };
    }

    const meta = this.stockMetadataCache[productId];
    if (updates.saleType) meta.saleType = updates.saleType;
    if (updates.initialStock !== undefined) meta.initialStock = parseInt(updates.initialStock, 10);
    if (updates.currentStock !== undefined) meta.currentStock = parseInt(updates.currentStock, 10);
    if (updates.lowStockThreshold !== undefined) meta.lowStockThreshold = parseInt(updates.lowStockThreshold, 10);
    if (updates.totalSold !== undefined) meta.totalSold = parseInt(updates.totalSold, 10);

    await this.saveStockMetadata();

    // Log stock change if stock was adjusted
    if (existing && updates.currentStock !== undefined && updates.currentStock !== existing.currentStock) {
      const diff = updates.currentStock - existing.currentStock;
      await this.addInventoryLog({
        productId: productId,
        productName: updates.name || existing.name,
        changeQty: diff,
        saleType: meta.saleType,
        actionType: diff > 0 ? 'restock' : 'deduction',
        previousStock: existing.currentStock,
        newStock: updates.currentStock,
        reason: updates.reason || (diff > 0 ? `Stock added: +${diff}` : `Stock adjusted: ${diff}`)
      });
    }

    const data = await res.json();
    await this.fetchProducts();
    return data;
  },

  /**
   * Quick Add / Remove Stock Stepper
   */
  async adjustStock(productId, changeQty, reason = '') {
    const product = this.productsCache.find(p => String(p.id) === String(productId));
    if (!product) throw new Error('Product not found in catalogue');

    const newStock = Math.max(0, (product.currentStock || 0) + changeQty);
    return await this.updateProduct(productId, {
      currentStock: newStock,
      reason: reason || (changeQty > 0 ? `Restocked +${changeQty} ${this.formatUnit(product.saleType, changeQty)}` : `Reduced ${changeQty} ${this.formatUnit(product.saleType, Math.abs(changeQty))}`)
    });
  },

  /**
   * Delete a product from Supabase
   */
  async deleteProduct(productId) {
    const config = this.getConfig();
    const res = await fetch(`${config.url}/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to delete product (${res.status}): ${errText}`);
    }

    delete this.stockMetadataCache[productId];
    await this.saveStockMetadata();

    await this.fetchProducts();
    return true;
  },

  /**
   * Deduct stock for an order automatically
   */
  async deductStockForOrder(order) {
    if (!order || !order.items || !Array.isArray(order.items)) return;

    for (const item of order.items) {
      const p = this.productsCache.find(prod => String(prod.id) === String(item.id || item.productId));
      if (p) {
        const qty = parseInt(item.qty || 1, 10);
        const prevStock = p.currentStock || 0;
        const newStock = Math.max(0, prevStock - qty);
        const newSold = (p.totalSold || 0) + qty;

        try {
          await this.updateProduct(p.id, {
            currentStock: newStock,
            totalSold: newSold,
            inStock: newStock > 0,
            reason: `Order #${order.orderRef || order.id || 'NEW'} (${qty} ${this.formatUnit(p.saleType, qty)} purchased)`
          });
        } catch (err) {
          console.error(`Failed to deduct stock for product ${p.name}:`, err);
        }
      }
    }
  },

  /**
   * Restore stock when an order is cancelled
   */
  async restoreStockForOrder(order) {
    if (!order || !order.items || !Array.isArray(order.items)) return;

    for (const item of order.items) {
      const p = this.productsCache.find(prod => String(prod.id) === String(item.id || item.productId));
      if (p) {
        const qty = parseInt(item.qty || 1, 10);
        const prevStock = p.currentStock || 0;
        const newStock = prevStock + qty;
        const newSold = Math.max(0, (p.totalSold || 0) - qty);

        try {
          await this.updateProduct(p.id, {
            currentStock: newStock,
            totalSold: newSold,
            inStock: true,
            reason: `Restored from Cancelled Order #${order.orderRef || order.id} (+${qty} ${this.formatUnit(p.saleType, qty)})`
          });
        } catch (err) {
          console.error(`Failed to restore stock for product ${p.name}:`, err);
        }
      }
    }
  },

  /**
   * Save customer order enquiry in Supabase database & automatically deduct stock
   */
  async saveEnquiry(enquiry) {
    const config = this.getConfig();
    const orderRef = 'JC' + Date.now().toString().slice(-6);

    try {
      const record = {
        customer_name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email || null,
        address: enquiry.address,
        city: enquiry.city,
        state: enquiry.state,
        pincode: enquiry.pincode,
        items: enquiry.items,
        subtotal: enquiry.subtotal,
        discount_amount: enquiry.discountAmount,
        net_total: enquiry.netTotal,
        status: 'pending'
      };

      const res = await fetch(`${config.url}/rest/v1/enquiries`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([record])
      });

      let savedRecord = null;
      if (res.ok) {
        const data = await res.json();
        savedRecord = data && data[0] ? data[0] : record;
      } else {
        savedRecord = record;
      }

      // Automatic real-time stock deduction
      await this.deductStockForOrder({
        id: savedRecord.id || orderRef,
        orderRef: orderRef,
        items: enquiry.items
      });

      return savedRecord;
    } catch (e) {
      console.error('Supabase saveEnquiry exception:', e);
      return null;
    }
  },

  /**
   * Fetch all customer orders / enquiries strictly from Supabase
   */
  async fetchEnquiries() {
    const config = this.getConfig();
    try {
      const res = await fetch(`${config.url}/rest/v1/enquiries?select=*&order=created_at.desc`, {
        headers: this.getHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase enquiries fetch error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      return (data || []).map(e => ({
        id: e.id,
        orderRef: e.order_ref || ('JC' + String(e.id).slice(-6)),
        customerName: e.customer_name,
        phone: e.phone,
        email: e.email,
        address: e.address,
        city: e.city,
        state: e.state,
        pincode: e.pincode,
        items: e.items || [],
        subtotal: e.subtotal,
        discountAmount: e.discount_amount,
        netTotal: e.net_total,
        status: e.status || 'pending',
        createdAt: e.created_at
      }));
    } catch (err) {
      console.error('Supabase fetchEnquiries error:', err);
      return [];
    }
  },

  /**
   * Update enquiry / order status in Supabase (Handles cancellation stock restore)
   */
  async updateEnquiryStatus(enquiryId, newStatus) {
    const config = this.getConfig();
    const enquiries = await this.fetchEnquiries();
    const order = enquiries.find(e => String(e.id) === String(enquiryId));

    if (order && order.status !== 'cancelled' && newStatus === 'cancelled') {
      await this.restoreStockForOrder(order);
    }

    const res = await fetch(`${config.url}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}`, {
      method: 'PATCH',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ status: newStatus, updated_at: new Date().toISOString() })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update enquiry status (${res.status}): ${errText}`);
    }

    return await res.json();
  },

  /**
   * Delete an enquiry / order from Supabase
   */
  async deleteEnquiry(enquiryId) {
    const config = this.getConfig();
    const res = await fetch(`${config.url}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to delete enquiry (${res.status}): ${errText}`);
    }

    return true;
  },

  /**
   * Log an inventory change in memory and localStorage
   */
  async addInventoryLog(log) {
    const config = this.getConfig();
    const record = {
      product_id: String(log.productId || ''),
      product_name: log.productName || '',
      change_qty: parseInt(log.changeQty || 0, 10),
      sale_type: log.saleType || 'BOX',
      action_type: log.actionType || 'restock',
      previous_stock: parseInt(log.previousStock || 0, 10),
      new_stock: parseInt(log.newStock || 0, 10),
      reason: log.reason || '',
      created_at: new Date().toISOString()
    };

    try {
      await fetch(`${config.url}/rest/v1/inventory_logs`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([record])
      });
    } catch (e) {
      console.warn('Inventory log Supabase insert note:', e);
    }

    this.inventoryLogsCache.unshift(record);
    return record;
  },

  /**
   * Fetch Inventory Logs directly from Supabase
   */
  async fetchInventoryLogs() {
    const config = this.getConfig();
    try {
      const res = await fetch(`${config.url}/rest/v1/inventory_logs?select=*&order=created_at.desc&limit=200`, {
        headers: this.getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.inventoryLogsCache = data || [];
        return this.inventoryLogsCache;
      }
    } catch (err) {
      console.warn('Error fetching inventory logs from Supabase:', err);
    }
    return this.inventoryLogsCache;
  },

  /**
   * Comprehensive Analytics Aggregator
   */
  async fetchAnalytics(period = 'month') {
    const enquiries = await this.fetchEnquiries();
    const products = await this.fetchProducts();

    const now = new Date();
    const validOrders = enquiries.filter(e => e.status !== 'cancelled');

    const filteredOrders = validOrders.filter(e => {
      if (!e.createdAt) return true;
      const orderDate = new Date(e.createdAt);
      if (period === 'day') {
        return orderDate.toDateString() === now.toDateString();
      } else if (period === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      } else if (period === 'year') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
    const totalOrders = filteredOrders.length;
    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const productSalesMap = new Map();
    products.forEach(p => {
      productSalesMap.set(String(p.id), {
        id: p.id,
        name: p.name,
        code: p.code,
        category: p.category,
        saleType: p.saleType,
        unit: p.unit,
        price: p.price,
        currentStock: p.currentStock,
        unitsSold: 0,
        revenue: 0
      });
    });

    filteredOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const id = String(item.id || item.productId);
        const existing = productSalesMap.get(id);
        const qty = parseInt(item.qty || 1, 10);
        const amt = (item.price || 0) * qty;

        if (existing) {
          existing.unitsSold += qty;
          existing.revenue += amt;
        }
      });
    });

    const salesList = Array.from(productSalesMap.values());
    const totalUnitsSold = salesList.reduce((sum, p) => sum + p.unitsSold, 0);

    const bestSelling = [...salesList].sort((a, b) => b.unitsSold - a.unitsSold);
    const lowSelling = [...salesList].filter(p => p.unitsSold === 0 || p.unitsSold < 3).sort((a, b) => a.unitsSold - b.unitsSold);

    const lowStockCount = products.filter(p => p.currentStock > 0 && p.currentStock <= p.lowStockThreshold).length;
    const outOfStockCount = products.filter(p => p.currentStock <= 0).length;

    const todayOrders = validOrders.filter(e => e.createdAt && new Date(e.createdAt).toDateString() === now.toDateString());
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);

    const monthOrders = validOrders.filter(e => e.createdAt && new Date(e.createdAt).getMonth() === now.getMonth() && new Date(e.createdAt).getFullYear() === now.getFullYear());
    const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);

    const yearOrders = validOrders.filter(e => e.createdAt && new Date(e.createdAt).getFullYear() === now.getFullYear());
    const yearRevenue = yearOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);

    return {
      period,
      totalRevenue,
      totalOrders,
      totalUnitsSold,
      aov,
      todayRevenue,
      monthRevenue,
      yearRevenue,
      todayOrdersCount: todayOrders.length,
      monthOrdersCount: monthOrders.length,
      yearOrdersCount: yearOrders.length,
      lowStockCount,
      outOfStockCount,
      bestSelling,
      lowSelling,
      filteredOrders
    };
  },

  /**
   * Realtime Subscriptions
   */
  subscribeToProducts(onUpdate) {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      const config = this.getConfig();
      const client = supabase.createClient(config.url, config.anonKey);
      return client
        .channel('products-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
          await this.fetchProducts();
          if (typeof onUpdate === 'function') onUpdate(this.productsCache);
        })
        .subscribe();
    }
    return null;
  },

  subscribeToEnquiries(onUpdate) {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      const config = this.getConfig();
      const client = supabase.createClient(config.url, config.anonKey);
      return client
        .channel('enquiries-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, async (payload) => {
          const enquiries = await this.fetchEnquiries();
          if (typeof onUpdate === 'function') onUpdate(enquiries, payload);
        })
        .subscribe();
    }
    return null;
  }
};

if (typeof window !== 'undefined') {
  window.AshwanthDB = AshwanthDB;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AshwanthDB;
}
