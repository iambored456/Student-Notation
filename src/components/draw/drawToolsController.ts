// js/components/Draw/drawToolsController.js

import annotationService from '@services/annotationService.ts';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

type ToolName = 'arrow' | 'text' | 'marker' | 'highlighter' | 'lasso' | null;

interface ToolSettings {
  arrow: {
    lineStyle: string;
    strokeWeight: number;
    startArrowhead: string;
    endArrowhead: string;
    arrowheadSize: number;
  };
  text: {
    color: string;
    size: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    background: boolean;
    superscript: boolean;
    subscript: boolean;
  };
  marker: { color: string; size: number };
  highlighter: { color: string; size: number };
  lasso: Record<string, never>;
}

interface OptionsContainers {
  arrow: HTMLElement | null;
  text: HTMLElement | null;
  marker: HTMLElement | null;
  highlighter: HTMLElement | null;
  lasso: HTMLElement | null;
}

class DrawToolsController {
  private currentTool: ToolName = null;
  private toolButtons: NodeListOf<HTMLElement> = [] as any;
  private toolPanels: NodeListOf<HTMLElement> = [] as any;
  private lastSelectedNote: any = null;
  private optionsContainers: OptionsContainers = {
    arrow: null,
    text: null,
    marker: null,
    highlighter: null,
    lasso: null
  };

  private settings: ToolSettings = {
    arrow: {
      lineStyle: 'solid',
      strokeWeight: 4,
      startArrowhead: 'none',
      endArrowhead: 'filled-arrow',
      arrowheadSize: 12
    },
    text: {
      color: '#000000',
      size: 16,
      bold: false,
      italic: false,
      underline: false,
      background: false,
      superscript: false,
      subscript: false
    },
    marker: {
      color: '#4a90e2',
      size: 6
    },
    highlighter: {
      color: '#4a90e2',
      size: 10
    },
    lasso: {}
  };

  initialize() {
    this.toolButtons = document.querySelectorAll('.draw-tool-button');
    this.toolPanels = document.querySelectorAll('.draw-tool-panel');

    this.optionsContainers = {
      arrow: document.getElementById('arrow-tool-options'),
      text: document.getElementById('text-tool-options'),
      marker: document.getElementById('marker-tool-options'),
      highlighter: document.getElementById('highlighter-tool-options'),
      lasso: document.getElementById('lasso-tool-options')
    };

    if (!this.toolButtons.length || !this.optionsContainers.arrow) {
      logger.warn('DrawToolsController', 'Could not find draw tool elements', null, 'draw');
      return;
    }

    this.attachEventListeners();
    this.setupChordTabListeners();
    this.setupMainTabListeners();
    this.populateAllPanels();
    this.initializePanelWidthSync();
    this.logPanelMetrics();

    window.addEventListener('resize', () => this.logPanelMetrics(), { passive: true });

    store.on('noteChanged', ({ newNote }: { newNote: any }) => {
      this.lastSelectedNote = newNote;
      if (this.currentTool) {
        this.deselectAllTools();
      }
    });
  }

