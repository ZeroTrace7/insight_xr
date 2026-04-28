package com.insightxr;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

public class InMemoryLeaderboardService implements ILeaderboard {
    private final Map<String, Integer> totals = new ConcurrentHashMap<>();
    private final Map<String, String> displayNames = new ConcurrentHashMap<>();

    public InMemoryLeaderboardService() {
        seedUser("tanish-id", "tanish", 100);
        seedUser("yash-raj-id", "Yash Raj", 95);
        seedUser("shreyash-id", "Shreyash", 70);
    }

    public void computeAndStoreDailyLeaderboard(int topN) throws ExecutionException, InterruptedException {
        // Event-driven scoring is handled via addPoints; no periodic recompute is needed.
    }

    public void addPoints(String userId, String userName, int points) throws ExecutionException, InterruptedException {
        if (userId == null || userId.isBlank()) {
            return;
        }
        if (points <= 0) {
            return;
        }

        String normalizedId = userId.trim();
        totals.merge(normalizedId, points, Integer::sum);

        if (userName != null && !userName.isBlank()) {
            displayNames.put(normalizedId, userName.trim());
        }
    }

    public String getLatestLeaderboardJson() throws ExecutionException, InterruptedException {
        List<Map.Entry<String, Integer>> list = new ArrayList<>(totals.entrySet());
        list.sort((a, b) -> Integer.compare(b.getValue(), a.getValue()));

        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"generatedAt\": ").append(System.currentTimeMillis()).append(",\n");
        sb.append("  \"entries\": [\n");

        boolean first = true;
        for (Map.Entry<String, Integer> entry : list) {
            if (!first) {
                sb.append(",\n");
            }
            first = false;
            String userId = entry.getKey();
            String userName = displayNames.getOrDefault(userId, userId);
            sb.append("    {\n");
            sb.append("      \"userId\": \"").append(escapeJson(userId)).append("\",\n");
            sb.append("      \"userName\": \"").append(escapeJson(userName)).append("\",\n");
            sb.append("      \"totalScore\": ").append(entry.getValue()).append("\n");
            sb.append("    }");
        }

        sb.append("\n  ]\n");
        sb.append("}");
        return sb.toString();
    }

    private void seedUser(String userId, String userName, int points) {
        totals.put(userId, points);
        displayNames.put(userId, userName);
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
