// js/components/Toolbar/initializers/sidebarInitializer.js
import store from '../../../state/store.js';

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
}