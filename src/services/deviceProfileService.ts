import store from '@state/index.ts';
import logger from '@utils/logger.ts';

const MOBILE_UA_REGEX = /(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini)/i;
const DEFAULT_BREAKPOINT = 900;

type Orientation = 'portrait' | 'landscape';

export interface DeviceProfile {
  isMobile: boolean;
  isTouch: boolean;
  isCoarsePointer: boolean;
  orientation: Orientation;
  width: number;
  height: number;
}

let initialized = false;
const cleanupFns: (() => void)[] = [];
let mobileWidthBreakpoint = DEFAULT_BREAKPOINT;
let rafScheduled = false;

const defaultProfile: DeviceProfile = Object.freeze({
  isMobile: false,
  isTouch: false,
  isCoarsePointer: false,
  orientation: 'landscape',
  width: 0,
  height: 0
});

function safeWindow(): (typeof window) | null {
  return typeof window !== 'undefined' ? window : null;
}

function computeDeviceProfile(): DeviceProfile {
  const win = safeWindow();
  if (!win) {
    return { ...defaultProfile };
  }

  const { innerWidth = 0, innerHeight = 0 } = win;
  const orientationQuery = win.matchMedia ? win.matchMedia('(orientation: portrait)') : null;
  const orientation: Orientation = orientationQuery
    ? (orientationQuery.matches ? 'portrait' : 'landscape')
    : (innerHeight >= innerWidth ? 'portrait' : 'landscape');
  const coarsePointer = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
  const hoverNone = !!(win.matchMedia && win.matchMedia('(hover: none)').matches);
  const navigatorObj = typeof navigator !== 'undefined' ? navigator : null;
  const touchPoints = navigatorObj?.maxTouchPoints ?? (navigatorObj as any)?.msMaxTouchPoints ?? 0;
  const hasTouch = 'ontouchstart' in win || touchPoints > 0;
  const mobileUA = navigatorObj?.userAgent ? MOBILE_UA_REGEX.test(navigatorObj.userAgent) : false;
  const narrowViewport = innerWidth > 0 ? innerWidth <= mobileWidthBreakpoint : false;

  const isMobile = Boolean(
    mobileUA ||
    (hasTouch && (coarsePointer || hoverNone || narrowViewport))
  );

  return {
    isMobile,
    isTouch: hasTouch,
    isCoarsePointer: coarsePointer,
    orientation,
    width: innerWidth,
    height: innerHeight
  };
}

function applyCssFlags(profile: DeviceProfile): void {
  if (typeof document === 'undefined') {
    return;
  }
  const targets = [document.documentElement, document.body].filter(Boolean);
  targets.forEach(target => {
    target.classList.toggle('is-mobile', !!profile.isMobile);
    target.classList.toggle('is-touch', !!profile.isTouch);
    target.classList.toggle('orientation-portrait', profile.orientation === 'portrait');
    target.classList.toggle('orientation-landscape', profile.orientation === 'landscape');
  });
}

function scheduleProfileUpdate(): void {
  if (rafScheduled) {
    return;
  }
  const win = safeWindow();
  if (!win) {
    return;
  }

  rafScheduled = true;
  win.requestAnimationFrame(() => {
    rafScheduled = false;
    const profile = computeDeviceProfile();
    store.setDeviceProfile(profile);
    applyCssFlags(profile);
  });
}

function addMediaQueryListener(mediaQueryList: MediaQueryList | null, handler: () => void): () => void {
  if (!mediaQueryList) {
    return () => {};
  }

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handler);
    return () => mediaQueryList.removeEventListener('change', handler);
  }

  if (typeof (mediaQueryList as any).addListener === 'function') {
    (mediaQueryList as any).addListener(handler);
    return () => (mediaQueryList as any).removeListener(handler);
  }

  return () => {};
}

export function initDeviceProfileService(options: { maxMobileWidth?: number } = {}): void {
  const win = safeWindow();
  if (!win || initialized) {
    return;
  }

  mobileWidthBreakpoint = options.maxMobileWidth ?? DEFAULT_BREAKPOINT;
  initialized = true;

  const resizeHandler = () => scheduleProfileUpdate();
  const orientationHandler = () => scheduleProfileUpdate();

  win.addEventListener('resize', resizeHandler);
  win.addEventListener('orientationchange', orientationHandler);

  cleanupFns.push(() => win.removeEventListener('resize', resizeHandler));
  cleanupFns.push(() => win.removeEventListener('orientationchange', orientationHandler));

  const mediaQueries = [
    win.matchMedia && win.matchMedia('(pointer: coarse)'),
    win.matchMedia && win.matchMedia('(hover: none)'),
    win.matchMedia && win.matchMedia(`(max-width: ${mobileWidthBreakpoint}px)`),
    win.matchMedia && win.matchMedia('(orientation: portrait)')
  ].filter(Boolean);

  mediaQueries.forEach(mq => {
    const removeListener = addMediaQueryListener(mq, scheduleProfileUpdate);
    cleanupFns.push(removeListener);
  });

  scheduleProfileUpdate();
  logger.debug('DeviceProfileService', `Initialized (breakpoint <= ${mobileWidthBreakpoint}px)`, null, 'ui');
}

export function isMobileSession(): boolean {
  return !!store.state.deviceProfile?.isMobile;
}

export function onDeviceProfileChange(callback: (profile: DeviceProfile) => void): () => void {
  if (typeof callback !== 'function') {
    return () => {};
  }
  store.on('deviceProfileChanged', callback);
  callback(store.state.deviceProfile || { ...defaultProfile });
  return () => {
    // Listener removal intentionally omitted; store.on does not expose an off() helper yet.
  };
}

export function getDeviceProfile(): DeviceProfile {
  return store.state.deviceProfile || { ...defaultProfile };
}
