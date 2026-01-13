/**
 * Time Tracker Module - Handles absolute time tracking and retroactive processing
 * 
 * This module is responsible for:
 * 1. Processing missed time when app reopens after being closed
 * 2. Handling daily midnight resets
 * 3. Managing historical data for days when the app wasn't open
 */

const TimeTracker = {
    /**
     * Process any missed time since the app was last closed
     * This is called on app initialization
     */
    processOnAppLoad() {
        const lastCloseTime = StorageManager.getLastCloseTime();
        const now = Date.now();

        if (!lastCloseTime) {
            // First time running the app
            StorageManager.saveLastCloseTime();
            return;
        }

        const lastCloseDate = new Date(lastCloseTime);
        const currentDate = new Date(now);

        // Process each stopwatch that was running when app closed
        const stopwatches = StorageManager.getStopwatches();
        let updated = false;

        stopwatches.forEach(sw => {
            if (sw.isRunning && sw.startTimestamp) {
                updated = true;
                this.processStopwatchMissedTime(sw, lastCloseTime, now);
            }
        });

        // Check if we need to apply midnight resets
        if (this.getDaysBetween(lastCloseDate, currentDate) > 0) {
            this.applyRetroactiveMidnightResets(lastCloseDate, currentDate);
        }

        // Always check current day for any needed processing
        this.processTodayReset();
    },

    /**
     * Process missed time for a single stopwatch
     */
    processStopwatchMissedTime(sw, lastCloseTime, now) {
        const startDate = new Date(sw.startTimestamp);
        const currentDate = new Date(now);
        const daysDiff = this.getDaysBetween(startDate, currentDate);

        if (daysDiff === 0) {
            // Same day - just update accumulated time
            const elapsedSinceStart = now - sw.startTimestamp;
            sw.accumulatedMs = elapsedSinceStart;
        } else {
            // Multiple days - need to split and save history
            this.processCrossDayStopwatch(sw, now);
        }

        StorageManager.updateStopwatch(sw.id, {
            accumulatedMs: sw.accumulatedMs,
            startTimestamp: sw.isRunning ? now : null
        });
    },

    /**
     * Handle a stopwatch that ran across multiple days
     */
    processCrossDayStopwatch(sw, now) {
        const startDate = new Date(sw.startTimestamp);
        const currentDate = new Date(now);

        // Process each day the stopwatch was running
        let currentDay = new Date(startDate);
        currentDay.setHours(0, 0, 0, 0);

        while (currentDay < currentDate) {
            const dayStart = new Date(currentDay);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(currentDay);
            dayEnd.setHours(23, 59, 59, 999);

            // Calculate time for this day
            const effectiveStart = sw.startTimestamp > dayStart.getTime() ? sw.startTimestamp : dayStart.getTime();
            const effectiveEnd = dayEnd.getTime();

            let dayMs = effectiveEnd - effectiveStart;

            // Add any previously accumulated time for the first day
            if (currentDay.getTime() === new Date(sw.startTimestamp).setHours(0, 0, 0, 0)) {
                dayMs = dayEnd.getTime() - sw.startTimestamp + (sw.accumulatedMs || 0);
            }

            // Cap at 24 hours
            dayMs = Math.min(dayMs, 24 * 60 * 60 * 1000);

            // Save to history
            StorageManager.addHistoryRecord({
                stopwatchId: sw.id,
                date: getDateString(currentDay),
                totalMs: dayMs
            });

            // Move to next day
            currentDay.setDate(currentDay.getDate() + 1);
        }

        // For today, calculate from midnight to now
        const todayMs = now - currentDate.setHours(0, 0, 0, 0);
        sw.accumulatedMs = todayMs;
        sw.startTimestamp = now;
    },

    /**
     * Apply midnight resets retroactively for days when app wasn't open
     */
    applyRetroactiveMidnightResets(lastCloseDate, currentDate) {
        const stopwatches = StorageManager.getStopwatches();

        stopwatches.forEach(sw => {
            // For each stopwatch, we need to ensure all days have history records
            // even if the stopwatch wasn't running (they would have 0ms)

            // This is already handled by processCrossDayStopwatch for running stopwatches
            // For non-running stopwatches, their accumulated time was already saved

            // Reset accumulated time if we're on a new day
            if (!sw.isRunning && sw.accumulatedMs > 0) {
                const lastActiveDate = getDateString(new Date(lastCloseDate));
                const todayDate = getDateString(currentDate);

                if (lastActiveDate !== todayDate) {
                    // Save the previous day's accumulated time to history
                    StorageManager.addHistoryRecord({
                        stopwatchId: sw.id,
                        date: lastActiveDate,
                        totalMs: sw.accumulatedMs
                    });

                    // Reset for today
                    StorageManager.updateStopwatch(sw.id, {
                        accumulatedMs: 0
                    });
                }
            }
        });
    },

    /**
     * Check if midnight reset is needed for today
     */
    processTodayReset() {
        const stopwatches = StorageManager.getStopwatches();
        const todayDate = getDateString();

        stopwatches.forEach(sw => {
            if (sw.lastResetDate && sw.lastResetDate === todayDate) {
                // Already reset today
                return;
            }

            if (sw.lastResetDate && sw.lastResetDate !== todayDate) {
                // Need to reset - save previous day's data first
                if (sw.accumulatedMs > 0 || sw.isRunning) {
                    let totalMs = sw.accumulatedMs || 0;

                    if (sw.isRunning && sw.startTimestamp) {
                        // Calculate time up to midnight of today
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        totalMs += today.getTime() - sw.startTimestamp;
                    }

                    StorageManager.addHistoryRecord({
                        stopwatchId: sw.id,
                        date: sw.lastResetDate,
                        totalMs: totalMs
                    });
                }

                // Reset for today
                StorageManager.updateStopwatch(sw.id, {
                    accumulatedMs: 0,
                    lastResetDate: todayDate,
                    startTimestamp: sw.isRunning ? Date.now() : null
                });
            }
        });
    },

    /**
     * Calculate elapsed time for a stopwatch (live, for display)
     */
    getElapsedMs(sw) {
        let total = sw.accumulatedMs || 0;

        if (sw.isRunning && sw.startTimestamp) {
            total += Date.now() - sw.startTimestamp;
        }

        return total;
    },

    /**
     * Start a stopwatch - saves absolute timestamp
     */
    startStopwatch(sw) {
        const now = Date.now();
        const todayDate = getDateString();

        return {
            ...sw,
            isRunning: true,
            startTimestamp: now,
            lastResetDate: sw.lastResetDate || todayDate
        };
    },

    /**
     * Stop a stopwatch - accumulates time
     */
    stopStopwatch(sw) {
        if (!sw.isRunning || !sw.startTimestamp) {
            return { ...sw, isRunning: false };
        }

        const now = Date.now();
        const elapsed = now - sw.startTimestamp;

        return {
            ...sw,
            isRunning: false,
            startTimestamp: null,
            accumulatedMs: (sw.accumulatedMs || 0) + elapsed
        };
    },

    /**
     * Save current state to history at midnight
     */
    performMidnightReset(sw) {
        const todayDate = getDateString();
        let totalMs = this.getElapsedMs(sw);

        // Save to history
        StorageManager.addHistoryRecord({
            stopwatchId: sw.id,
            date: sw.lastResetDate || todayDate,
            totalMs: totalMs
        });

        // Reset
        return {
            ...sw,
            accumulatedMs: 0,
            lastResetDate: todayDate,
            startTimestamp: sw.isRunning ? Date.now() : null
        };
    },

    /**
     * Get number of days between two dates
     */
    getDaysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(d2 - d1);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Schedule midnight reset check
     */
    scheduleMidnightCheck() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);

        const msUntilMidnight = midnight.getTime() - now.getTime();

        setTimeout(() => {
            this.performAllMidnightResets();
            // Schedule next check
            this.scheduleMidnightCheck();
        }, msUntilMidnight);
    },

    /**
     * Perform midnight reset for all stopwatches
     */
    performAllMidnightResets() {
        const stopwatches = StorageManager.getStopwatches();
        const todayDate = getDateString();

        stopwatches.forEach(sw => {
            if (sw.deleted) return;

            const updated = this.performMidnightReset(sw);
            StorageManager.updateStopwatch(sw.id, updated);
        });

        // Notify the advanced stopwatches module to re-render
        if (window.AdvancedStopwatchesModule) {
            window.AdvancedStopwatchesModule.render();
        }
    }
};

window.TimeTracker = TimeTracker;
