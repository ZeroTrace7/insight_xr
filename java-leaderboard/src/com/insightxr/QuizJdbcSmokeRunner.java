package com.insightxr;

/**
 * Tiny manual runner to validate JDBC connectivity and schema setup.
 */
public class QuizJdbcSmokeRunner {
    public static void main(String[] args) {
        try {
            QuizJdbcService svc = QuizJdbcService.fromEnv();
            svc.initialize();
            System.out.println("quiz-jdbc-smoke: OK");
            System.out.println("Try POST /quiz/generate after starting App.");
        } catch (Exception e) {
            System.err.println("quiz-jdbc-smoke: FAILED - " + e.getMessage());
            System.err.println("Set MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD correctly.");
            System.exit(1);
        }
    }
}

