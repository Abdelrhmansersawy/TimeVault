/**
 * App Controller - Main application initialization and coordination
 */

const App = {
    currentSection: 'timelog',
    previousSection: 'timelog',

    init() {
        console.log('Time Vault initializing...');

        // Load settings first so modules have correct state
        this.setupPanelWidth();
        this.setupTimeDateSettings();
        this.setupMaxSession();
        this.setupTabVisibility();
        this.setupIdleTracker();

        // Initialize account creation date (for graph boundaries)
        StorageManager.initAccountCreatedAt();

        // Process any missed time since last close
        TimeTracker.processOnAppLoad();

        // Initialize all modules
        ClockModule.init();
        AlarmModule.init();
        TimerModule.init();
        StopwatchModule.init();
        AdvancedStopwatchesModule.init();
        TasksModule.init();
        DailysModule.init();
        HabitsModule.init();
        GraphsModule.init();

        // Set up navigation
        this.setupNavigation();

        // Floating settings button
        document.getElementById('settings-toggle')?.addEventListener('click', () => {
            this.previousSection = this.currentSection;
            this.navigateTo('settings');
        });

        // Settings close button — go back to previous section
        document.getElementById('settings-close-btn')?.addEventListener('click', () => {
            this.navigateTo(this.previousSection || 'timelog');
        });

        // Schedule midnight check
        TimeTracker.scheduleMidnightCheck();

        // Save close time on page unload
        window.addEventListener('beforeunload', () => {
            StorageManager.saveLastCloseTime();
        });

        // Also save periodically
        setInterval(() => {
            StorageManager.saveLastCloseTime();
        }, 60000); // Every minute

        // Theme system
        ThemeManager.init();
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            ThemeManager.toggle();
        });

        // Set up quick capture
        this.setupQuickCapture();

        // Initialize keyboard shortcuts (handles Ctrl+N and more)
        ShortcutsModule.init();
        ShortcutsModule.renderPanel();

        // Shortcuts reset button
        document.getElementById('shortcuts-reset-btn')?.addEventListener('click', () => {
            ShortcutsModule.resetToDefaults();
        });

        // Panel width slider initialized above

        // Day start setting initialized above

        // Max session duration warning initialized above

        // Notification permission (once per session)
        this.setupNotificationPrompt();

        // Obsidian vault sync
        if (typeof VaultSync !== 'undefined') VaultSync.init();

        console.log('Time Vault initialized successfully!');
    },

    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const section = tab.dataset.section;
                this.navigateTo(section);
            });
        });
    },

    navigateTo(section) {
        this.currentSection = section;

        // Update tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.section === section);
        });

        // Update sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `${section}-section`);
        });

        // Refresh sections when navigated to
        if (section === 'graphs') {
            GraphsModule.render();
        } else if (section === 'habits') {
            HabitsModule.render();
        }
    },

    setupTabVisibility() {
        const defaultOrder = ['timelog', 'stopwatches', 'clock', 'tasks', 'dailys', 'habits', 'graphs'];
        const labels = {
            'timelog': 'Log', 'stopwatches': 'Focus', 'clock': 'Clock',
            'tasks': 'Tasks', 'dailys': 'Daily', 'habits': 'Habits', 'graphs': 'Graphs'
        };
        const alwaysVisible = ['timelog'];

        let appMode = localStorage.getItem('appMode') || 'customized';
        const modeSelect = document.getElementById('app-mode-select');
        if (modeSelect) {
            modeSelect.value = appMode;
            modeSelect.addEventListener('change', (e) => {
                localStorage.setItem('appMode', e.target.value);
                this.setupTabVisibility();
            });
        }

        let savedOrder = localStorage.getItem('tabOrder');
        savedOrder = savedOrder ? JSON.parse(savedOrder) : defaultOrder;

        // Ensure all default tabs exist in savedOrder
        defaultOrder.forEach(t => { if (!savedOrder.includes(t)) savedOrder.push(t); });

        const container = document.getElementById('tab-visibility-list');
        if (container) {
            container.innerHTML = '';

            // If not customized, we might disable sorting or just grey out the toggles
            const isCustomized = (appMode === 'customized');

            savedOrder.forEach((tab, index) => {
                let isVisible = true;
                if (isCustomized) {
                    let lsVal = localStorage.getItem(`tabVisible_${tab}`);
                    isVisible = lsVal === null ? true : lsVal === 'true';
                } else if (appMode === 'simple') {
                    isVisible = ['timelog', 'stopwatches', 'tasks'].includes(tab);
                } else if (appMode === 'advanced') {
                    isVisible = true;
                }

                // Force visibility for alwaysVisible tabs
                if (alwaysVisible.includes(tab)) isVisible = true;

                // Set initial DOM Flex order
                const navItem = document.querySelector(`.nav-tab[data-section="${tab}"]`);
                if (navItem) {
                    navItem.style.order = index;
                    navItem.style.display = isVisible ? 'flex' : 'none';
                }

                if (!labels[tab]) return; // Skip if invalid

                const row = document.createElement('div');
                row.className = 'setting-row';
                if (!isCustomized) row.style.opacity = '0.5';

                let toggleHtml = alwaysVisible.includes(tab) ?
                    `<small style="color:var(--color-text-muted)">Required</small>` :
                    `<label class="toggle"><input type="checkbox" id="toggle-tab-${tab}" ${isVisible ? 'checked' : ''} ${!isCustomized ? 'disabled' : ''}><span class="toggle-slider"></span></label>`;

                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="setting-label">${labels[tab]}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="display:flex; gap:4px;">
                            <button class="btn btn-icon btn-sm" onclick="App.moveTab('${tab}', -1)" ${index === 0 || !isCustomized ? 'disabled' : ''}>↑</button>
                            <button class="btn btn-icon btn-sm" onclick="App.moveTab('${tab}', 1)" ${index === savedOrder.length - 1 || !isCustomized ? 'disabled' : ''}>↓</button>
                        </div>
                        ${toggleHtml}
                    </div>
                `;
                container.appendChild(row);

                // Listen for toggle changes
                if (!alwaysVisible.includes(tab)) {
                    const toggle = row.querySelector(`#toggle-tab-${tab}`);
                    if (toggle) {
                        toggle.addEventListener('change', (e) => {
                            const checked = e.target.checked;
                            localStorage.setItem(`tabVisible_${tab}`, checked);
                            if (navItem) navItem.style.display = checked ? 'flex' : 'none';
                            if (!checked && App.currentSection === tab) {
                                App.navigateTo('timelog');
                            }
                        });
                    }
                }
            });
        }
    },

    moveTab(tab, direction) {
        const defaultOrder = ['timelog', 'stopwatches', 'clock', 'tasks', 'dailys', 'habits', 'graphs'];
        let savedOrder = localStorage.getItem('tabOrder');
        savedOrder = savedOrder ? JSON.parse(savedOrder) : defaultOrder;

        const index = savedOrder.indexOf(tab);
        if (index === -1) return;
        const newIndex = index + direction;

        if (newIndex >= 0 && newIndex < savedOrder.length) {
            // Swap
            [savedOrder[index], savedOrder[newIndex]] = [savedOrder[newIndex], savedOrder[index]];
            localStorage.setItem('tabOrder', JSON.stringify(savedOrder));
            this.setupTabVisibility(); // Re-render settings UI and sidebar
        }
    },

    setupIdleTracker() {
        let idleTimeout;
        const IDLE_LIMIT = 5000; // 5 seconds of inactivity

        const resetIdle = () => {
            clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => {
                if (typeof DailysModule !== 'undefined' && DailysModule.startBreak) {
                    if (!DailysModule.activeTimer || !DailysModule.activeTimer.isBreak) {
                        DailysModule.startBreak("Auto Break (Idle)");
                        App.showToast("Started break due to 5s inactivity");
                    }
                }
            }, IDLE_LIMIT);
        };

        ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, resetIdle, { passive: true });
        });
        resetIdle();
    },

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }
    },

    /**
     * Setup global keyboard shortcut for quick task capture
     */
    setupQuickCapture() {
        // Quick capture save button
        document.getElementById('quick-capture-save')?.addEventListener('click', () => {
            this.saveQuickCapture();
        });

        // Enter to save, Escape to close
        document.getElementById('quick-capture-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveQuickCapture();
            if (e.key === 'Escape') this.closeQuickCapture();
        });

        // Close on backdrop click
        document.getElementById('quick-capture-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'quick-capture-overlay') {
                this.closeQuickCapture();
            }
        });
    },

    toggleQuickCapture() {
        const overlay = document.getElementById('quick-capture-overlay');
        if (!overlay) return;

        if (overlay.classList.contains('open')) {
            this.closeQuickCapture();
        } else {
            overlay.classList.add('open');

            if (typeof TasksModule !== 'undefined') {
                TasksModule.populateStopwatchSelect('quick-capture-stopwatch');
            }

            const input = document.getElementById('quick-capture-input');
            input.value = '';
            document.getElementById('quick-capture-priority').value = 'medium';
            const swSelect = document.getElementById('quick-capture-stopwatch');
            if (swSelect) swSelect.value = '';
            setTimeout(() => input?.focus(), 50);
        }
    },

    closeQuickCapture() {
        const overlay = document.getElementById('quick-capture-overlay');
        if (overlay) overlay.classList.remove('open');
    },

    setupPanelWidth() {
        const slider = document.getElementById('panel-width-slider');
        const label = document.getElementById('panel-width-value');
        const saved = localStorage.getItem('panelWidth');

        if (saved) {
            const val = parseInt(saved, 10);
            this.applyPanelWidth(val);
            if (slider) slider.value = val;
            if (label) label.textContent = `${val}px`;
        }

        slider?.addEventListener('input', () => {
            const val = parseInt(slider.value, 10);
            this.applyPanelWidth(val);
            if (label) label.textContent = `${val}px`;
            localStorage.setItem('panelWidth', val);
        });
    },

    applyPanelWidth(px) {
        document.documentElement.style.setProperty('--layout-max-width', `${px}px`);
    },

    setupTimeDateSettings() {
        const input = document.getElementById('day-start-hour');

        let saved = localStorage.getItem('dayStartHour');
        if (!saved) saved = '0';

        this.dayStartHour = parseInt(saved, 10);

        if (input) {
            input.value = this.dayStartHour;
            input.addEventListener('input', () => {
                let val = parseInt(input.value, 10);
                if (isNaN(val) || val < 0) val = 0;
                if (val > 23) val = 23;
                input.value = val;

                this.dayStartHour = val;
                localStorage.setItem('dayStartHour', val.toString());

                // Trigger re-render of dailys if available
                if (typeof DailysModule !== 'undefined') {
                    DailysModule.render();
                    if (DailysModule.currentSection === 'time-log') {
                        DailysModule.renderTimeLogPage();
                    }
                }
            });
        }
    },

    setupMaxSession() {
        const slider = document.getElementById('max-session-slider');
        const label = document.getElementById('max-session-value');
        const soundToggle = document.getElementById('session-warning-sound');

        const savedMin = localStorage.getItem('maxSessionMinutes');
        const savedSound = localStorage.getItem('sessionWarningSound');

        const defaultMin = 90;
        const minutes = savedMin ? parseInt(savedMin, 10) : defaultMin;

        this.maxSessionMs = minutes * 60 * 1000;
        this.sessionWarningSound = savedSound !== 'false';
        this.sessionWarningFired = {};

        if (slider) slider.value = minutes;
        if (label) label.textContent = this.formatMinutesLabel(minutes);
        if (soundToggle) soundToggle.checked = this.sessionWarningSound;

        slider?.addEventListener('input', () => {
            const val = parseInt(slider.value, 10);
            this.maxSessionMs = val * 60 * 1000;
            this.sessionWarningFired = {};
            if (label) label.textContent = this.formatMinutesLabel(val);
            localStorage.setItem('maxSessionMinutes', val);
        });

        soundToggle?.addEventListener('change', () => {
            this.sessionWarningSound = soundToggle.checked;
            localStorage.setItem('sessionWarningSound', soundToggle.checked);
        });
    },

    formatMinutesLabel(min) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    },

    fireSessionWarning(label) {
        const key = label || '_default';
        if (this.sessionWarningFired[key]) return;
        this.sessionWarningFired[key] = true;

        const limitLabel = this.formatMinutesLabel(this.maxSessionMs / 60000);
        this.showToast(`"${label}" exceeded ${limitLabel} — take a break!`, 6000);

        if (this.sessionWarningSound) {
            this.playWarningBeep();
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Session Limit Reached', {
                body: `"${label}" has been running for over ${limitLabel}. Consider taking a break.`,
                icon: 'assets/favicon.png'
            });
        }
    },

    playWarningBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.15;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.stop(ctx.currentTime + 0.4);
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 660;
                osc2.type = 'sine';
                gain2.gain.value = 0.15;
                osc2.start();
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc2.stop(ctx.currentTime + 0.5);
            }, 250);
        } catch (e) { /* audio not available */ }
    },

    setupNotificationPrompt() {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return;
        if (sessionStorage.getItem('notif_prompt_dismissed')) return;

        const prompt = document.getElementById('notification-prompt');
        if (!prompt) return;
        prompt.style.display = 'flex';

        document.getElementById('notification-enable')?.addEventListener('click', () => {
            Notification.requestPermission().then(perm => {
                prompt.style.display = 'none';
                sessionStorage.setItem('notif_prompt_dismissed', '1');
                if (perm === 'granted') this.showToast('Notifications enabled');
            });
        });

        document.getElementById('notification-dismiss')?.addEventListener('click', () => {
            prompt.style.display = 'none';
            sessionStorage.setItem('notif_prompt_dismissed', '1');
        });
    },

    saveQuickCapture() {
        const input = document.getElementById('quick-capture-input');
        const prioritySelect = document.getElementById('quick-capture-priority');
        const swSelect = document.getElementById('quick-capture-stopwatch');

        const title = input?.value.trim();
        if (!title) {
            input?.focus();
            return;
        }

        if (!swSelect?.value) {
            this.showToast('Please assign a focus stopwatch');
            swSelect?.focus();
            return;
        }

        StorageManager.addTask({
            title,
            category: '',
            description: '',
            priority: prioritySelect?.value || 'medium',
            status: 'todo',
            tags: [],
            subtasks: [],
            assignedStopwatch: swSelect.value
        });

        if (typeof TasksModule !== 'undefined') {
            TasksModule.tasks = StorageManager.getTasks();
            TasksModule.render();
        }

        this.showToast(`Captured: ${title}`);
        this.closeQuickCapture();
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for global access
window.App = App;
