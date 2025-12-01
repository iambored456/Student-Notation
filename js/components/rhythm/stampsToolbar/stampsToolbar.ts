// js/components/Rhythm/stampsToolbar/stampsToolbar.js
import { SIXTEENTH_STAMPS } from '@/rhythm/stamps.ts';
import { defaultStampRenderer } from '@utils/stampRenderer.ts';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

interface Stamp { id: number; label: string; [key: string]: unknown }

interface StampButtonColors {
  primary: string;
  light: string;
  hover: string;
}

const StampsToolbar = {
  selectedStampId: 1 as number,
  updateStampColors: (_color: string) => {},

  init() {
    this.render();
    this.bindEvents();
    logger.info('StampsToolbar', 'Stamps toolbar initialized', null, 'stamps');
  },

  render() {
    const container = document.getElementById('stamps-toolbar-container');
    if (!container) {
      logger.warn('StampsToolbar', 'Container not found', null, 'stamps');
      return;
    }

    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'stamps-grid';

    const stampRows = [
      [1, 2, 3, 4],
      [5, 8, 14, 6, 9, 7],
      [10, 13, 12, 11, 15]
    ];

    stampRows.forEach((rowStampIds, rowIndex) => {
      const row = document.createElement('div');
      row.className = `stamps-row stamps-row-${rowIndex + 1}`;

      rowStampIds.forEach(stampId => {
        const stamp = SIXTEENTH_STAMPS.find(s => s.id === stampId) as Stamp | undefined;
        if (stamp) {
          const button = this.createStampButton(stamp);
          row.appendChild(button);
        }
      });

      grid.appendChild(row);
    });

    container.appendChild(grid);
    this.setInitialSelection(this.selectedStampId);
  },

  createStampButton(stamp: Stamp) {
    const button = document.createElement('button');
    button.className = 'stamp-button';
    button.dataset['stampId'] = `${stamp.id}`;
    button.setAttribute('title', `${stamp.id}: ${stamp.label}`);

    const svg = this.createStampPreview(stamp);
    button.appendChild(svg);

    return button;
  },

  createStampPreview(stamp: Stamp) {
    const svg = defaultStampRenderer.renderToSVG(stamp as any, 100, 100);
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    return svg;
  },

  bindEvents() {
    const container = document.getElementById('stamps-toolbar-container');
    if (!container) {return;}

    container.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement)?.closest('.stamp-button');
      if (button) {
        const stampId = parseInt(button.dataset.stampId || '', 10);
        if (!Number.isNaN(stampId)) {
          this.selectStamp(stampId);
        }
      }
    });

    this.updateStampColors = (color: string) => {
      if (!color || !container) {return;}

      const createLighterColor = (hexColor: string, percentage = 50) => {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const newR = Math.min(255, Math.floor(r + (255 - r) * (percentage / 100)));
        const newG = Math.min(255, Math.floor(g + (255 - g) * (percentage / 100)));
        const newB = Math.min(255, Math.floor(b + (255 - b) * (percentage / 100)));
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
      };

      const createDarkerColor = (hexColor: string, percentage = 20) => {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const newR = Math.max(0, Math.floor(r * (1 - percentage / 100)));
        const newG = Math.max(0, Math.floor(g * (1 - percentage / 100)));
        const newB = Math.max(0, Math.floor(b * (1 - percentage / 100)));
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
      };

      const palette = store.state.colorPalette[color] || { primary: color, light: color } as StampButtonColors;
      const lightColor = createLighterColor(palette.light, 60);
      const primaryColor = palette.primary;
      const hoverColor = createDarkerColor(primaryColor, 20);

      container.style.setProperty('--c-accent', primaryColor);
      container.style.setProperty('--c-accent-light', lightColor);
      container.style.setProperty('--c-accent-hover', hoverColor);
    };

    store.on('noteChanged', ({ newNote }: { newNote: { color?: string } }) => {
      if (newNote.color) {
        this.updateStampColors(newNote.color);
      }
    });

    const currentNote = store.state.selectedNote;
    if (currentNote?.color) {
      this.updateStampColors(currentNote.color);
    }

    store.on('toolChanged', ({ newTool }: { newTool: string }) => {
      if (newTool !== 'stamp') {
        this.clearSelection();
      }
    });

    store.on('tripletToolSelected', () => {
      this.clearSelection();
    });
  },

  setInitialSelection(stampId: number) {
    this.selectedStampId = stampId;
    const container = document.getElementById('stamps-toolbar-container');
    if (container) {
      container.querySelectorAll('.stamp-button').forEach(btn => {
        const button = btn as HTMLElement;
        button.classList.toggle('active', parseInt(button.dataset['stampId'] || '', 10) === stampId);
      });
    }
  },

  selectStamp(stampId: number) {
    this.selectedStampId = stampId;
    const container = document.getElementById('stamps-toolbar-container');
    if (container) {
      container.querySelectorAll('.stamp-button').forEach(btn => {
        const button = btn as HTMLElement;
        button.classList.toggle('active', parseInt(button.dataset['stampId'] || '', 10) === stampId);
      });
    }
    store.setSelectedTool('stamp');
    store.emit('stampSelected', stampId);
    store.emit('stampToolSelected');
  },

  clearSelection() {
    const container = document.getElementById('stamps-toolbar-container');
    if (container) {
      container.querySelectorAll('.stamp-button').forEach(btn => {
        btn.classList.remove('active');
      });
    }
  },

  getSelectedStamp() {
    const stamp = SIXTEENTH_STAMPS.find(s => s.id === this.selectedStampId);
    return stamp;
  }
};

export default StampsToolbar;
