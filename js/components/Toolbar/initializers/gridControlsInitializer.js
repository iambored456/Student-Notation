// js/components/Toolbar/initializers/gridControlsInitializer.js
import store from '../../../state/store.js';

export function initGridControls() {
    document.getElementById('grid-zoom-in').addEventListener('click', () => store.emit('zoomIn'));
    document.getElementById('grid-zoom-out').addEventListener('click', () => store.emit('zoomOut'));
    
    document.getElementById('macrobeat-increase').addEventListener('click', () => store.increaseMacrobeatCount());
    document.getElementById('macrobeat-decrease').addEventListener('click', () => store.decreaseMacrobeatCount());
}