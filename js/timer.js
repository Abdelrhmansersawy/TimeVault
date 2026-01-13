/**
 * Timer Module - Countdown timer
 */

const TimerModule = {
    elements: {
        inputMode: null,
        countdownMode: null,
        hoursInput: null,
        minutesInput: null,
        secondsInput: null,
        displayHours: null,
        displayMinutes: null,
        displaySeconds: null,
        startBtn: null,
        pauseBtn: null,
        resetBtn: null,
        progressRing: null
    },

    totalMs: 0,
    remainingMs: 0,
    isRunning: false,
    intervalId: null,
    circumference: 2 * Math.PI * 90, // radius = 90

    init() {
        this.elements.inputMode = document.getElementById('timer-input-mode');
        this.elements.countdownMode = document.getElementById('timer-countdown-mode');
        this.elements.hoursInput = document.getElementById('timer-hours');
        this.elements.minutesInput = document.getElementById('timer-minutes');
        this.elements.secondsInput = document.getElementById('timer-seconds');
        this.elements.displayHours = document.getElementById('timer-display-hours');
        this.elements.displayMinutes = document.getElementById('timer-display-minutes');
        this.elements.displaySeconds = document.getElementById('timer-display-seconds');
        this.elements.startBtn = document.getElementById('timer-start');
        this.elements.pauseBtn = document.getElementById('timer-pause');
        this.elements.resetBtn = document.getElementById('timer-reset');
        this.elements.progressRing = document.getElementById('timer-progress');

        // Set up progress ring
        if (this.elements.progressRing) {
            this.elements.progressRing.style.strokeDasharray = this.circumference;
            this.elements.progressRing.style.strokeDashoffset = 0;
        }

        // Event listeners
        this.elements.startBtn?.addEventListener('click', () => this.start());
        this.elements.pauseBtn?.addEventListener('click', () => this.pause());
        this.elements.resetBtn?.addEventListener('click', () => this.reset());

        // Input validation
        [this.elements.hoursInput, this.elements.minutesInput, this.elements.secondsInput].forEach(input => {
            input?.addEventListener('input', (e) => {
                let value = parseInt(e.target.value) || 0;
                const max = parseInt(e.target.max);
                if (value > max) value = max;
                if (value < 0) value = 0;
                e.target.value = value;
            });
        });
    },

    start() {
        if (this.isRunning) return;

        // Calculate total time if starting fresh
        if (this.remainingMs === 0) {
            const hours = parseInt(this.elements.hoursInput?.value) || 0;
            const minutes = parseInt(this.elements.minutesInput?.value) || 0;
            const seconds = parseInt(this.elements.secondsInput?.value) || 0;

            this.totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
            this.remainingMs = this.totalMs;
        }

        if (this.totalMs === 0) {
            App.showToast('Please set a time');
            return;
        }

        this.isRunning = true;
        this.showCountdownMode();
        this.updateButtons();

        let lastTick = Date.now();
        this.intervalId = setInterval(() => {
            const now = Date.now();
            const delta = now - lastTick;
            lastTick = now;

            this.remainingMs -= delta;

            if (this.remainingMs <= 0) {
                this.remainingMs = 0;
                this.complete();
            }

            this.updateDisplay();
            this.updateProgress();
        }, 100);
    },

    pause() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updateButtons();
    },

    reset() {
        this.pause();
        this.totalMs = 0;
        this.remainingMs = 0;
        this.showInputMode();
        this.updateProgress();
    },

    complete() {
        this.pause();

        // Play sound
        const audio = document.getElementById('alarm-sound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
        }

        App.showToast('Timer complete!');

        // System notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Focus Clock Timer', {
                body: 'Time is up!'
            });
        }
    },

    showInputMode() {
        if (this.elements.inputMode) this.elements.inputMode.style.display = 'flex';
        if (this.elements.countdownMode) this.elements.countdownMode.style.display = 'none';
        this.updateButtons();
    },

    showCountdownMode() {
        if (this.elements.inputMode) this.elements.inputMode.style.display = 'none';
        if (this.elements.countdownMode) this.elements.countdownMode.style.display = 'flex';
    },

    updateDisplay() {
        const totalSeconds = Math.ceil(this.remainingMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (this.elements.displayHours) {
            this.elements.displayHours.textContent = hours.toString().padStart(2, '0');
        }
        if (this.elements.displayMinutes) {
            this.elements.displayMinutes.textContent = minutes.toString().padStart(2, '0');
        }
        if (this.elements.displaySeconds) {
            this.elements.displaySeconds.textContent = seconds.toString().padStart(2, '0');
        }
    },

    updateProgress() {
        if (!this.elements.progressRing) return;

        const progress = this.totalMs > 0 ? this.remainingMs / this.totalMs : 1;
        const offset = this.circumference * (1 - progress);
        this.elements.progressRing.style.strokeDashoffset = offset;
    },

    updateButtons() {
        const inCountdown = this.remainingMs > 0 || this.isRunning;

        if (this.elements.startBtn) {
            this.elements.startBtn.style.display = this.isRunning ? 'none' : 'inline-flex';
            this.elements.startBtn.textContent = inCountdown ? 'Resume' : 'Start';
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.style.display = this.isRunning ? 'inline-flex' : 'none';
        }
    },

    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
};

window.TimerModule = TimerModule;
