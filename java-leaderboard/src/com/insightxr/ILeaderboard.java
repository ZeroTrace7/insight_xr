package com.insightxr;

import java.util.concurrent.ExecutionException;

public interface ILeaderboard {
    void computeAndStoreDailyLeaderboard(int topN) throws ExecutionException, InterruptedException;
    void addPoints(String userId, String userName, int points) throws ExecutionException, InterruptedException;
    String getLatestLeaderboardJson() throws ExecutionException, InterruptedException;
}
