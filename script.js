/**
 * ============================================================
 *  script.js — Mic Live Studio — Complete Application Logic
 * ============================================================
 *
 *  Audio graph (signal chain):
 *
 *   Microphone ──> Source ──> EQ (Low/Mid/High)
 *       │
 *       ├──> Voice Changer nodes (ring mod, filters)
 *       │
 *       ├──> Distortion (wet/dry)
 *       │
 *       ├──> Delay (wet/dry + feedback loop)
 *       │
 *       ├──> Reverb (convolver wet/dry)
 *       │
 *       └──> Gain ──> Analyser ──> Destination
 *
 *   Karaoke:
 *     Music file ──> MediaElementSource ──> Splitter
 *       ├──> Normal path (stereo mix)
 *       └──> Vocal removal path (L-R phase cancel) ──> Karaoke Gain
 *       Both merge ──> Destination
 *
 * ============================================================ */

// ══════════════════════════════════════════════════════════════
//  DOM REFERENCES
// ══════════════════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

const micBtn        = $('mic-btn');
const micBtnText    = $('mic-btn-text');
const micBtnIcon    = $('mic-btn-icon');
const statusBadge   = $('status-badge');

const gainSlider    = $('gain-slider');
const gainValue     = $('gain-value');
const muteBtn       = $('mute-btn');

const levelBar      = $('level-bar-l');
const levelDb       = $('level-db');

const inputSelect   = $('input-select');
const outputSection = $('output-device-section');
const outputSelect  = $('output-select');
const outputNote    = $('output-note');

const recordBtn     = $('record-btn');
const recordBtnText = $('record-btn-text');
const recordIcon    = $('record-icon');
const recordTimer   = $('record-timer');
const recordingsSection = $('recordings-section');
const recordingsList    = $('recordings-list');

const errorBox      = $('error-box');
const errorText     = $('error-text');
const browserWarn   = $('browser-warning');
const browserWarnTx = $('browser-warning-text');

const themeBtn      = $('theme-btn');
const themeIcon     = $('theme-icon');

const helpBtn       = $('help-btn');
const shortcutsModal = $('shortcuts-modal');
const modalClose    = $('modal-close');

const vizCanvas     = $('visualizer');
const vizCtx        = vizCanvas.getContext('2d');
const vizModeBtn    = $('viz-mode-btn');
const vizModeText   = $('viz-mode-text');
const colorDots     = document.querySelectorAll('.color-dot');

const pitchDisplay  = $('pitch-display');
const pitchNote     = $('pitch-note');
const pitchFreq     = $('pitch-freq');
const pitchCents    = $('pitch-cents');

const statsPanel    = $('stats-panel');
const statSR        = $('stat-sr');
const statLatency   = $('stat-latency');
const statDuration  = $('stat-duration');

const eqLowSlider   = $('eq-low');
const eqMidSlider   = $('eq-mid');
const eqHighSlider  = $('eq-high');
const eqLowVal      = $('eq-low-val');
const eqMidVal      = $('eq-mid-val');
const eqHighVal     = $('eq-high-val');
const eqResetBtn    = $('eq-reset');

// Voice Effects
const fxReverbToggle   = $('fx-reverb-toggle');
const fxReverbMix      = $('fx-reverb-mix');
const fxReverbMixVal   = $('fx-reverb-mix-val');
const fxReverbDecay    = $('fx-reverb-decay');
const fxReverbDecayVal = $('fx-reverb-decay-val');

const fxDelayToggle     = $('fx-delay-toggle');
const fxDelayTime       = $('fx-delay-time');
const fxDelayTimeVal    = $('fx-delay-time-val');
const fxDelayFeedback   = $('fx-delay-feedback');
const fxDelayFeedbackVal = $('fx-delay-feedback-val');

const fxDistortToggle    = $('fx-distort-toggle');
const fxDistortAmount    = $('fx-distort-amount');
const fxDistortAmountVal = $('fx-distort-amount-val');

// Voice Changer
const voicePresetBtns  = document.querySelectorAll('.voice-preset');
const vcCustomControls = $('voice-custom-controls');
const vcRingFreqSlider = $('vc-ring-freq');
const vcRingFreqVal    = $('vc-ring-freq-val');
const vcFilterSlider   = $('vc-filter-freq');
const vcFilterVal      = $('vc-filter-freq-val');

// Karaoke
const karaokeFile        = $('karaoke-file');
const karaokeFilename    = $('karaoke-filename');
const karaokeTransport   = $('karaoke-transport');
const karaokePlayBtn     = $('karaoke-play');
const karaokeStopBtn     = $('karaoke-stop');
const karaokeProgress    = $('karaoke-progress');
const karaokeTime        = $('karaoke-time');
const karaokeVolume      = $('karaoke-volume');
const karaokeVolVal      = $('karaoke-vol-val');
const karaokeVocalRemove = $('karaoke-vocal-remove');
const karaokeReverbToggle = $('karaoke-reverb-toggle');
const karaokeReverbAmount = $('karaoke-reverb-amount');
const karaokeReverbVal    = $('karaoke-reverb-val');

// ══════════════════════════════════════════════════════════════
//  APPLICATION STATE
// ══════════════════════════════════════════════════════════════

let audioCtx    = null;
let micStream   = null;
let sourceNode  = null;
let gainNode    = null;
let analyser    = null;
let eqLow       = null;
let eqMid       = null;
let eqHigh      = null;

// FX nodes
let reverbConvolver = null, reverbDry = null, reverbWet = null, reverbMerge = null;
let delayNode = null, delayFeedback = null, delayDry = null, delayWet = null, delayMerge = null;
let distortionNode = null, distortDry = null, distortWet = null, distortMerge = null;

// Voice Changer nodes
let vcRingOsc    = null;  // OscillatorNode for ring modulation
let vcRingGain   = null;  // GainNode modulated by the oscillator
let vcFilter1    = null;  // BiquadFilterNode for voice shaping
let vcFilter2    = null;  // Second filter for resonance
let vcTremOsc    = null;  // OscillatorNode for tremolo (underwater)
let vcTremGain   = null;  // GainNode for tremolo modulation
let vcDry        = null;  // GainNode — dry (unprocessed) voice
let vcWet        = null;  // GainNode — wet (voice-changed) signal
let vcMerge      = null;  // GainNode — merge point

let activeVoice  = 'normal';  // Current voice preset name

// Karaoke state
let karaokeAudio       = null;  // Hidden <audio> element for music playback
let karaokeSource      = null;  // MediaElementAudioSourceNode
let karaokeSplitter    = null;  // ChannelSplitterNode
let karaokeMerger      = null;  // ChannelMergerNode
let karaokeGainNode    = null;  // GainNode for music volume
let karaokeInverter    = null;  // GainNode with gain -1 for vocal removal
let karaokeNormalGain  = null;  // Normal (non-vocal-removed) path gain
let karaokeVocalGain   = null;  // Vocal-removed path gain
let karaokeReverbConv  = null;  // ConvolverNode for karaoke reverb on mic
let karaokeReverbDryG  = null;  // Dry gain for karaoke reverb
let karaokeReverbWetG  = null;  // Wet gain for karaoke reverb
let karaokeReverbMergeG = null; // Merge gain
let karaokeProgressRAF = null;  // RAF for progress bar updates
let isMusicPlaying     = false;

