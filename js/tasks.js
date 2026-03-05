/**
 * Tasks Module - Task Database with sub-tasks, tags, and priorities
 * 
 * Features:
 * - Centralized task list
 * - Sub-tasks support
 * - Tags and priority levels
 * - Status tracking (todo, in-progress, done)
 * - Stopwatch assignment for time tracking
 */

const TasksModule = {
    elements: {
        container: null,
        tasksList: null,
        emptyState: null,
        addBtn: null,
        modal: null,
        filterStatus: null,
        filterPriority: null
    },

    tasks: [],
    editingTaskId: null,
    currentFilter: { status: 'all', priority: 'all' },

    init() {
        this.elements.container = document.getElementById('tasks-section');
        this.elements.tasksList = document.getElementById('tasks-list');
        this.elements.emptyState = document.getElementById('no-tasks');
        this.elements.addBtn = document.getElementById('add-task-btn');
        this.elements.modal = document.getElementById('task-modal');
        this.elements.filterStatus = document.getElementById('filter-status');
        this.elements.filterPriority = document.getElementById('filter-priority');

        // Load tasks
        this.tasks = StorageManager.getTasks();

        // Event listeners
        this.elements.addBtn?.addEventListener('click', () => this.openModal());

        // Modal events
        const saveBtn = document.getElementById('save-task-btn');
        const deleteBtn = document.getElementById('delete-task-btn');
        saveBtn?.addEventListener('click', () => this.saveTask());
        deleteBtn?.addEventListener('click', () => this.deleteTask());

        // Modal close
        this.elements.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        this.elements.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Filters
        this.elements.filterStatus?.addEventListener('change', () => {
            this.currentFilter.status = this.elements.filterStatus.value;
            this.render();
        });
        this.elements.filterPriority?.addEventListener('change', () => {
            this.currentFilter.priority = this.elements.filterPriority.value;
            this.render();
        });

        // Subtask add button
        document.getElementById('add-subtask-btn')?.addEventListener('click', () => this.addSubtaskInput());

        // Initial render
        this.render();
    },

    render() {
        if (!this.elements.tasksList) return;

        this.tasks = StorageManager.getTasks();

        // Apply filters
        let filtered = this.tasks;
        if (this.currentFilter.status !== 'all') {
            filtered = filtered.filter(t => t.status === this.currentFilter.status);
        }
        if (this.currentFilter.priority !== 'all') {
            filtered = filtered.filter(t => t.priority === this.currentFilter.priority);
        }

        // Sort: in-progress first, then todo, then done
        const statusOrder = { 'in-progress': 0, 'todo': 1, 'done': 2 };
        filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        if (filtered.length === 0) {
            this.elements.tasksList.innerHTML = '';
            this.elements.tasksList.style.display = 'none';
            if (this.elements.emptyState) this.elements.emptyState.style.display = 'flex';
            return;
        }

        this.elements.tasksList.style.display = 'grid';
        if (this.elements.emptyState) this.elements.emptyState.style.display = 'none';

        this.elements.tasksList.innerHTML = filtered.map(task => this.renderTaskCard(task)).join('');
        this.addTaskCardListeners();
    },

    renderTaskCard(task) {
        const priorityColors = {
            low: '#22c55e',
            medium: '#eab308',
            high: '#ef4444'
        };
        const priorityLabels = { low: 'Low', medium: 'Med', high: 'High' };

        return `
            <div class="task-card ${task.status}" data-task-id="${task.id}">
                <div class="task-header">
                    <span class="task-priority" style="background: ${priorityColors[task.priority]}">${priorityLabels[task.priority]}</span>
                    ${task.category ? `<span class="task-category-badge">${this.escapeHtml(task.category)}</span>` : ''}
                </div>
                <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                <div class="task-actions">
                    ${task.status !== 'in-progress' ? `
                        <button class="btn btn-sm btn-primary" data-start-task="${task.id}">
                            ${task.status === 'todo' ? 'Start' : 'Restart'}
                        </button>
                    ` : ''}
                    ${task.status === 'in-progress' ? `
                        <button class="btn btn-sm btn-success" data-complete-task="${task.id}">Complete</button>
                    ` : ''}
                    <button class="btn btn-sm btn-ghost" data-edit-task="${task.id}">Edit</button>
                </div>
            </div>
        `;
    },

    addTaskCardListeners() {
        // Start task
        this.elements.tasksList.querySelectorAll('[data-start-task]').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.startTask;
                StorageManager.updateTask(taskId, { status: 'in-progress' });
                this.render();
                App.showToast('Task started');
            });
        });

        // Complete task
        this.elements.tasksList.querySelectorAll('[data-complete-task]').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.completeTask;
                StorageManager.updateTask(taskId, { status: 'done' });
                this.render();
                App.showToast('Task completed! 🎉');
            });
        });

        // Edit task
        this.elements.tasksList.querySelectorAll('[data-edit-task]').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.editTask;
                this.openModal(taskId);
            });
        });
    },

    openModal(taskId = null) {
        this.editingTaskId = taskId;

        const titleInput = document.getElementById('task-title');
        const categoryInput = document.getElementById('task-category');
        const descInput = document.getElementById('task-description');
        const prioritySelect = document.getElementById('task-priority');
        const statusSelect = document.getElementById('task-status');
        const tagsInput = document.getElementById('task-tags');
        const stopwatchSelect = document.getElementById('task-stopwatch');
        const subtasksList = document.getElementById('subtasks-list');
        const modalTitle = document.getElementById('task-modal-title');
        const saveBtn = document.getElementById('save-task-btn');
        const deleteBtn = document.getElementById('delete-task-btn');

        // Populate category suggestions from existing tasks
        this.populateCategorySuggestions();

        // Populate stopwatch dropdown
        if (stopwatchSelect) {
            const stopwatches = StorageManager.getStopwatches().filter(s => !s.deleted);
            stopwatchSelect.innerHTML = `
                <option value="">None</option>
                ${stopwatches.map(sw => `
                    <option value="${sw.id}">${this.escapeHtml(sw.name)}</option>
                `).join('')}
            `;
        }

        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                modalTitle.textContent = 'Edit Task';
                titleInput.value = task.title;
                if (categoryInput) categoryInput.value = task.category || '';
                descInput.value = task.description || '';
                prioritySelect.value = task.priority;
                statusSelect.value = task.status;
                tagsInput.value = task.tags.join(', ');
                stopwatchSelect.value = task.assignedStopwatch || '';

                // Render subtasks
                this.renderSubtasksEditor(task.subtasks);

                saveBtn.textContent = 'Save';
                deleteBtn.style.display = 'inline-flex';
            }
        } else {
            modalTitle.textContent = 'New Task';
            titleInput.value = '';
            if (categoryInput) categoryInput.value = '';
            descInput.value = '';
            prioritySelect.value = 'medium';
            statusSelect.value = 'todo';
            tagsInput.value = '';
            stopwatchSelect.value = '';
            subtasksList.innerHTML = '';

            saveBtn.textContent = 'Create';
            deleteBtn.style.display = 'none';
        }

        this.elements.modal.classList.add('open');
    },

    closeModal() {
        this.elements.modal.classList.remove('open');
        this.editingTaskId = null;
    },

    renderSubtasksEditor(subtasks = []) {
        const list = document.getElementById('subtasks-list');
        if (!list) return;

        list.innerHTML = subtasks.map((st, i) => `
            <div class="subtask-input-row" data-subtask-index="${i}">
                <input type="checkbox" ${st.completed ? 'checked' : ''} data-subtask-check="${i}">
                <input type="text" class="form-input subtask-text" value="${this.escapeHtml(st.text)}" data-subtask-text="${i}">
                <button class="btn btn-icon btn-ghost" data-remove-subtask="${i}">×</button>
            </div>
        `).join('');

        // Add listeners
        list.querySelectorAll('[data-remove-subtask]').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.subtask-input-row').remove();
            });
        });
    },

    addSubtaskInput() {
        const list = document.getElementById('subtasks-list');
        if (!list) return;

        const index = list.children.length;
        const row = document.createElement('div');
        row.className = 'subtask-input-row';
        row.dataset.subtaskIndex = index;
        row.innerHTML = `
            <input type="checkbox" data-subtask-check="${index}">
            <input type="text" class="form-input subtask-text" placeholder="Subtask..." data-subtask-text="${index}">
            <button class="btn btn-icon btn-ghost" data-remove-subtask="${index}">×</button>
        `;

        row.querySelector('[data-remove-subtask]').addEventListener('click', () => row.remove());
        list.appendChild(row);

        // Focus the new input
        row.querySelector('.subtask-text').focus();
    },

    saveTask() {
        const titleInput = document.getElementById('task-title');
        const categoryInput = document.getElementById('task-category');
        const descInput = document.getElementById('task-description');
        const prioritySelect = document.getElementById('task-priority');
        const statusSelect = document.getElementById('task-status');
        const tagsInput = document.getElementById('task-tags');
        const stopwatchSelect = document.getElementById('task-stopwatch');
        const subtasksList = document.getElementById('subtasks-list');

        const title = titleInput.value.trim();
        if (!title) {
            App.showToast('Please enter a task title');
            return;
        }

        // Collect subtasks
        const subtasks = [];
        subtasksList.querySelectorAll('.subtask-input-row').forEach(row => {
            const text = row.querySelector('.subtask-text').value.trim();
            const completed = row.querySelector('[data-subtask-check]').checked;
            if (text) {
                subtasks.push({
                    id: generateId(),
                    text,
                    completed
                });
            }
        });

        // Parse tags
        const tags = tagsInput.value.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const taskData = {
            title,
            category: categoryInput ? categoryInput.value.trim() : '',
            description: descInput.value.trim(),
            priority: prioritySelect.value,
            status: statusSelect.value,
            tags,
            subtasks,
            assignedStopwatch: stopwatchSelect.value || null
        };

        if (this.editingTaskId) {
            StorageManager.updateTask(this.editingTaskId, taskData);
            App.showToast('Task updated');
        } else {
            StorageManager.addTask(taskData);
            App.showToast('Task created');
        }

        this.closeModal();
        this.render();
    },

    /**
     * Populate category suggestions datalist from existing tasks
     */
    populateCategorySuggestions(targetId = 'category-suggestions') {
        const datalist = document.getElementById(targetId);
        if (!datalist) return;

        const tasks = StorageManager.getTasks();
        const categories = [...new Set(
            tasks.map(t => t.category).filter(c => c && c.trim())
        )];

        datalist.innerHTML = categories.map(c =>
            `<option value="${this.escapeHtml(c)}"></option>`
        ).join('');
    },

    deleteTask() {
        if (!this.editingTaskId) return;

        if (confirm('Delete this task?')) {
            StorageManager.deleteTask(this.editingTaskId);
            this.closeModal();
            this.render();
            App.showToast('Task deleted');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.TasksModule = TasksModule;
