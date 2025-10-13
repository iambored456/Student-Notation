// js/state/actions/stampActions.js
import logger from '../../utils/logger.js';

logger.moduleLoaded('StampActions', 'stamps');

function generateStampId() {
    return `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const stampActions = {
    /**
     * Adds a stamp placement to the state
     * @param {number} stampId - The stamp template ID
     * @param {number} startColumn - Grid start column index
     * @param {number} row - Grid row index
     * @param {string} color - Color for the stamp
     * @returns {Object|null} The placed stamp or null if invalid
     */
    addStampPlacement(stampId, startColumn, row, color = '#4a90e2') {
        const endColumn = startColumn + 1; // Stamps span 2 microbeats
        
        // Check for collision with existing stamps (2-microbeat collision detection)
        const existingStamp = this.state.stampPlacements.find(placement =>
            placement.row === row &&
            placement.startColumn <= endColumn && 
            placement.endColumn >= startColumn
        );
        
        if (existingStamp) {
            // Remove existing colliding stamp
            this.removeStampPlacement(existingStamp.id);
        }
        
        const placement = {
            id: generateStampId(),
            stampId,
            startColumn,
            endColumn,
            row,
            color,
            timestamp: Date.now()
        };
        
        this.state.stampPlacements.push(placement);
        this.emit('stampPlacementsChanged');
        
        logger.debug('StampActions', `Added stamp ${stampId} at ${startColumn}-${endColumn},${row}`, {
            stampId,
            startColumn,
            endColumn,
            row,
            placementId: placement.id
        }, 'stamps');
        
        return placement;
    },

    /**
     * Removes a stamp placement by ID
     * @param {string} placementId - The placement ID to remove
     * @returns {boolean} True if a stamp was removed
     */
    removeStampPlacement(placementId) {
        const index = this.state.stampPlacements.findIndex(p => p.id === placementId);
        if (index === -1) return false;
        
        const removed = this.state.stampPlacements.splice(index, 1)[0];
        this.emit('stampPlacementsChanged');
        
        logger.debug('StampActions', `Removed stamp ${removed.stampId} at ${removed.startColumn}-${removed.endColumn},${removed.row}`, {
            placementId,
            stampId: removed.stampId,
            startColumn: removed.startColumn,
            endColumn: removed.endColumn,
            row: removed.row
        }, 'stamps');
        
        return true;
    },

    /**
     * Removes stamps that intersect with an eraser area
     * @param {number} eraseStartCol - Start column of eraser
     * @param {number} eraseEndCol - End column of eraser
     * @param {number} eraseStartRow - Start row of eraser
     * @param {number} eraseEndRow - End row of eraser
     * @returns {boolean} True if any stamps were removed
     */
    eraseStampsInArea(eraseStartCol, eraseEndCol, eraseStartRow, eraseEndRow) {
        const toRemove = [];
        
        for (const placement of this.state.stampPlacements) {
            // Check for overlap between stamp's 2×1 area and eraser's area
            const horizontalOverlap = placement.startColumn <= eraseEndCol && placement.endColumn >= eraseStartCol;
            const verticalOverlap = placement.row >= eraseStartRow && placement.row <= eraseEndRow;
            
            if (horizontalOverlap && verticalOverlap) {
                toRemove.push(placement.id);
            }
        }
        
        let removed = false;
        toRemove.forEach(id => {
            if (this.removeStampPlacement(id)) {
                removed = true;
            }
        });
        
        return removed;
    },

    /**
     * Gets all stamp placements
     * @returns {Array} Array of all placed stamps
     */
    getAllStampPlacements() {
        return [...this.state.stampPlacements];
    },

    /**
     * Gets stamp placement at specific position
     * @param {number} column - Grid column index
     * @param {number} row - Grid row index
     * @returns {Object|null} The stamp at this position or null
     */
    getStampAt(column, row) {
        return this.state.stampPlacements.find(placement =>
            placement.row === row && 
            column >= placement.startColumn && 
            column <= placement.endColumn
        ) || null;
    },

    /**
     * Clears all stamp placements
     */
    clearAllStamps() {
        const hadStamps = this.state.stampPlacements.length > 0;
        this.state.stampPlacements = [];
        
        if (hadStamps) {
            this.emit('stampPlacementsChanged');
            logger.info('StampActions', 'Cleared all stamp placements', null, 'stamps');
        }
    },

    /**
     * Gets stamp placements for playback scheduling
     * @returns {Array} Array of playback data for stamps
     */
    getStampPlaybackData() {
        return this.state.stampPlacements.map(placement => {
            const rowData = this.state.fullRowData[placement.row];
            return {
                stampId: placement.stampId,
                column: placement.startColumn,
                startColumn: placement.startColumn,
                endColumn: placement.endColumn,
                row: placement.row,
                pitch: rowData?.toneNote,
                color: placement.color,
                placement  // Include full placement object with shapeOffsets
            };
        }).filter(data => data.pitch); // Only include stamps with valid pitches
    },

    /**
     * Updates the pitch offset for an individual shape within a stamp
     * @param {string} placementId - The stamp placement ID
     * @param {string} shapeKey - e.g., "diamond_0", "oval_0"
     * @param {number} rowOffset - Offset from stamp's base row
     */
    updateStampShapeOffset(placementId, shapeKey, rowOffset) {
        const placement = this.state.stampPlacements.find(p => p.id === placementId);
        if (!placement) {
            console.warn('[STAMP SHAPE OFFSET] Placement not found:', placementId);
            return;
        }

        // Initialize shapeOffsets if it doesn't exist
        if (!placement.shapeOffsets) {
            placement.shapeOffsets = {};
        }

        console.log('[STAMP SHAPE OFFSET] Updating shape offset:', {
            placementId,
            shapeKey,
            oldOffset: placement.shapeOffsets[shapeKey] || 0,
            newOffset: rowOffset,
            baseRow: placement.row,
            targetRow: placement.row + rowOffset
        });

        placement.shapeOffsets[shapeKey] = rowOffset;
        this.emit('stampPlacementsChanged');
    },

    /**
     * Gets the effective row for a specific shape within a stamp
     * @param {Object} placement - The stamp placement
     * @param {string} shapeKey - e.g., "diamond_0", "oval_0"
     * @returns {number} The effective row index for this shape
     */
    getShapeRow(placement, shapeKey) {
        const offset = (placement.shapeOffsets?.[shapeKey]) || 0;
        return placement.row + offset;
    }
};