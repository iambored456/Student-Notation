// js/components/Toolbar/initializers/sidebarInitializer.js
import store from '../../../state/index.js';

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

export function initSidebarAndVolume() {
    const settingsBtn = document.getElementById('settings-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    const volumeIconBtn = document.getElementById('volume-icon-button');
    const volumePopup = document.getElementById('volume-popup');
    const verticalVolumeSlider = document.getElementById('vertical-volume-slider');

    // Sidebar Logic
    const toggleSidebar = () => document.body.classList.toggle('sidebar-open');
    settingsBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    document.getElementById('save-as-button').innerHTML = '💾 Save As';
    document.getElementById('import-button').innerHTML = '📁 Open';
    document.getElementById('print-button').innerHTML = '🖨️ Print';

    // Volume Popup Logic
    volumeIconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        volumePopup.classList.toggle('visible');
    });

    verticalVolumeSlider.addEventListener('input', function() {
        const value = parseInt(this.value, 10);
        const dB = (value === 0) ? -Infinity : (value / 100) * 50 - 50;
        store.emit('volumeChanged', dB);
    });
    
    // Close popup if clicking outside
    document.addEventListener('click', (e) => {
        if (!volumePopup.contains(e.target) && e.target !== volumeIconBtn) {
            volumePopup.classList.remove('visible');
        }
    });

    // Initial Volume Dispatch
    verticalVolumeSlider.dispatchEvent(new Event('input'));
    
    // Initialize the anacrusis toggle
    initAnacrusisToggle();
}