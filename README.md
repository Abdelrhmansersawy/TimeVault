<h1 align="center">TimeVault</h1></br>

<p align="center">
<img src="assets/timevault-logo.png" width="20%" height="20%"/>
</p>

<p align="center">
A modern, feature-rich time management web application built with vanilla JavaScript.
Track your time, manage tasks, and reflect on your daily progress – all in one beautiful interface.
</p>

## Screenshots
<p align="center">
<img src="assets/screenshots/screenshot_1.png" width="30%" height="auto">
<img src="assets/screenshots/screenshot_2.png" width="30%" height="auto">
<img src="assets/screenshots/screenshot_3.png" width="30%" height="auto">
</p>

## Features
- Beautiful analog/digital clock with multiple world timezones and alarm support
- Interactive daily timeline with current time cursor and customizable day start hours
- Unlimited stopwatch instances with category organization and color coding
- Background tracking that continues even when the browser is closed
- Daily and weekly time goals per stopwatch with session history and gap tracking
- Centralized task database with subtasks, priorities, status tracking, and rich descriptions
- Daily journal with customizable sections, and direct Kanban task integration
- Graphs and analytics dashboard featuring global insights, doughnut charts, and a compact sparkline grid layout
- Native Terminal CLI (`timevault_cli`) for managing tasks and timers directly from your shell
- Highly customizable UI including dynamic sidebar tabs
- Dark and light theme support
- All data stored locally, never leaves your device and syncs securely via a lightweight local backend

## Task descriptions & draft notes

- Each task has a free-form description field that works as a simple text editor
- You can write notes using basic README-style syntax (headings, lists, links, etc.)
- This is ideal for drafting what you’re thinking about while working on the task
- You can also include links to external notes, for example an Obsidian vault file using markdown links like `[My note](path-or-obsidian-link)`

## Tech Stack
- HTML5 & CSS3 (Custom properties)
- Vanilla JavaScript (ES6+)
- Python 3 (Lightweight REST Server & CLI `timevault_cli`)
- LocalStorage coupled with `~/.timevault/timevault-db.json` for persistence
- **Obsidian Vault** synchronization

## Getting Started

### Linux & macOS

**Option 1: Quick Install (Recommended)**
Install TimeVault system-wide with a single command:
```bash
curl -fsSL https://raw.githubusercontent.com/Abdelrhmansersawy/TimeVault/main/install.sh | bash
```
*This downloads the application to `~/.timevault` and creates a symlink in `~/.local/bin` so you can use the `timevault` CLI command anywhere.*

**Option 2: Manual Install**
If you prefer to install manually:
```bash
git clone https://github.com/Abdelrhmansersawy/TimeVault.git
cd TimeVault
./timevault install
```

**Running the App:**
Once installed, simply type:
```bash
timevault open
```
*(If you didn't run the install step, navigate to the folder and use `./timevault open` instead).*

---

### Windows

Windows does not natively support the bash installation scripts unless you use WSL (Windows Subsystem for Linux). If you want to run TimeVault natively on Windows, follow these steps:

1. Clone the repository:
   ```cmd
   git clone https://github.com/Abdelrhmansersawy/TimeVault.git
   cd TimeVault
   ```
2. Start the backend Python server:
   ```cmd
   python server.py
   ```
3. Open your browser and navigate to:
   `http://localhost:51888`

*(To use the terminal CLI natively on Windows, open a new Command Prompt in the TimeVault folder and run `python timevault_cli [command]`).*

## CLI Commands
The `timevault` CLI tool offers several helpful commands for managing your application seamlessly from the terminal:
- `timevault open`: Starts the local development backend (`server.py`) and opens TimeVault in your default browser.
- `timevault stop`: Gracefully stops the background local development server.
- `timevault status`: Checks if the TimeVault server is currently actively running.
- `timevault daemon [install|start|stop]`: Manages TimeVault as a background Systemd service.
- `timevault update`: Pulls the latest changes from this GitHub repository.
- `timevault backup`: Prints instructions on how to backup your sandboxed LocalStorage data.
- `timevault install`: Creates a symlink in `~/.local/bin` so you can use the command everywhere.
- `timevault uninstall`: Removes the symlink from your PATH.

## Native Terminal Application 
You can use `timevault_cli` to log time natively, completely synced with the Browser!
*(Note: `timevault_cli` is automatically installed globally when you run `timevault install` or use the quick install script).*

- `timevault_cli start "Task Name"`: Starts tracking a new task visually linked to your frontend.
- `timevault_cli break [Name]`: Switches your timer into break-mode / untracked time.
- `timevault_cli stop`: Stops the current timer and pushes it to your Daily Log.
- `timevault_cli status`: See what you are currently tracking.
- `timevault_cli tasks`: Prints out your mapped Task Database Kanban board natively!

## Keeping Up-to-Date
To update your local installation with the latest features:
```bash
timevault update
```

## Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## How to contribute
- Before making a feature request or bug report, make sure you have the latest version and the request is unique
- If you want to implement a new feature or fix a bug, make sure no one is already working on it and leave a comment

## TODO / Future Features

- Make plugin with Arch

```
MIT License

Copyright (c) 2025 - Present

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
