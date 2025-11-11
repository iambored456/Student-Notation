// js/components/Toolbar/initializers/gridControlsInitializer.js
import store from '@state/index.js';

export function initGridControls() {
    // Zoom controls are now in container-1
    const zoomInBtn = document.getElementById('grid-zoom-in');
    const zoomOutBtn = document.getElementById('grid-zoom-out');
    
    // Macrobeat controls are now in the "Rhythm" tab
    const increaseBtn = document.getElementById('macrobeat-increase');
    const decreaseBtn = document.getElementById('macrobeat-decrease');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
        store.emit('zoomIn');
        zoomInBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
        store.emit('zoomOut');
        zoomOutBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    
    if (increaseBtn) increaseBtn.addEventListener('click', () => store.increaseMacrobeatCount());
    if (decreaseBtn) decreaseBtn.addEventListener('click', () => store.decreaseMacrobeatCount());
}
