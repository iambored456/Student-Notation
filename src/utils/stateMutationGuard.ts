// Development-mode state mutation detection and prevention system

type AnyState = Record<string, any>;

type MutationType =
  | 'type_change'
  | 'value_change'
  | 'array_to_non_array'
  | 'array_length_change'
  | 'property_added'
  | 'property_removed';

interface MutationEntry {
  path: string;
  type: MutationType | 'direct_state_mutation' | 'direct_state_assignment';
  oldValue?: unknown;
  newValue?: unknown;
  oldLength?: number;
  newLength?: number;
  newType?: string;
  timestamp: number;
}

interface MutationLogEntry {
  action: string;
  mutations?: MutationEntry[];
  property?: string | symbol;
  path?: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  stack?: string;
  timestamp: number;
}

let isDevMode = false;
let mutationLog: MutationLogEntry[] = [];
let stateSnapshot: AnyState | null = null;

/**
 * Enable development mode state mutation detection.
 */
export function enableStateMutationDetection(): void {
  isDevMode = true;
}

/**
 * Disable state mutation detection.
 */
export function disableStateMutationDetection(): void {
  isDevMode = false;
}

/**
 * Create a deep snapshot of the state for comparison.
 */
function createStateSnapshot<T>(state: T): T | null {
  try {
    return JSON.parse(JSON.stringify(state, (_key, value) => {
      if (value instanceof Float32Array) {
        return { __type: 'Float32Array', data: Array.from(value) };
      }
      return value;
    }));
  } catch {
    return null;
  }
}

/**
 * Compare two state snapshots and detect mutations.
 */
function detectMutations(oldState: any, newState: any, path = 'root'): MutationEntry[] {
  const mutations: MutationEntry[] = [];

  if (!oldState || !newState) {return mutations;}

  // Handle different types
  if (typeof oldState !== typeof newState) {
    mutations.push({
      path,
      type: 'type_change',
      oldValue: typeof oldState,
      newValue: typeof newState,
      timestamp: Date.now()
    });
    return mutations;
  }

  if (typeof oldState !== 'object') {
    if (oldState !== newState) {
      mutations.push({
        path,
        type: 'value_change',
        oldValue: oldState,
        newValue: newState,
        timestamp: Date.now()
      });
    }
    return mutations;
  }

  // Handle arrays
  if (Array.isArray(oldState)) {
    if (!Array.isArray(newState)) {
      mutations.push({
        path,
        type: 'array_to_non_array',
        oldLength: oldState.length,
        newType: typeof newState,
        timestamp: Date.now()
      });
      return mutations;
    }

    if (oldState.length !== newState.length) {
      mutations.push({
        path,
        type: 'array_length_change',
        oldLength: oldState.length,
        newLength: newState.length,
        timestamp: Date.now()
      });
    }

    const maxLength = Math.max(oldState.length, newState.length);
    for (let i = 0; i < maxLength; i++) {
      const childMutations = detectMutations(oldState[i], newState[i], `${path}[${i}]`);
      mutations.push(...childMutations);
    }

    return mutations;
  }

  // Handle objects
  const allKeys = new Set([...Object.keys(oldState), ...Object.keys(newState)]);
  for (const key of allKeys) {
    if (!(key in oldState)) {
      mutations.push({
        path: `${path}.${String(key)}`,
        type: 'property_added',
        newValue: (newState as AnyState)[key],
        timestamp: Date.now()
      });
    } else if (!(key in newState)) {
      mutations.push({
        path: `${path}.${String(key)}`,
        type: 'property_removed',
        oldValue: (oldState as AnyState)[key],
        timestamp: Date.now()
      });
    } else {
      const childMutations = detectMutations((oldState as AnyState)[key], (newState as AnyState)[key], `${path}.${String(key)}`);
      mutations.push(...childMutations);
    }
  }

  return mutations;
}

/**
 * Take a snapshot of the current state (call after initializing state).
 */
export function snapshotState(state: AnyState | null): void {
  stateSnapshot = createStateSnapshot(state);
}

export function checkForMutations(currentState: AnyState, actionName = 'unknown'): void {
  if (!isDevMode || !stateSnapshot) {return;}

  const currentSnapshot = createStateSnapshot(currentState);
  const mutations = detectMutations(stateSnapshot, currentSnapshot);

  if (mutations.length > 0) {
    const criticalMutations = mutations.filter(m =>
      !m.path.includes('tempo') &&
      !m.path.includes('isPlaying') &&
      !m.path.includes('fullRowData') &&
      !m.path.includes('columnWidths')
    );

    if (criticalMutations.length > 0) {
      mutationLog.push({
        action: actionName,
        mutations: criticalMutations,
        timestamp: Date.now()
      });
    }
  }

  // Update snapshot for next check
  stateSnapshot = currentSnapshot;
}

/**
 * Get the mutation log for debugging.
 */
export function getMutationLog(): MutationLogEntry[] {
  return [...mutationLog];
}

/**
 * Clear the mutation log.
 */
export function clearMutationLog(): void {
  mutationLog = [];
}

/**
 * Create a protected store wrapper that detects direct mutations.
 */
export function createProtectedStore<T extends Record<string, any>>(store: T): T {
  if (!isDevMode) {return store;}

  const handler: ProxyHandler<T> = {
    get(target, prop) {
      const value = (target as any)[prop];

      // If accessing state, create a proxy to detect mutations
      if (prop === 'state') {
        return createProtectedState(value, 'state');
      }

      return value;
    },

    set(target, prop, value) {
      if (prop === 'state') {
        mutationLog.push({
          action: 'direct_state_assignment',
          property: prop,
          value,
          stack: new Error().stack,
          timestamp: Date.now()
        });
      }

      (target as any)[prop] = value;
      return true;
    }
  };

  return new Proxy(store, handler);
}

/**
 * Create a protected state object that detects direct mutations.
 */
function createProtectedState(state: any, path: string): any {
  if (!state || typeof state !== 'object') {return state;}

  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target[prop];

      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Float32Array)) {
        return createProtectedState(value, `${path}.${String(prop)}`);
      }

      return value;
    },

    set(target, prop, value) {
      mutationLog.push({
        action: 'direct_state_mutation',
        path: `${path}.${String(prop)}`,
        oldValue: target[prop],
        newValue: value,
        stack: new Error().stack,
        timestamp: Date.now()
      });

      target[prop] = value;
      return true;
    }
  };

  return new Proxy(state, handler);
}

// Debug utilities for console
if (typeof window !== 'undefined') {
  window.stateGuard = {
    enable: enableStateMutationDetection,
    disable: disableStateMutationDetection,
    getLog: getMutationLog,
    clearLog: clearMutationLog
  };
}
