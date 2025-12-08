const resolveBaseUrl = (): string => {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

const assetBaseUrl = `${resolveBaseUrl()}assets/`;

/**
 * Build a path to an entry inside /public/assets that respects Vite's base.
 */
export function getAssetPath(relativePath = ''): string {
  const sanitized = relativePath.replace(/^\/+/, '');
  return `${assetBaseUrl}${sanitized}`;
}

/**
 * Get icon path.
 */
export function getIconPath(iconName: string): string {
  return getAssetPath(`icons/${iconName}`);
}

/**
 * Get tab icon path.
 */
export function getTabIconPath(iconName: string): string {
  return getAssetPath(`tabicons/${iconName}`);
}
