/**
 * ============================================================
 *  script.js — Mic Live Studio — Complete Application Logic
 * ============================================================
 *
 *  New in this version:
 *   1. Mobile Bluetooth fix: on mobile, audio is routed through
 *      a hidden <audio> element (srcObject) instead of directly
 *      to AudioContext.destination, so the OS Bluetooth audio
 *      session is respected (earpiece → BT speaker routing).
 *   2. Fullscreen visualizer via requestFullscreen() API.
 *   3. YouTube IFrame Player API karaoke mode — paste a URL,
 *      play/pause/seek/volume controls, no lyrics.
 *   4. Desktop 2-column layout — JS resize logic updated.
 *
 *  Audio signal chain (unchanged):
 *   Mic → Source → EQ → VoiceChanger → Distortion →
 *   Delay → Reverb → Gain → Analyser → [Output]
 *
 *  Output routing:
 *   Desktop (setSinkId supported): → AudioContext.destination
 *                                     + setSinkId for device pick
 *   Mobile (no setSinkId):         → MediaStreamDestinationNode
 *                                     → hidden <audio>.srcObject
 *                                     → OS audio session (BT)
 * ============================================================ */

'use strict';

// ── Quick DOM helper ────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── DOM refs ────────────────────────────────────────────────
const micBtn        = $('mic-btn'),  micBtnText = $('mic-btn-text'), micBtnIcon = $('mic-btn-icon');
const statusBadge   = $('status-badge');
const gainSlider    = $('gain-slider'), gainValue = $('gain-value'), muteBtn = $('mute-btn');
const levelBar      = $('level-bar-l'), levelDb = $('level-db');
const inputSelect   = $('input-select');
const outputSection = $('output-device-section'), outputSelect = $('output-select'), outputNote = $('output-note');
const recordBtn     = $('record-btn'), recordBtnText = $('record-btn-text'), recordIcon = $('record-icon');
const recordTimer   = $('record-timer');
const recordingsSection = $('recordings-section'), recordingsList = $('recordings-list');
const errorBox      = $('error-box'), errorText = $('error-text');
const browserWarn   = $('browser-warning'), browserWarnTx = $('browser-warning-text');
const themeBtn      = $('theme-btn'), themeIcon = $('theme-icon');
const helpBtn       = $('help-btn'), shortcutsModal = $('shortcuts-modal'), modalClose = $('modal-close');
const vizCanvas     = $('visualizer'), vizCtx = vizCanvas.getContext('2d');
const vizContainer  = $('viz-container');
const vizModeBtn    = $('viz-mode-btn'), vizModeText = $('viz-mode-text'), colorDots = document.querySelectorAll('.color-dot');
const vizFsBtn      = $('viz-fs-btn');
const fsBtnHeader   = $('fs-btn');
const pitchDisplay  = $('pitch-display'), pitchNote = $('pitch-note'), pitchFreq = $('pitch-freq'), pitchCents = $('pitch-cents');
const statsPanel    = $('stats-panel'), statSR = $('stat-sr'), statLatency = $('stat-latency'), statDuration = $('stat-duration');
const eqLowSlider   = $('eq-low'), eqMidSlider = $('eq-mid'), eqHighSlider = $('eq-high');
const eqLowVal      = $('eq-low-val'), eqMidVal = $('eq-mid-val'), eqHighVal = $('eq-high-val');
const eqResetBtn    = $('eq-reset');
const fxReverbToggle = $('fx-reverb-toggle'), fxReverbMix = $('fx-reverb-mix'), fxReverbMixVal = $('fx-reverb-mix-val');
const fxReverbDecay  = $('fx-reverb-decay'), fxReverbDecayVal = $('fx-reverb-decay-val');
const fxDelayToggle  = $('fx-delay-toggle'), fxDelayTime = $('fx-delay-time'), fxDelayTimeVal = $('fx-delay-time-val');
const fxDelayFeedback = $('fx-delay-feedback'), fxDelayFeedbackVal = $('fx-delay-feedback-val');
const fxDistortToggle = $('fx-distort-toggle'), fxDistortAmount = $('fx-distort-amount'), fxDistortAmountVal = $('fx-distort-amount-val');
const voicePresetBtns  = document.querySelectorAll('.voice-preset');
const vcCustomControls = $('voice-custom-controls');
const vcRingFreqSlider = $('vc-ring-freq'), vcRingFreqVal = $('vc-ring-freq-val');
const vcFilterSlider   = $('vc-filter-freq'), vcFilterVal = $('vc-filter-freq-val');
// Karaoke — file tab
const karaokeFile        = $('karaoke-file'), karaokeFilename = $('karaoke-filename');
const karaokeTransport   = $('karaoke-transport');
const karaokePlayBtn     = $('karaoke-play'), karaokeStopBtn = $('karaoke-stop');
const karaokeProgress    = $('karaoke-progress'), karaokeTime = $('karaoke-time');
const karaokeVolume      = $('karaoke-volume'), karaokeVolVal = $('karaoke-vol-val');
const karaokeVocalRemove = $('karaoke-vocal-remove');
const karaokeReverbToggle = $('karaoke-reverb-toggle'), karaokeReverbAmount = $('karaoke-reverb-amount'), karaokeReverbVal = $('karaoke-reverb-val');
// Karaoke — YouTube tab
const ytUrlInput   = $('yt-url-input');
const ytLoadBtn    = $('yt-load-btn');
const ytWrapper    = $('yt-player-wrapper');
const ytControls   = $('yt-controls');
const ytTitle      = $('yt-title');
const ytSeek       = $('yt-seek');
const ytCurTime    = $('yt-current-time');
const ytDurTime    = $('yt-duration');
const ytPlayPause  = $('yt-play-pause');
const ytStopBtn    = $('yt-stop');
const ytMuteBtn    = $('yt-mute-btn');
const ytVolSlider  = $('yt-vol-slider');
const ytFsBtn      = $('yt-fullscreen-btn');
// Karaoke tab buttons
const tabFileBtns  = document.querySelectorAll('.tab-btn');
const tabPanels    = document.querySelectorAll('.tab-panel');

// ── Mobile detection ────────────────────────────────────────
/**
 * On mobile browsers (iOS, Android), AudioContext.destination
 * ignores the OS Bluetooth audio session.
 * We detect mobile here and use a different routing strategy.
 */
const IS_MOBILE = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ── Application State ───────────────────────────────────────
let audioCtx = null, micStream = null, sourceNode = null;
let gainNode = null, analyser = null;
let eqLow = null, eqMid = null, eqHigh = null;

// FX nodes
let reverbConvolver = null, reverbDry = null, reverbWet = null, reverbMerge = null;
let delayNode = null, delayFeedback = null, delayDry = null, delayWet = null, delayMerge = null;
let distortionNode = null, distortDry = null, distortWet = null, distortMerge = null;

