/**
 * Centralized logging system for Student Notation.
 *
 * USAGE:
 * - All logging is OFF by default in production
 * - Enable specific categories or levels for debugging
 * - Use logger.enable('categoryName') to turn on specific logging
 * - Use logger.setLevel('DEBUG') to enable all debug logs
 */
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

type CategoryMap = Record<string, boolean>;

class Logger {
  private logLevel: LogLevel;
  private enabledLevels: Record<LogLevel, boolean>;
  private categories: CategoryMap;

  constructor() {
    // Default everything to OFF for production
    this.logLevel = 'ERROR';
    this.enabledLevels = {
      DEBUG: false,
      INFO: false,
      WARN: false,
      ERROR: true  // Keep errors always on
    };

    // Category-based logging - all OFF by default
    this.categories = {
      general: false,        // General application flow
      state: false,          // State management
      canvas: false,         // Canvas rendering
      audio: false,          // Audio/synthesis
      ui: false,             // UI interactions
      layout: false,         // Layout calculations
      harmony: false,        // Harmony analysis
      performance: false,    // Performance metrics
      initialization: false, // App startup
      transport: false,      // Audio transport
      grid: false,          // Grid interactions
      toolbar: false,       // Toolbar actions
      zoom: false,          // Zoom operations
      scroll: false,        // Scrolling
      keyboard: false,      // Keyboard events
      mouse: false,         // Mouse events
      adsr: false,          // ADSR envelope
      filter: false,        // Audio filtering
      waveform: false,      // Waveform drawing
      debug: false          // General debug info
    };
  }

  /**
     * Enable logging for specific categories
     */
  enable(...categoryNames: string[]): void {
    categoryNames.forEach(name => {
      if (Object.prototype.hasOwnProperty.call(this.categories, name)) {
        this.categories[name] = true;
      }
    });
  }

  /**
     * Disable logging for specific categories
     */
  disable(...categoryNames: string[]): void {
    categoryNames.forEach(name => {
      if (Object.prototype.hasOwnProperty.call(this.categories, name)) {
        this.categories[name] = false;
      }
    });
  }

  /**
     * Enable all logging categories (for debugging)
     */
  enableAll(): void {
    Object.keys(this.categories).forEach(key => {
      this.categories[key] = true;
    });
    this.setLevel('DEBUG');
  }

  /**
     * Disable all logging categories
     */
  disableAll(): void {
    Object.keys(this.categories).forEach(key => {
      this.categories[key] = false;
    });
    this.setLevel('ERROR');
  }

  /**
     * Check if a category is enabled
     */
  isCategoryEnabled(category: string): boolean {
    return this.categories[category] === true;
  }

  /**
     * Set the minimum log level
     */
  setLevel(level: LogLevel): void {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const minIndex = levels.indexOf(level);
    if (minIndex === -1) {return;}

    this.logLevel = level;
    this.enabledLevels = {
      DEBUG: minIndex <= 0,
      INFO: minIndex <= 1,
      WARN: minIndex <= 2,
      ERROR: minIndex <= 3
    };
  }

  logWithConsole(method: 'debug' | 'info' | 'warn' | 'error', component: string, message: string, data: unknown = null): void {
    if (typeof console !== 'undefined' && console[method]) {
      const payload = data !== null ? [component, message, data] : [component, message];
      console[method](...payload);
    }
  }

  /**
     * Log events and user actions
     */
  event(_component: string, _event: string, _details = '', category = 'ui'): void {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log state changes
     */
  state(_component: string, _description: string, _data: any = null, category = 'state'): void {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log debug information
     */
  debug(component: string, action: string, data: any = null, category = 'debug'): void {
    if (!this.enabledLevels.DEBUG || !this.isCategoryEnabled(category)) {return;}
    this.logWithConsole('debug', component, action, data);
  }

  /**
     * Log performance timing information
     */
  timing(component: string, operation: string, metrics: any, category = 'performance'): void {
    if (!this.enabledLevels.DEBUG || !this.isCategoryEnabled(category)) {return;}
    this.logWithConsole('debug', component, operation, metrics);
  }

  /**
     * Log warnings
     */
  warn(component: string, message: string, data: any = null, category = 'general'): void {
    if (!this.enabledLevels.WARN || !this.isCategoryEnabled(category)) {return;}
    this.logWithConsole('warn', component, message, data);
  }

  /**
     * Log errors
     */
  error(component: string, message: string, error: any = null, _category = 'general'): void {
    if (!this.enabledLevels.ERROR) {return;}
    this.logWithConsole('error', component, message, error);
  }

  /**
     * Log info messages
     */
  info(component: string, message: string, data: any = null, category = 'general'): void {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    this.logWithConsole('info', component, message, data);
  }

  /**
     * Get logging statistics
     */
  getConfig(): { logLevel: LogLevel; enabledLevels: Record<LogLevel, boolean>; enabledCategories: string[] } {
    return {
      logLevel: this.logLevel,
      enabledLevels: { ...this.enabledLevels },
      enabledCategories: Object.entries(this.categories)
        .filter(([, value]) => value)
        .map(([key]) => key)
    };
  }

  /**
     * List all available categories
     */
  getAvailableCategories(): string[] {
    return Object.keys(this.categories);
  }

  /**
     * Grouped/section logging helper for init phases.
     */
  section(title: string): void {
    if (this.enabledLevels.INFO) {
      this.info('Logger', `===== ${title} =====`, null, 'general');
    }
  }

  /**
     * Initialization lifecycle helpers.
     */
  initStart(component: string): void {
    if (this.enabledLevels.INFO) {
      this.info(component, 'init start', null, 'initialization');
    }
  }

  initSuccess(component: string): void {
    if (this.enabledLevels.INFO) {
      this.info(component, 'init success', null, 'initialization');
    }
  }

  initFailed(component: string, reason?: string): void {
    if (this.enabledLevels.ERROR) {
      const message = reason ? `init failed: ${reason}` : 'init failed';
      this.error(component, message, null, 'initialization');
    }
  }

  /**
     * Mark a module as loaded (convenience helper).
     */
  moduleLoaded(moduleName: string, category = 'initialization'): void {
    // Do minimal work; respects existing category gating.
    if (this.isCategoryEnabled(category) && this.enabledLevels.INFO) {
      this.info(moduleName, 'loaded', null, category);
    }
  }

  /**
     * Convenience method for general logging
     */
  log(component: string, message: string, data: any = null): void {
    this.info(component, message, data, 'general');
  }
}

// Create singleton instance
const logger = new Logger();

// Make logger available globally for debugging
declare global {
  interface Window {
    logger?: Logger;
  }
}

if (typeof window !== 'undefined') {
  window.logger = logger;
}

export default logger;
