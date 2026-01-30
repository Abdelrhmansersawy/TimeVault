/**
 * Daily Journal Module - Daily reflection and planning
 * 
 * Features:
 * - Daily entries with routine, plan (from Task Database), done, blocked, tomorrow, reflection
 * - Plan items come from centralized Task Database
 * - Completing items updates both daily and task database
 * - Date navigation for past entries
 * - Auto-save on input change
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
        addPlanBtn: null
    },

    currentDate: null,
    saveTimeout: null,

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

        // Set current date to today
        this.currentDate = new Date();

        // Event listeners
        this.elements.prevBtn?.addEventListener('click', () => this.changeDate(-1));
        this.elements.nextBtn?.addEventListener('click', () => this.changeDate(1));
        this.elements.todayBtn?.addEventListener('click', () => this.goToToday());
        this.elements.addRoutineBtn?.addEventListener('click', () => this.addRoutineItem());
        this.elements.addPlanBtn?.addEventListener('click', () => this.openTaskPickerModal());

        // Auto-save on text input change
        const textInputs = [
            this.elements.blockedInput,
            this.elements.tomorrowInput,
            this.elements.reflectionInput
        ];

        textInputs.forEach(input => {
            input?.addEventListener('input', () => this.scheduleAutoSave());
        });

        // Initial render
        this.render();
    },

    changeDate(delta) {
        this.currentDate.setDate(this.currentDate.getDate() + delta);
        this.render();
    },

    goToToday() {
        this.currentDate = new Date();
        this.render();
    },

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

        // Render lists
        this.renderRoutineList(entry.routine || []);
        this.renderPlanList(entry.plannedTaskIds || []);
        this.renderDoneList(entry.completedTaskIds || []);

        // Populate text fields
        if (this.elements.blockedInput) this.elements.blockedInput.value = entry.blocked || '';
        if (this.elements.tomorrowInput) this.elements.tomorrowInput.value = entry.tomorrow || '';
        if (this.elements.reflectionInput) this.elements.reflectionInput.value = entry.reflection || '';
    },

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

    renderPlanList(taskIds) {
        if (!this.elements.planList) return;

        // Get tasks from centralized database
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

        // Get tasks from centralized database
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
        const priorityColors = { low: '#22c55e', medium: '#eab308', high: '#ef4444' };
        const priorityLabels = { low: 'L', medium: 'M', high: 'H' };
        const isCompleted = listType === 'done';

        // Get stopwatch name
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

        // Tags
        const tagsBadges = (task.tags || []).map(tag =>
            `<span class="checklist-tag">${this.escapeHtml(tag)}</span>`
        ).join('');

        // Subtasks progress
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
        // Complete task
        this.elements.planList?.querySelectorAll('[data-plan-complete]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const taskId = checkbox.dataset.planComplete;
                this.completeTask(taskId);
            });
        });

        // Remove from plan
        this.elements.planList?.querySelectorAll('[data-plan-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.planRemove;
                this.removeFromPlan(taskId);
            });
        });
    },

    // Complete task - update both daily entry and task database
    completeTask(taskId) {
        const dateStr = getDateString(this.currentDate);
        const entry = StorageManager.getDailyEntry(dateStr) || this.getEmptyEntry();

        // Remove from planned, add to completed
        entry.plannedTaskIds = (entry.plannedTaskIds || []).filter(id => id !== taskId);
        entry.completedTaskIds = entry.completedTaskIds || [];
        if (!entry.completedTaskIds.includes(taskId)) {
            entry.completedTaskIds.push(taskId);
        }

        StorageManager.saveDailyEntry(dateStr, entry);

        // Update task status in central database
        StorageManager.updateTask(taskId, { status: 'done' });

        this.render();

        // Refresh Tasks view if it exists
        if (typeof TasksModule !== 'undefined') {
            TasksModule.render();
        }

        App.showToast('Task completed! ✅');
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

    // Open modal to pick tasks from Task Database
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

        // Get available tasks (not done, not already in today's plan)
        const tasks = StorageManager.getTasks().filter(t =>
            t.status !== 'done' &&
            !alreadyPlanned.includes(t.id) &&
            !alreadyDone.includes(t.id)
        );

        if (tasks.length === 0) {
            list.innerHTML = `<p class="task-picker-empty">No available tasks. Create some in the Tasks tab!</p>`;
            return;
        }

        const priorityColors = { low: '#22c55e', medium: '#eab308', high: '#ef4444' };

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
                // Update task status to in-progress
                StorageManager.updateTask(id, { status: 'in-progress' });
            }
        });

        StorageManager.saveDailyEntry(dateStr, entry);
        this.closeTaskPickerModal();
        this.render();

        // Refresh Tasks view
        if (typeof TasksModule !== 'undefined') {
            TasksModule.render();
        }

        App.showToast(`Added ${selected.length} task(s) to plan`);
    },

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
            reflection: ''
        };
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.DailysModule = DailysModule;
