/**
 * App Controller - Main application initialization and coordination
 */

const App = {
    currentSection: 'clock',

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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for global access
window.App = App;