// Voice Changer nodes
let vcRingOsc = null, vcRingGain = null, vcFilter1 = null, vcFilter2 = null;
let vcTremOsc = null, vcTremGain = null;
let vcDry = null, vcWet = null, vcMerge = null;
let activeVoice = 'normal';

// Karaoke (file)
let karaokeAudio = null, karaokeSource = null;
let karaokeSplitter = null, karaokeMerger = null, karaokeGainNode = null;
let karaokeInverter = null, karaokeNormalGain = null, karaokeVocalGain = null;
let isMusicPlaying = false;

// Mobile Bluetooth routing
let mobileAudioEl = null;    // hidden <audio> element for mobile output
let mobileDestNode = null;   // MediaStreamDestinationNode for mobile

// General state
let meterRAF = null, isLive = false, isMuted = false, prevGain = 1;
let mediaRecorder = null, recordedChunks = [], isRecording = false;
let recordStartTime = 0, recordTimerInterval = null, recordingCount = 0;
let sessionStartTime = 0, sessionTimerInterval = null;

const VIZ_MODES   = ['waveform', 'bars', 'circular', 'particles'];
let vizMode = 0, vizColor = 'purple';
let particles = [];

const VIZ_COLORS = {
  purple: { primary: '#6c63ff', secondary: '#a78bfa', glow: 'rgba(108,99,255,.3)' },
  cyan:   { primary: '#22d3ee', secondary: '#67e8f9', glow: 'rgba(34,211,238,.3)'  },
  green:  { primary: '#34d399', secondary: '#6ee7b7', glow: 'rgba(52,211,153,.3)'  },
  fire:   { primary: '#f87171', secondary: '#fbbf24', glow: 'rgba(248,113,113,.3)' },
};

// YouTube state
let ytPlayer    = null;   // YT.Player instance
let ytAPIReady  = false;  // Has the IFrame API loaded?
let pendingVid  = null;   // Video ID to load once API is ready
let ytSeekRAF   = null;   // rAF loop for seek bar sync
let ytMuted     = false;

// ══════════════════════════════════════════════════════════════
//  BROWSER SUPPORT CHECK
// ══════════════════════════════════════════════════════════════
function checkBrowserSupport() {
  const missing = [];
  if (!navigator.mediaDevices?.getUserMedia) missing.push('getUserMedia');
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') missing.push('Web Audio API');
  if (missing.length) {
    browserWarnTx.textContent = `Your browser is missing: ${missing.join(', ')}. Please use Chrome or Edge.`;
    browserWarn.hidden = false; micBtn.disabled = true; return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  STATUS & ERROR
// ══════════════════════════════════════════════════════════════
function setStatus(state, text) {
  statusBadge.className = `status-badge status--${state}`;
  statusBadge.textContent = text || { idle: 'Idle', requesting: 'Requesting permission…', live: '● Live', stopped: 'Stopped', error: 'Error' }[state] || state;
}
function showError(msg) { errorText.textContent = msg; errorBox.hidden = false; setStatus('error'); }
function hideError()    { errorBox.hidden = true; }

// ══════════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════════
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('mic-live-theme', next); } catch {}
}
function loadTheme() {
  try { const s = localStorage.getItem('mic-live-theme'); if (s) { document.documentElement.setAttribute('data-theme', s); themeIcon.textContent = s === 'dark' ? '🌙' : '☀️'; } } catch {}
}

// ══════════════════════════════════════════════════════════════
//  FULLSCREEN
// ══════════════════════════════════════════════════════════════
/**
 * Toggle fullscreen on the visualizer container.
 * Uses the standard Fullscreen API (with webkit prefix fallback).
 * In fullscreen, the canvas stretches via :fullscreen CSS.
 */
function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const req = vizContainer.requestFullscreen || vizContainer.webkitRequestFullscreen;
    if (req) req.call(vizContainer);
  } else {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex) ex.call(document);
  }
}

function updateFsIcon() {
  const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const icon = inFs ? '✕' : '⛶';
  vizFsBtn.textContent   = icon;
  fsBtnHeader.querySelector('span') ? (fsBtnHeader.querySelector('span').textContent = icon) : (fsBtnHeader.textContent = icon);
  // Resize canvas whenever fullscreen changes
  resizeCanvas();
}

document.addEventListener('fullscreenchange',        updateFsIcon);
document.addEventListener('webkitfullscreenchange',  updateFsIcon);

// ══════════════════════════════════════════════════════════════
//  SHORTCUTS MODAL
// ══════════════════════════════════════════════════════════════
function openShortcuts()  { shortcutsModal.classList.add('open'); }
function closeShortcuts() { shortcutsModal.classList.remove('open'); }

// ══════════════════════════════════════════════════════════════
//  DEVICE ENUMERATION
// ══════════════════════════════════════════════════════════════
async function enumerateDevices() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();

    // Inputs
    const ins = devs.filter(d => d.kind === 'audioinput');
    const curIn = inputSelect.value;
    inputSelect.innerHTML = '';
    ins.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId; o.text = d.label || `Microphone ${i+1}`; inputSelect.appendChild(o); });
    if (curIn) inputSelect.value = curIn;

    // Outputs (desktop only — setSinkId check)
    if (!IS_MOBILE) {
      const testEl = document.createElement('audio');
      if (typeof testEl.setSinkId === 'function') {
        outputSection.hidden = false;
        const outs = devs.filter(d => d.kind === 'audiooutput');
        const curOut = outputSelect.value;
        outputSelect.innerHTML = '';
        outs.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId; o.text = d.label || `Speaker ${i+1}`; outputSelect.appendChild(o); });
        if (curOut) outputSelect.value = curOut;
      } else {
        outputNote.hidden = false;
      }
    } else {
      // On mobile: show a friendly note about BT routing
      outputNote.textContent = '📱 On mobile, audio automatically uses your connected Bluetooth speaker via the OS audio session.';
      outputNote.hidden = false;
    }
  } catch (err) { console.warn('enumerateDevices:', err); }
}

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
}

