// js/components/Rhythm/stampsToolbar/tripletsToolbar.js
import { TRIPLET_STAMPS } from '@/rhythm/triplets.ts';
import { createTripletPreview } from '@components/rhythm/glyphs/tripletGlyphs.ts';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

interface TripletStamp {
  id: number;
  span: string;
  hits: number[];
  label?: string;
}

const TripletsToolbar = {
  selectedTripletId: 1 as number,

  init() {
    this.render();
    this.bindEvents();
    logger.info('TripletsToolbar', 'Triplets toolbar initialized', null, 'triplets');
  },

  render() {
    const container = document.getElementById('triplets-toolbar-container');
    if (!container) {
      logger.warn('TripletsToolbar', 'Container not found', null, 'triplets');
      return;
    }

    container.innerHTML = '';

    // Separate eighth and quarter triplets
    const eighthTriplets = TRIPLET_STAMPS.filter(t => t.span === 'eighth');
    const quarterTriplets = TRIPLET_STAMPS.filter(t => t.span === 'quarter');

    // Create main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'triplets-main-container';

    // Create eighth triplets row
    if (eighthTriplets.length > 0) {
      const eighthRow = document.createElement('div');
      eighthRow.className = 'triplets-row triplets-eighth-row';

      eighthTriplets.forEach(triplet => {
        const button = this.createTripletButton(triplet);
        eighthRow.appendChild(button);
      });

      mainContainer.appendChild(eighthRow);
    }

    // Create quarter triplets rows (split into two rows)
    if (quarterTriplets.length > 0) {
      // First row - first 3 quarter triplets
      const quarterRow1 = document.createElement('div');
      quarterRow1.className = 'triplets-row triplets-quarter-row';

      quarterTriplets.slice(0, 3).forEach(triplet => {
        const button = this.createTripletButton(triplet);
        button.classList.add('triplet-button-wide');
        quarterRow1.appendChild(button);
      });

      mainContainer.appendChild(quarterRow1);

      // Second row - remaining quarter triplets
      if (quarterTriplets.length > 3) {
        const quarterRow2 = document.createElement('div');
        quarterRow2.className = 'triplets-row triplets-quarter-row';

        quarterTriplets.slice(3).forEach(triplet => {
          const button = this.createTripletButton(triplet);
          button.classList.add('triplet-button-wide');
          quarterRow2.appendChild(button);
        });

        mainContainer.appendChild(quarterRow2);
      }
    }

    container.appendChild(mainContainer);

    this.setInitialSelection(this.selectedTripletId);
  },

  createTripletButton(triplet: TripletStamp) {
    const button = document.createElement('button');
    button.className = 'triplet-button';
    button.dataset['tripletId'] = `${triplet.id}`;
    button.setAttribute('title', triplet.label || `Triplet ${triplet.id}`);

    // Use actual SVG renderer
    const svg = createTripletPreview(triplet as any, 40, 40);
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    button.appendChild(svg);

    return button;
  },

  bindEvents() {
    const container = document.getElementById('triplets-toolbar-container');
    if (!container) {return;}

    container.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement)?.closest('.triplet-button');
      if (!button) {return;}
      const tripletId = parseInt(button.dataset.tripletId || '', 10);
      if (!Number.isNaN(tripletId)) {
        this.selectTriplet(tripletId);
      }
    });

    store.on('toolChanged', ({ newTool }: { newTool: string }) => {
      if (newTool !== 'triplet') {
        this.clearSelection();
      }
    });

    store.on('stampToolSelected', () => {
      this.clearSelection();
    });
  },

  setInitialSelection(tripletId: number) {
    this.selectedTripletId = tripletId;
    const container = document.getElementById('triplets-toolbar-container');
    if (container) {
      container.querySelectorAll('.triplet-button').forEach(btn => {
        const button = btn as HTMLElement;
        button.classList.toggle('active', parseInt(button.dataset['tripletId'] || '', 10) === tripletId);
      });
    }
  },

  selectTriplet(tripletId: number) {
    this.selectedTripletId = tripletId;
    const container = document.getElementById('triplets-toolbar-container');
    if (container) {
      container.querySelectorAll('.triplet-button').forEach(btn => {
        const button = btn as HTMLElement;
        button.classList.toggle('active', parseInt(button.dataset['tripletId'] || '', 10) === tripletId);
      });
    }
    store.setSelectedTool('triplet');
    store.emit('tripletSelected', tripletId);
    store.emit('tripletToolSelected');
  },

  clearSelection() {
    const container = document.getElementById('triplets-toolbar-container');
    if (container) {
      container.querySelectorAll('.triplet-button').forEach(btn => {
        btn.classList.remove('active');
      });
    }
  },

  getSelectedTripletStamp() {
    const triplet = TRIPLET_STAMPS.find(t => t.id === this.selectedTripletId);
    return triplet;
  }
};

export default TripletsToolbar;
