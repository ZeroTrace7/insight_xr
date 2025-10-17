# 🔥 Firebase Setup Guide - Complete Walkthrough

## 📋 Table of Contents
1. [Create Firebase Project](#step-1-create-firebase-project)
2. [Get API Keys](#step-2-get-api-keys)
3. [Enable Authentication](#step-3-enable-authentication)
4. [Setup Firestore Database](#step-4-setup-firestore-database)
5. [Setup Storage](#step-5-setup-storage)
6. [Configure Environment Variables](#step-6-configure-environment-variables)
7. [Deploy Security Rules](#step-7-deploy-security-rules)
8. [Test Your Setup](#step-8-test-your-setup)

---

## Step 1: Create Firebase Project

### 1.1 Go to Firebase Console
1. Open your browser and go to: **https://console.firebase.google.com/**
2. Click **"Get Started"** or **"Add Project"**

### 1.2 Create New Project
1. **Project Name**: Enter `insight-xr` (or any name you prefer)
2. Click **"Continue"**

### 1.3 Google Analytics (Optional)
1. **Enable Google Analytics?** - Choose Yes or No (recommended: Yes)
2. If Yes, select or create an Analytics account
3. Click **"Create Project"**
4. Wait 30-60 seconds for Firebase to set up your project
5. Click **"Continue"** when ready

---

## Step 2: Get API Keys

### 2.1 Register Your Web App
1. In the Firebase Console, you'll see your project dashboard
2. Click the **Web icon** (`</>`) to add a web app
   - Located in the center: "Get started by adding Firebase to your app"
3. **App nickname**: Enter `Insight XR Web`
4. **Firebase Hosting**: ✅ Check this box (we'll use it later)
5. Click **"Register app"**

### 2.2 Copy Your Configuration
You'll see a code snippet like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "insight-xr-12345.firebaseapp.com",
  projectId: "insight-xr-12345",
  storageBucket: "insight-xr-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### 2.3 Save These Values
**IMPORTANT**: Copy these values - you'll need them in Step 6!

---

## Step 3: Enable Authentication

### 3.1 Go to Authentication
1. In the left sidebar, click **"Build"** → **"Authentication"**
2. Click **"Get started"**

### 3.2 Enable Email/Password
1. Click the **"Sign-in method"** tab
2. Find **"Email/Password"** in the list
3. Click on it
4. Toggle **"Enable"** to ON
5. Click **"Save"**

### 3.3 Enable Google Sign-In
1. Still in the **"Sign-in method"** tab
2. Find **"Google"** in the list
3. Click on it
4. Toggle **"Enable"** to ON
5. **Project support email**: Select your email from dropdown
6. Click **"Save"**

### 3.4 Add Authorized Domains (for production)
1. Go to **"Settings"** tab in Authentication
2. Under **"Authorized domains"**, you'll see `localhost` (already there)
3. Later, add your production domain here (e.g., `insight-xr.web.app`)

---

## Step 4: Setup Firestore Database

### 4.1 Create Firestore Database
1. In the left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**

### 4.2 Choose Security Rules Mode
**IMPORTANT**: Choose **"Start in production mode"**
- We'll add custom security rules later
- Click **"Next"**

### 4.3 Choose Location
1. **Cloud Firestore location**: Choose closest to your users
   - `us-central1` (USA)
   - `europe-west1` (Europe)
   - `asia-south1` (India)
   - etc.
2. ⚠️ **WARNING**: This cannot be changed later!
3. Click **"Enable"**
4. Wait for Firestore to be created (~30 seconds)

### 4.4 Create Initial Collections (Optional)
Once created, you'll see an empty database. You can create collections now or let the app create them:

**Manual Setup** (Optional):
1. Click **"Start collection"**
2. Collection ID: `users`
3. Click **"Next"**
4. Document ID: (leave as Auto-ID)
5. Add fields:
   - Field: `email` | Type: string
   - Field: `role` | Type: string
6. Click **"Save"**

---

## Step 5: Setup Storage

### 5.1 Create Storage Bucket
1. In the left sidebar, click **"Build"** → **"Storage"**
2. Click **"Get started"**

### 5.2 Security Rules
1. Choose **"Start in production mode"**
2. Click **"Next"**

### 5.3 Choose Location
1. Use the **same location** as Firestore
2. Click **"Done"**
3. Wait for Storage to be created

---

## Step 6: Configure Environment Variables

### 6.1 Update .env.local File
1. Open your project folder: `c:\Users\HP\Downloads\insight_xr`
2. Open the file: `.env.local`
3. Replace the values with YOUR Firebase config from Step 2.2:

```env
# Gemini AI API Key (Get from: https://ai.google.dev/)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration (from Step 2.2)
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=insight-xr-12345.firebaseapp.com
FIREBASE_PROJECT_ID=insight-xr-12345
FIREBASE_STORAGE_BUCKET=insight-xr-12345.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### 6.2 Get Gemini API Key
1. Go to: **https://ai.google.dev/**
2. Click **"Get API key"**
3. Sign in with your Google account
4. Click **"Create API key in new project"** (or use existing)
5. Copy the API key
6. Paste it in `.env.local` as `GEMINI_API_KEY`

### 6.3 Save the File
- **IMPORTANT**: Save `.env.local`
- This file is in `.gitignore` and won't be uploaded to GitHub (for security)

---

## Step 7: Deploy Security Rules

### 7.1 Install Firebase CLI
Open PowerShell and run:

```powershell
npm install -g firebase-tools
```

### 7.2 Login to Firebase
```powershell
firebase login
```
- A browser window will open
- Sign in with the same Google account you used for Firebase Console
- Grant permissions
- Return to PowerShell

### 7.3 Initialize Firebase in Your Project
```powershell
cd c:\Users\HP\Downloads\insight_xr
firebase init
```

### 7.4 Configure Firebase Init
You'll be asked several questions:

**1. Which Firebase features do you want to set up?**
- Use arrow keys and SPACE to select:
  - ✅ Firestore
  - ✅ Storage
  - ✅ Hosting
- Press ENTER

**2. Please select an option:**
- Choose: **"Use an existing project"**
- Press ENTER

**3. Select a default Firebase project:**
- Choose your project: `insight-xr-12345`
- Press ENTER

**4. What file should be used for Firestore Rules?**
- Press ENTER (accept default: `firestore.rules`)

**5. What file should be used for Firestore indexes?**
- Press ENTER (accept default: `firestore.indexes.json`)

**6. What file should be used for Storage Rules?**
- Press ENTER (accept default: `storage.rules`)

**7. What do you want to use as your public directory?**
- Type: `dist`
- Press ENTER

**8. Configure as a single-page app (rewrite all urls to /index.html)?**
- Type: `y`
- Press ENTER

**9. Set up automatic builds and deploys with GitHub?**
- Type: `n`
- Press ENTER

**10. File dist/index.html already exists. Overwrite?**
- Type: `n`
- Press ENTER

### 7.5 Deploy Security Rules
```powershell
firebase deploy --only firestore:rules,storage
```

You should see:
```
✔ Deploy complete!
```

---

## Step 8: Test Your Setup

### 8.1 Run Your App
```powershell
npm run dev
```

### 8.2 Open Browser
1. Go to: **http://localhost:5173**
2. You should see your Insight XR app!

### 8.3 Test Authentication
1. Click **"Sign Up"** or **"Login"**
2. Try creating an account with email/password
3. Try logging in with Google

### 8.4 Verify in Firebase Console
1. Go back to Firebase Console
2. Click **"Authentication"** → **"Users"** tab
3. You should see your newly created user!

### 8.5 Test Database
1. In Firebase Console, go to **"Firestore Database"**
2. After using the app (completing a quiz, etc.), you should see data appear

---

## 🎉 Congratulations!

Your Firebase is now fully configured and activated! 

### ✅ What You've Set Up:
- ✅ Firebase Project created
- ✅ Web app registered
- ✅ API keys configured
- ✅ Email/Password authentication enabled
- ✅ Google OAuth enabled
- ✅ Firestore database created
- ✅ Storage bucket created
- ✅ Security rules deployed
- ✅ Environment variables configured
- ✅ Firebase CLI installed and initialized

### 🚀 Next Steps:

1. **Test All Features**:
   - Sign up/Login
   - Take a quiz
   - View achievements
   - Chat with AI tutor

2. **Deploy to Production**:
   ```powershell
   npm run build
   firebase deploy
   ```

3. **Monitor Usage**:
   - Go to Firebase Console
   - Check usage statistics
   - Set up billing alerts (Firebase has a free tier!)

---

## 🔧 Troubleshooting

### Problem: "Firebase: Error (auth/unauthorized-domain)"
**Solution**: Add your domain to authorized domains
1. Firebase Console → Authentication → Settings
2. Add your domain under "Authorized domains"

### Problem: "Permission denied" in Firestore
**Solution**: Check security rules
```powershell
firebase deploy --only firestore:rules
```

### Problem: Environment variables not loading
**Solution**: 
1. Make sure `.env.local` exists in root folder
2. Restart dev server: `npm run dev`
3. Check `vite.config.ts` has correct mappings

### Problem: "API key not valid"
**Solution**:
1. Check you copied the FULL API key
2. No extra spaces in `.env.local`
3. Regenerate API key in Firebase Console if needed

---

## 📚 Additional Resources

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firebase Console**: https://console.firebase.google.com/
- **Gemini AI**: https://ai.google.dev/
- **Vite Environment Variables**: https://vitejs.dev/guide/env-and-mode.html

---

## 🔒 Security Best Practices

1. ✅ **Never commit `.env.local`** to GitHub
2. ✅ **Use different API keys** for development and production
3. ✅ **Enable App Check** (in Firebase Console) for production
4. ✅ **Review security rules** regularly
5. ✅ **Monitor Firebase usage** to avoid unexpected costs
6. ✅ **Set up billing alerts** in Google Cloud Console

---

**Last Updated**: October 17, 2025  
**Project**: Insight XR  
**Status**: Production Ready 🚀
