/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Integration Guide: How to connect Firebase backend to existing Insight XR frontend
 */

// ================================
// STEP 1: Update index.tsx imports
// ================================

// Add these imports at the top of index.tsx:
/*
import {
    createUserProfile,
    getUserProfile,
    updateUserStats,
    updateModuleProgress,
    saveQuizResult,
    startLearningSession,
    endLearningSession,
    updateDailyStreak,
    awardAchievement,
    getAllStudents,
    UserProfile
} from './src/services/userService';
import { checkAndAwardAchievements } from './src/utils/achievements';
*/

// ================================
// STEP 2: Add session tracking
// ================================

// Add these global variables in index.tsx after line 551:
/*
let currentSessionId: string | null = null;
let userProfile: UserProfile | null = null;
*/

// ================================
// STEP 3: Update showApp() function
// ================================

// Replace the existing showApp() function (around line 1000) with:
/*
async function showApp(user: User) {
    authPage.style.display = 'none';
    mainContent.style.display = 'block';
    bottomNav.style.display = 'flex';
    if(themeToggleButton) themeToggleButton.style.display = 'flex';
    
    try {
        // Load user profile from Firestore
        userProfile = await getUserProfile(user.uid);
        
        if (!userProfile) {
            // Create profile if it doesn't exist
            await createUserProfile(user);
            userProfile = await getUserProfile(user.uid);
        }
        
        // Update daily streak
        await updateDailyStreak(user.uid);
        
        // Check for new achievements
        const newAchievements = checkAndAwardAchievements(userProfile!);
        for (const achievementId of newAchievements) {
            await awardAchievement(user.uid, achievementId);
        }
        
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
    
    // Personalize UI
    const name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    // Dynamic greeting based on time of day
    const currentHour = new Date().getHours();
    let greeting = "Good morning";
    if (currentHour >= 12 && currentHour < 18) {
        greeting = "Good afternoon";
    } else if (currentHour >= 18 || currentHour < 5) {
        greeting = "Good evening";
    }
    
    welcomeHeader.textContent = `${greeting}, ${capitalizedName}!`;
    profileName.textContent = capitalizedName;
    profileEmail.textContent = user.email;

    if (user.photoURL) {
        profileAvatarImg.src = user.photoURL;
    }
    
    // Update profile stats from Firestore
    if (userProfile) {
        updateProfileUI(userProfile);
    }

    navigateTo('home');
}
*/

// ================================
// STEP 4: Add UI update function
// ================================

// Add this new function after showApp():
/*
function updateProfileUI(profile: UserProfile) {
    // Update profile statistics
    const modulesCompletedEl = document.querySelector('.profile-stat-card:nth-child(1) .stat-value');
    if (modulesCompletedEl) {
        modulesCompletedEl.textContent = `${profile.stats.modulesCompleted} / 6`;
    }
    
    const timeSpentEl = document.querySelector('.profile-stat-card:nth-child(2) .stat-value');
    if (timeSpentEl) {
        const hours = Math.floor(profile.stats.totalTimeSpent / 60);
        const mins = profile.stats.totalTimeSpent % 60;
        timeSpentEl.textContent = `${hours}h ${mins}m`;
    }
    
    const streakEl = document.querySelector('.profile-stat-card:nth-child(3) .stat-value');
    if (streakEl) {
        streakEl.textContent = `${profile.stats.currentStreak} Days`;
    }
    
    const scoreEl = document.querySelector('.profile-stat-card:nth-child(4) .stat-value');
    if (scoreEl) {
        scoreEl.textContent = `${profile.stats.averageScore}%`;
    }
    
    // Update achievement badges
    const achievementBadges = document.querySelectorAll('.achievement-badge');
    achievementBadges.forEach((badge, index) => {
        const achievementId = badge.getAttribute('data-achievement-id');
        if (achievementId && profile.achievements.includes(achievementId)) {
            badge.classList.remove('locked');
            badge.classList.add('earned');
        }
    });
}
*/

// ================================
// STEP 5: Update module card clicks
// ================================

