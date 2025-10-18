# 🚀 Quick Start Guide - Run Everything with One Command!

## ✅ Setup Complete!

Your InsightXR project is now configured to start **both servers with a single command**!

---

## 🎯 Simple Start Command

Just run:

```powershell
npm run dev
```

This will **automatically start both**:
1. ✅ **Vite Frontend** → http://localhost:5173
2. ✅ **Java Leaderboard** → http://localhost:8080

---

## 📊 What You'll See

When you run `npm run dev`, you'll see output like this:

```
[VITE] VITE v6.4.0  ready in 370 ms
[VITE] ➜  Local:   http://localhost:5173/

[JAVA] Compiling...
[JAVA] Leaderboard service running on port 8080
[JAVA] [leaderboard] updated: Sun Oct 19 03:14:30 IST 2025
```

---

## 🌐 Access Your Application

### Frontend (Main App)
```
http://localhost:5173
```
- STEM learning modules
- AI Tutor
- Quizzes
- Achievements

### Leaderboard API
```
http://localhost:8080/leaderboard/latest
```
- View current leaderboard (JSON)

```
http://localhost:8080/trigger-leaderboard
```
- Manually trigger leaderboard update (POST request)

---

## 🛑 Stop Both Servers

Press **Ctrl+C** once in the terminal to stop both servers simultaneously.

---

## 📦 Available Scripts

### Primary Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | 🚀 Start BOTH frontend + backend |
| `npm run build` | 📦 Build frontend for production |
| `npm run preview` | 👁️ Preview production build |

### Individual Server Commands

| Command | Description |
|---------|-------------|
| `npm run dev:frontend` | Start only Vite frontend |
| `npm run dev:leaderboard` | Start only Java backend |
| `npm run leaderboard` | Alias for Java backend only |

---

## ⚙️ How It Works

The `package.json` has been configured with **concurrently** to run multiple processes:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:leaderboard\" --names \"VITE,JAVA\" --prefix-colors \"cyan,green\"",
    "dev:frontend": "vite",
    "dev:leaderboard": "cd java-leaderboard && powershell -NoProfile -ExecutionPolicy Bypass -File test-run.ps1"
  }
}
```

- **concurrently**: Runs both servers in parallel
- **--names**: Labels output as [VITE] and [JAVA]
- **--prefix-colors**: Color codes the output (cyan for Vite, green for Java)

---

## 🎨 Color-Coded Output

The terminal output is color-coded for easy reading:
- 🔵 **[VITE]** = Cyan (Frontend messages)
- 🟢 **[JAVA]** = Green (Backend messages)

---

## 🧪 Testing the Setup

### 1. Start Everything
```powershell
npm run dev
```

### 2. Test Frontend
Open browser: http://localhost:5173

### 3. Test Leaderboard API
Open browser: http://localhost:8080/leaderboard/latest

Or use PowerShell (in a new terminal):
```powershell
Invoke-RestMethod http://localhost:8080/leaderboard/latest
```

---

## 🔧 Troubleshooting

### Port Already in Use?

**Frontend (Port 5173):**
```powershell
# Find process using port 5173
netstat -ano | findstr :5173
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Backend (Port 8080):**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080
# Kill the process
taskkill /PID <PID> /F
```

Then restart with `npm run dev`

### Java Compilation Issues?

If the Java server fails to compile, manually compile first:
```powershell
cd java-leaderboard
mvn clean compile
cd ..
npm run dev
```

### Only Start One Server

**Frontend only:**
```powershell
npm run dev:frontend
```

**Backend only:**
```powershell
npm run dev:leaderboard
```

---

## 📋 Typical Development Workflow

1. **Start Development:**
   ```powershell
   npm run dev
   ```

2. **Code & Test:**
   - Frontend changes → Vite hot-reloads automatically
   - Backend changes → Restart with Ctrl+C, then `npm run dev`

3. **Build for Production:**
   ```powershell
   npm run build
   ```

---

## 🎯 What's Running?

### Frontend (Vite)
- **Port:** 5173
- **Hot Reload:** Yes (automatic)
- **Build Tool:** Vite
- **Framework:** TypeScript + Three.js

### Backend (Java Leaderboard)
- **Port:** 8080
- **Auto Reload:** No (manual restart needed)
- **Build Tool:** Maven
- **Java Version:** 21 LTS

---

## 🌟 Features

### Automatic Startup ✅
- No need to run two separate commands
- Both servers start together
- Synchronized terminal output

### Easy Monitoring ✅
- Color-coded logs
- Clear server labels
- See both servers in one view

### Simple Shutdown ✅
- One Ctrl+C stops everything
- Clean process termination
- No orphaned processes

---

## 📚 Related Documentation

- **README.md** - Project overview
- **CLEANUP_SUMMARY.md** - Cleanup history
- **java-leaderboard/QUICKSTART.md** - Java backend details
- **java-leaderboard/JAVA21_UPGRADE_VERIFICATION.md** - Java 21 info

---

## 🎉 You're All Set!

Just run **`npm run dev`** and start coding! 🚀

Both your frontend and leaderboard backend will be up and running instantly!

---

**Last Updated:** October 19, 2025  
**Status:** ✅ Ready for Development
