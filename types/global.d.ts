/* Global ambient declarations for browser-only helpers exposed on window */
declare global {
  interface PaintPlaybackService {
    onTransportStart?: () => void;
    onTransportStop?: () => void;
  }

  interface Window {
    PaintPlaybackService?: PaintPlaybackService;
    initAudio?: () => Promise<void>;
    scheduleCell?: (...args: unknown[]) => void;
    stateGuard?: {
      enable: () => void;
      disable: () => void;
      getLog: () => unknown[];
      clearLog: () => void;
    };
    __uiDiagnosticsTrackedElements?: { label: string; selector: string }[];
    __uiDiagnosticsInitialized?: boolean;
    __uiDiagnosticsAutoLog?: boolean;
    __uiDiagnosticsLastSnapshot?: unknown[];
    logUIState?: (reason?: string) => unknown;
    enableUIDiagnosticsAutoLog?: () => void;
    disableUIDiagnosticsAutoLog?: () => void;
    drumGridRenderer?: DrumGridRenderer;
    synthEngine?: any;
    audioEffectsManager?: any;
    getDrumVolume?: () => number;
  }
  interface DrumGridRenderer {
    animationFrameId: number | null;
    render(): void;
    startAnimationLoop(): void;
    stopAnimationLoop(): void;
  }
}

export {};
