// js/components/ui/positionEffectsController.js

import Position from './positionStandalone.js';
import store from '@state/index.js';
import effectsController from '@components/audio/effects/effectsController.js';
import logger from '@utils/logger.js';

logger.moduleLoaded('PositionEffectsController');

/**
 * Position Effects Controller
 * Manages the 2D Position components for effects control
 * Integrates with existing effectsController for data synchronization
 */
class PositionEffectsController {
  constructor() {
    this.positions = {};
    this.currentColor = null;
    this.resizeObservers = [];

    // Effect configurations mapped to Position components
    this.effectConfigs = {
      reverb: {
        containerId: 'reverb-position',
        xParam: 'decay',    // Time (x-axis)
        yParam: 'roomSize', // Size (y-axis)
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 100, step: 1 }
      },
      delay: {
        containerId: 'delay-position',
        xParam: 'time',     // Time (x-axis)
        yParam: 'feedback', // Echoes (y-axis)
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 95, step: 1 }
      },
      vibrato: {
        containerId: 'vibrato-position',
        xParam: 'speed',    // Speed (x-axis)
        yParam: 'span',     // Span (y-axis)
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 100, step: 1 }
      },
      tremolo: {
        containerId: 'tremolo-position',
        xParam: 'speed',    // Speed (x-axis)
        yParam: 'span',     // Span (y-axis)
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 100, step: 1 }
      }
    };

    // Shape note color mappings
    this.colorMappings = {
      '#4a90e2': { // Blue
        bg: 'rgba(74, 144, 226, 0.1)',
        handle: '#4a90e2',
        grid: '#dee2e6',
        cross: '#6c757d',
        text: '#212529'
      },
      '#2d2d2d': { // Black
        bg: 'rgba(45, 45, 45, 0.1)',
        handle: '#2d2d2d',
        grid: '#dee2e6',
        cross: '#6c757d',
        text: '#212529'
      },
      '#d66573': { // Red
        bg: 'rgba(214, 101, 115, 0.1)',
        handle: '#d66573',
        grid: '#dee2e6',
        cross: '#6c757d',
        text: '#212529'
      },
      '#68a03f': { // Green
        bg: 'rgba(104, 160, 63, 0.1)',
        handle: '#68a03f',
        grid: '#dee2e6',
        cross: '#6c757d',
        text: '#212529'
      }
    };

    logger.info('PositionEffectsController', 'Initialized', null, 'ui');
  }

  /**
     * Initialize Position components
     */
  init() {
    logger.initStart('Position Effects Controller');

    // Create Position components for each effect
    Object.entries(this.effectConfigs).forEach(([effectType, config]) => {
      this.createPositionComponent(effectType, config);
    });

    // Set up color tracking
    this.initializeColorTracking();

    // Initial color application
    this.updateColorsForCurrentSelection();

    logger.initSuccess('Position Effects Controller');
    return true;
  }

  /**
     * Create a Position component for an effect
     */
  createPositionComponent(effectType, config) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      logger.warn('PositionEffectsController', `Container not found for ${effectType}`, { containerId: config.containerId }, 'ui');
      return;
    }

    try {
      const [width, height] = this.getPositionComponentSize(container);

      // Create Position component
      const position = new Position(container, {
        size: [width, height],
        mode: 'absolute',
        x: config.xRange.min,  // Start at 0 (bottom-left)
        minX: config.xRange.min,
        maxX: config.xRange.max,
        stepX: config.xRange.step,
        y: config.yRange.min,  // Start at 0 (bottom-left)
        minY: config.yRange.min,
        maxY: config.yRange.max,
        stepY: config.yRange.step
      });

      // Store reference
      this.positions[effectType] = position;
      this.observePositionResize(container, position, width, height);

      // Set up event listeners
      position.on('change', ({ x, y }) => {
        this.onPositionChange(effectType, config.xParam, x, config.yParam, y);
      });

      // Listen for interaction start/end (drag events) for visual effects
      position.on('down', () => {
        this.onDialInteractionStart(effectType);
      });

      position.on('up', () => {
        this.onDialInteractionEnd(effectType);
      });

      // Load initial values from effectsController
      this.loadInitialValues(effectType, config, position);

      logger.debug('PositionEffectsController', `Created Position component for ${effectType}`, null, 'ui');

    } catch (error) {
      logger.error('PositionEffectsController', `Failed to create Position component for ${effectType}`, error, 'ui');
    }
  }

  getPositionComponentSize(container) {
    const fallback = 120;
    const rect = container.getBoundingClientRect();
    let width = rect?.width || container.clientWidth || container.offsetWidth || fallback;
    let height = rect?.height || container.clientHeight || container.offsetHeight || width;

    if (!width || width < 10) {width = fallback;}
    if (!height || height < 10) {height = width;}

    return [Math.round(width), Math.round(height)];
  }

  observePositionResize(container, position, initialWidth, initialHeight) {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observerState = {
      currentWidth: Math.round(initialWidth) || 0,
      currentHeight: Math.round(initialHeight) || 0
    };
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const nextWidth = Math.round(width);
        const nextHeight = Math.round(height || width);

        if (!nextWidth || !nextHeight) {continue;}
        if (nextWidth === observerState.currentWidth && nextHeight === observerState.currentHeight) {continue;}

        observerState.currentWidth = nextWidth;
        observerState.currentHeight = nextHeight;
        position.resize(nextWidth, nextHeight);
      }
    });

    observer.observe(container);
    this.resizeObservers.push(observer);
  }

  /**
     * Load initial values from effectsController
     */
  loadInitialValues(effectType, config, position) {
    const currentColor = store.state.selectedNote?.color;

    // If no color selected yet, use default values (0,0)
    if (!currentColor) {
      const xDefault = config.xRange.min;  // Start at 0
      const yDefault = config.yRange.min;  // Start at 0
      position.x = xDefault;
      position.y = yDefault;
      logger.debug('PositionEffectsController', `Set default values for ${effectType} (no color selected)`, { x: xDefault, y: yDefault }, 'ui');
      return;
    }

    // Get current values from effectsController (this will get from effectsCoordinator)
    const effectParams = effectsController.getEffectParameters ?
      effectsController.getEffectParameters(effectType) : null;

    if (effectParams) {
      const xValue = effectParams[config.xParam] !== undefined ?
        effectParams[config.xParam] : config.xRange.min;  // Default to 0
      const yValue = effectParams[config.yParam] !== undefined ?
        effectParams[config.yParam] : config.yRange.min;  // Default to 0

      position.x = xValue;
      position.y = yValue;
      logger.debug('PositionEffectsController', `Loaded values for ${effectType} color ${currentColor}`, { x: xValue, y: yValue }, 'ui');
    } else {
      // Fallback to defaults if no effect parameters found (0,0)
      const xDefault = config.xRange.min;  // Start at 0
      const yDefault = config.yRange.min;  // Start at 0
      position.x = xDefault;
      position.y = yDefault;
      logger.debug('PositionEffectsController', `Set default values for ${effectType} (no effect params)`, { x: xDefault, y: yDefault }, 'ui');
    }
  }

  /**
     * Transform values to eliminate dead zones
     * Origin (0,0 to 1,1) remains as the "off" zone, everything else gets nudged to be non-zero
     */
  transformValue(value) {
    // If value is between 0 and 1 (inclusive), it's in the "dead zone" - keep as is
    if (value <= 1) {
      return value;
    }

    // For values > 1, map the range (1,100] to (1,100]
    // This effectively eliminates the dead zone while preserving the full range
    return value;
  }

  /**
     * Check if position is in the "off" zone (origin area)
     */
  isInOffZone(xValue, yValue) {
    return xValue <= 1 && yValue <= 1;
  }

  /**
     * Transform position values to eliminate dead zones on axes
     */
  transformPositionValues(xValue, yValue) {
    // If both values are in off zone (0-1), keep them as is (effect off)
    if (this.isInOffZone(xValue, yValue)) {
      return { x: xValue, y: yValue };
    }

    // Transform each axis: if value > 1, keep it; if value <= 1 but position not in off zone, nudge to 1
    const transformedX = (xValue <= 1) ? Math.max(1, xValue) : xValue;
    const transformedY = (yValue <= 1) ? Math.max(1, yValue) : yValue;

    return { x: transformedX, y: transformedY };
  }

  /**
     * Handle Position component changes
     */
  onPositionChange(effectType, xParam, xValue, yParam, yValue) {
    const currentColor = store.state.selectedNote?.color;
    if (!currentColor) {
      logger.warn('PositionEffectsController', 'No color selected for position change', { effectType, xParam, xValue, yParam, yValue }, 'ui');
      return;
    }

    // Transform values to eliminate dead zones
    const transformed = this.transformPositionValues(xValue, yValue);

    logger.debug('PositionEffectsController', `Position changed: ${effectType} ${xParam}=${xValue}->${transformed.x}, ${yParam}=${yValue}->${transformed.y}`, null, 'ui');

    // Update effectsController (which will route through effectsCoordinator)
    effectsController.onEffectParameterChange(effectType, xParam, transformed.x);
    effectsController.onEffectParameterChange(effectType, yParam, transformed.y);
  }

  /**
     * Initialize color change tracking
     */
  initializeColorTracking() {
    this.currentColor = store.state.selectedNote?.color;

    // Listen for color changes
    store.on('noteChanged', () => {
      const newColor = store.state.selectedNote?.color;
      if (newColor !== this.currentColor) {
        this.currentColor = newColor;
        this.updateColorsForCurrentSelection();
        this.updatePositionValuesForColor();
      }
    });

    // Listen for effect parameter changes to sync Position components
    store.on('effectParameterChanged', ({ effectType, parameter, value, color }) => {
      logger.debug('PositionEffectsController', `Effect parameter changed: ${effectType}.${parameter} = ${value} for ${color}`, null, 'ui');
      if (color === this.currentColor) {
        this.syncPositionFromEffects(effectType, parameter, value);
      }
    });

    // Also listen for audio effect changes (alternative event)
    store.on('audioEffectChanged', ({ effectType, parameter, value, color }) => {
      logger.debug('PositionEffectsController', `Audio effect changed: ${effectType}.${parameter} = ${value} for ${color}`, null, 'ui');
      if (color === this.currentColor) {
        this.syncPositionFromEffects(effectType, parameter, value);
      }
    });
  }

  /**
     * Update Position component colors based on current selection
     */
  updateColorsForCurrentSelection() {
    if (!this.currentColor || !this.colorMappings[this.currentColor]) {return;}

    const colorTheme = this.colorMappings[this.currentColor];

    Object.values(this.positions).forEach(position => {
      if (position && position.colorize) {
        position.colorize(colorTheme);
      }
    });

    logger.debug('PositionEffectsController', `Applied color theme for ${this.currentColor}`, colorTheme, 'ui');
  }

  /**
     * Update Position values when color changes
     */
  updatePositionValuesForColor() {
    if (!this.currentColor) {return;}

    Object.entries(this.effectConfigs).forEach(([effectType, config]) => {
      const position = this.positions[effectType];
      if (!position) {return;}

      // Get values for this color from effectsCoordinator
      const effectParams = effectsController.getEffectParameters ?
        effectsController.getEffectParameters(effectType) : null;

      if (effectParams) {
        const xValue = effectParams[config.xParam] !== undefined ? effectParams[config.xParam] :
          config.xRange.min;  // Default to 0
        const yValue = effectParams[config.yParam] !== undefined ? effectParams[config.yParam] :
          config.yRange.min;  // Default to 0

        // Update without triggering events (to avoid circular updates)
        position.x = xValue;
        position.y = yValue;
      }
    });
  }

  /**
     * Sync Position component from effects changes (from sliders, etc.)
     */
  syncPositionFromEffects(effectType, parameter, value) {
    const position = this.positions[effectType];
    const config = this.effectConfigs[effectType];

    if (!position || !config) {return;}

    // Update the appropriate axis
    if (parameter === config.xParam) {
      position.x = value;
    } else if (parameter === config.yParam) {
      position.y = value;
    }

    logger.debug('PositionEffectsController', `Synced ${effectType}.${parameter} = ${value} from effects`, null, 'ui');
  }

  /**
     * Get current position values for an effect
     */
  getPositionValues(effectType) {
    const position = this.positions[effectType];
    if (!position) {return null;}

    return {
      x: position.x,
      y: position.y,
      normalized: position.normalized
    };
  }

  /**
     * Debug method to test Position component functionality
     */
  testPositionComponents() {
    logger.info('PositionEffectsController', 'Testing Position components...', null, 'ui');

    // Test each position component
    Object.entries(this.positions).forEach(([effectType, position]) => {
      if (position) {
        logger.info('PositionEffectsController', `${effectType} Position component:`, {
          x: position.x,
          y: position.y,
          normalized: position.normalized
        }, 'ui');
      } else {
        logger.warn('PositionEffectsController', `${effectType} Position component not found`, null, 'ui');
      }
    });

    // Test color theming
    logger.info('PositionEffectsController', `Current color: ${this.currentColor}`, null, 'ui');

    // Test manual position change
    if (this.positions.vibrato) {
      logger.info('PositionEffectsController', 'Testing vibrato position change...', null, 'ui');
      this.positions.vibrato.x = 75;
      this.positions.vibrato.y = 50;
    }
  }

  /**
     * Debug method to test dead zone elimination
     */
  testDeadZoneElimination() {
    logger.info('PositionEffectsController', 'Testing dead zone elimination...', null, 'ui');

    // Test cases for dead zone behavior
    const testCases = [
      { x: 0, y: 0, description: 'Origin (should stay 0,0 - effect off)' },
      { x: 0.5, y: 0.5, description: 'Inside off zone (should stay 0.5,0.5 - effect off)' },
      { x: 1, y: 1, description: 'Edge of off zone (should stay 1,1 - effect off)' },
      { x: 0, y: 50, description: 'X in dead zone (should become 1,50 - effect on)' },
      { x: 50, y: 0, description: 'Y in dead zone (should become 50,1 - effect on)' },
      { x: 0.5, y: 75, description: 'X in dead zone (should become 1,75 - effect on)' },
      { x: 25, y: 0.8, description: 'Y in dead zone (should become 25,1 - effect on)' },
      { x: 50, y: 75, description: 'Both normal (should stay 50,75 - effect on)' }
    ];

    testCases.forEach(testCase => {
      const result = this.transformPositionValues(testCase.x, testCase.y);
      const inOffZone = this.isInOffZone(testCase.x, testCase.y);

      logger.info('PositionEffectsController', `Test: ${testCase.description}`, {
        input: { x: testCase.x, y: testCase.y },
        output: result,
        inOffZone: inOffZone
      }, 'ui');
    });
  }

  /**
     * Called when user starts dragging a position dial for vibrato/tremolo
     * Triggers visual effects on canvas notes and waveforms
     */
  onDialInteractionStart(effectType) {
    // Only trigger visual effects for vibrato and tremolo
    if (effectType !== 'vibrato' && effectType !== 'tremolo') {
      return;
    }

    const currentColor = store.state.selectedNote?.color;
    if (!currentColor) {
      return;
    }

    // Emit event to trigger visual effects during dial interaction
    store.emit('effectDialInteractionStart', {
      effectType,
      color: currentColor
    });

    logger.debug('PositionEffectsController', `Dial interaction started for ${effectType} on ${currentColor}`, null, 'ui');
  }

  /**
     * Called when user stops dragging a position dial
     * Stops visual effects preview
     */
  onDialInteractionEnd(effectType) {
    const currentColor = store.state.selectedNote?.color;
    if (!currentColor) {
      return;
    }

    // Emit event to stop visual effects preview
    store.emit('effectDialInteractionEnd', {
      effectType,
      color: currentColor
    });

    logger.debug('PositionEffectsController', `Dial interaction ended for ${effectType} on ${currentColor}`, null, 'ui');
  }

  /**
     * Cleanup
     */
  destroy() {
    Object.values(this.positions).forEach(position => {
      if (position && position.destroy) {
        position.destroy();
      }
    });
    this.positions = {};
    this.resizeObservers.forEach(observer => observer.disconnect());
    this.resizeObservers = [];
    logger.info('PositionEffectsController', 'Destroyed', null, 'ui');
  }
}

// Create and export singleton
const positionEffectsController = new PositionEffectsController();
export default positionEffectsController;
