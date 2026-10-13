// ============================================================
// السمسمية السويسي — Al-Simsimiyya Al-Suwaisi
// Interactive Musical Instrument
// ============================================================

// ===== Scale Definitions (Maqamat) =====
const SCALES = {
    rast: {
        name: 'مقام راست',
        nameEn: 'Maqam Rast',
        // C4, D4, E-half-flat, F4, G4, A4, B-half-flat
        frequencies: [261.63, 293.66, 320.24, 349.23, 392.00, 440.00, 479.82],
        noteNames: ['دو', 'ري', 'مي ½♭', 'فا', 'صول', 'لا', 'سي ½♭'],
        noteNamesEn: ['C', 'D', 'E½♭', 'F', 'G', 'A', 'B½♭']
    },
    bayati: {
        name: 'مقام بياتي',
        nameEn: 'Maqam Bayati',
        // D4, E-half-flat, F4, G4, A4, Bb4, C5
        frequencies: [293.66, 320.24, 349.23, 392.00, 440.00, 466.16, 523.25],
        noteNames: ['ري', 'مي ½♭', 'فا', 'صول', 'لا', 'سي ♭', 'دو'],
        noteNamesEn: ['D', 'E½♭', 'F', 'G', 'A', 'B♭', 'C']
    },
    saba: {
        name: 'مقام صبا',
        nameEn: 'Maqam Saba',
        // D4, E-half-flat, F4, Gb4, A4, Bb4, C5
        frequencies: [293.66, 320.24, 349.23, 369.99, 440.00, 466.16, 523.25],
        noteNames: ['ري', 'مي ½♭', 'فا', 'صول ♭', 'لا', 'سي ♭', 'دو'],
        noteNamesEn: ['D', 'E½♭', 'F', 'G♭', 'A', 'B♭', 'C']
    },
    hijaz: {
        name: 'مقام حجاز',
        nameEn: 'Maqam Hijaz',
        // D4, Eb4, F#4, G4, A4, Bb4, C5
        frequencies: [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25],
        noteNames: ['ري', 'مي ♭', 'فا ♯', 'صول', 'لا', 'سي ♭', 'دو'],
        noteNamesEn: ['D', 'E♭', 'F♯', 'G', 'A', 'B♭', 'C']
    },
    nahawand: {
        name: 'مقام نهاوند',
        nameEn: 'Maqam Nahawand',
        // C4, D4, Eb4, F4, G4, Ab4, Bb4
        frequencies: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16],
        noteNames: ['دو', 'ري', 'مي ♭', 'فا', 'صول', 'لا ♭', 'سي ♭'],
        noteNamesEn: ['C', 'D', 'E♭', 'F', 'G', 'A♭', 'B♭']
    }
};

const KEYBOARD_MAP = {
    'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5, 'j': 6,
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6
};

const STRING_COLORS = [
    'rgba(196,144,48,1)',   // #c49030
    'rgba(212,160,80,1)',   // #d4a050
    'rgba(224,184,104,1)',  // #e0b868
    'rgba(240,204,120,1)',  // #f0cc78
    'rgba(232,200,120,1)',  // #e8c878
    'rgba(240,216,152,1)',  // #f0d898
    'rgba(248,232,184,1)'   // #f8e8b8
];

