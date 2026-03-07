/**
 * Storage Manager - LocalStorage persistence layer
 * Handles all data storage and retrieval operations
 */

const StorageManager = {
    KEYS: {
        ALARMS: 'focusclock_alarms',
        STOPWATCHES: 'focusclock_stopwatches',
        HISTORY: 'focusclock_history',
        SESSIONS: 'focusclock_sessions',  // Individual work intervals
        SETTINGS: 'focusclock_settings',
        LAST_CLOSE: 'focusclock_last_close',
        ACCOUNT_CREATED: 'focusclock_account_created',
        DAILYS: 'focusclock_dailys',      // Daily journal entries
        TASKS: 'focusclock_tasks',        // Task database
        ACTIVE_TIMER: 'focusclock_active_timer',  // Active task/break timer state
        TAGS: 'focusclock_tags',                   // Persistent tag library
        HABITS: 'focusclock_habits',               // Habit tracking data
        WORLD_CLOCKS: 'focusclock_world_clocks'    // Custom timezones
    },

    /**
     * Get data from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Parsed data or default value
     */
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Error reading from localStorage: ${key}`, error);
            return defaultValue;
        }
    },

    /**
     * Save data to localStorage and sync to backend
     * @param {string} key - Storage key
     * @param {*} value - Data to save
     * @returns {boolean} Success status
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            this.syncToServer();
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage: ${key}`, error);
            return false;
        }
    },

    /**
     * Remove data from localStorage and sync to backend
     * @param {string} key - Storage key
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            this.syncToServer();
        } catch (error) {
            console.error(`Error removing from localStorage: ${key}`, error);
        }
    },

    // ============================================
    // API Backend Sync logic
    // ============================================

    async initSync() {
        try {
            const res = await fetch('/api/sync');
            if (res.ok) {
                const data = await res.json();
                if (Object.keys(data).length > 0) {
                    // Populate local storage from server if server has data
                    for (const currKey in data) {
                        localStorage.setItem(currKey, JSON.stringify(data[currKey]));
                    }
                } else {
                    // Server is empty, push our local state to it
                    this.syncToServer();
                }
            }
        } catch (err) {
            console.warn('Backend sync API not reachable. Running in standalone local mode.', err);
        }
    },

    _syncTimer: null,
    syncToServer() {
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(async () => {
            try {
                // Collect all TimeVault keys
                const exportData = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const keyName = localStorage.key(i);
                    if (keyName.startsWith('focusclock_')) {
                        exportData[keyName] = JSON.parse(localStorage.getItem(keyName));
                    }
                }
                await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(exportData)
                });
            } catch (err) {
                console.warn('Failed to sync to backend.', err);
            }
        }, 1000); // Debounce saves by 1 second
    },

    // ============================================
    // World Clocks
    // ============================================

    getWorldClocks() {
        return this.get(this.KEYS.WORLD_CLOCKS, []);
    },

    saveWorldClocks(clocks) {
        return this.set(this.KEYS.WORLD_CLOCKS, clocks);
    },

    addWorldClock(clock) {
        const clocks = this.getWorldClocks();
        clock.id = 'wc_' + Date.now().toString();
        clocks.push(clock);
        return this.saveWorldClocks(clocks);
    },

    deleteWorldClock(id) {
        const clocks = this.getWorldClocks().filter(c => c.id !== id);
        return this.saveWorldClocks(clocks);
    },

    // ============================================
    // Alarms
    // ============================================

    getAlarms() {
        return this.get(this.KEYS.ALARMS, []);
    },

    saveAlarms(alarms) {
        return this.set(this.KEYS.ALARMS, alarms);
    },

    addAlarm(alarm) {
        const alarms = this.getAlarms();
        alarms.push(alarm);
        return this.saveAlarms(alarms);
    },

    updateAlarm(id, updates) {
        const alarms = this.getAlarms();
        const index = alarms.findIndex(a => a.id === id);
        if (index !== -1) {
            alarms[index] = { ...alarms[index], ...updates };
            return this.saveAlarms(alarms);
        }
        return false;
    },

    deleteAlarm(id) {
        const alarms = this.getAlarms().filter(a => a.id !== id);
        return this.saveAlarms(alarms);
    },

    // ============================================
    // Advanced Stopwatches
    // ============================================

    getStopwatches() {
        let stopwatches = this.get(this.KEYS.STOPWATCHES, []);

        // Ensure Untracked Time always exists
        if (!stopwatches.find(sw => sw.id === 'untracked')) {
            stopwatches.unshift({
                id: 'untracked',
                name: 'Untracked Time',
                color: '#6b7280', // Grey color for untracked
                icon: 'activity',
                order: -1 // Keep it at the top
            });
            // Don't save it to storage necessarily, just inject it at runtime
        }
        return stopwatches;
    },

    saveStopwatches(stopwatches) {
        return this.set(this.KEYS.STOPWATCHES, stopwatches);
    },

    addStopwatch(stopwatch) {
        const stopwatches = this.getStopwatches();
        stopwatches.push(stopwatch);
        return this.saveStopwatches(stopwatches);
    },

    updateStopwatch(id, updates) {
        const stopwatches = this.getStopwatches();
        const index = stopwatches.findIndex(sw => sw.id === id);
        if (index !== -1) {
            stopwatches[index] = { ...stopwatches[index], ...updates };
            return this.saveStopwatches(stopwatches);
        }
        return false;
    },

    deleteStopwatch(id) {
        if (id === 'untracked') return false; // Cannot delete built-in untracked time
        // Soft delete - mark as deleted but keep for history
        return this.updateStopwatch(id, { deleted: true, isRunning: false });
    },

    permanentlyDeleteStopwatch(id) {
        if (id === 'untracked') return false;
        const stopwatches = this.getStopwatches().filter(sw => sw.id !== id);
        return this.saveStopwatches(stopwatches);
    },

    // ============================================
    // History (for graphs)
    // ============================================

    getHistory() {
        return this.get(this.KEYS.HISTORY, []);
    },

    saveHistory(history) {
        return this.set(this.KEYS.HISTORY, history);
    },

    addHistoryRecord(record) {
        const history = this.getHistory();
        // Check if record exists for this date and stopwatch
        const existingIndex = history.findIndex(
            h => h.stopwatchId === record.stopwatchId && h.date === record.date
        );
        if (existingIndex !== -1) {
            // Update existing record
            history[existingIndex].totalMs += record.totalMs;
        } else {
            history.push(record);
        }
        return this.saveHistory(history);
    },

    getHistoryForStopwatch(stopwatchId, days = 30) {
        const history = this.getHistory();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return history.filter(h =>
            h.stopwatchId === stopwatchId &&
            new Date(h.date) >= cutoffDate
        );
    },

    // ============================================
    // Sessions (individual work intervals)
    // ============================================

    getSessions() {
        return this.get(this.KEYS.SESSIONS, []);
    },

    saveSessions(sessions) {
        return this.set(this.KEYS.SESSIONS, sessions);
    },

    /**
     * Start a new session for a stopwatch
     * @param {string} stopwatchId 
     * @param {number} startTime - Unix timestamp
     */
    startSession(stopwatchId, startTime = Date.now()) {
        const sessions = this.getSessions();
        sessions.push({
            id: generateId(),
            stopwatchId,
            startTime,
            endTime: null,
            durationMs: 0
        });
        return this.saveSessions(sessions);
    },

    /**
     * End the current session for a stopwatch
     * @param {string} stopwatchId 
     * @param {number} endTime - Unix timestamp
     */
    endSession(stopwatchId, endTime = Date.now()) {
        const sessions = this.getSessions();
        // Find the most recent open session for this stopwatch
        const openSession = sessions.filter(
            s => s.stopwatchId === stopwatchId && s.endTime === null
        ).pop();

        if (openSession) {
            openSession.endTime = endTime;
            openSession.durationMs = endTime - openSession.startTime;
            return this.saveSessions(sessions);
        }
        return false;
    },

    /**
     * Add a completed session (for offline waste time)
     */
    addCompletedSession(stopwatchId, startTime, endTime) {
        const sessions = this.getSessions();
        sessions.push({
            id: generateId(),
            stopwatchId,
            startTime,
            endTime,
            durationMs: endTime - startTime
        });
        return this.saveSessions(sessions);
    },

    /**
     * Get sessions for a specific stopwatch within date range
     */
    getSessionsForStopwatch(stopwatchId, days = 30) {
        const sessions = this.getSessions();
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

        return sessions.filter(s =>
            s.stopwatchId === stopwatchId &&
            s.startTime >= cutoffTime
        );
    },

    /**
     * Get session aggregates by hour (0-23) for heatmap
     */
    getSessionsByHour(stopwatchId, days = 30) {
        const sessions = this.getSessionsForStopwatch(stopwatchId, days);
        const hourlyData = new Array(24).fill(0);

        sessions.forEach(s => {
            if (s.endTime) {
                const startDate = new Date(s.startTime);
                const endDate = new Date(s.endTime);

                // Simple: attribute to start hour
                const hour = startDate.getHours();
                hourlyData[hour] += s.durationMs;
            }
        });

        return hourlyData;
    },

    /**
     * Get session aggregates by day of week (0=Sun, 6=Sat)
     */
    getSessionsByDayOfWeek(stopwatchId, days = 30) {
        const sessions = this.getSessionsForStopwatch(stopwatchId, days);
        const weeklyData = new Array(7).fill(0);

        sessions.forEach(s => {
            if (s.endTime) {
                const day = new Date(s.startTime).getDay();
                weeklyData[day] += s.durationMs;
            }
        });

        return weeklyData;
    },

    /**
     * Cleanup old sessions (older than 90 days by default)
     */
    cleanupOldSessions(days = 90) {
        const sessions = this.getSessions();
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filtered = sessions.filter(s => s.startTime >= cutoffTime);
        return this.saveSessions(filtered);
    },

    // ============================================
    // Settings
    // ============================================

    getSettings() {
        return this.get(this.KEYS.SETTINGS, {
            use24Hour: false,
            darkMode: true
        });
    },

    saveSettings(settings) {
        return this.set(this.KEYS.SETTINGS, settings);
    },

    updateSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.saveSettings(settings);
    },

    // ============================================
    // App State
    // ============================================

    /**
     * Get last close data (timestamp and running stopwatch)
     * @returns {{timestamp: number, runningStopwatchId: string|null}|null}
     */
    getLastCloseData() {
        return this.get(this.KEYS.LAST_CLOSE, null);
    },

    /**
     * Save close data including timestamp and running stopwatch ID
     * @param {string|null} runningStopwatchId - ID of the stopwatch running at close
     */
    saveLastCloseData(runningStopwatchId = null) {
        return this.set(this.KEYS.LAST_CLOSE, {
            timestamp: Date.now(),
            runningStopwatchId
        });
    },

    // Legacy methods for backward compatibility
    getLastCloseTime() {
        const data = this.getLastCloseData();
        // Handle both old format (number) and new format (object)
        if (typeof data === 'number') return data;
        return data?.timestamp || null;
    },

    saveLastCloseTime() {
        // Find which stopwatch is currently running
        const stopwatches = this.getStopwatches();
        const running = stopwatches.find(sw => sw.isRunning && !sw.deleted);
        return this.saveLastCloseData(running?.id || null);
    },

    // ============================================
    // Account Creation (for graph boundaries)
    // ============================================

    getAccountCreatedAt() {
        return this.get(this.KEYS.ACCOUNT_CREATED, null);
    },

    /**
     * Initialize account creation date if not set.
     * Uses earliest stopwatch creation date or current date.
     */
    initAccountCreatedAt() {
        if (this.getAccountCreatedAt()) return; // Already set

        // Find earliest stopwatch creation date
        const stopwatches = this.getStopwatches();
        let earliestDate = Date.now();

        stopwatches.forEach(sw => {
            if (sw.createdAt && sw.createdAt < earliestDate) {
                earliestDate = sw.createdAt;
            }
        });

        this.set(this.KEYS.ACCOUNT_CREATED, earliestDate);
    },

    // ============================================
    // Daily Journal Methods
    // ============================================

    /**
     * Get all daily journal entries
     */
    getDailys() {
        return this.get(this.KEYS.DAILYS, {});
    },

    /**
     * Get a specific daily entry by date
     * @param {string} dateStr - Date string (YYYY-MM-DD)
     */
    getDailyEntry(dateStr) {
        const dailys = this.getDailys();
        return dailys[dateStr] || null;
    },

    /**
     * Save a daily entry
     * @param {string} dateStr - Date string (YYYY-MM-DD)
     * @param {object} entry - Entry data
     */
    saveDailyEntry(dateStr, entry) {
        const dailys = this.getDailys();
        dailys[dateStr] = {
            ...entry,
            date: dateStr,
            updatedAt: Date.now()
        };
        if (!entry.createdAt) {
            dailys[dateStr].createdAt = Date.now();
        }
        return this.set(this.KEYS.DAILYS, dailys);
    },

    /**
     * Get daily entries for a date range
     * @param {number} days - Number of days to look back
     */
    getRecentDailys(days = 30) {
        const dailys = this.getDailys();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = getDateString(cutoff);

        return Object.entries(dailys)
            .filter(([date]) => date >= cutoffStr)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([, entry]) => entry);
    },

    // ============================================
    // Task Database Methods
    // ============================================

    /**
     * Get all tasks
     */
    getTasks() {
        return this.get(this.KEYS.TASKS, []);
    },

    /**
     * Save all tasks
     */
    saveTasks(tasks) {
        return this.set(this.KEYS.TASKS, tasks);
    },

    /**
     * Add a new task
     */
    addTask(task) {
        const tasks = this.getTasks();
        const newTask = {
            id: generateId(),
            title: task.title || '',
            category: task.category || '',
            description: task.description || '',
            subtasks: task.subtasks || [],
            tags: task.tags || [],
            priority: task.priority || 'medium',
            status: task.status || 'todo',
            assignedStopwatch: task.assignedStopwatch || null,
            createdAt: Date.now(),
            completedAt: null
        };
        tasks.push(newTask);
        this.saveTasks(tasks);
        return newTask;
    },

    /**
     * Update a task
     */
    updateTask(taskId, updates) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            if (updates.status === 'done' && !tasks[index].completedAt) {
                tasks[index].completedAt = Date.now();
            }
            this.saveTasks(tasks);
            return tasks[index];
        }
        return null;
    },

    /**
     * Delete a task
     */
    deleteTask(taskId) {
        const tasks = this.getTasks();
        const filtered = tasks.filter(t => t.id !== taskId);
        this.saveTasks(filtered);
    },

    /**
     * Get tasks by status
     */
    getTasksByStatus(status) {
        return this.getTasks().filter(t => t.status === status);
    },

    /**
     * Get tasks assigned to a stopwatch
     */
    getTasksByStopwatch(stopwatchId) {
        return this.getTasks().filter(t => t.assignedStopwatch === stopwatchId);
    },

    /**
     * Toggle subtask completion
     */
    toggleSubtask(taskId, subtaskId) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            const subtask = task.subtasks.find(s => s.id === subtaskId);
            if (subtask) {
                subtask.completed = !subtask.completed;
                this.saveTasks(tasks);
                return subtask;
            }
        }
        return null;
    },

    // ============================================
    // Active Timer (for daily time log)
    // ============================================

    /**
     * Get the active timer state (survives page refresh)
     * @returns {{taskName: string, startTime: number, isBreak: boolean, dateStr: string}|null}
     */
    getActiveTimer() {
        return this.get(this.KEYS.ACTIVE_TIMER, null);
    },

    /**
     * Save active timer state
     */
    saveActiveTimer(timerState) {
        return this.set(this.KEYS.ACTIVE_TIMER, timerState);
    },

    /**
     * Clear the active timer
     */
    clearActiveTimer() {
        return this.remove(this.KEYS.ACTIVE_TIMER);
    },

    /**
     * Add a time log entry to a daily entry
     * @param {string} dateStr - YYYY-MM-DD
     * @param {object} logEntry - {id, taskName, startTime, endTime, isBreak}
     */
    addTimeLogEntry(dateStr, logEntry) {
        const dailys = this.getDailys();
        if (!dailys[dateStr]) {
            dailys[dateStr] = {
                routine: [],
                plannedTaskIds: [],
                completedTaskIds: [],
                blocked: '',
                tomorrow: '',
                reflection: '',
                timeLog: [],
                date: dateStr,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }
        if (!dailys[dateStr].timeLog) {
            dailys[dateStr].timeLog = [];
        }
        dailys[dateStr].timeLog.push(logEntry);
        dailys[dateStr].updatedAt = Date.now();
        return this.set(this.KEYS.DAILYS, dailys);
    },

    /**
     * Get time log entries for a specific date
     */
    getTimeLog(dateStr) {
        const entry = this.getDailyEntry(dateStr);
        return (entry && entry.timeLog) || [];
    },

    // ============================================
    // Persistent Tags
    // ============================================

    getTags() {
        return this.get(this.KEYS.TAGS, []);
    },

    saveTags(tags) {
        return this.set(this.KEYS.TAGS, tags);
    },

    addTag(tag) {
        const tags = this.getTags();
        const normalized = tag.trim();
        if (normalized && !tags.includes(normalized)) {
            tags.push(normalized);
            this.saveTags(tags);
        }
        return tags;
    },

    removeTag(tag) {
        const tags = this.getTags().filter(t => t !== tag);
        return this.saveTags(tags);
    },

    // ============================================
    // Habit Tracking
    // ============================================

    getHabits() {
        return this.get(this.KEYS.HABITS, []);
    },

    saveHabits(habits) {
        return this.set(this.KEYS.HABITS, habits);
    },

    addHabit(habit) {
        const habits = this.getHabits();
        habits.push(habit);
        this.saveHabits(habits);
        return habits;
    },

    updateHabit(id, updates) {
        const habits = this.getHabits();
        const idx = habits.findIndex(h => h.id === id);
        if (idx !== -1) {
            Object.assign(habits[idx], updates);
            this.saveHabits(habits);
        }
        return habits;
    },

    deleteHabit(id) {
        const habits = this.getHabits().filter(h => h.id !== id);
        this.saveHabits(habits);
        return habits;
    },

    toggleHabitCompletion(habitId, dateStr) {
        const habits = this.getHabits();
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return habits;
        if (!habit.completions) habit.completions = [];
        const idx = habit.completions.indexOf(dateStr);
        if (idx !== -1) {
            habit.completions.splice(idx, 1);
        } else {
            habit.completions.push(dateStr);
        }
        this.saveHabits(habits);
        return habits;
    }
};

// Generate unique ID
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Format time helpers
function formatTime(ms, includeMs = false) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);

    const pad = (n) => n.toString().padStart(2, '0');

    let result = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    if (includeMs) {
        result += `.${pad(milliseconds)}`;
    }
    return result;
}

function formatTimeShort(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function getDateString(dateInput) {
    const date = dateInput ? new Date(dateInput) : new Date();

    // Adjust for custom day start hour (e.g. if 5am, then 3am belongs to previous day)
    if (typeof App !== 'undefined' && App.dayStartHour) {
        if (date.getHours() < App.dayStartHour) {
            date.setDate(date.getDate() - 1);
        }
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Export for use in other modules
window.StorageManager = StorageManager;
window.generateId = generateId;
window.formatTime = formatTime;
window.formatTimeShort = formatTimeShort;
window.formatDate = formatDate;
window.getDateString = getDateString;
