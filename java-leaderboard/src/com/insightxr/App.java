package com.insightxr;

import com.insightxr.service.ILeaderboard;
import com.insightxr.service.LeaderboardService;
import com.insightxr.service.InMemoryLeaderboardService;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import java.net.InetSocketAddress;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class App {
    public static void main(String[] args) throws Exception {
        // init Firebase (best-effort)
        boolean firebaseReady = false;
        try {
            FirebaseInit.init();
            firebaseReady = true;
        } catch (Throwable t) {
            System.err.println("[warning] Firebase init failed: " + t.getMessage());
        }

        final ILeaderboard[] svcRef = new ILeaderboard[1];
        if (firebaseReady) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                svcRef[0] = new LeaderboardService(db);
            } catch (Throwable t) {
                System.err.println("[warning] Firestore unavailable, using in-memory leaderboard: " + t.getMessage());
                svcRef[0] = new InMemoryLeaderboardService();
            }
        } else {
            svcRef[0] = new InMemoryLeaderboardService();
        }

        // periodic auto-update (every 10 minutes)
        Thread updater = new Thread(() -> {
            while (true) {
                try {
                    svcRef[0].computeAndStoreDailyLeaderboard(10);
                    System.out.println("[leaderboard] updated: " + new java.util.Date());
                } catch (Exception e) {
                    System.err.println("[leaderboard] update failed: " + e.getMessage());
                }
                try { Thread.sleep(10 * 60 * 1000); } catch (InterruptedException ignored) {}
            }
        });
        updater.setDaemon(false); // keep JVM alive
        updater.start();

        // start simple HTTP server
        int port = 8080;
        try { port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")); } catch (Exception ignored) {}
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/trigger-leaderboard", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            try {
                svcRef[0].computeAndStoreDailyLeaderboard(10);
                byte[] resp = "ok".getBytes(StandardCharsets.UTF_8);
                ex.sendResponseHeaders(200, resp.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(resp); }
            } catch (Exception e) {
                byte[] resp = ("error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8);
                ex.sendResponseHeaders(500, resp.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(resp); }
            }
        });

        server.createContext("/leaderboard/latest", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            try {
                String json = svcRef[0].getLatestLeaderboardJson();
                byte[] resp = json.getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().add("Content-Type", "application/json");
                ex.sendResponseHeaders(200, resp.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(resp); }
            } catch (Exception e) {
                byte[] resp = ("error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8);
                ex.sendResponseHeaders(500, resp.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(resp); }
            }
        });

        server.setExecutor(null); // use default executor
        System.out.println("Leaderboard service running on port " + port);
        server.start();
        
        // Keep server running indefinitely
        System.out.println("Press Ctrl+C to stop the server");
        while (true) {
            try {
                Thread.sleep(60000); // sleep 1 minute at a time
            } catch (InterruptedException e) {
                System.out.println("Server shutting down...");
                break;
            }
        }
    }

    private static boolean handleCorsPreflight(HttpExchange ex) throws java.io.IOException {
        if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) {
            setCorsHeaders(ex);
            ex.sendResponseHeaders(204, -1);
            return true;
        }
        return false;
    }

    private static void setCorsHeaders(HttpExchange ex) {
        String origin = ex.getRequestHeaders().getFirst("Origin");
        // Allow Vercel app and local dev by default; tighten as needed
        if (origin == null) origin = "*";
        if (origin.endsWith("insight-xr.vercel.app") || origin.startsWith("http://localhost")) {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
        } else {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        }
        ex.getResponseHeaders().set("Vary", "Origin");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type,Authorization");
        ex.getResponseHeaders().set("Access-Control-Max-Age", "86400");
    }
}