// ===== Audio Engine =====
class SimsimiyyaAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.convolver = null;
        this.dryGain = null;
        this.wetGain = null;
        this.compressor = null;
        this.initialized = false;
        this.volume = 0.7;
        this.reverbAmount = 0.3;
    }

    async init() {
        if (this.initialized) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Resume context if suspended (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;

        // Compressor to prevent clipping
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.2;

        // Create convolution reverb
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = this._createReverbIR(2.8, 2.5);

        // Dry / wet routing
        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 1 - this.reverbAmount * 0.4;

        this.wetGain = this.ctx.createGain();
        this.wetGain.gain.value = this.reverbAmount;

        // Signal chain
        this.masterGain.connect(this.dryGain);
        this.masterGain.connect(this.convolver);
        this.dryGain.connect(this.compressor);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // Recording destination
        this.mediaStreamDest = this.ctx.createMediaStreamDestination();
        this.compressor.connect(this.mediaStreamDest);

        this.initialized = true;
    }

    /**
     * Returns the MediaStream for recording
     */
    getStream() {
        return this.mediaStreamDest ? this.mediaStreamDest.stream : null;
    }

    /**
     * Generates a synthetic impulse response for reverb.
     */
    _createReverbIR(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(2, length, sampleRate);

        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                // Exponential decay with early reflections
                const envelope = Math.pow(1 - i / length, decay);
                // Add some early reflections
                const earlyReflections = (i < sampleRate * 0.05) ? 0.8 : 1;
                data[i] = (Math.random() * 2 - 1) * envelope * earlyReflections;
            }
        }

        return buffer;
    }

    /**
     * Karplus-Strong plucked string synthesis.
     * Generates a realistic plucked string sound.
     */
    _generatePluck(frequency, duration = 3.5) {
        const sampleRate = this.ctx.sampleRate;
        const samples = Math.floor(sampleRate * duration);
        const periodSamples = Math.round(sampleRate / frequency);
        const buffer = this.ctx.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);

        // Initialize delay line with shaped noise (pluck excitation)
        for (let i = 0; i < periodSamples; i++) {
            const position = i / periodSamples;
            // Pluck shape — simulate plucking at ~1/4 of string length
            const shape = Math.sin(Math.PI * position) * (1 - 0.3 * Math.sin(2 * Math.PI * position));
            data[i] = (Math.random() * 2 - 1) * shape;
        }

        // Karplus-Strong loop with enhanced low-pass averaging
        // Higher frequencies get slightly more sustain to compensate for perceptual decay
        const baseDamping = 0.996;
        const freqCompensation = Math.min(frequency / 5000, 0.003);
        const dampingFactor = Math.min(baseDamping + freqCompensation, 0.9995);

        // Two-point moving average (Karplus-Strong low-pass filter)
        for (let i = periodSamples; i < samples; i++) {
            const idx1 = i - periodSamples;
            const idx2 = i - periodSamples + 1 < samples ? i - periodSamples + 1 : idx1;
            // Basic KS averaging with damping
            data[i] = (data[idx1] + data[idx2]) * 0.5 * dampingFactor;
        }

        // Apply soft attack envelope to prevent clicks
        const attackLen = Math.min(Math.floor(sampleRate * 0.003), periodSamples);
        for (let i = 0; i < attackLen; i++) {
            data[i] *= i / attackLen;
        }

        // Apply release envelope
        const releaseLen = Math.floor(sampleRate * 0.15);
        const releaseStart = samples - releaseLen;
        for (let i = 0; i < releaseLen; i++) {
            const idx = releaseStart + i;
            if (idx >= 0 && idx < samples) {
                data[idx] *= 1 - (i / releaseLen);
            }
        }

        return buffer;
    }

    /**
     * Play a plucked string at the given frequency.
     */
    pluck(frequency, velocity = 0.85) {
        if (!this.initialized) return;

        // Resume context if needed
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const buffer = this._generatePluck(frequency);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Velocity-based gain
        const velGain = this.ctx.createGain();
        velGain.gain.value = velocity * 0.9;

        // Slight panning based on frequency (lower = left, higher = right)
        const panner = this.ctx.createStereoPanner();
        const panRange = 0.35;
        const normalizedFreq = (frequency - 250) / (550 - 250); // 0 to 1
        panner.pan.value = (normalizedFreq - 0.5) * 2 * panRange;

        // Connect chain
        source.connect(velGain);
        velGain.connect(panner);
        panner.connect(this.masterGain);

        source.start();

        // Cleanup
        source.onended = () => {
            source.disconnect();
            velGain.disconnect();
            panner.disconnect();
        };
    }

    setVolume(value) {
        this.volume = value;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
        }
    }

    setReverb(value) {
        this.reverbAmount = value;
        if (this.dryGain && this.wetGain) {
            this.dryGain.gain.setTargetAtTime(1 - value * 0.4, this.ctx.currentTime, 0.02);
            this.wetGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
        }
    }
}