// General state
let meterRAF    = null;
let isLive      = false;
let isMuted     = false;
let prevGain    = 1;

let mediaRecorder  = null;
let recordedChunks = [];
let isRecording    = false;
let recordStartTime = 0;
let recordTimerInterval = null;
let recordingCount = 0;

const VIZ_MODES = ['waveform', 'bars', 'circular', 'particles'];
let vizMode  = 0;
let vizColor = 'purple';

let sessionStartTime = 0;
let sessionTimerInterval = null;

const VIZ_COLORS = {
  purple: { primary: '#6c63ff', secondary: '#a78bfa', glow: 'rgba(108, 99, 255, 0.3)' },
  cyan:   { primary: '#22d3ee', secondary: '#67e8f9', glow: 'rgba(34, 211, 238, 0.3)' },
  green:  { primary: '#34d399', secondary: '#6ee7b7', glow: 'rgba(52, 211, 153, 0.3)' },
  fire:   { primary: '#f87171', secondary: '#fbbf24', glow: 'rgba(248, 113, 113, 0.3)' },
};

// ══════════════════════════════════════════════════════════════
//  FEATURE DETECTION
// ══════════════════════════════════════════════════════════════

function checkBrowserSupport() {
  const missing = [];
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    missing.push('getUserMedia (microphone access)');
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined')
    missing.push('Web Audio API');
  if (missing.length > 0) {
    browserWarnTx.textContent =
      `Your browser is missing: ${missing.join(', ')}. Please use Chrome or Edge.`;
    browserWarn.hidden = false;
    micBtn.disabled = true;
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  STATUS & ERROR HELPERS
// ══════════════════════════════════════════════════════════════

function setStatus(state, text) {
  statusBadge.className = `status-badge status--${state}`;
  const labels = { idle: 'Idle', requesting: 'Requesting permission…', live: '● Live', stopped: 'Stopped', error: 'Error' };
  statusBadge.textContent = text || labels[state] || state;
}

function showError(msg) { errorText.textContent = msg; errorBox.hidden = false; setStatus('error'); }
function hideError() { errorBox.hidden = true; }

// ══════════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════════

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('mic-live-theme', next); } catch {}
}

function loadTheme() {
  try {
    const saved = localStorage.getItem('mic-live-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      themeIcon.textContent = saved === 'dark' ? '🌙' : '☀️';
    }
  } catch {}
}

// ══════════════════════════════════════════════════════════════
//  SHORTCUTS MODAL
// ══════════════════════════════════════════════════════════════

function openShortcuts() { shortcutsModal.classList.add('open'); }
function closeShortcuts() { shortcutsModal.classList.remove('open'); }

// ══════════════════════════════════════════════════════════════
//  DEVICE ENUMERATION
// ══════════════════════════════════════════════════════════════

async function enumerateDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    // Input devices
    const inputs = devices.filter(d => d.kind === 'audioinput');
    const curIn = inputSelect.value;
    inputSelect.innerHTML = '';
    inputs.forEach((dev, i) => {
      const o = document.createElement('option');
      o.value = dev.deviceId;
      o.text = dev.label || `Microphone ${i + 1}`;
      inputSelect.appendChild(o);
    });
    if (curIn) inputSelect.value = curIn;

    // Output devices (only if setSinkId supported)
    const testEl = document.createElement('audio');
    if (typeof testEl.setSinkId === 'function') {
      outputSection.hidden = false;
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const curOut = outputSelect.value;
      outputSelect.innerHTML = '';
      outputs.forEach((dev, i) => {
        const o = document.createElement('option');
        o.value = dev.deviceId;
        o.text = dev.label || `Speaker ${i + 1}`;
        outputSelect.appendChild(o);
      });
      if (curOut) outputSelect.value = curOut;
    } else {
      outputNote.hidden = false;
    }
  } catch (err) {
    console.warn('Could not enumerate devices:', err);
  }
}

// Listen for Bluetooth / device changes
if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
}

// ══════════════════════════════════════════════════════════════
//  AUDIO UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Generate a synthetic reverb impulse response.
 * @param {AudioContext} ctx
 * @param {number} duration - tail length in seconds
 * @param {number} decay - exponential decay factor
 * @returns {AudioBuffer}
 */