// ══════════════════════════════════════════════════════════════
//  AUDIO UTILITIES
// ══════════════════════════════════════════════════════════════
function generateReverbIR(ctx, duration = 2, decay = 2) {
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function makeDistortionCurve(amount = 50) {
  const k = amount * 4, n = 44100, curve = new Float32Array(n), deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// ══════════════════════════════════════════════════════════════
//  VOICE PRESETS
// ══════════════════════════════════════════════════════════════
const VOICE_PRESETS = {
  normal:     { ringFreq: 0,   ringGain: 0,    ringType: 'sine',     f1Type: 'allpass',  f1Freq: 1000, f1Q: 0,   f2Type: 'allpass',  f2Freq: 1000, f2Q: 0,   tremFreq: 0,   tremDepth: 0,   wetMix: 0,   dryMix: 1   },
  deep:       { ringFreq: 50,  ringGain: 0.3,  ringType: 'sine',     f1Type: 'lowpass',  f1Freq: 900,  f1Q: 2,   f2Type: 'lowshelf', f2Freq: 400,  f2Q: 0,   tremFreq: 0,   tremDepth: 0,   wetMix: 0.7, dryMix: 0.5, f2Gain: 8  },
  chipmunk:   { ringFreq: 400, ringGain: 0.45, ringType: 'sine',     f1Type: 'highpass', f1Freq: 800,  f1Q: 1,   f2Type: 'highshelf',f2Freq: 2000, f2Q: 0,   tremFreq: 0,   tremDepth: 0,   wetMix: 0.8, dryMix: 0.3, f2Gain: 10 },
  robot:      { ringFreq: 180, ringGain: 0.8,  ringType: 'square',   f1Type: 'bandpass', f1Freq: 1200, f1Q: 3,   f2Type: 'bandpass', f2Freq: 2400, f2Q: 2,   tremFreq: 0,   tremDepth: 0,   wetMix: 1,   dryMix: 0.1 },
  radio:      { ringFreq: 0,   ringGain: 0,    ringType: 'sine',     f1Type: 'bandpass', f1Freq: 1800, f1Q: 0.8, f2Type: 'highpass', f2Freq: 300,  f2Q: 0.7, tremFreq: 0,   tremDepth: 0,   wetMix: 1,   dryMix: 0   },
  underwater: { ringFreq: 0,   ringGain: 0,    ringType: 'sine',     f1Type: 'lowpass',  f1Freq: 500,  f1Q: 8,   f2Type: 'lowpass',  f2Freq: 700,  f2Q: 4,   tremFreq: 3,   tremDepth: 0.6, wetMix: 1,   dryMix: 0.15},
  alien:      { ringFreq: 300, ringGain: 0.7,  ringType: 'sawtooth', f1Type: 'bandpass', f1Freq: 2000, f1Q: 6,   f2Type: 'notch',    f2Freq: 800,  f2Q: 4,   tremFreq: 6,   tremDepth: 0.3, wetMix: 0.9, dryMix: 0.2 },
  cave:       { ringFreq: 60,  ringGain: 0.15, ringType: 'sine',     f1Type: 'lowpass',  f1Freq: 1200, f1Q: 5,   f2Type: 'peaking',  f2Freq: 600,  f2Q: 3,   tremFreq: 0.5, tremDepth: 0.15,wetMix: 0.75,dryMix: 0.5, f2Gain: 6  },
};

function applyVoicePreset(name) {
  activeVoice = name;
  const p = VOICE_PRESETS[name];
  if (!p || !audioCtx) return;
  if (vcRingOsc)  { vcRingOsc.frequency.value = p.ringFreq || 0.001; vcRingOsc.type = p.ringType || 'sine'; }
  if (vcRingGain) vcRingGain.gain.value = p.ringGain;
  if (vcFilter1)  { vcFilter1.type = p.f1Type; vcFilter1.frequency.value = p.f1Freq; vcFilter1.Q.value = p.f1Q; }
  if (vcFilter2)  { vcFilter2.type = p.f2Type; vcFilter2.frequency.value = p.f2Freq; vcFilter2.Q.value = p.f2Q || 0; vcFilter2.gain.value = p.f2Gain ?? 0; }
  if (vcTremOsc)  vcTremOsc.frequency.value = p.tremFreq || 0.001;
  if (vcTremGain) vcTremGain.gain.value = p.tremDepth;
  if (vcDry)  vcDry.gain.value = p.dryMix;
  if (vcWet)  vcWet.gain.value = p.wetMix;
  vcCustomControls.hidden = (name === 'normal');
  if (vcRingFreqSlider) { vcRingFreqSlider.value = p.ringFreq; vcRingFreqVal.textContent = `${p.ringFreq} Hz`; }
  if (vcFilterSlider)   { vcFilterSlider.value   = p.f1Freq;   vcFilterVal.textContent   = `${p.f1Freq} Hz`; }
}

// ══════════════════════════════════════════════════════════════
//  AUDIO GRAPH CONSTRUCTION
// ══════════════════════════════════════════════════════════════
function buildAudioGraph(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioCtx();

  sourceNode = audioCtx.createMediaStreamSource(stream);

  // EQ
  eqLow = audioCtx.createBiquadFilter(); eqLow.type = 'lowshelf';  eqLow.frequency.value = 320;  eqLow.gain.value = parseFloat(eqLowSlider.value);
  eqMid = audioCtx.createBiquadFilter(); eqMid.type = 'peaking';   eqMid.frequency.value = 1000; eqMid.Q.value = 0.5; eqMid.gain.value = parseFloat(eqMidSlider.value);
  eqHigh= audioCtx.createBiquadFilter(); eqHigh.type= 'highshelf'; eqHigh.frequency.value= 3200; eqHigh.gain.value = parseFloat(eqHighSlider.value);

  // Voice Changer oscillators
  vcRingOsc = audioCtx.createOscillator(); vcRingOsc.type = 'sine'; vcRingOsc.frequency.value = 0.001; vcRingOsc.start();
  vcRingGain = audioCtx.createGain(); vcRingGain.gain.value = 0;
  vcFilter1 = audioCtx.createBiquadFilter(); vcFilter1.type = 'allpass'; vcFilter1.frequency.value = 1000;
  vcFilter2 = audioCtx.createBiquadFilter(); vcFilter2.type = 'allpass'; vcFilter2.frequency.value = 1000;
  vcTremOsc  = audioCtx.createOscillator(); vcTremOsc.type = 'sine'; vcTremOsc.frequency.value = 0.001; vcTremOsc.start();
  vcTremGain = audioCtx.createGain(); vcTremGain.gain.value = 0;
  const vcTremTarget = audioCtx.createGain(); vcTremTarget.gain.value = 1;
  vcTremOsc.connect(vcTremGain); vcTremGain.connect(vcTremTarget.gain);
  vcDry = audioCtx.createGain(); vcDry.gain.value = 1;
  vcWet = audioCtx.createGain(); vcWet.gain.value = 0;
  vcMerge = audioCtx.createGain();
  const vcRingModGain = audioCtx.createGain(); vcRingModGain.gain.value = 0;
  vcRingOsc.connect(vcRingModGain.gain);

  // Distortion
  distortionNode = audioCtx.createWaveShaper(); distortionNode.curve = makeDistortionCurve(parseFloat(fxDistortAmount.value)); distortionNode.oversample = '4x';
  distortDry = audioCtx.createGain(); distortDry.gain.value = 1;
  distortWet = audioCtx.createGain(); distortWet.gain.value = 0;
  distortMerge = audioCtx.createGain();

  // Delay
  delayNode = audioCtx.createDelay(2.0); delayNode.delayTime.value = parseFloat(fxDelayTime.value) / 1000;
  delayFeedback = audioCtx.createGain(); delayFeedback.gain.value = parseFloat(fxDelayFeedback.value) / 100;
  delayDry = audioCtx.createGain(); delayDry.gain.value = 1;
  delayWet = audioCtx.createGain(); delayWet.gain.value = 0;
  delayMerge = audioCtx.createGain();
  delayNode.connect(delayFeedback); delayFeedback.connect(delayNode);

  // Reverb
  reverbConvolver = audioCtx.createConvolver(); reverbConvolver.buffer = generateReverbIR(audioCtx, parseFloat(fxReverbDecay.value), 2);
  reverbDry = audioCtx.createGain(); reverbDry.gain.value = 1;
  reverbWet = audioCtx.createGain(); reverbWet.gain.value = 0;
  reverbMerge = audioCtx.createGain();

  // Gain + Analyser
  gainNode = audioCtx.createGain(); gainNode.gain.value = isMuted ? 0 : gainSlider.value / 100;
  analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;

  // ── Connect chain ──
  sourceNode.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh);

  // Voice changer (wet path)
  eqHigh.connect(vcFilter1); vcFilter1.connect(vcRingModGain); vcRingModGain.connect(vcFilter2); vcFilter2.connect(vcTremTarget); vcTremTarget.connect(vcWet); vcWet.connect(vcMerge);
  // Voice changer (dry path)
  eqHigh.connect(vcDry); vcDry.connect(vcMerge);

  // Distortion
  vcMerge.connect(distortDry); vcMerge.connect(distortionNode); distortionNode.connect(distortWet); distortDry.connect(distortMerge); distortWet.connect(distortMerge);

  // Delay
  distortMerge.connect(delayDry); distortMerge.connect(delayNode); delayNode.connect(delayWet); delayDry.connect(delayMerge); delayWet.connect(delayMerge);

  // Reverb
  delayMerge.connect(reverbDry); delayMerge.connect(reverbConvolver); reverbConvolver.connect(reverbWet); reverbDry.connect(reverbMerge); reverbWet.connect(reverbMerge);

  // Gain + Analyser
  reverbMerge.connect(gainNode); gainNode.connect(analyser);

  // ── OUTPUT ROUTING ──────────────────────────────────────
  if (IS_MOBILE) {
    /**
     * MOBILE BLUETOOTH FIX:
     * AudioContext.destination on iOS/Android ignores the OS
     * Bluetooth audio session and always uses the built-in speaker.
     *
     * The fix: route audio through a MediaStreamDestinationNode
     * and feed it into a hidden <audio> element via srcObject.
     * The <audio> element respects the OS audio session routing,
     * so Bluetooth speakers are used automatically when connected.
     */
    mobileDestNode = audioCtx.createMediaStreamDestination();
    analyser.connect(mobileDestNode);

    mobileAudioEl = document.createElement('audio');
    mobileAudioEl.srcObject = mobileDestNode.stream;
    mobileAudioEl.autoplay   = true;
    mobileAudioEl.playsInline = true;
    mobileAudioEl.muted       = false;
    document.body.appendChild(mobileAudioEl);
    mobileAudioEl.play().catch(err => console.warn('Mobile audio play():', err));
  } else {
    // Desktop: connect to AudioContext.destination directly
    analyser.connect(audioCtx.destination);

    // Apply output device selection (setSinkId) if supported
    if (outputSelect.value && typeof audioCtx.setSinkId === 'function') {
      audioCtx.setSinkId(outputSelect.value).catch(() => {});
    }
  }

  // Apply FX initial states and voice preset
  applyDistortionState(); applyDelayState(); applyReverbState();
  applyVoicePreset(activeVoice);

  // Wire up karaoke if file was loaded
  setupKaraokeAudioChain();
}

// ══════════════════════════════════════════════════════════════
//  FX TOGGLES
// ══════════════════════════════════════════════════════════════
function applyDistortionState() {
  if (!distortDry) return;
  const on = fxDistortToggle.checked;
  distortDry.gain.value = on ? 0 : 1; distortWet.gain.value = on ? 1 : 0;
}
function applyDelayState() {
  if (!delayDry) return;
  const on = fxDelayToggle.checked;
  delayDry.gain.value = on ? 0.6 : 1; delayWet.gain.value = on ? 0.4 : 0;
}
function applyReverbState() {
  if (!reverbDry) return;
  const on = fxReverbToggle.checked, mix = parseFloat(fxReverbMix.value) / 100;
  reverbDry.gain.value = on ? (1 - mix) : 1; reverbWet.gain.value = on ? mix : 0;
}

// ══════════════════════════════════════════════════════════════
//  KARAOKE AUDIO CHAIN (file mode)
// ══════════════════════════════════════════════════════════════
function setupKaraokeAudioChain() {
  if (!audioCtx || !karaokeAudio || karaokeSource) return;
  try { karaokeSource = audioCtx.createMediaElementSource(karaokeAudio); } catch { return; }

  karaokeGainNode = audioCtx.createGain(); karaokeGainNode.gain.value = parseFloat(karaokeVolume.value) / 100;
  karaokeNormalGain = audioCtx.createGain(); karaokeNormalGain.gain.value = 1;
  karaokeVocalGain  = audioCtx.createGain(); karaokeVocalGain.gain.value  = 0;
  karaokeSplitter   = audioCtx.createChannelSplitter(2);
  karaokeMerger     = audioCtx.createChannelMerger(2);
  karaokeInverter   = audioCtx.createGain(); karaokeInverter.gain.value = -1;
  const inv2 = audioCtx.createGain(); inv2.gain.value = -1;

  karaokeSource.connect(karaokeSplitter);
  karaokeSplitter.connect(karaokeMerger, 0, 0); karaokeSplitter.connect(karaokeInverter, 1); karaokeInverter.connect(karaokeMerger, 0, 0);
  karaokeSplitter.connect(karaokeMerger, 0, 1); karaokeSplitter.connect(inv2, 1); inv2.connect(karaokeMerger, 0, 1);
  karaokeMerger.connect(karaokeVocalGain);
  karaokeSource.connect(karaokeNormalGain);
  karaokeNormalGain.connect(karaokeGainNode); karaokeVocalGain.connect(karaokeGainNode);
  karaokeGainNode.connect(audioCtx.destination);
  applyVocalRemovalState();
}

function applyVocalRemovalState() {
  if (!karaokeNormalGain || !karaokeVocalGain) return;
  const on = karaokeVocalRemove.checked;
  karaokeNormalGain.gain.value = on ? 0 : 1; karaokeVocalGain.gain.value = on ? 1 : 0;
}

function applyKaraokeReverbState() {
  if (!reverbDry) return;
  const on = karaokeReverbToggle.checked, mix = parseFloat(karaokeReverbAmount.value) / 100;
  if (on && !fxReverbToggle.checked) { reverbDry.gain.value = 1 - mix; reverbWet.gain.value = mix; }
}

// ══════════════════════════════════════════════════════════════
//  LEVEL METER & VISUALIZER
// ══════════════════════════════════════════════════════════════
function startMeter() {
  const data = new Uint8Array(analyser.fftSize);
  function tick() {
    analyser.getByteTimeDomainData(data);
    let sq = 0;
    for (let i = 0; i < data.length; i++) { const s = (data[i] - 128) / 128; sq += s * s; }
    const rms = Math.sqrt(sq / data.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const pct = ((Math.max(db, -60) + 60) / 60) * 100;
    levelBar.style.width = `${pct}%`;
    levelDb.textContent = isFinite(db) ? `${db.toFixed(1)} dB` : '–∞ dB';
    drawVisualizer(); detectPitch();
    meterRAF = requestAnimationFrame(tick);
  }
  tick();
}
function stopMeter() { if (meterRAF) { cancelAnimationFrame(meterRAF); meterRAF = null; } levelBar.style.width = '0%'; levelDb.textContent = '–∞ dB'; }

// ── Canvas resize ───────────────────────────────────────────
function resizeCanvas() {
  const r = vizCanvas.getBoundingClientRect();
  vizCanvas.width  = r.width  * window.devicePixelRatio;
  vizCanvas.height = r.height * window.devicePixelRatio;
  vizCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// ── Visualizer dispatch ─────────────────────────────────────
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
  const buf = analyser.fftSize, d = new Uint8Array(buf); analyser.getByteTimeDomainData(d);
  vizCtx.shadowBlur = 8; vizCtx.shadowColor = c.glow; vizCtx.lineWidth = 2; vizCtx.strokeStyle = c.primary;
  vizCtx.beginPath(); const sw = W / buf; let x = 0;
  for (let i = 0; i < buf; i++) { const y = (d[i] / 128) * H / 2; i ? vizCtx.lineTo(x, y) : vizCtx.moveTo(x, y); x += sw; }
  vizCtx.lineTo(W, H / 2); vizCtx.stroke();
  vizCtx.globalAlpha = 0.25; vizCtx.strokeStyle = c.secondary; vizCtx.lineWidth = 1;
  vizCtx.beginPath(); x = 0;
  for (let i = 0; i < buf; i++) { const y = (d[i] / 128) * H / 2 + 2; i ? vizCtx.lineTo(x, y) : vizCtx.moveTo(x, y); x += sw; }
  vizCtx.stroke(); vizCtx.globalAlpha = 1; vizCtx.shadowBlur = 0;
}

function drawBars(W, H, c) {
  const bin = analyser.frequencyBinCount, d = new Uint8Array(bin); analyser.getByteFrequencyData(d);
  const n = 64, bw = W / n - 1, step = Math.floor(bin / n);
  for (let i = 0; i < n; i++) {
    const bh = (d[i * step] / 255) * H, g = vizCtx.createLinearGradient(0, H, 0, H - bh);
    g.addColorStop(0, c.primary); g.addColorStop(1, c.secondary);
    vizCtx.fillStyle = g; vizCtx.shadowBlur = 4; vizCtx.shadowColor = c.glow;
    vizCtx.fillRect(i * (bw + 1), H - bh, bw, bh);
  }
  vizCtx.shadowBlur = 0;
}

function drawCircular(W, H, c) {
  const bin = analyser.frequencyBinCount, d = new Uint8Array(bin); analyser.getByteFrequencyData(d);
  const cx = W/2, cy = H/2, br = Math.min(W,H)*.2, mr = Math.min(W,H)*.45, bars = 90, step = Math.floor(bin/bars);
  vizCtx.shadowBlur = 6; vizCtx.shadowColor = c.glow;
  for (let i = 0; i < bars; i++) {
    const v = d[i*step]/255, a = (i/bars)*Math.PI*2 - Math.PI/2, r = br + v*(mr-br);
    vizCtx.beginPath(); vizCtx.moveTo(cx+Math.cos(a)*br, cy+Math.sin(a)*br); vizCtx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    vizCtx.lineWidth = 2; vizCtx.strokeStyle = v>.6 ? c.secondary : c.primary; vizCtx.globalAlpha = .3+v*.7; vizCtx.stroke();
  }
  vizCtx.globalAlpha = 1; vizCtx.shadowBlur = 0;
}

function initParticles(W, H) { particles = []; for (let i=0;i<80;i++) particles.push({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.5, vy:(Math.random()-.5)*.5, r:Math.random()*2+1 }); }

function drawParticles(W, H, c) {
  const bin = analyser.frequencyBinCount, d = new Uint8Array(bin); analyser.getByteFrequencyData(d);
  let s = 0; for (const v of d) s += v; const avg = s / bin / 255;
  if (!particles.length) initParticles(W, H);
  vizCtx.shadowBlur = 4; vizCtx.shadowColor = c.glow;
  for (const p of particles) {
    p.x += p.vx*(1+avg*6); p.y += p.vy*(1+avg*6);
    if (p.x<0) p.x=W; if (p.x>W) p.x=0; if (p.y<0) p.y=H; if (p.y>H) p.y=0;
    vizCtx.beginPath(); vizCtx.arc(p.x, p.y, p.r+avg*3, 0, Math.PI*2);
    vizCtx.fillStyle = c.primary; vizCtx.globalAlpha = .4+avg*.6; vizCtx.fill();
  }
  vizCtx.lineWidth = .5; vizCtx.strokeStyle = c.secondary; vizCtx.globalAlpha = .08+avg*.15;
  for (let i=0;i<particles.length;i++) for (let j=i+1;j<particles.length;j++) {
    const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
    if (Math.sqrt(dx*dx+dy*dy)<60+avg*40) { vizCtx.beginPath(); vizCtx.moveTo(particles[i].x,particles[i].y); vizCtx.lineTo(particles[j].x,particles[j].y); vizCtx.stroke(); }
  }
  vizCtx.globalAlpha=1; vizCtx.shadowBlur=0;
}

// ══════════════════════════════════════════════════════════════
//  PITCH DETECTION
// ══════════════════════════════════════════════════════════════
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
let pitchFrameCount = 0;
function detectPitch() {
  if (++pitchFrameCount % 3 !== 0) return;
  const bufLen = analyser.fftSize, data = new Float32Array(bufLen);
  analyser.getFloatTimeDomainData(data);
  let rms = 0; for (const s of data) rms += s*s; rms = Math.sqrt(rms/bufLen);
  if (rms < 0.01) { pitchNote.textContent='—'; pitchFreq.textContent='— Hz'; pitchCents.style.left='50%'; return; }
  const sr = audioCtx.sampleRate, minP = Math.floor(sr/1500), maxP = Math.floor(sr/50);
  let best = -1, off = -1;
  for (let o = minP; o < maxP && o < bufLen; o++) {
    let c = 0; for (let i = 0; i < bufLen-o; i++) c += Math.abs(data[i]-data[i+o]);
    c = 1-c/(bufLen-o); if (c > best) { best=c; off=o; }
  }
  if (best > 0.9 && off > 0) {
    const freq = sr/off, n = 12*Math.log2(freq/440)+69, r = Math.round(n), cents = Math.round((n-r)*100);
    pitchNote.textContent = `${NOTE_NAMES[r%12]}${Math.floor(r/12)-1}`;
    pitchFreq.textContent = `${freq.toFixed(1)} Hz`;
    pitchCents.style.left = `${Math.max(5,Math.min(95,((cents+50)/100)*100))}%`;
  }
}

// ══════════════════════════════════════════════════════════════
//  SESSION TIMER
// ══════════════════════════════════════════════════════════════
const fmt = (s) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
function startSessionTimer() { sessionStartTime=Date.now(); sessionTimerInterval=setInterval(()=>{ const e=Math.floor((Date.now()-sessionStartTime)/1e3); statDuration.textContent=fmt(e); },1000); }
function stopSessionTimer()  { clearInterval(sessionTimerInterval); }

// ══════════════════════════════════════════════════════════════
//  START / STOP MIC
// ══════════════════════════════════════════════════════════════
async function startMic() {
  hideError(); setStatus('requesting');
  const constraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: false };
  if (inputSelect.value) constraints.deviceId = { exact: inputSelect.value };
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
  } catch (err) {
    if (err.name==='NotAllowedError')     showError('Microphone permission denied. Please allow access.');
    else if (err.name==='NotFoundError')  showError('No microphone found. Please connect one.');
    else                                  showError(`Mic error: ${err.message}`);
    setStatus('idle'); return;
  }
  try {
    buildAudioGraph(micStream); resizeCanvas(); startMeter(); await enumerateDevices();
    statsPanel.hidden = false; statSR.textContent = `${audioCtx.sampleRate/1000}k`;
    statLatency.textContent = `${(audioCtx.baseLatency*1000).toFixed(0)}ms`;
    startSessionTimer(); pitchDisplay.hidden = false;
    isLive = true;
    micBtn.classList.add('btn--active'); micBtnText.textContent='Stop Microphone'; micBtnIcon.textContent='⏹️';
    recordBtn.disabled = false; setStatus('live');
  } catch (err) { showError(`Audio setup failed: ${err.message}`); cleanupAudio(); setStatus('error'); }
}

