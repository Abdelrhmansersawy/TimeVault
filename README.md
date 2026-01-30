# TimeVault ⏱️

A modern, feature-rich time management web application built with vanilla JavaScript. Track your time, manage tasks, and reflect on your daily progress – all in one beautiful interface.

## ✨ Features

### 🕐 Clock & Alarms
- Beautiful analog/digital clock display
- Multiple alarm support with custom sounds
- Notification alerts

### ⏱️ Advanced Stopwatches
- **Unlimited stopwatch instances** - Create stopwatches for different projects/activities
- **Category organization** - Group stopwatches by category (Work, Study, Exercise, etc.)
- **Color coding** - Assign colors for visual distinction
- **Background tracking** - Continues timing even when browser is closed
- **Daily/weekly goals** - Set time goals per stopwatch
- **Session history** - View detailed time logs

### 📋 Task Database
- **Centralized task management** - All tasks in one place
- **Subtasks** - Break down tasks into smaller steps
- **Priority levels** - Low, Medium, High
- **Status tracking** - To Do, In Progress, Done
- **Tags** - Organize with custom tags
- **Stopwatch assignment** - Link tasks to time tracking

### 📓 Daily Journal
- **Morning Routine checklist** - Track daily habits
- **Plan for Today** - Add tasks from Task Database for daily focus
- **What I Did** - Completed tasks automatically appear here
- **Blocked/Issues** - Note what's blocking progress
- **For Tomorrow** - Plan ahead
- **Reflection** - End-of-day thoughts
- **Date navigation** - Review past journal entries

### 📊 Graphs & Analytics
- **Daily bar charts** - Time distribution per stopwatch
- **Category analysis** - See time spent by category
- **Weekly/monthly trends** - Track your patterns over time
- **Goals progress** - Visual goal completion tracking

### ⚙️ Settings
- **Dark/Light theme** - Comfortable viewing
- **Data export** - Backup your data
- **Customizable UI** - Personalize your experience

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/timevault.git
   cd timevault
   ```

2. Start a local server:
   ```bash
   python3 -m http.server 8080
   ```

3. Open in browser:
   ```
   http://localhost:8080
   ```

## 📁 Project Structure

```
timevault/
├── index.html          # Main HTML structure
├── js/
│   ├── app.js          # Main app controller
│   ├── storage.js      # LocalStorage management
│   ├── clock.js        # Clock display
│   ├── alarm.js        # Alarm functionality
│   ├── timer.js        # Timer features
│   ├── stopwatch.js    # Basic stopwatch
│   ├── advancedStopwatches.js  # Multi-stopwatch system
│   ├── tasks.js        # Task database
│   ├── dailys.js       # Daily journal
│   └── graphs.js       # Analytics & charts
├── styles/
│   ├── base.css        # CSS variables & reset
│   └── components.css  # Component styles
└── assets/
    └── sounds/         # Alarm sounds
```

## 💾 Data Storage

All data is stored locally in your browser using localStorage. Your data never leaves your device.

**Storage keys:**
- `focusclock_stopwatches` - Stopwatch data
- `focusclock_tasks` - Task database
- `focusclock_dailys` - Daily journal entries
- `focusclock_sessions` - Work session history
- `focusclock_settings` - User preferences

## 🛠️ Tech Stack

- **HTML5** - Semantic structure
- **CSS3** - Modern styling with CSS variables
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **LocalStorage** - Client-side data persistence

## 📱 Browser Support

Works on all modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📄 License

MIT License - feel free to use and modify!

---

Made with ❤️ for productivity enthusiasts
