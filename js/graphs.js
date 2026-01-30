/**
 * Graphs Module - Daily usage graphs and analysis
 * 
 * Features:
 * - Bar and Line charts showing daily stopwatch usage
 * - Global overview graph with all categories
 * - Charts linked to stopwatch UUID (not name/color)
 * - Toggle to show/hide deleted stopwatch graphs
 * - Goal lines and achievement analysis
 * - Interactive zoom functionality
 * - Statistics and summaries
 */

const GraphsModule = {
    elements: {
        container: null,
        globalOverview: null,
        emptyState: null,
        rangeSelect: null,
        showDeletedToggle: null,
        chartTypeButtons: null
    },

    showDeleted: false,
    range: 7, // days or 'all' - global default
    chartType: 'bar', // 'bar' or 'line'
    hiddenCategories: new Set(),
    categoryRanges: {}, // REQ-7: Per-category time range overrides { stopwatchId: rangeDays }
    zoomRange: null, // { startDate, endDate } or null
    isDragging: false,
    dragStart: null,

    init() {
        this.elements.container = document.getElementById('graphs-container');
        this.elements.globalOverview = document.getElementById('global-overview-container');
        this.elements.emptyState = document.getElementById('no-graphs');
        this.elements.rangeSelect = document.getElementById('graphs-range');
        this.elements.showDeletedToggle = document.getElementById('show-deleted-graphs');
        this.elements.chartTypeButtons = document.querySelectorAll('.chart-type-btn');

        // Range select listener
        this.elements.rangeSelect?.addEventListener('change', (e) => {
            this.range = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
            this.zoomRange = null;
            this.render();
        });

        // Show deleted toggle listener
        this.elements.showDeletedToggle?.addEventListener('change', (e) => {
            this.showDeleted = e.target.checked;
            this.render();
        });

        // Chart type toggle listeners
        this.elements.chartTypeButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.chartTypeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.chartType = btn.dataset.chartType;
                this.render();
            });
        });
    },

    render() {
        if (!this.elements.container) return;

        const stopwatches = StorageManager.getStopwatches();
        const history = StorageManager.getHistory();

        // Filter stopwatches based on showDeleted toggle
        let displayStopwatches = this.showDeleted
            ? stopwatches
            : stopwatches.filter(sw => !sw.deleted);

        // Only show stopwatches that have history or are not deleted
        displayStopwatches = displayStopwatches.filter(sw => {
            const hasHistory = history.some(h => h.stopwatchId === sw.id);
            return hasHistory || !sw.deleted;
        });

        if (displayStopwatches.length === 0) {
            this.elements.container.innerHTML = '';
            this.elements.globalOverview.innerHTML = '';
            this.elements.emptyState.style.display = 'flex';
            return;
        }

        this.elements.emptyState.style.display = 'none';

        // Generate date range
        const dates = this.getDateRange(this.range);
        const displayDates = this.zoomRange
            ? dates.filter(d => d >= this.zoomRange.startDate && d <= this.zoomRange.endDate)
            : dates;

        // Render global overview (uses global range)
        this.renderGlobalOverview(displayStopwatches, history, displayDates);

        // Render individual graphs (each can have its own range)
        this.elements.container.innerHTML = displayStopwatches.map(sw => {
            const swHistory = history.filter(h => h.stopwatchId === sw.id);
            // REQ-7: Use per-category range if set, otherwise use global range
            const swRange = this.categoryRanges[sw.id] || this.range;
            const swDates = this.getDateRange(swRange, sw.id);
            const swDisplayDates = this.zoomRange
                ? swDates.filter(d => d >= this.zoomRange.startDate && d <= this.zoomRange.endDate)
                : swDates;
            return this.renderGraphCard(sw, swHistory, swDisplayDates, swRange);
        }).join('') + this.renderWasteTimeAnalysis();

        // Add tooltip event listeners
        this.addTooltipListeners();

        // REQ-7: Add per-category range change listeners
        this.addCategoryRangeListeners();
    },

    renderGlobalOverview(stopwatches, history, dates) {
        if (!this.elements.globalOverview) return;

        // Filter out hidden categories for rendering
        const visibleStopwatches = stopwatches.filter(sw => !this.hiddenCategories.has(sw.id));

        this.elements.globalOverview.innerHTML = `
            <div class="global-overview-card">
                <div class="global-overview-header">
                    <span class="global-overview-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 8 14 12 10 6 6 10 2 6"></polyline>
                        </svg>
                        Overview
                    </span>
                    ${this.zoomRange ? `
                        <button class="zoom-reset-btn" id="zoom-reset">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
                                <path d="M3 3v5h5"/>
                            </svg>
                            Reset Zoom
                        </button>
                    ` : ''}
                </div>
                <div class="overview-chart-container" id="overview-chart">
                    ${visibleStopwatches.length > 0
                ? this.renderOverviewChart(visibleStopwatches, history, dates)
                : '<div class="overview-empty-hint">Select categories from the legend below</div>'
            }
                </div>
                ${this.renderOverviewLegend(stopwatches)}
            </div>
        `;

        // Add legend toggle listeners
        this.addLegendListeners();

        // Add zoom reset listener
        document.getElementById('zoom-reset')?.addEventListener('click', () => {
            this.zoomRange = null;
            this.render();
        });

        // Add zoom drag listeners
        this.addZoomListeners(dates);
    },

    renderOverviewChart(stopwatches, history, dates) {
        const chartWidth = 800;
        const chartHeight = 250;
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const plotWidth = chartWidth - padding.left - padding.right;
        const plotHeight = chartHeight - padding.top - padding.bottom;

        // Prepare data for each stopwatch
        const allData = stopwatches.map(sw => ({
            sw,
            data: this.prepareGraphData(history.filter(h => h.stopwatchId === sw.id), dates)
        }));

        // Find max value across all data
        const maxValue = Math.max(
            ...allData.flatMap(d => d.data.map(p => p.value)),
            1
        );

        // Generate SVG content
        let paths = '';
        let areas = '';
        let points = '';

        allData.forEach(({ sw, data }) => {
            const pathPoints = data.map((d, i) => {
                const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotWidth;
                const y = padding.top + plotHeight - (d.value / maxValue) * plotHeight;
                return { x, y, date: d.date, value: d.value };
            });

            // Area fill
            const areaPath = `M ${pathPoints[0].x} ${padding.top + plotHeight} ` +
                pathPoints.map(p => `L ${p.x} ${p.y}`).join(' ') +
                ` L ${pathPoints[pathPoints.length - 1].x} ${padding.top + plotHeight} Z`;
            areas += `<path class="graph-area" d="${areaPath}" fill="${sw.color || '#6366f1'}" />`;

            // Line
            const linePath = `M ${pathPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`;
            paths += `<path class="graph-line" d="${linePath}" stroke="${sw.color || '#6366f1'}" />`;

            // Points
            pathPoints.forEach(p => {
                points += `
                    <circle class="graph-point" 
                        cx="${p.x}" cy="${p.y}" r="4" 
                        stroke="${sw.color || '#6366f1'}"
                        data-date="${p.date}"
                        data-value="${p.value}"
                        data-category="${sw.name}"
                    />
                `;
            });
        });

        // X-axis labels
        let xLabels = '';
        const labelInterval = this.getXAxisInterval(dates.length);
        dates.forEach((date, i) => {
            if (i % labelInterval === 0 || i === dates.length - 1) {
                const x = padding.left + (i / Math.max(dates.length - 1, 1)) * plotWidth;
                xLabels += `
                    <text class="graph-axis-label" x="${x}" y="${chartHeight - 5}" 
                        text-anchor="middle" style="font-size: 10px; fill: #606070;">
                        ${this.formatDateLabel(date)}
                    </text>
                `;
            }
        });

        // Y-axis labels
        let yLabels = '';
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const value = (maxValue / ySteps) * i;
            const y = padding.top + plotHeight - (i / ySteps) * plotHeight;
            yLabels += `
                <text class="graph-axis-label" x="${padding.left - 8}" y="${y + 4}" 
                    text-anchor="end" style="font-size: 10px; fill: #606070;">
                    ${formatTimeShort(value)}
                </text>
                <line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}"
                    stroke="rgba(255,255,255,0.05)" stroke-width="1" />
            `;
        }

        return `
            <svg class="graph-svg overview-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" 
                 preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%;">
                ${yLabels}
                ${areas}
                ${paths}
                ${points}
                ${xLabels}
                <rect class="zoom-selection" id="zoom-rect" x="0" y="0" width="0" height="0" 
                    style="display: none;" />
            </svg>
            <div class="graph-tooltip" id="overview-tooltip"></div>
        `;
    },

    renderOverviewLegend(stopwatches) {
        const items = stopwatches.map(sw => `
            <div class="legend-item ${this.hiddenCategories.has(sw.id) ? 'hidden' : ''}" 
                 data-category-id="${sw.id}">
                <span class="legend-color" style="background: ${sw.color || '#6366f1'};"></span>
                <span class="legend-label">${this.escapeHtml(sw.name)}</span>
            </div>
        `).join('');

        return `<div class="overview-legend">${items}</div>`;
    },

    addLegendListeners() {
        const legendItems = this.elements.globalOverview.querySelectorAll('.legend-item');
        legendItems.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.categoryId;
                if (this.hiddenCategories.has(id)) {
                    this.hiddenCategories.delete(id);
                } else {
                    this.hiddenCategories.add(id);
                }
                this.render();
            });
        });
    },

    addZoomListeners(dates) {
        const svg = this.elements.globalOverview.querySelector('.overview-svg');
        const zoomRect = document.getElementById('zoom-rect');
        if (!svg || !zoomRect) return;

        const chartWidth = 800;
        const padding = { left: 50, right: 20 };
        const plotWidth = chartWidth - padding.left - padding.right;

        svg.addEventListener('mousedown', (e) => {
            const rect = svg.getBoundingClientRect();
            const scaleX = chartWidth / rect.width;
            const x = (e.clientX - rect.left) * scaleX;

            if (x >= padding.left && x <= chartWidth - padding.right) {
                this.isDragging = true;
                this.dragStart = x;
                zoomRect.style.display = 'block';
                zoomRect.setAttribute('x', x);
                zoomRect.setAttribute('y', '20');
                zoomRect.setAttribute('width', '0');
                zoomRect.setAttribute('height', '190');
            }
        });

        svg.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const rect = svg.getBoundingClientRect();
            const scaleX = chartWidth / rect.width;
            const x = Math.min(Math.max((e.clientX - rect.left) * scaleX, padding.left), chartWidth - padding.right);

            const startX = Math.min(this.dragStart, x);
            const width = Math.abs(x - this.dragStart);
            zoomRect.setAttribute('x', startX);
            zoomRect.setAttribute('width', width);
        });

        svg.addEventListener('mouseup', (e) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            zoomRect.style.display = 'none';

            const rect = svg.getBoundingClientRect();
            const scaleX = chartWidth / rect.width;
            const x = Math.min(Math.max((e.clientX - rect.left) * scaleX, padding.left), chartWidth - padding.right);

            const startX = Math.min(this.dragStart, x);
            const endX = Math.max(this.dragStart, x);

            // Only zoom if drag is significant (at least 20px)
            if (endX - startX > 20) {
                const startIdx = Math.floor(((startX - padding.left) / plotWidth) * (dates.length - 1));
                const endIdx = Math.ceil(((endX - padding.left) / plotWidth) * (dates.length - 1));

                if (startIdx < endIdx && startIdx >= 0 && endIdx < dates.length) {
                    this.zoomRange = {
                        startDate: dates[startIdx],
                        endDate: dates[endIdx]
                    };
                    this.render();
                }
            }
        });

        svg.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.isDragging = false;
                zoomRect.style.display = 'none';
            }
        });
    },

    renderGraphCard(sw, history, dates, currentRange = this.range) {
        const data = this.prepareGraphData(history, dates);
        const totalMs = data.reduce((sum, d) => sum + d.value, 0);
        const avgMs = dates.length > 0 ? totalMs / dates.length : 0;
        const goalMs = sw.goalMs || 8 * 60 * 60 * 1000;
        const isMinimize = sw.goalDirection === 'minimize';

        // Calculate goal-based stats depending on direction
        let bestDayValue, daysGoalMet, daysCloseToGoal;

        if (isMinimize) {
            // For minimize: best day is the least time, goal met when time <= goal
            const daysWithData = data.filter(d => d.value > 0);
            bestDayValue = daysWithData.length > 0 ? Math.min(...daysWithData.map(d => d.value)) : 0;
            daysGoalMet = data.filter(d => d.value <= goalMs && d.value > 0).length;
            // Near goal for minimize: within 120% of goal (slightly over is close)
            daysCloseToGoal = data.filter(d => d.value > goalMs && d.value <= goalMs * 1.2).length;
        } else {
            // For maximize: best day is the most time, goal met when time >= goal
            bestDayValue = Math.max(...data.map(d => d.value), 0);
            daysGoalMet = data.filter(d => d.value >= goalMs).length;
            // Near goal for maximize: 80%+ of goal
            daysCloseToGoal = data.filter(d => d.value >= goalMs * 0.8 && d.value < goalMs).length;
        }

        const goalReachedPercent = dates.length > 0 ? Math.round((daysGoalMet / dates.length) * 100) : 0;
        const closeToGoalPercent = dates.length > 0 ? Math.round(((daysGoalMet + daysCloseToGoal) / dates.length) * 100) : 0;
        const nearGoalLabel = isMinimize ? 'Near Goal (≤120%)' : 'Near Goal (80%+)';
        const directionBadge = isMinimize ? '<span class="goal-direction-badge minimize">▼ Min</span>' : '';

        // REQ-9: Session-based analytics
        const sessionAnalytics = this.getSessionAnalytics(sw.id, currentRange);

        // REQ-7: Per-category range selector
        const rangeOptions = [7, 14, 30, 90, 'all'].map(r => {
            const selected = currentRange === r ? 'selected' : '';
            const label = r === 'all' ? 'All Time' : `${r} Days`;
            return `<option value="${r}" ${selected}>${label}</option>`;
        }).join('');

        return `
            <div class="graph-card ${sw.deleted ? 'deleted' : ''}" data-graph-id="${sw.id}">
                <div class="graph-header">
                    <div class="graph-color-indicator" style="background: ${sw.color || '#6366f1'};"></div>
                    <span class="graph-title">${this.escapeHtml(sw.name)}</span>
                    ${directionBadge}
                    ${sw.deleted ? '<span class="graph-deleted-badge">Deleted</span>' : ''}
                    <select class="category-range-select select-input" data-graph-id="${sw.id}" style="margin-left: auto;">
                        ${rangeOptions}
                    </select>
                </div>
                
                <div class="graph-container">
                    ${this.chartType === 'bar'
                ? this.renderBarChart(data, Math.max(...data.map(d => d.value), 1), sw.color || '#6366f1', goalMs, isMinimize)
                : this.renderLineChart(data, Math.max(...data.map(d => d.value), 1), sw.color || '#6366f1', goalMs, isMinimize)}
                    <div class="graph-tooltip" id="tooltip-${sw.id}"></div>
                </div>

                <div class="graph-stats-extended">
                    <div class="graph-stat">
                        <span class="graph-stat-label">Total</span>
                        <span class="graph-stat-value">${formatTimeShort(totalMs)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Average</span>
                        <span class="graph-stat-value">${formatTimeShort(avgMs)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">${isMinimize ? 'Best Day (Min)' : 'Best Day'}</span>
                        <span class="graph-stat-value">${formatTimeShort(bestDayValue)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Goal Reached</span>
                        <span class="graph-stat-value graph-stat-success">${goalReachedPercent}%</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">${nearGoalLabel}</span>
                        <span class="graph-stat-value graph-stat-warning">${closeToGoalPercent}%</span>
                    </div>
                </div>
                
                ${sessionAnalytics.sessionCount > 0 ? `
                <div class="graph-stats-session">
                    <div class="graph-stat">
                        <span class="graph-stat-label">Sessions</span>
                        <span class="graph-stat-value">${sessionAnalytics.sessionCount}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Avg Session</span>
                        <span class="graph-stat-value">${formatTimeShort(sessionAnalytics.avgSessionMs)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Longest</span>
                        <span class="graph-stat-value">${formatTimeShort(sessionAnalytics.longestSessionMs)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Most Active Hour</span>
                        <span class="graph-stat-value">${sessionAnalytics.mostActiveHour}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Most Active Day</span>
                        <span class="graph-stat-value">${sessionAnalytics.mostActiveDay}</span>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * REQ-9: Get session-based analytics for a stopwatch
     */
    getSessionAnalytics(stopwatchId, range) {
        const days = range === 'all' ? 365 : parseInt(range) || 30;
        const sessions = StorageManager.getSessionsForStopwatch(stopwatchId, days)
            .filter(s => s.endTime); // Only completed sessions

        if (sessions.length === 0) {
            return {
                sessionCount: 0,
                avgSessionMs: 0,
                longestSessionMs: 0,
                mostActiveHour: '-',
                mostActiveDay: '-'
            };
        }

        const totalDuration = sessions.reduce((sum, s) => sum + s.durationMs, 0);
        const longestSession = Math.max(...sessions.map(s => s.durationMs));

        // Find most active hour
        const hourlyData = StorageManager.getSessionsByHour(stopwatchId, days);
        const maxHourValue = Math.max(...hourlyData);
        const mostActiveHourIdx = hourlyData.indexOf(maxHourValue);
        const hourLabel = mostActiveHourIdx >= 0 && maxHourValue > 0
            ? `${mostActiveHourIdx}:00`
            : '-';

        // Find most active day
        const weeklyData = StorageManager.getSessionsByDayOfWeek(stopwatchId, days);
        const maxDayValue = Math.max(...weeklyData);
        const mostActiveDayIdx = weeklyData.indexOf(maxDayValue);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayLabel = mostActiveDayIdx >= 0 && maxDayValue > 0
            ? dayNames[mostActiveDayIdx]
            : '-';

        return {
            sessionCount: sessions.length,
            avgSessionMs: Math.round(totalDuration / sessions.length),
            longestSessionMs: longestSession,
            mostActiveHour: hourLabel,
            mostActiveDay: dayLabel
        };
    },

    renderBarChart(data, maxValue, color, goalMs, isMinimize = false) {
        const chartWidth = 700;
        const chartHeight = 150;
        const barPadding = 4;
        const barWidth = (chartWidth / data.length) - barPadding;
        const maxBarHeight = chartHeight - 35;

        // Calculate goal line position
        const goalY = maxValue > 0 ? chartHeight - 25 - (goalMs / maxValue) * maxBarHeight : chartHeight - 25;
        const showGoalLine = goalMs <= maxValue * 1.2; // Only show if goal is within reasonable range

        let bars = '';
        data.forEach((d, i) => {
            const barHeight = maxValue > 0 ? (d.value / maxValue) * maxBarHeight : 0;
            const x = i * (barWidth + barPadding) + barPadding / 2;
            const y = chartHeight - barHeight - 25;

            // Determine goal achievement class based on direction
            let goalClass = 'goal-below';
            if (isMinimize) {
                // For minimize: below or at goal is good
                if (d.value > 0 && d.value <= goalMs) goalClass = 'goal-met';
                else if (d.value <= goalMs * 1.2) goalClass = 'goal-close';
            } else {
                // For maximize: at or above goal is good
                if (d.value >= goalMs) goalClass = 'goal-met';
                else if (d.value >= goalMs * 0.8) goalClass = 'goal-close';
            }

            bars += `
                <rect 
                    class="graph-bar ${goalClass}" 
                    x="${x}" 
                    y="${y}" 
                    width="${barWidth}"
                    height="${barHeight}"
                    rx="4"
                    data-date="${d.date}"
                    data-value="${d.value}"
                    style="fill: ${color};"
                />
            `;
        });

        // Goal line
        let goalLine = '';
        if (showGoalLine && goalMs > 0) {
            goalLine = `
                <line class="goal-line" x1="0" y1="${goalY}" x2="${chartWidth}" y2="${goalY}" />
                <text class="goal-label" x="${chartWidth - 5}" y="${goalY - 5}" text-anchor="end">
                    Goal: ${formatTimeShort(goalMs)}
                </text>
            `;
        }

        // X-axis labels
        let labels = '';
        const labelInterval = this.getXAxisInterval(data.length);
        data.forEach((d, i) => {
            if (i % labelInterval === 0 || i === data.length - 1) {
                const x = i * (barWidth + barPadding) + barPadding / 2 + barWidth / 2;
                labels += `
                    <text class="graph-axis-label" x="${x}" y="${chartHeight - 5}"
                        text-anchor="middle" style="font-size: 11px; fill: #606070;">
                        ${this.formatDateLabel(d.date)}
                    </text>
                `;
            }
        });

        const yAxis = `<line class="graph-axis-line" x1="0" y1="${chartHeight - 25}" x2="${chartWidth}" y2="${chartHeight - 25}" style="stroke: rgba(255,255,255,0.1); stroke-width: 1;" />`;

        return `
            <svg class="graph-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 180px;">
                ${yAxis}
                ${goalLine}
                ${bars}
                ${labels}
            </svg>
        `;
    },

    renderLineChart(data, maxValue, color, goalMs, isMinimize = false) {
        const chartWidth = 700;
        const chartHeight = 150;
        const padding = { top: 10, right: 10, bottom: 25, left: 10 };
        const plotWidth = chartWidth - padding.left - padding.right;
        const plotHeight = chartHeight - padding.top - padding.bottom;

        // Calculate goal line position
        const goalY = maxValue > 0 ? padding.top + plotHeight - (goalMs / maxValue) * plotHeight : padding.top + plotHeight;
        const showGoalLine = goalMs <= maxValue * 1.2;

        // Generate path points
        const points = data.map((d, i) => {
            const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotWidth;
            const y = padding.top + plotHeight - (maxValue > 0 ? (d.value / maxValue) * plotHeight : 0);

            // Goal class based on direction
            let goalClass = 'goal-below';
            if (isMinimize) {
                if (d.value > 0 && d.value <= goalMs) goalClass = 'goal-met';
                else if (d.value <= goalMs * 1.2) goalClass = 'goal-close';
            } else {
                if (d.value >= goalMs) goalClass = 'goal-met';
                else if (d.value >= goalMs * 0.8) goalClass = 'goal-close';
            }

            return { x, y, date: d.date, value: d.value, goalClass };
        });

        // Area fill
        const areaPath = `M ${points[0].x} ${padding.top + plotHeight} ` +
            points.map(p => `L ${p.x} ${p.y}`).join(' ') +
            ` L ${points[points.length - 1].x} ${padding.top + plotHeight} Z`;

        // Line path
        const linePath = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;

        // Data points - REQ-3: Only show marker for the most recent data point
        let circles = '';
        if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            circles = `
                <circle class="graph-point ${lastPoint.goalClass}" 
                    cx="${lastPoint.x}" cy="${lastPoint.y}" r="5" 
                    stroke="${color}"
                    data-date="${lastPoint.date}"
                    data-value="${lastPoint.value}"
                />
            `;
        }

        // Goal line
        let goalLine = '';
        if (showGoalLine && goalMs > 0) {
            goalLine = `
                <line class="goal-line" x1="0" y1="${goalY}" x2="${chartWidth}" y2="${goalY}" />
                <text class="goal-label" x="${chartWidth - 5}" y="${goalY - 5}" text-anchor="end">
                    Goal: ${formatTimeShort(goalMs)}
                </text>
            `;
        }

        // X-axis labels
        let labels = '';
        const labelInterval = this.getXAxisInterval(data.length);
        data.forEach((d, i) => {
            if (i % labelInterval === 0 || i === data.length - 1) {
                const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotWidth;
                labels += `
                    <text class="graph-axis-label" x="${x}" y="${chartHeight - 5}"
                        text-anchor="middle" style="font-size: 11px; fill: #606070;">
                        ${this.formatDateLabel(d.date)}
                    </text>
                `;
            }
        });

        const yAxis = `<line class="graph-axis-line" x1="0" y1="${padding.top + plotHeight}" x2="${chartWidth}" y2="${padding.top + plotHeight}" style="stroke: rgba(255,255,255,0.1); stroke-width: 1;" />`;

        return `
            <svg class="graph-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 180px;">
                ${yAxis}
                ${goalLine}
                <path class="graph-area" d="${areaPath}" fill="${color}" />
                <path class="graph-line" d="${linePath}" stroke="${color}" />
                ${circles}
                ${labels}
            </svg>
        `;
    },

    prepareGraphData(history, dates) {
        return dates.map(date => {
            const record = history.find(h => h.date === date);
            return {
                date,
                value: record ? record.totalMs : 0
            };
        });
    },

    getDateRange(range, stopwatchId = null) {
        const history = StorageManager.getHistory();
        const stopwatches = StorageManager.getStopwatches();
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        let startDate;

        // Get the effective earliest date considering account and category creation
        const accountCreatedAt = StorageManager.getAccountCreatedAt();
        let boundaryDate = accountCreatedAt ? new Date(accountCreatedAt) : new Date();
        boundaryDate.setHours(0, 0, 0, 0);

        // If viewing a specific stopwatch, use its creation date
        if (stopwatchId) {
            const sw = stopwatches.find(s => s.id === stopwatchId);
            if (sw && sw.createdAt) {
                const swCreatedAt = new Date(sw.createdAt);
                swCreatedAt.setHours(0, 0, 0, 0);
                if (swCreatedAt > boundaryDate) {
                    boundaryDate = swCreatedAt;
                }
            }
        } else {
            // For overview, use earliest visible category date
            const visibleStopwatches = this.showDeleted
                ? stopwatches
                : stopwatches.filter(sw => !sw.deleted);

            let earliestCategoryDate = null;
            visibleStopwatches.forEach(sw => {
                if (sw.createdAt) {
                    const swDate = new Date(sw.createdAt);
                    swDate.setHours(0, 0, 0, 0);
                    if (!earliestCategoryDate || swDate < earliestCategoryDate) {
                        earliestCategoryDate = swDate;
                    }
                }
            });

            if (earliestCategoryDate && earliestCategoryDate > boundaryDate) {
                boundaryDate = earliestCategoryDate;
            }
        }

        if (range === 'all') {
            // Find the earliest date (but not before boundary)
            if (history.length === 0) {
                startDate = new Date(boundaryDate);
            } else {
                const earliestHistoryDate = history.reduce((min, h) => {
                    const d = new Date(h.date);
                    return d < min ? d : min;
                }, new Date());
                startDate = earliestHistoryDate < boundaryDate ? boundaryDate : earliestHistoryDate;
            }
        } else {
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - range + 1);
            startDate.setHours(0, 0, 0, 0);

            // Don't go before boundary date
            if (startDate < boundaryDate) {
                startDate = new Date(boundaryDate);
            }
        }

        const dates = [];
        const currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0);

        // REQ-2: Only include dates up to today (no future dates)
        const todayStr = getDateString(new Date());
        while (currentDate <= today) {
            const dateStr = getDateString(currentDate);
            if (dateStr <= todayStr) {
                dates.push(dateStr);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    },

    getXAxisInterval(numDates) {
        if (numDates <= 7) return 1;
        if (numDates <= 14) return 2;
        if (numDates <= 31) return Math.ceil(numDates / 10);
        if (numDates <= 90) return Math.ceil(numDates / 12);
        if (numDates <= 180) return Math.ceil(numDates / 10);
        if (numDates <= 365) return Math.ceil(numDates / 12);
        return Math.ceil(numDates / 15);
    },

    formatDateLabel(dateStr) {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const currentYear = new Date().getFullYear();

        // Include year if not current year
        if (year !== currentYear) {
            return `${month} ${day}, ${year.toString().slice(-2)}`;
        }
        return `${month} ${day}`;
    },

    addTooltipListeners() {
        // Bar and point tooltips for individual graphs
        const elements = this.elements.container.querySelectorAll('.graph-bar, .graph-point');

        elements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const date = element.dataset.date;
                const value = parseInt(element.dataset.value);
                const card = element.closest('.graph-card');
                const tooltip = card?.querySelector('.graph-tooltip');

                if (tooltip) {
                    const formattedDate = new Date(date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                    tooltip.innerHTML = `<strong>${formattedDate}</strong><br>${formatTimeShort(value)}`;
                    tooltip.classList.add('visible');

                    const rect = element.getBoundingClientRect();
                    const containerRect = card.querySelector('.graph-container').getBoundingClientRect();
                    tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
                    tooltip.style.top = `${rect.top - containerRect.top - 45}px`;
                }
            });

            element.addEventListener('mouseleave', () => {
                const card = element.closest('.graph-card');
                const tooltip = card?.querySelector('.graph-tooltip');
                if (tooltip) {
                    tooltip.classList.remove('visible');
                }
            });
        });

        // Overview tooltip
        const overviewPoints = this.elements.globalOverview.querySelectorAll('.graph-point');
        const overviewTooltip = document.getElementById('overview-tooltip');

        overviewPoints.forEach(point => {
            point.addEventListener('mouseenter', (e) => {
                const date = point.dataset.date;
                const value = parseInt(point.dataset.value);
                const category = point.dataset.category;

                if (overviewTooltip) {
                    const formattedDate = new Date(date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                    overviewTooltip.innerHTML = `
                        <strong>${category}</strong><br>
                        ${formattedDate}<br>
                        ${formatTimeShort(value)}
                    `;
                    overviewTooltip.classList.add('visible');

                    const container = this.elements.globalOverview.querySelector('.overview-chart-container');
                    const containerRect = container.getBoundingClientRect();
                    const pointRect = point.getBoundingClientRect();
                    overviewTooltip.style.left = `${pointRect.left - containerRect.left}px`;
                    overviewTooltip.style.top = `${pointRect.top - containerRect.top - 60}px`;
                }
            });

            point.addEventListener('mouseleave', () => {
                if (overviewTooltip) {
                    overviewTooltip.classList.remove('visible');
                }
            });
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // REQ-7: Add event listeners for per-category range selectors
    addCategoryRangeListeners() {
        this.elements.container.querySelectorAll('.category-range-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const graphId = e.target.dataset.graphId;
                const newRange = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
                this.categoryRanges[graphId] = newRange;
                this.render();
            });
        });
    },

    /**
     * Render hourly heatmap for a stopwatch showing when work happens
     */
    renderHourlyHeatmap(stopwatchId, swName, swColor, days = 30) {
        const hourlyData = StorageManager.getSessionsByHour(stopwatchId, days);
        const maxValue = Math.max(...hourlyData, 1);

        const hours = ['12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', '11a',
            '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p'];

        const cells = hourlyData.map((value, hour) => {
            const intensity = maxValue > 0 ? value / maxValue : 0;
            const opacity = 0.1 + (intensity * 0.8);
            return `
                <div class="heatmap-cell" 
                     style="background: ${swColor}; opacity: ${opacity};"
                     title="${hours[hour]}: ${formatTimeShort(value)}">
                </div>
            `;
        }).join('');

        const labels = hours.filter((_, i) => i % 4 === 0).map((h, i) =>
            `<span class="heatmap-hour-label">${h}</span>`
        ).join('');

        return `
            <div class="session-analysis-card">
                <div class="session-analysis-header">
                    <span class="session-analysis-title">Hourly Pattern: ${this.escapeHtml(swName)}</span>
                    <span class="session-analysis-subtitle">Last ${days} days</span>
                </div>
                <div class="heatmap-container">
                    <div class="heatmap-grid">${cells}</div>
                    <div class="heatmap-labels">${labels}</div>
                </div>
            </div>
        `;
    },

    /**
     * Render weekly pattern for a stopwatch
     */
    renderWeeklyPattern(stopwatchId, swName, swColor, days = 30) {
        const weeklyData = StorageManager.getSessionsByDayOfWeek(stopwatchId, days);
        const maxValue = Math.max(...weeklyData, 1);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const bars = weeklyData.map((value, day) => {
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return `
                <div class="weekly-bar-container">
                    <div class="weekly-bar" 
                         style="height: ${height}%; background: ${swColor};"
                         title="${dayNames[day]}: ${formatTimeShort(value)}">
                    </div>
                    <span class="weekly-day-label">${dayNames[day]}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="session-analysis-card">
                <div class="session-analysis-header">
                    <span class="session-analysis-title">Weekly Pattern: ${this.escapeHtml(swName)}</span>
                    <span class="session-analysis-subtitle">Last ${days} days</span>
                </div>
                <div class="weekly-chart">${bars}</div>
            </div>
        `;
    },

    /**
     * Render session analysis section for Waste Time
     */
    renderWasteTimeAnalysis() {
        const WASTE_TIME_ID = 'waste-time-builtin';
        const sessions = StorageManager.getSessionsForStopwatch(WASTE_TIME_ID, 30);

        if (sessions.length === 0) {
            return `
                <div class="session-analysis-empty">
                    <p>No waste time sessions recorded yet. Sessions will appear here as you use the app.</p>
                </div>
            `;
        }

        return `
            <div class="waste-time-analysis">
                <h3 class="analysis-section-title">📊 Waste Time Analysis</h3>
                <div class="analysis-grid">
                    ${this.renderHourlyHeatmap(WASTE_TIME_ID, 'Waste Time', '#ef4444', 30)}
                    ${this.renderWeeklyPattern(WASTE_TIME_ID, 'Waste Time', '#ef4444', 30)}
                </div>
            </div>
        `;
    },

    refresh() {
        this.render();
    }
};

window.GraphsModule = GraphsModule;
