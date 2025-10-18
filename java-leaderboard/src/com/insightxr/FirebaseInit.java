package com.insightxr;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

public class FirebaseInit {
    public static void init() throws Exception {
        // 1) Prefer explicit path via env var
        String sa = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
        if (sa != null && !sa.isEmpty()) {
            try (InputStream serviceAccount = new FileInputStream(sa)) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();
                if (FirebaseApp.getApps().isEmpty()) {
                    FirebaseApp.initializeApp(options);
                }
                return;
            }
        }

        // 2) Fallback to local serviceAccount.json next to the script
        File localSa = new File("serviceAccount.json");
        if (localSa.exists()) {
            try (InputStream serviceAccount = new FileInputStream(localSa)) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();
                if (FirebaseApp.getApps().isEmpty()) {
                    FirebaseApp.initializeApp(options);
                }
                return;
            }
        }

        // 3) Try Application Default Credentials (gcloud auth application-default login)
        try {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.getApplicationDefault())
                    .build();
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }
            return;
        } catch (Exception ignored) {}

        throw new IllegalStateException("Firebase Admin credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json in java-leaderboard/ or configure ADC.");
    }
}
