package com.insightxr;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import java.net.InetSocketAddress;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class App {
    public static void main(String[] args) throws Exception {
        final ILeaderboard[] svcRef = new ILeaderboard[1];
        svcRef[0] = new InMemoryLeaderboardService();

        Thread updater = new Thread(() -> {
            while (true) {
                try {
                    svcRef[0].computeAndStoreDailyLeaderboard(10);
                    System.out.println("[leaderboard] updated: " + new java.util.Date());
                } catch (Exception e) {
                    System.err.println("[leaderboard] update failed: " + e.getMessage());
                }
                try { 
                    Thread.sleep(60 * 1000); 
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            }
        });
        updater.setDaemon(false);
        updater.start();

        int port = 8080;
        try { 
            port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")); 
        } catch (NumberFormatException ignored) {
            System.err.println("[warning] Invalid PORT value, using default: 8080");
        }
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

        server.setExecutor(null);
        System.out.println("Leaderboard service running on port " + port);
        System.out.println("Press Ctrl+C to stop the server");
        server.start();
        
        while (true) {
            try {
                Thread.sleep(60000);
            } catch (InterruptedException e) {
                System.out.println("Server shutting down...");
                Thread.currentThread().interrupt();
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
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type,Authorization");
        ex.getResponseHeaders().set("Access-Control-Max-Age", "86400");
    }
}
