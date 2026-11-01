/**
 * Mathura Crackers - Custom Dialog & Notification Card System
 * Completely replaces native browser Chrome alerts & confirms with themed interactive cards.
 */

const AppDialog = {
  activeResolve: null,

  init() {
    if (document.getElementById('app-dialog-backdrop')) return;

    // 1. Create Modal Dialog DOM (initially hidden)
    const backdrop = document.createElement('div');
    backdrop.id = 'app-dialog-backdrop';
    backdrop.className = 'app-dialog-backdrop';
    backdrop.style.display = 'none';
    backdrop.innerHTML = `
      <div class="app-dialog-card" id="app-dialog-card" role="dialog" aria-modal="true">
        <div class="app-dialog-icon-wrap" id="app-dialog-icon-wrap">
          <span class="material-symbols-outlined" id="app-dialog-icon">info</span>
        </div>
        <h3 class="app-dialog-title" id="app-dialog-title"></h3>
        <p class="app-dialog-message" id="app-dialog-message"></p>
        <div class="app-dialog-actions" id="app-dialog-actions">
          <button type="button" class="app-dialog-btn app-dialog-btn-secondary" id="app-dialog-btn-cancel" style="display:none;">Cancel</button>
          <button type="button" class="app-dialog-btn app-dialog-btn-primary" id="app-dialog-btn-confirm">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    // 2. Create Toast Container DOM if not present
    if (!document.getElementById('app-toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'app-toast-container';
      toastContainer.className = 'app-toast-container';
      document.body.appendChild(toastContainer);
    }

    // Bind Button Events
    const confirmBtn = document.getElementById('app-dialog-btn-confirm');
    const cancelBtn = document.getElementById('app-dialog-btn-cancel');

    confirmBtn.addEventListener('click', () => {
      this.close(true);
    });

    cancelBtn.addEventListener('click', () => {
      this.close(false);
    });

    // Keyboard support (Escape / Enter)
    document.addEventListener('keydown', (e) => {
      const isVisible = backdrop.classList.contains('active');
      if (!isVisible) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.close(true);
      }
    });
  },

  /**
   * Display a custom Alert Card
   */
  alert(options) {
    return new Promise((resolve) => {
      this.init();

      let title = 'Notice';
      let message = '';
      let icon = 'info';
      let type = 'info';
      let buttonText = 'OK';

      if (typeof options === 'string') {
        message = options;
        if (message.toLowerCase().includes('empty') || message.toLowerCase().includes('select') || message.toLowerCase().includes('fill') || message.toLowerCase().includes('valid')) {
          title = 'Action Required';
          icon = 'warning';
          type = 'warning';
        } else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
          title = 'Notice';
          icon = 'error';
          type = 'danger';
        }
      } else if (typeof options === 'object' && options !== null) {
        title = options.title || 'Notice';
        message = options.message || '';
        icon = options.icon || (options.type === 'danger' ? 'error' : options.type === 'warning' ? 'warning' : 'info');
        type = options.type || 'info';
        buttonText = options.buttonText || options.confirmText || 'OK';
      }

      this.activeResolve = resolve;

      const backdrop = document.getElementById('app-dialog-backdrop');
      const card = document.getElementById('app-dialog-card');
      const titleEl = document.getElementById('app-dialog-title');
      const msgEl = document.getElementById('app-dialog-message');
      const iconEl = document.getElementById('app-dialog-icon');
      const confirmBtn = document.getElementById('app-dialog-btn-confirm');
      const cancelBtn = document.getElementById('app-dialog-btn-cancel');

      // Setup Classes & Content
      card.className = `app-dialog-card type-${type}`;
      titleEl.textContent = title;
      msgEl.textContent = message;
      iconEl.textContent = icon;
      confirmBtn.textContent = buttonText;
      confirmBtn.className = `app-dialog-btn ${type === 'danger' ? 'app-dialog-btn-danger' : 'app-dialog-btn-primary'}`;
      cancelBtn.style.display = 'none';

      backdrop.style.display = 'flex';
      backdrop.classList.add('active');
      confirmBtn.focus();
    });
  },

  /**
   * Display a custom Confirm Card
   */
  confirm(options) {
    return new Promise((resolve) => {
      this.init();

      let title = 'Please Confirm';
      let message = '';
      let icon = 'help';
      let type = 'warning';
      let confirmText = 'Yes, Proceed';
      let cancelText = 'Cancel';

      if (typeof options === 'string') {
        message = options;
        if (message.toLowerCase().includes('delete') || message.toLowerCase().includes('remove')) {
          title = 'Confirm Deletion';
          icon = 'delete';
          type = 'danger';
          confirmText = 'Yes, Delete';
        } else if (message.toLowerCase().includes('minimum') || message.toLowerCase().includes('order requirement')) {
          title = 'Minimum Order Notice';
          icon = 'local_shipping';
          type = 'warning';
          confirmText = 'Yes, Submit Anyway';
          cancelText = 'Add More Items';
        } else if (message.toLowerCase().includes('discount') || message.toLowerCase().includes('across all')) {
          title = 'Update Store Discount';
          icon = 'percent';
          type = 'warning';
          confirmText = 'Yes, Apply to All';
        }
      } else if (typeof options === 'object' && options !== null) {
        title = options.title || 'Please Confirm';
        message = options.message || '';
        icon = options.icon || 'help';
        type = options.type || 'warning';
        confirmText = options.confirmText || 'Yes, Proceed';
        cancelText = options.cancelText || 'Cancel';
      }

      this.activeResolve = resolve;

      const backdrop = document.getElementById('app-dialog-backdrop');
      const card = document.getElementById('app-dialog-card');
      const titleEl = document.getElementById('app-dialog-title');
      const msgEl = document.getElementById('app-dialog-message');
      const iconEl = document.getElementById('app-dialog-icon');
      const confirmBtn = document.getElementById('app-dialog-btn-confirm');
      const cancelBtn = document.getElementById('app-dialog-btn-cancel');

      card.className = `app-dialog-card type-${type}`;
      titleEl.textContent = title;
      msgEl.textContent = message;
      iconEl.textContent = icon;
      confirmBtn.textContent = confirmText;
      confirmBtn.className = `app-dialog-btn ${type === 'danger' ? 'app-dialog-btn-danger' : 'app-dialog-btn-primary'}`;
      cancelBtn.textContent = cancelText;
      cancelBtn.style.display = 'inline-flex';

      backdrop.style.display = 'flex';
      backdrop.classList.add('active');
      confirmBtn.focus();
    });
  },

  /**
   * Close the active dialog
   */
  close(result) {
    const backdrop = document.getElementById('app-dialog-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.style.display = 'none';
    }
    if (this.activeResolve) {
      const res = this.activeResolve;
      this.activeResolve = null;
      res(result);
    }
  },

  /**
   * Show a modern toast card
   */
  toast(message, type = 'success', duration = 3500) {
    this.init();
    const container = document.getElementById('app-toast-container');
    if (!container) return;

    let text = message;
    let toastTitle = '';
    if (typeof message === 'object' && message !== null) {
      text = message.message || '';
      toastTitle = message.title || '';
      type = message.type || type;
      duration = message.duration || duration;
    }

    const iconMap = {
      success: 'check_circle',
      warning: 'warning',
      error: 'error',
      danger: 'error',
      info: 'info'
    };

    const icon = iconMap[type] || 'info';
    const toast = document.createElement('div');
    toast.className = `app-toast-card type-${type}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined app-toast-icon">${icon}</span>
      <div class="app-toast-content">
        ${toastTitle ? `<strong style="display:block;margin-bottom:2px;font-size:0.88rem;color:#ffffff;">${toastTitle}</strong>` : ''}
        <span>${text}</span>
      </div>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }
};

// Polyfill window.alert and window.confirm to guarantee NO browser popups appear
if (typeof window !== 'undefined') {
  window.AppDialog = AppDialog;
  window.showAppAlert = (msg, title, icon, options) => AppDialog.alert({ message: msg, title, icon, ...options });
  window.showAppConfirm = (msg, title, options) => AppDialog.confirm({ message: msg, title, ...options });
  window.showAppToast = (msg, type, duration) => AppDialog.toast(msg, type, duration);

  // Polyfill native window alert
  window.alert = function(msg) {
    return AppDialog.alert(msg);
  };
}
