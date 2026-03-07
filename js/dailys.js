/**
 * Daily Journal Module - Daily reflection and planning
 * 
 * Features:
 * - Daily entries with routine, plan (from Task Database), done, blocked, tomorrow, reflection
 * - Plan items come from centralized Task Database
 * - Completing items updates both daily and task database
 * - Date navigation for past entries
 * - Auto-save on input change
 * - Automated Time Log with task/break timers
 */

const DailysModule = {
    elements: {
        container: null,
        dateDisplay: null,
        prevBtn: null,
        nextBtn: null,
        todayBtn: null,
        routineList: null,
        planList: null,
        doneList: null,
        blockedInput: null,
        tomorrowInput: null,
        reflectionInput: null,
        addRoutineBtn: null,
        addPlanBtn: null,
        // Time Log elements
        timeLogActive: null,
        timeLogActiveLabel: null,
        timeLogActiveElapsed: null,
        timeLogActiveStart: null,
        timeLogStopBtn: null,
        timeLogStartControls: null,
        timeLogTaskInput: null,
        timeLogStartBtn: null,
        timeLogBreakBtn: null,
        timeLogEntries: null,
        // Time Log date nav
        timeLogDateDisplay: null,
        timeLogPrevBtn: null,
        timeLogNextBtn: null,
        timeLogTodayBtn: null
    },

    currentDate: null,
    saveTimeout: null,
    // Time Log state
    activeTimer: null,       // { taskName, startTime, isBreak, dateStr }
    timerIntervalId: null,
    timeLogDate: null,       // Separate date for time log page
    _syncing: false,         // Prevents infinite sync loops with Focus module

    init() {
        this.elements.container = document.getElementById('dailys-section');
        this.elements.dateDisplay = document.getElementById('dailys-date-display');
        this.elements.prevBtn = document.getElementById('dailys-prev');
        this.elements.nextBtn = document.getElementById('dailys-next');
        this.elements.todayBtn = document.getElementById('dailys-today');
        this.elements.routineList = document.getElementById('routine-list');
        this.elements.planList = document.getElementById('plan-list');
        this.elements.doneList = document.getElementById('done-list');
        this.elements.blockedInput = document.getElementById('daily-blocked');
        this.elements.tomorrowInput = document.getElementById('daily-tomorrow');
        this.elements.reflectionInput = document.getElementById('daily-reflection');
        this.elements.addRoutineBtn = document.getElementById('add-routine-btn');
        this.elements.addPlanBtn = document.getElementById('add-plan-btn');

        // Time Log elements
        this.elements.timeLogActive = document.getElementById('time-log-active');
        this.elements.timeLogActiveLabel = document.getElementById('time-log-active-label');
        this.elements.timeLogActiveElapsed = document.getElementById('time-log-active-elapsed');
        this.elements.timeLogActiveStart = document.getElementById('time-log-active-start');
        this.elements.timeLogStopBtn = document.getElementById('time-log-stop-btn');
        this.elements.timeLogStartControls = document.getElementById('time-log-start-controls');
        this.elements.timeLogTaskInput = document.getElementById('time-log-task-input');
        this.elements.timeLogStartBtn = document.getElementById('time-log-start-btn');
        this.elements.timeLogBreakBtn = document.getElementById('time-log-break-btn');
        this.elements.timeLogEntries = document.getElementById('time-log-entries');
        // Time Log date nav
        this.elements.timeLogDateDisplay = document.getElementById('timelog-date-display');
        this.elements.timeLogPrevBtn = document.getElementById('timelog-prev');
        this.elements.timeLogNextBtn = document.getElementById('timelog-next');
        this.elements.timeLogTodayBtn = document.getElementById('timelog-today');

        // Set current date to today
        this.currentDate = new Date();
        this.timeLogDate = new Date();

        // Event listeners
        this.elements.prevBtn?.addEventListener('click', () => this.changeDate(-1));
        this.elements.nextBtn?.addEventListener('click', () => this.changeDate(1));
        this.elements.todayBtn?.addEventListener('click', () => this.goToToday());
        this.elements.addRoutineBtn?.addEventListener('click', () => this.addRoutineItem());
        this.elements.addPlanBtn?.addEventListener('click', () => this.openTaskPickerModal());

        // Time Log event listeners
        this.elements.timeLogStartBtn?.addEventListener('click', () => this.startTask());
        this.elements.timeLogBreakBtn?.addEventListener('click', () => this.startBreak());
        this.elements.timeLogStopBtn?.addEventListener('click', () => this.stopCurrentTimer());
        // Time Log date nav listeners
        this.elements.timeLogPrevBtn?.addEventListener('click', () => this.changeTimeLogDate(-1));
        this.elements.timeLogNextBtn?.addEventListener('click', () => this.changeTimeLogDate(1));
        this.elements.timeLogTodayBtn?.addEventListener('click', () => this.goToTimeLogToday());

        // Allow Enter key on task input to start
        this.elements.timeLogTaskInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const dropdown = document.getElementById('task-picker-dropdown');
                if (dropdown?.classList.contains('open')) {
                    // Select highlighted item or first item
                    const highlighted = dropdown.querySelector('.task-picker-item.highlighted');
                    if (highlighted) {
                        highlighted.click();
                    } else {
                        this.startTask();
                    }
                } else {
                    this.startTask();
                }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateDropdown(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Escape') {
                this.closeTaskDropdown();
            }
        });

        // Show dropdown on input focus/input
        this.elements.timeLogTaskInput?.addEventListener('focus', () => this.showTaskDropdown());
        this.elements.timeLogTaskInput?.addEventListener('input', () => this.showTaskDropdown());

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const wrapper = document.querySelector('.task-picker-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                this.closeTaskDropdown();
            }
        });

        // Quick task form
        document.getElementById('quick-task-save')?.addEventListener('click', () => this.quickCreateAndStart());
        document.getElementById('quick-task-cancel')?.addEventListener('click', () => this.hideQuickTaskForm());
        document.getElementById('quick-task-title')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.quickCreateAndStart();
            if (e.key === 'Escape') this.hideQuickTaskForm();
        });

        // Auto-save on text input change
        const textInputs = [
            this.elements.blockedInput,
            this.elements.tomorrowInput,
            this.elements.reflectionInput
        ];

        textInputs.forEach(input => {
            input?.addEventListener('input', () => this.scheduleAutoSave());
        });

        // Restore active timer from localStorage (page refresh persistence)
        this.restoreActiveTimer();

        // Initial render
        this.render();
    },

    // ============================================
    // Time Log Methods
    // ============================================

    /**
     * Format a timestamp to 12-hour time string: "01:16AM"
     */
    formatTime12h(timestamp) {
        const date = new Date(timestamp);
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}${ampm}`;
    },

    /**
     * Format elapsed milliseconds to "HH:MM:SS"
     */
    formatElapsed(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = n => n.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    },

    /**
     * Format duration in ms to a readable short form: "1h 23m"
     */
    formatDurationShort(ms) {
        if (ms < 0) return `-${this.formatDurationShort(-ms)}`;
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    /**
     * Start a task timer
     */
    startTask(taskName, fromFocus = false) {
        const name = taskName || this.elements.timeLogTaskInput?.value.trim();
        if (!name) {
            App.showToast('Enter a task name first');
            this.elements.timeLogTaskInput?.focus();
            return;
        }

        // Stop any currently running timer first
        if (this.activeTimer) {
            this.stopCurrentTimer(true); // silent stop
        }

        const now = Date.now();
        const dateStr = getDateString(new Date(now));

        this.activeTimer = {
            taskName: name,
            startTime: now,
            isBreak: false,
            dateStr: dateStr
        };

        StorageManager.saveActiveTimer(this.activeTimer);

        if (App.sessionWarningFired) {
            delete App.sessionWarningFired[name];
        }

        // Clear input
        if (this.elements.timeLogTaskInput) {
            this.elements.timeLogTaskInput.value = '';
        }

        this.showActiveTimer();
        this.startTimerInterval();

        // Sync: auto-start Focus stopwatch (unless this call came from Focus)
        if (!fromFocus && !this._syncing && typeof AdvancedStopwatchesModule !== 'undefined') {
            this._syncing = true;
            const sw = AdvancedStopwatchesModule.stopwatches.find(
                s => s.id !== WASTE_TIME_ID && !s.deleted
            );
            if (sw) {
                AdvancedStopwatchesModule.startStopwatch(sw.id, true, true);
            }
            this._syncing = false;
        }

        App.showToast(`Started: ${name}`);
    },

    /**
     * Start a break timer
     */
    startBreak(label) {
        // Stop any currently running timer first
        if (this.activeTimer) {
            this.stopCurrentTimer(true); // silent stop
        }

        const breakLabel = label || 'Break';
        const now = Date.now();
        const dateStr = getDateString(new Date(now));

        this.activeTimer = {
            taskName: breakLabel,
            startTime: now,
            isBreak: true,
            dateStr: dateStr
        };

        StorageManager.saveActiveTimer(this.activeTimer);
        this.showActiveTimer();
        this.startTimerInterval();
        App.showToast('Break started');
    },

    /**
     * Stop the current timer and log the entry
     */
    stopCurrentTimer(silent = false, fromFocus = false) {
        if (!this.activeTimer) return;

        const endTime = Date.now();
        const startDate = getDateString(new Date(this.activeTimer.startTime));
        const endDate = getDateString(new Date(endTime));

        const wasBreak = this.activeTimer.isBreak;

        // Handle cross-day entries: split at midnight
        if (startDate !== endDate) {
            const midnight = new Date(endTime);
            midnight.setHours(0, 0, 0, 0);

            StorageManager.addTimeLogEntry(startDate, {
                id: generateId(),
                taskName: this.activeTimer.taskName,
                startTime: this.activeTimer.startTime,
                endTime: midnight.getTime(),
                isBreak: wasBreak
            });
            StorageManager.addTimeLogEntry(endDate, {
                id: generateId(),
                taskName: this.activeTimer.taskName,
                startTime: midnight.getTime(),
                endTime: endTime,
                isBreak: wasBreak
            });
        } else {
            StorageManager.addTimeLogEntry(startDate, {
                id: generateId(),
                taskName: this.activeTimer.taskName,
                startTime: this.activeTimer.startTime,
                endTime: endTime,
                isBreak: wasBreak
            });
        }

        // Sync: stop Focus stopwatch (unless this call came from Focus)
        if (!wasBreak && !fromFocus && !this._syncing && typeof AdvancedStopwatchesModule !== 'undefined') {
            this._syncing = true;
            const runningSw = AdvancedStopwatchesModule.stopwatches.find(
                s => s.isRunning && s.id !== WASTE_TIME_ID && !s.deleted
            );
            if (runningSw) {
                AdvancedStopwatchesModule.stopStopwatch(runningSw.id, true, true);
            }
            this._syncing = false;
        }

        // Clear active timer
        this.activeTimer = null;
        StorageManager.clearActiveTimer();
        this.stopTimerInterval();
        this.hideActiveTimer();

        // Re-render log entries
        this.renderTimeLog();

        // Waste time keeps running -- only stops when a new task starts.
        // Trigger immediate check so waste time auto-starts if nothing productive is running.
        if (typeof AdvancedStopwatchesModule !== 'undefined') {
            AdvancedStopwatchesModule.checkWasteTimeAutoStart();
        }

        if (!silent) {
            App.showToast(wasBreak ? 'Break ended' : 'Task stopped');
            if (!wasBreak) {
                // Auto-start break when finishing a productive task
                setTimeout(() => this.startBreak(), 0);
            }
        }
    },

    /**
     * Restore active timer from localStorage on page load
     */
    restoreActiveTimer() {
        const saved = StorageManager.getActiveTimer();
        if (saved && saved.startTime) {
            this.activeTimer = saved;
            this.showActiveTimer();
            this.startTimerInterval();
        }
    },

    /**
     * Show the active timer UI
     */
    showActiveTimer() {
        if (!this.elements.timeLogActive || !this.activeTimer) return;

        this.elements.timeLogActive.style.display = 'block';
        this.elements.timeLogStartControls.style.display = 'none';

        this.elements.timeLogActiveLabel.textContent = this.activeTimer.isBreak
            ? `[Break] ${this.activeTimer.taskName}`
            : this.activeTimer.taskName;

        this.elements.timeLogActiveStart.textContent = this.formatTime12h(this.activeTimer.startTime);

        // Set break class
        this.elements.timeLogActive.classList.toggle('is-break', this.activeTimer.isBreak);

        // Update elapsed immediately
        this.updateElapsed();
    },

    /**
     * Hide the active timer UI
     */
    hideActiveTimer() {
        if (this.elements.timeLogActive) {
            this.elements.timeLogActive.style.display = 'none';
            this.elements.timeLogActive.classList.remove('is-break');
        }
        if (this.elements.timeLogStartControls) {
            this.elements.timeLogStartControls.style.display = 'flex';
        }
    },

    /**
     * Start the 1-second interval for live elapsed display
     */
    startTimerInterval() {
        this.stopTimerInterval();
        this.timerIntervalId = setInterval(() => this.updateElapsed(), 1000);
    },

    /**
     * Stop the elapsed interval
     */
    stopTimerInterval() {
        if (this.timerIntervalId) {
            clearInterval(this.timerIntervalId);
            this.timerIntervalId = null;
        }
    },

    /**
     * Update the elapsed time display
     */
    updateElapsed() {
        if (!this.activeTimer || !this.elements.timeLogActiveElapsed) return;
        const elapsed = Date.now() - this.activeTimer.startTime;
        this.elements.timeLogActiveElapsed.textContent = this.formatElapsed(elapsed);

        if (!this.activeTimer.isBreak && App.maxSessionMs && elapsed >= App.maxSessionMs) {
            App.fireSessionWarning(this.activeTimer.taskName);
            if (this.elements.timeLogActive) {
                this.elements.timeLogActive.classList.add('session-exceeded');
            }
        } else if (this.elements.timeLogActive) {
            this.elements.timeLogActive.classList.remove('session-exceeded');
        }
    },

    /**
     * Render the time log entries list
     */
    renderTimeLog() {
        if (!this.elements.timeLogEntries) return;

        const dateStr = getDateString(this.timeLogDate);
        const entries = StorageManager.getTimeLog(dateStr);

        if (entries.length === 0) {
            this.elements.timeLogEntries.innerHTML = `
                <div class="time-log-empty">
                    <p>No time entries yet. Start a task to begin logging!</p>
                </div>
            `;
            this.renderLogOverview(entries);
            return;
        }

        const allTasks = StorageManager.getTasks();
        const allStopwatches = StorageManager.getStopwatches();

        this.elements.timeLogEntries.innerHTML = [...entries].reverse().map(entry => {
            const startStr = this.formatTime12h(entry.startTime);
            const endStr = this.formatTime12h(entry.endTime);
            const duration = entry.endTime - entry.startTime;
            const durationShort = this.formatDurationShort(duration);
            const displayName = this.escapeHtml(entry.taskName);

            let nodeColor = '';
            let taskPriority = '';
            if (!entry.isBreak) {
                const task = allTasks.find(t => t.title === entry.taskName);
                if (task) {
                    taskPriority = task.priority || '';
                    if (task.assignedStopwatch) {
                        const sw = allStopwatches.find(s => s.id === task.assignedStopwatch);
                        if (sw) nodeColor = sw.color;
                    }
                }
            }

            const nodeStyle = nodeColor ? `border-color: ${nodeColor}` : '';
            const durStyle = nodeColor && !entry.isBreak
                ? `background: ${nodeColor}20; color: ${nodeColor}`
                : '';

            const priorityHtml = taskPriority && !entry.isBreak
                ? `<span class="tl-entry-priority tl-entry-priority--${taskPriority}"></span>`
                : '';

            return `
                <div class="time-log-entry ${entry.isBreak ? 'is-break' : ''}" data-entry-id="${entry.id}">
                    <div class="tl-entry-node ${entry.isBreak ? 'break' : 'task'}" style="${nodeStyle}"></div>
                    <div class="tl-entry-content" ${nodeColor ? `style="border-left: 2px solid ${nodeColor}"` : ''}>
                        <span class="tl-entry-time">${startStr} — ${endStr}</span>
                        <span class="tl-entry-sep">|</span>
                        ${priorityHtml}
                        <span class="tl-entry-name">${entry.isBreak ? 'Break' : displayName}</span>
                        <span class="tl-entry-dur" ${durStyle ? `style="${durStyle}"` : ''}>${durationShort}</span>
                    </div>
                    <button class="time-log-entry-delete" data-delete-entry="${entry.id}" title="Delete entry">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Add delete listeners
        this.elements.timeLogEntries.querySelectorAll('[data-delete-entry]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteTimeLogEntry(btn.dataset.deleteEntry);
            });
        });

        // Render overview stats
        this.renderLogOverview(entries);
    },

    /**
     * Render analytics overview panel
     */
    renderLogOverview(entries) {
        const dateStr = getDateString(this.timeLogDate);
        const isToday = dateStr === getDateString(new Date());

        let totalMs = 0;
        let studyMs = 0;
        let wasteMs = 0;
        let breakMs = 0;

        entries.forEach(e => {
            const dur = e.endTime - e.startTime;
            totalMs += dur;
            if (e.isBreak) {
                breakMs += dur;
            } else {
                studyMs += dur;
            }
        });

        // Get waste time
        if (isToday && typeof AdvancedStopwatchesModule !== 'undefined') {
            const wasteSw = AdvancedStopwatchesModule.stopwatches.find(sw => sw.id === WASTE_TIME_ID);
            if (wasteSw) {
                wasteMs = TimeTracker.getElapsedMs(wasteSw);
            }
        } else {
            const history = StorageManager.getHistory();
            const wasteRecord = history.find(h => h.stopwatchId === WASTE_TIME_ID && h.date === dateStr);
            if (wasteRecord) wasteMs = wasteRecord.totalMs || 0;
        }
        wasteMs = Math.min(wasteMs, 24 * 60 * 60 * 1000);

        // Tasks completed today
        const tasks = StorageManager.getTasks();
        const todayStart = new Date(this.timeLogDate);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(this.timeLogDate);
        todayEnd.setHours(23, 59, 59, 999);
        const tasksDone = tasks.filter(t =>
            t.status === 'done' && t.completedAt &&
            t.completedAt >= todayStart.getTime() && t.completedAt <= todayEnd.getTime()
        ).length;

        // Remaining time in day (only for today)
        let remainingStr = '—';
        if (isToday) {
            const now = new Date();
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            const remainMs = endOfDay.getTime() - now.getTime();
            remainingStr = this.formatDurationReadable(remainMs);
        }

        // Update DOM
        const el = (id) => document.getElementById(id);
        if (el('stat-elapsed')) el('stat-elapsed').textContent = this.formatDurationReadable(totalMs);
        if (el('stat-study')) el('stat-study').textContent = this.formatDurationReadable(studyMs);
        if (el('stat-waste')) el('stat-waste').textContent = this.formatDurationReadable(wasteMs);
        if (el('stat-tasks-done')) el('stat-tasks-done').textContent = tasksDone;
        if (el('stat-remaining')) el('stat-remaining').textContent = remainingStr;
        if (el('stat-sessions')) el('stat-sessions').textContent = entries.length;
    },

    /**
     * Format duration as readable "Xh Ym"
     */
    formatDurationReadable(ms) {
        if (ms < 0) ms = 0;
        const totalMins = Math.floor(ms / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        if (h === 0) return `${m}m`;
        return `${h}h ${m}m`;
    },

    /**
     * Delete a time log entry
     */
    deleteTimeLogEntry(entryId) {
        const dateStr = getDateString(this.timeLogDate);
        const entry = StorageManager.getDailyEntry(dateStr);
        if (!entry || !entry.timeLog) return;

        entry.timeLog = entry.timeLog.filter(e => e.id !== entryId);
        StorageManager.saveDailyEntry(dateStr, entry);
        this.renderTimeLog();
        App.showToast('Entry deleted');
    },

    // ============================================
    // Date Navigation
    // ============================================

    changeDate(delta) {
        this.currentDate.setDate(this.currentDate.getDate() + delta);
        this.render();
    },

    goToToday() {
        this.currentDate = new Date();
        this.render();
    },

    changeTimeLogDate(delta) {
        this.timeLogDate.setDate(this.timeLogDate.getDate() + delta);
        this.renderTimeLogPage();
    },

    goToTimeLogToday() {
        this.timeLogDate = new Date();
        this.renderTimeLogPage();
    },

    /**
     * Render the Time Log page (standalone)
     */
    renderTimeLogPage() {
        const dateStr = getDateString(this.timeLogDate);
        const isToday = dateStr === getDateString(new Date());

        // Update date display
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (this.elements.timeLogDateDisplay) {
            this.elements.timeLogDateDisplay.textContent = this.timeLogDate.toLocaleDateString('en-US', options);
        }
        if (this.elements.timeLogTodayBtn) {
            this.elements.timeLogTodayBtn.style.display = isToday ? 'none' : 'inline-flex';
        }
        if (this.elements.timeLogNextBtn) {
            this.elements.timeLogNextBtn.disabled = isToday;
        }

        // Show/hide controls only on today
        if (this.elements.timeLogActive) {
            if (!isToday) {
                this.elements.timeLogActive.style.display = 'none';
                if (this.elements.timeLogStartControls) {
                    this.elements.timeLogStartControls.style.display = 'none';
                }
            } else if (this.activeTimer) {
                this.showActiveTimer();
            } else {
                this.hideActiveTimer();
            }
        }

        // Populate task autocomplete from Tasks DB
        this.populateTaskSuggestions();

        this.renderTimeLog();
    },

    /**
     * Populate the task suggestions datalist from the Tasks database
     */
    populateTaskSuggestions() {
        // Handled by showTaskDropdown now
    },

    /**
     * Show the task picker dropdown with tasks from the Tasks database
     */
    showTaskDropdown() {
        const dropdown = document.getElementById('task-picker-dropdown');
        if (!dropdown) return;

        const query = (this.elements.timeLogTaskInput?.value || '').toLowerCase().trim();
        const tasks = StorageManager.getTasks().filter(t => t.status !== 'done');

        // Filter tasks by search query
        const filtered = query
            ? tasks.filter(t => t.title.toLowerCase().includes(query))
            : tasks;

        const priorityColors = { low: 'var(--color-success)', medium: 'var(--color-warning)', high: 'var(--color-danger)' };

        let html = '';

        // Show matching tasks
        filtered.forEach(task => {
            const tags = (task.tags || []).map(t =>
                `<span class="task-tag">${this.escapeHtml(t)}</span>`
            ).join('');

            html += `
                <div class="task-picker-item" data-task-title="${this.escapeHtml(task.title)}">
                    ${task.priority ? `<span class="priority-dot" style="background: ${priorityColors[task.priority]}"></span>` : ''}
                    <span class="task-title">${this.escapeHtml(task.title)}</span>
                    ${tags ? `<span class="task-tags">${tags}</span>` : ''}
                </div>
            `;
        });

        // "+ New Task" option
        html += `
            <div class="task-picker-item task-picker-new" data-action="new-task">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Task</span>
            </div>
        `;

        // If there's typed text that doesn't match any task, show "Use as free text"
        if (query && !tasks.some(t => t.title.toLowerCase() === query)) {
            html += `
                <div class="task-picker-item task-picker-freetext" data-task-title="${this.escapeHtml(this.elements.timeLogTaskInput.value.trim())}">
                    Start "${this.escapeHtml(this.elements.timeLogTaskInput.value.trim())}" as free text
                </div>
            `;
        }

        dropdown.innerHTML = html;
        dropdown.classList.add('open');

        // Add click listeners
        dropdown.querySelectorAll('.task-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.action === 'new-task') {
                    this.showQuickTaskForm();
                    this.closeTaskDropdown();
                } else if (item.dataset.taskTitle) {
                    this.elements.timeLogTaskInput.value = item.dataset.taskTitle;
                    this.closeTaskDropdown();
                    this.startTask();
                }
            });
        });
    },

    /**
     * Close the task picker dropdown
     */
    closeTaskDropdown() {
        const dropdown = document.getElementById('task-picker-dropdown');
        if (dropdown) dropdown.classList.remove('open');
    },

    /**
     * Navigate dropdown items with arrow keys
     */
    navigateDropdown(direction) {
        const dropdown = document.getElementById('task-picker-dropdown');
        if (!dropdown || !dropdown.classList.contains('open')) {
            this.showTaskDropdown();
            return;
        }

        const items = [...dropdown.querySelectorAll('.task-picker-item')];
        if (items.length === 0) return;

        const current = items.findIndex(i => i.classList.contains('highlighted'));
        items.forEach(i => i.classList.remove('highlighted'));

        let next = current + direction;
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;

        items[next].classList.add('highlighted');
        items[next].scrollIntoView({ block: 'nearest' });
    },

    /**
     * Show the quick task creation form
     */
    showQuickTaskForm() {
        const form = document.getElementById('quick-task-form');
        if (form) {
            form.style.display = 'flex';
            const titleInput = document.getElementById('quick-task-title');
            if (titleInput && this.elements.timeLogTaskInput) {
                titleInput.value = this.elements.timeLogTaskInput.value.trim();
                this.elements.timeLogTaskInput.value = '';
            }
            if (typeof TasksModule !== 'undefined') {
                TasksModule.populateStopwatchSelect('quick-task-stopwatch');
            }
            titleInput?.focus();
        }
    },

    /**
     * Hide the quick task creation form
     */
    hideQuickTaskForm() {
        const form = document.getElementById('quick-task-form');
        if (form) form.style.display = 'none';
    },

    /**
     * Create a new task and immediately start it
     */
    quickCreateAndStart() {
        const titleInput = document.getElementById('quick-task-title');
        const prioritySelect = document.getElementById('quick-task-priority');
        const swSelect = document.getElementById('quick-task-stopwatch');

        const title = titleInput?.value.trim();
        if (!title) {
            App.showToast('Enter a task title');
            titleInput?.focus();
            return;
        }

        if (!swSelect?.value) {
            App.showToast('Please assign a focus stopwatch');
            swSelect?.focus();
            return;
        }

        const taskData = {
            title,
            description: '',
            priority: prioritySelect?.value || '',
            status: 'in-progress',
            tags: [],
            subtasks: [],
            assignedStopwatch: swSelect.value
        };
        StorageManager.addTask(taskData);

        // Re-render Tasks tab if it exists
        if (typeof TasksModule !== 'undefined') {
            TasksModule.tasks = StorageManager.getTasks();
            TasksModule.render();
        }

        // Hide form and start the task timer
        this.hideQuickTaskForm();
        this.startTask(title);
        App.showToast(`Task created: ${title}`);
    },

    // ============================================
    // Main Render
    // ============================================

    render() {
        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        // Update date display
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (this.elements.dateDisplay) {
            this.elements.dateDisplay.textContent = this.currentDate.toLocaleDateString('en-US', options);
        }

        // Check if viewing today
        const isToday = dateStr === getDateString(new Date());
        if (this.elements.todayBtn) {
            this.elements.todayBtn.style.display = isToday ? 'none' : 'inline-flex';
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.disabled = isToday;
        }

        // Render time log page
        this.renderTimeLogPage();

        // Render lists
        this.renderRoutineList(entry.routine || []);
        this.renderPlanList(entry.plannedTaskIds || []);
        this.renderDoneList(entry.completedTaskIds || []);

        // Populate text fields
        if (this.elements.blockedInput) this.elements.blockedInput.value = entry.blocked || '';
        if (this.elements.tomorrowInput) this.elements.tomorrowInput.value = entry.tomorrow || '';
        if (this.elements.reflectionInput) this.elements.reflectionInput.value = entry.reflection || '';
    },

    // ============================================
    // Routine Methods
    // ============================================

    renderRoutineList(routine) {
        if (!this.elements.routineList) return;

        if (routine.length === 0) {
            this.elements.routineList.innerHTML = `
                <div class="routine-empty">
                    <p>No routine items yet. Add your daily habits!</p>
                </div>
            `;
            return;
        }

        this.elements.routineList.innerHTML = routine.map((item, index) => `
            <div class="routine-item" data-index="${index}">
                <label class="routine-checkbox">
                    <input type="checkbox" ${item.completed ? 'checked' : ''} data-routine-toggle="${index}">
                    <span class="routine-text ${item.completed ? 'completed' : ''}">${this.escapeHtml(item.text)}</span>
                </label>
                <button class="btn btn-icon btn-ghost routine-delete" data-routine-delete="${index}" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `).join('');

        this.addRoutineListeners();
    },

    // ============================================
    // Plan / Done Methods
    // ============================================

    renderPlanList(taskIds) {
        if (!this.elements.planList) return;

        const allTasks = StorageManager.getTasks();
        const tasks = taskIds.map(id => allTasks.find(t => t.id === id)).filter(t => t && t.status !== 'done');

        if (tasks.length === 0) {
            this.elements.planList.innerHTML = `
                <div class="routine-empty">
                    <p>No tasks planned. Add tasks from your Task Database!</p>
                </div>
            `;
            return;
        }

        this.elements.planList.innerHTML = tasks.map((task, index) => this.renderTaskItem(task, index, 'plan')).join('');
        this.addPlanListeners();
    },

    renderDoneList(taskIds) {
        if (!this.elements.doneList) return;

        const allTasks = StorageManager.getTasks();
        const tasks = taskIds.map(id => allTasks.find(t => t.id === id)).filter(t => t);

        if (tasks.length === 0) {
            this.elements.doneList.innerHTML = `
                <div class="routine-empty">
                    <p>Complete tasks from your plan to see them here!</p>
                </div>
            `;
            return;
        }

        this.elements.doneList.innerHTML = tasks.map((task, index) => this.renderTaskItem(task, index, 'done')).join('');
    },

    renderTaskItem(task, index, listType) {
        const priorityColors = { low: 'var(--color-success)', medium: 'var(--color-warning)', high: 'var(--color-danger)' };
        const priorityLabels = { low: 'L', medium: 'M', high: 'H' };
        const isCompleted = listType === 'done';

        let stopwatchBadge = '';
        if (task.assignedStopwatch) {
            const stopwatches = StorageManager.getStopwatches();
            const sw = stopwatches.find(s => s.id === task.assignedStopwatch);
            if (sw) {
                stopwatchBadge = `
                    <span class="checklist-stopwatch" style="border-color: ${sw.color}">
                        <span class="stopwatch-dot" style="background: ${sw.color}"></span>
                        ${this.escapeHtml(sw.name)}
                    </span>
                `;
            }
        }

        const tagsBadges = (task.tags || []).map(tag =>
            `<span class="checklist-tag">${this.escapeHtml(tag)}</span>`
        ).join('');

        let subtasksProgress = '';
        if (task.subtasks && task.subtasks.length > 0) {
            const completed = task.subtasks.filter(s => s.completed).length;
            subtasksProgress = `<span class="checklist-subtasks">${completed}/${task.subtasks.length}</span>`;
        }

        return `
            <div class="checklist-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="checklist-main">
                    <label class="checklist-checkbox">
                        <input type="checkbox" ${isCompleted ? 'checked disabled' : ''} data-${listType}-complete="${task.id}">
                        <span class="checklist-text ${isCompleted ? 'completed' : ''}">${this.escapeHtml(task.title)}</span>
                    </label>
                    ${task.priority ? `
                        <span class="checklist-priority" style="background: ${priorityColors[task.priority]}">${priorityLabels[task.priority]}</span>
                    ` : ''}
                    ${subtasksProgress}
                </div>
                <div class="checklist-meta">
                    ${stopwatchBadge}
                    ${tagsBadges}
                    ${listType === 'plan' ? `
                        <button class="btn btn-icon btn-ghost checklist-delete" data-plan-remove="${task.id}" title="Remove from plan">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // ============================================
    // Event Listeners
    // ============================================

    addRoutineListeners() {
        this.elements.routineList?.querySelectorAll('[data-routine-toggle]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.routineToggle);
                this.toggleRoutineItem(index);
            });
        });

        this.elements.routineList?.querySelectorAll('[data-routine-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.routineDelete);
                this.deleteRoutineItem(index);
            });
        });
    },

    addPlanListeners() {
        this.elements.planList?.querySelectorAll('[data-plan-complete]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const taskId = checkbox.dataset.planComplete;
                this.completeTask(taskId);
            });
        });

        this.elements.planList?.querySelectorAll('[data-plan-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.planRemove;
                this.removeFromPlan(taskId);
            });
        });
    },

    // ============================================
    // Task Completion
    // ============================================

    completeTask(taskId) {
        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        entry.plannedTaskIds = (entry.plannedTaskIds || []).filter(id => id !== taskId);
        entry.completedTaskIds = entry.completedTaskIds || [];
        if (!entry.completedTaskIds.includes(taskId)) {
            entry.completedTaskIds.push(taskId);
        }

        StorageManager.saveDailyEntry(dateStr, entry);
        StorageManager.updateTask(taskId, { status: 'done' });

        // Auto-stop active timer if the completed task was running
        const task = StorageManager.getTasks().find(t => t.id === taskId);
        if (task && this.activeTimer && this.activeTimer.taskName === task.title) {
            this.stopCurrentTimer(); // This will auto-start a break
        }

        this.render();

        if (typeof TasksModule !== 'undefined') {
            TasksModule.render();
        }

        App.showToast('Task completed!');
    },

    removeFromPlan(taskId) {
        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr);
        if (!entry) return;

        entry.plannedTaskIds = (entry.plannedTaskIds || []).filter(id => id !== taskId);
        StorageManager.saveDailyEntry(dateStr, entry);
        this.render();
    },

    addRoutineItem() {
        const text = prompt('Enter routine item:');
        if (!text || !text.trim()) return;

        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        entry.routine = entry.routine || [];
        entry.routine.push({ text: text.trim(), completed: false });

        StorageManager.saveDailyEntry(dateStr, entry);
        this.render();
        App.showToast('Routine item added');
    },

    // ============================================
    // Task Picker Modal
    // ============================================

    openTaskPickerModal() {
        let modal = document.getElementById('task-picker-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'task-picker-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Add Tasks to Plan</h3>
                        <button class="modal-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-hint">Select tasks from your Task Database to add to today's plan:</p>
                        <div id="task-picker-list" class="task-picker-list"></div>
                        <div class="modal-create-new">
                            <p>Need a new task? <button id="create-task-from-daily" class="btn btn-sm btn-ghost">Create in Tasks</button></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" data-close-modal>Cancel</button>
                        <button id="add-selected-tasks-btn" class="btn btn-primary">Add Selected</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeTaskPickerModal());
            modal.querySelectorAll('[data-close-modal]').forEach(btn => {
                btn.addEventListener('click', () => this.closeTaskPickerModal());
            });
            modal.querySelector('#add-selected-tasks-btn').addEventListener('click', () => this.addSelectedTasks());
            modal.querySelector('#create-task-from-daily').addEventListener('click', () => {
                this.closeTaskPickerModal();
                App.navigateTo('tasks');
                setTimeout(() => TasksModule.openModal(), 100);
            });
        }

        this.populateTaskPicker();
        modal.classList.add('open');
    },

    populateTaskPicker() {
        const list = document.getElementById('task-picker-list');
        if (!list) return;

        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();
        const alreadyPlanned = entry.plannedTaskIds || [];
        const alreadyDone = entry.completedTaskIds || [];

        const tasks = StorageManager.getTasks().filter(t =>
            t.status !== 'done' &&
            !alreadyPlanned.includes(t.id) &&
            !alreadyDone.includes(t.id)
        );

        if (tasks.length === 0) {
            list.innerHTML = `<p class="task-picker-empty">No available tasks. Create some in the Tasks tab!</p>`;
            return;
        }

        const priorityColors = { low: 'var(--color-success)', medium: 'var(--color-warning)', high: 'var(--color-danger)' };

        list.innerHTML = tasks.map(task => `
            <label class="task-picker-item">
                <input type="checkbox" value="${task.id}">
                <span class="task-picker-title">${this.escapeHtml(task.title)}</span>
                ${task.priority ? `<span class="task-picker-priority" style="background: ${priorityColors[task.priority]}">${task.priority[0].toUpperCase()}</span>` : ''}
                ${task.tags.length ? `<span class="task-picker-tags">${task.tags.join(', ')}</span>` : ''}
            </label>
        `).join('');
    },

    closeTaskPickerModal() {
        const modal = document.getElementById('task-picker-modal');
        if (modal) modal.classList.remove('open');
    },

    addSelectedTasks() {
        const list = document.getElementById('task-picker-list');
        const selected = Array.from(list.querySelectorAll('input:checked')).map(cb => cb.value);

        if (selected.length === 0) {
            App.showToast('Select at least one task');
            return;
        }

        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        entry.plannedTaskIds = entry.plannedTaskIds || [];
        selected.forEach(id => {
            if (!entry.plannedTaskIds.includes(id)) {
                entry.plannedTaskIds.push(id);
                StorageManager.updateTask(id, { status: 'in-progress' });
            }
        });

        StorageManager.saveDailyEntry(dateStr, entry);
        this.closeTaskPickerModal();
        this.render();

        if (typeof TasksModule !== 'undefined') {
            TasksModule.render();
        }

        App.showToast(`Added ${selected.length} task(s) to plan`);
    },

    // ============================================
    // Routine Toggle/Delete
    // ============================================

    toggleRoutineItem(index) {
        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr);
        if (!entry || !entry.routine[index]) return;

        entry.routine[index].completed = !entry.routine[index].completed;
        StorageManager.saveDailyEntry(dateStr, entry);
        this.render();
    },

    deleteRoutineItem(index) {
        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr);
        if (!entry || !entry.routine[index]) return;

        entry.routine.splice(index, 1);
        StorageManager.saveDailyEntry(dateStr, entry);
        this.render();
    },

    // ============================================
    // Auto-save
    // ============================================

    scheduleAutoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => this.saveCurrentEntry(), 500);
    },

    saveCurrentEntry() {
        const dateStr = getDateString(this.currentDate);
        const existing = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        const entry = {
            ...existing,
            blocked: this.elements.blockedInput?.value || '',
            tomorrow: this.elements.tomorrowInput?.value || '',
            reflection: this.elements.reflectionInput?.value || ''
        };

        StorageManager.saveDailyEntry(dateStr, entry);
    },

    getEmptyEntry() {
        return {
            routine: [],
            plannedTaskIds: [],
            completedTaskIds: [],
            blocked: '',
            tomorrow: '',
            reflection: '',
            timeLog: []
        };
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.DailysModule = DailysModule;
