import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";

// Initialize Firebase using the hardcoded config from your environment
const firebaseConfig = {
  apiKey: "AIzaSyCdRbGZVROkMOt5QaFQSSB1dQnz5waQlkw",
  authDomain: "trainer-feedback-f59f0.firebaseapp.com",
  projectId: "trainer-feedback-f59f0",
  storageBucket: "trainer-feedback-f59f0.firebasestorage.app",
  messagingSenderId: "978849822812",
  appId: "1:978849822812:web:1de5014f1ddc802e1b8e99",
  measurementId: "G-W0MK9LDYYJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runMigration = async () => {
  try {
    console.log("Starting Batched Firebase root feedbacks migration script...");
    
    // 1. Fetch all sessions
    const sessionsCol = collection(db, "sessions");
    const sessionsSnap = await getDocs(sessionsCol);
    console.log(`Found ${sessionsSnap.docs.length} sessions to scan for responses.`);
    
    let totalMigrated = 0;
    let totalErrors = 0;

    for (const sessionDoc of sessionsSnap.docs) {
      const sessionId = sessionDoc.id;
      const sessionData = sessionDoc.data();
      const topic = sessionData.topic || "Untitled Session";
      
      console.log(`\nScanning session ${sessionId} (${topic})...`);
      
      // 2. Fetch responses subcollection for this session
      const responsesRef = collection(db, "sessions", sessionId, "responses");
      const responsesSnap = await getDocs(responsesRef);
      const rawResponses = responsesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log(`-> Found ${rawResponses.length} raw responses.`);
      
      // Batch write in chunks of 200 (Firestore allows up to 500)
      const chunkSize = 200;
      for (let i = 0; i < rawResponses.length; i += chunkSize) {
        const chunk = rawResponses.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(response => {
          const feedbackDocRef = doc(db, "feedbacks", response.id);
          const fullResponseData = {
            ...response,
            sessionId: response.sessionId || sessionId
          };
          batch.set(feedbackDocRef, fullResponseData);
        });
        
        try {
          await batch.commit();
          totalMigrated += chunk.length;
          console.log(`   Migrated responses ${i + 1} to ${Math.min(i + chunkSize, rawResponses.length)}...`);
          // Wait 200ms between batches to prevent rate limits / resource exhaustion
          await delay(200);
        } catch (err) {
          console.error(`   [ERROR] Failed to commit batch for responses ${i + 1} to ${Math.min(i + chunkSize, rawResponses.length)}:`, err);
          totalErrors += chunk.length;
        }
      }
    }
    
    console.log(`\n========================================`);
    console.log(`Migration Completed!`);
    console.log(`Total responses successfully migrated: ${totalMigrated}`);
    console.log(`Total responses failed: ${totalErrors}`);
    console.log(`========================================`);
    process.exit(0);
  } catch (error) {
    console.error("An error occurred during migration:", error);
    process.exit(1);
  }
};

runMigration();
