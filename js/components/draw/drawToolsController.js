// js/components/Draw/drawToolsController.js

import annotationService from '@services/annotationService.js';
import store from '@state/index.js';
import logger from '@utils/logger.js';

/**
 * Controller for managing draw tools (arrow, text, marker, highlighter, lasso)
 */

class DrawToolsController {
  constructor() {
    this.currentTool = null;
    this.toolButtons = null;
    this.optionsContainer = null;
    this.lastSelectedNote = null; // Store last selected shape note

    // Tool settings
    this.settings = {
      arrow: {
        lineStyle: 'solid',
        strokeWeight: 4, // numeric (1-10 range)
        startArrowhead: 'none',
        endArrowhead: 'filled-arrow',
        arrowheadSize: 12 // numeric (8-24 range)
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
        size: 6 // numeric (1-15 range)
      },
      highlighter: {
        color: '#4a90e2',
        size: 10 // numeric (5-30 range)
      },
      lasso: {}
    };
  }

  /**
     * Initialize the draw tools controller
     */
  initialize() {
    this.toolButtons = document.querySelectorAll('.draw-tool-button');
    this.toolPanels = document.querySelectorAll('.draw-tool-panel');

    // Map tool names to their specific option containers
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

    // Populate all tool options panels on init
    this.populateAllPanels();

    // Set up width syncing for equal-width panels
    this.initializePanelWidthSync();

    // Store the last selected note when it changes
    store.on('noteChanged', ({ newNote }) => {
      this.lastSelectedNote = newNote;
      // Deselect draw tools when shape note is selected (only if a draw tool is currently active)
      if (this.currentTool) {
        this.deselectAllTools();
      }
    });

  }

