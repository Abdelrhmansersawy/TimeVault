/**
 * Stopwatch Module - Basic stopwatch with lap functionality
 */

const StopwatchModule = {
    elements: {
        hours: null,
        minutes: null,
        seconds: null,
        ms: null,
        startBtn: null,
        pauseBtn: null,
        lapBtn: null,
        resetBtn: null,
        lapsList: null
    },

    elapsedMs: 0,
    isRunning: false,
    startTime: null,
    intervalId: null,
    laps: [],

    init() {
        this.elements.hours = document.getElementById('sw-hours');
        this.elements.minutes = document.getElementById('sw-minutes');
        this.elements.seconds = document.getElementById('sw-seconds');
        this.elements.ms = document.getElementById('sw-ms');
        this.elements.startBtn = document.getElementById('sw-start');
        this.elements.pauseBtn = document.getElementById('sw-pause');
        this.elements.lapBtn = document.getElementById('sw-lap');
        this.elements.resetBtn = document.getElementById('sw-reset');
        this.elements.lapsList = document.getElementById('sw-laps');

        // Event listeners
        this.elements.startBtn?.addEventListener('click', () => this.start());
        this.elements.pauseBtn?.addEventListener('click', () => this.pause());
        this.elements.lapBtn?.addEventListener('click', () => this.lap());
        this.elements.resetBtn?.addEventListener('click', () => this.reset());

        this.updateDisplay();
    },

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now() - this.elapsedMs;
        this.updateButtons();

        this.intervalId = setInterval(() => {
            this.elapsedMs = Date.now() - this.startTime;
            this.updateDisplay();
        }, 10);
    },

    pause() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updateButtons();
    },

    lap() {
        if (!this.isRunning || this.elapsedMs === 0) return;

        const lapTime = this.elapsedMs;
        const previousTotal = this.laps.length > 0 ? this.laps[0].total : 0;
        const lapDelta = lapTime - previousTotal;

        this.laps.unshift({
            number: this.laps.length + 1,
            delta: lapDelta,
            total: lapTime
        });

        this.renderLaps();
    },

    reset() {
        this.pause();
        this.elapsedMs = 0;
        this.laps = [];
        this.updateDisplay();
        this.renderLaps();
    },

    updateDisplay() {
        const totalMs = this.elapsedMs;
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const ms = Math.floor((totalMs % 1000) / 10);

        if (this.elements.hours) {
            this.elements.hours.textContent = hours.toString().padStart(2, '0');
        }
        if (this.elements.minutes) {
            this.elements.minutes.textContent = minutes.toString().padStart(2, '0');
        }
        if (this.elements.seconds) {
            this.elements.seconds.textContent = seconds.toString().padStart(2, '0');
        }
        if (this.elements.ms) {
            this.elements.ms.textContent = ms.toString().padStart(2, '0');
        }
    },

    updateButtons() {
        if (this.elements.startBtn) {
            this.elements.startBtn.style.display = this.isRunning ? 'none' : 'inline-flex';
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.style.display = this.isRunning ? 'inline-flex' : 'none';
        }
        if (this.elements.lapBtn) {
            this.elements.lapBtn.disabled = !this.isRunning;
        }
    },

    renderLaps() {
        if (!this.elements.lapsList) return;

        if (this.laps.length === 0) {
            this.elements.lapsList.innerHTML = '';
            return;
        }

        this.elements.lapsList.innerHTML = this.laps.map(lap => `
            <div class="lap-item">
                <span class="lap-number">Lap ${lap.number}</span>
                <span class="lap-time">${formatTime(lap.delta, true)}</span>
            </div>
        `).join('');
    },

    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
};

window.StopwatchModule = StopwatchModule;
