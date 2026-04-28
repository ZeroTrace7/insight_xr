# Java Leaderboard + MySQL Quiz Service

This service now supports:
- Leaderboard APIs (`/leaderboard/award`, `/leaderboard/latest`)
- JDBC-backed quiz APIs with MySQL (`/quiz/*`)

## Environment Variables

Set these before running:

- `MYSQL_HOST` (default `localhost`)
- `MYSQL_PORT` (default `3306`)
- `MYSQL_DB` (default `insightxr_quiz`)
- `MYSQL_USER` (default `root`)
- `MYSQL_PASSWORD` (default empty)
- `PORT` (default `8080`)

## Run

```powershell
Push-Location "D:\insight_xr\java-leaderboard"
mvn -q clean compile exec:java
```

## Quick JDBC Smoke Test

```powershell
Push-Location "D:\insight_xr\java-leaderboard"
mvn -q -Dexec.mainClass=com.insightxr.QuizJdbcSmokeRunner exec:java
```

## Quiz API

### Generate Quiz
`POST /quiz/generate`

Body:
```json
{
  "userId": "user-123",
  "topic": "java",
  "questionCount": 5
}
```

### Get Quiz
`GET /quiz/get?quizId=1`

### Submit Attempt (awards leaderboard points once per user+quiz)
`POST /quiz/attempt`

Body:
```json
{
  "quizId": 1,
  "userId": "user-123",
  "userName": "Jayasudha",
  "answers": [
    { "questionId": 101, "optionId": 1001 }
  ]
}
```

### Add Custom Question Bank Item (optional feature)
`POST /quiz/question-bank`

Body:
```json
{
  "topic": "java",
  "questionText": "Which keyword creates inheritance?",
  "options": [
    { "optionText": "extends", "isCorrect": true },
    { "optionText": "implements", "isCorrect": false },
    { "optionText": "inherits", "isCorrect": false },
    { "optionText": "super", "isCorrect": false }
  ]
}
```

## Notes

- Schema is auto-created on startup.
- SQL reference: `db/mysql_quiz_schema.sql`.
- Duplicate submit for same user and quiz returns HTTP `409`.

