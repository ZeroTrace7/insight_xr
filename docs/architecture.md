# Insight XR Architecture (Detailed)

```mermaid
flowchart LR
  User[User Browser] -->|HTTPS| Frontend[Vite Frontend
index.html + index.tsx]

  subgraph Frontend_App[Frontend App]
    UI[UI + Navigation]
    ThreeJS[Three.js 3D Modules]
    QuizUI[Quiz + Review UI]
    ChatUI[AI Tutor Chat UI]
    AuthUI[Auth UI]
    LeaderboardUI[Leaderboard UI]
  end

  Frontend --> UI
  Frontend --> ThreeJS
  Frontend --> QuizUI
  Frontend --> ChatUI
  Frontend --> AuthUI
  Frontend --> LeaderboardUI

  Frontend -->|Firebase Auth SDK| Auth[Firebase Auth]
  Frontend -->|Firestore SDK| Firestore[Firestore]
  Frontend -->|Storage SDK| Storage[Firebase Storage]

  Frontend -->|REST JSON| JavaAPI[Java Backend
HttpServer (App.java)]

  subgraph Java_Backend[Java Backend]
    LeaderboardSvc[InMemoryLeaderboardService]
    QuizSvc[QuizJdbcService]
  end

  JavaAPI --> LeaderboardSvc
  JavaAPI --> QuizSvc
  QuizSvc -->|JDBC| MySQL[(MySQL Database)]

  subgraph Firestore_Collections[Firestore Collections]
    Users[users]
    QuizResults[quizResults]
    LearningSessions[learningSessions]
    ChatHistory[chatHistory]
  end

  Firestore --> Users
  Firestore --> QuizResults
  Firestore --> LearningSessions
  Firestore --> ChatHistory

  subgraph External_AI[AI Provider]
    Gemini[Gemini 2.5 Flash]
  end

  Frontend -->|API call| Gemini
```

## Working Flow (Key Paths)
- **Login/Registration**: User authenticates via Firebase Auth; profile data saved in `users`.
- **3D Learning**: Three.js renders models in the browser; user clicks trigger AI tutor prompts.
- **Quiz Flow**: Frontend starts quiz UI; results saved to `quizResults` in Firestore.
- **Leaderboard**: Frontend sends `/leaderboard/award` to Java backend; backend updates in-memory totals.
- **Quiz Generation**: Frontend calls `/quiz/generate`; Java backend queries MySQL question bank and returns quiz.
- **Quiz Attempt**: Frontend calls `/quiz/attempt`; Java backend scores and returns points.
- **AI Tutor**: Frontend calls Gemini API for explanations and code help.

## Notes
- Firebase rules control access to Firestore collections.
- Java backend uses MySQL only for quiz content and attempts.
- Leaderboard is in-memory (not persisted in DB).
