# 🏆 Leaderboard System - Complete Guide

## System Architecture

You have **TWO leaderboard sections** in your app:

---

## 1. Dynamic Leaderboard (Top Performers)
**Location:** Home page, above STEM modules  
**Type:** Real-time, connected to backend

### Components:

#### A. Java Backend (`java-leaderboard/`)
- **Port:** 8080
- **Service:** `InMemoryLeaderboardService.java`
- **Mock Users:** demo-alice, demo-bob, demo-charlie
- **Auto-refresh:** Every 10 minutes, scores increment randomly

#### B. API Endpoints:
```
GET  http://localhost:8080/leaderboard/latest
POST http://localhost:8080/trigger-leaderboard
```

#### C. Frontend Integration (`index.tsx`):
```typescript
// Auto-loads on home page
function loadLeaderboard() {
  // 1. Fetch from API
  const response = await fetch('http://localhost:8080/leaderboard/latest');
  const data = await response.json();
  
  // 2. Render items dynamically
  entries.forEach((entry, index) => {
    // Creates HTML for each user
    // Gold/Silver/Bronze styling for top 3
  });
}
```

### How It Updates:
1. **Automatic:** Loads when you navigate to home page
2. **Manual:** Click "Refresh" button
3. **Backend:** Server updates scores every 10 minutes in background

### Real Firebase Integration:
To connect to actual Firestore:
1. Place `serviceAccountKey.json` in `java-leaderboard/`
2. Server will automatically use `LeaderboardService.java` instead
3. Aggregates real quiz scores from users

---

## 2. Static Scoreboard (Weekly Scoreboard)
**Location:** Home page, below STEM modules  
**Type:** Static demo data (HTML only)

### Current Setup:
```html
<!-- Hardcoded in index.html -->
<div class="scoreboard-item top-1">
  <h3>Shreyash</h3>
  <span>2,450 points</span>
</div>
<!-- etc... -->
```

### This Does NOT Update Because:
- ❌ Not connected to any backend
- ❌ No JavaScript logic to fetch/update
- ❌ Pure HTML/CSS display

---

## 🔄 How to Make BOTH Leaderboards Dynamic

### Option A: Connect Static Scoreboard to Java API

**Step 1:** Add a function to fetch weekly scores:
```typescript
// In index.tsx
async function loadWeeklyScoreboard() {
  try {
    const response = await fetch('http://localhost:8080/leaderboard/latest');
    const data = await response.json();
    
    // Get top 4 users
    const topUsers = data.entries.slice(0, 4);
    
    // Update the HTML
    const container = document.querySelector('.scoreboard-container');
    container.innerHTML = topUsers.map((user, i) => `
      <div class="scoreboard-item ${i < 3 ? 'top-' + (i+1) : ''}">
        <div class="scoreboard-rank">
          <span class="rank-number">${i + 1}</span>
          ${i === 0 ? '<span class="rank-medal">🥇</span>' : ''}
          ${i === 1 ? '<span class="rank-medal">🥈</span>' : ''}
          ${i === 2 ? '<span class="rank-medal">🥉</span>' : ''}
        </div>
        <div class="scoreboard-info">
          <h3>${user.userName}</h3>
          <p>${getTitleForRank(i + 1)}</p>
        </div>
        <div class="scoreboard-score">
          <span class="score-value">${user.totalScore.toLocaleString()}</span>
          <span class="score-label">points</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load scoreboard:', error);
  }
}

function getTitleForRank(rank: number): string {
  const titles = [
    'Master Learner',
    'Rising Star', 
    'Quick Thinker',
    'Steady Climber'
  ];
  return titles[rank - 1] || 'Challenger';
}
```

**Step 2:** Call it when loading home page:
```typescript
function navigateTo(pageName: PageName) {
  // ... existing code ...
  
  if (pageName === 'home') {
    loadLeaderboard();        // Loads top performers
    loadWeeklyScoreboard();   // Loads weekly scoreboard
  }
}
```

---

### Option B: Connect to Real Firebase (Production Setup)

**Backend Changes:**
1. Add `serviceAccountKey.json` to `java-leaderboard/`
2. Server automatically switches from mock to real Firestore data
3. Queries `quizResults` collection for last 24 hours
4. Aggregates scores by user

**When Users Take Quizzes:**
```typescript
// In index.tsx - after quiz completion
await saveQuizResult({
  userId: currentUser.uid,
  score: quizScore,
  topic: currentTopic,
  timestamp: Date.now()
});

// This gets saved to Firestore
// Java backend picks it up in next update cycle (every 10 min)
```

---

## 🎯 Summary

### Current State:
| Feature | Top Performers | Weekly Scoreboard |
|---------|---------------|-------------------|
| **Data Source** | Java API | Static HTML |
| **Updates** | ✅ Auto + Manual | ❌ Never |
| **Users** | demo-alice, bob, charlie | Shreyash, Yash, Tansih, Kunal |
| **Backend** | Running on :8080 | None |

### To Make Both Dynamic:
1. **Keep demo data:** Use Option A (connect scoreboard to same API)
2. **Use real users:** Use Option B (Firebase integration)
3. **Hybrid:** Top Performers = real users, Weekly = weekly leaders only

---

## 🚀 Quick Start Commands

### Run Backend:
```powershell
cd java-leaderboard
.\test-run.ps1
```

### Run Frontend:
```powershell
npm run dev
```

### Test API Manually:
```powershell
# View leaderboard
curl http://localhost:8080/leaderboard/latest

# Trigger refresh
curl -X POST http://localhost:8080/trigger-leaderboard
```

---

## 📝 Next Steps

1. **Decide:** Do you want both leaderboards to show the same data or different data?
2. **Connect:** If same data, connect the weekly scoreboard to the API
3. **Customize:** If different data, add a new endpoint like `/weekly-leaders`
4. **Firebase:** For production, add real Firebase credentials

Would you like me to implement any of these options?
