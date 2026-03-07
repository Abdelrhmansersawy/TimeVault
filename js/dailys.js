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
        this.elements.customSectionsContainer = document.getElementById('custom-daily-sections');
        this.elements.addCustomSectionBtn = document.getElementById('add-custom-section-btn');
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

        // Setup custom section schemas if empty
        this.initializeCustomSectionsSchema();

        this.elements.addCustomSectionBtn?.addEventListener('click', () => this.addCustomSectionPrompt());

        // Restore active timer from localStorage (page refresh persistence)
        this.restoreActiveTimer();

        // Initial render
        this.render();
    },

    initializeCustomSectionsSchema() {
        const settings = StorageManager.getSettings();
        if (!settings.dailyCustomSections) {
            // Default migration built-for retrocompatibility
            settings.dailyCustomSections = [
                { id: 'reflection', title: 'Reflection', color: 'var(--color-accent-light)', hint: 'How did today go? What did you learn?' },
                { id: 'blockers', title: 'Blockers', color: 'var(--color-danger)', hint: 'What is blocking your progress?' },
                { id: 'tomorrow', title: 'Tomorrow', color: 'var(--color-success)', hint: 'What needs to happen tomorrow?' }
            ];
            StorageManager.saveSettings(settings);
        }
    },

    addCustomSectionPrompt() {
        const title = prompt("Enter a title for the new section:");
        if (!title) return;
        const color = prompt("Enter an accent color CSS var (optional, default: var(--color-accent)):") || 'var(--color-accent)';
        const hint = prompt("Enter placeholder text for this section:");

        const settings = StorageManager.getSettings();
        const newId = 'custom_' + Date.now();
        settings.dailyCustomSections.push({
            id: newId,
            title: title.trim(),
            color: color.trim(),
            hint: hint ? hint.trim() : ''
        });
        StorageManager.saveSettings(settings);
        this.renderContent(); // Refresh the sections UI
    },

    deleteCustomSection(sectionId) {
        if (!confirm("Are you sure you want to delete this custom section?")) return;
        const settings = StorageManager.getSettings();
        settings.dailyCustomSections = settings.dailyCustomSections.filter(s => s.id !== sectionId);
        StorageManager.saveSettings(settings);
        this.renderContent();
    },

    getCustomSectionsSchema() {
        return StorageManager.getSettings().dailyCustomSections || [];
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

            if (this.activeTimer.taskName === "Untracked Time" || this.activeTimer.taskName === "Auto Break (Idle)") {
                StorageManager.addHistoryRecord({ stopwatchId: 'untracked', date: startDate, totalMs: midnight.getTime() - this.activeTimer.startTime });
                StorageManager.addHistoryRecord({ stopwatchId: 'untracked', date: endDate, totalMs: endTime - midnight.getTime() });
            }
        } else {
            StorageManager.addTimeLogEntry(startDate, {
                id: generateId(),
                taskName: this.activeTimer.taskName,
                startTime: this.activeTimer.startTime,
                endTime: endTime,
                isBreak: wasBreak
            });

            if (this.activeTimer.taskName === "Untracked Time" || this.activeTimer.taskName === "Auto Break (Idle)") {
                StorageManager.addHistoryRecord({ stopwatchId: 'untracked', date: startDate, totalMs: endTime - this.activeTimer.startTime });
            }
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

        let isUntracked = false;
        let labelText = this.activeTimer.taskName;
        if (this.activeTimer.isBreak) {
            if (this.activeTimer.taskName === "Untracked Time" || this.activeTimer.taskName === "Auto Break (Idle)") {
                labelText = `[Untracked] Untracked Time`;
                isUntracked = true;
            } else {
                labelText = `[Break] ${this.activeTimer.taskName}`;
            }
        }
        this.elements.timeLogActiveLabel.textContent = labelText;

        this.elements.timeLogActiveStart.textContent = this.formatTime12h(this.activeTimer.startTime);

        // Set break class
        this.elements.timeLogActive.classList.toggle('is-break', this.activeTimer.isBreak && !isUntracked);
        this.elements.timeLogActive.classList.toggle('is-untracked', isUntracked);

        // Update elapsed immediately
        this.updateElapsed();
    },

    /**
     * Hide the active timer UI
     */
    hideActiveTimer() {
        if (this.elements.timeLogActive) {
            this.elements.timeLogActive.style.display = 'none';
            this.elements.timeLogActive.classList.remove('is-break', 'is-untracked');
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
        if (!this.activeTimer) return;
        const elapsed = Date.now() - this.activeTimer.startTime;
        if (this.elements.timeLogActiveElapsed) {
            this.elements.timeLogActiveElapsed.textContent = this.formatElapsed(elapsed);
        }

        if (!this.activeTimer.isBreak && App.maxSessionMs && elapsed >= App.maxSessionMs) {
            App.fireSessionWarning(this.activeTimer.taskName);
            // Auto stop session if configured (for user request)
            this.stopCurrentTimer();
            if (this.elements.timeLogActive) {
                this.elements.timeLogActive.classList.remove('session-exceeded');
            }
            return;
        } else if (this.elements.timeLogActive) {
            this.elements.timeLogActive.classList.remove('session-exceeded');
        }

        // Live update stats from real-time timer
        if (this.currentEntries) {
            this.renderLogOverview(this.currentEntries);
            this.renderDailyTimeline(this.currentEntries);
        }
    },

    /**
     * Render the time log entries list
     */
    renderTimeLog() {
        if (!this.elements.timeLogEntries) return;

        const dateStr = getDateString(this.timeLogDate);
        const entries = StorageManager.getTimeLog(dateStr);
        this.currentEntries = entries; // Save for live updates

        if (entries.length === 0) {
            this.elements.timeLogEntries.innerHTML = `
                <div class="time-log-empty">
                    <p>No time entries yet. Start a task to begin logging!</p>
                </div>
            `;
            this.renderLogOverview(entries);
            this.renderDailyTimeline(entries);
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

            let entryName = displayName;
            let isUntracked = false;
            if (entry.isBreak) {
                if (entry.taskName === "Untracked Time" || entry.taskName === "Auto Break (Idle)") {
                    entryName = "Untracked Time";
                    isUntracked = true;
                } else {
                    entryName = "Break";
                }
            }

            let entryClass = entry.isBreak ? 'break' : 'task';
            if (isUntracked) entryClass = 'untracked';

            return `
                <div class="time-log-entry ${entry.isBreak ? 'is-break' : ''} ${isUntracked ? 'is-untracked' : ''}" data-entry-id="${entry.id}">
                    <div class="tl-entry-node ${entryClass}" style="${nodeStyle}"></div>
                    <div class="tl-entry-content" ${nodeColor ? `style="border-left: 2px solid ${nodeColor}"` : ''}>
                        <span class="tl-entry-time">${startStr} — ${endStr}</span>
                        <span class="tl-entry-sep">|</span>
                        ${priorityHtml}
                        <span class="tl-entry-name">${entryName}</span>
                        <span class="tl-entry-dur" ${durStyle ? `style="${durStyle}"` : ''}>${durationShort}</span>
                    </div>
                    <div class="time-log-entry-actions">
                        <button class="time-log-entry-edit" data-edit-entry="${entry.id}" title="Edit end time">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="time-log-entry-delete" data-delete-entry="${entry.id}" title="Delete entry">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add action listeners
        this.elements.timeLogEntries.querySelectorAll('[data-delete-entry]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteTimeLogEntry(btn.dataset.deleteEntry);
            });
        });
        this.elements.timeLogEntries.querySelectorAll('[data-edit-entry]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openEditTimeLogModal(btn.dataset.editEntry);
            });
        });

        // Render overview stats
        this.renderLogOverview(entries);
        this.renderDailyTimeline(entries);
    },

    /**
     * Render the daily timeline layout (Gantt chart-style)
     */
    renderDailyTimeline(entries) {
        const container = document.querySelector('#daily-timeline-container .timeline-track');
        if (!container) return;

        const dateStr = getDateString(this.timeLogDate);
        const isToday = dateStr === getDateString(new Date());

        const dayStartHour = (typeof App !== 'undefined' && App.dayStartHour) ? App.dayStartHour : 0;
        const startOfDay = new Date(this.timeLogDate);
        startOfDay.setHours(dayStartHour, 0, 0, 0);

        // If the currently viewed date object is technically "today" but it's before the dayStartHour,
        // it means we are still in the previous logical day.
        // E.g., it is 2 AM Tuesday, and day starts at 5 AM. `this.timeLogDate` is likely set to Monday.

        const startOfDayMs = startOfDay.getTime();
        const endOfDayMs = startOfDayMs + (24 * 60 * 60 * 1000);
        const totalDayMs = 24 * 60 * 60 * 1000;

        let html = '';

        // Safely fetch system tasks and info
        const allTasks = StorageManager.getTasks() || [];
        const allStopwatches = StorageManager.getStopwatches() || [];

        const allBlocks = [...entries];

        // Append active timer if it belongs to currently viewed day
        if (this.activeTimer && isToday) {
            allBlocks.push({
                taskName: this.activeTimer.taskName,
                startTime: this.activeTimer.startTime,
                endTime: Date.now(),
                isBreak: this.activeTimer.isBreak,
                isActive: true
            });
        }

        allBlocks.sort((a, b) => a.startTime - b.startTime);

        let currentEndOfTrack = startOfDayMs;

        allBlocks.forEach(entry => {
            let start = entry.startTime;
            let end = entry.endTime;

            // Clamp to bounds of the day visually
            if (start < startOfDayMs) start = startOfDayMs;
            if (end > endOfDayMs) end = endOfDayMs;

            const dur = end - start;
            if (dur <= 0) return;

            // Untracked Gap
            if (start > currentEndOfTrack) {
                const gapDur = start - currentEndOfTrack;
                const gapLeftPct = ((currentEndOfTrack - startOfDayMs) / totalDayMs) * 100;
                const gapWidthPct = (gapDur / totalDayMs) * 100;
                const gapTitle = `Untracked Time\n${this.formatTime12h(currentEndOfTrack)} - ${this.formatTime12h(start)}\n${this.formatDurationReadable(gapDur)}`;
                html += `<div class="timeline-block untracked" style="left: ${gapLeftPct}%; width: ${gapWidthPct}%; background-color: var(--color-bg-hover);" title="${gapTitle}"></div>`;
            }
            currentEndOfTrack = Math.max(currentEndOfTrack, end);

            const leftPct = ((start - startOfDayMs) / totalDayMs) * 100;
            const widthPct = (dur / totalDayMs) * 100;

            let bgColor = '';
            if (!entry.isBreak) {
                const task = allTasks.find(t => t.title === entry.taskName);
                if (task && task.assignedStopwatch) {
                    const sw = allStopwatches.find(s => s.id === task.assignedStopwatch);
                    if (sw && sw.color) bgColor = `background-color: ${sw.color};`;
                }
            }

            const titleArr = [entry.isBreak ? 'Break' : entry.taskName, this.formatTime12h(start) + ' - ' + this.formatTime12h(end), this.formatDurationReadable(dur)];
            const activeClass = entry.isActive ? 'timeline-block-active' : '';
            const breakClass = entry.isBreak ? 'is-break' : '';

            html += `<div class="timeline-block ${breakClass} ${activeClass}" style="left: ${leftPct}%; width: ${widthPct}%; ${bgColor}" title="${titleArr.join('\n')}"></div>`;
        });

        // Final untracked gap up to current time (if today) or end of day (if past)
        const limitTime = isToday ? Date.now() : endOfDayMs;
        if (currentEndOfTrack < limitTime) {
            const gapDur = limitTime - currentEndOfTrack;
            if (gapDur > 0) {
                const gapLeftPct = ((currentEndOfTrack - startOfDayMs) / totalDayMs) * 100;
                const gapWidthPct = (gapDur / totalDayMs) * 100;
                const gapTitle = `Untracked Time\n${this.formatTime12h(currentEndOfTrack)} - ${this.formatTime12h(limitTime)}\n${this.formatDurationReadable(gapDur)}`;
                html += `<div class="timeline-block untracked" style="left: ${gapLeftPct}%; width: ${gapWidthPct}%; background-color: var(--color-bg-hover);" title="${gapTitle}"></div>`;
            }
        }

        // Add current time cursor if viewing today
        if (isToday) {
            const now = Date.now();
            if (now >= startOfDayMs && now <= endOfDayMs) {
                const cursorPct = ((now - startOfDayMs) / totalDayMs) * 100;
                html += `<div class="timeline-cursor" style="left: ${cursorPct}%" title="Current Time"></div>`;
            }
        }

        container.innerHTML = html;

        // Render 8 intervals (every 3 hours)
        const labelsContainer = document.querySelector('#daily-timeline-container .timeline-labels');
        if (labelsContainer) {
            let labelsHtml = '';
            for (let i = 0; i <= 8; i++) { // 0 to 8 = 9 labels spanning 24h
                const hourMarker = new Date(startOfDayMs + (i * 3 * 60 * 60 * 1000));

                // For the very last label, we want to show it as the end of the day visually
                if (i === 8) {
                    hourMarker.setMinutes(59);
                    hourMarker.setSeconds(59);
                }

                labelsHtml += `<span>${this.formatTime12h(hourMarker.getTime())}</span>`;
            }
            labelsContainer.innerHTML = labelsHtml;
        }
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

        // Add active timer to live stats if on today
        if (this.activeTimer && isToday) {
            const activeDur = Date.now() - this.activeTimer.startTime;
            totalMs += activeDur;
            if (this.activeTimer.isBreak) {
                breakMs += activeDur;
            } else {
                studyMs += activeDur;
            }
        }

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

        const countSessions = entries.length + (this.activeTimer && isToday ? 1 : 0);

        // Calculate untracked time explicitly
        let untrackedMs = 0;
        const availableMs = (isToday ? Date.now() : todayEnd.getTime()) - todayStart.getTime();
        if (availableMs > 0) {
            untrackedMs = Math.max(0, availableMs - totalMs);
        }

        // Update DOM
        const el = (id) => document.getElementById(id);
        if (el('stat-elapsed')) el('stat-elapsed').textContent = this.formatDurationReadable(totalMs);
        if (el('stat-study')) el('stat-study').textContent = this.formatDurationReadable(studyMs);
        if (el('stat-waste')) el('stat-waste').textContent = this.formatDurationReadable(wasteMs);
        if (el('stat-untracked')) el('stat-untracked').textContent = this.formatDurationReadable(untrackedMs);
        if (el('stat-tasks-done')) el('stat-tasks-done').textContent = tasksDone;
        if (el('stat-remaining')) el('stat-remaining').textContent = remainingStr;
        if (el('stat-sessions')) el('stat-sessions').textContent = countSessions;
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
        if (!confirm('Are you sure you want to remove this session?')) {
            return;
        }

        const dateStr = getDateString(this.timeLogDate);
        const entry = StorageManager.getDailyEntry(dateStr);
        if (!entry || !entry.timeLog) return;

        entry.timeLog = entry.timeLog.filter(e => e.id !== entryId);
        StorageManager.saveDailyEntry(dateStr, entry);
        this.renderTimeLog();
        App.showToast('Session removed');
    },

    /**
     * Open the edit modal for a time log entry
     */
    openEditTimeLogModal(entryId) {
        const dateStr = getDateString(this.timeLogDate);
        const entryObj = StorageManager.getDailyEntry(dateStr);
        if (!entryObj || !entryObj.timeLog) return;

        const entry = entryObj.timeLog.find(e => e.id === entryId);
        if (!entry) return;

        this.editingTimeLogId = entryId;

        const modal = document.getElementById('timelog-edit-modal');
        const timeInput = document.getElementById('timelog-edit-time');

        if (modal && timeInput) {
            // Set input value to current end time
            const date = new Date(entry.endTime);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;

            modal.classList.add('open');

            // Re-bind save and close
            const saveBtn = document.getElementById('save-timelog-edit-btn');
            saveBtn.onclick = () => this.saveTimeLogEdit();

            modal.querySelectorAll('[data-close-modal]').forEach(btn => {
                btn.onclick = () => {
                    modal.classList.remove('open');
                    this.editingTimeLogId = null;
                };
            });
        }
    },

    /**
     * Save the edited time log entry
     */
    saveTimeLogEdit() {
        if (!this.editingTimeLogId) return;

        const timeInput = document.getElementById('timelog-edit-time');
        const modal = document.getElementById('timelog-edit-modal');
        if (!timeInput || !timeInput.value) return;

        const dateStr = getDateString(this.timeLogDate);
        const entryObj = StorageManager.getDailyEntry(dateStr);
        if (!entryObj || !entryObj.timeLog) return;

        const entry = entryObj.timeLog.find(e => e.id === this.editingTimeLogId);
        if (!entry) return;

        // Parse new end time
        const [hours, minutes] = timeInput.value.split(':').map(Number);

        // Base date on the existing end time so cross-day logic works mostly
        // Alternatively, base date on the current day's midnight.
        const newEndDate = new Date(entry.endTime);
        newEndDate.setHours(hours, minutes, 0, 0);

        // Basic validation
        if (newEndDate.getTime() < entry.startTime) {
            App.showToast('End time cannot be before start time');
            return;
        }

        entry.endTime = newEndDate.getTime();
        StorageManager.saveDailyEntry(dateStr, entryObj);

        modal.classList.remove('open');
        this.editingTimeLogId = null;
        this.renderTimeLog();
        App.showToast('Session updated');
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

        // Render Right Column Custom Sections
        this.renderRightColumn(entry.customData || {});
    },

    renderRightColumn(customData) {
        if (!this.elements.customSectionsContainer) return;

        const schemas = this.getCustomSectionsSchema();
        let html = '';

        schemas.forEach(schema => {
            const value = customData[schema.id] || '';
            html += `
                <div class="daily-card" data-custom-section="${schema.id}">
                    <div class="daily-card-header">
                        <div class="daily-card-icon" style="--card-accent: ${schema.color || 'var(--color-accent)'}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                        </div>
                        <h3 class="daily-card-title">${this.escapeHtml(schema.title)}</h3>
                        <button class="delete-section-btn btn btn-icon btn-ghost btn-sm" data-delete-section="${schema.id}" title="Delete Section" style="margin-left:auto; opacity:0.5;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <textarea class="daily-journal-input daily-journal-custom-input" data-section-id="${schema.id}"
                        placeholder="${this.escapeHtml(schema.hint || '')}" rows="4">${this.escapeHtml(value)}</textarea>
                </div>
            `;
        });

        this.elements.customSectionsContainer.innerHTML = html;

        // Bind delete buttons
        this.elements.customSectionsContainer.querySelectorAll('[data-delete-section]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteCustomSection(btn.dataset.deleteSection));
        });

        // Bind auto-save inputs
        this.elements.customSectionsContainer.querySelectorAll('.daily-journal-custom-input').forEach(input => {
            input.addEventListener('input', () => this.scheduleAutoSave());
        });
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
        this.openTaskPickerModal('routine');
    },

    // ============================================
    // Task Picker Modal
    // ============================================

    openTaskPickerModal(mode = 'plan') {
        this.currentPickerMode = mode;
        let modal = document.getElementById('task-picker-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'task-picker-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="task-picker-modal-title">Add Tasks</h3>
                        <button class="modal-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-hint" id="task-picker-modal-hint"></p>
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

        const titleEl = modal.querySelector('#task-picker-modal-title');
        const hintEl = modal.querySelector('#task-picker-modal-hint');

        if (mode === 'plan') {
            titleEl.textContent = 'Add Tasks to Plan';
            hintEl.textContent = "Select tasks from your Task Database to add to today's plan:";
        } else {
            titleEl.textContent = 'Add Routine Items';
            hintEl.textContent = "Select tasks from your Task Database to add as daily habits/routine:";
        }

        this.populateTaskPicker(mode);
        modal.classList.add('open');
    },

    populateTaskPicker(mode) {
        const list = document.getElementById('task-picker-list');
        if (!list) return;

        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();
        const alreadyPlanned = entry.plannedTaskIds || [];
        const alreadyDone = entry.completedTaskIds || [];
        const routineTexts = (entry.routine || []).map(r => r.text);

        const tasks = StorageManager.getTasks().filter(t => {
            if (t.status === 'done') return false;

            if (mode === 'plan') {
                return !alreadyPlanned.includes(t.id) && !alreadyDone.includes(t.id);
            } else {
                return !routineTexts.includes(t.title);
            }
        });

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
        const selectedIds = Array.from(list.querySelectorAll('input:checked')).map(cb => cb.value);

        if (selectedIds.length === 0) {
            App.showToast('Select at least one task');
            return;
        }

        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        if (this.currentPickerMode === 'plan') {
            entry.plannedTaskIds = entry.plannedTaskIds || [];
            selectedIds.forEach(id => {
                if (!entry.plannedTaskIds.includes(id)) {
                    entry.plannedTaskIds.push(id);
                    StorageManager.updateTask(id, { status: 'in-progress' }); // Keep this line for 'plan' mode
                }
            });
            App.showToast(`${selectedIds.length} tasks planned`);
        } else { // This is the 'routine' mode
            entry.routine = entry.routine || [];
            const allTasks = StorageManager.getTasks();
            selectedIds.forEach(id => {
                const t = allTasks.find(x => x.id === id);
                if (t && !entry.routine.find(r => r.text === t.title)) {
                    entry.routine.push({ text: t.title, completed: false });
                }
            });
            App.showToast(`${selectedIds.length} routine items added`);
        }

        StorageManager.saveDailyEntry(dateStr, entry);
        this.closeTaskPickerModal();
        this.render();

        if (typeof TasksModule !== 'undefined') {
            TasksModule.render();
        }
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
            customData: existing.customData || {}
        };

        if (this.elements.customSectionsContainer) {
            this.elements.customSectionsContainer.querySelectorAll('.daily-journal-custom-input').forEach(input => {
                const id = input.dataset.sectionId;
                entry.customData[id] = input.value;
            });
        }

        StorageManager.saveDailyEntry(dateStr, entry);
    },

    getEmptyEntry() {
        return {
            routine: [],
            plannedTaskIds: [],
            completedTaskIds: [],
            customData: {},
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
