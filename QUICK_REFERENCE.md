# InsightXR - Quick Reference

## 🚀 Start Development

```bash
npm run dev
```

This starts both:
- **Frontend** (Vite) on http://localhost:5173
- **Backend** (Java) on http://localhost:8080

---

## 🔧 Other Commands

```bash
# Start only frontend
npm run dev:frontend

# Start only backend
npm run dev:leaderboard

# Build frontend for production
npm run build

# Build Java backend
npm run build:java

# Preview production build
npm run preview

# Run system health check
.\health-check.ps1
```

---

## 🌐 API Endpoints

### Backend (port 8080)
- `GET /leaderboard/latest` - Get current leaderboard
- `POST /trigger-leaderboard` - Manually trigger update

### Test API
```powershell
Invoke-RestMethod http://localhost:8080/leaderboard/latest
```

---

## 📁 Project Structure

```
insight_xr/
├── index.html              # Entry HTML
├── index.tsx               # Main TypeScript app
├── index.css               # Styles
├── vite.config.ts          # Vite configuration (optimized)
├── tsconfig.json           # TypeScript config
├── package.json            # npm config (v1.0.0)
├── health-check.ps1        # System health check
├── README.md               # Main documentation
├── SYSTEM_STATUS.md        # Optimization report
└── java-leaderboard/
    ├── pom.xml             # Maven config (optimized)
    ├── test-run.ps1        # Direct Java runner
    └── src/com/insightxr/
        ├── App.java        # Main server
        ├── FirebaseInit.java
        └── service/
            ├── ILeaderboard.java
            ├── LeaderboardService.java
            └── InMemoryLeaderboardService.java
```

---

## ✅ System Requirements

- **Java:** 21+ (currently using 23 ✅)
- **Maven:** 3.8+
- **Node.js:** 18+
- **npm:** 8+

---

## 🔍 Troubleshooting

### Servers won't start
```bash
# Check if ports are in use
.\health-check.ps1

# Kill processes on ports
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -Force
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess -Force
```

### Java build fails
```bash
cd java-leaderboard
mvn clean package -X
```

### Frontend errors
```bash
npm install
npx tsc --noEmit
```

---

## 📊 Optimizations

✅ Vite server & build config  
✅ Maven JAR manifest & deps  
✅ Package.json v1.0.0  
✅ Java 21 compilation  
✅ TypeScript strict mode  
✅ CORS configuration  
✅ Concurrent startup  
✅ Health check script  

---

**Status:** ✅ All systems operational!
