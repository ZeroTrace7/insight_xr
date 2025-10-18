# 🔥 Insight XR Backend

> Firebase-powered backend services for the Insight XR immersive STEM education platform

[![Firebase](https://img.shields.io/badge/Firebase-10.12.2-orange)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
npm install -g firebase-tools
```

### Configure Firebase
```bash
# Copy environment template
cp .env.example ../.env.local
# Edit .env.local with your Firebase credentials from console.firebase.google.com
```

### Deploy Security Rules
```bash
npm run firebase:login
npm run firebase:init
npm run deploy:rules
```

### Run
```bash
npm run emulators:start  # For local testing
cd .. && npm run dev     # Run main app
```

## 🎯 Features

- **User Management**: Profile creation, role-based access (student/teacher/admin), authentication
- **Learning Analytics**: Quiz tracking, session monitoring, progress tracking, streak calculation
- **Achievement System**: 10 predefined achievements with automatic unlock logic
- **Security**: Firestore & Storage security rules, data validation, user isolation
- **Performance**: Local caching, request batching, rate limiting, data compression

## 📊 Database Structure

### `users/{userId}`
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
  stats: {
    modulesCompleted: number;
    totalTimeSpent: number;
    currentStreak: number;
    averageScore: number;
    totalQuizzesTaken: number;
    totalPoints: number;
  };
  achievements: string[];
}
```

### `quizResults/{resultId}`
```typescript
{
  userId: string;
  moduleKey: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  timeSpent: number;
}
```

## 🔧 API Usage

### User Service
```typescript
import { createUserProfile, getUserProfile, updateUserStats } from './src/services/userService';

await createUserProfile(user, { role: 'student' });
const profile = await getUserProfile(userId);
await updateUserStats(userId, { totalQuizzesTaken: 5, averageScore: 85 });
```

### Quiz Management
```typescript
import { saveQuizResult, getQuizResults } from './src/services/userService';

await saveQuizResult({
  userId: 'user123',
  moduleKey: 'photosynthesis',
  score: 8,
  totalQuestions: 10,
  completedAt: new Date()
});
```

### Achievements
```typescript
import { updateAchievements } from './src/services/userService';
await updateAchievements(userId);
```

## 🛠️ NPM Scripts

- `npm run deploy:rules` - Deploy Firestore & Storage security rules
- `npm run deploy:all` - Deploy everything to Firebase
- `npm run firebase:login` - Login to Firebase CLI
- `npm run emulators:start` - Start Firebase local emulators
- `npm run check` - Type check TypeScript files

## 🔐 Security Rules

### Firestore
```javascript
// Users access own data only
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}
// Teachers view students, admins have full access
```

### Storage
```javascript
// 5MB file size limit, images only
allow write: if request.resource.size < 5 * 1024 * 1024 
  && request.resource.contentType.matches('image/.*');
```

## 🔄 Frontend Integration

```typescript
// Import services
import { getUserProfile, saveQuizResult } from './insightxr-backend/src/services/userService';
import { auth, db, storage } from './insightxr-backend/src/firebase';
```

## 📝 Environment Variables

Add to `../.env.local`:
```bash
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
```

## 🐛 Troubleshooting

**Firebase not initialized**
- Check `.env.local` has correct values
- Restart dev server

**Permission denied**
- Deploy rules: `npm run deploy:rules`
- Verify user authentication

**Module not found**
- Run `npm install`
- Check import paths

## 📚 Documentation

Detailed guides in `docs/` folder:
- `BACKEND_README.md` - Quick start guide
- `FIREBASE_SETUP.md` - Firebase configuration
- `INTEGRATION_STEPS.md` - Frontend integration
- `ARCHITECTURE.md` - System architecture

## 🚀 Deployment

```bash
# Set production environment variables
cp .env.example .env.production

# Deploy security rules
npm run deploy:rules

# Deploy to production
npm run deploy:all
```

## 📄 License

Apache License 2.0

## 🆘 Support

- Documentation: Check `docs/` folder
- Issues: Open a GitHub issue
- Firebase Support: https://firebase.google.com/support

**Built with ❤️ for immersive STEM education**

Questions? Check `docs/BACKEND_README.md` or open an issue!