// ===== Particle System =====
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.animating = false;
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    /**
     * Emit particles from a point with given color.
     */
    emit(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 3;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                life: 1.0,
                decay: 0.012 + Math.random() * 0.025,
                size: 0.8 + Math.random() * 2.5,
                color,
                // Sparkle effect
                sparkle: Math.random() > 0.5
            });
        }

        if (!this.animating) {
            this.animating = true;
            this._animate();
        }
    }

    _animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04; // gentle gravity
            p.vx *= 0.99; // air resistance
            p.life -= p.decay;

            if (p.life <= 0) return false;

            const alpha = p.life;
            const size = p.size * (0.5 + p.life * 0.5);

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);

            // Color with alpha
            const colorWithAlpha = p.color.replace(/[\d.]+\)$/, `${alpha})`);
            this.ctx.fillStyle = colorWithAlpha;
            this.ctx.fill();

            // Sparkle glow
            if (p.sparkle && p.life > 0.3) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
                const glowAlpha = alpha * 0.2;
                this.ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${glowAlpha})`);
                this.ctx.fill();
            }

            return true;
        });

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this._animate());
        } else {
            this.animating = false;
        }
    }
}

// ===== String Vibration Animation =====
class StringAnimator {
    constructor() {
        this.animations = new Map(); // stringIndex -> animationId
    }

    /**
     * Animate a string vibration on an SVG path element.
     */
    vibrate(pathElement, stringIndex) {
        // Cancel any existing animation on this string
        if (this.animations.has(stringIndex)) {
            cancelAnimationFrame(this.animations.get(stringIndex));
        }

        const x1 = parseFloat(pathElement.getAttribute('data-x1'));
        const y1 = parseFloat(pathElement.getAttribute('data-y1'));
        const x2 = parseFloat(pathElement.getAttribute('data-x2'));
        const y2 = parseFloat(pathElement.getAttribute('data-y2'));

        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Perpendicular direction for displacement
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);

        const startTime = performance.now();
        const duration = 1200; // ms
        const initialAmplitude = 4.5;
        const segments = 24;

        pathElement.classList.add('playing');

        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                // Reset to straight line
                pathElement.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
                pathElement.classList.remove('playing');
                this.animations.delete(stringIndex);
                return;
            }

            // Decaying amplitude
            const amplitude = initialAmplitude * Math.exp(-progress * 4) * (1 - progress);

            // Build wave path
            let d = `M ${x1} ${y1}`;
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const baseX = x1 + dx * t;
                const baseY = y1 + dy * t;

                // Standing wave with nodes at endpoints
                const envelope = Math.sin(Math.PI * t);
                // Oscillation — higher frequency vibration
                const oscillation = Math.sin(elapsed * 0.04) * Math.cos(elapsed * 0.015);
                // Second harmonic
                const harmonic2 = 0.3 * Math.sin(2 * Math.PI * t) * Math.sin(elapsed * 0.06);

                const displacement = amplitude * envelope * (oscillation + harmonic2);
                const px = baseX + perpX * displacement;
                const py = baseY + perpY * displacement;

                d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
            }

            pathElement.setAttribute('d', d);
            this.animations.set(stringIndex, requestAnimationFrame(animate));
        };

        this.animations.set(stringIndex, requestAnimationFrame(animate));
    }
}

// ===== Audio Recorder =====
class SimsimiyyaRecorder {
    constructor(audio, getScaleName) {
        this.audio = audio;
        this.getScaleName = getScaleName;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = 0;
        this.timerInterval = null;
        this.recordingCount = 0;
        this.recordings = [];

        // DOM elements
        this.panel = document.getElementById('recorderPanel');
        this.recordBtn = document.getElementById('recRecordBtn');
        this.stopBtn = document.getElementById('recStopBtn');
        this.statusEl = document.getElementById('recorderStatus');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.recordingsList = document.getElementById('recordingsList');
        this.emptyEl = document.getElementById('recordingsEmpty');

        this._bindEvents();
    }

    _bindEvents() {
        if (!this.recordBtn || !this.stopBtn) return;

        this.recordBtn.addEventListener('click', () => {
            if (!this.isRecording) {
                this.start();
            }
        });

        this.stopBtn.addEventListener('click', () => {
            if (this.isRecording) {
                this.stop();
            }
        });
    }

    async start() {
        try {
            await this.audio.init();

            const stream = this.audio.getStream();
            if (!stream) {
                if (this.statusEl) this.statusEl.textContent = 'خطأ في مسار الصوت';
                return;
            }

            // Detect supported MIME type
            const mimeCandidates = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4',
                ''
            ];
            let selectedMime = '';
            for (const mime of mimeCandidates) {
                if (!mime || (window.MediaRecorder && MediaRecorder.isTypeSupported(mime))) {
                    selectedMime = mime;
                    break;
                }
            }

            const options = selectedMime ? { mimeType: selectedMime } : {};
            this.mediaRecorder = new MediaRecorder(stream, options);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this._handleRecordingComplete(selectedMime);
            };

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.startTime = Date.now();
            this._startTimer();
            this._updateUI(true);
        } catch (err) {
            console.error('Failed to start recording:', err);
            if (this.statusEl) this.statusEl.textContent = 'تعذر بدء التسجيل';
        }
    }

    stop() {
        if (!this.isRecording) return;
        this.isRecording = false;
        this._stopTimer();
        this._updateUI(false);

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    _startTimer() {
        this._updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this._updateTimerDisplay();
        }, 500);
    }

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _updateTimerDisplay() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        if (this.timerDisplay) {
            this.timerDisplay.textContent = `${mins}:${secs}`;
        }
    }

    _updateUI(recording) {
        if (this.panel) {
            this.panel.classList.toggle('recording', recording);
        }
        if (this.recordBtn) {
            this.recordBtn.disabled = recording;
            const label = this.recordBtn.querySelector('.rec-btn-label');
            if (label) label.textContent = recording ? 'جاري التسجيل...' : 'تسجيل';
        }
        if (this.stopBtn) {
            this.stopBtn.disabled = !recording;
        }
        if (this.statusEl) {
            this.statusEl.textContent = recording ? '🔴 جاري التسجيل...' : 'جاهز للتسجيل';
        }
    }

    _handleRecordingComplete(mimeType) {
        if (this.recordedChunks.length === 0) return;

        const actualType = mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: actualType });
        const url = URL.createObjectURL(blob);
        const duration = this.timerDisplay ? this.timerDisplay.textContent : '00:00';
        if (this.timerDisplay) {
            this.timerDisplay.textContent = '00:00';
        }

        this.recordingCount++;
        const scaleName = this.getScaleName ? this.getScaleName() : 'راست';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        // Extension based on mime
        let ext = 'webm';
        if (actualType.includes('ogg')) ext = 'ogg';
        else if (actualType.includes('mp4')) ext = 'mp4';
        else if (actualType.includes('wav')) ext = 'wav';

        const recData = {
            id: 'rec-' + Date.now(),
            num: this.recordingCount,
            title: `عزف #${this.recordingCount}`,
            scale: scaleName,
            duration: duration,
            time: timeStr,
            url: url,
            ext: ext
        };

        this.recordings.unshift(recData);
        this._renderRecordings();

        if (this.statusEl) {
            this.statusEl.textContent = `تم حفظ ${recData.title}`;
            setTimeout(() => {
                if (!this.isRecording && this.statusEl) {
                    this.statusEl.textContent = 'جاهز للتسجيل';
                }
            }, 3000);
        }
    }

    _renderRecordings() {
        const drawerCount = document.getElementById('drawerRecordingsCount');
        if (drawerCount) {
            drawerCount.textContent = this.recordings.length;
        }

        if (!this.recordingsList) return;

        if (this.recordings.length === 0) {
            if (this.emptyEl) this.emptyEl.style.display = 'flex';
            this.recordingsList.innerHTML = '';
            if (this.emptyEl) this.recordingsList.appendChild(this.emptyEl);
            return;
        }

        if (this.emptyEl) {
            this.emptyEl.style.display = 'none';
        }

        this.recordingsList.innerHTML = '';
        this.recordings.forEach((rec) => {
            const card = document.createElement('div');
            card.className = 'recording-card';
            card.id = rec.id;
            card.innerHTML = `
                <div class="recording-info">
                    <div class="recording-name">${rec.title} — ${rec.scale}</div>
                    <div class="recording-meta">
                        <span>⏱ ${rec.duration}</span>
                        <span>🕒 ${rec.time}</span>
                    </div>
                </div>
                <div class="recording-player">
                    <audio controls src="${rec.url}" preload="metadata"></audio>
                </div>
                <div class="recording-actions">
                    <a class="card-action-btn" href="${rec.url}" download="simsimiyya-${rec.num}.${rec.ext}" title="تحميل">
                        <span>⬇️</span> تحميل
                    </a>
                    <button class="card-action-btn delete-btn" data-id="${rec.id}" title="حذف">
                        <span>🗑</span> حذف
                    </button>
                </div>
            `;

            const delBtn = card.querySelector('.delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', () => {
                    this._deleteRecording(rec.id);
                });
            }

            this.recordingsList.appendChild(card);
        });
    }

    _deleteRecording(id) {
        const index = this.recordings.findIndex(r => r.id === id);
        if (index !== -1) {
            URL.revokeObjectURL(this.recordings[index].url);
            this.recordings.splice(index, 1);
            this._renderRecordings();
        }
    }
}

