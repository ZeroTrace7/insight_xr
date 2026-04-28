package com.insightxr;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonArray;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class App {
    public static void main(String[] args) throws Exception {
        final ILeaderboard[] svcRef = new ILeaderboard[1];
        svcRef[0] = new InMemoryLeaderboardService();
        final QuizJdbcService[] quizSvcRef = new QuizJdbcService[1];


        int port = 8080;
        try {
            port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        } catch (NumberFormatException ignored) {
            System.err.println("[warning] Invalid PORT value, using default: 8080");
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/leaderboard/award", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }

            try {
                String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                JsonObject payload = JsonParser.parseString(body).getAsJsonObject();

                String userName = payload.has("userName") ? payload.get("userName").getAsString().trim() : "";
                String userId = payload.has("userId") ? payload.get("userId").getAsString().trim() : "";
                int points = payload.has("points") ? payload.get("points").getAsInt() : 0;

                if (userId.isBlank() || points <= 0) {
                    sendTextResponse(ex, 400, "error: userId and positive points are required");
                    return;
                }

                svcRef[0].addPoints(userId, userName, points);
                sendTextResponse(ex, 200, "ok");
            } catch (Exception e) {
                sendTextResponse(ex, 500, "error: " + e.getMessage());
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
                try (OutputStream os = ex.getResponseBody()) {
                    os.write(resp);
                }
            } catch (Exception e) {
                sendTextResponse(ex, 500, "error: " + e.getMessage());
            }
        });

        server.createContext("/quiz/generate", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            if (quizSvcRef[0] == null) {
                sendTextResponse(ex, 503, "error: quiz service unavailable");
                return;
            }

            try {
                JsonObject payload = readJsonBody(ex);
                String userId = payload.has("userId") ? payload.get("userId").getAsString().trim() : "";
                String topic = payload.has("topic") ? payload.get("topic").getAsString().trim() : "general";
                int questionCount = payload.has("questionCount") ? payload.get("questionCount").getAsInt() : 5;

                if (userId.isBlank()) {
                    sendTextResponse(ex, 400, "error: userId is required");
                    return;
                }

                JsonObject quiz = quizSvcRef[0].generateQuiz(userId, topic, questionCount);
                sendJsonResponse(ex, 200, quiz);
            } catch (Exception e) {
                sendTextResponse(ex, 500, "error: " + e.getMessage());
            }
        });

        server.createContext("/quiz/get", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            if (quizSvcRef[0] == null) {
                sendTextResponse(ex, 503, "error: quiz service unavailable");
                return;
            }

            try {
                String quizIdRaw = getQueryParam(ex, "quizId");
                long quizId = Long.parseLong(quizIdRaw);
                JsonObject quiz = quizSvcRef[0].getQuiz(quizId);
                sendJsonResponse(ex, 200, quiz);
            } catch (NumberFormatException e) {
                sendTextResponse(ex, 400, "error: valid quizId query param is required");
            } catch (SQLException e) {
                sendTextResponse(ex, 404, "error: " + e.getMessage());
            } catch (Exception e) {
                sendTextResponse(ex, 500, "error: " + e.getMessage());
            }
        });

        server.createContext("/quiz/attempt", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            if (quizSvcRef[0] == null) {
                sendTextResponse(ex, 503, "error: quiz service unavailable");
                return;
            }

            try {
                JsonObject payload = readJsonBody(ex);
                long quizId = payload.has("quizId") ? payload.get("quizId").getAsLong() : -1;
                String userId = payload.has("userId") ? payload.get("userId").getAsString().trim() : "";
                String userName = payload.has("userName") ? payload.get("userName").getAsString().trim() : "";
                JsonArray answersArray = payload.has("answers") ? payload.getAsJsonArray("answers") : new JsonArray();

                if (quizId <= 0 || userId.isBlank()) {
                    sendTextResponse(ex, 400, "error: quizId and userId are required");
                    return;
                }

                Map<Long, Long> answers = QuizJdbcService.parseAnswers(answersArray);
                QuizJdbcService.QuizAttemptResult result = quizSvcRef[0].submitAttempt(quizId, userId, answers);

                if (result.awardedPoints() > 0) {
                    svcRef[0].addPoints(userId, userName, result.awardedPoints());
                }

                JsonObject resp = new JsonObject();
                resp.addProperty("attemptId", result.attemptId());
                resp.addProperty("score", result.score());
                resp.addProperty("totalQuestions", result.totalQuestions());
                resp.addProperty("awardedPoints", result.awardedPoints());
                sendJsonResponse(ex, 200, resp);
            } catch (QuizJdbcService.DuplicateAttemptException e) {
                sendTextResponse(ex, 409, "error: " + e.getMessage());
            } catch (Exception e) {
                sendTextResponse(ex, 500, "error: " + e.getMessage());
            }
        });

        server.createContext("/quiz/question-bank", (HttpExchange ex) -> {
            if (handleCorsPreflight(ex)) return;
            setCorsHeaders(ex);
            if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            if (quizSvcRef[0] == null) {
                sendTextResponse(ex, 503, "error: quiz service unavailable");
                return;
            }

            try {
                JsonObject payload = readJsonBody(ex);
                String topic = payload.has("topic") ? payload.get("topic").getAsString() : "";
                String questionText = payload.has("questionText") ? payload.get("questionText").getAsString() : "";
                JsonArray optionsArray = payload.has("options") ? payload.getAsJsonArray("options") : new JsonArray();

                List<QuizJdbcService.BankOption> options = new ArrayList<>();
                for (int i = 0; i < optionsArray.size(); i++) {
                    JsonObject opt = optionsArray.get(i).getAsJsonObject();
                    String optionText = opt.has("optionText") ? opt.get("optionText").getAsString() : "";
                    boolean isCorrect = opt.has("isCorrect") && opt.get("isCorrect").getAsBoolean();
                    options.add(new QuizJdbcService.BankOption(optionText, isCorrect));
                }

                quizSvcRef[0].addQuestionToBank(topic, questionText, options);
                sendTextResponse(ex, 200, "ok");
            } catch (IllegalArgumentException e) {
                sendTextResponse(ex, 400, "error: " + e.getMessage());
            } catch (Exception e) {
                sendTextResponse(ex, 500, "error: " + e.getMessage());
            }
        });

        server.setExecutor(null);
        System.out.println("Leaderboard service running on port " + port);
        System.out.println("POST /leaderboard/award to add quiz/assignment points");
        System.out.println("GET  /leaderboard/latest to fetch standings");
        System.out.println("POST /quiz/generate to create a quiz for a topic (MySQL)");
        System.out.println("GET  /quiz/get?quizId=<id> to fetch generated quiz");
        System.out.println("POST /quiz/attempt to submit answers and award points once");
        System.out.println("POST /quiz/question-bank to add custom MCQs");
        server.start();
    }

    private static JsonObject readJsonBody(HttpExchange ex) throws Exception {
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        return JsonParser.parseString(body).getAsJsonObject();
    }

    private static String getQueryParam(HttpExchange ex, String key) {
        String query = ex.getRequestURI().getRawQuery();
        if (query == null || query.isBlank()) {
            return "";
        }
        String[] parts = query.split("&");
        for (String p : parts) {
            String[] kv = p.split("=", 2);
            if (kv.length == 2 && key.equals(kv[0])) {
                return kv[1];
            }
        }
        return "";
    }

    private static void sendJsonResponse(HttpExchange ex, int statusCode, JsonObject json) throws java.io.IOException {
        byte[] resp = json.toString().getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(statusCode, resp.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(resp);
        }
    }

    private static void sendTextResponse(HttpExchange ex, int statusCode, String text) throws java.io.IOException {
        byte[] resp = text.getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(statusCode, resp.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(resp);
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
