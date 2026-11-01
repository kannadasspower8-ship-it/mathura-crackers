/**
 * Mathura Crackers - Cart & Order Enquiry Engine
 * Manages quantities, price totals, state persistence, checkout, WhatsApp order generation, and bill printing.
 */

const AshwanthCart = {
  cart: {}, // { [productId]: quantity }
  adminPhones: ['917010317389', '917418051084', '917200936916'],
  adminEmail: 'nathisoft1987@gmail.com',
  adminContactPerson: 'Sakthivel',
  minOrderTN: 3000,
  minOrderOther: 5000,

  init() {
    this.loadCart();
    this.updateUI();
    this.bindEvents();
  },

  loadCart() {
    try {
      const saved = localStorage.getItem('ashwanth_crackers_cart');
      if (saved) {
        this.cart = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading cart:', e);
      this.cart = {};
    }
  },

  saveCart() {
    try {
      localStorage.setItem('ashwanth_crackers_cart', JSON.stringify(this.cart));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  },

  getItem(productId) {
    if (!productId) return null;
    const strId = String(productId).trim();

    // Strictly check Supabase Cloud DB products cache (Single Source of Truth)
    if (window.AshwanthDB && Array.isArray(window.AshwanthDB.productsCache) && window.AshwanthDB.productsCache.length > 0) {
      const found = window.AshwanthDB.productsCache.find(p => 
        String(p.id).trim() === strId || 
        String(p.code).trim().toLowerCase() === strId.toLowerCase()
      );
      if (found) return found;
    }

    return null;
  },

  setQty(productId, qty) {
    qty = parseInt(qty, 10);
    const item = this.getItem(productId);
    const maxStock = item && item.currentStock !== undefined ? item.currentStock : 9999;

    if (isNaN(qty) || qty <= 0) {
      delete this.cart[productId];
    } else {
      if (qty > maxStock) {
        qty = maxStock;
        const unitPlural = item ? (item.saleType === 'PACKET' ? 'Packets' : 'Boxes') : 'units';
        if (window.AppDialog && AppDialog.toast) {
          AppDialog.toast({
            title: 'Stock Limit Reached',
            message: `Only ${maxStock} ${unitPlural} are available in stock.`,
            type: 'warning'
          });
        }
      }
      if (qty > 0) {
        this.cart[productId] = qty;
      } else {
        delete this.cart[productId];
      }
    }
    this.saveCart();
    this.updateUI();
  },

  increment(productId) {
    const item = this.getItem(productId);
    const maxStock = item && item.currentStock !== undefined ? item.currentStock : 9999;
    const current = this.cart[productId] || 0;

    if (current >= maxStock) {
      const unitPlural = item ? (item.saleType === 'PACKET' ? 'Packets' : 'Boxes') : 'units';
      if (window.AppDialog && AppDialog.toast) {
        AppDialog.toast({
          title: 'Stock Limit Reached',
          message: `Only ${maxStock} ${unitPlural} are available for ${item ? item.name : 'this product'}.`,
          type: 'warning'
        });
      }
      return;
    }

    this.setQty(productId, current + 1);
  },

  decrement(productId) {
    const current = this.cart[productId] || 0;
    if (current > 0) {
      this.setQty(productId, current - 1);
    }
  },

  clearCart() {
    this.cart = {};
    this.saveCart();
    this.updateUI();
  },

  getTotals() {
    let totalItems = 0;
    let totalQty = 0;
    let originalTotal = 0;
    let netTotal = 0;

    for (let [id, qty] of Object.entries(this.cart)) {
      if (qty > 0) {
        const item = this.getItem(id);
        if (item) {
          totalItems += 1;
          totalQty += qty;
          const orig = item.originalPrice || item.mrp || (item.price ? Math.round(item.price / 0.2) : item.price);
          const currentPrice = (typeof item.price === 'number') ? item.price : Math.round(orig * 0.2);
          originalTotal += orig * qty;
          netTotal += currentPrice * qty;
        }
      }
    }

    const totalSavings = Math.max(0, originalTotal - netTotal);

    return {
      totalItems,
      totalQty,
      originalTotal,
      netTotal,
      totalSavings
    };
  },

  updateUI() {
    const totals = this.getTotals();

    // 1. Update Cart Toggle Badges in Header & add bump animation
    document.querySelectorAll('.cart-count-badge').forEach(badge => {
      badge.textContent = totals.totalQty;
      badge.style.display = totals.totalQty > 0 ? 'inline-flex' : 'none';
    });

    document.querySelectorAll('.cart-toggle-btn').forEach(btn => {
      btn.classList.remove('cart-bump');
      if (totals.totalQty > 0) {
        void btn.offsetWidth; // trigger reflow for animation
        btn.classList.add('cart-bump');
      }
    });

    // 2. Update Floating Order Bar
    const orderBar = document.getElementById('floating-order-bar');
    if (orderBar) {
      if (totals.totalQty > 0) {
        orderBar.classList.add('visible');
        document.body.classList.add('has-order-bar');
        const countElem = document.getElementById('order-bar-items');
        const qtyElem = document.getElementById('order-bar-qty');
        const amountElem = document.getElementById('order-bar-amount');
        const savingsElem = document.getElementById('order-bar-savings');
        const savingsItem = document.getElementById('savings-item');

        if (countElem) countElem.textContent = `${totals.totalItems} Items`;
        if (qtyElem) qtyElem.textContent = `${totals.totalQty} ${totals.totalQty === 1 ? 'Box' : 'Boxes'}`;
        if (amountElem) amountElem.textContent = `₹${totals.netTotal.toLocaleString('en-IN')}`;
        if (savingsElem) savingsElem.textContent = `₹${totals.totalSavings.toLocaleString('en-IN')}`;
        if (savingsItem) savingsItem.style.display = totals.totalSavings > 0 ? 'flex' : 'none';
      } else {
        orderBar.classList.remove('visible');
        document.body.classList.remove('has-order-bar');
      }
    }

    // 3. Update Individual Product Card Actions (if on Catalog page)
    document.querySelectorAll('.product-card').forEach(card => {
      const id = card.dataset.productId;
      if (!id) return;
      const qty = this.cart[id] || 0;
      const item = this.getItem(id);
      const isBox = !item || item.saleType !== 'PACKET';
      const unitSingle = isBox ? 'BOX' : 'PKT';
      const unitPlural = isBox ? 'BOXES' : 'PKTS';
      const isOutOfStock = (item && item.currentStock !== undefined && item.currentStock <= 0);

      const cartBadge = card.querySelector('.product-in-cart-indicator');
      const numEl = card.querySelector('.qty-value-number');
      const unitEl = card.querySelector('.qty-value-unit');
      const actionSection = card.querySelector('.product-action-section') || card.querySelector('.product-action-wrap');

      if (isOutOfStock) {
        card.classList.remove('in-cart');
        if (cartBadge) cartBadge.style.display = 'none';
        if (numEl) numEl.textContent = '0';
        if (unitEl) unitEl.textContent = unitSingle;
        if (actionSection) {
          actionSection.innerHTML = `
            <button type="button" class="btn-add-to-enquiry" disabled style="opacity: 0.55; background: #64748b; cursor: not-allowed; box-shadow: none;">
              <span class="material-symbols-outlined" style="font-size: 19px;">block</span>
              <span>OUT OF STOCK</span>
            </button>
          `;
        }
        return;
      }

      if (qty > 0) {
        card.classList.add('in-cart');
        if (cartBadge) cartBadge.style.display = 'inline-flex';
        if (numEl) numEl.textContent = qty;
        if (unitEl) unitEl.textContent = qty === 1 ? unitSingle : unitPlural;

        if (actionSection) {
          actionSection.innerHTML = `
            <div class="card-added-action-group">
              <button type="button" class="btn-card-added" onclick="AshwanthCart.openCheckoutModal()" title="View Enquiry List">
                <span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span>
                <span>IN ENQUIRY LIST (${qty})</span>
              </button>
              <button type="button" class="btn-card-remove" onclick="if(window.removeFromEnquiryFromCard){removeFromEnquiryFromCard('${id}')}else{AshwanthCart.setQty('${id}',0);}" title="Remove from enquiry list">
                <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
                <span>REMOVE</span>
              </button>
            </div>
          `;
        }
      } else {
        card.classList.remove('in-cart');
        if (cartBadge) cartBadge.style.display = 'none';
        const localQty = (window.localQtyState && typeof window.localQtyState[id] === 'number') ? window.localQtyState[id] : 1;
        if (numEl) numEl.textContent = localQty;
        if (unitEl) unitEl.textContent = localQty === 1 ? unitSingle : unitPlural;

        if (actionSection) {
          actionSection.innerHTML = `
            <button type="button" class="btn-add-to-enquiry" onclick="if(window.addToEnquiryFromCard){addToEnquiryFromCard('${id}')}else{AshwanthCart.setQty('${id}',1);}">
              <span class="material-symbols-outlined" style="font-size: 19px;">add_shopping_cart</span>
              <span>ADD TO ENQUIRY</span>
            </button>
          `;
        }
      }
    });

    // 4. Update Modal Order Summary (if open)
    this.renderModalSummary();
  },

  renderModalSummary() {
    const summaryContainer = document.getElementById('modal-cart-summary');
    if (!summaryContainer) return;

    const totals = this.getTotals();

    if (totals.totalQty === 0) {
      summaryContainer.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--outline);">
          <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">shopping_basket</span>
          <p style="margin-top: 8px; font-weight: 600;">Your enquiry list is currently empty.</p>
          <a href="enquiry.html" class="btn btn-primary btn-sm" style="margin-top: 14px;">Browse Catalog</a>
        </div>
      `;
      return;
    }

    let itemsHtml = '';
    for (let [id, qty] of Object.entries(this.cart)) {
      const item = this.getItem(id);
      if (item && qty > 0) {
        const itemTotal = item.price * qty;
        itemsHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--border-light); font-size: 0.9rem; gap: 8px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; color: var(--on-surface); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
              <div style="font-size: 0.75rem; color: var(--outline);">${item.code} • ₹${item.price} each</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <div class="qty-control" style="padding: 2px 4px; scale: 0.88;">
                <button type="button" class="qty-btn" style="width:24px; height:24px;" onclick="AshwanthCart.decrement('${item.id}')">
                  <span class="material-symbols-outlined" style="font-size: 14px;">remove</span>
                </button>
                <span style="font-weight: 700; font-size: 0.85rem; width: 28px; text-align: center; color: var(--on-surface);">${qty}</span>
                <button type="button" class="qty-btn" style="width:24px; height:24px;" onclick="AshwanthCart.increment('${item.id}')">
                  <span class="material-symbols-outlined" style="font-size: 14px;">add</span>
                </button>
              </div>
              <span style="font-weight: 800; color: var(--primary); min-width: 60px; text-align: right;">₹${itemTotal.toLocaleString('en-IN')}</span>
              <button type="button" onclick="AshwanthCart.setQty('${item.id}', 0)" style="color: #ba1a1a; background: none; padding: 2px; border: none; cursor: pointer;" title="Remove">
                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    summaryContainer.innerHTML = `
      <div style="margin-bottom: 14px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 4px 12px; background: #fafafa; max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
        ${itemsHtml}
      </div>
      <div style="background: #fdfbf7; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(229, 160, 0, 0.28);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: var(--on-surface-variant);">
          <span>Total Original MRP:</span>
          <span style="text-decoration: line-through; color: #94a3b8;">₹${totals.originalTotal.toLocaleString('en-IN')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem; color: #15803d; font-weight: 700;">
          <span>Mega Festive Discount (80%):</span>
          <span>- ₹${totals.totalSavings.toLocaleString('en-IN')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; color: var(--primary); border-top: 1px solid rgba(229, 160, 0, 0.2); padding-top: 8px;">
          <span>Net Estimated Amount:</span>
          <span style="color: #b45309;">₹${totals.netTotal.toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size: 0.74rem; color: var(--outline); margin-top: 4px; text-align: right;">
          Total Quantity: <strong>${totals.totalQty} Items</strong>
        </div>
      </div>
    `;
  },

  lastSubmittedOrder: null,

  openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    // Reset views
    const formView = document.getElementById('checkout-form-view');
    const successView = document.getElementById('checkout-success-view');

    const totals = this.getTotals();
    if (totals.totalQty === 0 && !this.lastSubmittedOrder) {
      if (window.AppDialog) {
        AppDialog.alert({
          title: 'Enquiry List Empty',
          message: 'Please add at least one product to your enquiry list before proceeding.',
          icon: 'shopping_bag',
          type: 'warning',
          buttonText: 'Browse Catalog'
        });
      } else {
        alert('Please add at least one product to your enquiry list before proceeding.');
      }
      return;
    }

    if (formView) formView.style.display = 'block';
    if (successView) successView.style.display = 'none';

    this.renderModalSummary();
    modal.classList.add('open');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // Reset scroll position to top
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;
  },

  closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  },

  async submitEnquiry(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('cust-name')?.value.trim();
    const phone = document.getElementById('cust-phone')?.value.trim();
    const email = document.getElementById('cust-email')?.value.trim() || '';
    const address = document.getElementById('cust-address')?.value.trim();
    const city = document.getElementById('cust-city')?.value.trim();
    const state = document.getElementById('cust-state')?.value.trim();
    const pincode = document.getElementById('cust-pincode')?.value.trim();

    if (!name || !phone || !address || !city || !state || !pincode) {
      if (window.AppDialog) {
        await AppDialog.alert({
          title: 'Missing Required Fields',
          message: 'Please fill in all required fields (Name, Phone, Address, City, State, Pincode).',
          icon: 'edit_note',
          type: 'warning',
          buttonText: 'Complete Form'
        });
      } else {
        alert('Please fill in all required fields (Name, Phone, Address, City, State, Pincode).');
      }
      return;
    }

    // Phone format check
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      if (window.AppDialog) {
        await AppDialog.alert({
          title: 'Invalid Mobile Number',
          message: 'Please enter a valid 10-digit mobile number for order delivery coordination.',
          icon: 'phone_android',
          type: 'warning',
          buttonText: 'Check Number'
        });
      } else {
        alert('Please enter a valid 10-digit mobile number.');
      }
      return;
    }

    const totals = this.getTotals();
    if (totals.totalQty === 0) {
      if (window.AppDialog) {
        await AppDialog.alert({
          title: 'Enquiry List Empty',
          message: 'Your enquiry list is currently empty. Please select fireworks first.',
          icon: 'shopping_cart',
          type: 'warning',
          buttonText: 'Add Fireworks'
        });
      } else {
        alert('Your enquiry list is currently empty.');
      }
      return;
    }

    const minThreshold = state.toLowerCase().includes('tamil') ? this.minOrderTN : this.minOrderOther;
    if (totals.netTotal < minThreshold) {
      let proceed = false;
      if (window.AppDialog) {
        proceed = await AppDialog.confirm({
          title: 'Minimum Order Notice',
          message: `Minimum order requirement is ₹${minThreshold.toLocaleString('en-IN')} for ${state}. Your current order total is ₹${totals.netTotal.toLocaleString('en-IN')}.\n\nWould you still like to submit this enquiry?`,
          icon: 'local_shipping',
          type: 'warning',
          confirmText: 'Yes, Submit Anyway',
          cancelText: 'Add More Items'
        });
      } else {
        proceed = confirm(`Minimum order requirement is ₹${minThreshold.toLocaleString('en-IN')} for ${state}. Your current order total is ₹${totals.netTotal.toLocaleString('en-IN')}. Would you still like to submit this enquiry?`);
      }
      if (!proceed) return;
    }

    const submitBtn = document.getElementById('btn-submit-enquiry');
    const submitText = document.getElementById('btn-submit-text');
    if (submitBtn) {
      submitBtn.disabled = true;
      if (submitText) submitText.textContent = 'SUBMITTING ENQUIRY...';
    }

    // Build Order Object
    const orderRef = `JC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderItems = [];

    for (let [id, qty] of Object.entries(this.cart)) {
      const item = this.getItem(id);
      if (item && qty > 0) {
        orderItems.push({
          id: item.id,
          code: item.code || '',
          name: item.name,
          unit: item.unit || '1 Box',
          qty: qty,
          originalPrice: item.originalPrice || Math.round(item.price / 0.2),
          price: item.price,
          total: item.price * qty
        });
      }
    }

    const orderData = {
      orderRef,
      createdAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      customer: { name, phone: cleanPhone, email, address, city, state, pincode },
      items: orderItems,
      totals: { ...totals }
    };

    // Save order to Supabase
    try {
      if (window.AshwanthDB) {
        await AshwanthDB.saveEnquiry({
          name: name,
          phone: cleanPhone,
          email,
          address,
          city,
          state,
          pincode,
          items: orderItems,
          subtotal: totals.originalTotal,
          discountAmount: totals.totalSavings,
          netTotal: totals.netTotal
        });
      }
    } catch (err) {
      console.warn('Supabase enquiry save note:', err);
    }

    // Store confirmed order
    this.lastSubmittedOrder = orderData;
    try {
      localStorage.setItem('mathura_last_order', JSON.stringify(orderData));
      localStorage.setItem('jadayu_last_order', JSON.stringify(orderData));
    } catch (e) {}

    // Clear Cart
    this.clearCart();

    // Reset button
    if (submitBtn) {
      submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'SUBMIT ENQUIRY REQUEST';
    }

    // Render Success Confirmation View
    this.renderSuccessConfirmation(orderData);
  },

  renderSuccessConfirmation(order) {
    const formView = document.getElementById('checkout-form-view');
    const successView = document.getElementById('checkout-success-view');
    const snapshot = document.getElementById('confirmation-snapshot');
    const phoneSpan = document.getElementById('success-phone-text');
    const whatsappLink = document.getElementById('confirmation-whatsapp-link');

    if (formView) formView.style.display = 'none';
    if (successView) successView.style.display = 'block';

    if (phoneSpan) phoneSpan.textContent = `+91 ${order.customer.phone}`;

    if (whatsappLink) {
      const msg = `Hi Sakthivel, I have submitted order enquiry ${order.orderRef} on Mathura Crackers for ₹${order.totals.netTotal.toLocaleString('en-IN')}. Please confirm stock availability.`;
      whatsappLink.href = `https://api.whatsapp.com/send?phone=${this.adminPhones[0]}&text=${encodeURIComponent(msg)}`;
    }

    if (snapshot) {
      let itemsListHtml = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.85rem;">
          <div>
            <strong>${item.name}</strong> <span style="color: #64748b;">(${item.qty} × ₹${item.price})</span>
          </div>
          <div style="font-weight: 700; color: var(--primary);">₹${item.total.toLocaleString('en-IN')}</div>
        </div>
      `).join('');

      snapshot.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">
          <div>
            <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700;">Order Reference ID</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #1e293b; letter-spacing: 0.04em;">${order.orderRef}</div>
          </div>
          <span style="background: #dcfce7; color: #15803d; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 12px;">
            ● PENDING CONFIRMATION
          </span>
        </div>

        <div style="font-size: 0.85rem; color: #334155; margin-bottom: 12px; line-height: 1.5;">
          <strong>Customer:</strong> ${order.customer.name} &nbsp;|&nbsp; <strong>Phone:</strong> ${order.customer.phone}<br/>
          <strong>Delivery:</strong> ${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}
        </div>

        <div style="max-height: 150px; overflow-y: auto; margin-bottom: 12px;">
          ${itemsListHtml}
        </div>

        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 0.9rem;">
          <div style="display: flex; justify-content: space-between; color: #64748b; margin-bottom: 4px; font-size: 0.8rem;">
            <span>Total Original MRP:</span>
            <span style="text-decoration: line-through;">₹${order.totals.originalTotal.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #16a34a; font-weight: 700; margin-bottom: 4px; font-size: 0.82rem;">
            <span>Mega Festive Discount (80%):</span>
            <span>- ₹${order.totals.totalSavings.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--primary); font-size: 1.1rem; border-top: 1px solid #cbd5e1; padding-top: 6px;">
            <span>Net Estimated Amount:</span>
            <span>₹${order.totals.netTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      `;
    }
  },

  printLastOrderSlip() {
    const order = this.lastSubmittedOrder;
    if (!order) {
      if (window.AppDialog) {
        AppDialog.alert({
          title: 'No Order Found',
          message: 'No confirmed order found to print.',
          icon: 'receipt_long',
          type: 'warning',
          buttonText: 'OK'
        });
      } else {
        alert('No confirmed order found to print.');
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (window.AppDialog) {
        AppDialog.alert({
          title: 'Popups Blocked',
          message: 'Please allow browser popups to print your order slip.',
          icon: 'print_disabled',
          type: 'warning',
          buttonText: 'Got It'
        });
      } else {
        alert('Please allow popups to print your order slip.');
      }
      return;
    }

    let itemsRows = '';
    let count = 1;

    for (let item of order.items) {
      const orig = item.originalPrice || Math.round(item.price / 0.2);
      const rate = item.price;
      const total = item.total || (rate * item.qty);
      const discount = Math.round(((orig - rate) / orig) * 100) || 80;

      itemsRows += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; font-weight: 700; color: #64748b;">${count++}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">
            <strong style="color: #0f172a; font-size: 13.5px;">${item.name}</strong>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px; font-family: monospace;">Code: ${item.code || '-'} • Packing: ${item.unit || '1 Box'}</div>
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; font-weight: 800; color: #0284c7; font-size: 13px;">${item.qty} ${item.unit && item.unit.includes('Pkt') ? 'Pkt' : 'Box'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px 10px; text-align: right; color: #94a3b8; text-decoration: line-through; font-size: 12.5px;">₹${orig.toLocaleString('en-IN')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; color: #dc2626; font-weight: 800; font-size: 11.5px; background: #fff5f5;">${discount}% OFF</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px 10px; text-align: right; font-weight: 800; color: #16a34a; font-size: 13px;">₹${rate.toLocaleString('en-IN')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-weight: 900; color: #ac332a; font-size: 13.5px; background: #fdfaf9;">₹${total.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }

    const orderHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>MATHURA CRACKERS - Order Slip ${order.orderRef}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            padding: 20px;
            line-height: 1.4;
          }
          .bill-card {
            max-width: 840px;
            margin: 0 auto;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #ac332a;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .title-area h1 {
            font-size: 26px;
            font-weight: 900;
            color: #ac332a;
            letter-spacing: -0.01em;
          }
          .title-area p {
            font-size: 12px;
            color: #475569;
            margin-top: 3px;
          }
          .doc-badge {
            background: #fff1f0;
            border: 1.5px solid #ffccc7;
            color: #ac332a;
            padding: 8px 16px;
            border-radius: 8px;
            text-align: right;
          }
          .doc-badge h3 { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .doc-badge span { font-size: 11px; font-weight: 700; color: #16a34a; }

          .customer-meta-grid {
            display: grid;
            grid-template-columns: 1.1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 18px;
            font-size: 12.5px;
          }
          .meta-item { margin-bottom: 5px; }
          .meta-lbl { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .meta-val { color: #0f172a; font-weight: 700; }

          table.bill-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12.5px;
          }
          table.bill-table th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 11px;
            padding: 10px 8px;
            border: 1px solid #cbd5e1;
          }
          table.bill-table tr:nth-child(even) td {
            background: #fcfcfc;
          }

          .summary-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
          }
          .summary-box {
            width: 380px;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
            background: #ffffff;
          }
          .sum-row {
            display: flex;
            justify-content: space-between;
            padding: 9px 16px;
            font-size: 13px;
            border-bottom: 1px solid #f1f5f9;
          }
          .sum-row.green-bg {
            background: #f0fdf4;
            color: #16a34a;
            font-weight: 700;
          }
          .sum-row.total-bg {
            background: #fff1f0;
            color: #ac332a;
            font-weight: 900;
            font-size: 16px;
            border-bottom: none;
            padding: 12px 16px;
          }

          .notice-box {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 12px;
            color: #92400e;
            line-height: 1.6;
          }
          .footer-text {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1px dashed #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="bill-card">
          <!-- Header -->
          <div class="header-box">
            <div class="title-area">
              <h1>MATHURA CRACKERS</h1>
              <p><strong>4/190, Mettamalai, Sattur - 626203, Virudhunagar District, Tamil Nadu</strong></p>
              <p>Prop: <strong>Sakthivel</strong> | Order Hotline: <strong>+91 70103 17389 / +91 74180 51084 / +91 72009 36916</strong> | Email: nathisoft1987@gmail.com</p>
            </div>
            <div class="doc-badge">
              <h3>CUSTOMER ORDER SLIP</h3>
              <span>● PENDING DISPATCH</span>
            </div>
          </div>

          <!-- Customer & Order Meta -->
          <div class="customer-meta-grid">
            <div>
              <div class="meta-item"><span class="meta-lbl">Customer Name:</span> <span class="meta-val">${order.customer.name}</span></div>
              <div class="meta-item"><span class="meta-lbl">Mobile Number:</span> <span class="meta-val">+91 ${order.customer.phone}</span></div>
              <div class="meta-item"><span class="meta-lbl">Delivery Address:</span> <span class="meta-val">${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}</span></div>
            </div>
            <div style="text-align: right;">
              <div class="meta-item"><span class="meta-lbl">Order Reference:</span> <span class="meta-val" style="color:#ac332a; font-size:14px;">${order.orderRef}</span></div>
              <div class="meta-item"><span class="meta-lbl">Booking Date:</span> <span class="meta-val">${order.createdAt}</span></div>
              <div class="meta-item"><span class="meta-lbl">Dispatched From:</span> <span class="meta-val">Sivakasi Direct Warehouse</span></div>
            </div>
          </div>

          <!-- Itemized Table -->
          <table class="bill-table">
            <thead>
              <tr>
                <th style="width: 36px; text-align: center;">#</th>
                <th style="text-align: left;">Product Description</th>
                <th style="width: 80px; text-align: center;">Quantity</th>
                <th style="width: 85px; text-align: right;">MRP Rate</th>
                <th style="width: 80px; text-align: center;">Discount</th>
                <th style="width: 95px; text-align: right;">Your Rate</th>
                <th style="width: 105px; text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <!-- Easy-to-understand Totals Breakdown -->
          <div class="summary-wrap">
            <div class="summary-box">
              <div class="sum-row">
                <span>Total Items & Boxes:</span>
                <strong>${order.totals.totalItems} Items (${order.totals.totalQty} Boxes)</strong>
              </div>
              <div class="sum-row">
                <span>Original MRP Value:</span>
                <span style="text-decoration: line-through; color: #64748b;">₹${order.totals.originalTotal.toLocaleString('en-IN')}</span>
              </div>
              <div class="sum-row green-bg">
                <span>🎉 Festive Discount (80% OFF):</span>
                <span>- ₹${order.totals.totalSavings.toLocaleString('en-IN')}</span>
              </div>
              <div class="sum-row total-bg">
                <span>NET FINAL PAYABLE:</span>
                <span>₹${order.totals.netTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <!-- Next Steps & Payment Notice -->
          <div class="notice-box">
            <strong>💳 Next Steps for Advance Payment & Dispatch:</strong>
            <p style="margin-top: 4px;">1. Please share this Order Slip or Order Reference <strong>${order.orderRef}</strong> with our team on WhatsApp <strong>+91 70103 17389 / +91 74180 51084</strong>.</p>
            <p>2. Our packing godown in Sivakasi will verify all items and share official UPI / Bank details for secure advance transfer.</p>
            <p>3. As per statutory explosive safety norms (2018 Supreme Court Order), goods are securely packed in heavy poly bundle cartons and delivered via verified transport carriers.</p>
          </div>

          <div class="footer-text">
            Thank you for choosing MATHURA CRACKERS SIVAKASI! Wishing you and your family a safe, grand & sparkling celebration!
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(orderHtml);
    printWindow.document.close();
    printWindow.focus();
  },

  printEstimate() {
    const totals = this.getTotals();
    if (totals.totalQty === 0) {
      if (window.AppDialog) {
        AppDialog.alert({
          title: 'Enquiry List Empty',
          message: 'Please add at least one product before printing an estimate.',
          icon: 'shopping_cart',
          type: 'warning',
          buttonText: 'Add Products'
        });
      } else {
        alert('Please add at least one product before printing an estimate.');
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (window.AppDialog) {
        AppDialog.alert({
          title: 'Popups Blocked',
          message: 'Please allow browser popups to print your estimate.',
          icon: 'print_disabled',
          type: 'warning',
          buttonText: 'Got It'
        });
      } else {
        alert('Please allow popups to print your estimate.');
      }
      return;
    }

    let itemsRows = '';
    let count = 1;

    for (let [id, qty] of Object.entries(this.cart)) {
      const item = this.getItem(id);
      if (item && qty > 0) {
        const orig = item.originalPrice || item.mrp || (item.price ? Math.round(item.price / 0.2) : item.price);
        const rate = (typeof item.price === 'number') ? item.price : Math.round(orig * 0.2);
        const total = rate * qty;
        const discount = Math.round(((orig - rate) / orig) * 100) || 80;

        itemsRows += `
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; font-weight: 700; color: #64748b;">${count++}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px 12px;">
              <strong style="color: #0f172a; font-size: 13.5px;">${item.name}</strong>
              <div style="color: #64748b; font-size: 11px; margin-top: 2px; font-family: monospace;">Code: ${item.code || '-'} • Packing: ${item.unit || '1 Box'}</div>
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; font-weight: 800; color: #0284c7; font-size: 13px;">${qty} ${item.unit && item.unit.includes('Pkt') ? 'Pkt' : 'Box'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px 10px; text-align: right; color: #94a3b8; text-decoration: line-through; font-size: 12.5px;">₹${orig.toLocaleString('en-IN')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; color: #dc2626; font-weight: 800; font-size: 11.5px; background: #fff5f5;">${discount}% OFF</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px 10px; text-align: right; font-weight: 800; color: #16a34a; font-size: 13px;">₹${rate.toLocaleString('en-IN')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-weight: 900; color: #ac332a; font-size: 13.5px; background: #fdfaf9;">₹${total.toLocaleString('en-IN')}</td>
          </tr>
        `;
      }
    }

    const todayDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const estRef = `EST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const estimateHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>MATHURA CRACKERS - Estimate Quotation ${estRef}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            padding: 20px;
            line-height: 1.4;
          }
          .bill-card {
            max-width: 840px;
            margin: 0 auto;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #ac332a;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .title-area h1 {
            font-size: 26px;
            font-weight: 900;
            color: #ac332a;
            letter-spacing: -0.01em;
          }
          .title-area p {
            font-size: 12px;
            color: #475569;
            margin-top: 3px;
          }
          .doc-badge {
            background: #fff1f0;
            border: 1.5px solid #ffccc7;
            color: #ac332a;
            padding: 8px 16px;
            border-radius: 8px;
            text-align: right;
          }
          .doc-badge h3 { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .doc-badge span { font-size: 11px; font-weight: 700; color: #475569; }

          .customer-meta-grid {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 18px;
            font-size: 12.5px;
          }
          .meta-lbl { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .meta-val { color: #0f172a; font-weight: 700; }

          table.bill-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12.5px;
          }
          table.bill-table th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 11px;
            padding: 10px 8px;
            border: 1px solid #cbd5e1;
          }
          table.bill-table tr:nth-child(even) td {
            background: #fcfcfc;
          }

          .summary-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
          }
          .summary-box {
            width: 380px;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
            background: #ffffff;
          }
          .sum-row {
            display: flex;
            justify-content: space-between;
            padding: 9px 16px;
            font-size: 13px;
            border-bottom: 1px solid #f1f5f9;
          }
          .sum-row.green-bg {
            background: #f0fdf4;
            color: #16a34a;
            font-weight: 700;
          }
          .sum-row.total-bg {
            background: #fff1f0;
            color: #ac332a;
            font-weight: 900;
            font-size: 16px;
            border-bottom: none;
            padding: 12px 16px;
          }

          .notice-box {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 12px;
            color: #92400e;
            line-height: 1.6;
          }
          .footer-text {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-top: 16px;
            padding-top: 10px;
            border-top: 1px dashed #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="bill-card">
          <!-- Header -->
          <div class="header-box">
            <div class="title-area">
              <h1>MATHURA CRACKERS</h1>
              <p><strong>4/190, Mettamalai, Sattur - 626203, Virudhunagar District, Tamil Nadu</strong></p>
              <p>Prop: <strong>Sakthivel</strong> | Order Hotline: <strong>+91 70103 17389 / +91 74180 51084 / +91 72009 36916</strong> | Email: nathisoft1987@gmail.com</p>
            </div>
            <div class="doc-badge">
              <h3>ESTIMATE / QUOTATION</h3>
              <span>${estRef}</span>
            </div>
          </div>

          <!-- Quotation Meta -->
          <div class="customer-meta-grid">
            <div>
              <span class="meta-lbl">Date of Quotation:</span> <span class="meta-val">${todayDate}</span>
            </div>
            <div>
              <span class="meta-lbl">Pricing Tier:</span> <span class="meta-val" style="color:#16a34a;">Direct Sivakasi Manufacturer Wholesale</span>
            </div>
            <div>
              <span class="meta-lbl">Delivery:</span> <span class="meta-val">Verified Road Logistics</span>
            </div>
          </div>

          <!-- Itemized Table with Clear Rate/Box -->
          <table class="bill-table">
            <thead>
              <tr>
                <th style="width: 36px; text-align: center;">#</th>
                <th style="text-align: left;">Product Description</th>
                <th style="width: 80px; text-align: center;">Quantity</th>
                <th style="width: 85px; text-align: right;">MRP Rate</th>
                <th style="width: 80px; text-align: center;">Discount</th>
                <th style="width: 95px; text-align: right;">Your Rate</th>
                <th style="width: 105px; text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <!-- Easy-to-understand Totals Breakdown -->
          <div class="summary-wrap">
            <div class="summary-box">
              <div class="sum-row">
                <span>Total Items & Boxes:</span>
                <strong>${totals.totalItems} Items (${totals.totalQty} Boxes)</strong>
              </div>
              <div class="sum-row">
                <span>Original MRP Value:</span>
                <span style="text-decoration: line-through; color: #64748b;">₹${totals.originalTotal.toLocaleString('en-IN')}</span>
              </div>
              <div class="sum-row green-bg">
                <span>🎉 Festive Discount (80% OFF):</span>
                <span>- ₹${totals.totalSavings.toLocaleString('en-IN')}</span>
              </div>
              <div class="sum-row total-bg">
                <span>NET ESTIMATED PAYABLE:</span>
                <span>₹${totals.netTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <!-- Next Steps & Payment Notice -->
          <div class="notice-box">
            <strong>💳 How to Book this Estimate:</strong>
            <p style="margin-top: 4px;">• Click <strong>VIEW CART & BUY / ENQUIRE</strong> on our website to submit your delivery address.</p>
            <p>• Alternatively, send a screenshot of this Estimate Slip directly to WhatsApp: <strong>+91 70103 17389 / +91 74180 51084</strong>.</p>
            <p>• Banking / UPI details for advance transfer will be provided after stock confirmation by proprietor Sakthivel.</p>
          </div>

          <div class="footer-text">
            * In compliance with the 2018 Supreme Court Order, firecrackers are dispatched through authorized transport hubs.
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(estimateHtml);
    printWindow.document.close();
    printWindow.focus();
  },

  bindEvents() {
    // Backdrop click to close
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeCheckoutModal();
      });
    }

    // Escape key listener to close checkout modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const m = document.getElementById('checkout-modal');
        if (m && m.classList.contains('open')) {
          this.closeCheckoutModal();
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AshwanthCart.init();
});

if (typeof window !== 'undefined') {
  window.AshwanthCart = AshwanthCart;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AshwanthCart;
}