function generateReverbIR(ctx, duration = 2, decay = 2) {
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/**
 * Generate a waveshaper distortion curve.
 * @param {number} amount - 0 to 100
 * @returns {Float32Array}
 */
function makeDistortionCurve(amount = 50) {
  const k = amount * 4;
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// ══════════════════════════════════════════════════════════════
//  VOICE CHANGER PRESETS
// ══════════════════════════════════════════════════════════════

/**
 * Voice preset configurations.
 * Each preset defines parameters for the ring modulator,
 * filters, tremolo, and wet/dry mix that shape the voice.
 *
 *   ringFreq  — frequency of the ring modulator oscillator (Hz)
 *   ringGain  — depth of ring modulation (0 = off, 1 = full)
 *   ringType  — oscillator waveform ('sine', 'square', 'sawtooth')
 *   f1Type    — first filter type (lowpass, highpass, bandpass, etc.)
 *   f1Freq    — first filter cutoff frequency (Hz)
 *   f1Q       — first filter Q/resonance
 *   f2Type    — second filter type
 *   f2Freq    — second filter cutoff
 *   f2Q       — second filter Q
 *   tremFreq  — tremolo LFO frequency (Hz), 0 = off
 *   tremDepth — tremolo depth (0–1)
 *   wetMix    — wet signal level (0–1)
 *   dryMix    — dry signal level (0–1)
 */
const VOICE_PRESETS = {
  normal: {
    ringFreq: 0, ringGain: 0, ringType: 'sine',
    f1Type: 'allpass', f1Freq: 1000, f1Q: 0,
    f2Type: 'allpass', f2Freq: 1000, f2Q: 0,
    tremFreq: 0, tremDepth: 0,
    wetMix: 0, dryMix: 1,
  },
  deep: {
    // Low ring modulation + heavy low-shelf boost simulates a deep voice
    ringFreq: 50, ringGain: 0.3, ringType: 'sine',
    f1Type: 'lowpass', f1Freq: 900, f1Q: 2,
    f2Type: 'lowshelf', f2Freq: 400, f2Q: 0, f2Gain: 8,
    tremFreq: 0, tremDepth: 0,
    wetMix: 0.7, dryMix: 0.5,
  },
  chipmunk: {
    // High ring mod + highpass creates a squeaky chipmunk effect
    ringFreq: 400, ringGain: 0.45, ringType: 'sine',
    f1Type: 'highpass', f1Freq: 800, f1Q: 1,
    f2Type: 'highshelf', f2Freq: 2000, f2Q: 0, f2Gain: 10,
    tremFreq: 0, tremDepth: 0,
    wetMix: 0.8, dryMix: 0.3,
  },
  robot: {
    // Square-wave ring mod at mid frequency = classic robot voice
    ringFreq: 180, ringGain: 0.8, ringType: 'square',
    f1Type: 'bandpass', f1Freq: 1200, f1Q: 3,
    f2Type: 'bandpass', f2Freq: 2400, f2Q: 2,
    tremFreq: 0, tremDepth: 0,
    wetMix: 1, dryMix: 0.1,
  },
  radio: {
    // Bandpass filter (telephone band 300–3400 Hz) + subtle distortion feel
    ringFreq: 0, ringGain: 0, ringType: 'sine',
    f1Type: 'bandpass', f1Freq: 1800, f1Q: 0.8,
    f2Type: 'highpass', f2Freq: 300, f2Q: 0.7,
    tremFreq: 0, tremDepth: 0,
    wetMix: 1, dryMix: 0,
  },
  underwater: {
    // Heavy lowpass + slow tremolo = underwater bubbling
    ringFreq: 0, ringGain: 0, ringType: 'sine',
    f1Type: 'lowpass', f1Freq: 500, f1Q: 8,
    f2Type: 'lowpass', f2Freq: 700, f2Q: 4,
    tremFreq: 3, tremDepth: 0.6,
    wetMix: 1, dryMix: 0.15,
  },
  alien: {
    // Sawtooth ring mod + resonant filter = alien/sci-fi voice
    ringFreq: 300, ringGain: 0.7, ringType: 'sawtooth',
    f1Type: 'bandpass', f1Freq: 2000, f1Q: 6,
    f2Type: 'notch', f2Freq: 800, f2Q: 4,
    tremFreq: 6, tremDepth: 0.3,
    wetMix: 0.9, dryMix: 0.2,
  },
  cave: {
    // Low ring mod + heavy reverb-like resonance
    ringFreq: 60, ringGain: 0.15, ringType: 'sine',
    f1Type: 'lowpass', f1Freq: 1200, f1Q: 5,
    f2Type: 'peaking', f2Freq: 600, f2Q: 3, f2Gain: 6,
    tremFreq: 0.5, tremDepth: 0.15,
    wetMix: 0.75, dryMix: 0.5,
  },
};

/**
 * Apply a voice changer preset to the active voice changer nodes.
 * This updates the ring modulator frequency, filter parameters,
 * tremolo LFO, and wet/dry mix in real-time.
 *
 * @param {string} presetName — key from VOICE_PRESETS
 */
function applyVoicePreset(presetName) {
  activeVoice = presetName;
  const p = VOICE_PRESETS[presetName];
  if (!p || !audioCtx) return;

  // Update ring modulator
  if (vcRingOsc) {
    vcRingOsc.frequency.value = p.ringFreq || 0.001; // Avoid 0 Hz
    vcRingOsc.type = p.ringType || 'sine';
  }
  if (vcRingGain) {
    vcRingGain.gain.value = p.ringGain;
  }

  // Update first filter
  if (vcFilter1) {
    vcFilter1.type = p.f1Type;
    vcFilter1.frequency.value = p.f1Freq;
    vcFilter1.Q.value = p.f1Q;
  }

  // Update second filter
  if (vcFilter2) {
    vcFilter2.type = p.f2Type;
    vcFilter2.frequency.value = p.f2Freq;
    vcFilter2.Q.value = p.f2Q || 0;
    if (p.f2Gain !== undefined) vcFilter2.gain.value = p.f2Gain;
    else vcFilter2.gain.value = 0;
  }

  // Update tremolo LFO
  if (vcTremOsc) {
    vcTremOsc.frequency.value = p.tremFreq || 0.001;
  }
  if (vcTremGain) {
    // tremDepth controls how much the LFO modulates the gain
    // When depth=0, gain stays at 1 (no tremolo)
    vcTremGain.gain.value = p.tremDepth;
  }

  // Update wet/dry mix
  if (vcDry) vcDry.gain.value = p.dryMix;
  if (vcWet) vcWet.gain.value = p.wetMix;

  // Show/hide custom controls for non-normal presets
  vcCustomControls.hidden = (presetName === 'normal');

  // Update custom slider values to match preset
  if (vcRingFreqSlider) {
    vcRingFreqSlider.value = p.ringFreq;
    vcRingFreqVal.textContent = `${p.ringFreq} Hz`;
  }
  if (vcFilterSlider) {
    vcFilterSlider.value = p.f1Freq;
    vcFilterVal.textContent = `${p.f1Freq} Hz`;
  }
}

// ══════════════════════════════════════════════════════════════
//  AUDIO GRAPH CONSTRUCTION
// ══════════════════════════════════════════════════════════════

/**
 * Build the complete Web Audio processing graph.
 *
 * Signal chain:
 *   source → EQ → voiceChanger → distortion → delay → reverb → gain → analyser → destination
 *
 * @param {MediaStream} stream — mic stream from getUserMedia
 */
function buildAudioGraph(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioCtx();

  // ── Source ──
  sourceNode = audioCtx.createMediaStreamSource(stream);

  // ── EQ: 3-band ──
  eqLow = audioCtx.createBiquadFilter();
  eqLow.type = 'lowshelf'; eqLow.frequency.value = 320;
  eqLow.gain.value = parseFloat(eqLowSlider.value);

  eqMid = audioCtx.createBiquadFilter();
  eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 0.5;
  eqMid.gain.value = parseFloat(eqMidSlider.value);

  eqHigh = audioCtx.createBiquadFilter();
  eqHigh.type = 'highshelf'; eqHigh.frequency.value = 3200;
  eqHigh.gain.value = parseFloat(eqHighSlider.value);

  // ── Voice Changer ──
  // Ring modulator: Oscillator → GainNode that modulates the signal
  vcRingOsc = audioCtx.createOscillator();
  vcRingOsc.type = 'sine';
  vcRingOsc.frequency.value = 0.001;
  vcRingOsc.start();

  vcRingGain = audioCtx.createGain();
  vcRingGain.gain.value = 0; // No ring mod by default

  // The ring mod works by multiplying the audio signal with the oscillator.
  // We route the oscillator into a GainNode, then use that GainNode's
  // output as a modulator on the signal path.

  vcFilter1 = audioCtx.createBiquadFilter();
  vcFilter1.type = 'allpass'; vcFilter1.frequency.value = 1000;

  vcFilter2 = audioCtx.createBiquadFilter();
  vcFilter2.type = 'allpass'; vcFilter2.frequency.value = 1000;

  // Tremolo LFO (amplitude modulation)
  vcTremOsc = audioCtx.createOscillator();
  vcTremOsc.type = 'sine';
  vcTremOsc.frequency.value = 0.001;
  vcTremOsc.start();

  vcTremGain = audioCtx.createGain();
  vcTremGain.gain.value = 0; // No tremolo by default

  // The tremolo modulates a GainNode's gain parameter
  const vcTremTarget = audioCtx.createGain();
  vcTremTarget.gain.value = 1;
  vcTremOsc.connect(vcTremGain);
  vcTremGain.connect(vcTremTarget.gain); // Modulate the gain parameter

  // Wet/dry for voice changer
  vcDry   = audioCtx.createGain(); vcDry.gain.value = 1;
  vcWet   = audioCtx.createGain(); vcWet.gain.value = 0;
  vcMerge = audioCtx.createGain(); vcMerge.gain.value = 1;

  // Voice changer signal path:
  //   input → vcFilter1 → vcRingGain (modulated) → vcFilter2 → tremolo → vcWet → vcMerge
  //   input → vcDry → vcMerge

  // Ring mod: oscillator modulates a gain node inline
  const vcRingModGain = audioCtx.createGain();
  vcRingModGain.gain.value = 0; // Will be overridden by oscillator
  vcRingOsc.connect(vcRingModGain.gain); // Oscillator controls the gain

  // ── Distortion ──
  distortionNode = audioCtx.createWaveShaper();
  distortionNode.curve = makeDistortionCurve(parseFloat(fxDistortAmount.value));
  distortionNode.oversample = '4x';

  distortDry   = audioCtx.createGain(); distortDry.gain.value = 1;
  distortWet   = audioCtx.createGain(); distortWet.gain.value = 0;
  distortMerge = audioCtx.createGain();

  // ── Delay ──
  delayNode = audioCtx.createDelay(2.0);
  delayNode.delayTime.value = parseFloat(fxDelayTime.value) / 1000;
  delayFeedback = audioCtx.createGain();
  delayFeedback.gain.value = parseFloat(fxDelayFeedback.value) / 100;

  delayDry   = audioCtx.createGain(); delayDry.gain.value = 1;
  delayWet   = audioCtx.createGain(); delayWet.gain.value = 0;
  delayMerge = audioCtx.createGain();

  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);

  // ── Reverb ──
  reverbConvolver = audioCtx.createConvolver();
  reverbConvolver.buffer = generateReverbIR(audioCtx, parseFloat(fxReverbDecay.value), 2);

  reverbDry   = audioCtx.createGain(); reverbDry.gain.value = 1;
  reverbWet   = audioCtx.createGain(); reverbWet.gain.value = 0;
  reverbMerge = audioCtx.createGain();

  // ── Master gain ──
  gainNode = audioCtx.createGain();
  gainNode.gain.value = isMuted ? 0 : gainSlider.value / 100;

  // ── Analyser ──
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;

  // ══════════════════════════════════════════════════════
  //  CONNECT THE FULL CHAIN
  // ══════════════════════════════════════════════════════

  // Source → EQ
  sourceNode.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);

  // EQ → Voice Changer (wet path: filters + ring mod + tremolo)
  eqHigh.connect(vcFilter1);
  vcFilter1.connect(vcRingModGain);  // Ring mod applied here
  vcRingModGain.connect(vcFilter2);
  vcFilter2.connect(vcTremTarget);   // Tremolo applied here
  vcTremTarget.connect(vcWet);
  vcWet.connect(vcMerge);

  // EQ → Voice Changer (dry path: bypass)
  eqHigh.connect(vcDry);
  vcDry.connect(vcMerge);

  // Voice Changer → Distortion
  vcMerge.connect(distortDry);
  vcMerge.connect(distortionNode);
  distortionNode.connect(distortWet);
  distortDry.connect(distortMerge);
  distortWet.connect(distortMerge);

  // Distortion → Delay
  distortMerge.connect(delayDry);
  distortMerge.connect(delayNode);
  delayNode.connect(delayWet);
  delayDry.connect(delayMerge);
  delayWet.connect(delayMerge);

  // Delay → Reverb
  delayMerge.connect(reverbDry);
  delayMerge.connect(reverbConvolver);
  reverbConvolver.connect(reverbWet);
  reverbDry.connect(reverbMerge);
  reverbWet.connect(reverbMerge);

  // Reverb → Gain → Analyser → Destination
  reverbMerge.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Apply initial states
  applyDistortionState();
  applyDelayState();
  applyReverbState();
  applyVoicePreset(activeVoice);

  // Setup karaoke audio chain (if a file was loaded before going live)
  setupKaraokeAudioChain();

  // Set output device
  if (outputSelect.value && typeof audioCtx.setSinkId === 'function') {
    audioCtx.setSinkId(outputSelect.value).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════
//  FX STATE TOGGLES
// ══════════════════════════════════════════════════════════════

function applyDistortionState() {
  if (!distortDry) return;
  const on = fxDistortToggle.checked;
  distortDry.gain.value = on ? 0 : 1;
  distortWet.gain.value = on ? 1 : 0;
}

function applyDelayState() {
  if (!delayDry) return;
  const on = fxDelayToggle.checked;
  delayDry.gain.value = on ? 0.6 : 1;
  delayWet.gain.value = on ? 0.4 : 0;
}

function applyReverbState() {
  if (!reverbDry) return;
  const on = fxReverbToggle.checked;
  const mix = parseFloat(fxReverbMix.value) / 100;
  reverbDry.gain.value = on ? (1 - mix) : 1;
  reverbWet.gain.value = on ? mix : 0;
}

// ══════════════════════════════════════════════════════════════
//  KARAOKE AUDIO CHAIN
// ══════════════════════════════════════════════════════════════

/**
 * Set up the karaoke playback chain.
 *
 * Vocal Removal Technique (Phase Cancellation):
 *   In most stereo mixes, vocals are panned center — meaning
 *   they appear equally in both L and R channels.
 *   By subtracting R from L (L - R), we cancel out the center-panned
 *   vocals while preserving instruments panned to the sides.
 *
 *   Signal path:
 *     audio file → splitter → L channel → merger Ch0
 *                           → R channel (inverted, gain = -1) → merger Ch0
 *                           → R channel → merger Ch1
 *                           → L channel (inverted, gain = -1) → merger Ch1
 *     merger → karaoke gain → destination
 */
function setupKaraokeAudioChain() {
  if (!audioCtx || !karaokeAudio) return;

  // Avoid re-creating if already connected
  if (karaokeSource) return;

  try {
    karaokeSource = audioCtx.createMediaElementSource(karaokeAudio);
  } catch {
    // Already created source for this element in another context
    return;
  }

  // Volume control for music
  karaokeGainNode = audioCtx.createGain();
  karaokeGainNode.gain.value = parseFloat(karaokeVolume.value) / 100;

  // Normal (non-vocal-removed) path
  karaokeNormalGain = audioCtx.createGain();
  karaokeNormalGain.gain.value = 1;

  // Vocal removal path
  karaokeSplitter = audioCtx.createChannelSplitter(2);
  karaokeMerger   = audioCtx.createChannelMerger(2);
  karaokeInverter = audioCtx.createGain();
  karaokeInverter.gain.value = -1; // Invert one channel

  karaokeVocalGain = audioCtx.createGain();
  karaokeVocalGain.gain.value = 0; // Off by default

  // Build the vocal removal routing:
  // Split stereo → L minus R for each output channel
  karaokeSource.connect(karaokeSplitter);

  // Left output channel: L + (-R)
  karaokeSplitter.connect(karaokeMerger, 0, 0);           // L → out L
  karaokeSplitter.connect(karaokeInverter, 1);             // R → inverter
  karaokeInverter.connect(karaokeMerger, 0, 0);            // -R → out L

  // Right output channel: same (mono output of L-R)
  karaokeSplitter.connect(karaokeMerger, 0, 1);            // L → out R
  const karaokeInverter2 = audioCtx.createGain();
  karaokeInverter2.gain.value = -1;
  karaokeSplitter.connect(karaokeInverter2, 1);
  karaokeInverter2.connect(karaokeMerger, 0, 1);           // -R → out R

  karaokeMerger.connect(karaokeVocalGain);

  // Normal stereo path (no vocal removal)
  karaokeSource.connect(karaokeNormalGain);

  // Merge both paths into the music gain node
  karaokeNormalGain.connect(karaokeGainNode);
  karaokeVocalGain.connect(karaokeGainNode);

  // Music → destination
  karaokeGainNode.connect(audioCtx.destination);

  // Apply vocal removal state
  applyVocalRemovalState();

  // ── Karaoke reverb for microphone ──
  // Adds a lush reverb specifically for the karaoke mic signal
  karaokeReverbConv = audioCtx.createConvolver();
  karaokeReverbConv.buffer = generateReverbIR(audioCtx, 3, 1.5); // Longer, lusher tail

  karaokeReverbDryG  = audioCtx.createGain();
  karaokeReverbWetG  = audioCtx.createGain();
  karaokeReverbMergeG = audioCtx.createGain();

  applyKaraokeReverbState();
}

/**
 * Toggle between normal stereo and vocal-removed paths.
 */
function applyVocalRemovalState() {
  if (!karaokeNormalGain || !karaokeVocalGain) return;
  const on = karaokeVocalRemove.checked;
  karaokeNormalGain.gain.value = on ? 0 : 1;
  karaokeVocalGain.gain.value  = on ? 1 : 0;
}

/**
 * Update karaoke reverb wet/dry mix on the mic signal.
 */
function applyKaraokeReverbState() {
  // The karaoke reverb is separate from the main reverb effect —
  // it's applied specifically when the user is in karaoke mode.
  // For simplicity, we use the main reverb controls for the mic,
  // and the karaoke reverb amount slider adjusts a secondary path.
  // In this implementation, the karaoke reverb toggle modulates
  // the main reverb settings to give a "karaoke room" feel.
  if (!reverbDry) return;
  const karOn = karaokeReverbToggle.checked;
  if (karOn && !fxReverbToggle.checked) {
    // Auto-enable main reverb with karaoke-style settings
    const mix = parseFloat(karaokeReverbAmount.value) / 100;
    reverbDry.gain.value = 1 - mix;
    reverbWet.gain.value = mix;
  }
}

// ══════════════════════════════════════════════════════════════
//  LEVEL METER & VISUALIZER LOOP
// ══════════════════════════════════════════════════════════════

function startMeter() {
  const dataArray = new Uint8Array(analyser.fftSize);

  function tick() {
    analyser.getByteTimeDomainData(dataArray);

    // RMS level
    let sumSq = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const s = (dataArray[i] - 128) / 128;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / dataArray.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const clamped = Math.max(db, -60);
    const pct = ((clamped + 60) / 60) * 100;

    levelBar.style.width = `${pct}%`;
    levelDb.textContent = isFinite(db) ? `${db.toFixed(1)} dB` : '–∞ dB';

    drawVisualizer();
    detectPitch();

    meterRAF = requestAnimationFrame(tick);
  }
  tick();
}

function stopMeter() {
  if (meterRAF !== null) { cancelAnimationFrame(meterRAF); meterRAF = null; }
  levelBar.style.width = '0%';
  levelDb.textContent = '–∞ dB';
}

// ══════════════════════════════════════════════════════════════
//  VISUALIZER DRAWING
// ══════════════════════════════════════════════════════════════

function resizeCanvas() {
  const r = vizCanvas.getBoundingClientRect();
  vizCanvas.width  = r.width * window.devicePixelRatio;
  vizCanvas.height = r.height * window.devicePixelRatio;
  vizCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function drawVisualizer() {
  const W = vizCanvas.getBoundingClientRect().width;
  const H = vizCanvas.getBoundingClientRect().height;
  const c = VIZ_COLORS[vizColor];
  vizCtx.clearRect(0, 0, W, H);

  switch (VIZ_MODES[vizMode]) {
    case 'waveform':  drawWaveform(W, H, c);  break;
    case 'bars':      drawBars(W, H, c);      break;
    case 'circular':  drawCircular(W, H, c);  break;
    case 'particles': drawParticles(W, H, c); break;
  }
}

function drawWaveform(W, H, c) {
  const buf = analyser.fftSize;
  const data = new Uint8Array(buf);
  analyser.getByteTimeDomainData(data);

  vizCtx.shadowBlur = 8; vizCtx.shadowColor = c.glow;
  vizCtx.lineWidth = 2; vizCtx.strokeStyle = c.primary;
  vizCtx.beginPath();
  const sliceW = W / buf;
  let x = 0;
  for (let i = 0; i < buf; i++) {
    const y = (data[i] / 128.0) * H / 2;
    i === 0 ? vizCtx.moveTo(x, y) : vizCtx.lineTo(x, y);
    x += sliceW;
  }
  vizCtx.lineTo(W, H / 2);
  vizCtx.stroke();

  // Shadow line
  vizCtx.globalAlpha = 0.25; vizCtx.strokeStyle = c.secondary; vizCtx.lineWidth = 1;
  vizCtx.beginPath(); x = 0;
  for (let i = 0; i < buf; i++) {
    const y = (data[i] / 128.0) * H / 2 + 2;
    i === 0 ? vizCtx.moveTo(x, y) : vizCtx.lineTo(x, y);
    x += sliceW;
  }
  vizCtx.stroke();
  vizCtx.globalAlpha = 1; vizCtx.shadowBlur = 0;
}

function drawBars(W, H, c) {
  const buf = analyser.frequencyBinCount;
  const data = new Uint8Array(buf);
  analyser.getByteFrequencyData(data);
  const count = 64, barW = W / count - 1, step = Math.floor(buf / count);
  for (let i = 0; i < count; i++) {
    const barH = (data[i * step] / 255) * H;
    const grad = vizCtx.createLinearGradient(0, H, 0, H - barH);
    grad.addColorStop(0, c.primary); grad.addColorStop(1, c.secondary);
    vizCtx.fillStyle = grad;
    vizCtx.shadowBlur = 4; vizCtx.shadowColor = c.glow;
    vizCtx.fillRect(i * (barW + 1), H - barH, barW, barH);
  }
  vizCtx.shadowBlur = 0;
}

function drawCircular(W, H, c) {
  const buf = analyser.frequencyBinCount;
  const data = new Uint8Array(buf);
  analyser.getByteFrequencyData(data);
  const cx = W / 2, cy = H / 2;
  const baseR = Math.min(W, H) * 0.2, maxR = Math.min(W, H) * 0.45;
  const bars = 90, step = Math.floor(buf / bars);
  vizCtx.shadowBlur = 6; vizCtx.shadowColor = c.glow;
  for (let i = 0; i < bars; i++) {
    const val = data[i * step] / 255;
    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const r = baseR + val * (maxR - baseR);
    vizCtx.beginPath();
    vizCtx.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
    vizCtx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    vizCtx.lineWidth = 2;
    vizCtx.strokeStyle = val > 0.6 ? c.secondary : c.primary;
    vizCtx.globalAlpha = 0.3 + val * 0.7;
    vizCtx.stroke();
  }
  vizCtx.globalAlpha = 1; vizCtx.shadowBlur = 0;
}

let particles = [];
function initParticles(W, H) {
  particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: Math.random() * 2 + 1 });
  }
}

