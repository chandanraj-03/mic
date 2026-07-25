# 🎙️ Mic Live — Browser Microphone Studio

A modern, feature-rich, web-based audio application built with plain HTML5, CSS3, and vanilla JavaScript (Web Audio API). It captures live microphone audio, applies real-time DSP effects, offers voice transformation presets, features a full karaoke backing track mode with vocal removal, and routes audio to any selected output device (including Bluetooth speakers).

---

## ✨ Features Breakdown

### 🎤 Core Audio Routing & Hardware Control
- **Explicit Mic Access**: Clean permission request handling via `navigator.mediaDevices.getUserMedia()`.
- **Input Device Selector**: Dynamic dropdown populating all connected microphones.
- **Output Device Selector (setSinkId)**: Select explicit output devices (Bluetooth speakers, external headphones, etc.) with OS-level fallback notes.
- **Proper Resource Cleanup**: Completely stops `MediaStream` tracks and closes `AudioContext` on stop or page navigation to prevent mic leaks.

### 📊 Real-Time Audio Visualization & Pitch Detection
- **4 Visualizer Modes**:
  1. **Waveform**: Oscilloscope-style time-domain wave rendering.
  2. **Frequency Bars**: Multi-band spectral magnitude distribution.
  3. **Circular Radial**: 360° frequency-reactive burst visualizer.
  4. **Particle Field**: Amplitude-driven physics particle network.
- **4 Color Themes**: Purple, Cyan, Green, and Fire glow presets.
- **RMS Volume Meter**: Live linear level bar with decibel readout (`dB`).

### 🎛️ Digital Signal Processing (DSP) & Voice Effects
- **3-Band Equalizer**:
  - **Low Shelf**: Cut/boost frequencies below 320 Hz (±12 dB).
  - **Mid Peaking**: Cut/boost frequencies around 1 kHz (±12 dB, Q=0.5).
  - **High Shelf**: Cut/boost frequencies above 3.2 kHz (±12 dB).
- **Voice Effects**:
  - **Reverb**: Convolution engine with synthetic impulse response generator (decay & mix control).
  - **Delay / Echo**: Feedback delay loop (50ms to 1000ms delay time, 0–90% feedback).
  - **Distortion**: Mathematical waveshaper curve clipping engine.

### 🎭 Real-Time Voice Changer
8 instant voice presets built using Web Audio API nodes:
- **🗣️ Normal**: Clean, unprocessed bypass signal.
- **👹 Deep**: Low-frequency ring modulation + heavy low-shelf boost.
- **🐿️ Chipmunk**: High-frequency ring modulation + high-pass filter.
- **🤖 Robot**: Square-wave ring modulation + dual resonant band-pass filtering.
- **📻 Radio**: Narrow band-pass filtering simulating telephone/walkie-talkie spectrum.
- **🌊 Underwater**: Low-pass filter (500 Hz cutoff, high Q) + 3 Hz tremolo LFO.
- **👽 Alien**: Sawtooth ring modulation + dual notch filtering.
- **🦇 Cave**: Ring modulation + long resonant decay.

### 🎤 Karaoke Mode & Vocal Removal
- **Backing Track Upload**: Load any local audio file (`MP3`, `WAV`, `OGG`, etc.).
- **Vocal Removal (Phase Cancellation)**: Uses channel splitting (`L - R`) to cancel out center-panned lead vocals from stereo tracks while keeping stereo instrumentation intact.
- **Karaoke Reverb**: Dedicated studio reverb space for the vocal microphone.
- **Music & Mic Mixer**: Independent volume controls and real-time audio summation.

### ⏺️ Recording & Session Management
- **MediaRecorder API**: Capture session audio post-DSP into downloadable `.webm` files.
- **In-Page Playback List**: Replay and download session recordings directly within the app.
- **Session Stats**: Displays real-time audio sample rate, base latency, and session duration.

### ⌨️ UX, Themes & Accessibility
- **Dark & Light Modes**: Seamless theme toggle with local storage persistence.
- **Keyboard Shortcuts**:
  - `Space`: Start / Stop Microphone
  - `R`: Start / Stop Recording
  - `T`: Toggle Dark / Light Theme
  - `V`: Cycle Visualizer Mode
  - `M`: Mute / Unmute
  - `↑ / ↓`: Volume adjustment (+/- 5%)
  - `Esc`: Close dialogs

---

## 🏗️ Technical Architecture & Signal Chain

```text
[ Microphones ]
      │
  getUserMedia({ echoCancellation, noiseSuppression })
      │
  MediaStreamAudioSourceNode
      │
  3-Band Equalizer (BiquadFilterNode x3)
      │
  Voice Changer Block (OscillatorNode ring mod + BiquadFilters + Tremolo LFO)
      │
  Distortion (WaveShaperNode wet/dry)
      │
  Delay / Echo (DelayNode + Feedback GainNode wet/dry)
      │
  Reverb (ConvolverNode with synthetic Impulse Response)
      │
  Master Volume (GainNode)
      │
  AnalyserNode ──> [ HTML5 Canvas Visualizer & Autocorrelation Pitch Detector ]
      │
  AudioContext.destination ──> [ Speakers / Bluetooth Output ]

[ Karaoke File ] ──> MediaElementAudioSourceNode ──> [ Phase Cancellation L-R Splitter ] ──> Destination
```

---

## 📁 File Structure

```text
mic/
├── index.html     # Semantic HTML5 layout & UI controls
├── style.css      # Custom CSS3 design tokens, glassmorphism UI & responsive styles
├── script.js     # Pure ES6 Web Audio API architecture & audio processing engine
├── vercel.json    # Static deployment configuration for Vercel
└── README.md      # Comprehensive project documentation
```

---

## 🚀 Running Locally

No node build steps or bundlers are required!

1. Clone or download this repository.
2. Open the project folder in your editor (e.g., VS Code).
3. Serve the directory using any static web server:
   ```bash
   npx http-server . -p 8080
   ```
4. Open `http://localhost:8080` in **Google Chrome** or **Microsoft Edge**.

---