  private attachEventListeners() {
    this.toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tool = (button).dataset['drawTool'] as ToolName;
        this.selectTool(tool);
      });
    });
  }

  private setupMainTabListeners() {
    const mainTabButtons = document.querySelectorAll('.tab-button');
    mainTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = (button as HTMLElement).dataset['tab'];
        if (targetTab !== 'pitch' && this.currentTool) {
          this.deselectAllTools();
          this.restoreLastSelectedNote();
        }
      });
    });
  }

  private setupChordTabListeners() {
    const pitchTabButtons = document.querySelectorAll('.pitch-tab-button');
    pitchTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = (button as HTMLElement).dataset['pitchTab'];
        if (targetTab !== 'draw' && this.currentTool) {
          this.deselectAllTools();
          this.restoreLastSelectedNote();
        }
      });
    });
  }

  private restoreLastSelectedNote() {
    if (this.lastSelectedNote) {
      store.setSelectedNote(this.lastSelectedNote.shape, this.lastSelectedNote.color);
      store.setSelectedTool('note');
    } else if (store.state.selectedNote) {
      store.setSelectedNote(store.state.selectedNote.shape, store.state.selectedNote.color);
      store.setSelectedTool('note');
    }
  }

  private deselectAllTools() {
    this.toolButtons.forEach(btn => btn.classList.remove('active'));
    this.toolPanels.forEach(panel => panel.classList.remove('active'));
    this.currentTool = null;
    annotationService.setTool(null, null);
    if (store.state.selectedTool === 'draw') {
      store.setSelectedTool('note');
    }
  }

  private selectTool(toolName: ToolName) {
    this.toolButtons.forEach(btn => btn.classList.remove('active'));
    this.toolPanels.forEach(panel => panel.classList.remove('active'));

    const selectedButton = Array.from(this.toolButtons).find(
      btn => (btn).dataset['drawTool'] === toolName
    );
    if (selectedButton) {
      selectedButton.classList.add('active');
      const parentPanel = selectedButton.closest('.draw-tool-panel');
      parentPanel?.classList.add('active');
    }

    this.currentTool = toolName;
    annotationService.setTool(toolName, this.settings);
    store.setSelectedTool('draw');
    // Reset selected note safely for drawing mode
    store.state.selectedNote = { shape: 'circle', color: store.state.selectedNote?.color || '#4a90e2' };
  }

  private populateAllPanels() {
    this.populateArrowOptions();
    this.populateTextOptions();
    this.populateMarkerOptions();
    this.populateHighlighterOptions();
  }

  private initializePanelWidthSync() {
    const panels = Array.from(this.toolPanels);
    if (!panels.length) {return;}

    // Allow panels to shrink to their own content instead of syncing widths
    panels.forEach(panel => {
      (panel).style.minWidth = '';
      (panel).style.width = 'fit-content';
      (panel).style.maxWidth = '100%';
      (panel).style.flex = '0 0 auto';
    });
  }

  private logPanelMetrics() {
    try {
      const grid = document.querySelector<HTMLElement>('.draw-layout-grid');
      const panels = Array.from(this.toolPanels ?? []);
      panels.forEach(panel => {
        // Measure panels during resize to keep layout diagnostics accurate
        panel.getBoundingClientRect();
      });
      grid?.getBoundingClientRect();
    } catch {
      // Failed to log panel metrics
    }
  }

  private populateArrowOptions() {
    const container = this.optionsContainers.arrow;
    if (!container) {return;}
    const startHeadTrigger = container.querySelector<HTMLButtonElement>('#arrow-start-head-trigger');
    const endHeadTrigger = container.querySelector<HTMLButtonElement>('#arrow-end-head-trigger');

    const getArrowheadIcon = (side: 'start' | 'end', type: string): string => {
      if (type !== 'filled-arrow') {
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="12" x2="20" y2="12"/>
          </svg>
        `;
      }
      if (side === 'start') {
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,5 3,12 9,19"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
        `;
      }
      return `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,5 21,12 15,19"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
        </svg>
      `;
    };

    const renderHeadIcon = (trigger: HTMLButtonElement | null, side: 'start' | 'end', type: string) => {
      if (!trigger) {return;}
      trigger.innerHTML = getArrowheadIcon(side, type);
    };
    const strokeInput = container.querySelector('#arrow-stroke-weight');
    if (strokeInput) {
      strokeInput.value = `${this.settings.arrow.strokeWeight}`;
      strokeInput.addEventListener('input', () => {
        this.settings.arrow.strokeWeight = parseInt(strokeInput.value, 10);
        annotationService.setTool('arrow', this.settings);
      });
    }

    const headSizeInput = container.querySelector('#arrow-head-size');
    if (headSizeInput) {
      headSizeInput.value = `${this.settings.arrow.arrowheadSize}`;
      headSizeInput.addEventListener('input', () => {
        this.settings.arrow.arrowheadSize = parseInt(headSizeInput.value, 10);
        annotationService.setTool('arrow', this.settings);
      });
    }

    const lineStyleButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-line-style]'));
    if (lineStyleButtons.length) {
      const setActive = (style: string) => {
        lineStyleButtons.forEach(btn => btn.classList.toggle('active', btn.dataset['lineStyle'] === style));
      };
      setActive(this.settings.arrow.lineStyle);
      lineStyleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const style = btn.dataset['lineStyle'];
          if (!style) {return;}
          this.settings.arrow.lineStyle = style;
          setActive(style);
          annotationService.setTool('arrow', this.settings);
        });
      });
    }

    const startButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-arrow-start]'));
    if (startButtons.length) {
      const setActiveStart = (val: string) => {
        startButtons.forEach(btn => btn.classList.toggle('active', btn.dataset['arrowStart'] === val));
        renderHeadIcon(startHeadTrigger, 'start', val);
      };
      setActiveStart(this.settings.arrow.startArrowhead);
      startButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset['arrowStart'];
          if (!val) {return;}
          this.settings.arrow.startArrowhead = val;
          setActiveStart(val);
          annotationService.setTool('arrow', this.settings);
        });
      });
    }

    const endButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-arrow-end]'));
    if (endButtons.length) {
      const setActiveEnd = (val: string) => {
        endButtons.forEach(btn => btn.classList.toggle('active', btn.dataset['arrowEnd'] === val));
        renderHeadIcon(endHeadTrigger, 'end', val);
      };
      setActiveEnd(this.settings.arrow.endArrowhead);
      endButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset['arrowEnd'];
          if (!val) {return;}
          this.settings.arrow.endArrowhead = val;
          setActiveEnd(val);
          annotationService.setTool('arrow', this.settings);
        });
      });
    }

    const swapButton = container.querySelector<HTMLButtonElement>('#arrow-swap-heads');
    if (swapButton) {
      swapButton.addEventListener('click', () => {
        const prevStart = this.settings.arrow.startArrowhead;
        this.settings.arrow.startArrowhead = this.settings.arrow.endArrowhead;
        this.settings.arrow.endArrowhead = prevStart;
        if (startButtons.length) {
          const val = this.settings.arrow.startArrowhead;
          startButtons.forEach(btn => btn.classList.toggle('active', btn.dataset['arrowStart'] === val));
          renderHeadIcon(startHeadTrigger, 'start', val);
        }
        if (endButtons.length) {
          const val = this.settings.arrow.endArrowhead;
          endButtons.forEach(btn => btn.classList.toggle('active', btn.dataset['arrowEnd'] === val));
          renderHeadIcon(endHeadTrigger, 'end', val);
        }
        annotationService.setTool('arrow', this.settings);
      });
    }
  }

  private populateTextOptions() {
    const container = this.optionsContainers.text;
    if (!container) {return;}
    const sizeInput = container.querySelector('#text-size-input');
    if (sizeInput) {
      sizeInput.value = `${this.settings.text.size}`;
      sizeInput.addEventListener('input', () => {
        this.settings.text.size = parseInt(sizeInput.value, 10);
        annotationService.setTool('text', this.settings);
      });
    }

    const colorButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.draw-color-button'));
    if (colorButtons.length) {
      const setActiveColor = (color: string) => {
        colorButtons.forEach(btn => {
          const btnColor = btn.dataset['color'] || '';
          btn.classList.toggle('active', btnColor.toLowerCase() === color.toLowerCase());
        });
      };
      setActiveColor(this.settings.text.color);
      colorButtons.forEach(button => {
        button.addEventListener('click', () => {
          const color = button.dataset['color'];
          if (!color) {return;}
          this.settings.text.color = color;
          setActiveColor(color);
          annotationService.setTool('text', this.settings);
        });
      });
    }

    const styleButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-text-style]'));
    if (styleButtons.length) {
      const booleanStyles: Array<keyof typeof this.settings.text> = [
        'bold',
        'italic',
        'underline',
        'background',
        'superscript',
        'subscript'
      ];

      const toggleStyle = (style: keyof typeof this.settings.text) => {
        if (!booleanStyles.includes(style)) {return;}
        this.settings.text[style] = !this.settings.text[style];
        annotationService.setTool('text', this.settings);
      };

      // Set initial active state
      styleButtons.forEach(btn => {
        const style = (btn.dataset['textStyle'] || '') as keyof typeof this.settings.text;
        if (booleanStyles.includes(style)) {
          btn.classList.toggle('active', Boolean(this.settings.text[style]));
        }
      });

      styleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const style = (btn.dataset['textStyle'] || '') as keyof typeof this.settings.text;
          if (!booleanStyles.includes(style)) {return;}
          toggleStyle(style);
          btn.classList.toggle('active', Boolean(this.settings.text[style]));
        });
      });
    }
  }

  private populateMarkerOptions() {
    const container = this.optionsContainers.marker;
    if (!container) {return;}
    const sizeInput = container.querySelector('#marker-size-input');
    if (sizeInput) {
      sizeInput.value = `${this.settings.marker.size}`;
      sizeInput.addEventListener('input', () => {
        this.settings.marker.size = parseInt(sizeInput.value, 10);
        annotationService.setTool('marker', this.settings);
      });
    }

    const colorButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.draw-color-button'));
    if (colorButtons.length) {
      // Set initial selection
      const setActiveColor = (color: string) => {
        colorButtons.forEach(btn => {
          const btnColor = btn.dataset['color'] || '';
          btn.classList.toggle('active', btnColor.toLowerCase() === color.toLowerCase());
        });
      };
      setActiveColor(this.settings.marker.color);

      colorButtons.forEach(button => {
        button.addEventListener('click', () => {
          const color = button.dataset['color'];
          if (!color) {return;}
          this.settings.marker.color = color;
          setActiveColor(color);
          annotationService.setTool('marker', this.settings);
        });
      });
    }
  }

  private populateHighlighterOptions() {
    const container = this.optionsContainers.highlighter;
    if (!container) {return;}
    const sizeInput = container.querySelector('#highlighter-size-input');
    if (sizeInput) {
      sizeInput.value = `${this.settings.highlighter.size}`;
      sizeInput.addEventListener('input', () => {
        this.settings.highlighter.size = parseInt(sizeInput.value, 10);
        annotationService.setTool('highlighter', this.settings);
      });
    }

    const colorButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.draw-color-button'));
    if (colorButtons.length) {
      const setActiveColor = (color: string) => {
        colorButtons.forEach(btn => {
          const btnColor = btn.dataset['color'] || '';
          btn.classList.toggle('active', btnColor.toLowerCase() === color.toLowerCase());
        });
      };
      setActiveColor(this.settings.highlighter.color);

      colorButtons.forEach(button => {
        button.addEventListener('click', () => {
          const color = button.dataset['color'];
          if (!color) {return;}
          this.settings.highlighter.color = color;
          setActiveColor(color);
          annotationService.setTool('highlighter', this.settings);
        });
      });
    }
  }
}

const drawToolsController = new DrawToolsController();
export default drawToolsController;
