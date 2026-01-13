/**
 * Advanced Stopwatches Module - Focus session stopwatches
 * 
 * Features:
 * - Custom name, color, and time goal
 * - Single active stopwatch rule
 * - Numeric and circular display modes
 * - Absolute time tracking
 */

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

        // Render
        this.render();

        // Start update interval for running stopwatches
        this.updateIntervalId = setInterval(() => this.updateRunningDisplays(), 100);
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
    },

    renderStopwatchCard(sw) {
        const elapsedMs = TimeTracker.getElapsedMs(sw);
        const goalMs = sw.goalMs || 8 * 60 * 60 * 1000; // Default 8 hours
        const progress = Math.min(elapsedMs / goalMs, 1);
        const percentProgress = Math.round(progress * 100);
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - progress);

        // Convert color to RGB for box shadow
        const colorRGB = this.hexToRgb(sw.color || '#6366f1');
        const colorRGBString = colorRGB ? `${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b}` : '99, 102, 241';

        return `
            <div class="stopwatch-card ${sw.isRunning ? 'running' : ''}" 
                 data-stopwatch-id="${sw.id}"
                 style="--stopwatch-color: ${sw.color || '#6366f1'}; --stopwatch-color-rgb: ${colorRGBString};">
                
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
                    <button class="btn btn-ghost" data-reset="${sw.id}" ${elapsedMs === 0 ? 'disabled' : ''}>Reset</button>
                </div>
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

        // Reset buttons
        this.elements.grid.querySelectorAll('[data-reset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.reset;
                this.resetStopwatch(id);
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

    startStopwatch(id) {
        // Single active stopwatch rule - stop all others
        this.stopwatches.forEach(sw => {
            if (sw.isRunning && sw.id !== id) {
                const stopped = TimeTracker.stopStopwatch(sw);
                Object.assign(sw, stopped);
                StorageManager.updateStopwatch(sw.id, stopped);
            }
        });

        // Start the selected one
        const sw = this.stopwatches.find(sw => sw.id === id);
        if (sw) {
            const started = TimeTracker.startStopwatch(sw);
            Object.assign(sw, started);
            StorageManager.updateStopwatch(id, started);
            this.render();
            App.showToast(`Started: ${sw.name}`);
        }
    },

    stopStopwatch(id) {
        const sw = this.stopwatches.find(sw => sw.id === id);
        if (sw) {
            const stopped = TimeTracker.stopStopwatch(sw);
            Object.assign(sw, stopped);
            StorageManager.updateStopwatch(id, stopped);
            this.render();
            App.showToast(`Stopped: ${sw.name}`);
        }
    },

    resetStopwatch(id) {
        const sw = this.stopwatches.find(sw => sw.id === id);
        if (sw) {
            // Save current time to history before resetting
            const elapsedMs = TimeTracker.getElapsedMs(sw);
            if (elapsedMs > 0) {
                StorageManager.addHistoryRecord({
                    stopwatchId: sw.id,
                    date: getDateString(),
                    totalMs: elapsedMs
                });
            }

            // Reset
            sw.isRunning = false;
            sw.startTimestamp = null;
            sw.accumulatedMs = 0;

            StorageManager.updateStopwatch(id, sw);
            this.render();
            App.showToast(`Reset: ${sw.name}`);
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

                    // Update percentage
                    const card = progressCircle.closest('.stopwatch-card');
                    const percentageEl = card?.querySelector('.circular-percentage');
                    if (percentageEl) {
                        percentageEl.textContent = `${Math.round(progress * 100)}%`;
                    }
                }

                // Update goal info
                const card = document.querySelector(`[data-stopwatch-id="${sw.id}"]`);
                const goalInfo = card?.querySelector('.stopwatch-goal-info');
                if (goalInfo) {
                    const goalMs = sw.goalMs || 8 * 60 * 60 * 1000;
                    goalInfo.textContent = `Goal: ${this.formatGoal(goalMs)} • ${formatTimeShort(elapsedMs)} tracked`;
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

        if (this.editingStopwatchId) {
            // Update existing
            const sw = this.stopwatches.find(s => s.id === this.editingStopwatchId);
            if (sw) {
                sw.name = name;
                sw.color = color;
                sw.goalMs = goalMs;
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

        const sw = this.stopwatches.find(s => s.id === this.editingStopwatchId);
        if (sw) {
            // Soft delete - keep for historical graphs
            sw.deleted = true;
            sw.isRunning = false;
            StorageManager.updateStopwatch(sw.id, sw);

            this.closeModal();
            this.render();
            App.showToast('Stopwatch deleted (history preserved)');
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
