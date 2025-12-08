import { getIconPath } from '@utils/assetPaths.ts';

interface Task { name: string; weight: number; completed: boolean }
interface CacheMap {
  fonts: Map<string, FontFace>;
  icons: Map<string, string>;
  modules: Map<string, unknown>;
}

/**
 * Manages app initialization with progress tracking and resource preloading.
 */
class LoadingManager {
  private tasks: Task[] = [];
  private completedTasks = 0;
  private totalTasks = 0;
  private startTime: number | null = null;
  private loadingScreen: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private initialized = false;
  private cache: CacheMap = {
    fonts: new Map(),
    icons: new Map(),
    modules: new Map()
  };
  private diagnostics: string[] = [];

  /**
   * Initialize loading screen UI.
   */
  createLoadingScreen(): void {
    if (this.loadingScreen) {return;}

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
   * Register a loading task.
   */
  registerTask(name: string, weight = 1): void {
    this.tasks.push({ name, weight, completed: false });
    this.totalTasks += weight;
  }

  /**
   * Mark a task as complete and update progress.
   */
  completeTask(name: string): void {
    const task = this.tasks.find(t => t.name === name && !t.completed);
    if (!task) {return;}

    task.completed = true;
    this.completedTasks += task.weight;
    this.updateProgress();
  }

  /**
   * Update progress display.
   */
  private updateProgress(): void {
    if (!this.progressBar || !this.progressText) {return;}

    const progress = this.totalTasks > 0 ? (this.completedTasks / this.totalTasks) * 100 : 0;
    this.progressBar.style.width = `${progress}%`;
    this.progressText.textContent = `${Math.floor(progress)}%`;

    if (progress >= 100) {
      this.completeLoading();
    }
  }

  /**
   * Set loading status text.
   */
  setStatus(status: string): void {
    if (this.statusText) {
      this.statusText.textContent = status;
    }
  }

  /**
   * Start timing the loading process.
   */
  start(): void {
    if (this.initialized) {return;}
    this.initialized = true;
    this.startTime = performance.now();
  }

  /**
   * Finish loading and remove the loading screen.
   */
  completeLoading(): void {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        this.loadingScreen?.remove();
        this.loadingScreen = null;
      }, 400);
    }
  }

  /**
   * Show error message on loading screen.
   */
  showError(error: Error | unknown): void {
    if (this.statusText) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusText.textContent = `Error: ${message}`;
      this.statusText.style.color = '#ff4444';
    }
  }

  /**
   * Initialize loading manager (creates screen and starts timing).
   */
  init(): void {
    this.createLoadingScreen();
    this.start();
  }

  /**
   * Alias for setStatus (for backward compatibility).
   */
  updateStatus(status: string): void {
    this.setStatus(status);
  }

  /**
   * Alias for completeLoading (for backward compatibility).
   */
  async complete(): Promise<void> {
    this.completeLoading();
  }

  /**
   * Preload an icon and cache its URL.
   */
  async preloadIcon(name: string): Promise<string> {
    if (this.cache.icons.has(name)) {
      return this.cache.icons.get(name)!;
    }
    const url = getIconPath(name);
    this.cache.icons.set(name, url);
    return url;
  }

  /**
   * Get a diagnostic summary of loading tasks.
   */
  getDiagnostics(): string[] {
    return [...this.diagnostics];
  }
}

const loadingManager = new LoadingManager();

export default loadingManager;
