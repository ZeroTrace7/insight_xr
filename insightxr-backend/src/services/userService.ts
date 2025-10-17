/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: 'student' | 'teacher' | 'admin';
    
    // Learning Stats
    stats: {
        modulesCompleted: number;
        totalTimeSpent: number; // in minutes
        currentStreak: number; // in days
        lastActiveDate: Date | null;
        averageScore: number;
        totalQuizzesTaken: number;
        totalPoints: number;
    };
    
    // Progress tracking
    moduleProgress: {
        [moduleKey: string]: {
            started: boolean;
            completed: boolean;
            lastAccessed: Date;
            timeSpent: number; // in minutes
        };
    };
    
    // Achievements
    achievements: string[]; // Array of achievement IDs
}

export interface QuizResult {
    id?: string;
    userId: string;
    moduleKey: string;
    score: number;
    totalQuestions: number;
    answers: {
        questionIndex: number;
        selectedAnswer: number;
        correctAnswer: number;
        isCorrect: boolean;
    }[];
    completedAt: Date;
    timeSpent: number; // in seconds
}

export interface LearningSession {
    id?: string;
    userId: string;
    moduleKey: string;
    startTime: Date;
    endTime?: Date;
    duration?: number; // in minutes
    activityType: 'simulation' | 'quiz' | 'chat' | '3d-model' | 'programming';
}

/**
 * Create or update user profile in Firestore
 */
export async function createUserProfile(user: User, additionalData?: Partial<UserProfile>): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        // Create new user profile
        const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: new Date(),
            updatedAt: new Date(),
            role: 'student',
            stats: {
                modulesCompleted: 0,
                totalTimeSpent: 0,
                currentStreak: 0,
                lastActiveDate: null,
                averageScore: 0,
                totalQuizzesTaken: 0,
                totalPoints: 0,
            },
            moduleProgress: {},
            achievements: [],
            ...additionalData,
        };
        
        await setDoc(userRef, newProfile);
    } else {
        // Update existing user
        await updateDoc(userRef, {
            updatedAt: new Date(),
            ...additionalData,
        });
    }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        const data = userSnap.data();
        return {
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            stats: {
                ...data.stats,
                lastActiveDate: data.stats?.lastActiveDate?.toDate() || null,
            },
        } as UserProfile;
    }
    
    return null;
}

/**
 * Update user statistics
 */
export async function updateUserStats(userId: string, statsUpdate: Partial<UserProfile['stats']>): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const userRef = doc(db, 'users', userId);
    const updates: any = {
        updatedAt: new Date(),
    };
    
    // Build nested update path
    Object.keys(statsUpdate).forEach(key => {
        updates[`stats.${key}`] = statsUpdate[key as keyof UserProfile['stats']];
    });
    
    await updateDoc(userRef, updates);
}

/**
 * Update user's module progress
 */
export async function updateModuleProgress(
    userId: string,
    moduleKey: string,
    progress: Partial<UserProfile['moduleProgress'][string]>
): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const userRef = doc(db, 'users', userId);
    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) throw new Error('User profile not found');
    
    const currentProgress = userProfile.moduleProgress[moduleKey] || {
        started: false,
        completed: false,
        lastAccessed: new Date(),
        timeSpent: 0,
    };
    
    const updatedProgress = {
        ...currentProgress,
        ...progress,
        lastAccessed: new Date(),
    };
    
    await updateDoc(userRef, {
        [`moduleProgress.${moduleKey}`]: updatedProgress,
        updatedAt: new Date(),
    });
}

/**
 * Save quiz result
 */
export async function saveQuizResult(result: QuizResult): Promise<string> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const quizRef = doc(collection(db, 'quizResults'));
    await setDoc(quizRef, {
        ...result,
        completedAt: Timestamp.fromDate(result.completedAt),
    });
    
    // Update user stats
    const userProfile = await getUserProfile(result.userId);
    if (userProfile) {
        const newTotalQuizzes = userProfile.stats.totalQuizzesTaken + 1;
        const currentAvg = userProfile.stats.averageScore;
        const newAverage = ((currentAvg * userProfile.stats.totalQuizzesTaken) + (result.score / result.totalQuestions * 100)) / newTotalQuizzes;
        
        await updateUserStats(result.userId, {
            totalQuizzesTaken: newTotalQuizzes,
            averageScore: Math.round(newAverage),
            totalPoints: userProfile.stats.totalPoints + result.score * 10,
        });
    }
    
    return quizRef.id;
}