// ===== Main Application =====
class SimsimiyyaApp {
    constructor() {
        this.audio = new SimsimiyyaAudio();
        this.particles = null;
        this.stringAnimator = new StringAnimator();
        this.recorder = null;
        this.currentScale = 'rast';
        this.isMouseDown = false;
        this.activeKeys = new Set();
        this.lastPluckedString = -1;

        this._init();
    }

    async _init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // Setup particle canvas
        const canvas = document.getElementById('particleCanvas');
        this.particles = new ParticleSystem(canvas);
        this.particles.resize();

        // Setup recorder
        this.recorder = new SimsimiyyaRecorder(this.audio, () => SCALES[this.currentScale]?.name || 'راست');

        // Bind events
        this._bindStringEvents();
        this._bindKeyboardEvents();
        this._bindControlEvents();
        this._bindStrumButton();
        this._bindKeyHintEvents();
        this._bindMobileDrawer();

        // Handle resize
        window.addEventListener('resize', () => {
            this.particles.resize();
        });

        // Dismiss loading overlay on first interaction
        const overlay = document.getElementById('loadingOverlay');
        const dismissLoading = async () => {
            await this.audio.init();
            overlay.classList.add('hidden');
            document.removeEventListener('click', dismissLoading);
            document.removeEventListener('touchstart', dismissLoading);
            document.removeEventListener('keydown', dismissLoading);
        };

