// js/services/synthEngine.js
import * as Tone from 'tone';
import store from '../state/index.js';
import { PRESETS } from './presetData.js';
import logger from '../utils/logger.js';
import { getFilteredCoefficients } from '../components/audio/HarmonicsFilter/harmonicBins.js';

logger.moduleLoaded('SynthEngine');

// === Gain Staging Constants ===
const POLYPHONY_CEILING = 8; // Maximum expected simultaneous voices
const PER_VOICE_BASELINE_GAIN = 1.0 / Math.sqrt(POLYPHONY_CEILING); // ≈0.354 linear amplitude
const SMOOTHING_TAU_MS = 200; // Smoothing window duration
const MASTER_GAIN_RAMP_MS = 50; // Ramp time for gain changes to avoid zipper noise
const GAIN_UPDATE_INTERVAL = "32n"; // Update master gain every 32nd note (~realistic for musical changes)

let synths = {};
let masterGain; // Master gain with polyphony-aware scaling
let volumeControl; // User-controllable volume (independent of auto-gain)
let compressor; // Bus compressor for gentle leveling
let limiter; // Final safety limiter
let clippingMeter; // Meter for detecting near-clipping levels
let waveformAnalyzers = {}; // Store analyzers for waveform visualization
let activeVoiceCount = 0; // Track total active voices across all synths (instantaneous)
let smoothedVoiceCount = POLYPHONY_CEILING; // Initialize to ceiling to avoid initial boost
let gainUpdateLoopId = null; // ID for scheduled gain updates

/**
 * Update smoothed voice count using exponential moving average
 * and adjust master gain to maintain stable output level
 */
function updateMasterGain() {
    if (!masterGain) return;

    const now = Tone.now();

    // If no voices are active, don't update (keep current gain to avoid pumping on silence)
    if (activeVoiceCount === 0) {
        // Slowly decay smoothed count back toward ceiling for next note
        const alpha = 0.01; // Very slow decay
        smoothedVoiceCount = alpha * POLYPHONY_CEILING + (1 - alpha) * smoothedVoiceCount;
        return;
    }

    // Calculate exponential moving average (EMA) smoothing factor
    // α = 1 - e^(-ΔT/τ), where ΔT is update interval (16ms), τ is time constant (200ms)
    const deltaT = 0.016; // 16ms update interval
    const alpha = 1 - Math.exp(-deltaT / (SMOOTHING_TAU_MS / 1000));

    // Smooth the voice count (clamp between 1 and ceiling)
    const currentVoices = Math.max(1, Math.min(POLYPHONY_CEILING, activeVoiceCount));
    smoothedVoiceCount = alpha * currentVoices + (1 - alpha) * smoothedVoiceCount;

    // Calculate master gain: reduce gain as voice count increases
    // At 1 voice: gain = baseline × (ceiling/1) = baseline × 8 (boost solo notes)
    // At ceiling voices: gain = baseline × (ceiling/ceiling) = baseline × 1 (no extra boost)
    const scaleFactor = Math.sqrt(POLYPHONY_CEILING / smoothedVoiceCount);
    const targetGain = PER_VOICE_BASELINE_GAIN * scaleFactor;

    // Ramp to new gain to avoid zipper noise and abrupt level changes
    masterGain.gain.rampTo(targetGain, MASTER_GAIN_RAMP_MS / 1000, now);
}

