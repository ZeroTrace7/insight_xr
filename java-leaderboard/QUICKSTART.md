# Java Leaderboard Microservice - Quick Start

## Running Locally (Without Firebase)

Your leaderboard microservice is set up to run locally with mock data when Firebase credentials are not available.

### Quick Start

1. Open PowerShell in the `java-leaderboard` folder
2. Run:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File test-run.ps1
   ```
3. The service will start on **http://localhost:8080**
4. Open http://localhost:8080/leaderboard/latest in your browser to see the mock leaderboard

### Available Endpoints

- **GET /leaderboard/latest** - Fetch the current leaderboard (JSON)
- **POST /trigger-leaderboard** - Manually trigger a leaderboard update

### Test It

**Option 1: Browser**
- Open http://localhost:8080/leaderboard/latest
- Or open `test.html` in your browser and click the buttons

**Option 2: PowerShell (in a new terminal)**
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/leaderboard/latest" -UseBasicParsing
```

You should see JSON with mock users:
```json
{
  "generatedAt": 1729274851234,
  "entries": [
    {"userId": "demo-alice", "totalScore": 125},
    {"userId": "demo-bob", "totalScore": 98},
    {"userId": "demo-charlie", "totalScore": 73}
  ]
}
```

### Integration with Your Frontend

The service has CORS enabled for all origins, making it easy to connect from your local frontend.

In your frontend (TypeScript/React), fetch the leaderboard:

```typescript
async function fetchLeaderboard() {
  const response = await fetch('http://localhost:8080/leaderboard/latest');
  const data = await response.json();
  console.log(data.entries); // Array of {userId, totalScore}
}
```

### Running with Firebase (Production)

To use real Firestore data instead of mock:

1. Download your Firebase service account JSON from Firebase Console
2. Save it as `java-leaderboard/serviceAccount.json`
3. Run the script again

The service will automatically detect the credentials and connect to Firestore.

### Auto-Updates

The leaderboard automatically recomputes every 10 minutes in the background.

### Troubleshooting

**404 Not Found?**
- Make sure the server is running (you should see "Leaderboard service running on port 8080")
- Open http://localhost:8080/leaderboard/latest in a browser to verify
- Check if another process is using port 8080: `netstat -ano | Select-String ":8080"`

**Server exits immediately?**
- Make sure you're running: `powershell -NoProfile -ExecutionPolicy Bypass -File test-run.ps1`
- Check Java version: `java -version` (needs Java 11+)

**Can't connect?**
- Verify the server printed "Leaderboard service running on port 8080"
- Try opening http://localhost:8080/leaderboard/latest in your browser
- Check Windows Firewall isn't blocking localhost connections

**Need help?**
- All source code is in `src/com/insightxr/`
- Logs appear in the PowerShell window where you ran the script
- Use `test.html` for a quick browser-based test