// Replace showDetailPage() function (around line 1282) with:
/*
async function showDetailPage(moduleKey: ModuleKey) {
    const data = moduleData[moduleKey];
    if (!data) return;

    detailTitle.textContent = data.title;
    detailDescription.textContent = data.description;
    detailImage.style.backgroundImage = data.image;

    const detailStartButton = document.getElementById('detail-start-button');
    if (!detailStartButton || !detailStartButton.parentNode) return;

    const newButton = detailStartButton.cloneNode(true) as HTMLButtonElement;
    detailStartButton.parentNode.replaceChild(newButton, detailStartButton);
    
    newButton.addEventListener('click', async () => {
        // Start learning session
        if (currentUser && currentSessionId === null) {
            try {
                currentSessionId = await startLearningSession(
                    currentUser.uid, 
                    moduleKey, 
                    data.targetTab === '3d' ? '3d-model' : 'simulation'
                );
            } catch (error) {
                console.error('Error starting session:', error);
            }
        }
        
        navigateTo('simulations');
        switchTab(data.targetTab);
        if (data.targetTab === '3d') {
            load3DModel((data as ThreeDModuleData).modelType, data.title);
        }
        
        // Mark module as started
        if (currentUser) {
            await updateModuleProgress(currentUser.uid, moduleKey, { started: true });
        }
    });

    navigateTo('detail');
}
*/

// ================================
// STEP 6: Update quiz submission
// ================================

// Replace showQuizResults() function (around line 1669) with:
/*
async function showQuizResults() {
    if (!currentQuizTopic || !currentUser) return;
    const questions = questionBank[currentQuizTopic];
    
    quizActiveSession.classList.add('hidden');
    quizResults.classList.remove('hidden');

    quizPageTitle.textContent = "Quiz Assessment";
    quizPageSubtitle.textContent = `Here's how you did on the ${moduleData[currentQuizTopic].title} quiz.`;
    
    quizScore.textContent = `You scored ${score} out of ${questions.length}!`;
    
    // Save quiz result to Firestore
    try {
        await saveQuizResult({
            userId: currentUser.uid,
            moduleKey: currentQuizTopic,
            score: score,
            totalQuestions: questions.length,
            answers: userAnswers.map((ans, idx) => ({
                questionIndex: idx,
                selectedAnswer: ans.selected,
                correctAnswer: ans.correct,
                isCorrect: ans.selected === ans.correct,
            })),
            completedAt: new Date(),
            timeSpent: 0, // You can track this if needed
        });
        
        // Check if module should be marked as completed
        if (score === questions.length) {
            await updateModuleProgress(currentUser.uid, currentQuizTopic, {
                completed: true,
            });
            
            // Update stats
            const currentProfile = await getUserProfile(currentUser.uid);
            if (currentProfile) {
                const completedModules = Object.values(currentProfile.moduleProgress)
                    .filter(p => p.completed).length;
                await updateUserStats(currentUser.uid, {
                    modulesCompleted: completedModules,
                });
            }
        }
        
        // Refresh user profile
        userProfile = await getUserProfile(currentUser.uid);
        if (userProfile) {
            updateProfileUI(userProfile);
            
            // Check for new achievements
            const newAchievements = checkAndAwardAchievements(userProfile);
            for (const achievementId of newAchievements) {
                await awardAchievement(currentUser.uid, achievementId);
                // Show achievement notification (implement this UI)
                console.log(`🎉 New achievement unlocked: ${achievementId}`);
            }
        }
    } catch (error) {
        console.error('Error saving quiz result:', error);
    }
    
    quizReviewList.innerHTML = '';
    userAnswers.forEach((answer, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = 'review-item';

        const optionsHtml = answer.options.map((option, i) => {
            let className = '';
            if (i === answer.correct) {
                className = 'correct';
            } else if (i === answer.selected) {
                className = 'user-incorrect';
            }
            return `<div class="review-item-option ${className}">${option}</div>`;
        }).join('');

        reviewItem.innerHTML = `
            <p class="review-item-question">${index + 1}. ${answer.question}</p>
            <div class="review-item-options">${optionsHtml}</div>
            <p class="review-item-explanation">${answer.explanation}</p>
        `;
        quizReviewList.appendChild(reviewItem);
    });
}
*/

// ================================
// STEP 7: Add session cleanup
// ================================

