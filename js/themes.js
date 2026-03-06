/**
 * Theme Manager - Multiple theme presets with customization + user-saved themes
 */

const ThemeManager = {
    STORAGE_KEY: 'themePreset',
    CUSTOM_KEY: 'themeCustom',
    USER_THEMES_KEY: 'themeUserPresets',

    presets: {
        'obsidian-dark': {
            name: 'Obsidian',
            type: 'dark',
            colors: {
                '--color-bg-primary': '#1e1e1e',
                '--color-bg-secondary': '#252525',
                '--color-bg-tertiary': '#2e2e2e',
                '--color-bg-card': '#252525',
                '--color-bg-card-hover': '#2a2a2a',
                '--color-text-primary': '#dcddde',
                '--color-text-secondary': '#999999',
                '--color-text-muted': '#666666',
                '--color-accent': '#7f6df2',
                '--color-accent-light': '#9b8afb',
                '--color-accent-dark': '#6c5ce7',
                '--color-success': '#4dba87',
                '--color-warning': '#e0a458',
                '--color-danger': '#e05561',
                '--color-border': '#363636',
                '--color-border-focus': 'rgba(127, 109, 242, 0.5)',
                '--gradient-primary': '#7f6df2',
                '--gradient-card': '#252525',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.35)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.35)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.4)',
                '--shadow-xl': '0 20px 30px rgba(0,0,0,0.45)',
                '--shadow-glow': '0 0 20px rgba(127,109,242,0.15)'
            }
        },

        'almost-dark': {
            name: 'Almost Dark',
            type: 'dark',
            colors: {
                '--color-bg-primary': '#111111',
                '--color-bg-secondary': '#191919',
                '--color-bg-tertiary': '#222222',
                '--color-bg-card': '#191919',
                '--color-bg-card-hover': '#1f1f1f',
                '--color-text-primary': '#e0e0e0',
                '--color-text-secondary': '#8a8a8a',
                '--color-text-muted': '#555555',
                '--color-accent': '#6ea8fe',
                '--color-accent-light': '#91bfff',
                '--color-accent-dark': '#4d8fec',
                '--color-success': '#5cb85c',
                '--color-warning': '#f0ad4e',
                '--color-danger': '#d9534f',
                '--color-border': '#2a2a2a',
                '--color-border-focus': 'rgba(110,168,254,0.5)',
                '--gradient-primary': '#6ea8fe',
                '--gradient-card': '#191919',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.5)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.5)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.55)',
                '--shadow-xl': '0 20px 30px rgba(0,0,0,0.6)',
                '--shadow-glow': '0 0 20px rgba(110,168,254,0.1)'
            }
        },

        'grey-dark': {
            name: 'Grey Dark',
            type: 'dark',
            colors: {
                '--color-bg-primary': '#2c2c2c',
                '--color-bg-secondary': '#333333',
                '--color-bg-tertiary': '#3d3d3d',
                '--color-bg-card': '#333333',
                '--color-bg-card-hover': '#3a3a3a',
                '--color-text-primary': '#e8e8e8',
                '--color-text-secondary': '#aaaaaa',
                '--color-text-muted': '#777777',
                '--color-accent': '#6cb4ee',
                '--color-accent-light': '#8ec8f5',
                '--color-accent-dark': '#4a9de0',
                '--color-success': '#73c991',
                '--color-warning': '#e5c07b',
                '--color-danger': '#e06c75',
                '--color-border': '#484848',
                '--color-border-focus': 'rgba(108,180,238,0.5)',
                '--gradient-primary': '#6cb4ee',
                '--gradient-card': '#333333',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.25)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.25)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.3)',
                '--shadow-xl': '0 20px 30px rgba(0,0,0,0.35)',
                '--shadow-glow': '0 0 20px rgba(108,180,238,0.12)'
            }
        },

        'catppuccin-mocha': {
            name: 'Catppuccin',
            type: 'dark',
            colors: {
                '--color-bg-primary': '#181825',
                '--color-bg-secondary': '#1e1e2e',
                '--color-bg-tertiary': '#313244',
                '--color-bg-card': '#1e1e2e',
                '--color-bg-card-hover': '#262637',
                '--color-text-primary': '#cdd6f4',
                '--color-text-secondary': '#a6adc8',
                '--color-text-muted': '#585b70',
                '--color-accent': '#89b4fa',
                '--color-accent-light': '#b4d0fb',
                '--color-accent-dark': '#74a8f7',
                '--color-success': '#a6e3a1',
                '--color-warning': '#f9e2af',
                '--color-danger': '#f38ba8',
                '--color-border': '#313244',
                '--color-border-focus': 'rgba(137,180,250,0.5)',
                '--gradient-primary': '#89b4fa',
                '--gradient-card': '#1e1e2e',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.3)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.3)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.35)',
                '--shadow-xl': '0 20px 30px rgba(0,0,0,0.4)',
                '--shadow-glow': '0 0 20px rgba(137,180,250,0.15)'
            }
        },

        'nord': {
            name: 'Nord',
            type: 'dark',
            colors: {
                '--color-bg-primary': '#2e3440',
                '--color-bg-secondary': '#3b4252',
                '--color-bg-tertiary': '#434c5e',
                '--color-bg-card': '#3b4252',
                '--color-bg-card-hover': '#414d60',
                '--color-text-primary': '#eceff4',
                '--color-text-secondary': '#d8dee9',
                '--color-text-muted': '#7b88a1',
                '--color-accent': '#88c0d0',
                '--color-accent-light': '#a3d4e0',
                '--color-accent-dark': '#6fb3c4',
                '--color-success': '#a3be8c',
                '--color-warning': '#ebcb8b',
                '--color-danger': '#bf616a',
                '--color-border': '#434c5e',
                '--color-border-focus': 'rgba(136,192,208,0.5)',
                '--gradient-primary': '#88c0d0',
                '--gradient-card': '#3b4252',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.3)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.3)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.35)',
                '--shadow-xl': '0 20px 30px rgba(0,0,0,0.4)',
                '--shadow-glow': '0 0 20px rgba(136,192,208,0.15)'
            }
        },

        'dracula': {
            name: 'Dracula',
            type: 'dark',
            colors: {
                '--color-bg-primary': '#282a36',
                '--color-bg-secondary': '#21222c',
                '--color-bg-tertiary': '#343746',
                '--color-bg-card': '#21222c',
                '--color-bg-card-hover': '#2c2d3a',
                '--color-text-primary': '#f8f8f2',
                '--color-text-secondary': '#bfbfbf',
                '--color-text-muted': '#6272a4',
                '--color-accent': '#bd93f9',
                '--color-accent-light': '#d0afff',
                '--color-accent-dark': '#a57aea',
                '--color-success': '#50fa7b',
                '--color-warning': '#f1fa8c',
                '--color-danger': '#ff5555',
                '--color-border': '#44475a',
                '--color-border-focus': 'rgba(189,147,249,0.5)',
                '--gradient-primary': '#bd93f9',
                '--gradient-card': '#21222c',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.35)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.35)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.4)',
                '--shadow-xl': '0 20px 30px rgba(0,0,0,0.45)',
                '--shadow-glow': '0 0 20px rgba(189,147,249,0.15)'
            }
        },

        'obsidian-light': {
            name: 'Obsidian Light',
            type: 'light',
            colors: {
                '--color-bg-primary': '#ffffff',
                '--color-bg-secondary': '#f6f6f6',
                '--color-bg-tertiary': '#ececec',
                '--color-bg-card': '#f6f6f6',
                '--color-bg-card-hover': '#f0f0f0',
                '--color-text-primary': '#2e3338',
                '--color-text-secondary': '#6b6f76',
                '--color-text-muted': '#a8adb5',
                '--color-accent': '#705dcf',
                '--color-accent-light': '#8e7de0',
                '--color-accent-dark': '#5b4ab8',
                '--color-success': '#28a745',
                '--color-warning': '#d4880f',
                '--color-danger': '#e53935',
                '--color-border': '#e0e0e0',
                '--color-border-focus': 'rgba(112,93,207,0.45)',
                '--gradient-primary': '#705dcf',
                '--gradient-card': '#f6f6f6',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(0,0,0,0.06)',
                '--shadow-md': '0 4px 8px rgba(0,0,0,0.08)',
                '--shadow-lg': '0 10px 20px rgba(0,0,0,0.1)',
                '--shadow-xl': '0 20px 40px rgba(0,0,0,0.12)',
                '--shadow-glow': '0 0 16px rgba(112,93,207,0.12)'
            }
        },

        'catppuccin-latte': {
            name: 'Catppuccin Latte',
            type: 'light',
            colors: {
                '--color-bg-primary': '#eff1f5',
                '--color-bg-secondary': '#ffffff',
                '--color-bg-tertiary': '#e6e9ef',
                '--color-bg-card': '#ffffff',
                '--color-bg-card-hover': '#f2f4f8',
                '--color-text-primary': '#4c4f69',
                '--color-text-secondary': '#6c6f85',
                '--color-text-muted': '#9ca0b0',
                '--color-accent': '#1e66f5',
                '--color-accent-light': '#5b8df7',
                '--color-accent-dark': '#1a5ce0',
                '--color-success': '#40a02b',
                '--color-warning': '#df8e1d',
                '--color-danger': '#d20f39',
                '--color-border': '#ccd0da',
                '--color-border-focus': 'rgba(30,102,245,0.45)',
                '--gradient-primary': '#1e66f5',
                '--gradient-card': '#ffffff',
                '--gradient-glow': 'none',
                '--shadow-sm': '0 1px 3px rgba(76,79,105,0.06)',
                '--shadow-md': '0 4px 8px rgba(76,79,105,0.08)',
                '--shadow-lg': '0 10px 20px rgba(76,79,105,0.1)',
                '--shadow-xl': '0 20px 40px rgba(76,79,105,0.12)',
                '--shadow-glow': '0 0 16px rgba(30,102,245,0.12)'
            }
        }
    },

    current: 'obsidian-dark',
    customOverrides: {},
    userThemes: {},

    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const customStr = localStorage.getItem(this.CUSTOM_KEY);
        const userStr = localStorage.getItem(this.USER_THEMES_KEY);

        if (customStr) {
            try { this.customOverrides = JSON.parse(customStr); } catch (e) { /* ignore */ }
        }
        if (userStr) {
            try { this.userThemes = JSON.parse(userStr); } catch (e) { /* ignore */ }
        }

        if (saved && (this.presets[saved] || this.userThemes[saved])) {
            this.current = saved;
        } else {
            const oldTheme = localStorage.getItem('theme');
            this.current = oldTheme === 'light' ? 'obsidian-light' : 'obsidian-dark';
            localStorage.removeItem('theme');
        }

        this.apply(this.current, false);
        this.renderPicker();
        this.renderCustomizer();
        this.bindEvents();
    },

    getAllThemes() {
        return { ...this.presets, ...this.userThemes };
    },

    apply(themeId, save = true) {
        const all = this.getAllThemes();
        const preset = all[themeId];
        if (!preset) return;

        this.current = themeId;
        const isLight = preset.type === 'light';

        document.body.classList.toggle('light-theme', isLight);

        const merged = { ...preset.colors, ...this.customOverrides };
        Object.keys(merged).forEach(key => {
            document.body.style.setProperty(key, merged[key]);
        });

        if (save) {
            localStorage.setItem(this.STORAGE_KEY, themeId);
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        }

        this.updatePickerState();
        this.updateToggleIcon(isLight);
    },

    applyCustomOverride(varName, value) {
        this.customOverrides[varName] = value;
        document.body.style.setProperty(varName, value);
        localStorage.setItem(this.CUSTOM_KEY, JSON.stringify(this.customOverrides));
    },

    resetCustom() {
        this.customOverrides = {};
        localStorage.removeItem(this.CUSTOM_KEY);
        this.apply(this.current);
        this.renderCustomizer();
        if (typeof App !== 'undefined') App.showToast('Colors reset to preset');
    },

    saveAsUserTheme() {
        const name = prompt('Name your theme:');
        if (!name || !name.trim()) return;

        const all = this.getAllThemes();
        const base = all[this.current];
        if (!base) return;

        const merged = { ...base.colors, ...this.customOverrides };
        const id = 'user-' + Date.now();

        this.userThemes[id] = {
            name: name.trim(),
            type: base.type,
            colors: { ...merged },
            isUser: true
        };

        localStorage.setItem(this.USER_THEMES_KEY, JSON.stringify(this.userThemes));
        this.customOverrides = {};
        localStorage.removeItem(this.CUSTOM_KEY);
        this.apply(id);
        this.renderPicker();
        this.renderCustomizer();
        if (typeof App !== 'undefined') App.showToast(`Theme "${name.trim()}" saved`);
    },

    deleteUserTheme(id) {
        if (!this.userThemes[id]) return;
        const name = this.userThemes[id].name;
        if (!confirm(`Delete theme "${name}"?`)) return;

        delete this.userThemes[id];
        localStorage.setItem(this.USER_THEMES_KEY, JSON.stringify(this.userThemes));

        if (this.current === id) {
            this.apply('obsidian-dark');
        }
        this.renderPicker();
        if (typeof App !== 'undefined') App.showToast(`Theme "${name}" deleted`);
    },

    toggle() {
        const all = this.getAllThemes();
        const preset = all[this.current];
        if (!preset) return;

        const isCurrentlyLight = preset.type === 'light';
        const lastDark = localStorage.getItem('lastDarkTheme') || 'obsidian-dark';
        const lastLight = localStorage.getItem('lastLightTheme') || 'obsidian-light';

        if (isCurrentlyLight) {
            localStorage.setItem('lastLightTheme', this.current);
            this.apply(lastDark);
        } else {
            localStorage.setItem('lastDarkTheme', this.current);
            this.apply(lastLight);
        }

        this.renderPicker();
        this.renderCustomizer();
    },

    updateToggleIcon(isLight) {
        const darkIcon = document.querySelector('.theme-icon-dark');
        const lightIcon = document.querySelector('.theme-icon-light');
        if (darkIcon && lightIcon) {
            darkIcon.style.display = isLight ? 'none' : 'block';
            lightIcon.style.display = isLight ? 'block' : 'none';
        }
    },

    renderPicker() {
        const container = document.getElementById('theme-presets');
        if (!container) return;

        const all = this.getAllThemes();
        const darkThemes = [];
        const lightThemes = [];
        const userThemes = [];

        Object.entries(all).forEach(([id, p]) => {
            if (p.isUser) {
                userThemes.push([id, p]);
            } else {
                (p.type === 'dark' ? darkThemes : lightThemes).push([id, p]);
            }
        });

        const renderCard = ([id, preset]) => {
            const c = preset.colors;
            const isActive = this.current === id;
            const deleteBtn = preset.isUser
                ? `<span class="theme-card-delete" data-delete-theme="${id}" title="Delete">&times;</span>`
                : '';
            return `
                <button class="theme-card ${isActive ? 'active' : ''}" data-theme-id="${id}">
                    ${deleteBtn}
                    <div class="theme-card-preview" style="background:${c['--color-bg-primary']}">
                        <span class="theme-card-swatch" style="background:${c['--color-bg-secondary']}">
                            <span class="theme-card-line" style="background:${c['--color-text-primary']}"></span>
                            <span class="theme-card-line short" style="background:${c['--color-text-muted']}"></span>
                            <span class="theme-card-dot" style="background:${c['--color-accent']}"></span>
                        </span>
                    </div>
                    <span class="theme-card-name" style="color:var(--color-text-primary)">${preset.name}</span>
                </button>`;
        };

        let html = `
            <div class="theme-group-label">Dark</div>
            <div class="theme-row">${darkThemes.map(renderCard).join('')}</div>
            <div class="theme-group-label">Light</div>
            <div class="theme-row">${lightThemes.map(renderCard).join('')}</div>`;

        if (userThemes.length > 0) {
            html += `
                <div class="theme-group-label">My Themes</div>
                <div class="theme-row">${userThemes.map(renderCard).join('')}</div>`;
        }

        container.innerHTML = html;
    },

    renderCustomizer() {
        const container = document.getElementById('theme-customizer');
        if (!container) return;

        const all = this.getAllThemes();
        const preset = all[this.current];
        if (!preset) return;

        const fields = [
            { label: 'Background', key: '--color-bg-primary' },
            { label: 'Surface', key: '--color-bg-secondary' },
            { label: 'Text', key: '--color-text-primary' },
            { label: 'Accent', key: '--color-accent' },
            { label: 'Border', key: '--color-border' },
            { label: 'Success', key: '--color-success' },
            { label: 'Warning', key: '--color-warning' },
            { label: 'Danger', key: '--color-danger' }
        ];

        const getVal = (key) => this.customOverrides[key] || preset.colors[key];

        container.innerHTML = `
            <div class="customizer-grid">
                ${fields.map(f => `
                    <div class="customizer-field">
                        <label>${f.label}</label>
                        <input type="color" value="${getVal(f.key)}" data-custom-var="${f.key}">
                    </div>
                `).join('')}
            </div>
            <div class="customizer-actions">
                <button class="btn btn-sm btn-ghost" id="reset-custom-btn">Reset</button>
                <button class="btn btn-sm btn-primary" id="save-theme-btn">Save as Theme</button>
            </div>`;

        container.querySelectorAll('[data-custom-var]').forEach(input => {
            input.addEventListener('input', () => {
                this.applyCustomOverride(input.dataset.customVar, input.value);
            });
        });

        document.getElementById('reset-custom-btn')?.addEventListener('click', () => {
            this.resetCustom();
        });

        document.getElementById('save-theme-btn')?.addEventListener('click', () => {
            this.saveAsUserTheme();
        });
    },

    updatePickerState() {
        document.querySelectorAll('.theme-card').forEach(card => {
            card.classList.toggle('active', card.dataset.themeId === this.current);
        });
    },

    bindEvents() {
        document.getElementById('theme-presets')?.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('[data-delete-theme]');
            if (deleteBtn) {
                e.stopPropagation();
                this.deleteUserTheme(deleteBtn.dataset.deleteTheme);
                return;
            }

            const card = e.target.closest('[data-theme-id]');
            if (!card) return;
            const id = card.dataset.themeId;
            this.customOverrides = {};
            localStorage.removeItem(this.CUSTOM_KEY);
            this.apply(id);
            this.renderPicker();
            this.renderCustomizer();
        });
    }
};

window.ThemeManager = ThemeManager;
