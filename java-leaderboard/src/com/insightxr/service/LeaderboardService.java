package com.insightxr.service;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

public class LeaderboardService implements ILeaderboard {
    private final Firestore db;
    public LeaderboardService(Firestore db) { this.db = db; }

    // Compute top-N users by total score over last 24 hours, store as document leaderboards/daily/latest
    public void computeAndStoreDailyLeaderboard(int topN) throws ExecutionException, InterruptedException {
        long since = System.currentTimeMillis() - 24L * 60 * 60 * 1000; // last 24 hours
        ApiFuture<QuerySnapshot> f = db.collection("quizResults")
            .whereGreaterThanOrEqualTo("timestamp", since)
            .get();
        List<QueryDocumentSnapshot> docs = f.get().getDocuments();

        // aggregate total score per user
        Map<String, Integer> totals = new HashMap<>();
        for (DocumentSnapshot d : docs) {
            String uid = d.getString("userId");
            Number scoreN = d.getLong("score");
            int score = scoreN != null ? scoreN.intValue() : 0;
            totals.merge(uid, score, Integer::sum);
        }

        // produce sorted leaderboard entries
        List<Map<String,Object>> entries = totals.entrySet().stream()
            .sorted(Map.Entry.<String,Integer>comparingByValue(Comparator.reverseOrder()))
            .limit(topN)
            .map(e -> {
                Map<String,Object> m = new HashMap<>();
                m.put("userId", e.getKey());
                m.put("totalScore", e.getValue());
                return m;
            })
            .collect(Collectors.toList());

        Map<String,Object> doc = new HashMap<>();
        doc.put("generatedAt", System.currentTimeMillis());
        doc.put("entries", entries);

        db.collection("leaderboards").document("daily").set(doc);
        db.collection("leaderboards").document("daily_latest_backup_" + System.currentTimeMillis()).set(doc); // optional backup
    }

    // Return latest leaderboard JSON string (simple conversion)
    public String getLatestLeaderboardJson() throws ExecutionException, InterruptedException {
        DocumentSnapshot snap = db.collection("leaderboards").document("daily").get().get();
        if (!snap.exists()) return "{\n  \"error\": \"no leaderboard\"\n}";
        Map<String,Object> data = snap.getData();
        // crude JSON building to avoid extra libs - pretty printed
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> entries = (List<Map<String,Object>>) data.getOrDefault("entries", Collections.emptyList());
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"generatedAt\": ").append(data.getOrDefault("generatedAt",0)).append(",\n");
        sb.append("  \"entries\": [\n");
        boolean first=true;
        for (Map<String,Object> e : entries) {
            if (!first) sb.append(",\n");
            first=false;
            sb.append("    {\n");
            sb.append("      \"userId\": \"").append(e.get("userId")).append("\",\n");
            sb.append("      \"totalScore\": ").append(e.get("totalScore")).append("\n");
            sb.append("    }");
        }
        sb.append("\n  ]\n");
        sb.append("}");
        return sb.toString();
    }
}