// A custom synth voice with a more sophisticated series/parallel filter blend
class FilteredVoice extends Tone.Synth {
    constructor(options) {
        super(options);

        // --- Create all necessary audio nodes ---
        this.presetGain = new Tone.Gain(options.gain || 1.0); // Gain node for preset volume compensation
        
        // --- Vibrato LFO and frequency modulation ---
        this.vibratoLFO = new Tone.LFO(0, 0); // Start with 0 rate and 0 depth
        this.vibratoDepth = new Tone.Scale(-1, 1); // Map LFO (-1 to +1) to -1 to +1 for bidirectional vibrato
        this.vibratoGain = new Tone.Gain(0); // Control vibrato intensity
        
        // Connect vibrato chain: LFO -> Scale -> Gain -> Oscillator frequency
        this.vibratoLFO.connect(this.vibratoDepth);
        this.vibratoDepth.connect(this.vibratoGain);
        this.vibratoGain.connect(this.oscillator.frequency);
        
        // --- Tremolo LFO and amplitude modulation ---
        this.tremoloLFO = new Tone.LFO(0, 0); // Start with 0 rate and 0 depth
        this.tremoloDepth = new Tone.Scale(0, 1); // Map LFO (-1 to +1) to (0 to 1) for amplitude modulation
        this.tremoloGain = new Tone.Gain(1); // Will be modulated by tremolo LFO
        
        // Connect tremolo chain: LFO -> Scale -> Gain
        this.tremoloLFO.connect(this.tremoloDepth);
        this.tremoloDepth.connect(this.tremoloGain.gain);
        
        // Don't start the LFOs automatically - they will be started only when effects are enabled
        // This saves CPU resources when effects are not in use
        
        // Filters for the three distinct paths
        this.hpFilter = new Tone.Filter({ type: "highpass" });
        this.lpFilterForBP = new Tone.Filter({ type: "lowpass" }); // This LPF is part of the bandpass chain
        this.lpFilterSolo = new Tone.Filter({ type: "lowpass" }); // This LPF is for the pure lowpass sound

        // Gain nodes to tap the audio from different points in the chain
        this.hpOutput = new Tone.Gain();
        this.bpOutput = new Tone.Gain();
        this.lpOutput = new Tone.Gain();
        
        // Cross-faders to blend between the three outputs
        this.hp_bp_fade = new Tone.CrossFade(0); 
        this.main_fade = new Tone.CrossFade(0);
        
        // Wet/Dry control for filter bypass
        this.wetDryFade = new Tone.CrossFade(0);

        // --- UPDATED Audio Routing ---
        // 1. Oscillator -> Preset Gain Node
        this.oscillator.connect(this.presetGain);

        // 2. Preset Gain -> Dry Path & Wet Path (start)
        this.presetGain.connect(this.wetDryFade.a); // Dry Path
        
        // 3. Setup Wet Path (now fed from presetGain)
        // A) High-Pass path
        this.presetGain.connect(this.hpFilter);
        this.hpFilter.connect(this.hpOutput); // Tap the pure HP signal here

        // B) Band-Pass path (HPF -> LPF in series)
        this.hpFilter.connect(this.lpFilterForBP);
        this.lpFilterForBP.connect(this.bpOutput); // Tap the BP signal here
        
        // C) Low-Pass path (a separate, parallel LPF)
        this.presetGain.connect(this.lpFilterSolo);
        this.lpFilterSolo.connect(this.lpOutput); // Tap the pure LP signal here

        // 4. Route the three paths into the blender
        this.hpOutput.connect(this.hp_bp_fade.a);
        this.bpOutput.connect(this.hp_bp_fade.b);
        this.lpOutput.connect(this.main_fade.b);
        this.hp_bp_fade.connect(this.main_fade.a);

        // 5. Connect the blended (wet) signal to the wet/dry fader
        this.main_fade.connect(this.wetDryFade.b); 

        // 6. Apply tremolo gain to the signal before the envelope
        this.wetDryFade.connect(this.tremoloGain);
        
        // 7. Final output goes to the main amplitude envelope
        this.tremoloGain.connect(this.envelope);

        if (options.filter) {
            this._setFilter(options.filter);
        }
        
        if (options.vibrato) {
            this._setVibrato(options.vibrato);
        } else {
            // Initialize with default vibrato if not provided (disabled)
            this._setVibrato({ speed: 0, span: 0 });
        }
        
        if (options.tremelo) { // Note: using 'tremelo' spelling for consistency
            this._setTremolo(options.tremelo);
        } else {
            // Initialize with default tremolo if not provided (disabled)
            this._setTremolo({ speed: 0, span: 0 });
        }
    }

    _setPresetGain(value) {
        if (this.presetGain) {
            this.presetGain.gain.value = value;
        }
    }
    
