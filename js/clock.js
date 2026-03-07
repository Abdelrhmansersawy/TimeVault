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

        // Check if clocks grid is available
        this.elements.worldClocksList = document.getElementById('world-clocks-list');
        this.elements.addWorldClockBtn = document.getElementById('add-world-clock-btn');
        this.elements.worldClockModal = document.getElementById('world-clock-modal');
        this.elements.saveWorldClockBtn = document.getElementById('save-world-clock-btn');

        if (this.elements.addWorldClockBtn) {
            this.elements.addWorldClockBtn.addEventListener('click', () => {
                this.elements.worldClockModal.classList.add('open');
                document.getElementById('world-clock-name').value = '';
                document.getElementById('world-clock-offset').value = '';
                document.getElementById('world-clock-name').focus();
            });
        }

        if (this.elements.saveWorldClockBtn) {
            this.elements.saveWorldClockBtn.addEventListener('click', () => this.saveNewWorldClock());
        }

        // Set up event listener
        this.elements.formatToggle?.addEventListener('click', () => this.toggleFormat());

        // Initialize World Clocks DOM
        this.renderWorldClocks();

        // Start the clock
        this.update();
        this.intervalId = setInterval(() => this.update(), 1000);
    },

    saveNewWorldClock() {
        const nameInput = document.getElementById('world-clock-name');
        const offsetInput = document.getElementById('world-clock-offset');
        const name = nameInput.value.trim();
        const offset = parseFloat(offsetInput.value);

        if (!name || isNaN(offset)) {
            App.showToast('Please provide a valid name and UTC offset.', 3000);
            return;
        }

        StorageManager.addWorldClock({ name, offset });
        this.elements.worldClockModal.classList.remove('open');
        this.renderWorldClocks();
        this.update(); // Force immediate tick
    },

    deleteWorldClock(id) {
        StorageManager.deleteWorldClock(id);
        this.renderWorldClocks();
    },

    renderWorldClocks() {
        if (!this.elements.worldClocksList) return;
        const clocks = StorageManager.getWorldClocks();

        if (clocks.length === 0) {
            this.elements.worldClocksList.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: var(--spacing-md); text-align: left; opacity: 0.7;">No world clocks added yet.</div>`;
            return;
        }

        this.elements.worldClocksList.innerHTML = clocks.map(c => `
            <div class="world-clock-card" id="${c.id}">
                <button class="world-clock-delete" data-id="${c.id}" title="Remove Clock">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div style="color: var(--color-text-light); font-weight: 500; margin-bottom: var(--spacing-sm);">${this.escapeHtml(c.name)} (UTC ${c.offset >= 0 ? '+' + c.offset : c.offset})</div>
                <div class="time-display" style="font-size: 2rem;">
                    <span class="wc-hours">--</span><span class="time-separator">:</span><span class="wc-minutes">--</span>
                    <span class="wc-ampm ampm" style="font-size: 1rem; margin-left: 4px;"></span>
                </div>
                <div class="wc-date" style="color: var(--color-text-muted); font-size: 0.85rem; margin-top: 4px;">--</div>
            </div>
        `).join('');

        // Attach delete listeners
        this.elements.worldClocksList.querySelectorAll('.world-clock-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.deleteWorldClock(id);
            });
        });
    },

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    update() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Handle 12/24 hour format for local time
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

        // Update World Clocks
        if (this.elements.worldClocksList) {
            const clocks = StorageManager.getWorldClocks();
            clocks.forEach(c => {
                const card = document.getElementById(c.id);
                if (!card) return;

                // Create a standard UTC time, then apply the offset manually
                const utcNowMs = now.getTime() + (now.getTimezoneOffset() * 60000);
                const tzMs = utcNowMs + (c.offset * 3600000);
                const tzDate = new Date(tzMs);

                let h = tzDate.getHours();
                const m = tzDate.getMinutes();
                let tzAmpm = '';

                if (!this.use24Hour) {
                    tzAmpm = h >= 12 ? 'PM' : 'AM';
                    h = h % 12;
                    h = h ? h : 12;
                }

                card.querySelector('.wc-hours').textContent = h.toString().padStart(2, '0');
                card.querySelector('.wc-minutes').textContent = m.toString().padStart(2, '0');

                const ampmEl = card.querySelector('.wc-ampm');
                ampmEl.textContent = tzAmpm;
                ampmEl.style.display = this.use24Hour ? 'none' : 'inline';

                // Display relative day context if it crosses midnight relative to local time
                let dayStr = formatDate(tzDate);
                const localDay = now.getDate();
                const tzDay = tzDate.getDate();
                if (localDay !== tzDay) {
                    const diff = tzMs - now.getTime();
                    dayStr += (diff > 0) ? ' (Tomorrow)' : ' (Yesterday)';
                }
                card.querySelector('.wc-date').textContent = dayStr;
            });
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
