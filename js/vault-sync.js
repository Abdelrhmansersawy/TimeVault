/**
 * Vault Sync - Export data as .md files compatible with Obsidian
 * Uses File System Access API for directory-based sync
 * Stores metadata in .timevault JSON file
 */

const VaultSync = {
    dirHandle: null,
    DB_NAME: 'timevault_handles',
    DB_STORE: 'dirs',

    async init() {
        this.bindUI();
        await this.restoreHandle();
        this.updateStatusUI();
    },

    bindUI() {
        document.getElementById('vault-pick-btn')?.addEventListener('click', () => this.pickDirectory());
        document.getElementById('vault-sync-btn')?.addEventListener('click', () => this.syncNow());
        document.getElementById('vault-disconnect-btn')?.addEventListener('click', () => this.disconnect());
    },

    // IndexedDB for persisting the directory handle across sessions
    _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(this.DB_STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async saveHandle(handle) {
        const db = await this._openDB();
        const tx = db.transaction(this.DB_STORE, 'readwrite');
        tx.objectStore(this.DB_STORE).put(handle, 'vault');
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    },

    async restoreHandle() {
        try {
            const db = await this._openDB();
            const tx = db.transaction(this.DB_STORE, 'readonly');
            const req = tx.objectStore(this.DB_STORE).get('vault');
            const handle = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            if (handle) {
                const perm = await handle.queryPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                    this.dirHandle = handle;
                }
            }
        } catch (e) { /* no saved handle */ }
    },

    async pickDirectory() {
        if (!('showDirectoryPicker' in window)) {
            App.showToast('Your browser does not support directory access');
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.dirHandle = handle;
            await this.saveHandle(handle);
            this.updateStatusUI();
            App.showToast('Vault folder connected');
        } catch (e) {
            if (e.name !== 'AbortError') App.showToast('Could not access folder');
        }
    },

    async disconnect() {
        this.dirHandle = null;
        try {
            const db = await this._openDB();
            const tx = db.transaction(this.DB_STORE, 'readwrite');
            tx.objectStore(this.DB_STORE).delete('vault');
        } catch (e) { /* ignore */ }
        this.updateStatusUI();
        App.showToast('Vault disconnected');
    },

    updateStatusUI() {
        const status = document.getElementById('vault-status');
        const syncBtn = document.getElementById('vault-sync-btn');
        const disconnectBtn = document.getElementById('vault-disconnect-btn');
        const pickBtn = document.getElementById('vault-pick-btn');

        if (this.dirHandle) {
            if (status) status.textContent = `Connected: ${this.dirHandle.name}/`;
            if (status) status.classList.add('connected');
            if (syncBtn) syncBtn.style.display = 'inline-flex';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
            if (pickBtn) pickBtn.textContent = 'Change Folder';
        } else {
            if (status) { status.textContent = 'Not connected'; status.classList.remove('connected'); }
            if (syncBtn) syncBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (pickBtn) pickBtn.textContent = 'Choose Vault Folder';
        }
    },

    async syncNow() {
        if (!this.dirHandle) {
            App.showToast('No vault folder selected');
            return;
        }

        try {
            const perm = await this.dirHandle.requestPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                App.showToast('Permission denied');
                return;
            }

            const root = await this.dirHandle.getDirectoryHandle('TimeVault', { create: true });

            await this.writeDailyLogs(root);
            await this.writeTasksFile(root);
            await this.writeTimevault(root);

            App.showToast('Synced to Obsidian vault');
        } catch (e) {
            console.error('Vault sync error:', e);
            App.showToast('Sync failed: ' + e.message);
        }
    },

    async writeFile(dirHandle, filename, content) {
        const file = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await file.createWritable();
        await writable.write(content);
        await writable.close();
    },

    async writeDailyLogs(root) {
        const dailyDir = await root.getDirectoryHandle('Daily', { create: true });
        const dailys = StorageManager.getDailys();

        for (const [dateStr, day] of Object.entries(dailys)) {
            const entries = day.timeLog || [];
            const md = this.generateDailyMd(dateStr, day, entries);
            await this.writeFile(dailyDir, `${dateStr}.md`, md);
        }

        // Also write today if it has an active timer but no entries yet
        const today = getDateString();
        if (!dailys[today]) {
            const entries = StorageManager.getTimeLog(today);
            if (entries.length > 0) {
                const md = this.generateDailyMd(today, {}, entries);
                await this.writeFile(dailyDir, `${today}.md`, md);
            }
        }
    },

    generateDailyMd(dateStr, day, entries) {
        const date = new Date(dateStr + 'T00:00:00');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

        let totalWork = 0, totalBreak = 0, sessions = 0;
        entries.forEach(e => {
            const dur = e.endTime - e.startTime;
            if (e.isBreak) totalBreak += dur;
            else { totalWork += dur; sessions++; }
        });

        const fmtMs = (ms) => {
            const m = Math.floor(ms / 60000);
            const h = Math.floor(m / 60);
            return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
        };

        const fmtTime = (ts) => {
            const d = new Date(ts);
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        let md = `---\ndate: ${dateStr}\ntotal_work: ${fmtMs(totalWork)}\ntotal_break: ${fmtMs(totalBreak)}\nsessions: ${sessions}\n---\n\n`;
        md += `# ${dateStr} - ${dayName}\n\n`;

        if (entries.length > 0) {
            md += `## Time Log\n\n`;
            md += `| Time | Duration | Task |\n|------|----------|------|\n`;
            entries.forEach(e => {
                const dur = e.endTime - e.startTime;
                const icon = e.isBreak ? 'break' : 'work';
                md += `| ${fmtTime(e.startTime)} — ${fmtTime(e.endTime)} | ${fmtMs(dur)} | ${e.isBreak ? '☕ ' : ''}${e.taskName} |\n`;
            });
            md += '\n';
        }

        md += `## Overview\n\n`;
        md += `- **Work**: ${fmtMs(totalWork)}\n`;
        md += `- **Break**: ${fmtMs(totalBreak)}\n`;
        md += `- **Sessions**: ${sessions}\n\n`;

        if (day.blocked) {
            md += `## Blocked / Issues\n\n${day.blocked}\n\n`;
        }
        if (day.tomorrow) {
            md += `## For Tomorrow\n\n${day.tomorrow}\n\n`;
        }
        if (day.reflection) {
            md += `## Reflection\n\n${day.reflection}\n\n`;
        }

        return md;
    },

    async writeTasksFile(root) {
        const tasks = StorageManager.getTasks();
        const stopwatches = StorageManager.getStopwatches().filter(
            s => !s.deleted && s.id !== 'waste-time-builtin'
        );

        const grouped = {};
        stopwatches.forEach(sw => { grouped[sw.id] = { name: sw.name, tasks: [] }; });
        const ungrouped = [];

        tasks.forEach(t => {
            if (t.assignedStopwatch && grouped[t.assignedStopwatch]) {
                grouped[t.assignedStopwatch].tasks.push(t);
            } else {
                ungrouped.push(t);
            }
        });

        let md = `# Tasks\n\n`;

        for (const [, group] of Object.entries(grouped)) {
            if (group.tasks.length === 0) continue;
            md += `## ${group.name}\n\n`;
            group.tasks.forEach(t => {
                const check = t.status === 'done' ? 'x' : ' ';
                const priority = t.priority !== 'medium' ? ` (${t.priority})` : '';
                const tags = (t.tags && t.tags.length > 0) ? ' ' + t.tags.map(tg => `#${tg}`).join(' ') : '';
                const title = t.status === 'done' ? `~~${t.title}~~` : t.title;
                md += `- [${check}] ${title}${priority}${tags}\n`;
                if (t.description) md += `  - ${t.description}\n`;
            });
            md += '\n';
        }

        if (ungrouped.length > 0) {
            md += `## Unassigned\n\n`;
            ungrouped.forEach(t => {
                const check = t.status === 'done' ? 'x' : ' ';
                md += `- [${check}] ${t.title}\n`;
            });
            md += '\n';
        }

        await this.writeFile(root, 'Tasks.md', md);
    },

    async writeTimevault(root) {
        const meta = {
            version: 1,
            appName: 'Time Vault',
            lastSync: new Date().toISOString(),
            stats: {
                totalTasks: StorageManager.getTasks().length,
                totalStopwatches: StorageManager.getStopwatches().filter(s => !s.deleted).length,
                totalHabits: StorageManager.getHabits().length
            }
        };
        await this.writeFile(root, '.timevault', JSON.stringify(meta, null, 2));
    }
};

window.VaultSync = VaultSync;
