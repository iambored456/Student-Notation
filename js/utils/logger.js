/**
 * Standardized Logging Utility for Student Notation
 * Provides consistent logging patterns across the application
 */

class Logger {
    constructor() {
        this.logLevel = 'DEBUG'; // DEBUG, INFO, WARN, ERROR
        this.enabledLevels = {
            DEBUG: true,
            INFO: true,
            WARN: true,
            ERROR: true
        };
    }

    /**
     * Set the minimum log level
     * @param {string} level - Minimum level to log (DEBUG, INFO, WARN, ERROR)
     */
    setLevel(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const minIndex = levels.indexOf(level);
        if (minIndex === -1) return;

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
     */
    moduleLoaded(componentName) {
        if (!this.enabledLevels.INFO) return;
        console.log(`${componentName}: Module loaded.`);
    }

    /**
     * Log initialization start
     * @param {string} componentName - Name of the component
     */
    initStart(componentName) {
        if (!this.enabledLevels.INFO) return;
        console.log(`Main.js: Initializing ${componentName}...`);
    }

    /**
     * Log successful initialization
     * @param {string} componentName - Name of the component
     */
    initSuccess(componentName) {
        if (!this.enabledLevels.INFO) return;
        console.log(`Main.js: ${componentName} initialized successfully.`);
    }

    /**
     * Log failed initialization
     * @param {string} componentName - Name of the component
     * @param {string} [reason] - Optional failure reason
     */
    initFailed(componentName, reason = '') {
        if (!this.enabledLevels.WARN) return;
        const message = reason ? ` (${reason})` : '';
        console.warn(`Main.js: ${componentName} failed to initialize${message}.`);
    }

    /**
     * Log application section separators
     * @param {string} title - Section title
     */
    section(title) {
        if (!this.enabledLevels.INFO) return;
        console.log('========================================');
        console.log(title);
        console.log('========================================');
    }

    /**
     * Log events and user actions
     * @param {string} component - Component name
     * @param {string} event - Event description
     * @param {string} [details] - Optional event details
     */
    event(component, event, details = '') {
        if (!this.enabledLevels.INFO) return;
        const formattedComponent = this.formatComponent(component);
        const message = details ? `${event}. ${details}` : event;
        console.log(`${formattedComponent} ${message}`);
    }

    /**
     * Log state changes
     * @param {string} component - Component name
     * @param {string} description - State change description
     * @param {Object} [data] - Optional state data
     */
    state(component, description, data = null) {
        if (!this.enabledLevels.INFO) return;
        const formattedComponent = this.formatComponent(component);
        if (data) {
            const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
            console.log(`${formattedComponent} ${description}: ${dataStr}`);
        } else {
            console.log(`${formattedComponent} ${description}`);
        }
    }

    /**
     * Log debug information
     * @param {string} component - Component name
     * @param {string} action - Action being performed
     * @param {Object|string} [data] - Optional debug data
     */
    debug(component, action, data = null) {
        if (!this.enabledLevels.DEBUG) return;
        const formattedComponent = this.formatComponent(component);
        if (data) {
            const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
            console.log(`${formattedComponent} ${action}: ${dataStr}`);
        } else {
            console.log(`${formattedComponent} ${action}`);
        }
    }

    /**
     * Log performance timing information
     * @param {string} component - Component name
     * @param {string} operation - Operation being timed
     * @param {Object} metrics - Timing metrics
     */
    timing(component, operation, metrics) {
        if (!this.enabledLevels.DEBUG) return;
        const formattedComponent = this.formatComponent(component);
        const metricsStr = Object.entries(metrics)
            .map(([key, value]) => {
                if (typeof value === 'number' && value % 1 !== 0) {
                    return `${key}=${value.toFixed(3)}`;
                }
                return `${key}=${value}`;
            })
            .join(', ');
        console.log(`${formattedComponent} ${operation}: ${metricsStr}`);
    }

    /**
     * Log warnings
     * @param {string} component - Component name
     * @param {string} message - Warning message
     * @param {any} [data] - Optional warning data
     */
    warn(component, message, data = null) {
        if (!this.enabledLevels.WARN) return;
        const formattedComponent = this.formatComponent(component);
        if (data) {
            console.warn(`${formattedComponent} ${message}`, data);
        } else {
            console.warn(`${formattedComponent} ${message}`);
        }
    }

    /**
     * Log errors
     * @param {string} component - Component name
     * @param {string} message - Error message
     * @param {Error|any} [error] - Optional error object or data
     */
    error(component, message, error = null) {
        if (!this.enabledLevels.ERROR) return;
        const formattedComponent = this.formatComponent(component);
        if (error) {
            console.error(`${formattedComponent} ${message}`, error);
        } else {
            console.error(`${formattedComponent} ${message}`);
        }
    }

    /**
     * Log info messages
     * @param {string} component - Component name  
     * @param {string} message - Info message
     * @param {any} [data] - Optional info data
     */
    info(component, message, data = null) {
        if (!this.enabledLevels.INFO) return;
        const formattedComponent = this.formatComponent(component);
        if (data) {
            console.log(`${formattedComponent} ${message}`, data);
        } else {
            console.log(`${formattedComponent} ${message}`);
        }
    }

    /**
     * Get logging statistics
     * @returns {Object} Current logging configuration
     */
    getConfig() {
        return {
            logLevel: this.logLevel,
            enabledLevels: { ...this.enabledLevels }
        };
    }
}

// Create singleton instance
const logger = new Logger();

export default logger;