  /**
     * Attach event listeners to tool buttons
     */
  attachEventListeners() {
    this.toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tool = button.dataset.drawTool;
        this.selectTool(tool);
      });
    });
  }

  /**
     * Set up listeners for main tab switching (Timbre, Pitch, Rhythm)
     */
  setupMainTabListeners() {
    const mainTabButtons = document.querySelectorAll('.tab-button');

    mainTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;

        // If switching away from Pitch tab (where Draw tools are), restore last selected shape note
        if (targetTab !== 'pitch' && this.currentTool) {
          this.deselectAllTools();
          this.restoreLastSelectedNote();
        }
      });
    });
  }

  /**
     * Set up listeners for pitch sub-tab switching
     */
  setupChordTabListeners() {
    const pitchTabButtons = document.querySelectorAll('.pitch-tab-button');

    pitchTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.pitchTab;

        // If switching away from Draw tab, restore last selected shape note
        if (targetTab !== 'draw' && this.currentTool) {
          this.deselectAllTools();
          this.restoreLastSelectedNote();
        }
      });
    });
  }

  /**
     * Restore the last selected shape note (if any)
     */
  restoreLastSelectedNote() {
    if (this.lastSelectedNote) {
      // Set the note and tool mode - this will trigger visual updates
      store.setSelectedNote(this.lastSelectedNote.shape, this.lastSelectedNote.color);
      store.setSelectedTool('note');
    } else if (store.state.selectedNote) {
      // Fallback to current selectedNote in state
      store.setSelectedNote(store.state.selectedNote.shape, store.state.selectedNote.color);
      store.setSelectedTool('note');
    }
  }

  /**
     * Deselect all draw tools
     */
  deselectAllTools() {
    this.toolButtons.forEach(btn => btn.classList.remove('active'));
    this.toolPanels.forEach(panel => panel.classList.remove('active'));
    this.currentTool = null;
    annotationService.setTool(null, null);
  }

  /**
     * Select a draw tool and show its options
     * @param {string} toolName - Name of the tool to select
     */
  selectTool(toolName) {
    // Deselect all buttons and panels
    this.toolButtons.forEach(btn => btn.classList.remove('active'));
    this.toolPanels.forEach(panel => panel.classList.remove('active'));

    // Select the clicked button and its parent panel
    const selectedButton = Array.from(this.toolButtons).find(
      btn => btn.dataset.drawTool === toolName
    );
    if (selectedButton) {
      selectedButton.classList.add('active');
      // Find and activate the parent panel
      const parentPanel = selectedButton.closest('.draw-tool-panel');
      if (parentPanel) {
        parentPanel.classList.add('active');
      }
    }

    this.currentTool = toolName;

    // Update annotation service with current tool and settings
    annotationService.setTool(toolName, this.settings);

    // Deselect shape notes when draw tool is selected
    store.state.selectedNote = null;
  }

  /**
     * Populate all tool panels with their options on initialization
     */
  populateAllPanels() {
    this.renderArrowOptions();
    this.renderTextOptions();
    this.renderMarkerOptions();
    this.renderHighlighterOptions();
    this.renderLassoOptions();
  }

  /**
     * Render arrow tool options
     */
  renderArrowOptions() {
    const container = this.optionsContainers.arrow;
    if (!container) {return;}

    // Create compact button bar with popup menus in three rows
    container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: var(--space-015);">
                <div class="draw-toolbar-row">
                    <button class="draw-toolbar-button" data-popup="stroke-weight" title="Stroke Weight">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${Math.min(this.settings.arrow.strokeWeight, 5)}">
                            <circle cx="12" cy="12" r="8"/>
                        </svg>
                    </button>
                    <button class="draw-toolbar-button" data-popup="line-style" title="Line Style">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="${this.getLineDashArray()}">
                            <line x1="4" y1="12" x2="20" y2="12"/>
                        </svg>
                    </button>
                </div>
                <div class="draw-toolbar-row">
                    <button class="draw-toolbar-button" data-popup="start-arrowhead" title="Start Arrowhead">
                        ${this.getArrowheadIcon(this.settings.arrow.startArrowhead, 'left')}
                    </button>
                    <button class="draw-toolbar-button" data-popup="end-arrowhead" title="End Arrowhead">
                        ${this.getArrowheadIcon(this.settings.arrow.endArrowhead, 'right')}
                    </button>
                </div>
                <div class="draw-toolbar-row">
                    <button class="draw-toolbar-button draw-swap-button" data-action="swap-endpoints" title="Swap endpoints">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="17,1 21,5 17,9"></polyline>
                            <path d="M3,11V9A4,4 0 0,1 7,5H21"></path>
                            <polyline points="7,23 3,19 7,15"></polyline>
                            <path d="M21,13v2a4,4 0 0,1 -4,4H3"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

    this.attachArrowToolbarListeners();
  }

  /**
     * Get SVG dash array for line style
     */
  getLineDashArray() {
    switch (this.settings.arrow.lineStyle) {
      case 'solid': return '0';
      case 'dashed-big': return '8,4';
      case 'dashed-small': return '4,2';
      case 'dotted': return '1,2';
      default: return '0';
    }
  }

  /**
     * Get arrowhead icon SVG
     */
  getArrowheadIcon(type, direction) {
    const isLeft = direction === 'left';
    switch (type) {
      case 'none':
        return `<svg width="20" height="20" viewBox="0 0 24 24"><line x1="${isLeft ? 20 : 4}" y1="12" x2="${isLeft ? 4 : 20}" y2="12" stroke="currentColor" stroke-width="2"/></svg>`;
      case 'unfilled-arrow':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="${isLeft ? 20 : 4}" y1="12" x2="${isLeft ? 4 : 20}" y2="12"/>
                    <polyline points="${isLeft ? '10,6 4,12 10,18' : '14,6 20,12 14,18'}"/>
                </svg>`;
      case 'filled-arrow':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <line x1="${isLeft ? 20 : 4}" y1="12" x2="${isLeft ? 8 : 16}" y2="12"/>
                    <polygon points="${isLeft ? '4,12 10,6 10,18' : '20,12 14,6 14,18'}"/>
                </svg>`;
      case 'circle':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="${isLeft ? 20 : 4}" y1="12" x2="${isLeft ? 8 : 16}" y2="12"/>
                    <circle cx="${isLeft ? 4 : 20}" cy="12" r="3"/>
                </svg>`;
      default:
        return '';
    }
  }

  /**
     * Attach event listeners to arrow toolbar buttons
     */
  attachArrowToolbarListeners() {
    const container = this.optionsContainers.arrow;
    if (!container) {return;}

    const buttons = container.querySelectorAll('[data-popup]');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // Activate arrow tool when interacting with settings
        this.selectTool('arrow');
        const popupType = button.dataset.popup;
        this.showPopupMenu(popupType, button);
      });
    });

    // Swap button
    const swapButton = container.querySelector('[data-action="swap-endpoints"]');
    if (swapButton) {
      swapButton.addEventListener('click', () => {
        const temp = this.settings.arrow.startArrowhead;
        this.settings.arrow.startArrowhead = this.settings.arrow.endArrowhead;
        this.settings.arrow.endArrowhead = temp;
        this.renderArrowOptions();

        // Update annotation service
        annotationService.setTool(this.currentTool, this.settings);

        // Apply changes to selected annotation if any
        annotationService.applyCurrentSettingsToSelected();

      });
    }
  }

  /**
     * Show popup menu for tool options
     */
  showPopupMenu(type, triggerButton) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.draw-popup-menu');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup menu
    const popup = document.createElement('div');
    popup.className = 'draw-popup-menu';

    let content = '';
    switch (type) {
      case 'stroke-weight': {
        const currentStroke = this.settings.arrow.strokeWeight;
        const small = 2;
        const medium = 4;
        const large = 7;

        content = `
                    <div style="padding: 8px; min-width: 180px;">
                        <input type="range"
                            class="draw-stroke-slider"
                            min="1"
                            max="10"
                            value="${currentStroke}"
                            style="width: 100%; margin-bottom: 8px;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button class="draw-popup-option ${currentStroke === small ? 'active' : ''}" data-value="${small}">
                                <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                            </button>
                            <button class="draw-popup-option ${currentStroke === medium ? 'active' : ''}" data-value="${medium}">
                                <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="4"/></svg>
                            </button>
                            <button class="draw-popup-option ${currentStroke === large ? 'active' : ''}" data-value="${large}">
                                <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="6"/></svg>
                            </button>
                        </div>
                    </div>
                `;
        break;
      }
      case 'line-style':
        content = `
                    <button class="draw-popup-option ${this.settings.arrow.lineStyle === 'solid' ? 'active' : ''}" data-value="solid">
                        <svg width="30" height="20" viewBox="0 0 30 20"><line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                    <button class="draw-popup-option ${this.settings.arrow.lineStyle === 'dashed-big' ? 'active' : ''}" data-value="dashed-big">
                        <svg width="30" height="20" viewBox="0 0 30 20"><line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2" stroke-dasharray="6,3"/></svg>
                    </button>
                    <button class="draw-popup-option ${this.settings.arrow.lineStyle === 'dashed-small' ? 'active' : ''}" data-value="dashed-small">
                        <svg width="30" height="20" viewBox="0 0 30 20"><line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2" stroke-dasharray="3,2"/></svg>
                    </button>
                    <button class="draw-popup-option ${this.settings.arrow.lineStyle === 'dotted' ? 'active' : ''}" data-value="dotted">
                        <svg width="30" height="20" viewBox="0 0 30 20"><line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2" stroke-dasharray="1,2"/></svg>
                    </button>
                `;
        break;
      case 'start-arrowhead':
      case 'end-arrowhead': {
        const isStart = type === 'start-arrowhead';
        const currentValue = isStart ? this.settings.arrow.startArrowhead : this.settings.arrow.endArrowhead;
        const currentArrowSize = this.settings.arrow.arrowheadSize;

        content = `
                    <div style="padding: 8px; min-width: 180px;">
                        <div style="margin-bottom: 8px; font-size: 0.85em; color: var(--c-text);">
                            Arrowhead Size
                        </div>
                        <input type="range"
                            class="draw-arrowhead-size-slider"
                            min="8"
                            max="24"
                            value="${currentArrowSize}"
                            style="width: 100%; margin-bottom: 12px;">
                        <div style="margin-bottom: 6px; font-size: 0.85em; color: var(--c-text);">
                            Arrowhead Style
                        </div>
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button class="draw-popup-option ${currentValue === 'none' ? 'active' : ''}" data-value="none">
                                <svg width="30" height="20" viewBox="0 0 30 20"><line x1="5" y1="10" x2="25" y2="10" stroke="currentColor" stroke-width="2"/></svg>
                            </button>
                            <button class="draw-popup-option ${currentValue === 'unfilled-arrow' ? 'active' : ''}" data-value="unfilled-arrow">
                                <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="${isStart ? 25 : 5}" y1="10" x2="${isStart ? 10 : 20}" y2="10"/>
                                    <polyline points="${isStart ? '10,5 5,10 10,15' : '20,5 25,10 20,15'}"/>
                                </svg>
                            </button>
                            <button class="draw-popup-option ${currentValue === 'filled-arrow' ? 'active' : ''}" data-value="filled-arrow">
                                <svg width="30" height="20" viewBox="0 0 30 20" fill="currentColor" stroke="currentColor" stroke-width="2">
                                    <line x1="${isStart ? 25 : 5}" y1="10" x2="${isStart ? 12 : 18}" y2="10"/>
                                    <polygon points="${isStart ? '5,10 12,5 12,15' : '25,10 18,5 18,15'}"/>
                                </svg>
                            </button>
                            <button class="draw-popup-option ${currentValue === 'circle' ? 'active' : ''}" data-value="circle">
                                <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="${isStart ? 25 : 5}" y1="10" x2="${isStart ? 10 : 20}" y2="10"/>
                                    <circle cx="${isStart ? 5 : 25}" cy="10" r="4"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
        break;
      }
    }

    popup.innerHTML = content;

    // Position popup below trigger button
    document.body.appendChild(popup);
    const rect = triggerButton.getBoundingClientRect();
    popup.style.position = 'absolute';
    popup.style.top = `${rect.bottom + 5}px`;
    popup.style.left = `${rect.left}px`;

    // Attach slider listener (for stroke weight)
    const strokeSlider = popup.querySelector('.draw-stroke-slider');
    if (strokeSlider) {
      strokeSlider.addEventListener('input', (e) => {
        const value = Number(e.target.value);
        this.settings.arrow.strokeWeight = value;
        this.renderArrowOptions();
        annotationService.setTool(this.currentTool, this.settings);
        annotationService.applyCurrentSettingsToSelected();
      });
    }

    // Attach slider listener (for arrowhead size)
    const arrowheadSizeSlider = popup.querySelector('.draw-arrowhead-size-slider');
    if (arrowheadSizeSlider) {
      arrowheadSizeSlider.addEventListener('input', (e) => {
        const value = Number(e.target.value);
        this.settings.arrow.arrowheadSize = value;
        annotationService.setTool(this.currentTool, this.settings);
        annotationService.applyCurrentSettingsToSelected();
      });
    }

    // Attach option listeners
    popup.querySelectorAll('.draw-popup-option').forEach(option => {
      option.addEventListener('click', () => {
        const value = option.dataset.value;

        // Update setting
        if (type === 'stroke-weight') {
          this.settings.arrow.strokeWeight = Number(value);
          // Update slider if it exists
          if (strokeSlider) {
            strokeSlider.value = value;
          }
        } else if (type === 'line-style') {
          this.settings.arrow.lineStyle = value;
        } else if (type === 'start-arrowhead') {
          this.settings.arrow.startArrowhead = value;
        } else if (type === 'end-arrowhead') {
          this.settings.arrow.endArrowhead = value;
        }

        // Re-render to update toolbar button icons
        this.renderArrowOptions();
        popup.remove();

        // Update annotation service
        annotationService.setTool(this.currentTool, this.settings);

        // Apply changes to selected annotation if any
        annotationService.applyCurrentSettingsToSelected();

      });
    });

    // Close popup when clicking outside
    setTimeout(() => {
      const closePopup = (e) => {
        if (!popup.contains(e.target) && !triggerButton.contains(e.target)) {
          popup.remove();
          document.removeEventListener('click', closePopup);
        }
      };
      document.addEventListener('click', closePopup);
    }, 0);
  }

  /**
     * Render text tool options
     */
  renderTextOptions() {
    const container = this.optionsContainers.text;
    if (!container) {return;}

    container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: var(--space-015);">
                <div class="draw-toolbar-row">
                    <button class="draw-toolbar-button" data-popup="text-color" title="Text Color">
                        <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${this.settings.text.color}; border: 2px solid var(--c-border);"></div>
                    </button>
                    <button class="draw-toolbar-button ${this.settings.text.background ? 'active' : ''}" data-action="toggle-background" title="Background Fill">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${this.settings.text.background ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <rect x="4" y="4" width="16" height="16" rx="2"/>
                        </svg>
                    </button>
                </div>
                <div class="draw-toolbar-row">
                    <button class="draw-toolbar-button" data-action="decrease-size" title="Decrease Font Size">
                        <span style="font-weight: bold; font-size: 1.2em;">−</span>
                    </button>
                    <div style="min-width: 35px; text-align: center; font-size: 0.85em; color: var(--c-text);">
                        ${this.settings.text.size}px
                    </div>
                    <button class="draw-toolbar-button" data-action="increase-size" title="Increase Font Size">
                        <span style="font-weight: bold; font-size: 1.2em;">+</span>
                    </button>
                </div>
                <div class="draw-toolbar-row">
                    <button class="draw-toolbar-button ${this.settings.text.superscript ? 'active' : ''}" data-action="toggle-superscript" title="Superscript">
                        <span style="font-size: 0.85em;">x<sup style="font-size: 0.7em;">2</sup></span>
                    </button>
                    <button class="draw-toolbar-button ${this.settings.text.subscript ? 'active' : ''}" data-action="toggle-subscript" title="Subscript">
                        <span style="font-size: 0.85em;">x<sub style="font-size: 0.7em;">2</sub></span>
                    </button>
                </div>
            </div>
        `;

    this.attachTextToolbarListeners();
  }

  /**
     * Render marker tool options
     */
  renderMarkerOptions() {
    const container = this.optionsContainers.marker;
    if (!container) {return;}

    container.innerHTML = `
            <div class="draw-toolbar-row">
                <button class="draw-toolbar-button" data-popup="marker-color" title="Marker Color">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${this.settings.marker.color}; border: 2px solid var(--c-border);"></div>
                </button>
                <button class="draw-toolbar-button" data-popup="marker-size" title="Marker Size">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${this.settings.marker.size === 'small' ? '1' : this.settings.marker.size === 'medium' ? '3' : '5'}">
                        <circle cx="12" cy="12" r="8"/>
                    </svg>
                </button>
            </div>
        `;

    this.attachCommonToolbarListeners('marker');
  }

  /**
     * Render highlighter tool options
     */
  renderHighlighterOptions() {
    const container = this.optionsContainers.highlighter;
    if (!container) {return;}

    // Helper to convert hex to rgba
    const hexToRgba = (hex, opacity) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    container.innerHTML = `
            <div class="draw-toolbar-row">
                <button class="draw-toolbar-button" data-popup="highlighter-color" title="Highlighter Color">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${hexToRgba(this.settings.highlighter.color, 0.4)}; border: 2px solid var(--c-border);"></div>
                </button>
                <button class="draw-toolbar-button" data-popup="highlighter-size" title="Highlighter Size">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${this.settings.highlighter.size === 'small' ? '2' : this.settings.highlighter.size === 'medium' ? '4' : '6'}">
                        <rect x="6" y="8" width="12" height="8" rx="1"/>
                    </svg>
                </button>
            </div>
        `;

    this.attachCommonToolbarListeners('highlighter');
  }

  /**
     * Render lasso tool options
     */
  renderLassoOptions() {
    const container = this.optionsContainers.lasso;
    if (!container) {return;}

    container.innerHTML = `
            <div style="padding: var(--space-015); text-align: center; max-width: 120px;">
                <p style="color: var(--c-text-muted); font-size: 0.7em; margin: 0; line-height: 1.3; word-wrap: break-word;">
                    Draw around notes to select and drag them as a group.
                </p>
            </div>
        `;
  }

  /**
     * Attach common toolbar listeners for marker, highlighter tools
     * @param {string} toolName - Name of the tool ('marker' or 'highlighter')
     */
  attachCommonToolbarListeners(toolName) {
    const container = this.optionsContainers[toolName];
    if (!container) {return;}

    const buttons = container.querySelectorAll('[data-popup]');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // Activate tool when interacting with settings
        this.selectTool(toolName);
        const popupType = button.dataset.popup;
        this.showCommonPopupMenu(popupType, button);
      });
    });
  }

  /**
     * Attach toolbar listeners for text tool
     */
  attachTextToolbarListeners() {
    const container = this.optionsContainers.text;
    if (!container) {return;}

    // Color popup button
    const colorButton = container.querySelector('[data-popup="text-color"]');
    if (colorButton) {
      colorButton.addEventListener('click', () => {
        this.selectTool('text');
        this.showCommonPopupMenu('text-color', colorButton);
      });
    }

    // Decrease font size button
    const decreaseButton = container.querySelector('[data-action="decrease-size"]');
    if (decreaseButton) {
      decreaseButton.addEventListener('click', () => {
        this.selectTool('text');
        const newSize = Math.max(8, this.settings.text.size - 2);
        if (newSize !== this.settings.text.size) {
          this.settings.text.size = newSize;
          this.renderTextOptions();
          annotationService.setTool(this.currentTool, this.settings);
          annotationService.applyCurrentSettingsToSelected();
        }
      });
    }

    // Increase font size button
    const increaseButton = container.querySelector('[data-action="increase-size"]');
    if (increaseButton) {
      increaseButton.addEventListener('click', () => {
        this.selectTool('text');
        const newSize = Math.min(72, this.settings.text.size + 2);
        if (newSize !== this.settings.text.size) {
          this.settings.text.size = newSize;
          this.renderTextOptions();
          annotationService.setTool(this.currentTool, this.settings);
          annotationService.applyCurrentSettingsToSelected();
        }
      });
    }

    // Toggle background button
    const bgButton = container.querySelector('[data-action="toggle-background"]');
    if (bgButton) {
      bgButton.addEventListener('click', () => {
        this.selectTool('text');
        this.settings.text.background = !this.settings.text.background;
        this.renderTextOptions();
        annotationService.setTool(this.currentTool, this.settings);
        annotationService.applyCurrentSettingsToSelected();
      });
    }

    // Toggle superscript button
    const superscriptButton = container.querySelector('[data-action="toggle-superscript"]');
    if (superscriptButton) {
      // Prevent blur on mousedown to keep text input focused
      superscriptButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      superscriptButton.addEventListener('click', () => {
        this.selectTool('text');
        annotationService.applyInlineFormatting('superscript');
      });
    }

    // Toggle subscript button
    const subscriptButton = container.querySelector('[data-action="toggle-subscript"]');
    if (subscriptButton) {
      // Prevent blur on mousedown to keep text input focused
      subscriptButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      subscriptButton.addEventListener('click', () => {
        this.selectTool('text');
        annotationService.applyInlineFormatting('subscript');
      });
    }
  }

  /**
     * Show popup menu for text, marker, highlighter tools
     */
  showCommonPopupMenu(type, triggerButton) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.draw-popup-menu');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup menu
    const popup = document.createElement('div');
    popup.className = 'draw-popup-menu';

    let content = '';
    let toolType = '';
    let setting = '';

    // Determine tool type and setting
    if (type.startsWith('text-')) {
      toolType = 'text';
      setting = type.replace('text-', '');
    } else if (type.startsWith('marker-')) {
      toolType = 'marker';
      setting = type.replace('marker-', '');
    } else if (type.startsWith('highlighter-')) {
      toolType = 'highlighter';
      setting = type.replace('highlighter-', '');
    }

    // Build popup content
    if (setting === 'color') {
      const colors = toolType === 'text'
        ? ['#4a90e2', '#2d2d2d', '#d66573', '#68a03f']
        : ['#4a90e2', '#2d2d2d', '#d66573', '#68a03f', '#ffc107'];

      const isHighlighter = toolType === 'highlighter';
      content = colors.map(color => {
        const displayColor = isHighlighter ? this.hexToRgba(color, 0.4) : color;
        const isActive = this.settings[toolType].color === color;
        return `
                    <button class="draw-popup-option ${isActive ? 'active' : ''}" data-value="${color}">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${displayColor};"></div>
                    </button>
                `;
      }).join('');
    } else if (setting === 'size') {
      if (toolType === 'text') {
        content = `
                    <button class="draw-popup-option ${this.settings.text.size === 12 ? 'active' : ''}" data-value="12">
                        <span style="font-size: 0.8em; font-weight: bold;">A</span>
                    </button>
                    <button class="draw-popup-option ${this.settings.text.size === 16 ? 'active' : ''}" data-value="16">
                        <span style="font-size: 1em; font-weight: bold;">A</span>
                    </button>
                    <button class="draw-popup-option ${this.settings.text.size === 20 ? 'active' : ''}" data-value="20">
                        <span style="font-size: 1.2em; font-weight: bold;">A</span>
                    </button>
                `;
      } else {
        // Marker or Highlighter with slider
        const minSize = toolType === 'marker' ? 1 : 5;
        const maxSize = toolType === 'marker' ? 15 : 30;
        const currentSize = this.settings[toolType].size;

        // Define preset values
        const small = toolType === 'marker' ? 3 : 8;
        const medium = toolType === 'marker' ? 6 : 15;
        const large = toolType === 'marker' ? 10 : 22;

        content = `
                    <div style="padding: 8px; min-width: 180px;">
                        <input type="range"
                            class="draw-size-slider"
                            min="${minSize}"
                            max="${maxSize}"
                            value="${currentSize}"
                            style="width: 100%; margin-bottom: 8px;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button class="draw-popup-option ${currentSize === small ? 'active' : ''}" data-value="${small}">
                                <svg width="30" height="20" viewBox="0 0 30 20">
                                    <line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </button>
                            <button class="draw-popup-option ${currentSize === medium ? 'active' : ''}" data-value="${medium}">
                                <svg width="30" height="20" viewBox="0 0 30 20">
                                    <line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="4"/>
                                </svg>
                            </button>
                            <button class="draw-popup-option ${currentSize === large ? 'active' : ''}" data-value="${large}">
                                <svg width="30" height="20" viewBox="0 0 30 20">
                                    <line x1="2" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="6"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
      }
    }

    popup.innerHTML = content;

    // Position popup
    document.body.appendChild(popup);
    const rect = triggerButton.getBoundingClientRect();
    popup.style.position = 'absolute';
    popup.style.top = `${rect.bottom + 5}px`;
    popup.style.left = `${rect.left}px`;

    // Attach slider listener (for marker/highlighter size)
    const slider = popup.querySelector('.draw-size-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const value = Number(e.target.value);
        this.settings[toolType].size = value;

        // Re-render tool options
        if (toolType === 'marker') {this.renderMarkerOptions();}
        else if (toolType === 'highlighter') {this.renderHighlighterOptions();}

        // Update annotation service
        annotationService.setTool(this.currentTool, this.settings);

        // Apply changes to selected annotation if any
        annotationService.applyCurrentSettingsToSelected();

      });
    }

    // Attach option listeners
    popup.querySelectorAll('.draw-popup-option').forEach(option => {
      option.addEventListener('click', () => {
        const value = option.dataset.value;

        if (setting === 'color') {
          this.settings[toolType].color = value;
        } else if (setting === 'size') {
          this.settings[toolType].size = Number(value);
          // Update slider if it exists
          if (slider) {
            slider.value = value;
          }
        }

        // Re-render tool options
        if (toolType === 'text') {this.renderTextOptions();}
        else if (toolType === 'marker') {this.renderMarkerOptions();}
        else if (toolType === 'highlighter') {this.renderHighlighterOptions();}

        // Update annotation service
        annotationService.setTool(this.currentTool, this.settings);

        // Apply changes to selected annotation if any
        annotationService.applyCurrentSettingsToSelected();

        popup.remove();
      });
    });

    // Close popup when clicking outside
    setTimeout(() => {
      const closePopup = (e) => {
        if (!popup.contains(e.target) && !triggerButton.contains(e.target)) {
          popup.remove();
          document.removeEventListener('click', closePopup);
        }
      };
      document.addEventListener('click', closePopup);
    }, 0);
  }

  /**
     * Convert hex color to rgba
     */
  hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
     * Get the current tool name
     * @returns {string|null}
     */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
     * Get settings for the current tool
     * @returns {Object|null}
     */
  getCurrentSettings() {
    return this.currentTool ? this.settings[this.currentTool] : null;
  }

  /**
     * Initialize panel width syncing so all panels have equal width (matching the widest)
     */
  initializePanelWidthSync() {
    const rootStyle = document.documentElement.style;
    const DRAW_WIDTH_VAR = '--draw-panel-synced-width';

    // Pre-measure natural content widths before syncing
    const measureNaturalWidths = () => {
      // Temporarily remove the synced width to measure natural size
      const currentSyncedWidth = rootStyle.getPropertyValue(DRAW_WIDTH_VAR);
      rootStyle.setProperty(DRAW_WIDTH_VAR, 'auto');

      let maxWidth = 0;
      let widestPanel = null;
      const widths = {};

      this.toolPanels.forEach(panel => {
        // Force layout recalculation
        panel.offsetHeight;

        const width = panel.getBoundingClientRect().width;
        const toolName = panel.dataset.drawTool || 'unknown';

        widths[toolName] = width;

        if (width > maxWidth) {
          maxWidth = width;
          widestPanel = toolName;
        }
      });

      // Restore or set the synced width
      if (maxWidth > 0) {
        rootStyle.setProperty(DRAW_WIDTH_VAR, `${maxWidth}px`);
      } else if (currentSyncedWidth) {
        rootStyle.setProperty(DRAW_WIDTH_VAR, currentSyncedWidth);
      }

      return maxWidth;
    };

    // Measure all panels and find the widest (after sync)
    const measurePanelWidths = () => {
      measureNaturalWidths();
    };

    // Initial measurement
    requestAnimationFrame(() => {
      measurePanelWidths();
    });

    // Re-measure on window resize
    window.addEventListener('resize', () => {
      measurePanelWidths();
    });

    // Observe panel content changes with ResizeObserver
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        measurePanelWidths();
      });

      this.toolPanels.forEach(panel => {
        resizeObserver.observe(panel);
      });
    }
  }
}

// Create singleton instance
const drawToolsController = new DrawToolsController();

export default drawToolsController;


