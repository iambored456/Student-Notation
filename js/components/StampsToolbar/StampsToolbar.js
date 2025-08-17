// js/components/StampsToolbar/StampsToolbar.js
import { SIXTEENTH_STAMPS } from '../../rhythm/stamps.js';
import { defaultStampRenderer } from '../../utils/stampRenderer.js';
import store from '../../state/index.js';
import logger from '../../utils/logger.js';

logger.moduleLoaded('StampsToolbar', 'stamps');

const StampsToolbar = {
    selectedStampId: 1,

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
        
        // Create the grid container
        const grid = document.createElement('div');
        grid.className = 'stamps-grid';
        
        // Define the stamp arrangement for 3 rows
        const stampRows = [
            [1, 2, 3, 4],                    // Row 1
            [5, 8, 14, 6, 9, 7],            // Row 2
            [10, 13, 12, 11, 15]            // Row 3
        ];
        
        // Render stamps in 3 rows with specific arrangement
        stampRows.forEach((rowStampIds, rowIndex) => {
            const row = document.createElement('div');
            row.className = `stamps-row stamps-row-${rowIndex + 1}`;
            
            rowStampIds.forEach(stampId => {
                const stamp = SIXTEENTH_STAMPS.find(s => s.id === stampId);
                if (stamp) {
                    const button = this.createStampButton(stamp, stampId - 1);
                    row.appendChild(button);
                }
            });
            
            grid.appendChild(row);
        });
        
        container.appendChild(grid);
        
        // Set initial selection
        this.selectStamp(this.selectedStampId);
    },

    createStampButton(stamp, index) {
        const button = document.createElement('button');
        button.className = 'stamp-button';
        button.setAttribute('data-stamp-id', stamp.id);
        button.setAttribute('title', `${stamp.id}: ${stamp.label}`);
        
        // Create SVG preview
        const svg = this.createStampPreview(stamp);
        button.appendChild(svg);
        
        return button;
    },

    createStampPreview(stamp) {        
        // Create the stamp SVG using shared renderer
        const svg = defaultStampRenderer.renderToSVG(stamp, 100, 100);
        svg.setAttribute('width', '48');
        svg.setAttribute('height', '48');
        
        return svg;
    },

    bindEvents() {
        const container = document.getElementById('stamps-toolbar-container');
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            const button = e.target.closest('.stamp-button');
            if (button) {
                const stampId = parseInt(button.getAttribute('data-stamp-id'));
                this.selectStamp(stampId);
            }
        });

        // Add color updating logic to match preset buttons
        this.updateStampColors = (color) => {
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

            logger.info('StampsToolbar', `Updated colors for ${color}`, { 
                primary: primaryColor, 
                light: lightColor, 
                hover: hoverColor 
            }, 'stamps');
        };

        // Listen for note changes to update stamp button colors
        store.on('noteChanged', ({ newNote }) => {
            if (newNote.color) {
                this.updateStampColors(newNote.color);
            }
        });

        // Update colors for current note if one is selected
        const currentNote = store.state.selectedNote;
        if (currentNote && currentNote.color) {
            this.updateStampColors(currentNote.color);
        }

        // Listen for tool changes to clear selection when switching away from stamp tool
        store.on('toolChanged', ({ newTool }) => {
            if (newTool !== 'stamp') {
                this.clearSelection();
            }
        });

        // Listen for triplet tool selection to clear stamp selection
        store.on('tripletToolSelected', () => {
            this.clearSelection();
        });
    },

    selectStamp(stampId) {
        this.selectedStampId = stampId;
        
        // Update UI
        const container = document.getElementById('stamps-toolbar-container');
        if (container) {
            container.querySelectorAll('.stamp-button').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.getAttribute('data-stamp-id')) === stampId);
            });
        }
        
        // Auto-select the stamp tool when a stamp is selected
        store.setSelectedTool('stamp');
        
        // Emit event for other components
        store.emit('stampSelected', stampId);
        
        // Emit event to clear other rhythm tool selections
        store.emit('stampToolSelected');
        
        logger.info('StampsToolbar', `Selected stamp ${stampId} and switched to stamp tool`, { stampId }, 'stamps');
    },

    clearSelection() {
        this.selectedStampId = null;
        
        // Update UI
        const container = document.getElementById('stamps-toolbar-container');
        if (container) {
            container.querySelectorAll('.stamp-button').forEach(btn => {
                btn.classList.remove('active');
            });
        }
    },

    getSelectedStamp() {
        return SIXTEENTH_STAMPS.find(stamp => stamp.id === this.selectedStampId);
    }
};

export default StampsToolbar;