function stopMic() {
  if (isMusicPlaying) { karaokeAudio?.pause(); isMusicPlaying=false; karaokePlayBtn.textContent='▶️'; }
  cleanupAudio();
  isLive=false; micBtn.classList.remove('btn--active'); micBtnText.textContent='Start Microphone'; micBtnIcon.textContent='🎤';
  recordBtn.disabled=true; statsPanel.hidden=true; pitchDisplay.hidden=true;
  stopSessionTimer(); setStatus('stopped');
  if (isRecording) stopRecording();
  vizCtx.clearRect(0, 0, vizCanvas.getBoundingClientRect().width, vizCanvas.getBoundingClientRect().height);
}

function cleanupAudio() {
  stopMeter();
  try { vcRingOsc?.stop(); } catch {}
  try { vcTremOsc?.stop(); } catch {}
  const nodes = [
    sourceNode,eqLow,eqMid,eqHigh,
    vcRingOsc,vcRingGain,vcFilter1,vcFilter2,vcTremOsc,vcTremGain,vcDry,vcWet,vcMerge,
    distortionNode,distortDry,distortWet,distortMerge,
    delayNode,delayFeedback,delayDry,delayWet,delayMerge,
    reverbConvolver,reverbDry,reverbWet,reverbMerge,
    gainNode,analyser,mobileDestNode,
    karaokeSource,karaokeSplitter,karaokeMerger,karaokeGainNode,
    karaokeInverter,karaokeNormalGain,karaokeVocalGain,
  ];
  for (const n of nodes) { try { n?.disconnect(); } catch {} }
  if (micStream) { micStream.getTracks().forEach(t=>t.stop()); micStream=null; }
  if (audioCtx && audioCtx.state!=='closed') { audioCtx.close().catch(()=>{}); audioCtx=null; }

  // Remove mobile audio element
  if (mobileAudioEl) { mobileAudioEl.srcObject=null; mobileAudioEl.remove(); mobileAudioEl=null; }
  mobileDestNode=null;

  sourceNode=gainNode=analyser=eqLow=eqMid=eqHigh=null;
  vcRingOsc=vcRingGain=vcFilter1=vcFilter2=vcTremOsc=vcTremGain=vcDry=vcWet=vcMerge=null;
  distortionNode=distortDry=distortWet=distortMerge=null;
  delayNode=delayFeedback=delayDry=delayWet=delayMerge=null;
  reverbConvolver=reverbDry=reverbWet=reverbMerge=null;
  karaokeSource=karaokeSplitter=karaokeMerger=karaokeGainNode=karaokeInverter=karaokeNormalGain=karaokeVocalGain=null;
}