// Add this function after showQuizResults():
/*
async function endCurrentSession() {
    if (currentSessionId) {
        try {
            await endLearningSession(currentSessionId);
            currentSessionId = null;
        } catch (error) {
            console.error('Error ending session:', error);
        }
    }
}
*/

// Update navigateTo() function to end sessions when leaving simulations:
/*
function navigateTo(pageName: PageName) {
    // End session if leaving simulations page
    if (pageName !== 'simulations' && currentSessionId) {
        endCurrentSession();
    }
    
    if (pageName === 'auth') {
        showAuthPage();
        return;
    }
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) targetPage.classList.add('active');
    
    Object.values(navButtons).forEach(button => button.classList.remove('active'));
    if (navButtons[pageName]) {
        navButtons[pageName].classList.add('active');
    } else if (pageName === 'detail' || pageName === 'quiz' || pageName === 'review') {
        navButtons.home.classList.add('active');
    }
}
*/

// ================================
// STEP 8: Update dashboard for teachers
// ================================

// Add this function to load teacher dashboard:
/*
async function loadTeacherDashboard() {
    if (!currentUser || !userProfile) return;
    
    if (userProfile.role !== 'teacher' && userProfile.role !== 'admin') {
        // Hide dashboard nav for students
        navButtons.dashboard.style.display = 'none';
        return;
    }
    
    try {
        const students = await getAllStudents();
        
        // Calculate statistics
        const totalStudents = students.length;
        const activeStudents = students.filter(s => {
            if (!s.stats.lastActiveDate) return false;
            const daysSinceActive = Math.floor(
                (Date.now() - new Date(s.stats.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysSinceActive <= 7;
        }).length;
        
        const avgProgress = students.reduce((sum, s) => sum + s.stats.modulesCompleted, 0) / totalStudents;
        const totalModulesCompleted = students.reduce((sum, s) => sum + s.stats.modulesCompleted, 0);
        const avgTimePerSession = students.reduce((sum, s) => sum + s.stats.totalTimeSpent, 0) / totalStudents;
        
        // Update dashboard UI
        const statsCards = document.querySelectorAll('.stat-card');
        if (statsCards[0]) {
            statsCards[0].querySelector('h3')!.textContent = `${Math.round(avgProgress / 6 * 100)}%`;
        }
        if (statsCards[1]) {
            statsCards[1].querySelector('h3')!.textContent = `${totalModulesCompleted}`;
        }
        if (statsCards[2]) {
            statsCards[2].querySelector('h3')!.textContent = `${activeStudents}`;
        }
        if (statsCards[3]) {
            statsCards[3].querySelector('h3')!.textContent = `${Math.round(avgTimePerSession)}min`;
        }
        
    } catch (error) {
        console.error('Error loading teacher dashboard:', error);
    }
}
*/

// Call this when navigating to dashboard:
// Add to navigateTo() function:
/*
if (pageName === 'dashboard') {
    loadTeacherDashboard();
}
*/

// ================================
// STEP 9: Add achievement badges
// ================================

// Update HTML achievement badges (around line 467-498 in index.html):
// Add data-achievement-id attribute to each badge:
/*
<div class="achievement-badge earned" data-achievement-id="gene-genius">
    ...
</div>
<div class="achievement-badge earned" data-achievement-id="circuit-master">
    ...
</div>
// etc...
*/

// ================================
// STEP 10: Handle auth state
// ================================

// The existing onAuthStateChanged (around line 897) is already good!
// It will automatically call showApp() which now loads the profile.

// ================================
// SUMMARY OF CHANGES
// ================================

/*
Files to modify:
1. index.tsx - Add all the functions above
2. index.html - Add data-achievement-id attributes to badges

New files created:
1. src/services/userService.ts - Database operations
2. src/utils/achievements.ts - Achievement logic
3. firestore.rules - Security rules
4. storage.rules - Storage security
5. FIREBASE_SETUP.md - Setup guide
6. This file - Integration guide

After integration, your app will:
✅ Save user profiles to Firestore
✅ Track learning progress
✅ Save quiz scores
✅ Track time spent on modules
✅ Award achievements automatically
✅ Track daily streaks
✅ Show real statistics in profile
✅ Enable teacher dashboard
✅ Persist all user data
*/
