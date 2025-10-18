FROM eclipse-temurin:17-jdk-alpine

# Set working directory
WORKDIR /app

# Copy dependency jars from java-leaderboard folder
COPY java-leaderboard/libs ./libs

# Copy source code
COPY java-leaderboard/src ./src

# Create bin directory
RUN mkdir -p bin

# Compile Java code
RUN javac -cp "libs/*:src" -d bin \
    src/com/insightxr/App.java \
    src/com/insightxr/FirebaseInit.java \
    src/com/insightxr/service/ILeaderboard.java \
    src/com/insightxr/service/LeaderboardService.java \
    src/com/insightxr/service/InMemoryLeaderboardService.java

# Expose port
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Run the application
CMD ["java", "-cp", "libs/*:bin", "com.insightxr.App"]
