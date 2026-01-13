/**
 * Storage Manager - LocalStorage persistence layer
 * Handles all data storage and retrieval operations
 */

const StorageManager = {
    KEYS: {
        ALARMS: 'focusclock_alarms',
        STOPWATCHES: 'focusclock_stopwatches',
        HISTORY: 'focusclock_history',
        SETTINGS: 'focusclock_settings',
        LAST_CLOSE: 'focusclock_last_close'
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
     * Save data to localStorage
     * @param {string} key - Storage key
     * @param {*} value - Data to save
     * @returns {boolean} Success status
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage: ${key}`, error);
            return false;
        }
    },

    /**
     * Remove data from localStorage
     * @param {string} key - Storage key
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing from localStorage: ${key}`, error);
        }
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
        return this.get(this.KEYS.STOPWATCHES, []);
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
        // Soft delete - mark as deleted but keep for history
        return this.updateStopwatch(id, { deleted: true, isRunning: false });
    },

    permanentlyDeleteStopwatch(id) {
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

    getLastCloseTime() {
        return this.get(this.KEYS.LAST_CLOSE, null);
    },

    saveLastCloseTime() {
        return this.set(this.KEYS.LAST_CLOSE, Date.now());
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

function getDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
}

// Export for use in other modules
window.StorageManager = StorageManager;
window.generateId = generateId;
window.formatTime = formatTime;
window.formatTimeShort = formatTimeShort;
window.formatDate = formatDate;
window.getDateString = getDateString;
