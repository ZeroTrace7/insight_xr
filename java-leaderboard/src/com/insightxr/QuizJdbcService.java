package com.insightxr;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

public class QuizJdbcService {
    private static final int DEFAULT_QUIZ_SIZE = 5;
    private final String jdbcUrl;
    private final String dbUser;
    private final String dbPassword;
    private final Random random = new Random();

    public static class DuplicateAttemptException extends Exception {
        public DuplicateAttemptException(String message) {
            super(message);
        }
    }

    public static record BankOption(String optionText, boolean isCorrect) {}

    public static record QuizAttemptResult(long attemptId, int score, int totalQuestions, int awardedPoints) {}

    private static class GeneratedOption {
        private final String optionText;
        private final boolean isCorrect;

        private GeneratedOption(String optionText, boolean isCorrect) {
            this.optionText = optionText;
            this.isCorrect = isCorrect;
        }
    }

    private static class GeneratedQuestion {
        private final String questionText;
        private final List<GeneratedOption> options;

        private GeneratedQuestion(String questionText, List<GeneratedOption> options) {
            this.questionText = questionText;
            this.options = options;
        }
    }

    private QuizJdbcService(String jdbcUrl, String dbUser, String dbPassword) {
        this.jdbcUrl = jdbcUrl;
        this.dbUser = dbUser;
        this.dbPassword = dbPassword;
    }

    public static QuizJdbcService fromEnv() throws ClassNotFoundException {
        String host = System.getenv().getOrDefault("MYSQL_HOST", "localhost");
        String port = System.getenv().getOrDefault("MYSQL_PORT", "3306");
        String database = System.getenv().getOrDefault("MYSQL_DB", "insightxr_quiz");
        String user = System.getenv().getOrDefault("MYSQL_USER", "root");
        String password = System.getenv().getOrDefault("MYSQL_PASSWORD", "");

        String jdbcUrl = "jdbc:mysql://" + host + ":" + port + "/" + database
                + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true";
        Class.forName("com.mysql.cj.jdbc.Driver");
        return new QuizJdbcService(jdbcUrl, user, password);
    }

    public void initialize() throws SQLException {
        try (Connection conn = openConnection()) {
            conn.setAutoCommit(false);
            createSchema(conn);
            seedQuestionBank(conn);
            conn.commit();
        }
    }

    public JsonObject generateQuiz(String userId, String topic, int questionCount) throws SQLException {
        int safeCount = questionCount <= 0 ? DEFAULT_QUIZ_SIZE : Math.min(questionCount, 20);
        String safeTopic = topic == null || topic.isBlank() ? "general" : topic.trim();

        try (Connection conn = openConnection()) {
            conn.setAutoCommit(false);
            long quizId = insertQuiz(conn, userId, safeTopic);

            List<GeneratedQuestion> selected = loadBankQuestions(conn, safeTopic, safeCount);
            while (selected.size() < safeCount) {
                selected.add(createFallbackQuestion(safeTopic, selected.size() + 1));
            }

            for (GeneratedQuestion question : selected) {
                long questionId = insertQuestion(conn, quizId, question.questionText);
                for (GeneratedOption option : question.options) {
                    insertOption(conn, questionId, option.optionText, option.isCorrect);
                }
            }

            conn.commit();
            return getQuizInternal(conn, quizId);
        }
    }

    public JsonObject getQuiz(long quizId) throws SQLException {
        try (Connection conn = openConnection()) {
            return getQuizInternal(conn, quizId);
        }
    }

