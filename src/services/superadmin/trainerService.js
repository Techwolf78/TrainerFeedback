import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter,
} from "firebase/firestore";
import { createUserWithoutLoggingIn } from "../authService";
import { sendTrainerOnboardingEmail } from "../emailJsService";

const COLLECTION_NAME = "trainers";
const COUNTER_COLLECTION = "counters";
const TRAINER_COUNTER_DOC = "trainers";
const TRAINER_ID_REGEX = /^GA-T\d{3,}$/;

// Get the current trainer ID counter
export const getTrainerIdCounter = async () => {
  try {
    const docRef = doc(db, COUNTER_COLLECTION, TRAINER_COUNTER_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().lastId || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error getting trainer ID counter:", error);
    return 0;
  }
};

// Update the trainer ID counter
export const updateTrainerIdCounter = async (newValue) => {
  try {
    const docRef = doc(db, COUNTER_COLLECTION, TRAINER_COUNTER_DOC);
    await setDoc(docRef, { lastId: newValue }, { merge: true });
  } catch (error) {
    console.error("Error updating trainer ID counter:", error);
  }
};

// Helper: extract numeric part from trainer_id (e.g., "GA-T042" -> 42)
const extractTrainerNumber = (trainerId) => {
  const match = trainerId?.match(/^GA-T(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

// Add a new trainer
// Options: { skipCounterUpdate: boolean } - set true during batch to avoid per-trainer counter writes
export const addTrainer = async (
  { trainer_id, name, domain, specialisation, topics = [], email, password },
  options = {},
) => {
  const { skipCounterUpdate = false } = options;
  try {
    // Validate ID format
    if (!TRAINER_ID_REGEX.test(trainer_id)) {
      throw new Error(
        `Invalid Trainer ID format. Must be GA-TXXX (e.g., GA-T001). Received: ${trainer_id}`,
      );
    }

    // Check for duplicate trainer_id
    const q = query(
      collection(db, COLLECTION_NAME),
      where("trainer_id", "==", trainer_id),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error(`Trainer with ID ${trainer_id} already exists.`);
    }

    // Create Auth User first
    let uid;
    try {
      uid = await createUserWithoutLoggingIn(email, password);
    } catch (authError) {
      // If auth fails (e.g. email exists), throw immediately
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // Use UID as Document ID
    await setDoc(doc(db, COLLECTION_NAME, uid), {
      uid, // redundancy but useful
      role: "trainer",
      trainer_id,
      name,
      domain,
      specialisation,
      topics,
      email,
      createdAt: serverTimestamp(),
    });

    // Send Onboarding Email
    await sendTrainerOnboardingEmail({
      name,
      email,
      temporary_password: password,
    });

    // Update counter (skip during batch — batch updates once at the end)
    if (!skipCounterUpdate) {
      const num = extractTrainerNumber(trainer_id);
      if (num > 0) {
        const currentCounter = await getTrainerIdCounter();
        if (num > currentCounter) {
          await updateTrainerIdCounter(num);
        }
      }
    }

    // Return compatible object
    return { id: uid, trainer_id, name, email };
  } catch (error) {
    console.error("Error adding trainer:", error);
    throw error;
  }
};

// Update an existing trainer
export const updateTrainer = async (id, updates) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { id, ...updates };
  } catch (error) {
    console.error("Error updating trainer:", error);
    throw error;
  }
};

// Delete a trainer
export const deleteTrainer = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  } catch (error) {
    console.error("Error deleting trainer:", error);
    throw error;
  }
};

// Get all trainers (with pagination)
export const getAllTrainers = async (limitCount = 10, lastDoc = null) => {
  try {
    let q = query(collection(db, COLLECTION_NAME), limit(limitCount));

    if (lastDoc) {
      q = query(
        collection(db, COLLECTION_NAME),
        startAfter(lastDoc),
        limit(limitCount),
      );
    }

    const querySnapshot = await getDocs(q);
    const trainers = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      trainers,
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
      hasMore: querySnapshot.docs.length === limitCount,
    };
  } catch (error) {
    console.error("Error getting trainers:", error);
    throw error;
  }
};

// Get trainer by ID (Firestore Document ID)
export const getTrainerById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting trainer:", error);
    throw error;
  }
};

// Batch add trainers with duplicate validation (DB + intra-batch)
export const addTrainersBatch = async (trainers) => {
  const results = {
    success: [],
    errors: [],
    skipped: [],
  };

  // 1. Fetch existing trainer IDs from DB for duplicate check
  const existingIds = new Set();
  const q = query(collection(db, COLLECTION_NAME));
  const snapshot = await getDocs(q);
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.trainer_id) existingIds.add(data.trainer_id);
  });

  // 2. Track IDs within this batch to catch intra-batch duplicates
  const batchIds = new Set();

  for (const trainer of trainers) {
    try {
      const trainerId = trainer.trainer_id;

      // Validate trainer_id is provided
      if (!trainerId) {
        results.errors.push({
          trainer_id: "MISSING",
          name: trainer.name,
          error: "trainer_id is required in import data",
        });
        continue;
      }

      // Check against existing DB IDs
      if (existingIds.has(trainerId)) {
        results.skipped.push({
          trainer_id: trainerId,
          name: trainer.name,
          reason: "ID already exists in database",
        });
        continue;
      }

      // Check for intra-batch duplicate
      if (batchIds.has(trainerId)) {
        results.skipped.push({
          trainer_id: trainerId,
          name: trainer.name,
          reason: "Duplicate ID within import batch",
        });
        continue;
      }

      // Mark this ID as used within batch
      batchIds.add(trainerId);

      // Create trainer (skip counter update — we do it once at the end)
      const added = await addTrainer(trainer, { skipCounterUpdate: true });
      results.success.push(added);
      existingIds.add(trainerId);
    } catch (error) {
      results.errors.push({
        trainer_id: trainer.trainer_id || "UNKNOWN",
        name: trainer.name,
        error: error.message,
      });
    }
  }

  // 3. Update counter once: find the highest numeric ID among all successful creates
  if (results.success.length > 0) {
    const maxNum = Math.max(
      ...results.success.map((t) => extractTrainerNumber(t.trainer_id)),
    );
    const currentCounter = await getTrainerIdCounter();
    if (maxNum > currentCounter) {
      await updateTrainerIdCounter(maxNum);
    }
  }

  return results;
};

// One-time utility: Sync counter from existing trainers in DB
// Run this once against prod to initialize the counters collection
// export const syncTrainerCounter = async () => {
//   try {
//     const q = query(collection(db, COLLECTION_NAME));
//     const snapshot = await getDocs(q);

//     let maxNum = 0;
//     snapshot.forEach((doc) => {
//       const data = doc.data();
//       const num = extractTrainerNumber(data.trainer_id);
//       if (num > maxNum) maxNum = num;
//     });

//     await updateTrainerIdCounter(maxNum);
//     console.log(
//       `Trainer counter synced to ${maxNum} (from ${snapshot.size} trainers)`,
//     );
//     return maxNum;
//   } catch (error) {
//     console.error("Error syncing trainer counter:", error);
//     throw error;
//   }
// };