function drawParticles(W, H, c) {
  const buf = analyser.frequencyBinCount;
  const data = new Uint8Array(buf);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < buf; i++) sum += data[i];
  const avg = sum / buf / 255;
  if (particles.length === 0) initParticles(W, H);
  vizCtx.shadowBlur = 4; vizCtx.shadowColor = c.glow;
  for (const p of particles) {
    p.x += p.vx * (1 + avg * 6); p.y += p.vy * (1 + avg * 6);
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    vizCtx.beginPath(); vizCtx.arc(p.x, p.y, p.r + avg * 3, 0, Math.PI * 2);
    vizCtx.fillStyle = c.primary; vizCtx.globalAlpha = 0.4 + avg * 0.6; vizCtx.fill();
  }
  vizCtx.lineWidth = 0.5; vizCtx.strokeStyle = c.secondary; vizCtx.globalAlpha = 0.08 + avg * 0.15;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < 60 + avg * 40) {
        vizCtx.beginPath(); vizCtx.moveTo(particles[i].x, particles[i].y);
        vizCtx.lineTo(particles[j].x, particles[j].y); vizCtx.stroke();
      }
    }
  }
  vizCtx.globalAlpha = 1; vizCtx.shadowBlur = 0;
}

// ══════════════════════════════════════════════════════════════
//  PITCH DETECTION (Autocorrelation)
// ══════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let pitchFrameCount = 0;