// ══════════════════════════════════════════════════════════════
//  RECORDING
// ══════════════════════════════════════════════════════════════
function startRecording() {
  if (!audioCtx||!analyser) return;
  try {
    const dest = audioCtx.createMediaStreamDestination(); analyser.connect(dest);
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRecorder = new MediaRecorder(dest.stream, { mimeType: mime }); recordedChunks=[];
    mediaRecorder.ondataavailable = e => { if (e.data.size>0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => addRecordingToList(new Blob(recordedChunks, { type: mime }));
    mediaRecorder.start(); isRecording=true; recordStartTime=Date.now();
    recordBtn.classList.add('btn--recording'); recordBtnText.textContent='Stop Recording'; recordIcon.textContent='⏹️';
    recordTimer.hidden=false;
    recordTimerInterval = setInterval(()=>{ recordTimer.textContent=fmt(Math.floor((Date.now()-recordStartTime)/1e3)); }, 1000);
  } catch (err) { showError(`Recording failed: ${err.message}`); }
}
function stopRecording() {
  if (mediaRecorder?.state!=='inactive') mediaRecorder.stop();
  clearInterval(recordTimerInterval); isRecording=false;
  recordBtn.classList.remove('btn--recording'); recordBtnText.textContent='Record'; recordIcon.textContent='⏺️';
  recordTimer.hidden=true; recordTimer.textContent='0:00';
}
function addRecordingToList(blob) {
  recordingCount++;
  const url = URL.createObjectURL(blob); recordingsSection.hidden=false;
  const li = document.createElement('li'); li.className='recording-item';
  li.innerHTML=`<span style="font-weight:600;font-size:.72rem;min-width:24px">#${recordingCount}</span><audio src="${url}" controls preload="metadata" style="flex:1;height:28px;min-width:0"></audio><a href="${url}" download="mic-recording-${recordingCount}.webm" title="Download">⬇️</a>`;
  recordingsList.appendChild(li);
}

// ══════════════════════════════════════════════════════════════
//  MUTE
// ══════════════════════════════════════════════════════════════
function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) { prevGain=gainSlider.value/100; if (gainNode) gainNode.gain.value=0; muteBtn.textContent='🔇'; }
  else         { if (gainNode) gainNode.gain.value=prevGain; muteBtn.textContent='🔊'; }
}

