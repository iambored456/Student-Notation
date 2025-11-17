
/**
 * Centralized logging system for Student Notation
 *
 * USAGE:
 * - All logging is OFF by default in production
 * - Enable specific categories or levels for debugging
 * - Use logger.enable('categoryName') to turn on specific logging
 * - Use logger.setLevel('DEBUG') to enable all debug logs
 *
 * CATEGORIES:
 * - general: Basic application flow
 * - state: State management and changes
 * - canvas: Canvas rendering and drawing
 * - audio: Audio synthesis and transport
 * - ui: User interface interactions
 * - layout: Layout calculations and sizing
 * - harmony: Harmony analysis and chord processing
 * - paint: Paint tool functionality
 * - performance: Performance timing and metrics
 */
class Logger {
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
      paint: false,          // Paint functionality
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
     * @param {...string} categoryNames - Category names to enable
     */
  enable(...categoryNames) {
    categoryNames.forEach(name => {
      if (Object.prototype.hasOwnProperty.call(this.categories, name)) {
        this.categories[name] = true;
      }
    });
  }

  /**
     * Disable logging for specific categories
     * @param {...string} categoryNames - Category names to disable
     */
  disable(...categoryNames) {
    categoryNames.forEach(name => {
      if (Object.prototype.hasOwnProperty.call(this.categories, name)) {
        this.categories[name] = false;
      }
    });
  }

  /**
     * Enable all logging categories (for debugging)
     */
  enableAll() {
    Object.keys(this.categories).forEach(key => {
      this.categories[key] = true;
    });
    this.setLevel('DEBUG');
  }

  /**
     * Disable all logging categories
     */
  disableAll() {
    Object.keys(this.categories).forEach(key => {
      this.categories[key] = false;
    });
    this.setLevel('ERROR');
  }

  /**
     * Check if a category is enabled
     * @param {string} category - Category name
     * @returns {boolean} Whether the category is enabled
     */
  isCategoryEnabled(category) {
    return this.categories[category] === true;
  }

  /**
     * Set the minimum log level
     * @param {string} level - Minimum level to log (DEBUG, INFO, WARN, ERROR)
     */
  setLevel(level) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const minIndex = levels.indexOf(level);
    if (minIndex === -1) {return;}

    this.enabledLevels = {
      DEBUG: minIndex <= 0,
      INFO: minIndex <= 1,
      WARN: minIndex <= 2,
      ERROR: minIndex <= 3
    };
  }

  /**
     * Format a component name with brackets
     * @param {string} component - Component name
     * @returns {string} Formatted component name
     */
  formatComponent(component) {
    return `[${component}]`;
  }

  /**
     * Log module loading
     * @param {string} componentName - Name of the component/module
     * @param {string} [category='general'] - Log category
     */
  moduleLoaded(_componentName, category = 'general') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log initialization start
     * @param {string} componentName - Name of the component
     * @param {string} [category='initialization'] - Log category
     */
  initStart(_componentName, category = 'initialization') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log successful initialization
     * @param {string} componentName - Name of the component
     * @param {string} [category='initialization'] - Log category
     */
  initSuccess(_componentName, category = 'initialization') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log failed initialization
     * @param {string} componentName - Name of the component
     * @param {string} [reason] - Optional failure reason
     * @param {string} [category='initialization'] - Log category
     */
  initFailed(_componentName, _reason = '', category = 'initialization') {
    if (!this.enabledLevels.WARN || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log application section separators
     * @param {string} title - Section title
     * @param {string} [category='general'] - Log category
     */
  section(_title, category = 'general') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log events and user actions
     * @param {string} component - Component name
     * @param {string} event - Event description
     * @param {string} [details] - Optional event details
     * @param {string} [category='ui'] - Log category
     */
  event(_component, _event, _details = '', category = 'ui') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log state changes
     * @param {string} component - Component name
     * @param {string} description - State change description
     * @param {Object} [data] - Optional state data
     * @param {string} [category='state'] - Log category
     */
  state(_component, _description, _data = null, category = 'state') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log debug information
     * @param {string} component - Component name
     * @param {string} action - Action being performed
     * @param {Object|string} [data] - Optional debug data
     * @param {string} [category='debug'] - Log category
     */
  debug(_component, _action, _data = null, category = 'debug') {
    if (!this.enabledLevels.DEBUG || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log performance timing information
     * @param {string} component - Component name
     * @param {string} operation - Operation being timed
     * @param {Object} metrics - Timing metrics
     * @param {string} [category='performance'] - Log category
     */
  timing(_component, _operation, _metrics, category = 'performance') {
    if (!this.enabledLevels.DEBUG || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log warnings
     * @param {string} component - Component name
     * @param {string} message - Warning message
     * @param {any} [data] - Optional warning data
     * @param {string} [category='general'] - Log category
     */
  warn(_component, _message, _data = null, category = 'general') {
    if (!this.enabledLevels.WARN || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log errors
     * @param {string} component - Component name
     * @param {string} message - Error message
     * @param {Error|any} [error] - Optional error object or data
     * @param {string} [category='general'] - Log category (errors are always shown regardless)
     */
  error(_component, _message, _error = null, _category = 'general') {
    if (!this.enabledLevels.ERROR) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Log info messages
     * @param {string} component - Component name
     * @param {string} message - Info message
     * @param {any} [data] - Optional info data
     * @param {string} [category='general'] - Log category
     */
  info(_component, _message, _data = null, category = 'general') {
    if (!this.enabledLevels.INFO || !this.isCategoryEnabled(category)) {return;}
    // No-op in production - logging disabled by default
  }

  /**
     * Get logging statistics
     * @returns {Object} Current logging configuration
     */
  getConfig() {
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
     * @returns {string[]} Array of category names
     */
  getAvailableCategories() {
    return Object.keys(this.categories);
  }

  /**
     * Convenience method for general logging
     * @param {string} component - Component name
     * @param {string} message - Log message
     * @param {any} [data] - Optional data
     */
  log(component, message, data = null) {
    this.info(component, message, data, 'general');
  }
}

// Create singleton instance
const logger = new Logger();

// Make logger available globally for debugging
if (typeof window !== 'undefined') {
  window.logger = logger;
}

export default logger;
