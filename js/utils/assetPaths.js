// js/utils/assetPaths.js

/**
 * Get the correct asset path for the current environment
 * Development: /assets/ (Vite serves public files at root)
 * Production (GitHub Pages): /Student-Notation/assets/
 */
export function getAssetPath(relativePath) {
    // Check if we're in development (Vite dev server)
    const isDevelopment = import.meta.env.DEV;
    
    if (isDevelopment) {
        return `/assets/${relativePath}`;
    } else {
        return `/Student-Notation/assets/${relativePath}`;
    }
}

/**
 * Get icon path
 */
export function getIconPath(iconName) {
    return getAssetPath(`icons/${iconName}`);
}

/**
 * Get tabicon path
 */
export function getTabIconPath(iconName) {
    return getAssetPath(`tabicons/${iconName}`);
}