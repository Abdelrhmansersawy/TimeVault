/**
 * Clock Module - Real-time clock display
 */

const ClockModule = {
    elements: {
        hours: null,
        minutes: null,
        seconds: null,
        ampm: null,
        date: null,
        formatToggle: null,
        formatText: null
    },

    use24Hour: false,
    intervalId: null,

    init() {
        this.elements.hours = document.getElementById('clock-hours');
        this.elements.minutes = document.getElementById('clock-minutes');
        this.elements.seconds = document.getElementById('clock-seconds');
        this.elements.ampm = document.getElementById('clock-ampm');
        this.elements.date = document.getElementById('clock-date');
        this.elements.formatToggle = document.getElementById('toggle-format');
        this.elements.formatText = document.getElementById('format-text');

        // Load settings
        const settings = StorageManager.getSettings();
        this.use24Hour = settings.use24Hour;
        this.updateFormatButton();

        // Set up event listener
        this.elements.formatToggle?.addEventListener('click', () => this.toggleFormat());

        // Start the clock
        this.update();
        this.intervalId = setInterval(() => this.update(), 1000);
    },

    update() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Handle 12/24 hour format
        let ampm = '';
        if (!this.use24Hour) {
            ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 becomes 12
        }

        // Update display
        if (this.elements.hours) {
            this.elements.hours.textContent = hours.toString().padStart(2, '0');
        }
        if (this.elements.minutes) {
            this.elements.minutes.textContent = minutes.toString().padStart(2, '0');
        }
        if (this.elements.seconds) {
            this.elements.seconds.textContent = seconds.toString().padStart(2, '0');
        }
        if (this.elements.ampm) {
            this.elements.ampm.textContent = ampm;
            this.elements.ampm.style.display = this.use24Hour ? 'none' : 'inline';
        }
        if (this.elements.date) {
            this.elements.date.textContent = formatDate(now);
        }
    },

    toggleFormat() {
        this.use24Hour = !this.use24Hour;
        StorageManager.updateSetting('use24Hour', this.use24Hour);
        this.updateFormatButton();
        this.update();
    },

    updateFormatButton() {
        if (this.elements.formatText) {
            this.elements.formatText.textContent = this.use24Hour ? '24H' : '12H';
        }
    },

    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
};

window.ClockModule = ClockModule;
