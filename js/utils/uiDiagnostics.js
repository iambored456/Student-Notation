// js/utils/uiDiagnostics.js

const DEFAULT_TRACKED_ELEMENTS = [
  { label: 'Toolbar', selector: '#toolbar' },
  { label: 'Toolbar Primary', selector: '#toolbar-primary' },
  { label: 'Primary Actions Grid', selector: '#toolbar-primary .primary-toolbar-actions' },
  { label: 'Primary Playback Row', selector: '#toolbar-primary .primary-toolbar-playback' },
  { label: 'Toolbar Secondary', selector: '#toolbar-secondary' },
  { label: 'Toolbar Preset Controls', selector: '#toolbar-secondary .preset-effects-controls' },
  { label: 'Toolbar Tab Sidebar', selector: '#toolbar-secondary .tab-sidebar' },
  { label: 'Sidebar', selector: '#sidebar' },
  { label: 'Timbre Tab Panel', selector: '#timbre-panel' },
  { label: 'Pitch Tab Panel', selector: '#pitch-panel' },
  { label: 'Rhythm Tab Panel', selector: '#rhythm-panel' },
  { label: 'Macrobeat Tools', selector: '#canvas-macrobeat-tools, #macrobeat-tools' },
  { label: 'Waveform Card', selector: '#timbre-panel .waveform-content-box' },
  { label: 'Preset Card', selector: '#timbre-panel .preset-content-box' },
  { label: 'Echo Card', selector: '#timbre-panel #reverb-delay-panel .effects-content-box, #timbre-panel #echo-panel .effects-content-box' },
  { label: 'Shake Card', selector: '#timbre-panel #vibrato-tremolo-panel .effects-content-box, #timbre-panel #shake-panel .effects-content-box' },
  { label: 'Envelope Card', selector: '#adsr-envelope' },
  { label: 'Harmonics Card', selector: '.harmonic-bins-container' },
  { label: 'Canvas Container', selector: '#canvas-container' },
  { label: 'Pitch Grid Wrapper', selector: '#pitch-grid-wrapper' },
  { label: 'Pitch Grid Container', selector: '#pitch-grid-container' },
  { label: 'Drum Grid Wrapper', selector: '#drum-grid-wrapper' },
  { label: 'Drum Grid', selector: '#drum-grid' }
];

const observedElements = new Map();
let resizeObserver;
let mutationObserver;
let scheduledLogFrame = null;
let scheduledReason = '';
let autoLogEnabled = false;

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : value;
}

function gatherNodeInfo(node) {
  const rect = node.getBoundingClientRect();
  const computed = window.getComputedStyle(node);
  return {
    tag: node.tagName.toLowerCase(),
    id: node.id || null,
    class: node.className || null,
    top: formatNumber(rect.top),
    left: formatNumber(rect.left),
    width: formatNumber(rect.width),
    height: formatNumber(rect.height),
    offsetWidth: node.offsetWidth,
    offsetHeight: node.offsetHeight,
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
    display: computed.display,
    position: computed.position,
    overflowX: computed.overflowX,
    overflowY: computed.overflowY,
    transform: computed.transform !== 'none' ? computed.transform : undefined
  };
}

function logTrackedElements(reason = 'manual') {
  const tracked = window.__uiDiagnosticsTrackedElements;
  if (!tracked) {
    return [];
  }

  if (!autoLogEnabled && reason !== 'manual') {
    return [];
  }

  attachObservers();

  const snapshot = [];

  console.groupCollapsed(`[UI Diagnostics] ${reason}`);
  tracked.forEach(entry => {
    const nodes = Array.from(document.querySelectorAll(entry.selector));
    if (!nodes.length) {
      console.warn(`${entry.label}: selector "${entry.selector}" not found`);
      return;
    }
    nodes.forEach((node, index) => {
      const label = nodes.length > 1 ? `${entry.label} [${index}]` : entry.label;
      const info = gatherNodeInfo(node);
      console.log(label, info);
      snapshot.push({ label, selector: entry.selector, info });
    });
  });
  console.groupEnd();

  window.__uiDiagnosticsLastSnapshot = snapshot;
  return snapshot;
}

function scheduleLog(reason) {
  if (!autoLogEnabled) {
    return;
  }
  scheduledReason = scheduledReason ? `${scheduledReason}; ${reason}` : reason;
  if (scheduledLogFrame !== null) {
    return;
  }
  scheduledLogFrame = requestAnimationFrame(() => {
    const reasonToLog = scheduledReason || 'auto';
    scheduledLogFrame = null;
    scheduledReason = '';
    logTrackedElements(reasonToLog);
  });
}

function attachObservers() {
  const tracked = window.__uiDiagnosticsTrackedElements;
  if (!tracked || !resizeObserver) {
    return;
  }

  tracked.forEach(entry => {
    const nodes = document.querySelectorAll(entry.selector);
    nodes.forEach(node => {
      if (observedElements.has(node)) {
        return;
      }
      observedElements.set(node, entry.label);
      resizeObserver.observe(node);
      node.addEventListener('scroll', () => scheduleLog(`${entry.label} scroll`), { passive: true });
    });
  });
}

export function initUIDiagnostics(options = {}) {
  if (window.__uiDiagnosticsInitialized) {
    return;
  }
  window.__uiDiagnosticsInitialized = true;

  const { elements, autoLog = false } = options;
  autoLogEnabled = Boolean(autoLog);
  window.__uiDiagnosticsAutoLog = autoLogEnabled;

  const trackedElements = elements || DEFAULT_TRACKED_ELEMENTS;
  window.__uiDiagnosticsTrackedElements = trackedElements;

  resizeObserver = new ResizeObserver(entries => {
    const labels = entries
      .map(entry => observedElements.get(entry.target) || entry.target.id || entry.target.tagName.toLowerCase())
      .filter(Boolean);
    if (labels.length) {
      scheduleLog(`Resize: ${labels.join(', ')}`);
    }
  });

  mutationObserver = new MutationObserver(() => attachObservers());
  if (document.body) {
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        attachObservers();
        scheduleLog('init');
      },
      { once: true }
    );
  }

  window.addEventListener('resize', () => scheduleLog('window resize'));
  attachObservers();
  scheduleLog('init');

  window.logUIState = (reason = 'manual') => logTrackedElements(reason);
  window.enableUIDiagnosticsAutoLog = () => {
    autoLogEnabled = true;
    window.__uiDiagnosticsAutoLog = true;
    scheduleLog('auto-log enabled');
  };
  window.disableUIDiagnosticsAutoLog = () => {
    autoLogEnabled = false;
    window.__uiDiagnosticsAutoLog = false;
  };
}

