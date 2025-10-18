# 🚀 Quick Start: Deploy to Production

Follow these steps in order to get your app live with Firebase + Vercel!

---

## Step 1: Firebase Setup (15 minutes)

### 1.1 Get Admin SDK Credentials
1. Go to https://console.firebase.google.com
2. Select your project
3. Click ⚙️ (Settings) → **Project Settings**
4. **Service Accounts** tab
5. Click **"Generate new private key"**
6. Save as `serviceAccountKey.json` (keep it SECRET!)

### 1.2 Enable Firestore
1. In Firebase Console → **Firestore Database**
2. **Create database** → Production mode
3. Choose location (us-central or closest)
4. Click **Enable**

### 1.3 Set Firestore Rules
Go to Rules tab and paste:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /quizResults/{resultId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

✅ Firebase is ready!

---

## Step 2: Update Code for Production (10 minutes)

### 2.1 Add Quiz Score Saving

Open `index.tsx` and find the `showQuizResults()` function.

Add this code after calculating the score:

```typescript
// Add these imports at the top of index.tsx
import { db } from './insightxr-backend/src/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Inside showQuizResults() function, after calculating score:
async function showQuizResults() {
    // ... existing score calculation code ...
    
    // ✨ NEW: Save quiz result to Firestore
    if (currentUser && db) {
        try {
            await addDoc(collection(db, 'quizResults'), {
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
                score: quizScore,
                topic: currentTopic || 'general',
                timestamp: Date.now(),
                totalQuestions: quizQuestions.length
            });
            console.log('✅ Quiz result saved!');
        } catch (error) {
            console.error('❌ Error saving quiz:', error);
        }
    }
    
    // ... rest of existing code ...
}
```

### 2.2 Create .env file

Create `.env` file in project root:
```bash
VITE_LEADERBOARD_API_URL=http://localhost:8080
```

(We'll update this after deploying the backend)

✅ Code is production-ready!

---

## Step 3: Deploy Frontend to Vercel (10 minutes)

### 3.1 Push to GitHub
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 3.2 Deploy on Vercel
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your `insight_xr` repository
5. Configure:
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 3.3 Add Environment Variables
In Vercel Dashboard → Settings → Environment Variables, add:

```
FIREBASE_API_KEY=AIzaSy...               (from Firebase Console)
FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
VITE_LEADERBOARD_API_URL=http://localhost:8080  (temporary, we'll update)
```

6. Click **Deploy**

✅ Frontend is live at: `https://your-app.vercel.app`

---

## Step 4: Deploy Java Backend to Railway (15 minutes)

### 4.1 Sign up for Railway
1. Go to https://railway.app
2. Sign up with GitHub (free $5/month credit)

### 4.2 Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your `insight_xr` repository
4. Railway will auto-detect it's a Java project

### 4.3 Configure Build
1. In Railway dashboard → Settings:
   - **Root Directory:** `java-leaderboard`
   - **Custom Build Command:**
     ```bash
     javac -cp "libs/*:src" -d bin src/com/insightxr/**/*.java
     ```
   - **Custom Start Command:**
     ```bash
     java -cp "libs/*:bin" com.insightxr.App
     ```

### 4.4 Add Service Account Key
1. In Railway → **Variables** tab
2. Click **"+ New Variable"**
3. Add: `GOOGLE_APPLICATION_CREDENTIALS=/app/serviceAccountKey.json`
4. Go to **Settings** → **Data** tab
5. Upload your `serviceAccountKey.json` file

### 4.5 Deploy
1. Click **Deploy**
2. Wait for build to complete
3. Copy your public URL (like `https://insight-xr-production.up.railway.app`)

✅ Backend is live!

---

## Step 5: Connect Frontend to Backend (5 minutes)

### 5.1 Update CORS in Java Backend

Open `java-leaderboard/src/com/insightxr/App.java` and find `setCorsHeaders()`:

```java
private static void setCorsHeaders(HttpExchange exchange) {
    Headers headers = exchange.getResponseHeaders();
    
    // Add your Vercel URL here:
    headers.add("Access-Control-Allow-Origin", "https://your-app.vercel.app");
    headers.add("Access-Control-Allow-Origin", "http://localhost:5173");
    
    headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.add("Access-Control-Allow-Headers", "Content-Type");
}
```

Commit and push changes:
```bash
git add .
git commit -m "Update CORS for production"
git push origin main
```

Railway will auto-redeploy.

### 5.2 Update Vercel Environment Variables

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Update `VITE_LEADERBOARD_API_URL`:
   ```
   VITE_LEADERBOARD_API_URL=https://your-backend.railway.app
   ```
3. Click **Save**
4. Go to Deployments → Click **"Redeploy"**

✅ Everything is connected!

---

## Step 6: Test Production (5 minutes)

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Sign in with Google
3. Navigate to Simulations → Take a quiz
4. Check Firebase Console → Firestore → `quizResults` collection
5. Go to Home page → Scroll to "Top Performers"
6. You should see the leaderboard loading!

### Verify:
- ✅ Login works
- ✅ Quiz scores save to Firestore
- ✅ Leaderboard loads (may take 10 min for first data)
- ✅ Refresh button works

---

## 🎉 You're Live!

Your app is now running in production with:
- ✅ Frontend on Vercel (fast, global CDN)
- ✅ Backend on Railway (always-on Java server)
- ✅ Database on Firebase Firestore (real-time, scalable)
- ✅ Authentication with Google Sign-In
- ✅ Leaderboard updating every 10 minutes

**Your URLs:**
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.railway.app`

---

## 🔧 Troubleshooting

### Leaderboard shows "service not running"
- Check Railway logs for errors
- Verify `VITE_LEADERBOARD_API_URL` in Vercel
- Check browser console for CORS errors

### Quiz scores not saving
- Check Firebase Console → Firestore for data
- Verify Firestore rules are correct
- Check browser console for errors

### Backend won't start
- Check Railway logs
- Verify `serviceAccountKey.json` was uploaded
- Make sure JDK 17 is being used

---

## 📊 Monitoring

- **Vercel:** Dashboard shows deploys, analytics, errors
- **Railway:** Logs show backend activity, errors
- **Firebase:** Console shows Firestore data, auth users

---

## 💰 Cost (Free Tier)

- **Vercel:** Free for hobby projects
- **Railway:** $5/month credit (free to start)
- **Firebase:** Free Spark plan (generous limits)

Total: **$0** to start, ~$5/month after Railway credit runs out

---

## 🚀 Next Steps

1. Add more quiz questions
2. Create weekly/monthly leaderboards
3. Add achievement badges
4. Send email notifications for rank changes
5. Add teacher dashboard

Need help with any step? Let me know!