function detectPitch() {
  pitchFrameCount++;
  if (pitchFrameCount % 3 !== 0) return;

  const bufLen = analyser.fftSize;
  const data = new Float32Array(bufLen);
  analyser.getFloatTimeDomainData(data);

  let rms = 0;
  for (let i = 0; i < bufLen; i++) rms += data[i] * data[i];
  rms = Math.sqrt(rms / bufLen);
  if (rms < 0.01) {
    pitchNote.textContent = '—';
    pitchFreq.textContent = '— Hz';
    pitchCents.style.left = '50%';
    return;
  }

  const sr = audioCtx.sampleRate;
  let bestCorr = -1, bestOff = -1;
  const minP = Math.floor(sr / 1500), maxP = Math.floor(sr / 50);

  for (let off = minP; off < maxP && off < bufLen; off++) {
    let corr = 0;
    for (let i = 0; i < bufLen - off; i++) corr += Math.abs(data[i] - data[i + off]);
    corr = 1 - corr / (bufLen - off);
    if (corr > bestCorr) { bestCorr = corr; bestOff = off; }
  }

  if (bestCorr > 0.9 && bestOff > 0) {
    const freq = sr / bestOff;
    const noteNum = 12 * Math.log2(freq / 440) + 69;
    const rounded = Math.round(noteNum);
    const cents = Math.round((noteNum - rounded) * 100);
    pitchNote.textContent = `${NOTE_NAMES[rounded % 12]}${Math.floor(rounded / 12) - 1}`;
    pitchFreq.textContent = `${freq.toFixed(1)} Hz`;
    pitchCents.style.left = `${Math.max(5, Math.min(95, ((cents + 50) / 100) * 100))}%`;
  }
}

