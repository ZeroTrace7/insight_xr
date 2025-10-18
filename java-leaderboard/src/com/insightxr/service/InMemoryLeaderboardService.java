package com.insightxr.service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

public class InMemoryLeaderboardService implements ILeaderboard {
    private final Map<String,Integer> totals = new ConcurrentHashMap<>();

    public InMemoryLeaderboardService() {
        // seed with a few demo users
        totals.put("demo-alice", 120);
        totals.put("demo-bob", 95);
        totals.put("demo-charlie", 70);
    }

    public void computeAndStoreDailyLeaderboard(int topN) throws ExecutionException, InterruptedException {
        // In-memory: pretend we recomputed; maybe add a small random delta
        totals.computeIfPresent("demo-alice", (k,v) -> v + new Random().nextInt(5));
        totals.computeIfPresent("demo-bob", (k,v) -> v + new Random().nextInt(5));
        totals.computeIfPresent("demo-charlie", (k,v) -> v + new Random().nextInt(5));
    }

    public String getLatestLeaderboardJson() throws ExecutionException, InterruptedException {
        List<Map.Entry<String,Integer>> list = new ArrayList<>(totals.entrySet());
        list.sort((a,b) -> Integer.compare(b.getValue(), a.getValue()));
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"generatedAt\": ").append(System.currentTimeMillis()).append(",\n");
        sb.append("  \"entries\": [\n");
        boolean first = true;
        for (Map.Entry<String,Integer> e : list) {
            if (!first) sb.append(",\n");
            first = false;
            sb.append("    {\n");
            sb.append("      \"userId\": \"").append(e.getKey()).append("\",\n");
            sb.append("      \"totalScore\": ").append(e.getValue()).append("\n");
            sb.append("    }");
        }
        sb.append("\n  ]\n");
        sb.append("}");
        return sb.toString();
    }
}
