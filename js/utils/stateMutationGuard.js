// js/utils/stateMutationGuard.js
// Development-mode state mutation detection and prevention system

let isDevMode = false;
let mutationLog = [];
let stateSnapshot = null;

/**
 * Enable development mode state mutation detection
 */
export function enableStateMutationDetection() {
    isDevMode = true;
    console.log('🛡️ [STATE GUARD] State mutation detection enabled');
}

/**
 * Disable state mutation detection
 */
export function disableStateMutationDetection() {
    isDevMode = false;
    console.log('🛡️ [STATE GUARD] State mutation detection disabled');
}

/**
 * Create a deep snapshot of the state for comparison
 */
function createStateSnapshot(state) {
    try {
        return JSON.parse(JSON.stringify(state, (key, value) => {
            // Handle Float32Array serialization
            if (value instanceof Float32Array) {
                return { __type: 'Float32Array', data: Array.from(value) };
            }
            return value;
        }));
    } catch (error) {
        console.warn('🛡️ [STATE GUARD] Failed to create state snapshot:', error);
        return null;
    }
}

/**
 * Compare two state snapshots and detect mutations
 */
function detectMutations(oldState, newState, path = 'root') {
    const mutations = [];
    
    if (!oldState || !newState) return mutations;
    
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
                path: `${path}.${key}`,
                type: 'property_added',
                newValue: newState[key],
                timestamp: Date.now()
            });
        } else if (!(key in newState)) {
            mutations.push({
                path: `${path}.${key}`,
                type: 'property_removed',
                oldValue: oldState[key],
                timestamp: Date.now()
            });
        } else {
            const childMutations = detectMutations(oldState[key], newState[key], `${path}.${key}`);
            mutations.push(...childMutations);
        }
    }
    
    return mutations;
}

/**
 * Take a snapshot of the current state
 */
export function snapshotState(state) {
    if (!isDevMode) return;
    
    stateSnapshot = createStateSnapshot(state);
    console.log('🛡️ [STATE GUARD] State snapshot taken');
}

/**
 * Check for unauthorized state mutations
 */
export function checkForMutations(currentState, actionName = 'unknown') {
    if (!isDevMode || !stateSnapshot) return;
    
    const currentSnapshot = createStateSnapshot(currentState);
    const mutations = detectMutations(stateSnapshot, currentSnapshot);
    
    if (mutations.length > 0) {
        const criticalMutations = mutations.filter(m => 
            !m.path.includes('paint.paintHistory') && // Allow paint history changes
            !m.path.includes('tempo') && // Allow tempo changes
            !m.path.includes('isPlaying') && // Allow playback state changes
            !m.path.includes('fullRowData') // Allow fullRowData initialization
        );
        
        if (criticalMutations.length > 0) {
            console.error('🚨 [STATE GUARD] Unauthorized state mutations detected!', {
                action: actionName,
                mutations: criticalMutations,
                totalMutations: mutations.length,
                criticalMutations: criticalMutations.length
            });
            
            // Log detailed mutation info
            criticalMutations.forEach(mutation => {
                console.error('🚨 [STATE MUTATION]', {
                    path: mutation.path,
                    type: mutation.type,
                    oldValue: mutation.oldValue,
                    newValue: mutation.newValue,
                    action: actionName
                });
            });
            
            mutationLog.push({
                action: actionName,
                mutations: criticalMutations,
                timestamp: Date.now()
            });
        } else {
            console.log('🛡️ [STATE GUARD] Non-critical state changes detected:', {
                action: actionName,
                allowedMutations: mutations.length
            });
        }
    } else {
        console.log('🛡️ [STATE GUARD] No mutations detected for action:', actionName);
    }
    
    // Update snapshot for next check
    stateSnapshot = currentSnapshot;
}

/**
 * Get the mutation log for debugging
 */
export function getMutationLog() {
    return [...mutationLog];
}

/**
 * Clear the mutation log
 */
export function clearMutationLog() {
    mutationLog = [];
    console.log('🛡️ [STATE GUARD] Mutation log cleared');
}

/**
 * Create a protected store wrapper that detects direct mutations
 */
export function createProtectedStore(store) {
    if (!isDevMode) return store;
    
    const handler = {
        get(target, prop) {
            const value = target[prop];
            
            // If accessing state, create a proxy to detect mutations
            if (prop === 'state') {
                return createProtectedState(value, 'state');
            }
            
            return value;
        },
        
        set(target, prop, value) {
            if (prop === 'state') {
                console.error('🚨 [STATE GUARD] Direct state assignment detected!', {
                    property: prop,
                    value: value,
                    stack: new Error().stack
                });
            }
            
            target[prop] = value;
            return true;
        }
    };
    
    return new Proxy(store, handler);
}

/**
 * Create a protected state object that detects direct mutations
 */
function createProtectedState(state, path) {
    if (!state || typeof state !== 'object') return state;
    
    const handler = {
        get(target, prop) {
            const value = target[prop];
            
            // Recursively protect nested objects
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Float32Array)) {
                return createProtectedState(value, `${path}.${prop}`);
            }
            
            return value;
        },
        
        set(target, prop, value) {
            console.error('🚨 [STATE GUARD] Direct state mutation detected!', {
                path: `${path}.${prop}`,
                oldValue: target[prop],
                newValue: value,
                stack: new Error().stack
            });
            
            // Allow the mutation in dev mode, but log it
            target[prop] = value;
            return true;
        }
    };
    
    return new Proxy(state, handler);
}

// Debug utilities for console
window.stateGuard = {
    enable: enableStateMutationDetection,
    disable: disableStateMutationDetection,
    getLog: getMutationLog,
    clearLog: clearMutationLog
};