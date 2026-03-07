/**
 * Tasks Module - Google Tasks-style board grouped by stopwatch
 */

const TasksModule = {
    elements: {
        container: null,
        board: null,
        addBtn: null,
        modal: null,
    },

    tasks: [],
    editingTaskId: null,
    collapsedCompleted: {},  // { stopwatchId: bool }
    selectedTags: [],        // tags selected in modal

    init() {
        this.elements.container = document.getElementById('tasks-section');
        this.elements.board = document.getElementById('tasks-board');
        this.elements.addBtn = document.getElementById('add-task-btn');
        this.elements.modal = document.getElementById('task-modal');

        this.tasks = StorageManager.getTasks();

        this.elements.addBtn?.addEventListener('click', () => this.openModal());

        const saveBtn = document.getElementById('save-task-btn');
        const deleteBtn = document.getElementById('delete-task-btn');
        saveBtn?.addEventListener('click', () => this.saveTask());
        deleteBtn?.addEventListener('click', () => this.deleteTask());

        this.elements.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        this.elements.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        document.getElementById('add-tag-btn')?.addEventListener('click', () => this.addTagFromInput());
        document.getElementById('task-tag-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.addTagFromInput(); }
        });

        this.render();
    },

    render() {
        if (!this.elements.board) return;
        this.tasks = StorageManager.getTasks();

        const stopwatches = StorageManager.getStopwatches().filter(
            s => !s.deleted && s.id !== 'waste-time-builtin' && !s.isBuiltIn
        );

        if (stopwatches.length === 0 && this.tasks.length === 0) {
            this.elements.board.innerHTML = `
                <div class="board-empty">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                    <p>Create focus stopwatches to start organizing tasks</p>
                </div>`;
            return;
        }

        const grouped = {};
        stopwatches.forEach(sw => { grouped[sw.id] = { sw, tasks: [] }; });

        const ungrouped = [];
        this.tasks.forEach(task => {
            if (task.assignedStopwatch && grouped[task.assignedStopwatch]) {
                grouped[task.assignedStopwatch].tasks.push(task);
            } else {
                ungrouped.push(task);
            }
        });

        // Apply saved column order
        const savedOrder = this.getColumnOrder();
        let ordered = stopwatches;
        if (savedOrder) {
            ordered = savedOrder
                .filter(id => grouped[id])
                .map(id => grouped[id].sw);
            // Append any new stopwatches not yet in the order
            stopwatches.forEach(sw => {
                if (!savedOrder.includes(sw.id)) ordered.push(sw);
            });
        }

        let html = '';
        ordered.forEach(sw => {
            html += this.renderColumn(sw, grouped[sw.id].tasks);
        });
        if (ungrouped.length > 0) {
            html += this.renderColumn({ id: '__ungrouped', name: 'Unassigned', color: '#888' }, ungrouped);
        }

        this.elements.board.innerHTML = html;
        this.bindBoardEvents();
    },

    renderColumn(sw, tasks) {
        const active = tasks.filter(t => t.status !== 'done');
        const completed = tasks.filter(t => t.status === 'done');
        const isCollapsed = this.collapsedCompleted[sw.id] !== false; // default collapsed

        const dotStyle = `background:${sw.color}`;

        let tasksHtml = '';
        if (active.length === 0 && completed.length === 0) {
            tasksHtml = `
                <div class="board-col-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.25">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    <span>No tasks yet</span>
                    <span class="board-col-empty-hint">Click "+" above to add a new task</span>
                </div>`;
        } else {
            tasksHtml = active.map(t => this.renderTaskItem(t, sw)).join('');
        }

        let completedHtml = '';
        if (completed.length > 0) {
            completedHtml = `
                <div class="board-completed-toggle" data-toggle-completed="${sw.id}">
                    <span>Completed (${completed.length})</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="${isCollapsed ? '' : 'rotated'}">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
                <div class="board-completed-list ${isCollapsed ? 'collapsed' : ''}">
                    ${completed.map(t => this.renderTaskItem(t, sw, true)).join('')}
                </div>`;
        }

        return `
            <div class="board-col" data-col-sw="${sw.id}" draggable="true">
                <div class="board-col-header" data-col-drag-handle="${sw.id}">
                    <div class="board-col-title">
                        <span class="board-col-dot" style="${dotStyle}"></span>
                        <span>${this.escapeHtml(sw.name)}</span>
                    </div>
                    <button class="board-col-menu" data-col-menu="${sw.id}" title="Options">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                        </svg>
                    </button>
                </div>
                <button class="board-add-task" data-add-in-col="${sw.id}">
                    <span class="board-add-icon" style="color:${sw.color}">+</span>
                    <span>Add a task</span>
                </button>
                <div class="board-col-tasks" data-drop-zone="${sw.id}">
                    ${tasksHtml}
                </div>
                ${completedHtml}
            </div>`;
    },

    renderTaskItem(task, sw, isDone = false) {
        const tagsHtml = (task.tags && task.tags.length > 0)
            ? `<div class="board-task-tags">${task.tags.map(t =>
                `<span class="board-tag">${this.escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        const desc = task.description
            ? `<div class="board-task-desc">${this.escapeHtml(task.description)}</div>`
            : '';

        const priorityDot = !isDone
            ? `<span class="board-task-priority board-task-priority--${task.priority}"></span>`
            : '';

        return `
            <div class="board-task ${isDone ? 'board-task--done' : ''}" data-task-id="${task.id}"
                 draggable="true">
                <button class="board-task-check ${isDone ? 'checked' : ''}" data-check-task="${task.id}">
                    ${isDone
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`
                : `<span class="board-task-circle" style="border-color:${sw.color}"></span>`
            }
                </button>
                <div class="board-task-body" data-edit-task="${task.id}">
                    <div class="board-task-title-row">
                        ${priorityDot}
                        <span class="board-task-title ${isDone ? 'struck' : ''}">${this.escapeHtml(task.title)}</span>
                    </div>
                    ${desc}
                    ${tagsHtml}
                </div>
            </div>`;
    },

    bindBoardEvents() {
        const board = this.elements.board;

        // Add task in column
        board.querySelectorAll('[data-add-in-col]').forEach(btn => {
            btn.addEventListener('click', () => {
                const swId = btn.dataset.addInCol;
                this.openModal(null, swId);
            });
        });

        // Toggle completed
        board.querySelectorAll('[data-toggle-completed]').forEach(btn => {
            btn.addEventListener('click', () => {
                const swId = btn.dataset.toggleCompleted;
                this.collapsedCompleted[swId] = !(this.collapsedCompleted[swId] !== false);
                this.render();
            });
        });

        // Check/uncheck task
        board.querySelectorAll('[data-check-task]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.checkTask;
                const task = this.tasks.find(t => t.id === id);
                if (task) {
                    const newStatus = task.status === 'done' ? 'todo' : 'done';
                    StorageManager.updateTask(id, { status: newStatus });
                    this.render();

                    // Auto-stop active timer if the completed task was running
                    if (newStatus === 'done' && typeof DailysModule !== 'undefined' &&
                        DailysModule.activeTimer && DailysModule.activeTimer.taskName === task.title) {
                        DailysModule.stopCurrentTimer();
                    }
                }
            });
        });

        // Edit task
        board.querySelectorAll('[data-edit-task]').forEach(el => {
            el.addEventListener('click', () => {
                this.openModal(el.dataset.editTask);
            });
        });

        this.bindDragDrop(board);
    },

    // ============================================
    // Drag & Drop
    // ============================================

    _dragType: null,
    _dragId: null,

    bindDragDrop(board) {
        // Task drag
        board.querySelectorAll('.board-task[draggable]').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                this._dragType = 'task';
                this._dragId = el.dataset.taskId;
                e.dataTransfer.effectAllowed = 'move';
                el.classList.add('dragging');
            });
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                board.querySelectorAll('.drag-over').forEach(z => z.classList.remove('drag-over'));
                this._dragType = null;
                this._dragId = null;
            });
        });

        // Drop zones (column task areas)
        board.querySelectorAll('[data-drop-zone]').forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                if (this._dragType !== 'task') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                if (this._dragType !== 'task' || !this._dragId) return;
                const targetSw = zone.dataset.dropZone;
                StorageManager.updateTask(this._dragId, { assignedStopwatch: targetSw });
                this.render();
                App.showToast('Task moved');
            });
        });

        // Column drag & drop for reordering
        const cols = board.querySelectorAll('.board-col[draggable]');
        cols.forEach(col => {
            const handle = col.querySelector('[data-col-drag-handle]');
            // Only allow column dragging from header
            col.addEventListener('dragstart', (e) => {
                if (this._dragType === 'task') return;
                if (!e.target.closest('[data-col-drag-handle]') && e.target !== col) {
                    e.preventDefault();
                    return;
                }
                this._dragType = 'column';
                this._dragId = col.dataset.colSw;
                e.dataTransfer.effectAllowed = 'move';
                col.classList.add('col-dragging');
            });
            col.addEventListener('dragend', () => {
                col.classList.remove('col-dragging');
                board.querySelectorAll('.col-drop-target').forEach(c => c.classList.remove('col-drop-target'));
                this._dragType = null;
                this._dragId = null;
            });
            col.addEventListener('dragover', (e) => {
                if (this._dragType !== 'column') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('col-drop-target');
            });
            col.addEventListener('dragleave', () => {
                col.classList.remove('col-drop-target');
            });
            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('col-drop-target');
                if (this._dragType !== 'column' || !this._dragId) return;

                const fromId = this._dragId;
                const toId = col.dataset.colSw;
                if (fromId === toId) return;

                this.reorderColumns(fromId, toId);
            });
        });
    },

    columnOrder: null,

    getColumnOrder() {
        if (!this.columnOrder) {
            const saved = localStorage.getItem('boardColumnOrder');
            this.columnOrder = saved ? JSON.parse(saved) : null;
        }
        return this.columnOrder;
    },

    reorderColumns(fromId, toId) {
        const stopwatches = StorageManager.getStopwatches().filter(
            s => !s.deleted && s.id !== 'waste-time-builtin' && !s.isBuiltIn
        );
        let order = this.getColumnOrder() || stopwatches.map(s => s.id);

        const fromIdx = order.indexOf(fromId);
        const toIdx = order.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1) return;

        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, fromId);

        this.columnOrder = order;
        localStorage.setItem('boardColumnOrder', JSON.stringify(order));
        this.render();
    },

    // ============================================
    // Modal
    // ============================================

    openModal(taskId = null, presetStopwatch = null) {
        this.editingTaskId = taskId;

        const titleInput = document.getElementById('task-title');
        const descInput = document.getElementById('task-description');
        const prioritySelect = document.getElementById('task-priority');
        const statusSelect = document.getElementById('task-status');
        const stopwatchSelect = document.getElementById('task-stopwatch');
        const modalTitle = document.getElementById('task-modal-title');
        const saveBtn = document.getElementById('save-task-btn');
        const deleteBtn = document.getElementById('delete-task-btn');

        // Populate stopwatch dropdown
        if (stopwatchSelect) {
            const stopwatches = StorageManager.getStopwatches().filter(
                s => !s.deleted && s.id !== 'waste-time-builtin' && !s.isBuiltIn
            );
            stopwatchSelect.innerHTML = `
                <option value="">— Select stopwatch —</option>
                ${stopwatches.map(sw => `
                    <option value="${sw.id}" data-color="${sw.color}">${this.escapeHtml(sw.name)}</option>
                `).join('')}`;
        }

        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                modalTitle.textContent = 'Edit Task';
                titleInput.value = task.title;
                descInput.value = task.description || '';
                prioritySelect.value = task.priority;
                statusSelect.value = task.status;
                stopwatchSelect.value = task.assignedStopwatch || '';
                this.selectedTags = [...(task.tags || [])];

                saveBtn.textContent = 'Save';
                deleteBtn.style.display = 'inline-flex';
            }
        } else {
            modalTitle.textContent = 'New Task';
            titleInput.value = '';
            descInput.value = '';
            prioritySelect.value = 'medium';
            statusSelect.value = 'todo';
            stopwatchSelect.value = presetStopwatch || '';
            this.selectedTags = [];

            saveBtn.textContent = 'Create';
            deleteBtn.style.display = 'none';
        }

        this.renderTagPicker();
        this.elements.modal.classList.add('open');
        titleInput.focus();
    },

    closeModal() {
        this.elements.modal.classList.remove('open');
        this.editingTaskId = null;
        this.selectedTags = [];
    },

    // ============================================
    // Tag Picker
    // ============================================

    renderTagPicker() {
        const container = document.getElementById('task-tags-list');
        if (!container) return;

        const allTags = StorageManager.getTags();
        const selected = this.selectedTags;

        let html = '';
        const combined = [...new Set([...allTags, ...selected])];
        combined.forEach(tag => {
            const isActive = selected.includes(tag);
            html += `<button type="button" class="tag-chip ${isActive ? 'tag-chip--active' : ''}"
                        data-tag-toggle="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</button>`;
        });
        container.innerHTML = html;

        container.querySelectorAll('[data-tag-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tagToggle;
                const idx = this.selectedTags.indexOf(tag);
                if (idx >= 0) {
                    this.selectedTags.splice(idx, 1);
                } else {
                    this.selectedTags.push(tag);
                }
                this.renderTagPicker();
            });
        });
    },

    addTagFromInput() {
        const input = document.getElementById('task-tag-input');
        const tag = input.value.trim();
        if (!tag) return;

        StorageManager.addTag(tag);
        if (!this.selectedTags.includes(tag)) {
            this.selectedTags.push(tag);
        }
        input.value = '';
        this.renderTagPicker();
        input.focus();
    },

    saveTask() {
        const titleInput = document.getElementById('task-title');
        const descInput = document.getElementById('task-description');
        const prioritySelect = document.getElementById('task-priority');
        const statusSelect = document.getElementById('task-status');
        const stopwatchSelect = document.getElementById('task-stopwatch');

        const title = titleInput.value.trim();
        if (!title) {
            App.showToast('Please enter a task title');
            return;
        }

        if (!stopwatchSelect.value) {
            App.showToast('Please assign a focus stopwatch');
            stopwatchSelect.focus();
            return;
        }

        const taskData = {
            title,
            category: '',
            description: descInput.value.trim(),
            priority: prioritySelect.value,
            status: statusSelect.value,
            tags: [...this.selectedTags],
            subtasks: [],
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

    deleteTask() {
        if (!this.editingTaskId) return;
        if (confirm('Delete this task?')) {
            StorageManager.deleteTask(this.editingTaskId);
            this.closeModal();
            this.render();
            App.showToast('Task deleted');
        }
    },

    // ============================================
    // Helpers
    // ============================================

    populateStopwatchSelect(selectId, currentValue) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const stopwatches = StorageManager.getStopwatches().filter(
            s => !s.deleted && s.id !== 'waste-time-builtin' && !s.isBuiltIn
        );

        const placeholder = select.options[0]?.text || '— Select stopwatch —';
        select.innerHTML = `
            <option value="">${placeholder}</option>
            ${stopwatches.map(sw => `
                <option value="${sw.id}" ${sw.id === currentValue ? 'selected' : ''}
                    style="color: ${sw.color}">
                    ${this.escapeHtml(sw.name)}
                </option>
            `).join('')}`;
    },

    populateCategorySuggestions() { /* noop - kept for compat */ },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.TasksModule = TasksModule;