// ══════════════════════════════════════════════════════════════
//  SESSION TIMER
// ══════════════════════════════════════════════════════════════

function startSessionTimer() {
  sessionStartTime = Date.now();
  sessionTimerInterval = setInterval(() => {
    const e = Math.floor((Date.now() - sessionStartTime) / 1000);
    statDuration.textContent = `${Math.floor(e / 60)}:${(e % 60).toString().padStart(2, '0')}`;
  }, 1000);
}
function stopSessionTimer() { clearInterval(sessionTimerInterval); }

// ══════════════════════════════════════════════════════════════
//  START / STOP MICROPHONE
// ══════════════════════════════════════════════════════════════

async function startMic() {
  hideError();
  setStatus('requesting');

  const constraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
  };
  if (inputSelect.value) constraints.deviceId = { exact: inputSelect.value };

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
  } catch (err) {
    if (err.name === 'NotAllowedError') showError('Microphone permission denied. Please allow access.');
    else if (err.name === 'NotFoundError') showError('No microphone found. Please connect one.');
    else if (err.name === 'OverconstrainedError') showError('Selected mic unavailable. Choose another.');
    else showError(`Mic error: ${err.message}`);
    setStatus('idle');
    return;
  }

  try {
    buildAudioGraph(micStream);
    resizeCanvas();
    startMeter();
    await enumerateDevices();

    statsPanel.hidden = false;
    statSR.textContent = `${audioCtx.sampleRate / 1000}k`;
    statLatency.textContent = `${(audioCtx.baseLatency * 1000).toFixed(0)}ms`;
    startSessionTimer();

    pitchDisplay.hidden = false;
    isLive = true;
    micBtn.classList.add('btn--active');
    micBtnText.textContent = 'Stop Microphone';
    micBtnIcon.textContent = '⏹️';
    recordBtn.disabled = false;
    setStatus('live');
  } catch (err) {
    showError(`Audio setup failed: ${err.message}`);
    cleanupAudio();
    setStatus('error');
  }
}

function stopMic() {
  // Stop karaoke playback
  if (isMusicPlaying) stopKaraokePlayback();

  cleanupAudio();
  isLive = false;
  micBtn.classList.remove('btn--active');
  micBtnText.textContent = 'Start Microphone';
  micBtnIcon.textContent = '🎤';
  recordBtn.disabled = true;
  statsPanel.hidden = true;
  pitchDisplay.hidden = true;
  stopSessionTimer();
  setStatus('stopped');

  if (isRecording) stopRecording();

  const W = vizCanvas.getBoundingClientRect().width;
  const H = vizCanvas.getBoundingClientRect().height;
  vizCtx.clearRect(0, 0, W, H);
}

