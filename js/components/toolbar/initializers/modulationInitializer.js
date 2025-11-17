// js/components/Toolbar/initializers/modulationInitializer.js

import store from '@state/index.js';
import { MODULATION_RATIOS } from '@/rhythm/modulationMapping.js';
import logger from '@utils/logger.js';

export function initModulationControls() {

  // Debug: Check if DOM is ready

  const modulation23Btn = document.getElementById('modulation-2-3-btn');
  const modulation32Btn = document.getElementById('modulation-3-2-btn');
  const modulationClearBtn = document.getElementById('modulation-clear-btn');


  if (!modulation23Btn || !modulation32Btn || !modulationClearBtn) {
    logger.warn('ModulationInitializer', 'Modulation control buttons not found in DOM', null, 'ui');
    return;
  }

  let selectedRatio = null;

  // 2:3 button click handler
  modulation23Btn.addEventListener('click', () => {

    if (selectedRatio === MODULATION_RATIOS.COMPRESSION_2_3) {
      // Deactivate
      selectedRatio = null;
      modulation23Btn.classList.remove('active');
      store.setSelectedTool('note');
      logger.info('ModulationInitializer', '2:3 modulation tool deactivated', null, 'ui');
    } else {
      // Activate 2:3
      selectedRatio = MODULATION_RATIOS.COMPRESSION_2_3;
      modulation23Btn.classList.add('active');
      modulation32Btn.classList.remove('active');
      store.setSelectedTool('modulation');
      store.state.selectedModulationRatio = selectedRatio;
      logger.info('ModulationInitializer', '2:3 modulation tool activated', null, 'ui');

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

    }
  });

  // Clear button click handler
  modulationClearBtn.addEventListener('click', () => {
    const markerCount = (store.state.modulationMarkers || []).length;

    if (markerCount === 0) {
      logger.info('ModulationInitializer', 'No modulation markers to clear', null, 'ui');
      return;
    }

    // Clear all markers using the new action method
    store.clearModulationMarkers();

    logger.info('ModulationInitializer', `Cleared ${markerCount} modulation markers`, null, 'ui');
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

  logger.info('ModulationInitializer', 'Modulation controls initialized', null, 'ui');
}
