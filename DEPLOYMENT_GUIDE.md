# 🚀 Deploy InsightXR to Vercel with Firebase

This guide will help you deploy your leaderboard system to production.

---

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Vercel account (free tier is fine)
- [ ] Firebase project (you should already have one)
- [ ] Railway/Render account (for Java backend) OR use Firebase Functions

---

## Part 1: Firebase Setup

### Step 1: Get Firebase Admin SDK Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (insight-xr or whatever you named it)
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (this is your `serviceAccountKey.json`)
7. **IMPORTANT:** Keep this file secure, never commit to Git!

### Step 2: Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Start in **Production mode** (we'll add rules later)
4. Choose a location (us-central1 or closest to you)
5. Click **Enable**

### Step 3: Set Up Firestore Collections

Your app needs these collections:
```
users/
  └─ {userId}
      ├─ displayName: string
      ├─ email: string
      ├─ photoURL: string
      └─ stats: {...}

quizResults/
  └─ {resultId}
      ├─ userId: string
      ├─ userName: string
      ├─ score: number
      ├─ topic: string
      ├─ timestamp: number
```

These will be created automatically when users take quizzes.

### Step 4: Update Firestore Rules

In Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Quiz results - anyone authenticated can read, only owner can write
    match /quizResults/{resultId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

---

## Part 2: Update Frontend Code

### Step 1: Add Quiz Score Saving

Update your `index.tsx` to save quiz results to Firestore:

```typescript
// At the top, import Firestore functions
import { db } from './insightxr-backend/src/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// After showing quiz results
async function showQuizResults() {
    // ... existing code to calculate score ...
    
    // Save to Firestore
    if (currentUser && db) {
        try {
            await addDoc(collection(db, 'quizResults'), {
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
                score: quizScore,
                topic: currentTopic || 'general',
                timestamp: Date.now(),
                totalQuestions: quizQuestions.length,
                createdAt: serverTimestamp()
            });
            console.log('Quiz result saved to Firestore');
        } catch (error) {
            console.error('Error saving quiz result:', error);
        }
    }
    
    // ... rest of existing code ...
}
```

### Step 2: Update Leaderboard Service URL

Update `insightxr-backend/src/services/leaderboardService.ts`:

```typescript
// Change this based on environment
const LEADERBOARD_API_URL = import.meta.env.PROD 
    ? 'https://your-java-backend.railway.app'  // Production URL (we'll get this later)
    : 'http://localhost:8080';                  // Development URL

export async function fetchLeaderboard(): Promise<LeaderboardData | null> {
    try {
        const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard/latest`);
        // ... rest of code ...
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return null;
    }
}
```

---

## Part 3: Deploy Frontend to Vercel

### Step 1: Push Code to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/insight_xr.git
git branch -M main
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Import Project**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset:** Vite
   - **Root Directory:** `./` (leave as is)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 3: Add Environment Variables in Vercel

In Vercel dashboard → Your Project → Settings → Environment Variables:

Add these (get values from Firebase Console → Project Settings):

```
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 4: Deploy

Click **Deploy** and wait for build to complete.

Your frontend will be live at: `https://your-app.vercel.app`

---

## Part 4: Deploy Java Backend

You have **2 options** for the Java backend:

### Option A: Railway (Recommended - Easy)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your `insight_xr` repository
5. Configure:
   - **Root Directory:** `java-leaderboard`
   - **Build Command:** `javac -cp "libs/*:src" -d bin src/com/insightxr/**/*.java`
   - **Start Command:** `java -cp "libs/*:bin" com.insightxr.App`
   - **Port:** 8080

6. Add Environment Variables:
   ```
   PORT=8080
   GOOGLE_APPLICATION_CREDENTIALS=/app/serviceAccountKey.json
   ```

7. Upload `serviceAccountKey.json`:
   - In Railway dashboard, go to **Settings** → **Volumes**
   - Upload your Firebase Admin SDK JSON file

8. Deploy and get your public URL (like `https://your-app.railway.app`)

### Option B: Render (Alternative)

