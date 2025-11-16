// js/utils/assetPaths.js

const resolveBaseUrl = () => {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

const assetBaseUrl = `${resolveBaseUrl()}assets/`;

/**
 * Build a path to an entry inside /public/assets that respects Vite's base.
 */
export function getAssetPath(relativePath = '') {
  const sanitized = relativePath.replace(/^\/+/, '');
  return `${assetBaseUrl}${sanitized}`;
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
