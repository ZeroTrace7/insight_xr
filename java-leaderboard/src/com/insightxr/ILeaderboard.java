package com.insightxr;

import java.util.concurrent.ExecutionException;

public interface ILeaderboard {
    void computeAndStoreDailyLeaderboard(int topN) throws ExecutionException, InterruptedException;
    String getLatestLeaderboardJson() throws ExecutionException, InterruptedException;
}