1. Go to [render.com](https://render.com)
2. New → **Web Service**
3. Connect GitHub repository
4. Configure:
   - **Root Directory:** `java-leaderboard`
   - **Environment:** Docker (you'll need to create a Dockerfile)
   - **Port:** 8080

Create `java-leaderboard/Dockerfile`:
```dockerfile
FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY libs ./libs
COPY src ./src
RUN javac -cp "libs/*:src" -d bin src/com/insightxr/**/*.java
EXPOSE 8080
CMD ["java", "-cp", "libs/*:bin", "com.insightxr.App"]
```

---

## Part 5: Update CORS Settings

Once you have your backend URL, update `java-leaderboard/src/com/insightxr/App.java`:

```java
private static void setCorsHeaders(HttpExchange exchange) {
    Headers headers = exchange.getResponseHeaders();
    
    // Add your Vercel URL
    headers.add("Access-Control-Allow-Origin", "https://your-app.vercel.app");
    headers.add("Access-Control-Allow-Origin", "http://localhost:5173");
    
    headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.add("Access-Control-Allow-Headers", "Content-Type");
}
```

Redeploy the backend after this change.

---

## Part 6: Connect Everything

### Step 1: Update Frontend with Backend URL

In Vercel → Settings → Environment Variables, add:

```
VITE_LEADERBOARD_API_URL=https://your-java-backend.railway.app
```

Then update `leaderboardService.ts`:

```typescript
const LEADERBOARD_API_URL = import.meta.env.VITE_LEADERBOARD_API_URL || 'http://localhost:8080';
```

### Step 2: Redeploy Frontend

In Vercel dashboard, click **Redeploy** to pick up the new environment variable.

---

## Part 7: Test Production

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Sign in with Google
3. Take a quiz
4. Check if score appears in Firebase Console → Firestore Database
5. Check if leaderboard loads on home page
6. Wait 10 minutes or trigger manual refresh

---

## 🎯 Architecture Overview

```
User Browser (Vercel)
    ↓
Firebase Auth (login)
    ↓
Takes Quiz
    ↓
Saves to Firestore (quizResults collection)
    ↓
Java Backend (Railway/Render)
    ↓
Reads Firestore every 10 minutes
    ↓
Aggregates scores
    ↓
Exposes API endpoint
    ↓
Frontend fetches & displays
```

---

## 🔧 Troubleshooting

### Leaderboard Not Loading
- Check browser console for CORS errors
- Verify backend URL is correct
- Check Railway/Render logs for errors
- Verify Firebase Admin SDK credentials

### Quiz Scores Not Saving
- Check Firebase Console → Firestore for data
- Verify Firestore rules allow writes
- Check browser console for errors
- Ensure user is authenticated

### Backend Not Starting
- Check Railway/Render logs
- Verify `serviceAccountKey.json` is uploaded
- Check Java version (needs JDK 11+)
- Verify all dependencies in `libs/` folder

---

## 📝 Deployment Checklist

- [ ] Firebase Firestore enabled
- [ ] Firestore rules configured
- [ ] Firebase Admin SDK key downloaded
- [ ] Frontend code updated to save quiz results
- [ ] Code pushed to GitHub
- [ ] Frontend deployed to Vercel
- [ ] Environment variables added to Vercel
- [ ] Java backend deployed to Railway/Render
- [ ] Service account key uploaded to backend
- [ ] CORS settings updated with Vercel URL
- [ ] Leaderboard API URL configured in frontend
- [ ] Tested: Login → Quiz → Score Save → Leaderboard Display

---

## 🎉 Success!

Once everything is deployed:
- Users can take quizzes and earn points
- Scores are saved to Firebase Firestore
- Java backend aggregates scores every 10 minutes
- Leaderboard displays top performers
- Everything works on production URLs!

Your live app: `https://your-app.vercel.app`
Your backend: `https://your-backend.railway.app`

---

## 💡 Next Steps

1. Add user profile pages showing individual stats
2. Add weekly/monthly leaderboard tabs
3. Add achievement badges
4. Send notifications for ranking changes
5. Add admin dashboard for teachers

Would you like help with any specific part of this deployment?
