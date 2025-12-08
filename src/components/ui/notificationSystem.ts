// js/components/UI/notificationSystem.js

interface NotificationButton {
  text: string;
  primary?: boolean;
  action?: () => void;
}

interface NotificationOptions {
  title?: string;
  message?: string;
  buttons?: NotificationButton[];
}

class NotificationSystem {
  private overlay: HTMLElement | null;
  private modal: HTMLElement | null;
  private title: HTMLElement | null;
  private message: HTMLElement | null;
  private actionsContainer: HTMLElement | null;
  private closeButton: HTMLElement | null;

  constructor() {
    this.overlay = document.getElementById('notification-overlay');
    this.modal = this.overlay?.querySelector('.notification-modal') as HTMLElement | null;
    this.title = this.overlay?.querySelector('.notification-title') as HTMLElement | null;
    this.message = this.overlay?.querySelector('.notification-message') as HTMLElement | null;
    this.actionsContainer = this.overlay?.querySelector('.notification-actions') as HTMLElement | null;
    this.closeButton = this.overlay?.querySelector('.notification-close') as HTMLElement | null;

    this.setupEventListeners();
  }

  setupEventListeners(): void {
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

  show(options: NotificationOptions = {}): void {
    const overlay = this.overlay;
    if (!overlay) {return;}

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
    const actions = this.actionsContainer;
    if (actions) {
      actions.innerHTML = '';
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
        actions.appendChild(btn);
      });
    }

    // Show overlay
    overlay.classList.add('visible');

    // Focus first button for keyboard accessibility
    setTimeout(() => {
      const firstButton = this.actionsContainer?.querySelector('.notification-button') as HTMLElement | null;
      firstButton?.focus();
    }, 100);
  }

  hide(): void {
    if (!this.overlay) {return;}

    this.overlay.classList.remove('visible');
  }

  // Convenience methods
  alert(message: string, title = 'Notice'): void {
    this.show({
      title,
      message,
      buttons: [{ text: 'OK', primary: true, action: () => this.hide() }]
    });
  }

  confirm(message: string, title = 'Confirm'): Promise<boolean> {
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