    _setVibrato(params, time = Tone.now()) {
        if (this.vibratoLFO && this.vibratoGain) {
            // Convert 0-100% speed to 0-16 Hz (linear mapping)
            const speedHz = (params.speed / 100) * 16;
            
            // If speed is 0 or span is 0, disable vibrato completely
            if (params.speed === 0 || params.span === 0) {
                // Stop the LFO completely to save CPU
                this.vibratoLFO.stop(time);
                this.vibratoLFO.frequency.value = 0;
                this.vibratoGain.gain.value = 0;
                return;
            }
            
            // Start LFO if it was stopped
            if (this.vibratoLFO.state !== 'started') {
                this.vibratoLFO.start(time);
            }
            
            this.vibratoLFO.frequency.value = speedHz;
            
            // Convert 0-100% span to proper Hz deviation
            // 100% span = ±50 cents maximum deviation
            const maxCents = 50; // Maximum ±50 cents for 100% span
            const centsAmplitude = (params.span / 100) * maxCents;
            
            // Convert cents to Hz deviation for frequency modulation
            // For a note at frequency f, n cents deviation = f * (2^(n/1200) - 1)
            // Since we don't know the exact frequency, we'll use a scaling factor
            // 1 cent ≈ 0.0578% frequency change, so 50 cents ≈ 2.89% 
            // For a 440Hz note: 50 cents ≈ 12.7 Hz deviation
            // We'll use a ratio-based approach: cents/1200 gives us the semitone fraction
            const centRatio = centsAmplitude / 1200; // Convert cents to semitone fraction
            const hzDeviationFactor = Math.pow(2, centRatio) - 1; // Frequency multiplier for the cents
            
            // For vibrato, we need a reasonable Hz range. Using 440Hz as reference:
            const referenceFreq = 440; // A4 as reference
            const hzDeviation = referenceFreq * hzDeviationFactor;
            
            this.vibratoGain.gain.value = hzDeviation;
            console.log('Audio vibrato gain set to:', hzDeviation, 'Hz (for', centsAmplitude, 'cents)');
            
        }
    }
    
    _setTremolo(params, time = Tone.now()) {
        if (this.tremoloLFO && this.tremoloGain) {
            // Convert 0-100% speed to 0-16 Hz (linear mapping)
            const speedHz = (params.speed / 100) * 16;
            
            // If speed is 0 or span is 0, disable tremolo completely
            if (params.speed === 0 || params.span === 0) {
                // Stop the LFO completely to save CPU
                this.tremoloLFO.stop(time);
                this.tremoloLFO.frequency.value = 0;
                // Reset gain to 1.0 (no attenuation)
                this.tremoloGain.gain.cancelScheduledValues(time);
                this.tremoloGain.gain.value = 1.0;
                return;
            }
            
            // Start LFO if it was stopped
            if (this.tremoloLFO.state !== 'started') {
                this.tremoloLFO.start(time);
            }
            
            this.tremoloLFO.frequency.value = speedHz;
            
            // Convert 0-100% span to amplitude modulation depth
            // 100% span means oscillating between 0% and 100% of original amplitude
            // 50% span means oscillating between 25% and 100% of original amplitude
            const spanAmount = params.span / 100; // 0 to 1
            
            // Set tremolo depth scale to modulate from (1 - span/2) to 1.0
            // This means the amplitude oscillates symmetrically around a center point
            const minGain = Math.max(0, 1 - spanAmount); // Never go below 0
            const maxGain = 1.0;
            
            // Configure the Scale node to map LFO output (-1 to +1) to (minGain to maxGain)
            this.tremoloDepth.min = minGain;
            this.tremoloDepth.max = maxGain;
        }
    }
    
    _setFilter(params) {
        this.wetDryFade.fade.value = params.enabled ? 1 : 0;

        const freq = Tone.Midi(params.cutoff + 35).toFrequency();
        const q = (params.resonance / 100) * 12 + 0.1;

        // Set parameters on all three filters
        this.hpFilter.set({ frequency: freq, Q: q });
        this.lpFilterForBP.set({ frequency: freq, Q: q });
        this.lpFilterSolo.set({ frequency: freq, Q: q });

        const blend = params.blend; 

        // Blend from HP (0) -> BP (1)
        if (blend <= 1.0) {
            this.main_fade.fade.value = 0; // Select the HP/BP fader
            this.hp_bp_fade.fade.value = blend;
        } 
        // Blend from BP (1) -> LP (2)
        else {
            this.main_fade.fade.value = blend - 1.0;
            this.hp_bp_fade.fade.value = 1.0; // Keep the input to the main fader as pure BP
        }
    }
}