function cleanupAudio() {
  stopMeter();

  // Stop voice changer oscillators
  try { vcRingOsc?.stop(); } catch {}
  try { vcTremOsc?.stop(); } catch {}

  const allNodes = [
    sourceNode, eqLow, eqMid, eqHigh,
    vcRingOsc, vcRingGain, vcFilter1, vcFilter2, vcTremOsc, vcTremGain,
    vcDry, vcWet, vcMerge,
    distortionNode, distortDry, distortWet, distortMerge,
    delayNode, delayFeedback, delayDry, delayWet, delayMerge,
    reverbConvolver, reverbDry, reverbWet, reverbMerge,
    gainNode, analyser,
    karaokeSource, karaokeSplitter, karaokeMerger, karaokeGainNode,
    karaokeInverter, karaokeNormalGain, karaokeVocalGain,
    karaokeReverbConv, karaokeReverbDryG, karaokeReverbWetG, karaokeReverbMergeG,
  ];
  for (const n of allNodes) { try { n?.disconnect(); } catch {} }

  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  if (audioCtx && audioCtx.state !== 'closed') { audioCtx.close().catch(() => {}); audioCtx = null; }

  sourceNode = gainNode = analyser = eqLow = eqMid = eqHigh = null;
  vcRingOsc = vcRingGain = vcFilter1 = vcFilter2 = vcTremOsc = vcTremGain = null;
  vcDry = vcWet = vcMerge = null;
  distortionNode = distortDry = distortWet = distortMerge = null;
  delayNode = delayFeedback = delayDry = delayWet = delayMerge = null;
  reverbConvolver = reverbDry = reverbWet = reverbMerge = null;
  karaokeSource = karaokeSplitter = karaokeMerger = karaokeGainNode = null;
  karaokeInverter = karaokeNormalGain = karaokeVocalGain = null;
  karaokeReverbConv = karaokeReverbDryG = karaokeReverbWetG = karaokeReverbMergeG = null;
}

// ══════════════════════════════════════════════════════════════
//  RECORDING
// ══════════════════════════════════════════════════════════════

function startRecording() {
  if (!audioCtx || !analyser) return;
  try {
    const dest = audioCtx.createMediaStreamDestination();
    analyser.connect(dest);
    // Also capture karaoke music if playing
    if (karaokeGainNode) karaokeGainNode.connect(dest);

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRecorder = new MediaRecorder(dest.stream, { mimeType: mime });
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => addRecordingToList(new Blob(recordedChunks, { type: mime }));

    mediaRecorder.start();
    isRecording = true;
    recordStartTime = Date.now();
    recordBtn.classList.add('btn--recording');
    recordBtnText.textContent = 'Stop Recording';
    recordIcon.textContent = '⏹️';
    recordTimer.hidden = false;
    recordTimerInterval = setInterval(() => {
      const e = Math.floor((Date.now() - recordStartTime) / 1000);
      recordTimer.textContent = `${Math.floor(e / 60)}:${(e % 60).toString().padStart(2, '0')}`;
    }, 1000);
  } catch (err) {
    showError(`Recording failed: ${err.message}`);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(recordTimerInterval);
  isRecording = false;
  recordBtn.classList.remove('btn--recording');
  recordBtnText.textContent = 'Record';
  recordIcon.textContent = '⏺️';
  recordTimer.hidden = true;
  recordTimer.textContent = '0:00';
}

function addRecordingToList(blob) {
  recordingCount++;
  const url = URL.createObjectURL(blob);
  recordingsSection.hidden = false;
  const li = document.createElement('li');
  li.className = 'recording-item';
  li.innerHTML = `
    <span style="font-weight:600;font-size:0.72rem;min-width:24px">#${recordingCount}</span>
    <audio src="${url}" controls preload="metadata" style="flex:1;height:30px;min-width:0"></audio>
    <a href="${url}" download="mic-recording-${recordingCount}.webm" title="Download">⬇️</a>
  `;
  recordingsList.appendChild(li);
}

// ══════════════════════════════════════════════════════════════
//  KARAOKE PLAYBACK CONTROLS
// ══════════════════════════════════════════════════════════════

/**
 * Handle loading a music file for karaoke.
 */
karaokeFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  karaokeFilename.textContent = file.name;
  karaokeTransport.hidden = false;

  // Create a hidden <audio> element for playback
  if (karaokeAudio) {
    karaokeAudio.pause();
    URL.revokeObjectURL(karaokeAudio.src);
  }

  karaokeAudio = new Audio();
  karaokeAudio.crossOrigin = 'anonymous';
  karaokeAudio.src = URL.createObjectURL(file);
  karaokeAudio.preload = 'auto';

  // Reset source so it can be re-created in the audio context
  karaokeSource = null;

  // If already live, wire up the karaoke chain now
  if (audioCtx) setupKaraokeAudioChain();

  // Progress updates
  karaokeAudio.addEventListener('timeupdate', updateKaraokeProgress);
  karaokeAudio.addEventListener('ended', () => {
    isMusicPlaying = false;
    karaokePlayBtn.textContent = '▶️';
  });
});

function updateKaraokeProgress() {
  if (!karaokeAudio) return;
  const cur = karaokeAudio.currentTime;
  const dur = karaokeAudio.duration || 0;
  const pct = dur > 0 ? (cur / dur) * 100 : 0;
  karaokeProgress.style.width = `${pct}%`;

  const fmt = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  karaokeTime.textContent = `${fmt(cur)} / ${fmt(dur)}`;
}

function stopKaraokePlayback() {
  if (karaokeAudio) {
    karaokeAudio.pause();
    karaokeAudio.currentTime = 0;
  }
  isMusicPlaying = false;
  karaokePlayBtn.textContent = '▶️';
  karaokeProgress.style.width = '0%';
}

karaokePlayBtn.addEventListener('click', () => {
  if (!karaokeAudio) return;

  // Need AudioContext to be active for MediaElementSource
  if (!audioCtx) {
    showError('Start the microphone first to enable karaoke playback.');
    return;
  }

  if (isMusicPlaying) {
    karaokeAudio.pause();
    isMusicPlaying = false;
    karaokePlayBtn.textContent = '▶️';
  } else {
    // Ensure audio chain is set up
    setupKaraokeAudioChain();
    karaokeAudio.play();
    isMusicPlaying = true;
    karaokePlayBtn.textContent = '⏸️';
  }
});

karaokeStopBtn.addEventListener('click', stopKaraokePlayback);

// ══════════════════════════════════════════════════════════════
//  MUTE
// ══════════════════════════════════════════════════════════════

