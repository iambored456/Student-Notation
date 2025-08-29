// js/components/Toolbar/initializers/sidebarInitializer.js
import store from '../../../state/index.js';
import LayoutService from '../../../services/layoutService.js';

function initAnacrusisToggle() {
    const anacrusisOnBtn = document.getElementById('anacrusis-on-btn');
    const anacrusisOffBtn = document.getElementById('anacrusis-off-btn');

    if (!anacrusisOnBtn || !anacrusisOffBtn) return;

    anacrusisOnBtn.addEventListener('click', () => store.setAnacrusis(true));
    anacrusisOffBtn.addEventListener('click', () => store.setAnacrusis(false));

    store.on('anacrusisChanged', (isEnabled) => {
        anacrusisOnBtn.classList.toggle('active', isEnabled);
        anacrusisOffBtn.classList.toggle('active', !isEnabled);
    });

    // Set initial state
    anacrusisOnBtn.classList.toggle('active', store.state.hasAnacrusis);
    anacrusisOffBtn.classList.toggle('active', !store.state.hasAnacrusis);
}

function initGridVisibilityToggles() {
    const drumGridToggleBtn = document.getElementById('hide-drumgrid-toggle');
    const drumGridWrapper = document.getElementById('drum-grid-wrapper');

    // State tracking for grid visibility
    let isDrumGridVisible = true;

    // Drum Grid Toggle
    if (drumGridToggleBtn && drumGridWrapper) {
        drumGridToggleBtn.addEventListener('click', () => {
            isDrumGridVisible = !isDrumGridVisible;
            drumGridWrapper.style.display = isDrumGridVisible ? 'flex' : 'none';
            drumGridToggleBtn.querySelector('.sidebar-button-text').textContent = 
                isDrumGridVisible ? 'Hide Drum Grid' : 'Show Drum Grid';
            
            // Recalculate layout to make other containers expand
            setTimeout(() => LayoutService.recalculateLayout(), 10);
        });
    }
}

export function initSidebarAndVolume() {
    const settingsBtn = document.getElementById('settings-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    const volumeIconBtn = document.getElementById('volume-icon-button');
    const volumePopup = document.getElementById('volume-popup');
    const verticalVolumeSlider = document.getElementById('vertical-volume-slider');

    // Sidebar Logic
    const toggleSidebar = () => document.body.classList.toggle('sidebar-open');
    if (settingsBtn && sidebar && sidebarOverlay) {
        settingsBtn.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Volume Popup Logic
    if (volumeIconBtn && volumePopup && verticalVolumeSlider) {
        volumeIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = volumePopup.classList.toggle('visible');
            // Update the button's active state based on popup visibility
            volumeIconBtn.classList.toggle('active', isVisible);
        });

        verticalVolumeSlider.addEventListener('input', function() {
            const value = parseInt(this.value, 10);
            const dB = (value === 0) ? -Infinity : (value / 100) * 50 - 50;
            store.emit('volumeChanged', dB);
        });
        
        document.addEventListener('click', (e) => {
            if (!volumePopup.contains(e.target) && e.target !== volumeIconBtn) {
                volumePopup.classList.remove('visible');
                // Remove active state when popup is closed
                volumeIconBtn.classList.remove('active');
            }
        });

        verticalVolumeSlider.dispatchEvent(new Event('input'));
    }
    
    // Initialize the anacrusis toggle from the "Rhythm" tab
    initAnacrusisToggle();
    
    // Initialize grid visibility toggles
    initGridVisibilityToggles();
}