/**
 * App Controller - Main application initialization and coordination
 */

const App = {
    currentSection: 'timelog',

    init() {
        console.log('Time Vault initializing...');

        // Initialize account creation date (for graph boundaries)
        StorageManager.initAccountCreatedAt();

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Process any missed time since last close
        TimeTracker.processOnAppLoad();

        // Initialize all modules
        ClockModule.init();
        AlarmModule.init();
        TimerModule.init();
        StopwatchModule.init();
        AdvancedStopwatchesModule.init();
        TasksModule.init();
        DailysModule.init();
        GraphsModule.init();

        // Set up navigation
        this.setupNavigation();

        // Schedule midnight check
        TimeTracker.scheduleMidnightCheck();

        // Save close time on page unload
        window.addEventListener('beforeunload', () => {
            StorageManager.saveLastCloseTime();
        });

        // Also save periodically
        setInterval(() => {
            StorageManager.saveLastCloseTime();
        }, 60000); // Every minute

        // Set up theme toggle
        this.setupThemeToggle();

        // Set up quick capture
        this.setupQuickCapture();

        // Initialize keyboard shortcuts (handles Ctrl+N and more)
        ShortcutsModule.init();
        ShortcutsModule.renderPanel();

        // Floating settings button
        document.getElementById('settings-toggle')?.addEventListener('click', () => {
            this.navigateTo('settings');
        });

        // Theme toggle in settings
        document.getElementById('theme-toggle-setting')?.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            this.updateThemeIcon(isLight);
        });

        // Shortcuts reset button
        document.getElementById('shortcuts-reset-btn')?.addEventListener('click', () => {
            ShortcutsModule.resetToDefaults();
        });

        console.log('Time Vault initialized successfully!');
    },

    setupThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'dark';

        // Apply saved theme on load
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            this.updateThemeIcon(true);
        }

        toggle?.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            this.updateThemeIcon(isLight);
        });
    },

    updateThemeIcon(isLight) {
        const darkIcon = document.querySelector('.theme-icon-dark');
        const lightIcon = document.querySelector('.theme-icon-light');
        if (darkIcon && lightIcon) {
            darkIcon.style.display = isLight ? 'none' : 'block';
            lightIcon.style.display = isLight ? 'block' : 'none';
        }
    },

    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const section = tab.dataset.section;
                this.navigateTo(section);
            });
        });
    },

    navigateTo(section) {
        this.currentSection = section;

        // Update tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.section === section);
        });

        // Update sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `${section}-section`);
        });

        // Refresh graphs when navigating to that section
        if (section === 'graphs') {
            GraphsModule.render();
        }
    },

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }
    },

    /**
     * Setup global keyboard shortcut for quick task capture
     */
    setupQuickCapture() {
        // Quick capture save button
        document.getElementById('quick-capture-save')?.addEventListener('click', () => {
            this.saveQuickCapture();
        });

        // Enter to save, Escape to close
        document.getElementById('quick-capture-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveQuickCapture();
            if (e.key === 'Escape') this.closeQuickCapture();
        });

        // Close on backdrop click
        document.getElementById('quick-capture-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'quick-capture-overlay') {
                this.closeQuickCapture();
            }
        });
    },

    toggleQuickCapture() {
        const overlay = document.getElementById('quick-capture-overlay');
        if (!overlay) return;

        if (overlay.classList.contains('open')) {
            this.closeQuickCapture();
        } else {
            overlay.classList.add('open');

            // Populate category suggestions
            if (typeof TasksModule !== 'undefined') {
                TasksModule.populateCategorySuggestions('qc-category-suggestions');
            }

            const input = document.getElementById('quick-capture-input');
            input.value = '';
            document.getElementById('quick-capture-category').value = '';
            document.getElementById('quick-capture-priority').value = 'medium';
            setTimeout(() => input?.focus(), 50);
        }
    },

    closeQuickCapture() {
        const overlay = document.getElementById('quick-capture-overlay');
        if (overlay) overlay.classList.remove('open');
    },

    saveQuickCapture() {
        const input = document.getElementById('quick-capture-input');
        const categoryInput = document.getElementById('quick-capture-category');
        const prioritySelect = document.getElementById('quick-capture-priority');

        const title = input?.value.trim();
        if (!title) {
            input?.focus();
            return;
        }

        StorageManager.addTask({
            title,
            category: categoryInput?.value.trim() || '',
            description: '',
            priority: prioritySelect?.value || 'medium',
            status: 'todo',
            tags: [],
            subtasks: [],
            assignedStopwatch: null
        });

        // Refresh Tasks tab
        if (typeof TasksModule !== 'undefined') {
            TasksModule.tasks = StorageManager.getTasks();
            TasksModule.render();
        }

        this.showToast(`Captured: ${title}`);
        this.closeQuickCapture();
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for global access
window.App = App;
