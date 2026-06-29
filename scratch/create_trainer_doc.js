import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

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
const auth = getAuth(app);

const run = async () => {
  try {
    console.log("Authenticating as Super Admin...");
    const userCredential = await signInWithEmailAndPassword(auth, "superadmin@gryphonacademy.co.in", "password123");
    console.log("Successfully logged in as Super Admin!");

    const trainerUid = "LXMi4J1J6GfWe5scLeYDWDmUDUu2";
    const docRef = doc(db, "trainers", trainerUid);

    console.log(`Writing trainer document for UID: ${trainerUid}...`);
    await setDoc(docRef, {
      uid: trainerUid,
      role: "trainer",
      trainer_id: "GA-T230",
      name: "Sohail Shaikh",
      domain: "Technical",
      specialisation: "",
      topics: [],
      email: "sohailshaikhexe@gmail.com",
      emailLower: "sohailshaikhexe@gmail.com",
      createdAt: serverTimestamp()
    });

    console.log("Trainer profile document successfully created in Firestore!");
  } catch (error) {
    console.error("Error creating trainer document:", error);
  }
  process.exit(0);
};

run();