    public QuizAttemptResult submitAttempt(long quizId, String userId, Map<Long, Long> answers)
            throws SQLException, DuplicateAttemptException {
        Objects.requireNonNull(answers, "answers map is required");

        try (Connection conn = openConnection()) {
            conn.setAutoCommit(false);

            if (hasExistingAttempt(conn, quizId, userId)) {
                throw new DuplicateAttemptException("attempt already submitted for this quiz and user");
            }

            Map<Long, Long> correctByQuestion = loadCorrectOptionMap(conn, quizId);
            int total = correctByQuestion.size();
            int correct = 0;
            for (Map.Entry<Long, Long> expected : correctByQuestion.entrySet()) {
                Long selectedOptionId = answers.get(expected.getKey());
                if (selectedOptionId != null && selectedOptionId.equals(expected.getValue())) {
                    correct++;
                }
            }

            int awardedPoints = correct * 10;
            long attemptId = insertAttempt(conn, quizId, userId, correct, total);
            conn.commit();
            return new QuizAttemptResult(attemptId, correct, total, awardedPoints);
        }
    }

    public void addQuestionToBank(String topic, String questionText, List<BankOption> options) throws SQLException {
        if (topic == null || topic.isBlank()) {
            throw new IllegalArgumentException("topic is required");
        }
        if (questionText == null || questionText.isBlank()) {
            throw new IllegalArgumentException("questionText is required");
        }
        if (options == null || options.size() < 2) {
            throw new IllegalArgumentException("at least 2 options are required");
        }

        int correctCount = 0;
        for (BankOption option : options) {
            if (option.isCorrect()) {
                correctCount++;
            }
        }
        if (correctCount != 1) {
            throw new IllegalArgumentException("exactly one option must be marked correct");
        }

        try (Connection conn = openConnection()) {
            conn.setAutoCommit(false);
            long questionId = insertBankQuestion(conn, topic.trim(), questionText.trim());
            for (BankOption option : options) {
                insertBankOption(conn, questionId, option.optionText().trim(), option.isCorrect());
            }
            conn.commit();
        }
    }

    private Connection openConnection() throws SQLException {
        return DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
    }

    private void createSchema(Connection conn) throws SQLException {
        execute(conn, "CREATE TABLE IF NOT EXISTS quizzes ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "user_id VARCHAR(128) NOT NULL,"
                + "topic VARCHAR(255) NOT NULL,"
                + "date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
                + ")");

        execute(conn, "CREATE TABLE IF NOT EXISTS questions ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "quiz_id BIGINT NOT NULL,"
                + "question_text TEXT NOT NULL,"
                + "CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE"
                + ")");

        execute(conn, "CREATE TABLE IF NOT EXISTS options ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "question_id BIGINT NOT NULL,"
                + "option_text VARCHAR(500) NOT NULL,"
                + "is_correct BOOLEAN NOT NULL DEFAULT FALSE,"
                + "CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE"
                + ")");

        execute(conn, "CREATE TABLE IF NOT EXISTS attempts ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "quiz_id BIGINT NOT NULL,"
                + "user_id VARCHAR(128) NOT NULL,"
                + "score INT NOT NULL,"
                + "total_questions INT NOT NULL,"
                + "submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"
                + "UNIQUE KEY uq_attempt_user_quiz (quiz_id, user_id),"
                + "CONSTRAINT fk_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE"
                + ")");

        execute(conn, "CREATE TABLE IF NOT EXISTS question_bank ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "topic VARCHAR(255) NOT NULL,"
                + "question_text TEXT NOT NULL"
                + ")");

        execute(conn, "CREATE TABLE IF NOT EXISTS question_bank_options ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "question_bank_id BIGINT NOT NULL,"
                + "option_text VARCHAR(500) NOT NULL,"
                + "is_correct BOOLEAN NOT NULL DEFAULT FALSE,"
                + "CONSTRAINT fk_qbo_qb FOREIGN KEY (question_bank_id) REFERENCES question_bank(id) ON DELETE CASCADE"
                + ")");
    }