// ══════════════════════════════════════════════════════════════
//  KARAOKE — FILE TAB
// ══════════════════════════════════════════════════════════════
karaokeFile.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  karaokeFilename.textContent=file.name; karaokeTransport.hidden=false;
  if (karaokeAudio) { karaokeAudio.pause(); URL.revokeObjectURL(karaokeAudio.src); }
  karaokeAudio = new Audio(); karaokeAudio.crossOrigin='anonymous'; karaokeAudio.src=URL.createObjectURL(file); karaokeAudio.preload='auto';
  karaokeSource = null;
  if (audioCtx) setupKaraokeAudioChain();
  karaokeAudio.addEventListener('timeupdate', () => {
    const c=karaokeAudio.currentTime, d=karaokeAudio.duration||0;
    karaokeProgress.style.width=`${d>0?(c/d)*100:0}%`;
    karaokeTime.textContent=`${fmt(c)} / ${fmt(d)}`;
  });
  karaokeAudio.addEventListener('ended', ()=>{ isMusicPlaying=false; karaokePlayBtn.textContent='▶️'; });
});
karaokePlayBtn.addEventListener('click', () => {
  if (!karaokeAudio) return;
  if (!audioCtx) { showError('Start the microphone first to enable karaoke playback.'); return; }
  setupKaraokeAudioChain();
  if (isMusicPlaying) { karaokeAudio.pause(); isMusicPlaying=false; karaokePlayBtn.textContent='▶️'; }
  else { karaokeAudio.play(); isMusicPlaying=true; karaokePlayBtn.textContent='⏸️'; }
});
karaokeStopBtn.addEventListener('click', () => {
  if (karaokeAudio) { karaokeAudio.pause(); karaokeAudio.currentTime=0; }
  isMusicPlaying=false; karaokePlayBtn.textContent='▶️'; karaokeProgress.style.width='0%';
});
karaokeVolume.addEventListener('input', () => { karaokeVolVal.textContent=`${karaokeVolume.value}%`; if (karaokeGainNode) karaokeGainNode.gain.value=karaokeVolume.value/100; });
karaokeVocalRemove.addEventListener('change', applyVocalRemovalState);
karaokeReverbToggle.addEventListener('change', applyKaraokeReverbState);
karaokeReverbAmount.addEventListener('input', () => { karaokeReverbVal.textContent=`${karaokeReverbAmount.value}%`; applyKaraokeReverbState(); });

