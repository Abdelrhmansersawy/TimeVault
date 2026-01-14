/**
 * Alarm Module - Alarm management
 */

const AlarmModule = {
    elements: {
        list: null,
        emptyState: null,
        addBtn: null,
        modal: null,
        modalTitle: null,
        timeInput: null,
        labelInput: null,
        dayBtns: null,
        saveBtn: null
    },

    alarms: [],
    editingAlarmId: null,
    checkIntervalId: null,

    init() {
        this.elements.list = document.getElementById('alarms-list');
        this.elements.emptyState = document.getElementById('no-alarms');
        this.elements.addBtn = document.getElementById('add-alarm-btn');
        this.elements.modal = document.getElementById('alarm-modal');
        this.elements.modalTitle = document.getElementById('alarm-modal-title');
        this.elements.timeInput = document.getElementById('alarm-time');
        this.elements.labelInput = document.getElementById('alarm-label');
        this.elements.dayBtns = document.querySelectorAll('.days-selector .day-btn');
        this.elements.saveBtn = document.getElementById('save-alarm-btn');

        // Load alarms
        this.alarms = StorageManager.getAlarms();

        // Event listeners
        this.elements.addBtn?.addEventListener('click', () => this.openModal());
        this.elements.saveBtn?.addEventListener('click', () => this.saveAlarm());

        // Modal close buttons
        this.elements.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        this.elements.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Day buttons
        this.elements.dayBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });
        });

        // Render and start checking
        this.render();
        this.startChecking();
    },

    render() {
        if (!this.elements.list) return;

        const activeAlarms = this.alarms.filter(a => !a.deleted);

        if (activeAlarms.length === 0) {
            this.elements.list.innerHTML = '';
            this.elements.emptyState.style.display = 'flex';
            return;
        }

        this.elements.emptyState.style.display = 'none';

        this.elements.list.innerHTML = activeAlarms.map(alarm => `
            <div class="alarm-card ${alarm.enabled ? '' : 'disabled'}" data-alarm-id="${alarm.id}">
                <div class="alarm-info">
                    <div class="alarm-time">${this.formatAlarmTime(alarm.time)}</div>
                    <div class="alarm-label">${alarm.label || 'Alarm'}</div>
                    <div class="alarm-days">
                        ${this.renderDays(alarm.days)}
                    </div>
                </div>
                <div class="alarm-actions">
                    <label class="toggle">
                        <input type="checkbox" ${alarm.enabled ? 'checked' : ''} data-toggle-alarm="${alarm.id}">
                        <span class="toggle-slider"></span>
                    </label>
                    <button class="btn btn-icon btn-ghost" data-edit-alarm="${alarm.id}" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                    <button class="btn btn-icon btn-ghost" data-delete-alarm="${alarm.id}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        this.elements.list.querySelectorAll('[data-toggle-alarm]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const id = e.target.dataset.toggleAlarm;
                this.toggleAlarm(id, e.target.checked);
            });
        });

        this.elements.list.querySelectorAll('[data-edit-alarm]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.editAlarm;
                this.openModal(id);
            });
        });

        this.elements.list.querySelectorAll('[data-delete-alarm]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.deleteAlarm;
                this.deleteAlarm(id);
            });
        });
    },

    renderDays(days) {
        const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        return dayLetters.map((letter, i) =>
            `<span class="alarm-day ${days.includes(i) ? 'active' : ''}">${letter}</span>`
        ).join('');
    },

    formatAlarmTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const settings = StorageManager.getSettings();

        if (settings.use24Hour) {
            return time;
        }

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    },

    openModal(alarmId = null) {
        this.editingAlarmId = alarmId;

        if (alarmId) {
            const alarm = this.alarms.find(a => a.id === alarmId);
            if (alarm) {
                this.elements.modalTitle.textContent = 'Edit Alarm';
                this.elements.timeInput.value = alarm.time;
                this.elements.labelInput.value = alarm.label || '';
                this.elements.dayBtns.forEach(btn => {
                    btn.classList.toggle('active', alarm.days.includes(parseInt(btn.dataset.day)));
                });
            }
        } else {
            this.elements.modalTitle.textContent = 'Add Alarm';
            this.elements.timeInput.value = '';
            this.elements.labelInput.value = '';
            this.elements.dayBtns.forEach(btn => btn.classList.remove('active'));
        }

        this.elements.modal.classList.add('open');
    },

    closeModal() {
        this.elements.modal.classList.remove('open');
        this.editingAlarmId = null;
    },

    saveAlarm() {
        const time = this.elements.timeInput.value;
        if (!time) {
            App.showToast('Please set a time');
            return;
        }

        const label = this.elements.labelInput.value.trim();
        const days = [];
        this.elements.dayBtns.forEach(btn => {
            if (btn.classList.contains('active')) {
                days.push(parseInt(btn.dataset.day));
            }
        });

        if (this.editingAlarmId) {
            // Update existing alarm
            const index = this.alarms.findIndex(a => a.id === this.editingAlarmId);
            if (index !== -1) {
                this.alarms[index] = {
                    ...this.alarms[index],
                    time,
                    label,
                    days
                };
            }
        } else {
            // Create new alarm
            const alarm = {
                id: generateId(),
                time,
                label,
                days,
                enabled: true,
                createdAt: Date.now()
            };
            this.alarms.push(alarm);
        }

        StorageManager.saveAlarms(this.alarms);
        this.closeModal();
        this.render();
        App.showToast(this.editingAlarmId ? 'Alarm updated' : 'Alarm created');
    },

    toggleAlarm(id, enabled) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = enabled;
            StorageManager.saveAlarms(this.alarms);
            this.render();
        }
    },

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        StorageManager.saveAlarms(this.alarms);
        this.render();
        App.showToast('Alarm deleted');
    },

    startChecking() {
        // Check alarms every second
        this.checkIntervalId = setInterval(() => this.checkAlarms(), 1000);
    },

    checkAlarms() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = now.getDay();
        const currentSeconds = now.getSeconds();

        // Only check at the start of each minute
        if (currentSeconds !== 0) return;

        this.alarms.forEach(alarm => {
            if (!alarm.enabled) return;
            if (alarm.time !== currentTime) return;
            if (alarm.days.length > 0 && !alarm.days.includes(currentDay)) return;

            // Trigger alarm
            this.triggerAlarm(alarm);
        });
    },

    triggerAlarm(alarm) {
        // Play sound
        const audio = document.getElementById('alarm-sound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
        }

        // Show notification
        App.showToast(`Alarm: ${alarm.label || 'Time is up'}!`);

        // Try system notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Time Vault Alarm', {
                body: alarm.label || 'Time is up!'
            });
        }
    },

    destroy() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
        }
    }
};

window.AlarmModule = AlarmModule;