const SynthEngine = {
    init() {
        // === Build Master Audio Chain ===
        // Signal flow: synths → masterGain → volumeControl → compressor → limiter → destination

        // 1. Master gain node (polyphony-aware scaling with smoothing)
        masterGain = new Tone.Gain(PER_VOICE_BASELINE_GAIN);

        // 2. User volume control (independent of automatic gain scaling)
        volumeControl = new Tone.Volume(0); // Start at 0dB, user can adjust

        // 3. Bus compressor (gentle glue, transparent action)
        compressor = new Tone.Compressor({
            threshold: -12,  // Catches peaks above moderate level
            ratio: 3,        // Musical compression, preserves dynamics
            attack: 0.01,    // 10ms - fast enough for transients, slow enough for punch
            release: 0.1,    // 100ms - tracks phrase-level changes
            knee: 6          // Soft knee for transparent action
        });

        // 4. True-peak limiter (safety net, should rarely engage)
        limiter = new Tone.Limiter(-3.0); // -3.0dB ceiling for safe headroom

        // 5. Clipping detection meter
        clippingMeter = new Tone.Meter();

        // Connect chain: masterGain → volumeControl → compressor → limiter → destination → meter
        masterGain.connect(volumeControl);
        volumeControl.connect(compressor);
        compressor.connect(limiter);
        limiter.toDestination();
        limiter.connect(clippingMeter);

        // Start monitoring for clipping every 500ms
        setInterval(() => {
            const level = clippingMeter.getValue();
            if (level > -3.0) {
                // Approaching limiter threshold - clipping detected
            }
        }, 500);


        for (const color in store.state.timbres) {
            const timbre = store.state.timbres[color];
            // Use filtered coefficients instead of raw store coefficients
            const filteredCoeffs = getFilteredCoefficients(color);

            // Dynamic amplitude scaling: use direct sum if ≤ 1.0, normalize if > 1.0
            const totalAmplitude = filteredCoeffs.reduce((sum, coeff) => sum + Math.abs(coeff), 0);

            // Apply normalization to coefficients if total > 1.0
            const normalizedCoeffs = totalAmplitude > 1.0
                ? filteredCoeffs.map(coeff => coeff / totalAmplitude)
                : filteredCoeffs;

            // Use preset gain from timbre state, fallback to 1.0 if not set
            const presetGain = timbre.gain || 1.0;

            const synth = new Tone.PolySynth({
                polyphony: 8,
                voice: FilteredVoice,
                options: {
                    oscillator: { type: 'custom', partials: Array.from(normalizedCoeffs) },
                    envelope: timbre.adsr,
                    filter: timbre.filter,
                    vibrato: timbre.vibrato,
                    tremelo: timbre.tremelo, // Note: using 'tremelo' spelling for consistency
                    gain: presetGain
                }
            }).connect(masterGain);

            // Apply synth-level effects (reverb/delay) if audioEffectsManager is available
            if (window.audioEffectsManager) {
                window.audioEffectsManager.applySynthEffects(synth, color, masterGain);
            }

            // Hook into voice creation to apply vibrato to new voices
            const originalTriggerAttack = synth.triggerAttack;
            synth.triggerAttack = function(...args) {
                const result = originalTriggerAttack.apply(this, args);
                
                // Apply current settings to any newly created voices using _getVoice
                setTimeout(() => {
                    // Try different approaches to access voices in PolySynth
                    const activeVoices = this._activeVoices;
                    
                    // NOTE: Re-enabled audioEffectsManager with proper routing
                    // Effects (reverb/delay) connect to masterGain to preserve gain chain
                    // Vibrato and tremolo are applied directly via _setVibrato/_setTremolo

                    if (window.audioEffectsManager) {
                        // DISABLED: This reconnects voices and bypasses masterGain
                        if (activeVoices && activeVoices.size > 0) {
                            // Iterate through active voices in the Map
                            activeVoices.forEach((voice, note) => {
                                if (!voice.effectsApplied) {
                                    window.audioEffectsManager.applyEffectsToVoice(voice, color);
                                    voice.effectsApplied = true; // Mark as applied
                                }
                            });
                        } else {
                            // Try accessing through _voices property if available
                            if (this._voices && Array.isArray(this._voices)) {
                                this._voices.forEach((voice, index) => {
                                    if (voice && !voice.effectsApplied) {
                                        window.audioEffectsManager.applyEffectsToVoice(voice, color);
                                        voice.effectsApplied = true;
                                    }
                                });
                            }
                        }
                    } else {
                        // Fallback to legacy approach if new architecture not available
                        if (activeVoices && activeVoices.size > 0) {
                            activeVoices.forEach((voice, note) => {
                                if (voice._setVibrato && voice.vibratoApplied !== true) {
                                    voice._setVibrato(this._currentVibrato);
                                    voice.vibratoApplied = true;
                                }
                                if (voice._setTremolo && voice.tremoloApplied !== true) {
                                    voice._setTremolo(this._currentTremolo);
                                    voice.tremoloApplied = true;
                                }
                            });
                        } else {
                            if (this._voices && Array.isArray(this._voices)) {
                                this._voices.forEach((voice, index) => {
                                    if (voice && voice._setVibrato && voice.vibratoApplied !== true) {
                                        voice._setVibrato(this._currentVibrato);
                                        voice.vibratoApplied = true;
                                    }
                                    if (voice && voice._setTremolo && voice.tremoloApplied !== true) {
                                        voice._setTremolo(this._currentTremolo);
                                        voice.tremoloApplied = true;
                                    }
                                });
                            }
                        }
                    }
                }, 10); // Slightly longer delay to ensure voice creation
                
                return result;
            };
            // Store current settings on synth for future reference
            synth._currentVibrato = timbre.vibrato;
            synth._currentTremolo = timbre.tremelo; // Note: using 'tremelo' spelling for consistency
            synth._currentFilter = timbre.filter;
            
            synths[color] = synth;
            logger.debug('SynthEngine', `Created filtered synth for color: ${color}`, null, 'audio');
        }

        store.on('timbreChanged', (color) => {
            this.updateSynthForColor(color);
        });
        
        store.on('filterChanged', (color) => {
            this.updateSynthForColor(color);
        });
        
        // Listen to new audio effect events from effects coordinator
        store.on('audioEffectChanged', ({ effectType, parameter, value, color, effectParams }) => {
            
            // Update synth for any audio effect change
            this.updateSynthForColor(color);
        });
        
        store.on('volumeChanged', (dB) => this.setVolume(dB));

        // Start scheduled master gain updates for smooth polyphony-aware scaling
        // Using setInterval for reliability (runs independent of Tone.Transport)
        const UPDATE_INTERVAL_MS = 16; // ~60 Hz, fast enough for smooth gain changes
        gainUpdateLoopId = setInterval(() => {
            updateMasterGain();
        }, UPDATE_INTERVAL_MS);


        logger.info('SynthEngine', 'Initialized with multi-timbral support', null, 'audio');
        window.synthEngine = this;
    },

    updateSynthForColor(color) {
        const timbre = store.state.timbres[color];
        const synth = synths[color];
        if (!synth || !timbre) return;
        
        // Initialize vibrato if it doesn't exist (for existing timbres)
        if (!timbre.vibrato) {
            timbre.vibrato = {
                speed: 0,
                span: 0
            };
            logger.debug('SynthEngine', `Initialized vibrato for color ${color}`, timbre.vibrato, 'audio');
        }
        
        // Initialize tremolo if it doesn't exist (for existing timbres)
        if (!timbre.tremelo) {
            timbre.tremelo = {
                speed: 0,
                span: 0
            };
            logger.debug('SynthEngine', `Initialized tremolo for color ${color}`, timbre.tremelo, 'audio');
        }
        
        logger.debug('SynthEngine', `Updating timbre for color ${color}`, null, 'audio');
        
        // Use filtered coefficients instead of raw store coefficients
        const filteredCoeffs = getFilteredCoefficients(color);
        
        // Dynamic amplitude scaling: use direct sum if ≤ 1.0, normalize if > 1.0
        const totalAmplitude = filteredCoeffs.reduce((sum, coeff) => sum + Math.abs(coeff), 0);
        const dynamicGain = totalAmplitude <= 1.0 ? totalAmplitude : 1.0;

        // Apply normalization to coefficients if total > 1.0
        const normalizedCoeffs = totalAmplitude > 1.0 
            ? filteredCoeffs.map(coeff => coeff / totalAmplitude)
            : filteredCoeffs;
            
        synth.set({
            oscillator: { partials: Array.from(normalizedCoeffs) },
            envelope: timbre.adsr
        });

        // Re-apply synth-level effects (reverb/delay) when timbre changes
        if (window.audioEffectsManager) {
            window.audioEffectsManager.applySynthEffects(synth, color, masterGain);
        }

        // Update stored settings on synth for future voices (legacy support)
        synth._currentVibrato = timbre.vibrato;
        synth._currentTremolo = timbre.tremelo; // Note: using 'tremelo' spelling for consistency
        synth._currentFilter = timbre.filter;
        // Try setting parameters on existing voices
        const activeVoices = synth._activeVoices;
        
        if (activeVoices && activeVoices.size > 0) {
            activeVoices.forEach((voice, note) => {
                if (voice._setFilter) {
                    voice._setFilter(timbre.filter);
                }
                if (voice._setVibrato) {
                    voice._setVibrato(timbre.vibrato);
                    voice.vibratoApplied = true; // Mark as updated
                } else {
                }
                if (voice._setTremolo) {
                    voice._setTremolo(timbre.tremelo);
                    voice.tremoloApplied = true; // Mark as updated
                } else {
                }
                if (voice._setPresetGain) {
                    // Use preset gain from timbre state, fallback to 1.0 if not set
                    const presetGain = timbre.gain || 1.0;
                    voice._setPresetGain(presetGain);
                } else {
                }
            });
        } else {
            // Try _voices array as backup
            if (synth._voices && Array.isArray(synth._voices)) {
                synth._voices.forEach((voice, index) => {
                    if (voice && voice._setVibrato) {
                        voice._setVibrato(timbre.vibrato);
                        voice.vibratoApplied = true;
                    }
                    if (voice && voice._setTremolo) {
                        voice._setTremolo(timbre.tremelo);
                        voice.tremoloApplied = true;
                    }
                    if (voice && voice._setFilter) {
                        voice._setFilter(timbre.filter);
                    }
                    if (voice && voice._setPresetGain) {
                        // Use preset gain from timbre state, fallback to 1.0 if not set
                        const presetGain = timbre.gain || 1.0;
                        voice._setPresetGain(presetGain);
                    }
                });
            }
        }
    },
    
    setVolume(dB) {
        if (volumeControl) {
            volumeControl.volume.value = dB;
        }
    },

    async playNote(pitch, duration, time = Tone.now()) {
        // Use global audio initialization to ensure user gesture compliance
        const audioInit = window.initAudio || (() => Tone.start());
        await audioInit();
        const color = store.state.selectedNote?.color;
        const synth = color ? synths[color] : null;
        if (synth) {
            synth.triggerAttackRelease(pitch, duration, time);
        }
    },

    triggerAttack(pitch, color, time = Tone.now(), isDrum = false) {
        const synth = synths[color];
        if (synth) {
            // Increment active voice count (scheduled loop will update master gain smoothly)
            activeVoiceCount++;

            if (isDrum && window.getDrumVolume) {
                // Apply drum volume by temporarily adjusting synth volume
                const drumVolume = window.getDrumVolume();
                const originalVolume = synth.volume.value;
                const drumVolumeDB = originalVolume + 20 * Math.log10(drumVolume);
                synth.volume.value = drumVolumeDB;

                synth.triggerAttack(pitch, time);
                // Reset volume after a short delay to avoid affecting other sounds
                setTimeout(() => {
                    if (synth && synth.volume) synth.volume.value = originalVolume;
                }, 100);
            } else {
                synth.triggerAttack(pitch, time);
            }
        }
    },
    
    triggerRelease(pitch, color, time = Tone.now()) {
        const synth = synths[color];
        if (synth) {
            synth.triggerRelease(pitch, time);

            // Decrement active voice count (scheduled loop will update master gain smoothly)
            activeVoiceCount = Math.max(0, activeVoiceCount - 1);
        }
    },

    releaseAll() {
        for (const color in synths) {
            synths[color].releaseAll();
        }
        // Reset voice count when all voices are released (scheduled loop will update master gain)
        activeVoiceCount = 0;
    },

    // ===============================================
    // WAVEFORM VISUALIZATION METHODS
    // ===============================================

    /**
     * Creates a waveform analyzer for a specific color/synth
     * @param {string} color - The color key for the synth
     * @returns {Tone.Analyser} The analyser node
     */
    createWaveformAnalyzer(color) {
        const synth = synths[color];
        if (!synth) {
            logger.warn('SynthEngine', `No synth found for color: ${color}`, null, 'audio');
            return null;
        }

        // Create analyzer if it doesn't exist
        if (!waveformAnalyzers[color]) {
            waveformAnalyzers[color] = new Tone.Analyser('waveform', 1024);
            
            // Connect the synth output to the analyzer (before it goes to volume control)
            // We need to tap into the synth's output without affecting the audio routing
            synth.connect(waveformAnalyzers[color]);
            
            logger.debug('SynthEngine', `Created waveform analyzer for color: ${color}`, null, 'waveform');
        }

        return waveformAnalyzers[color];
    },

    /**
     * Gets the waveform analyzer for a specific color
     * @param {string} color - The color key
     * @returns {Tone.Analyser|null} The analyser node or null if not found
     */
    getWaveformAnalyzer(color) {
        return waveformAnalyzers[color] || null;
    },

    /**
     * Gets all active waveform analyzers
     * @returns {Map<string, Tone.Analyser>} Map of color to analyzer
     */
    getAllWaveformAnalyzers() {
        const activeAnalyzers = new Map();
        for (const color in waveformAnalyzers) {
            if (waveformAnalyzers[color]) {
                activeAnalyzers.set(color, waveformAnalyzers[color]);
            }
        }
        return activeAnalyzers;
    },

    /**
     * Removes a waveform analyzer for a specific color
     * @param {string} color - The color key
     */
    removeWaveformAnalyzer(color) {
        if (waveformAnalyzers[color]) {
            waveformAnalyzers[color].dispose();
            delete waveformAnalyzers[color];
            logger.debug('SynthEngine', `Removed waveform analyzer for color: ${color}`, null, 'waveform');
        }
    },

    /**
     * Cleans up all waveform analyzers
     */
    disposeAllWaveformAnalyzers() {
        for (const color in waveformAnalyzers) {
            if (waveformAnalyzers[color]) {
                waveformAnalyzers[color].dispose();
            }
        }
        waveformAnalyzers = {};
        logger.debug('SynthEngine', 'Disposed all waveform analyzers', null, 'waveform');
    },

    /**
     * Gets the synth instance for a specific color (for advanced integrations)
     * @param {string} color - The color key
     * @returns {Tone.PolySynth|null} The synth instance or null if not found
     */
    getSynth(color) {
        return synths[color] || null;
    },

    /**
     * Gets all synth instances
     * @returns {object} Object mapping colors to synth instances
     */
    getAllSynths() {
        return { ...synths };
    },

    /**
     * Gets the main volume control node for connecting external audio sources
     * @returns {Tone.Volume|null} The main volume control node
     */
    getMainVolumeNode() {
        return volumeControl || null;
    },

    /**
     * Gets the master gain node for connecting audio effects
     * Effects should connect to masterGain to preserve the gain staging chain
     * @returns {Tone.Gain|null} The master gain node
     */
    getMasterGainNode() {
        return masterGain || null;
    }
};

export default SynthEngine;
