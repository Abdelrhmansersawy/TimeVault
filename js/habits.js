/**
 * Habits Module - Loop Habit Tracker inspired habit tracking
 */

const HabitsModule = {
    elements: {},
    habits: [],
    viewDays: 7,

    init() {
        this.elements.container = document.getElementById('habits-section');
        this.elements.list = document.getElementById('habits-list');
        this.elements.addBtn = document.getElementById('add-habit-btn');
        this.elements.modal = document.getElementById('habit-modal');

        this.habits = StorageManager.getHabits();

        this.elements.addBtn?.addEventListener('click', () => this.openModal());

        document.getElementById('save-habit-btn')?.addEventListener('click', () => this.saveHabit());
        document.getElementById('delete-habit-btn')?.addEventListener('click', () => this.deleteHabit());

        this.elements.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        this.elements.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Color presets in habit modal
        this.elements.modal?.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                const colorInput = document.getElementById('habit-color');
                if (colorInput) colorInput.value = color;
                this.elements.modal.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        document.getElementById('habits-view-range')?.addEventListener('change', (e) => {
            this.viewDays = parseInt(e.target.value, 10);
            this.render();
        });

        this.render();
    },

    render() {
        if (!this.elements.list) return;
        this.habits = StorageManager.getHabits();

        if (this.habits.length === 0) {
            this.elements.list.innerHTML = `
                <div class="habits-empty">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <p>No habits yet</p>
                    <p class="habits-empty-hint">Start building good habits by clicking "+ New Habit"</p>
                </div>`;
            return;
        }

        const dates = this.getDateRange(this.viewDays);
        const today = getDateString();

        let html = `
            <div class="habits-header-row">
                <div class="habits-name-col">Habit</div>
                <div class="habits-dates-col">
                    ${dates.map(d => {
                        const day = new Date(d + 'T00:00:00');
                        const label = d === today ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' });
                        const num = day.getDate();
                        return `<div class="habits-date-header ${d === today ? 'today' : ''}">
                            <span class="habits-date-day">${label}</span>
                            <span class="habits-date-num">${num}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div class="habits-streak-col">Streak</div>
            </div>`;

        this.habits.forEach(habit => {
            const streak = this.calculateStreak(habit);
            const completions = habit.completions || [];

            html += `
                <div class="habit-row" data-habit-id="${habit.id}">
                    <div class="habit-name-cell" data-edit-habit="${habit.id}">
                        <span class="habit-color-dot" style="background:${habit.color}"></span>
                        <span class="habit-name">${this.escapeHtml(habit.name)}</span>
                    </div>
                    <div class="habit-checks-cell">
                        ${dates.map(d => {
                            const done = completions.includes(d);
                            return `<button class="habit-check-btn ${done ? 'checked' : ''}"
                                        data-toggle-habit="${habit.id}" data-toggle-date="${d}"
                                        style="--habit-color:${habit.color}">
                                ${done
                                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`
                                    : `<span class="habit-empty-dot"></span>`
                                }
                            </button>`;
                        }).join('')}
                    </div>
                    <div class="habit-streak-cell">
                        <span class="habit-streak-num">${streak}</span>
                        <span class="habit-streak-fire">${streak >= 3 ? '🔥' : ''}</span>
                    </div>
                </div>`;
        });

        this.elements.list.innerHTML = html;
        this.bindEvents();
    },

    bindEvents() {
        this.elements.list.querySelectorAll('[data-toggle-habit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const habitId = btn.dataset.toggleHabit;
                const date = btn.dataset.toggleDate;
                StorageManager.toggleHabitCompletion(habitId, date);
                this.render();
            });
        });

        this.elements.list.querySelectorAll('[data-edit-habit]').forEach(el => {
            el.addEventListener('click', () => {
                this.openModal(el.dataset.editHabit);
            });
        });
    },

    getDateRange(days) {
        const dates = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(getDateString(d));
        }
        return dates;
    },

    calculateStreak(habit) {
        const completions = new Set(habit.completions || []);
        let streak = 0;
        const d = new Date();

        if (!completions.has(getDateString(d))) {
            d.setDate(d.getDate() - 1);
        }

        while (completions.has(getDateString(d))) {
            streak++;
            d.setDate(d.getDate() - 1);
        }
        return streak;
    },

    editingHabitId: null,

    openModal(habitId = null) {
        this.editingHabitId = habitId;

        const nameInput = document.getElementById('habit-name');
        const colorInput = document.getElementById('habit-color');
        const freqSelect = document.getElementById('habit-frequency');
        const modalTitle = document.getElementById('habit-modal-title');
        const saveBtn = document.getElementById('save-habit-btn');
        const deleteBtn = document.getElementById('delete-habit-btn');

        if (habitId) {
            const habit = this.habits.find(h => h.id === habitId);
            if (habit) {
                modalTitle.textContent = 'Edit Habit';
                nameInput.value = habit.name;
                colorInput.value = habit.color;
                freqSelect.value = habit.frequency || 'daily';
                saveBtn.textContent = 'Save';
                deleteBtn.style.display = 'inline-flex';
            }
        } else {
            modalTitle.textContent = 'New Habit';
            nameInput.value = '';
            colorInput.value = '#7f6df2';
            freqSelect.value = 'daily';
            saveBtn.textContent = 'Create';
            deleteBtn.style.display = 'none';
        }

        this.elements.modal.classList.add('open');
        nameInput.focus();
    },

    closeModal() {
        this.elements.modal.classList.remove('open');
        this.editingHabitId = null;
    },

    saveHabit() {
        const nameInput = document.getElementById('habit-name');
        const colorInput = document.getElementById('habit-color');
        const freqSelect = document.getElementById('habit-frequency');

        const name = nameInput.value.trim();
        if (!name) {
            App.showToast('Enter a habit name');
            nameInput.focus();
            return;
        }

        if (this.editingHabitId) {
            StorageManager.updateHabit(this.editingHabitId, {
                name,
                color: colorInput.value,
                frequency: freqSelect.value
            });
            App.showToast('Habit updated');
        } else {
            StorageManager.addHabit({
                id: generateId(),
                name,
                color: colorInput.value,
                frequency: freqSelect.value,
                completions: [],
                createdAt: Date.now()
            });
            App.showToast('Habit created');
        }

        this.closeModal();
        this.render();
    },

    deleteHabit() {
        if (!this.editingHabitId) return;
        if (confirm('Delete this habit and all its history?')) {
            StorageManager.deleteHabit(this.editingHabitId);
            this.closeModal();
            this.render();
            App.showToast('Habit deleted');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.HabitsModule = HabitsModule;