// ══════════════════════════════════════════════════════════════
//  KARAOKE TABS
// ══════════════════════════════════════════════════════════════
tabFileBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabFileBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${target}`)?.classList.add('active');
    // Load YouTube API lazily when the tab is first opened
    if (target === 'youtube') loadYouTubeAPI();
  });
});

// ══════════════════════════════════════════════════════════════
//  YOUTUBE IFRAME API
// ══════════════════════════════════════════════════════════════

/**
 * Extract a YouTube video ID from various URL formats:
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 */
function extractYouTubeId(url) {
  try {
    const u = new URL(url.trim());
    // youtu.be short link
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    // youtube.com variants
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (['embed','shorts'].includes(parts[0]) && parts[1]) return parts[1];
    }
  } catch {}
  // Raw video ID (11 chars)
  const m = url.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Load the YouTube IFrame API script exactly once. */
function loadYouTubeAPI() {
  if (window.YT?.Player || document.getElementById('yt-api-script')) return;
  const s = document.createElement('script');
  s.id  = 'yt-api-script';
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
}

/**
 * Called automatically by the YouTube IFrame API when it has loaded.
 * If a video was requested before the API was ready, load it now.
 */
window.onYouTubeIframeAPIReady = function () {
  ytAPIReady = true;
  if (pendingVid) { createYTPlayer(pendingVid); pendingVid = null; }
};

/** Create or reload the YT.Player instance for a given video ID. */
function createYTPlayer(videoId) {
  if (ytPlayer) {
    ytPlayer.loadVideoById(videoId);
    ytWrapper.hidden = false;
    return;
  }
  ytWrapper.hidden = false;
  ytPlayer = new YT.Player('yt-player', {
    height: '100%',
    width:  '100%',
    videoId,
    playerVars: {
      controls:        0,    // Hide YouTube controls — we use custom ones
      disablekb:       1,
      rel:             0,
      modestbranding:  1,
      iv_load_policy:  3,
      playsinline:     1,    // Prevents fullscreen takeover on iOS
    },
    events: {
      onReady:       onYTReady,
      onStateChange: onYTStateChange,
    },
  });
}

function onYTReady(event) {
  // Sync volume slider with player volume
  event.target.setVolume(parseInt(ytVolSlider.value, 10));
  ytTitle.textContent = ytPlayer.getVideoData()?.title || '—';
  ytSeek.max = Math.floor(ytPlayer.getDuration()) || 100;
  startYTSeekSync();
}

function onYTStateChange(event) {
  const S = YT.PlayerState;
  if (event.data === S.PLAYING) { ytPlayPause.textContent = '⏸️'; }
  else if (event.data === S.ENDED || event.data === S.PAUSED) { ytPlayPause.textContent = '▶️'; }
}

/**
 * Poll the YouTube player every 500ms to update the seek bar
 * and time display (IFrame API has no native time event).
 */
function startYTSeekSync() {
  if (ytSeekRAF) clearInterval(ytSeekRAF);
  ytSeekRAF = setInterval(() => {
    if (!ytPlayer?.getCurrentTime) return;
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration();
    if (dur > 0) {
      ytSeek.max   = Math.floor(dur);
      ytSeek.value = Math.floor(cur);
      ytCurTime.textContent = fmt(cur);
      ytDurTime.textContent = fmt(dur);
    }
  }, 500);
}

// YouTube button handlers
ytLoadBtn.addEventListener('click', () => {
  const url = ytUrlInput.value.trim();
  if (!url) return;
  const vid = extractYouTubeId(url);
  if (!vid) { showError('Invalid YouTube URL — please paste a valid link.'); return; }
  hideError();
  if (!ytAPIReady) { pendingVid = vid; loadYouTubeAPI(); return; }
  createYTPlayer(vid);
});

// Allow pressing Enter in the URL input to load
ytUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ytLoadBtn.click(); });

ytPlayPause.addEventListener('click', () => {
  if (!ytPlayer) return;
  ytPlayer.getPlayerState() === YT.PlayerState.PLAYING ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
});

ytStopBtn.addEventListener('click', () => {
  if (!ytPlayer) return; ytPlayer.stopVideo(); ytPlayPause.textContent = '▶️';
});

ytMuteBtn.addEventListener('click', () => {
  if (!ytPlayer) return;
  ytMuted = !ytMuted;
  ytMuted ? ytPlayer.mute() : ytPlayer.unMute();
  ytMuteBtn.textContent = ytMuted ? '🔇' : '🔊';
});

ytVolSlider.addEventListener('input', () => { if (ytPlayer) ytPlayer.setVolume(parseInt(ytVolSlider.value,10)); });

ytSeek.addEventListener('input', () => { if (ytPlayer) ytPlayer.seekTo(parseInt(ytSeek.value,10), true); });

ytFsBtn.addEventListener('click', () => {
  // Request fullscreen on the YouTube player's iframe
  const iframe = ytWrapper.querySelector('iframe');
  if (iframe) {
    const req = iframe.requestFullscreen || iframe.webkitRequestFullscreen || iframe.mozRequestFullScreen;
    if (req) req.call(iframe);
  }
});

// ══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  switch (e.code) {
    case 'Space':     e.preventDefault(); isLive ? stopMic() : startMic(); break;
    case 'KeyR':      if (isLive) isRecording ? stopRecording() : startRecording(); break;
    case 'KeyT':      toggleTheme(); break;
    case 'KeyV':      vizModeBtn.click(); break;
    case 'KeyM':      if (isLive) toggleMute(); break;
    case 'KeyF':      toggleFullscreen(); break;
    case 'ArrowUp':   e.preventDefault(); gainSlider.value=Math.min(200,+gainSlider.value+5); gainSlider.dispatchEvent(new Event('input')); break;
    case 'ArrowDown': e.preventDefault(); gainSlider.value=Math.max(0,+gainSlider.value-5);   gainSlider.dispatchEvent(new Event('input')); break;
    case 'Escape':    closeShortcuts(); break;
  }
});

// ══════════════════════════════════════════════════════════════
//  STANDARD EVENT LISTENERS
// ══════════════════════════════════════════════════════════════
micBtn.addEventListener('click', () => isLive ? stopMic() : startMic());

gainSlider.addEventListener('input', () => {
  gainValue.textContent=`${gainSlider.value} %`;
  if (!isMuted && gainNode) gainNode.gain.value = gainSlider.value/100;
  if (!isMuted) muteBtn.textContent = gainSlider.value==0 ? '🔇' : '🔊';
});
muteBtn.addEventListener('click', toggleMute);

eqLowSlider.addEventListener('input',  () => { eqLowVal.textContent  = `${eqLowSlider.value} dB`;  if (eqLow)  eqLow.gain.value  = eqLowSlider.value; });
eqMidSlider.addEventListener('input',  () => { eqMidVal.textContent  = `${eqMidSlider.value} dB`;  if (eqMid)  eqMid.gain.value  = eqMidSlider.value; });
eqHighSlider.addEventListener('input', () => { eqHighVal.textContent = `${eqHighSlider.value} dB`; if (eqHigh) eqHigh.gain.value = eqHighSlider.value; });
eqResetBtn.addEventListener('click', () => { [eqLowSlider,eqMidSlider,eqHighSlider].forEach(s=>{ s.value=0; s.dispatchEvent(new Event('input')); }); });

fxDistortToggle.addEventListener('change', applyDistortionState);
fxDistortAmount.addEventListener('input', () => { fxDistortAmountVal.textContent=fxDistortAmount.value; if (distortionNode) distortionNode.curve=makeDistortionCurve(parseFloat(fxDistortAmount.value)); });
fxDelayToggle.addEventListener('change', applyDelayState);
fxDelayTime.addEventListener('input', () => { fxDelayTimeVal.textContent=`${fxDelayTime.value}ms`; if (delayNode) delayNode.delayTime.value=fxDelayTime.value/1000; });
fxDelayFeedback.addEventListener('input', () => { fxDelayFeedbackVal.textContent=`${fxDelayFeedback.value}%`; if (delayFeedback) delayFeedback.gain.value=fxDelayFeedback.value/100; });
fxReverbToggle.addEventListener('change', applyReverbState);
fxReverbMix.addEventListener('input', () => { fxReverbMixVal.textContent=`${fxReverbMix.value}%`; applyReverbState(); });
fxReverbDecay.addEventListener('input', () => { const v=parseFloat(fxReverbDecay.value); fxReverbDecayVal.textContent=`${v.toFixed(1)}s`; if (audioCtx&&reverbConvolver) reverbConvolver.buffer=generateReverbIR(audioCtx,v,2); });

voicePresetBtns.forEach(btn => btn.addEventListener('click', () => { voicePresetBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); applyVoicePreset(btn.dataset.voice); }));
vcRingFreqSlider.addEventListener('input', () => { vcRingFreqVal.textContent=`${vcRingFreqSlider.value} Hz`; if (vcRingOsc) vcRingOsc.frequency.value=parseFloat(vcRingFreqSlider.value)||.001; });
vcFilterSlider.addEventListener('input',   () => { vcFilterVal.textContent=`${vcFilterSlider.value} Hz`;   if (vcFilter1) vcFilter1.frequency.value=parseFloat(vcFilterSlider.value); });

recordBtn.addEventListener('click', () => isRecording ? stopRecording() : startRecording());
inputSelect.addEventListener('change', async () => { if (isLive) { stopMic(); setTimeout(startMic,150); } });
outputSelect.addEventListener('change', async () => { try { if (audioCtx&&typeof audioCtx.setSinkId==='function') await audioCtx.setSinkId(outputSelect.value); } catch { showError('Could not switch output device.'); } });

themeBtn.addEventListener('click', toggleTheme);
helpBtn.addEventListener('click', openShortcuts);
modalClose.addEventListener('click', closeShortcuts);
shortcutsModal.addEventListener('click', e => { if (e.target===shortcutsModal) closeShortcuts(); });

vizModeBtn.addEventListener('click', () => { vizMode=(vizMode+1)%VIZ_MODES.length; vizModeText.textContent=VIZ_MODES[vizMode].charAt(0).toUpperCase()+VIZ_MODES[vizMode].slice(1); particles=[]; });
colorDots.forEach(d => d.addEventListener('click', () => { colorDots.forEach(x=>x.classList.remove('active')); d.classList.add('active'); vizColor=d.dataset.color; }));

vizFsBtn.addEventListener('click', toggleFullscreen);
fsBtnHeader.addEventListener('click', toggleFullscreen);

window.addEventListener('resize', () => { if (isLive||true) resizeCanvas(); });
window.addEventListener('beforeunload', cleanupAudio);

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
function init() {
  loadTheme();
  if (!checkBrowserSupport()) return;
  enumerateDevices();
  resizeCanvas();

  // Draw idle hint on canvas
  const W = vizCanvas.getBoundingClientRect().width;
  const H = vizCanvas.getBoundingClientRect().height;
  vizCtx.fillStyle = '#8b8ba3';
  vizCtx.font      = '12px Inter, sans-serif';
  vizCtx.textAlign = 'center';
  vizCtx.fillText('Start the microphone to see visualizations', W/2, H/2);
}

init();
