/**
 * Graphs Module - Daily usage graphs and analysis
 * 
 * Features:
 * - Bar charts showing daily stopwatch usage
 * - Charts linked to stopwatch UUID (not name/color)
 * - Toggle to show/hide deleted stopwatch graphs
 * - Statistics and summaries
 */

const GraphsModule = {
    elements: {
        container: null,
        emptyState: null,
        rangeSelect: null,
        showDeletedToggle: null
    },

    showDeleted: false,
    range: 7, // days

    init() {
        this.elements.container = document.getElementById('graphs-container');
        this.elements.emptyState = document.getElementById('no-graphs');
        this.elements.rangeSelect = document.getElementById('graphs-range');
        this.elements.showDeletedToggle = document.getElementById('show-deleted-graphs');

        // Event listeners
        this.elements.rangeSelect?.addEventListener('change', (e) => {
            this.range = parseInt(e.target.value);
            this.render();
        });

        this.elements.showDeletedToggle?.addEventListener('change', (e) => {
            this.showDeleted = e.target.checked;
            this.render();
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
            this.elements.emptyState.style.display = 'flex';
            return;
        }

        this.elements.emptyState.style.display = 'none';

        // Generate date range
        const dates = this.getDateRange(this.range);

        this.elements.container.innerHTML = displayStopwatches.map(sw => {
            const swHistory = history.filter(h => h.stopwatchId === sw.id);
            return this.renderGraphCard(sw, swHistory, dates);
        }).join('');

        // Add tooltip event listeners
        this.addTooltipListeners();
    },

    renderGraphCard(sw, history, dates) {
        const data = this.prepareGraphData(history, dates);
        const maxValue = Math.max(...data.map(d => d.value), 1);
        const totalMs = data.reduce((sum, d) => sum + d.value, 0);
        const avgMs = totalMs / dates.length;

        return `
            <div class="graph-card ${sw.deleted ? 'deleted' : ''}" data-graph-id="${sw.id}">
                <div class="graph-header">
                    <div class="graph-color-indicator" style="background: ${sw.color || '#6366f1'};"></div>
                    <span class="graph-title">${this.escapeHtml(sw.name)}</span>
                    ${sw.deleted ? '<span class="graph-deleted-badge">Deleted</span>' : ''}
                </div>
                
                <div class="graph-container">
                    ${this.renderBarChart(data, maxValue, sw.color || '#6366f1')}
                    <div class="graph-tooltip" id="tooltip-${sw.id}"></div>
                </div>

                <div class="graph-stats">
                    <div class="graph-stat">
                        <span class="graph-stat-label">Total</span>
                        <span class="graph-stat-value">${formatTimeShort(totalMs)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Average</span>
                        <span class="graph-stat-value">${formatTimeShort(avgMs)}</span>
                    </div>
                    <div class="graph-stat">
                        <span class="graph-stat-label">Best Day</span>
                        <span class="graph-stat-value">${formatTimeShort(maxValue)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderBarChart(data, maxValue, color) {
        const chartWidth = 700; // Fixed width for calculations
        const chartHeight = 150;
        const barPadding = 4;
        const barWidth = (chartWidth / data.length) - barPadding;
        const maxBarHeight = chartHeight - 35; // Leave room for labels

        let bars = '';
        data.forEach((d, i) => {
            const barHeight = maxValue > 0 ? (d.value / maxValue) * maxBarHeight : 0;
            const x = i * (barWidth + barPadding) + barPadding / 2;
            const y = chartHeight - barHeight - 25;

            bars += `
                <rect 
                    class="graph-bar" 
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

        // X-axis labels (show every nth label depending on range)
        let labels = '';
        const labelInterval = this.range <= 7 ? 1 : this.range <= 14 ? 2 : 4;
        data.forEach((d, i) => {
            if (i % labelInterval === 0 || i === data.length - 1) {
                const x = i * (barWidth + barPadding) + barPadding / 2 + barWidth / 2;
                const dateLabel = this.formatDateLabel(d.date);
                labels += `
                    <text 
                        class="graph-axis-label" 
                        x="${x}" 
                        y="${chartHeight - 5}"
                        text-anchor="middle"
                        style="font-size: 11px; fill: #606070;"
                    >${dateLabel}</text>
                `;
            }
        });

        // Y-axis line
        const yAxis = `<line class="graph-axis-line" x1="0" y1="${chartHeight - 25}" x2="${chartWidth}" y2="${chartHeight - 25}" style="stroke: rgba(255,255,255,0.1); stroke-width: 1;" />`;

        return `
            <svg class="graph-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 180px;">
                ${yAxis}
                ${bars}
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

    getDateRange(days) {
        const dates = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(getDateString(date));
        }

        return dates;
    },

    formatDateLabel(dateStr) {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' });
        return `${month} ${day}`;
    },

    addTooltipListeners() {
        const bars = this.elements.container.querySelectorAll('.graph-bar');

        bars.forEach(bar => {
            bar.addEventListener('mouseenter', (e) => {
                const date = bar.dataset.date;
                const value = parseInt(bar.dataset.value);
                const card = bar.closest('.graph-card');
                const tooltip = card?.querySelector('.graph-tooltip');

                if (tooltip) {
                    const formattedDate = new Date(date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                    tooltip.innerHTML = `<strong>${formattedDate}</strong><br>${formatTimeShort(value)}`;
                    tooltip.classList.add('visible');

                    // Position tooltip
                    const rect = bar.getBoundingClientRect();
                    const containerRect = card.querySelector('.graph-container').getBoundingClientRect();
                    tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
                    tooltip.style.top = `${rect.top - containerRect.top - 45}px`;
                }
            });

            bar.addEventListener('mouseleave', () => {
                const card = bar.closest('.graph-card');
                const tooltip = card?.querySelector('.graph-tooltip');
                if (tooltip) {
                    tooltip.classList.remove('visible');
                }
            });
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    refresh() {
        // Called when stopwatches are updated
        this.render();
    }
};

window.GraphsModule = GraphsModule;
