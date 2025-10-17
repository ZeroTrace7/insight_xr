/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Insight XR Backend - Main Entry Point
 * 
 * Import all backend services, utilities, and configurations from this single file.
 * 
 * @example
 * ```typescript
 * // Import everything
 * import * as Backend from './insightxr-backend';
 * 
 * // Or import specific modules
 * import { auth, db, storage } from './insightxr-backend';
 * import { createUserProfile, getUserProfile } from './insightxr-backend';
 * ```
 */

// Firebase Core
export { 
  auth, 
  db, 
  storage, 
  googleProvider, 
  isFirebaseConfigured 
} from './src/firebase';

// User Service
export {
  // Types
  type UserProfile,
  type QuizResult,
  type LearningSession,
  
  // User Management
  createUserProfile,
  getUserProfile,
  updateUserStats,
  
  // Quiz Management
  saveQuizResult,
  getUserQuizHistory,
  
  // Learning Sessions
  startLearningSession,
  endLearningSession,
  
  // Module Progress
  updateModuleProgress,
  
  // Achievements
  awardAchievement,
  updateDailyStreak,
  
  // Admin/Teacher
  getAllStudents
} from './src/services/userService';

// Achievement System
export {
  type Achievement,
  ACHIEVEMENTS,
  checkAndAwardAchievements,
  getAchievementById,
  calculateAchievementPoints
} from './src/utils/achievements';

// Error Handling & Notifications
export {
  notify,
  ErrorHandler
} from './src/utils/errorHandling';

// Performance Optimization
export {
  LocalCache,
  RequestBatcher,
  debounce,
  throttle,
  preloadImages
} from './src/utils/performance';

// Package Information
export const BACKEND_VERSION = '1.0.0';
export const BACKEND_NAME = 'insightxr-backend';
