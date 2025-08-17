// js/components/Toolbar/initializers/modulationInitializer.js

import store from '../../../state/index.js';
import { MODULATION_RATIOS } from '../../../rhythm/modulationMapping.js';
import logger from '../../../utils/logger.js';

export function initModulationControls() {
    console.log('🎵 [MODULATION] initModulationControls() called');
    
    // Debug: Check if DOM is ready
    console.log('🎵 [MODULATION] DOM ready state:', document.readyState);
    console.log('🎵 [MODULATION] Total elements in DOM:', document.querySelectorAll('*').length);
    
    // Try to find any button elements first
    const allButtons = document.querySelectorAll('button');
    console.log('🎵 [MODULATION] Total buttons found:', allButtons.length);
    
    // Check for modulation-related elements
    const modulationSection = document.querySelector('.modulation-controls');
    console.log('🎵 [MODULATION] Modulation controls container found:', !!modulationSection);
    
    const modulation23Btn = document.getElementById('modulation-2-3-btn');
    const modulation32Btn = document.getElementById('modulation-3-2-btn');
    const modulationClearBtn = document.getElementById('modulation-clear-btn');
    
    console.log('🎵 [MODULATION] Button elements found:', {
        modulation23Btn: !!modulation23Btn,
        modulation32Btn: !!modulation32Btn,
        modulationClearBtn: !!modulationClearBtn
    });
    
    if (!modulation23Btn || !modulation32Btn || !modulationClearBtn) {
        console.error('🎵 [MODULATION] Missing button elements:', {
            modulation23Btn: modulation23Btn,
            modulation32Btn: modulation32Btn,
            modulationClearBtn: modulationClearBtn
        });
        logger.warn('ModulationInitializer', 'Modulation control buttons not found in DOM', null, 'ui');
        return;
    }
    
    let selectedRatio = null;
    
    // 2:3 button click handler
    modulation23Btn.addEventListener('click', () => {
        console.log('🎵 [MODULATION] 2:3 button clicked!');
        console.log('🎵 [MODULATION] Current selectedRatio:', selectedRatio);
        console.log('🎵 [MODULATION] COMPRESSION_2_3 ratio:', MODULATION_RATIOS.COMPRESSION_2_3);
        
        if (selectedRatio === MODULATION_RATIOS.COMPRESSION_2_3) {
            // Deactivate
            console.log('🎵 [MODULATION] Deactivating 2:3 tool');
            selectedRatio = null;
            modulation23Btn.classList.remove('active');
            store.setSelectedTool('note');
            logger.info('ModulationInitializer', '2:3 modulation tool deactivated', null, 'ui');
        } else {
            // Activate 2:3
            console.log('🎵 [MODULATION] Activating 2:3 tool');
            selectedRatio = MODULATION_RATIOS.COMPRESSION_2_3;
            modulation23Btn.classList.add('active');
            modulation32Btn.classList.remove('active');
            store.setSelectedTool('modulation');
            store.state.selectedModulationRatio = selectedRatio;
            logger.info('ModulationInitializer', '2:3 modulation tool activated', null, 'ui');
            
            console.log('🎵 [MODULATION] 2:3 compression tool activated!');
            console.log('🎵 [MODULATION] • Hover over measure boundaries to see preview');
            console.log('🎵 [MODULATION] • Click to place modulation marker');
            console.log('🎵 [MODULATION] • Grid will compress (66.7% speed) after marker');
            console.log('🎵 [MODULATION] Current tool is now:', store.state.selectedTool);
        }
    });
    
    // 3:2 button click handler
    modulation32Btn.addEventListener('click', () => {
        if (selectedRatio === MODULATION_RATIOS.EXPANSION_3_2) {
            // Deactivate
            selectedRatio = null;
            modulation32Btn.classList.remove('active');
            store.setSelectedTool('note');
            logger.info('ModulationInitializer', '3:2 modulation tool deactivated', null, 'ui');
        } else {
            // Activate 3:2
            selectedRatio = MODULATION_RATIOS.EXPANSION_3_2;
            modulation32Btn.classList.add('active');
            modulation23Btn.classList.remove('active');
            store.setSelectedTool('modulation');
            store.state.selectedModulationRatio = selectedRatio;
            logger.info('ModulationInitializer', '3:2 modulation tool activated', null, 'ui');
            
            console.log('🎵 [MODULATION] 3:2 expansion tool activated!');
            console.log('🎵 [MODULATION] • Hover over measure boundaries to see preview');
            console.log('🎵 [MODULATION] • Click to place modulation marker');
            console.log('🎵 [MODULATION] • Grid will expand (150% speed) after marker');
        }
    });
    
    // Clear button click handler
    modulationClearBtn.addEventListener('click', () => {
        const markerCount = (store.state.modulationMarkers || []).length;
        
        if (markerCount === 0) {
            logger.info('ModulationInitializer', 'No modulation markers to clear', null, 'ui');
            console.log('🎵 [MODULATION] No markers to clear');
            return;
        }
        
        // Clear all markers using the new action method
        store.clearModulationMarkers();
        
        logger.info('ModulationInitializer', `Cleared ${markerCount} modulation markers`, null, 'ui');
        console.log(`🎵 [MODULATION] Cleared ${markerCount} markers`);
    });
    
    // Listen for tool changes to update button state
    store.on('toolChanged', (toolData) => {
        const newTool = toolData.newTool || toolData;
        if (newTool !== 'modulation') {
            selectedRatio = null;
            modulation23Btn.classList.remove('active');
            modulation32Btn.classList.remove('active');
        }
    });
    
    // Listen for marker changes to update UI state
    store.on('modulationMarkersChanged', () => {
        const markerCount = (store.state.modulationMarkers || []).length;
        
        // Update clear button state
        if (markerCount === 0) {
            modulationClearBtn.disabled = true;
            modulationClearBtn.style.opacity = '0.5';
        } else {
            modulationClearBtn.disabled = false;
            modulationClearBtn.style.opacity = '1';
        }
        
        // Update clear button text to show count
        modulationClearBtn.textContent = markerCount > 0 ? `Clear (${markerCount})` : 'Clear';
    });
    
    // Initialize button states
    const initialMarkerCount = (store.state.modulationMarkers || []).length;
    if (initialMarkerCount === 0) {
        modulationClearBtn.disabled = true;
        modulationClearBtn.style.opacity = '0.5';
    }
    modulationClearBtn.textContent = initialMarkerCount > 0 ? `Clear (${initialMarkerCount})` : 'Clear';
    
    console.log('🎵 [MODULATION] Event listeners attached successfully');
    console.log('🎵 [MODULATION] Initial marker count:', initialMarkerCount);
    logger.info('ModulationInitializer', 'Modulation controls initialized', null, 'ui');
    console.log('🎵 [MODULATION] initModulationControls() completed successfully');
}