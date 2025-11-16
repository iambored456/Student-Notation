// js/components/UI/notificationSystem.js

class NotificationSystem {
  constructor() {
    this.overlay = document.getElementById('notification-overlay');
    this.modal = this.overlay?.querySelector('.notification-modal');
    this.title = this.overlay?.querySelector('.notification-title');
    this.message = this.overlay?.querySelector('.notification-message');
    this.actionsContainer = this.overlay?.querySelector('.notification-actions');
    this.closeButton = this.overlay?.querySelector('.notification-close');

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.overlay) {return;}

    // Close on X button
    this.closeButton?.addEventListener('click', () => this.hide());

    // Close on overlay click (outside modal)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay?.classList.contains('visible')) {
        this.hide();
      }
    });
  }

  show(options = {}) {
    if (!this.overlay) {return;}

    const {
      title = 'Notice',
      message = '',
      buttons = [{ text: 'OK', primary: true, action: () => this.hide() }]
    } = options;

    // Set title
    if (this.title) {
      this.title.textContent = title;
    }

    // Set message
    if (this.message) {
      this.message.textContent = message;
    }

    // Create buttons
    if (this.actionsContainer) {
      this.actionsContainer.innerHTML = '';
      buttons.forEach(button => {
        const btn = document.createElement('button');
        btn.className = `notification-button ${button.primary ? '' : 'secondary'}`;
        btn.textContent = button.text;
        btn.addEventListener('click', () => {
          if (button.action) {
            button.action();
          } else {
            this.hide();
          }
        });
        this.actionsContainer.appendChild(btn);
      });
    }

    // Show overlay
    this.overlay.classList.add('visible');

    // Focus first button for keyboard accessibility
    setTimeout(() => {
      const firstButton = this.actionsContainer?.querySelector('.notification-button');
      firstButton?.focus();
    }, 100);
  }

  hide() {
    if (!this.overlay) {return;}

    this.overlay.classList.remove('visible');
  }

  // Convenience methods
  alert(message, title = 'Notice') {
    this.show({
      title,
      message,
      buttons: [{ text: 'OK', primary: true, action: () => this.hide() }]
    });
  }

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      this.show({
        title,
        message,
        buttons: [
          { text: 'Cancel', primary: false, action: () => { this.hide(); resolve(false); } },
          { text: 'OK', primary: true, action: () => { this.hide(); resolve(true); } }
        ]
      });
    });
  }
}

// Create global instance
const notificationSystem = new NotificationSystem();

export default notificationSystem;