    private void seedQuestionBank(Connection conn) throws SQLException {
        int count;
        try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM question_bank")) {
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                count = rs.getInt(1);
            }
        }
        if (count > 0) {
            return;
        }

        insertBankQuestionWithOptions(conn, "java",
                "Which keyword is used to define a class in Java?",
                List.of(new BankOption("class", true), new BankOption("struct", false),
                        new BankOption("object", false), new BankOption("define", false)));

        insertBankQuestionWithOptions(conn, "java",
                "Which method is the entry point of a Java application?",
                List.of(new BankOption("main", true), new BankOption("start", false),
                        new BankOption("run", false), new BankOption("init", false)));

        insertBankQuestionWithOptions(conn, "ohms",
                "Ohm's law is represented as:",
                List.of(new BankOption("V = I * R", true), new BankOption("P = V / I", false),
                        new BankOption("R = P * I", false), new BankOption("I = V * R", false)));

        insertBankQuestionWithOptions(conn, "dna",
                "In DNA, Adenine pairs with:",
                List.of(new BankOption("Thymine", true), new BankOption("Guanine", false),
                        new BankOption("Cytosine", false), new BankOption("Uracil", false)));
    }

    private void insertBankQuestionWithOptions(Connection conn, String topic, String question, List<BankOption> options)
            throws SQLException {
        long qId = insertBankQuestion(conn, topic, question);
        for (BankOption option : options) {
            insertBankOption(conn, qId, option.optionText(), option.isCorrect());
        }
    }

    private List<GeneratedQuestion> loadBankQuestions(Connection conn, String topic, int limit) throws SQLException {
        List<GeneratedQuestion> list = new ArrayList<>();
        String sql = "SELECT id, question_text FROM question_bank WHERE topic = ? ORDER BY RAND() LIMIT ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, topic.toLowerCase());
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long questionBankId = rs.getLong("id");
                    String questionText = rs.getString("question_text");
                    List<GeneratedOption> options = loadBankOptions(conn, questionBankId);
                    if (!options.isEmpty()) {
                        list.add(new GeneratedQuestion(questionText, options));
                    }
                }
            }
        }
        return list;
    }

    private List<GeneratedOption> loadBankOptions(Connection conn, long questionBankId) throws SQLException {
        List<GeneratedOption> options = new ArrayList<>();
        String sql = "SELECT option_text, is_correct FROM question_bank_options WHERE question_bank_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, questionBankId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    options.add(new GeneratedOption(rs.getString("option_text"), rs.getBoolean("is_correct")));
                }
            }
        }
        return options;
    }

    private GeneratedQuestion createFallbackQuestion(String topic, int index) {
        String questionText = "(" + topic + ") Concept check " + index + ": which option best matches the topic?";
        int correctIndex = random.nextInt(4);
        List<GeneratedOption> options = new ArrayList<>();
        options.add(new GeneratedOption("Core concept of " + topic, correctIndex == 0));
        options.add(new GeneratedOption("Unrelated concept", correctIndex == 1));
        options.add(new GeneratedOption("Random guess", correctIndex == 2));
        options.add(new GeneratedOption("Not enough information", correctIndex == 3));
        return new GeneratedQuestion(questionText, options);
    }

    private long insertQuiz(Connection conn, String userId, String topic) throws SQLException {
        String sql = "INSERT INTO quizzes(user_id, topic) VALUES(?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, userId);
            ps.setString(2, topic.toLowerCase());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    return keys.getLong(1);
                }
            }
        }
        throw new SQLException("failed to create quiz");
    }

    private long insertQuestion(Connection conn, long quizId, String questionText) throws SQLException {
        String sql = "INSERT INTO questions(quiz_id, question_text) VALUES(?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, quizId);
            ps.setString(2, questionText);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    return keys.getLong(1);
                }
            }
        }
        throw new SQLException("failed to create question");
    }

    private void insertOption(Connection conn, long questionId, String optionText, boolean isCorrect) throws SQLException {
        String sql = "INSERT INTO options(question_id, option_text, is_correct) VALUES(?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, questionId);
            ps.setString(2, optionText);
            ps.setBoolean(3, isCorrect);
            ps.executeUpdate();
        }
    }

    private long insertAttempt(Connection conn, long quizId, String userId, int score, int totalQuestions) throws SQLException {
        String sql = "INSERT INTO attempts(quiz_id, user_id, score, total_questions) VALUES(?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, quizId);
            ps.setString(2, userId);
            ps.setInt(3, score);
            ps.setInt(4, totalQuestions);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    return keys.getLong(1);
                }
            }
        }
        throw new SQLException("failed to save attempt");
    }

    private long insertBankQuestion(Connection conn, String topic, String questionText) throws SQLException {
        String sql = "INSERT INTO question_bank(topic, question_text) VALUES(?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, topic.toLowerCase());
            ps.setString(2, questionText);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    return keys.getLong(1);
                }
            }
        }
        throw new SQLException("failed to save question bank row");
    }

    private void insertBankOption(Connection conn, long questionBankId, String optionText, boolean isCorrect)
            throws SQLException {
        String sql = "INSERT INTO question_bank_options(question_bank_id, option_text, is_correct) VALUES(?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, questionBankId);
            ps.setString(2, optionText);
            ps.setBoolean(3, isCorrect);
            ps.executeUpdate();
        }
    }

    private boolean hasExistingAttempt(Connection conn, long quizId, String userId) throws SQLException {
        String sql = "SELECT id FROM attempts WHERE quiz_id = ? AND user_id = ? LIMIT 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, quizId);
            ps.setString(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private Map<Long, Long> loadCorrectOptionMap(Connection conn, long quizId) throws SQLException {
        Map<Long, Long> map = new HashMap<>();
        String sql = "SELECT q.id AS question_id, o.id AS option_id "
                + "FROM questions q JOIN options o ON o.question_id = q.id "
                + "WHERE q.quiz_id = ? AND o.is_correct = TRUE";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getLong("question_id"), rs.getLong("option_id"));
                }
            }
        }
        return map;
    }

    private JsonObject getQuizInternal(Connection conn, long quizId) throws SQLException {
        String quizSql = "SELECT id, user_id, topic, date_created FROM quizzes WHERE id = ?";
        JsonObject quiz = new JsonObject();
        try (PreparedStatement ps = conn.prepareStatement(quizSql)) {
            ps.setLong(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("quiz not found: " + quizId);
                }
                quiz.addProperty("quizId", rs.getLong("id"));
                quiz.addProperty("userId", rs.getString("user_id"));
                quiz.addProperty("topic", rs.getString("topic"));
                quiz.addProperty("dateCreated", rs.getTimestamp("date_created").toInstant().toString());
            }
        }

        JsonArray questions = new JsonArray();
        String qSql = "SELECT id, question_text FROM questions WHERE quiz_id = ? ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(qSql)) {
            ps.setLong(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long questionId = rs.getLong("id");
                    JsonObject question = new JsonObject();
                    question.addProperty("questionId", questionId);
                    question.addProperty("questionText", rs.getString("question_text"));
                    question.add("options", loadOptionsForQuestion(conn, questionId));
                    questions.add(question);
                }
            }
        }

        quiz.add("questions", questions);
        return quiz;
    }

    private JsonArray loadOptionsForQuestion(Connection conn, long questionId) throws SQLException {
        JsonArray options = new JsonArray();
        String sql = "SELECT id, option_text FROM options WHERE question_id = ? ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, questionId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    JsonObject option = new JsonObject();
                    option.addProperty("optionId", rs.getLong("id"));
                    option.addProperty("optionText", rs.getString("option_text"));
                    options.add(option);
                }
            }
        }
        return options;
    }

    private void execute(Connection conn, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.execute();
        }
    }

    public static Map<Long, Long> parseAnswers(JsonArray answersArray) {
        Map<Long, Long> answers = new HashMap<>();
        if (answersArray == null) {
            return answers;
        }

        for (JsonElement el : answersArray) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject obj = el.getAsJsonObject();
            if (!obj.has("questionId") || !obj.has("optionId")) {
                continue;
            }
            long questionId = obj.get("questionId").getAsLong();
            long optionId = obj.get("optionId").getAsLong();
            answers.put(questionId, optionId);
        }
        return answers;
    }
}