/**
 * Get user's quiz history
 */
export async function getUserQuizHistory(userId: string, limit: number = 10): Promise<QuizResult[]> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const q = query(
        collection(db, 'quizResults'),
        where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const results: QuizResult[] = [];
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        results.push({
            id: doc.id,
            ...data,
            completedAt: data.completedAt?.toDate() || new Date(),
        } as QuizResult);
    });
    
    // Sort by date, most recent first
    results.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    
    return results.slice(0, limit);
}

/**
 * Start a learning session
 */
export async function startLearningSession(
    userId: string,
    moduleKey: string,
    activityType: LearningSession['activityType']
): Promise<string> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const sessionRef = doc(collection(db, 'learningSessions'));
    const session: LearningSession = {
        userId,
        moduleKey,
        activityType,
        startTime: new Date(),
    };
    
    await setDoc(sessionRef, {
        ...session,
        startTime: Timestamp.fromDate(session.startTime),
    });
    
    // Mark module as started
    await updateModuleProgress(userId, moduleKey, { started: true });
    
    return sessionRef.id;
}

/**
 * End a learning session
 */
export async function endLearningSession(sessionId: string): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const sessionRef = doc(db, 'learningSessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) throw new Error('Session not found');
    
    const sessionData = sessionSnap.data();
    const startTime = sessionData.startTime.toDate();
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // in minutes
    
    await updateDoc(sessionRef, {
        endTime: Timestamp.fromDate(endTime),
        duration,
    });
    
    // Update user's total time spent
    const userProfile = await getUserProfile(sessionData.userId);
    if (userProfile) {
        await updateUserStats(sessionData.userId, {
            totalTimeSpent: userProfile.stats.totalTimeSpent + duration,
            lastActiveDate: new Date(),
        });
        
        // Update module progress time
        const currentModuleProgress = userProfile.moduleProgress[sessionData.moduleKey];
        if (currentModuleProgress) {
            await updateModuleProgress(sessionData.userId, sessionData.moduleKey, {
                timeSpent: currentModuleProgress.timeSpent + duration,
            });
        }
    }
}

/**
 * Award achievement to user
 */
export async function awardAchievement(userId: string, achievementId: string): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const userRef = doc(db, 'users', userId);
    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) throw new Error('User profile not found');
    
    if (!userProfile.achievements.includes(achievementId)) {
        await updateDoc(userRef, {
            achievements: [...userProfile.achievements, achievementId],
            updatedAt: new Date(),
        });
    }
}

/**
 * Update user's daily streak
 */
export async function updateDailyStreak(userId: string): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const userProfile = await getUserProfile(userId);
    if (!userProfile) throw new Error('User profile not found');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActive = userProfile.stats.lastActiveDate;
    let newStreak = userProfile.stats.currentStreak;
    
    if (!lastActive) {
        // First day
        newStreak = 1;
    } else {
        const lastActiveDate = new Date(lastActive);
        lastActiveDate.setHours(0, 0, 0, 0);
        
        const dayDiff = Math.floor((today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
            // Consecutive day
            newStreak += 1;
        } else if (dayDiff > 1) {
            // Streak broken
            newStreak = 1;
        }
        // If dayDiff === 0, same day, don't change streak
    }
    
    await updateUserStats(userId, {
        currentStreak: newStreak,
        lastActiveDate: new Date(),
    });
}

/**
 * Get all students (for teacher dashboard)
 */
export async function getAllStudents(): Promise<UserProfile[]> {
    if (!db) throw new Error('Firestore is not initialized');
    
    const q = query(
        collection(db, 'users'),
        where('role', '==', 'student')
    );
    
    const querySnapshot = await getDocs(q);
    const students: UserProfile[] = [];
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            stats: {
                ...data.stats,
                lastActiveDate: data.stats?.lastActiveDate?.toDate() || null,
            },
        } as UserProfile);
    });
    
    return students;
}
