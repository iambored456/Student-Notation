// js/bootstrap/input/initInputAndDiagnostics.ts
import { initKeyboardHandler } from '@services/keyboardHandler.ts';
import { initSpacebarHandler } from '@services/spacebarHandler.ts';
import logger from '@utils/logger.ts';
import { initUIDiagnostics } from '@utils/uiDiagnostics.ts';

export function initInputAndDiagnostics() {
  logger.section('SETTING UP INPUT HANDLERS');
  initKeyboardHandler();
  initSpacebarHandler();

  // Optionally enable UI diagnostics if present
  if ((window as typeof window & { enableUIDiagnostics?: boolean }).enableUIDiagnostics) {
    initUIDiagnostics();
  }
}