function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) {
    prevGain = gainSlider.value / 100;
    if (gainNode) gainNode.gain.value = 0;
    muteBtn.textContent = '🔇';
  } else {
    if (gainNode) gainNode.gain.value = prevGain;
    muteBtn.textContent = '🔊';
  }
}

// ══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════════════════

// Mic toggle
micBtn.addEventListener('click', () => isLive ? stopMic() : startMic());

// Volume
gainSlider.addEventListener('input', () => {
  const v = gainSlider.value;
  gainValue.textContent = `${v} %`;
  if (!isMuted && gainNode) gainNode.gain.value = v / 100;
  if (!isMuted) muteBtn.textContent = v == 0 ? '🔇' : '🔊';
});

muteBtn.addEventListener('click', toggleMute);

// EQ
eqLowSlider.addEventListener('input', () => { eqLowVal.textContent = `${eqLowSlider.value} dB`; if (eqLow) eqLow.gain.value = eqLowSlider.value; });
eqMidSlider.addEventListener('input', () => { eqMidVal.textContent = `${eqMidSlider.value} dB`; if (eqMid) eqMid.gain.value = eqMidSlider.value; });
eqHighSlider.addEventListener('input', () => { eqHighVal.textContent = `${eqHighSlider.value} dB`; if (eqHigh) eqHigh.gain.value = eqHighSlider.value; });
eqResetBtn.addEventListener('click', () => {
  [eqLowSlider, eqMidSlider, eqHighSlider].forEach(s => { s.value = 0; s.dispatchEvent(new Event('input')); });
});

// Distortion FX
fxDistortToggle.addEventListener('change', applyDistortionState);
fxDistortAmount.addEventListener('input', () => {
  fxDistortAmountVal.textContent = fxDistortAmount.value;
  if (distortionNode) distortionNode.curve = makeDistortionCurve(parseFloat(fxDistortAmount.value));
});

// Delay FX
fxDelayToggle.addEventListener('change', applyDelayState);
fxDelayTime.addEventListener('input', () => {
  fxDelayTimeVal.textContent = `${fxDelayTime.value}ms`;
  if (delayNode) delayNode.delayTime.value = fxDelayTime.value / 1000;
});
fxDelayFeedback.addEventListener('input', () => {
  fxDelayFeedbackVal.textContent = `${fxDelayFeedback.value}%`;
  if (delayFeedback) delayFeedback.gain.value = fxDelayFeedback.value / 100;
});

// Reverb FX
fxReverbToggle.addEventListener('change', applyReverbState);
fxReverbMix.addEventListener('input', () => { fxReverbMixVal.textContent = `${fxReverbMix.value}%`; applyReverbState(); });
fxReverbDecay.addEventListener('input', () => {
  const v = parseFloat(fxReverbDecay.value);
  fxReverbDecayVal.textContent = `${v.toFixed(1)}s`;
  if (audioCtx && reverbConvolver) reverbConvolver.buffer = generateReverbIR(audioCtx, v, 2);
});

// Voice Changer presets
voicePresetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    voicePresetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyVoicePreset(btn.dataset.voice);
  });
});

// Voice Changer custom sliders
vcRingFreqSlider.addEventListener('input', () => {
  vcRingFreqVal.textContent = `${vcRingFreqSlider.value} Hz`;
  if (vcRingOsc) vcRingOsc.frequency.value = parseFloat(vcRingFreqSlider.value) || 0.001;
});
vcFilterSlider.addEventListener('input', () => {
  vcFilterVal.textContent = `${vcFilterSlider.value} Hz`;
  if (vcFilter1) vcFilter1.frequency.value = parseFloat(vcFilterSlider.value);
});

// Karaoke controls
karaokeVolume.addEventListener('input', () => {
  karaokeVolVal.textContent = `${karaokeVolume.value}%`;
  if (karaokeGainNode) karaokeGainNode.gain.value = karaokeVolume.value / 100;
});
karaokeVocalRemove.addEventListener('change', applyVocalRemovalState);
karaokeReverbToggle.addEventListener('change', applyKaraokeReverbState);
karaokeReverbAmount.addEventListener('input', () => {
  karaokeReverbVal.textContent = `${karaokeReverbAmount.value}%`;
  applyKaraokeReverbState();
});

// Record
recordBtn.addEventListener('click', () => isRecording ? stopRecording() : startRecording());

// Input device change
inputSelect.addEventListener('change', async () => {
  if (isLive) { stopMic(); setTimeout(startMic, 150); }
});

// Output device change
outputSelect.addEventListener('change', async () => {
  try {
    if (audioCtx && typeof audioCtx.setSinkId === 'function') await audioCtx.setSinkId(outputSelect.value);
  } catch { showError('Could not switch output device.'); }
});

// Theme
themeBtn.addEventListener('click', toggleTheme);

// Shortcuts modal
helpBtn.addEventListener('click', openShortcuts);
modalClose.addEventListener('click', closeShortcuts);
shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) closeShortcuts(); });

// Visualizer mode
vizModeBtn.addEventListener('click', () => {
  vizMode = (vizMode + 1) % VIZ_MODES.length;
  vizModeText.textContent = VIZ_MODES[vizMode].charAt(0).toUpperCase() + VIZ_MODES[vizMode].slice(1);
  particles = [];
});

// Visualizer color
colorDots.forEach(dot => {
  dot.addEventListener('click', () => {
    colorDots.forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    vizColor = dot.dataset.color;
  });
});

// Canvas resize
window.addEventListener('resize', () => { if (isLive) resizeCanvas(); });

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  switch (e.code) {
    case 'Space': e.preventDefault(); isLive ? stopMic() : startMic(); break;
    case 'KeyR': if (isLive) isRecording ? stopRecording() : startRecording(); break;
    case 'KeyT': toggleTheme(); break;
    case 'KeyV': vizModeBtn.click(); break;
    case 'KeyM': if (isLive) toggleMute(); break;
    case 'ArrowUp': e.preventDefault(); gainSlider.value = Math.min(200, +gainSlider.value + 5); gainSlider.dispatchEvent(new Event('input')); break;
    case 'ArrowDown': e.preventDefault(); gainSlider.value = Math.max(0, +gainSlider.value - 5); gainSlider.dispatchEvent(new Event('input')); break;
    case 'Escape': closeShortcuts(); break;
  }
});

// Cleanup on leave
window.addEventListener('beforeunload', cleanupAudio);

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════

function init() {
  loadTheme();
  if (!checkBrowserSupport()) return;
  enumerateDevices();
  resizeCanvas();

  // Idle canvas text
  const W = vizCanvas.getBoundingClientRect().width;
  const H = vizCanvas.getBoundingClientRect().height;
  vizCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--clr-text-muted').trim() || '#8b8ba3';
  vizCtx.font = '12px Inter, sans-serif';
  vizCtx.textAlign = 'center';
  vizCtx.fillText('Start the microphone to see visualizations', W / 2, H / 2);
}

init();
