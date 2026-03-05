/**
 * Keyboard Shortcuts Module - Customizable global shortcuts
 * 
 * Stores bindings in localStorage. Users can re-bind any action
 * by clicking an action row and pressing the desired key combo.
 */

const ShortcutsModule = {
    // Default key bindings - each action has { key, ctrl, shift, alt, meta }
    defaults: {
        'quick-capture': { label: 'Quick Capture (new task)', key: 'n', ctrl: true, shift: false, alt: false },
        'start-break': { label: 'Start / Stop Break', key: 'b', ctrl: true, shift: true, alt: false },
        'stop-timer': { label: 'Stop Current Timer', key: 's', ctrl: true, shift: true, alt: false },
        'nav-log': { label: 'Go to Log tab', key: '1', ctrl: true, shift: false, alt: false },
        'nav-focus': { label: 'Go to Focus tab', key: '2', ctrl: true, shift: false, alt: false },
        'nav-tasks': { label: 'Go to Tasks tab', key: '3', ctrl: true, shift: false, alt: false },
        'nav-daily': { label: 'Go to Daily tab', key: '4', ctrl: true, shift: false, alt: false },
        'nav-graphs': { label: 'Go to Graphs tab', key: '5', ctrl: true, shift: false, alt: false },
    },

    STORAGE_KEY: 'tv_keyboard_shortcuts',
    bindings: {},
    recordingAction: null,   // Which action is currently being re-bound

    init() {
        this.loadBindings();
        this.setupGlobalListener();
    },

    /**
     * Load saved bindings or use defaults
     */
    loadBindings() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge saved over defaults
                this.bindings = {};
                for (const action in this.defaults) {
                    this.bindings[action] = {
                        ...this.defaults[action],
                        ...(parsed[action] || {})
                    };
                }
            } catch (e) {
                this.bindings = JSON.parse(JSON.stringify(this.defaults));
            }
        } else {
            this.bindings = JSON.parse(JSON.stringify(this.defaults));
        }
    },

    saveBindings() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.bindings));
    },

    /**
     * Format a binding as a human-readable string
     */
    formatBinding(b) {
        const parts = [];
        if (b.ctrl) parts.push('Ctrl');
        if (b.shift) parts.push('Shift');
        if (b.alt) parts.push('Alt');
        if (b.meta) parts.push('Cmd');
        parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key);
        return parts.join(' + ');
    },

    /**
     * Check if a keyboard event matches a binding
     */
    matchesEvent(e, b) {
        return (
            e.key.toLowerCase() === b.key.toLowerCase() &&
            e.ctrlKey === !!b.ctrl &&
            e.shiftKey === !!b.shift &&
            e.altKey === !!b.alt &&
            (e.metaKey === !!b.meta || e.ctrlKey === !!b.ctrl) // Cmd on Mac = Ctrl
        );
    },

    /**
     * Global keyboard listener
     */
    setupGlobalListener() {
        document.addEventListener('keydown', (e) => {
            // If recording a new binding, capture the key
            if (this.recordingAction) {
                e.preventDefault();
                e.stopPropagation();

                // Ignore lone modifier keys
                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                this.bindings[this.recordingAction] = {
                    ...this.bindings[this.recordingAction],
                    key: e.key,
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    alt: e.altKey,
                    meta: e.metaKey
                };
                this.saveBindings();
                this.recordingAction = null;
                this.renderPanel();
                return;
            }

            // Don't trigger shortcuts when typing in inputs
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                // Still allow quick-capture shortcut from inputs
                const qc = this.bindings['quick-capture'];
                if (qc && this.matchesEvent(e, qc)) {
                    e.preventDefault();
                    App.toggleQuickCapture();
                }
                return;
            }

            // Match against all bindings
            for (const action in this.bindings) {
                const b = this.bindings[action];
                if (this.matchesEvent(e, b)) {
                    e.preventDefault();
                    this.executeAction(action);
                    return;
                }
            }
        });
    },

    /**
     * Execute the action for a shortcut
     */
    executeAction(action) {
        switch (action) {
            case 'quick-capture':
                App.toggleQuickCapture();
                break;
            case 'start-break':
                if (typeof DailysModule !== 'undefined') {
                    if (DailysModule.activeTimer && DailysModule.activeTimer.isBreak) {
                        DailysModule.stopCurrentTimer();
                    } else if (DailysModule.activeTimer) {
                        DailysModule.stopCurrentTimer();
                        DailysModule.startBreak();
                    } else {
                        DailysModule.startBreak();
                    }
                }
                break;
            case 'stop-timer':
                if (typeof DailysModule !== 'undefined' && DailysModule.activeTimer) {
                    DailysModule.stopCurrentTimer();
                }
                break;
            case 'nav-log':
                App.navigateTo('timelog');
                break;
            case 'nav-focus':
                App.navigateTo('stopwatches');
                break;
            case 'nav-tasks':
                App.navigateTo('tasks');
                break;
            case 'nav-daily':
                App.navigateTo('dailys');
                break;
            case 'nav-graphs':
                App.navigateTo('graphs');
                break;
        }
    },

    /**
     * Render the shortcuts settings panel
     */
    renderPanel() {
        const container = document.getElementById('shortcuts-list');
        if (!container) return;

        let html = '';
        for (const action in this.bindings) {
            const b = this.bindings[action];
            const isRecording = this.recordingAction === action;

            html += `
                <div class="shortcut-row ${isRecording ? 'recording' : ''}" data-action="${action}">
                    <span class="shortcut-label">${b.label}</span>
                    <button class="shortcut-key-btn" data-rebind="${action}">
                        ${isRecording ? 'Press keys...' : this.formatBinding(b)}
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;

        // Attach rebind listeners
        container.querySelectorAll('[data-rebind]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.rebind;
                this.recordingAction = (this.recordingAction === action) ? null : action;
                this.renderPanel();
            });
        });
    },

    /**
     * Reset all bindings to defaults
     */
    resetToDefaults() {
        this.bindings = JSON.parse(JSON.stringify(this.defaults));
        this.saveBindings();
        this.renderPanel();
        App.showToast('Shortcuts reset to defaults');
    }
};

window.ShortcutsModule = ShortcutsModule;
