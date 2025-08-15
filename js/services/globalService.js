// js/services/globalService.js

/**
 * A simple singleton object to hold globally accessible component instances
 * to avoid complex dependency injection or event bus patterns for simple cases.
 */
const GlobalService = {
    adsrComponent: null
};

export default GlobalService;