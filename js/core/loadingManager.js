// js/core/loadingManager.js

/**
 * Loading Manager
 *
 * Manages app initialization with progress tracking and resource preloading.
 * Provides a smooth loading experience with visual feedback.
 */

class LoadingManager {
    constructor() {
        this.tasks = [];
        this.completedTasks = 0;
        this.totalTasks = 0;
        this.startTime = null;
        this.loadingScreen = null;
        this.progressBar = null;
        this.progressText = null;
        this.statusText = null;
        this.initialized = false;
        this.cache = {
            fonts: new Map(),
            icons: new Map(),
            modules: new Map()
        };
    }

    /**
     * Initialize loading screen UI
     */
    createLoadingScreen() {
        if (this.loadingScreen) return;

        this.loadingScreen = document.createElement('div');
        this.loadingScreen.id = 'app-loading-screen';
        this.loadingScreen.innerHTML = `
            <div class="loading-container">
                <div class="loading-logo">
                    <svg viewBox="0 0 100 100" class="logo-svg">
                        <circle cx="50" cy="50" r="45" class="logo-circle" />
                        <path d="M 30 50 Q 50 30, 70 50 T 70 70" class="logo-path" />
                    </svg>
                </div>
                <h1 class="loading-title">Student Notation</h1>
                <div class="loading-progress-container">
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill" id="loading-progress-fill"></div>
                    </div>
                    <div class="loading-progress-text" id="loading-progress-text">0%</div>
                </div>
                <div class="loading-status" id="loading-status">Initializing...</div>
            </div>
        `;

        document.body.appendChild(this.loadingScreen);
        this.progressBar = document.getElementById('loading-progress-fill');
        this.progressText = document.getElementById('loading-progress-text');
        this.statusText = document.getElementById('loading-status');
    }

    /**
     * Register a loading task
     */
    registerTask(name, weight = 1) {
        this.tasks.push({ name, weight, completed: false });
        this.totalTasks += weight;
    }

    /**
     * Mark a task as complete and update progress
     */
    completeTask(name) {
        const task = this.tasks.find(t => t.name === name && !t.completed);
        if (!task) return;

        task.completed = true;
        this.completedTasks += task.weight;
        this.updateProgress();
    }

    /**
     * Update loading progress UI
     */
    updateProgress() {
        if (!this.progressBar || !this.progressText) return;

        const progress = this.totalTasks > 0 ? (this.completedTasks / this.totalTasks) * 100 : 0;
        const progressRounded = Math.round(progress);

        this.progressBar.style.width = `${progressRounded}%`;
        this.progressText.textContent = `${progressRounded}%`;
    }

    /**
     * Update status text
     */
    updateStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    /**
     * Preload font
     */
    async preloadFont(fontFamily, url, weight = 'normal', style = 'normal') {
        const cacheKey = `${fontFamily}-${weight}-${style}`;

        if (this.cache.fonts.has(cacheKey)) {
            return this.cache.fonts.get(cacheKey);
        }

        try {
            const fontFace = new FontFace(fontFamily, `url(${url})`, { weight, style });
            const loadedFont = await fontFace.load();
            document.fonts.add(loadedFont);
            this.cache.fonts.set(cacheKey, loadedFont);
            return loadedFont;
        } catch (error) {
            console.warn(`Failed to preload font ${fontFamily}:`, error);
            return null;
        }
    }

    /**
     * Preload image/icon
     */
    async preloadImage(url) {
        if (this.cache.icons.has(url)) {
            return this.cache.icons.get(url);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.cache.icons.set(url, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to preload image: ${url}`);
                resolve(null); // Don't reject, just continue
            };
            img.src = url;
        });
    }

    /**
     * Preload all critical resources
     */
    async preloadResources() {
        const resources = [];

        // Preload fonts
        resources.push(
            this.preloadFont(
                'Atkinson Hyperlegible',
                '../../fonts/AtkinsonHyperlegibleNext-Regular.otf'
            )
        );

        // Preload critical icons
        const criticalIcons = [
            '/assets/icons/Play.svg',
            '/assets/icons/Pause.svg',
            '/assets/icons/Stop.svg',
            '/assets/icons/Settings_optimized.svg',
            '/assets/icons/Volume_optimized.svg'
        ];

        resources.push(...criticalIcons.map(url => this.preloadImage(url)));

        // Wait for all resources with a timeout
        try {
            await Promise.race([
                Promise.all(resources),
                new Promise(resolve => setTimeout(resolve, 3000)) // 3s timeout
            ]);
        } catch (error) {
            console.warn('Some resources failed to preload:', error);
        }
    }

    /**
     * Initialize Tone.js audio context (lazy)
     */
    async initializeAudioContext() {
        try {
            // Import Tone.js dynamically
            const Tone = await import('tone');

            // Don't start audio yet - wait for user gesture
            // Just ensure Tone is loaded
            this.cache.modules.set('tone', Tone);

            return Tone;
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            throw error;
        }
    }

    /**
     * Initialize loading screen (synchronous part)
     */
    async init() {
        if (this.initialized) return;

        this.startTime = Date.now();
        this.createLoadingScreen();

        try {
            // Step 1: Preload fonts
            this.updateStatus('Loading fonts...');
            await this.preloadResources();
            await this.delay(50);

            // Step 2: Preload icons (already done in preloadResources)
            await this.delay(50);

            // Step 3: Don't initialize audio context yet - Tone.js is already imported in main.js
            // Just wait a moment for visual feedback
            this.updateStatus('Preparing...');
            await this.delay(50);

            this.initialized = true;

        } catch (error) {
            console.error('[LOADING] Resource preloading failed:', error);
            this.showError(error);
            throw error;
        }
    }

    /**
     * Complete loading and fade out
     */
    async complete() {
        if (!this.loadingScreen) return;

        this.updateStatus('Ready!');

        // Small delay before fade out
        await this.delay(200);

        // Fade out loading screen
        await this.fadeOut();
    }

    /**
     * Delay helper for pacing
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fade out loading screen
     */
    async fadeOut() {
        if (!this.loadingScreen) return;

        this.loadingScreen.classList.add('fade-out');

        // Wait for animation to complete
        await this.delay(600);

        // Remove from DOM
        if (this.loadingScreen.parentNode) {
            this.loadingScreen.parentNode.removeChild(this.loadingScreen);
        }

        this.loadingScreen = null;
    }

    /**
     * Show error message
     */
    showError(error) {
        if (!this.statusText) return;

        this.statusText.textContent = `Error: ${error.message}`;
        this.statusText.style.color = '#ff4444';

        if (this.loadingScreen) {
            this.loadingScreen.classList.add('error');
        }
    }

    /**
     * Get cached resource
     */
    getCached(type, key) {
        return this.cache[type]?.get(key);
    }
}

// Export singleton instance
const loadingManager = new LoadingManager();
export default loadingManager;
