/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Achievement definitions and unlock logic
 */

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    condition: (userProfile: any) => boolean;
    points: number;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'gene-genius',
        title: 'Gene Genius',
        description: 'Completed DNA Replication module',
        icon: 'medal-dna',
        condition: (profile) => profile.moduleProgress?.dna?.completed === true,
        points: 100,
    },
    {
        id: 'circuit-master',
        title: 'Master of Circuits',
        description: "Completed Ohm's Law module",
        icon: 'medal-circuits',
        condition: (profile) => profile.moduleProgress?.ohms?.completed === true,
        points: 100,
    },
    {
        id: 'cosmic-explorer',
        title: 'Cosmic Explorer',
        description: 'Completed Solar System module',
        icon: 'medal-solar',
        condition: (profile) => profile.moduleProgress?.solar?.completed === true,
        points: 100,
    },
    {
        id: 'wave-rider',
        title: 'Wave Rider',
        description: 'Completed Electromagnetic Waves module',
        icon: 'medal-em',
        condition: (profile) => profile.moduleProgress?.em?.completed === true,
        points: 100,
    },
    {
        id: 'quantum-leap',
        title: 'Quantum Leap',
        description: 'Completed Atom Model module',
        icon: 'medal-atom',
        condition: (profile) => profile.moduleProgress?.atomic?.completed === true,
        points: 100,
    },
    {
        id: 'code-warrior',
        title: 'Code Warrior',
        description: 'Completed Java Fundamentals module',
        icon: 'medal-programming',
        condition: (profile) => profile.moduleProgress?.programming?.completed === true,
        points: 100,
    },
    {
        id: 'quiz-master',
        title: 'Quiz Master',
        description: 'Scored 100% on any quiz',
        icon: 'medal-quiz',
        condition: (profile) => profile.stats?.averageScore === 100,
        points: 150,
    },
    {
        id: 'dedicated-learner',
        title: 'Dedicated Learner',
        description: 'Maintained a 7-day learning streak',
        icon: 'medal-streak',
        condition: (profile) => profile.stats?.currentStreak >= 7,
        points: 200,
    },
    {
        id: 'scholar',
        title: 'Scholar',
        description: 'Completed all modules',
        icon: 'medal-scholar',
        condition: (profile) => {
            const progress = profile.moduleProgress || {};
            const allModules = ['dna', 'ohms', 'em', 'atomic', 'solar', 'programming'];
            return allModules.every(mod => progress[mod]?.completed === true);
        },
        points: 500,
    },
    {
        id: 'time-traveler',
        title: 'Time Traveler',
        description: 'Spent 10+ hours learning',
        icon: 'medal-time',
        condition: (profile) => profile.stats?.totalTimeSpent >= 600, // 600 minutes = 10 hours
        points: 300,
    },
];

/**
 * Check and award achievements for a user
 */
export function checkAndAwardAchievements(userProfile: any): string[] {
    const newAchievements: string[] = [];
    const currentAchievements = userProfile.achievements || [];
    
    ACHIEVEMENTS.forEach(achievement => {
        // Check if user doesn't have this achievement yet
        if (!currentAchievements.includes(achievement.id)) {
            // Check if condition is met
            if (achievement.condition(userProfile)) {
                newAchievements.push(achievement.id);
            }
        }
    });
    
    return newAchievements;
}

/**
 * Get achievement details by ID
 */
export function getAchievementById(id: string): Achievement | undefined {
    return ACHIEVEMENTS.find(a => a.id === id);
}

/**
 * Calculate total points from achievements
 */
export function calculateAchievementPoints(achievementIds: string[]): number {
    return achievementIds.reduce((total, id) => {
        const achievement = getAchievementById(id);
        return total + (achievement?.points || 0);
    }, 0);
}
