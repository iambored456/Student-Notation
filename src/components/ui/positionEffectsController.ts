// js/components/ui/positionEffectsController.js

import Position from './positionStandalone.ts';
import store from '@state/index.ts';
import effectsController from '@components/audio/effects/effectsController.ts';
import logger from '@utils/logger.ts';

interface EffectConfig {
  containerId: string;
  xParam: string;
  yParam: string;
  xRange: { min: number; max: number; step: number };
  yRange: { min: number; max: number; step: number };
}

type PositionMap = Record<string, Position>;

interface ResizeObserverState { currentWidth: number; currentHeight: number }

logger.moduleLoaded('PositionEffectsController');

class PositionEffectsController {
  private positions: PositionMap = {};
  private resizeObservers: ResizeObserver[] = [];
  private effectConfigs: Record<string, EffectConfig>;
  private isDragging: Record<string, boolean> = {};

  constructor() {
    this.effectConfigs = {
      reverb: {
        containerId: 'reverb-position',
        xParam: 'decay',
        yParam: 'roomSize',
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 100, step: 1 }
      },
      delay: {
        containerId: 'delay-position',
        xParam: 'time',
        yParam: 'feedback',
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 95, step: 1 }
      },
      vibrato: {
        containerId: 'vibrato-position',
        xParam: 'speed',
        yParam: 'span',
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 100, step: 1 }
      },
      tremolo: {
        containerId: 'tremolo-position',
        xParam: 'speed',
        yParam: 'span',
        xRange: { min: 0, max: 100, step: 1 },
        yRange: { min: 0, max: 100, step: 1 }
      }
    };

    logger.info('PositionEffectsController', 'Initialized', null, 'ui');
  }

  init() {
    logger.initStart('Position Effects Controller');

    Object.entries(this.effectConfigs).forEach(([effectType, config]) => {
      this.createPositionComponent(effectType, config);
    });

    this.initializeColorTracking();


    logger.initSuccess('Position Effects Controller');
    return true;
  }

  private createPositionComponent(effectType: string, config: EffectConfig) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      logger.warn('PositionEffectsController', `Container not found for ${effectType}`, { containerId: config.containerId }, 'ui');
      return;
    }

    try {
      const [width, height] = this.getPositionComponentSize(container);
      const position = new Position(container, {
        size: [width, height],
        mode: 'relative', // flip Y so 0 is bottom and 100 is top
        x: config.xRange.min,
        minX: config.xRange.min,
        maxX: config.xRange.max,
        stepX: config.xRange.step,
        y: config.yRange.min,
        minY: config.yRange.min,
        maxY: config.yRange.max,
        stepY: config.yRange.step
      });

      this.positions[effectType] = position;
      this.observePositionResize(container, position, width, height);

      position.on('change', ({ x, y }) => {
        this.onPositionChange(effectType, config.xParam, x, config.yParam, y);
      });

      // Track pointer interactions for previews/animations
      const handlePointerDown = () => {
        this.isDragging[effectType] = true;
        this.onDialInteractionStart(effectType);
        effectsController.startHoldPreview(effectType);
      };
      const handlePointerUp = () => {
        if (this.isDragging[effectType]) {
          this.isDragging[effectType] = false;
          this.onDialInteractionEnd(effectType);
          effectsController.stopHoldPreview(effectType);
        }
      };

      container.addEventListener('pointerdown', handlePointerDown);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
        container.addEventListener(evt, handlePointerUp);
      });

      this.loadInitialValues(effectType, config, position);
      logger.debug('PositionEffectsController', `Created Position component for ${effectType}`, null, 'ui');
    } catch (error) {
      logger.error('PositionEffectsController', `Failed to create Position component for ${effectType}`, error, 'ui');
    }
  }

  private getPositionComponentSize(container: HTMLElement): [number, number] {
    const fallback = 120;
    const rect = container.getBoundingClientRect();
    let width = rect?.width || container.clientWidth || container.offsetWidth || fallback;
    let height = rect?.height || container.clientHeight || container.offsetHeight || width;
    if (!width || width < 10) {width = fallback;}
    if (!height || height < 10) {height = width;}
    return [Math.round(width), Math.round(height)];
  }

  private observePositionResize(container: HTMLElement, position: Position, initialWidth: number, initialHeight: number) {
    if (typeof ResizeObserver === 'undefined') {return;}

    const observerState: ResizeObserverState = {
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

  private onPositionChange(effectType: string, xParam: string, xValue: number, yParam: string, yValue: number) {
    // Call instance method directly to preserve `this` binding inside effectsController
    effectsController.updateEffect(effectType, { [xParam]: xValue, [yParam]: yValue });
  }

  private onDialInteractionStart(effectType: string) {
    const color = effectsController.getActiveColor();
    logger.debug('PositionEffectsController', `Interaction start for ${effectType}`, null, 'ui');
    store.emit('effectDialInteractionStart', { effectType, color });
  }

  private onDialInteractionEnd(effectType: string) {
    const color = effectsController.getActiveColor();
    logger.debug('PositionEffectsController', `Interaction end for ${effectType}`, null, 'ui');
    store.emit('effectDialInteractionEnd', { effectType, color });
  }

  private loadInitialValues(effectType: string, config: EffectConfig, position: Position) {
    // Preserve `this` binding; effectsController reads its own selected color
    const state = effectsController.getEffectState(effectType) || {};
    const xVal = typeof state[config.xParam] === 'number' ? state[config.xParam] : config.xRange.min;
    const yVal = typeof state[config.yParam] === 'number' ? state[config.yParam] : config.yRange.min;
    position.x = xVal;
    position.y = yVal;
  }

  private initializeColorTracking() {
    store.on('noteChanged', ({ newNote }: { newNote: { color?: string } }) => {
      if (newNote.color) {
        this.applyColorPalette(newNote.color);
      }
    });
    if (store.state.selectedNote?.color) {
      this.applyColorPalette(store.state.selectedNote.color);
    }
  }

  private applyColorPalette(color: string) {
    const palette = store.state.colorPalette[color] || { primary: color, light: color };
    // Derive an extra-light tint if none provided
    const lighten = (hex: string, amount: number) => {
      const clamp = (v: number) => Math.max(0, Math.min(255, v));
      const n = hex.replace('#', '');
      const r = clamp(parseInt(n.slice(0, 2), 16) + amount);
      const g = clamp(parseInt(n.slice(2, 4), 16) + amount);
      const b = clamp(parseInt(n.slice(4, 6), 16) + amount);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    const basePrimary = palette.primary;
    const lightest = palette.light || lighten(basePrimary, 80);

    Object.values(this.positions).forEach(pos => {
      pos.setColors({
        accent: palette.primary,
        // Use timbre-tinted background while keeping neutral grid lines
        fill: lightest,
        stroke: '#c3c9d0',
        grid: '#d7dce4',
        text: '#3c4048'
      });
    });
  }
}

const positionEffectsController = new PositionEffectsController();
export default positionEffectsController;
