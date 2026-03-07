/**
 * Advanced Stopwatches Module - Focus session stopwatches
 * 
 * Features:
 * - Custom name, color, and time goal
 * - Single active stopwatch rule
 * - Numeric and circular display modes
 * - Absolute time tracking
 * - Built-in "Waste Time" tracker that auto-runs when no other stopwatch is active
 */

// Built-in Waste Time stopwatch ID (cannot be deleted by user)
const WASTE_TIME_ID = 'untracked';

const AdvancedStopwatchesModule = {
    elements: {
        grid: null,
        emptyState: null,
        addBtn: null,
        modal: null,
        modalTitle: null,
        nameInput: null,
        colorInput: null,
        goalInput: null,
        modeBtns: null,
        colorPresets: null,
        saveBtn: null,
        deleteBtn: null
    },

    stopwatches: [],
    editingStopwatchId: null,
    updateIntervalId: null,
    wasteTimeCheckIntervalId: null, // Interval to check if waste time should auto-start
    _syncing: false,                // Prevents infinite sync loops with Log module

    init() {
        this.elements.grid = document.getElementById('stopwatches-grid');
        this.elements.emptyState = document.getElementById('no-stopwatches');
        this.elements.addBtn = document.getElementById('add-stopwatch-btn');
        this.elements.modal = document.getElementById('stopwatch-modal');
        this.elements.modalTitle = document.getElementById('stopwatch-modal-title');
        this.elements.nameInput = document.getElementById('stopwatch-name');
        this.elements.colorInput = document.getElementById('stopwatch-color');
        this.elements.goalInput = document.getElementById('stopwatch-goal');
        this.elements.modeBtns = document.querySelectorAll('.display-mode-selector .mode-btn');
        this.elements.colorPresets = document.querySelectorAll('.color-preset');
        this.elements.saveBtn = document.getElementById('save-stopwatch-btn');
        this.elements.deleteBtn = document.getElementById('delete-stopwatch-btn');

        // Load stopwatches
        this.stopwatches = StorageManager.getStopwatches();

        // Event listeners
        this.elements.addBtn?.addEventListener('click', () => this.openModal());
        this.elements.saveBtn?.addEventListener('click', () => this.saveStopwatch());
        this.elements.deleteBtn?.addEventListener('click', () => this.deleteStopwatch());

        // Modal close
        this.elements.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        this.elements.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Display mode buttons
        this.elements.modeBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Goal direction buttons
        this.elements.directionBtns = document.querySelectorAll('.goal-direction-selector .direction-btn');
        this.elements.directionBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.directionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Color presets
        this.elements.colorPresets?.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                if (this.elements.colorInput) {
                    this.elements.colorInput.value = color;
                }
                this.elements.colorPresets.forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // Color input change
        this.elements.colorInput?.addEventListener('input', () => {
            this.elements.colorPresets.forEach(p => p.classList.remove('active'));
        });

        // Ensure Waste Time stopwatch exists (built-in, cannot be deleted)
        this.ensureWasteTimeExists();

        // Calculate offline waste time (time when app was closed and no productive work)
        this.calculateOfflineWasteTime();

        // Cleanup old sessions (older than 90 days)
        StorageManager.cleanupOldSessions(90);

        // Render
        this.render();

        // Start update interval for running stopwatches
        this.updateIntervalId = setInterval(() => this.updateRunningDisplays(), 100);

        // Start waste time auto-check interval (every 2 seconds)
        this.wasteTimeCheckIntervalId = setInterval(() => this.checkWasteTimeAutoStart(), 2000);

        // Initial check for waste time auto-start
        setTimeout(() => this.checkWasteTimeAutoStart(), 500);
    },

    /**
     * Calculate offline waste time - time elapsed since app was closed
     * when no productive stopwatch was running. Max 12 hours (exclude overnight sleep).
     */
    calculateOfflineWasteTime() {
        const closeData = StorageManager.getLastCloseData();
        if (!closeData) return;

        // Handle legacy format (just a number timestamp)
        const lastCloseTime = typeof closeData === 'number' ? closeData : closeData.timestamp;
        const runningAtClose = typeof closeData === 'object' ? closeData.runningStopwatchId : null;

        if (!lastCloseTime) return;

        const now = Date.now();
        const MAX_OFFLINE_WASTE = 12 * 60 * 60 * 1000; // 12 hours max

        // Only add waste time if NO productive stopwatch was running at close
        // (waste time running or nothing running = add waste time)
        const productiveWasRunning = runningAtClose && runningAtClose !== WASTE_TIME_ID;

        if (!productiveWasRunning) {
            const wasteTime = this.stopwatches.find(sw => sw.id === WASTE_TIME_ID);
            if (wasteTime) {
                let offlineDuration = now - lastCloseTime;

                // Cap at 12 hours to exclude overnight sleep
                if (offlineDuration > MAX_OFFLINE_WASTE) {
                    offlineDuration = MAX_OFFLINE_WASTE;
                }

                // Only add if significant (> 1 minute)
                if (offlineDuration > 60000) {
                    wasteTime.accumulatedMs = (wasteTime.accumulatedMs || 0) + offlineDuration;
                    StorageManager.updateStopwatch(WASTE_TIME_ID, {
                        accumulatedMs: wasteTime.accumulatedMs
                    });

                    // Log offline session
                    StorageManager.addCompletedSession(
                        WASTE_TIME_ID,
                        lastCloseTime,
                        lastCloseTime + offlineDuration
                    );

                    console.log(`Added ${formatTimeShort(offlineDuration)} offline waste time`);
                }
            }
        }
    },

    // Ensure the built-in Waste Time stopwatch exists
    ensureWasteTimeExists() {
        let wasteTime = this.stopwatches.find(sw => sw.id === WASTE_TIME_ID);

        if (!wasteTime) {
            wasteTime = {
                id: WASTE_TIME_ID,
                name: 'Untracked Time',
                color: '#6b7280',
                goalMs: 2 * 60 * 60 * 1000,
                goalDirection: 'minimize',
                displayMode: 'circular',
                isRunning: false,
                startTimestamp: null,
                accumulatedMs: 0,
                lastResetDate: getDateString(),
                createdAt: Date.now(),
                isBuiltIn: true
            };
            this.stopwatches.push(wasteTime);
            StorageManager.addStopwatch(wasteTime);
            console.log('Created built-in Untracked Time stopwatch');
        }
    },

    checkWasteTimeAutoStart() {
        const wasteTime = this.stopwatches.find(sw => sw.id === WASTE_TIME_ID);
        if (!wasteTime || wasteTime.deleted) return;

        const otherStopwatchRunning = this.stopwatches.some(sw =>
            sw.id !== WASTE_TIME_ID &&
            sw.isRunning &&
            !sw.deleted
        );

        const dailyTaskRunning = typeof DailysModule !== 'undefined'
            && DailysModule.activeTimer
            && !DailysModule.activeTimer.isBreak;

        const productiveRunning = otherStopwatchRunning || dailyTaskRunning;

        if (productiveRunning && wasteTime.isRunning) {
            this.stopStopwatch(WASTE_TIME_ID, true);
        } else if (!productiveRunning && !wasteTime.isRunning) {
            this.startStopwatch(WASTE_TIME_ID, true);
        }
    },

    render() {
        if (!this.elements.grid) return;

        const activeStopwatches = this.stopwatches.filter(sw => !sw.deleted);

        if (activeStopwatches.length === 0) {
            this.elements.grid.innerHTML = '';
            this.elements.emptyState.style.display = 'flex';
            return;
        }

        this.elements.emptyState.style.display = 'none';

        this.elements.grid.innerHTML = activeStopwatches.map(sw => this.renderStopwatchCard(sw)).join('');

        // Add event listeners
        this.addCardEventListeners();

        // Add timeframe listener if not bound
        const selectEl = document.getElementById('stopwatches-timeframe-select');
        if (selectEl && !selectEl.dataset.bound) {
            selectEl.addEventListener('change', () => this.render());
            selectEl.dataset.bound = 'true';
        }
    },

    getAggregatedElapsedMs(sw, timeframe) {
        if (timeframe === 'today') {
            if (sw.id === 'tracked-time') {
                // Math sum of today's actual stopwatches
                return this.stopwatches.reduce((sum, s) => {
                    return !s.isBuiltIn ? sum + TimeTracker.getElapsedMs(s) : sum;
                }, 0);
            }
            return TimeTracker.getElapsedMs(sw);
        }

        // Sum historical records up to N days
        let days = 30;
        if (timeframe === '7days') days = 7;
        else if (timeframe === 'alltime') days = 9999;

        let total = 0;

        if (sw.id === 'tracked-time') {
            // Tracked time is the sum of all NON-builtin stopwatches historically
            const history = StorageManager.getHistory();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const builtinIds = ['untracked', 'break-time', 'tracked-time'];
            history.forEach(h => {
                if (!builtinIds.includes(h.stopwatchId) && new Date(h.date) >= cutoffDate) {
                    total += h.totalMs;
                }
            });

            // Add current live ongoing today
            total += this.stopwatches.reduce((sum, s) => !s.isBuiltIn ? sum + TimeTracker.getElapsedMs(s) : sum, 0);
            return total;
        }

        const history = StorageManager.getHistoryForStopwatch(sw.id, days);
        history.forEach(h => { total += h.totalMs; });
        // Add current live ongoing today manually since history cuts at midnight
        total += TimeTracker.getElapsedMs(sw);
        return total;
    },

    renderStopwatchCard(sw) {
        // Set timeframe default
        const timeframe = document.getElementById('stopwatches-timeframe-select')?.value || 'today';
        const elapsedMs = this.getAggregatedElapsedMs(sw, timeframe);
        const goalMs = sw.goalMs || 8 * 60 * 60 * 1000; // Default 8 hours
        const progress = Math.min(elapsedMs / goalMs, 1);
        const percentProgress = Math.round(progress * 100);
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - progress);

        // Convert color to RGB for box shadow
        const colorRGB = this.hexToRgb(sw.color || '#6366f1');
        const colorRGBString = colorRGB ? `${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b}` : '99, 102, 241';

        // Check if this is a built-in auto-managed stopwatch
        if (sw.isBuiltIn) {
            return this.renderBuiltInCard(sw, elapsedMs, percentProgress, offset, circumference, colorRGBString);
        }

        return `
            <div class="stopwatch-card ${sw.isRunning ? 'running' : ''} ${wasteTimeClass}" 
                 data-stopwatch-id="${sw.id}"
                 style="--stopwatch-color: ${sw.color || '#6366f1'}; --stopwatch-color-rgb: ${colorRGBString}; --progress: ${percentProgress};">
                
                <div class="stopwatch-card-header">
                    <div class="stopwatch-name">
                        <span class="stopwatch-color-dot"></span>
                        <span>${this.escapeHtml(sw.name)}</span>
                        ${sw.isRunning ? '<span class="status-running"><span class="status-dot"></span>Running</span>' : ''}
                    </div>
                    <div class="stopwatch-card-actions">
                        <button class="btn btn-icon btn-ghost" data-edit="${sw.id}" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                    </div>
                </div>

                <div class="stopwatch-card-body">
                    ${sw.displayMode === 'circular' ? this.renderCircularDisplay(sw, elapsedMs, percentProgress, offset, circumference) : this.renderNumericDisplay(sw, elapsedMs)}
                    
                    <div class="stopwatch-goal-info">
                        Goal: ${this.formatGoal(goalMs)} • ${formatTimeShort(elapsedMs)} tracked
                    </div>
                </div>

                <div class="stopwatch-card-controls">
                    ${sw.isRunning ? `
                        <button class="btn btn-secondary btn-large" data-stop="${sw.id}">Stop</button>
                    ` : `
                        <button class="btn btn-primary btn-large" data-start="${sw.id}">Start</button>
                    `}
                </div>
            </div>
        `;
    },

    // Special simplified rendering for Built-In stopwatches - no user edit, auto-managed
    renderBuiltInCard(sw, elapsedMs, percentProgress, offset, circumference, colorRGBString) {
        return `
            <div class="stopwatch-card ${sw.isRunning ? 'running' : ''} built-in-card" 
                 data-stopwatch-id="${sw.id}"
                 style="--stopwatch-color: ${sw.color}; --stopwatch-color-rgb: ${colorRGBString}; --progress: ${percentProgress};">
                
                <div class="stopwatch-card-header">
                    <div class="stopwatch-name">
                        <span class="stopwatch-color-dot"></span>
                        <span>${this.escapeHtml(sw.name)}</span>
                        ${sw.isRunning ? '<span class="status-running"><span class="status-dot"></span>Running</span>' : '<span class="status-paused">Paused</span>'}
                    </div>
                </div>

                <div class="stopwatch-card-body waste-time-body">
                    <div class="waste-time-display" data-display="${sw.id}">
                        ${formatTime(elapsedMs)}
                    </div>
                    <div class="waste-time-label" style="text-transform: capitalize; font-size: 0.9rem; opacity: 0.7; margin-top: 4px;">
                        Total ${sw.name}
                    </div>
                </div>

                ${sw.id !== 'tracked-time' ? `
                <div class="stopwatch-card-controls" style="margin-top: var(--spacing-md); justify-content: center;">
                    ${sw.isRunning ? `
                        <button class="btn btn-secondary btn-large" data-stop="${sw.id}" style="width: 100%; max-width: 150px;">Stop</button>
                    ` : `
                        <button class="btn btn-primary btn-large" data-start="${sw.id}" style="width: 100%; max-width: 150px;">Start</button>
                    `}
                </div>
                ` : ''}
            </div>
        `;
    },

    renderNumericDisplay(sw, elapsedMs) {
        return `
            <div class="stopwatch-numeric-display" data-display="${sw.id}">
                ${formatTime(elapsedMs)}
            </div>
        `;
    },

    renderCircularDisplay(sw, elapsedMs, percentProgress, offset, circumference) {
        return `
            <div class="stopwatch-circular-display">
                <svg class="circular-progress" width="200" height="200" viewBox="0 0 200 200">
                    <circle class="circular-progress-bg" cx="100" cy="100" r="90" />
                    <circle class="circular-progress-fill" 
                            cx="100" cy="100" r="90"
                            style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; stroke: ${sw.color || '#6366f1'};"
                            data-progress="${sw.id}" />
                </svg>
                <div class="circular-center">
                    <div class="circular-percentage">${percentProgress}%</div>
                    <div class="circular-goal">${this.formatGoal(sw.goalMs)}</div>
                </div>
            </div>
        `;
    },

    addCardEventListeners() {
        // Start buttons
        this.elements.grid.querySelectorAll('[data-start]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.start;
                this.startStopwatch(id);
            });
        });

        // Stop buttons
        this.elements.grid.querySelectorAll('[data-stop]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.stop;
                this.stopStopwatch(id);
            });
        });

        // Edit buttons
        this.elements.grid.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.edit;
                this.openModal(id);
            });
        });
    },

    startStopwatch(id, silent = false, fromLog = false) {
        // Single active stopwatch rule - stop all others (except waste time auto-management)
        this.stopwatches.forEach(sw => {
            if (sw.isRunning && sw.id !== id) {
                const stopped = TimeTracker.stopStopwatch(sw);
                Object.assign(sw, stopped);
                StorageManager.updateStopwatch(sw.id, stopped);
                // End the session for the stopped stopwatch
                StorageManager.endSession(sw.id);
            }
        });

        // Start the selected one
        const sw = this.stopwatches.find(sw => sw.id === id);
        if (sw) {
            const started = TimeTracker.startStopwatch(sw);
            Object.assign(sw, started);
            StorageManager.updateStopwatch(id, started);
            // Start a new session for this stopwatch
            StorageManager.startSession(id);
            this.render();
            if (!silent) {
                App.showToast(`Started: ${sw.name}`);
            }

            // Sync: auto-start Log entry (unless this call came from Log)
            if (!fromLog && !this._syncing && id !== WASTE_TIME_ID && typeof DailysModule !== 'undefined') {
                this._syncing = true;
                DailysModule.startTask(sw.name, true);
                this._syncing = false;
            }

            // Trigger waste time check after any start
            this.checkWasteTimeAutoStart();
        }
    },

    stopStopwatch(id, silent = false, fromLog = false) {
        const sw = this.stopwatches.find(sw => sw.id === id);
        if (sw) {
            const stopped = TimeTracker.stopStopwatch(sw);
            Object.assign(sw, stopped);
            StorageManager.updateStopwatch(id, stopped);
            // End the session for this stopwatch
            StorageManager.endSession(id);
            this.render();
            if (!silent) {
                App.showToast(`Stopped: ${sw.name}`);
            }

            // Sync: stop Log timer (unless this call came from Log)
            if (!fromLog && !this._syncing && id !== WASTE_TIME_ID && typeof DailysModule !== 'undefined') {
                this._syncing = true;
                DailysModule.stopCurrentTimer(true, true);
                this._syncing = false;
            }

            // Trigger waste time check after any stop
            if (id !== WASTE_TIME_ID) {
                setTimeout(() => this.checkWasteTimeAutoStart(), 100);
            }
        }
    },

    updateRunningDisplays() {
        this.stopwatches.forEach(sw => {
            if (sw.isRunning) {
                const elapsedMs = TimeTracker.getElapsedMs(sw);

                // Update numeric display
                const numericDisplay = document.querySelector(`[data-display="${sw.id}"]`);
                if (numericDisplay) {
                    numericDisplay.textContent = formatTime(elapsedMs);
                }

                // Update circular progress
                const progressCircle = document.querySelector(`[data-progress="${sw.id}"]`);
                if (progressCircle) {
                    const goalMs = sw.goalMs || 8 * 60 * 60 * 1000;
                    const progress = Math.min(elapsedMs / goalMs, 1);
                    const circumference = 2 * Math.PI * 90;
                    const offset = circumference * (1 - progress);
                    progressCircle.style.strokeDashoffset = offset;

                    const card = progressCircle.closest('.stopwatch-card');
                    const percentageEl = card?.querySelector('.circular-percentage');
                    if (percentageEl) {
                        percentageEl.textContent = `${Math.round(progress * 100)}%`;
                    }
                }

                const card = document.querySelector(`[data-stopwatch-id="${sw.id}"]`);
                if (card) {
                    const goalMs = sw.goalMs || 8 * 60 * 60 * 1000;
                    const progress = Math.min(elapsedMs / goalMs, 1);
                    const percentProgress = Math.round(progress * 100);

                    card.style.setProperty('--progress', percentProgress);

                    const goalInfo = card.querySelector('.stopwatch-goal-info');
                    if (goalInfo) {
                        goalInfo.textContent = `Goal: ${this.formatGoal(goalMs)} • ${formatTimeShort(elapsedMs)} tracked`;
                    }
                }

                // Session duration warning (skip waste-time)
                if (sw.id !== WASTE_TIME_ID && App.maxSessionMs) {
                    const sessionMs = sw.startTimestamp ? (Date.now() - sw.startTimestamp) : 0;
                    const card2 = document.querySelector(`[data-stopwatch-id="${sw.id}"]`);
                    if (sessionMs >= App.maxSessionMs) {
                        App.fireSessionWarning(sw.name);
                        this.stopStopwatch(sw.id);
                        card2?.classList.remove('session-exceeded');
                    } else {
                        card2?.classList.remove('session-exceeded');
                    }
                }
            }
        });
    },

    openModal(stopwatchId = null) {
        this.editingStopwatchId = stopwatchId;

        if (stopwatchId) {
            const sw = this.stopwatches.find(s => s.id === stopwatchId);
            if (sw) {
                this.elements.modalTitle.textContent = 'Edit Stopwatch';
                this.elements.nameInput.value = sw.name;
                this.elements.colorInput.value = sw.color || '#6366f1';
                this.elements.goalInput.value = (sw.goalMs || 8 * 60 * 60 * 1000) / 3600000;

                // Set display mode
                this.elements.modeBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === sw.displayMode);
                });

                // Set color preset
                this.elements.colorPresets.forEach(preset => {
                    preset.classList.toggle('active', preset.dataset.color === sw.color);
                });

                // Set goal direction
                this.elements.directionBtns?.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.direction === (sw.goalDirection || 'maximize'));
                });

                this.elements.saveBtn.textContent = 'Save';
                this.elements.deleteBtn.style.display = 'inline-flex';
            }
        } else {
            this.elements.modalTitle.textContent = 'New Stopwatch';
            this.elements.nameInput.value = '';
            this.elements.colorInput.value = '#6366f1';
            this.elements.goalInput.value = 8;

            this.elements.modeBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === 'numeric');
            });
            this.elements.colorPresets.forEach(p => p.classList.remove('active'));
            this.elements.colorPresets[0]?.classList.add('active');

            // Reset goal direction to maximize
            this.elements.directionBtns?.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.direction === 'maximize');
            });

            this.elements.saveBtn.textContent = 'Create';
            this.elements.deleteBtn.style.display = 'none';
        }

        this.elements.modal.classList.add('open');
    },

    closeModal() {
        this.elements.modal.classList.remove('open');
        this.editingStopwatchId = null;
    },

    saveStopwatch() {
        const name = this.elements.nameInput.value.trim();
        if (!name) {
            App.showToast('Please enter a name');
            return;
        }

        const color = this.elements.colorInput.value;
        const goalHours = parseFloat(this.elements.goalInput.value) || 8;
        const goalMs = goalHours * 60 * 60 * 1000;

        let displayMode = 'numeric';
        this.elements.modeBtns.forEach(btn => {
            if (btn.classList.contains('active')) {
                displayMode = btn.dataset.mode;
            }
        });

        let goalDirection = 'maximize';
        this.elements.directionBtns?.forEach(btn => {
            if (btn.classList.contains('active')) {
                goalDirection = btn.dataset.direction;
            }
        });

        if (this.editingStopwatchId) {
            // Update existing
            const sw = this.stopwatches.find(s => s.id === this.editingStopwatchId);
            if (sw) {
                sw.name = name;
                sw.color = color;
                sw.goalMs = goalMs;
                sw.goalDirection = goalDirection;
                sw.displayMode = displayMode;
                StorageManager.updateStopwatch(sw.id, sw);
            }
        } else {
            // Create new
            const newStopwatch = {
                id: generateId(),
                name,
                color,
                goalMs,
                goalDirection,
                displayMode,
                isRunning: false,
                startTimestamp: null,
                accumulatedMs: 0,
                lastResetDate: getDateString(),
                createdAt: Date.now(),
                deleted: false
            };
            this.stopwatches.push(newStopwatch);
            StorageManager.addStopwatch(newStopwatch);
        }

        this.closeModal();
        this.render();
        App.showToast(this.editingStopwatchId ? 'Stopwatch updated' : 'Stopwatch created');
    },

    deleteStopwatch() {
        if (!this.editingStopwatchId) return;

        // Prevent deleting built-in Waste Time stopwatch
        if (this.editingStopwatchId === WASTE_TIME_ID) {
            App.showToast('Cannot delete built-in Waste Time tracker');
            this.closeModal();
            return;
        }

        const sw = this.stopwatches.find(s => s.id === this.editingStopwatchId);
        if (sw) {
            // Soft delete - keep for historical graphs
            sw.deleted = true;
            sw.isRunning = false;
            StorageManager.updateStopwatch(sw.id, sw);

            this.closeModal();
            this.render();
            App.showToast('Stopwatch deleted (history preserved)');

            // Check if waste time should auto-start after deletion
            setTimeout(() => this.checkWasteTimeAutoStart(), 100);
        }
    },

    formatGoal(ms) {
        const hours = ms / 3600000;
        return hours === 1 ? '1 hour' : `${hours} hours`;
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    destroy() {
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
        }
    }
};

window.AdvancedStopwatchesModule = AdvancedStopwatchesModule;
