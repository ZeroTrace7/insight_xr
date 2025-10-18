/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Leaderboard Service - Fetches leaderboard data from Java backend
 */

export interface LeaderboardEntry {
    userId: string;
    totalScore: number;
}

export interface LeaderboardEntry {
    userName: string;
    totalScore: number;
}

export interface Leaderboard {
    generatedAt: number;
    entries: LeaderboardEntry[];
}

// Use environment variable for production, fallback to localhost for development
const LEADERBOARD_API_URL = import.meta.env.VITE_LEADERBOARD_API_URL || 'http://localhost:8080';

/**
 * Fetch the latest leaderboard
 */
export async function fetchLeaderboard(): Promise<Leaderboard> {
    try {
        const response = await fetch(`${LEADERBOARD_API_URL}/leaderboard/latest`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        // Return empty leaderboard on error
        return {
            generatedAt: Date.now(),
            entries: []
        };
    }
}

/**
 * Trigger a manual leaderboard update
 */
export async function triggerLeaderboardUpdate(): Promise<boolean> {
    try {
        const response = await fetch(`${LEADERBOARD_API_URL}/trigger-leaderboard`, {
            method: 'POST'
        });
        return response.ok;
    } catch (error) {
        console.error('Error triggering leaderboard update:', error);
        return false;
    }
}

/**
 * Get user's rank from leaderboard
 */
export function getUserRank(leaderboard: Leaderboard, userId: string): number | null {
    const index = leaderboard.entries.findIndex(entry => entry.userId === userId);
    return index >= 0 ? index + 1 : null;
}