        // Auto-dismiss after short delay with click/key hint
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 2000);

        document.addEventListener('click', dismissLoading, { once: true });
        document.addEventListener('touchstart', dismissLoading, { once: true });
        document.addEventListener('keydown', dismissLoading, { once: true });
    }

    // ===== String Events =====
    _bindStringEvents() {
        const svg = document.getElementById('instrumentSvg');

        // Handle clicks and touches on hit areas
        for (let i = 0; i < 7; i++) {
            const hitarea = document.getElementById(`hitarea-${i}`);
            if (!hitarea) continue;

            // Click
            hitarea.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.isMouseDown = true;
                this._pluckString(i);
            });

            // Strum — drag across strings
            hitarea.addEventListener('mouseenter', () => {
                if (this.isMouseDown) {
                    this._pluckString(i);
                }
            });

            // Touch
            hitarea.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._pluckString(i);
            }, { passive: false });
        }

        // Global mouse up
        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        // Handle touch move for strumming
        svg.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            if (element && element.classList.contains('string-hitarea')) {
                const index = parseInt(element.getAttribute('data-index'));
                if (index !== this.lastPluckedString) {
                    this._pluckString(index);
                    this.lastPluckedString = index;
                }
            }
        }, { passive: false });

        svg.addEventListener('touchend', () => {
            this.lastPluckedString = -1;
        });
    }

    // ===== Keyboard Events =====
    _bindKeyboardEvents() {
        document.addEventListener('keydown', async (e) => {
            const key = e.key.toLowerCase();

            // Prevent repeated triggers from held keys
            if (this.activeKeys.has(key)) return;

            if (key in KEYBOARD_MAP) {
                e.preventDefault();
                this.activeKeys.add(key);

                // Init audio on first keypress
                if (!this.audio.initialized) {
                    await this.audio.init();
                    const overlay = document.getElementById('loadingOverlay');
                    overlay.classList.add('hidden');
                }

                const stringIndex = KEYBOARD_MAP[key];
                this._pluckString(stringIndex);

                // Animate key cap and button
                const keyCap = document.getElementById(`keyCap-${stringIndex}`);
                if (keyCap) keyCap.classList.add('active');
                const keyHint = keyCap ? keyCap.closest('.key-hint') : null;
                if (keyHint) keyHint.classList.add('active');
            }

            // Spacebar for strum
            if (key === ' ' || key === 'spacebar') {
                e.preventDefault();
                if (!this.activeKeys.has('space')) {
                    this.activeKeys.add('space');
                    const strumBtn = document.getElementById('strumBtn');
                    if (strumBtn) strumBtn.classList.add('active');
                    this._strumAll();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.activeKeys.delete(key);

            if (key === ' ' || key === 'spacebar') {
                this.activeKeys.delete('space');
                const strumBtn = document.getElementById('strumBtn');
                if (strumBtn) strumBtn.classList.remove('active');
            }

            if (key in KEYBOARD_MAP) {
                const stringIndex = KEYBOARD_MAP[key];
                const keyCap = document.getElementById(`keyCap-${stringIndex}`);
                if (keyCap) keyCap.classList.remove('active');
                const keyHint = keyCap ? keyCap.closest('.key-hint') : null;
                if (keyHint) keyHint.classList.remove('active');
            }
        });
    }

    // ===== Control Events =====
    _bindControlEvents() {
        // Volume slider
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        volumeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            volumeValue.textContent = `${val}%`;
            this.audio.setVolume(val / 100);
        });

        // Reverb slider
        const reverbSlider = document.getElementById('reverbSlider');
        const reverbValue = document.getElementById('reverbValue');
        reverbSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            reverbValue.textContent = `${val}%`;
            this.audio.setReverb(val / 100);
        });

        // Scale selector
        const scaleButtons = document.querySelectorAll('.scale-btn');
        scaleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                scaleButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentScale = btn.getAttribute('data-scale');
                this._updateNoteLabels();
            });
        });
    }

    // ===== Strum Button =====
    _bindStrumButton() {
        const strumBtn = document.getElementById('strumBtn');
        strumBtn.addEventListener('click', async () => {
            if (!this.audio.initialized) {
                await this.audio.init();
                const overlay = document.getElementById('loadingOverlay');
                overlay.classList.add('hidden');
            }
            this._strumAll();
        });
    }

    // ===== Key Hint Touch/Click Events (For easy mobile playing) =====
    _bindKeyHintEvents() {
        for (let i = 0; i < 7; i++) {
            const keyCap = document.getElementById(`keyCap-${i}`);
            const keyHint = keyCap ? keyCap.closest('.key-hint') : null;
            if (!keyHint) continue;

            const handlePlay = (e) => {
                e.preventDefault();
                this._pluckString(i);
                keyHint.classList.add('active');
                if (keyCap) keyCap.classList.add('active');
                setTimeout(() => {
                    keyHint.classList.remove('active');
                    if (keyCap) keyCap.classList.remove('active');
                }, 200);
            };

            keyHint.addEventListener('touchstart', handlePlay, { passive: false });
            keyHint.addEventListener('mousedown', handlePlay);
        }
    }

    // ===== Mobile Drawer Events =====
    _bindMobileDrawer() {
        const sidebar = document.getElementById('studioSidebar');
        const openBtn = document.getElementById('mobileDrawerOpenBtn');
        const closeBtn = document.getElementById('mobileDrawerCloseBtn');
        const backdrop = document.getElementById('drawerBackdrop');

        if (!sidebar) return;

        const openDrawer = () => {
            sidebar.classList.add('mobile-open');
            if (backdrop) backdrop.classList.add('active');
        };

        const closeDrawer = () => {
            sidebar.classList.remove('mobile-open');
            if (backdrop) backdrop.classList.remove('active');
        };

        if (openBtn) openBtn.addEventListener('click', openDrawer);
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
        if (backdrop) backdrop.addEventListener('click', closeDrawer);
    }

    // ===== Pluck a String =====
    async _pluckString(index) {
        if (index < 0 || index > 6) return;

        // Init audio if needed
        if (!this.audio.initialized) {
            await this.audio.init();
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.add('hidden');
        }

        const scale = SCALES[this.currentScale];
        const frequency = scale.frequencies[index];

        // Play sound
        this.audio.pluck(frequency);

        // Animate string
        const stringEl = document.getElementById(`string-${index}`);
        if (stringEl) {
            this.stringAnimator.vibrate(stringEl, index);
        }

        // Animate key buttons
        const keyCap = document.getElementById(`keyCap-${index}`);
        const keyHint = keyCap ? keyCap.closest('.key-hint') : null;
        if (keyCap) keyCap.classList.add('active');
        if (keyHint) keyHint.classList.add('active');
        setTimeout(() => {
            if (keyCap) keyCap.classList.remove('active');
            if (keyHint) keyHint.classList.remove('active');
        }, 220);

        // Emit particles from string midpoint
        this._emitStringParticles(index);

        // Hide instruction after first play
        const instruction = document.getElementById('tapInstruction');
        if (instruction) {
            instruction.style.opacity = '0';
            setTimeout(() => instruction.style.display = 'none', 500);
        }
    }

    // ===== Emit Particles =====
    _emitStringParticles(index) {
        const stringEl = document.getElementById(`string-${index}`);
        if (!stringEl) return;

        const container = document.getElementById('instrumentContainer');
        const containerRect = container.getBoundingClientRect();

        // Get string midpoint in SVG coordinates, convert to canvas coordinates
        const x1 = parseFloat(stringEl.getAttribute('data-x1'));
        const y1 = parseFloat(stringEl.getAttribute('data-y1'));
        const x2 = parseFloat(stringEl.getAttribute('data-x2'));
        const y2 = parseFloat(stringEl.getAttribute('data-y2'));

        const svgEl = document.getElementById('instrumentSvg');
        const svgRect = svgEl.getBoundingClientRect();

        // SVG viewBox coordinates to screen coordinates
        const viewBox = svgEl.viewBox.baseVal;
        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Convert to canvas coordinates (relative to container)
        const canvasX = (midX * scaleX) + (svgRect.left - containerRect.left);
        const canvasY = (midY * scaleY) + (svgRect.top - containerRect.top);

        // Emit at multiple points along the string
        const color = STRING_COLORS[index];
        this.particles.emit(canvasX, canvasY - 20, color, 12);
        this.particles.emit(canvasX, canvasY + 20, color, 8);
    }

    // ===== Strum All Strings =====
    _strumAll(direction = 1) {
        const indices = direction > 0 ? [0, 1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1, 0];
        const delay = 60; // ms between each string

        indices.forEach((stringIndex, i) => {
            setTimeout(() => {
                this._pluckString(stringIndex);
            }, i * delay);
        });
    }

    // ===== Update Note Labels =====
    _updateNoteLabels() {
        const scale = SCALES[this.currentScale];

        for (let i = 0; i < 7; i++) {
            // SVG note labels
            const label = document.getElementById(`noteLabel-${i}`);
            if (label) {
                label.textContent = scale.noteNames[i];
            }

            // Key hints below instrument
            const keyNote = document.getElementById(`keyNote-${i}`);
            if (keyNote) {
                keyNote.textContent = scale.noteNames[i];
            }
        }
    }
}

// ===== Initialize App =====
const app = new SimsimiyyaApp();
