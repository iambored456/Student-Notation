// js/components/StampsToolbar/TripletsToolbar.js
import { TRIPLET_STAMPS, getTripletStampById } from '../../../rhythm/triplets.js';
import { createTripletPreview } from '../glyphs/tripletGlyphs.js';
import store from '../../../state/index.js';
import logger from '../../../utils/logger.js';

logger.moduleLoaded('TripletsToolbar', 'triplets');

const TripletsToolbar = {
    selectedTripletStampId: null,

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
        
        // Create main container with header
        const mainContainer = document.createElement('div');
        mainContainer.className = 'triplets-main-container';
        
        // Create sections container
        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'triplets-sections';

        // Eighth Triplets Section (IDs 1-7)
        const eighthSection = this.createSection('Eighth Triplets', TRIPLET_STAMPS.slice(0, 7));
        sectionsContainer.appendChild(eighthSection);

        // Quarter Triplets Section (IDs 8-14) - Split into two rows
        const quarterSection = this.createQuarterTripletsSection(TRIPLET_STAMPS.slice(7, 14));
        sectionsContainer.appendChild(quarterSection);

        mainContainer.appendChild(sectionsContainer);
        container.appendChild(mainContainer);
    },

    createSection(title, stamps) {
        const section = document.createElement('div');
        section.className = 'triplets-section';
        

        // Grid container for buttons
        const grid = document.createElement('div');
        grid.className = 'triplets-grid';
        
        stamps.forEach(stamp => {
            const button = this.createTripletButton(stamp);
            grid.appendChild(button);
        });
        
        section.appendChild(grid);
        return section;
    },

    createQuarterTripletsSection(stamps) {
        const section = document.createElement('div');
        section.className = 'triplets-section';
        
        // Create first row: 1, 2, 3 (stamps 8, 9, 10)
        const firstRow = document.createElement('div');
        firstRow.className = 'triplets-grid triplets-quarter-row';
        [stamps[0], stamps[1], stamps[2]].forEach(stamp => {
            const button = this.createTripletButton(stamp);
            firstRow.appendChild(button);
        });
        
        // Create second row: 13, 23, 13, 123 (stamps 11, 12, 13, 14)
        const secondRow = document.createElement('div');
        secondRow.className = 'triplets-grid triplets-quarter-row';
        [stamps[3], stamps[4], stamps[5], stamps[6]].forEach(stamp => {
            const button = this.createTripletButton(stamp);
            secondRow.appendChild(button);
        });
        
        section.appendChild(firstRow);
        section.appendChild(secondRow);
        return section;
    },

    createTripletButton(stamp) {
        const button = document.createElement('button');
        button.className = 'triplet-button';
        button.setAttribute('data-triplet-stamp-id', stamp.id);
        button.setAttribute('title', stamp.label);
        
        // Quarter triplets should be wider to show their 2-cell span
        if (stamp.span === 'quarter') {
            button.classList.add('triplet-button-wide');
        }
        
        // Create SVG preview with appropriate width
        const isWide = stamp.span === 'quarter';
        const svgWidth = isWide ? 80 : 40; // Quarter triplets are 2x wider
        const svg = createTripletPreview(stamp, svgWidth, 40);
        button.appendChild(svg);
        
        return button;
    },

    bindEvents() {
        const container = document.getElementById('triplets-toolbar-container');
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            const button = e.target.closest('.triplet-button');
            if (button) {
                const stampId = parseInt(button.getAttribute('data-triplet-stamp-id'));
                this.selectTripletStamp(stampId);
            }
        });

        // Add color updating logic to match preset buttons (similar to StampsToolbar)
        this.updateTripletColors = (color) => {
            if (!color || !container) return;

            // Helper functions to create lighter/darker colors (matching preset logic)
            const createLighterColor = (hexColor, percentage = 50) => {
                const r = parseInt(hexColor.slice(1, 3), 16);
                const g = parseInt(hexColor.slice(3, 5), 16);
                const b = parseInt(hexColor.slice(5, 7), 16);
                const newR = Math.min(255, Math.floor(r + (255 - r) * (percentage / 100)));
                const newG = Math.min(255, Math.floor(g + (255 - g) * (percentage / 100)));
                const newB = Math.min(255, Math.floor(b + (255 - b) * (percentage / 100)));
                return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
            };

            const createDarkerColor = (hexColor, percentage = 20) => {
                const r = parseInt(hexColor.slice(1, 3), 16);
                const g = parseInt(hexColor.slice(3, 5), 16);
                const b = parseInt(hexColor.slice(5, 7), 16);
                const newR = Math.max(0, Math.floor(r * (1 - percentage / 100)));
                const newG = Math.max(0, Math.floor(g * (1 - percentage / 100)));
                const newB = Math.max(0, Math.floor(b * (1 - percentage / 100)));
                return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
            };

            // Get the color palette to find the lighter color
            const colorPalette = store.state.colorPalette[color] || { primary: color, light: color };
            const lightColor = createLighterColor(colorPalette.light, 60);
            const primaryColor = colorPalette.primary;
            const hoverColor = createDarkerColor(primaryColor, 20);

            // Update CSS variables to match shapenote color
            container.style.setProperty('--c-accent', primaryColor);
            container.style.setProperty('--c-accent-light', lightColor);
            container.style.setProperty('--c-accent-hover', hoverColor);

            logger.info('TripletsToolbar', `Updated colors for ${color}`, { 
                primary: primaryColor, 
                light: lightColor, 
                hover: hoverColor 
            }, 'triplets');
        };

        // Listen for note changes to update triplet button colors
        store.on('noteChanged', ({ newNote }) => {
            if (newNote.color) {
                this.updateTripletColors(newNote.color);
            }
        });

        // Update colors for current note if one is selected
        const currentNote = store.state.selectedNote;
        if (currentNote && currentNote.color) {
            this.updateTripletColors(currentNote.color);
        }

        // Listen for tool changes to clear selection when switching away from triplet tool
        store.on('toolChanged', ({ newTool }) => {
            if (newTool !== 'triplet') {
                this.clearSelection();
            }
        });

        // Listen for stamp tool selection to clear triplet selection
        store.on('stampToolSelected', () => {
            this.clearSelection();
        });
    },

    selectTripletStamp(stampId) {
        this.selectedTripletStampId = stampId;
        
        // Update UI
        const container = document.getElementById('triplets-toolbar-container');
        if (container) {
            container.querySelectorAll('.triplet-button').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.getAttribute('data-triplet-stamp-id')) === stampId);
            });
        }
        
        // Auto-select the triplet tool when a triplet stamp is selected
        store.setSelectedTool('triplet');
        
        // Emit event for other components
        store.emit('tripletStampSelected', stampId);
        
        // Emit event to clear other rhythm tool selections
        store.emit('tripletToolSelected');
        
        logger.info('TripletsToolbar', `Selected triplet stamp ${stampId} and switched to triplet tool`, { stampId }, 'triplets');
    },

    clearSelection() {
        this.selectedTripletStampId = null;
        
        // Update UI
        const container = document.getElementById('triplets-toolbar-container');
        if (container) {
            container.querySelectorAll('.triplet-button').forEach(btn => {
                btn.classList.remove('active');
            });
        }
    },

    getSelectedTripletStamp() {
        return this.selectedTripletStampId ? getTripletStampById(this.selectedTripletStampId) : null;
    }
};

export default TripletsToolbar;