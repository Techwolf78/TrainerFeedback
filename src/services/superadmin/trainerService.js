import { db } from "../firebase";
import {
  collection,
  updateDoc,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
  limit,
  startAfter,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { createUserWithoutLoggingIn } from "../authService";
import { sendTrainerOnboardingEmail } from "../emailJsService";

const COLLECTION_NAME = "trainers";
const COUNTER_COLLECTION = "counters";
const TRAINER_COUNTER_DOC = "trainers";
const TRAINER_ID_REGEX = /^GA-T\d{3,}$/;

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeTrainerId = (trainerId = "") => trainerId.trim().toUpperCase();

const getTimestampValue = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const pickPreferredTrainerRecord = (current, incoming) => {
  if (Boolean(current.isDeleted) !== Boolean(incoming.isDeleted)) {
    return current.isDeleted ? incoming : current;
  }

  const currentTime = Math.max(
    getTimestampValue(current.updatedAt),
    getTimestampValue(current.createdAt),
  );
  const incomingTime = Math.max(
    getTimestampValue(incoming.updatedAt),
    getTimestampValue(incoming.createdAt),
  );

  return incomingTime > currentTime ? incoming : current;
};

const getTrainerDedupeKey = (trainer) => {
  const status = trainer.isDeleted ? "archived" : "active";
  const trainerId = normalizeTrainerId(trainer.trainer_id);
  if (trainerId) return `${status}:trainer_id:${trainerId}`;

  const email = normalizeEmail(trainer.email);
  if (email) return `${status}:email:${email}`;

  return `${status}:doc:${trainer.id}`;
};

const dedupeTrainerRecords = (trainers) => {
  const byKey = new Map();
  const duplicateGroups = new Map();

  trainers.forEach((trainer) => {
    const key = getTrainerDedupeKey(trainer);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, trainer);
      return;
    }

    duplicateGroups.set(key, [
      ...(duplicateGroups.get(key) || [existing.id]),
      trainer.id,
    ]);
    byKey.set(key, pickPreferredTrainerRecord(existing, trainer));
  });

  if (duplicateGroups.size > 0) {
    console.warn(
      "Duplicate trainer documents detected and hidden from the UI:",
      Array.from(duplicateGroups.entries()).map(([key, ids]) => ({ key, ids })),
    );
  }

  return Array.from(byKey.values());
};

const getDuplicateDocs = async (field, value, excludeId = null) => {
  if (!value) return [];

  const q = query(
    collection(db, COLLECTION_NAME),
    where(field, "==", value),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.filter((trainerDoc) => trainerDoc.id !== excludeId);
};

const assertTrainerUnique = async ({ trainer_id }, excludeId = null) => {
  const normalizedTrainerId = normalizeTrainerId(trainer_id);

  if (normalizedTrainerId) {
    const duplicateIds = await getDuplicateDocs(
      "trainer_id",
      normalizedTrainerId,
      excludeId,
    );
    if (duplicateIds.length > 0) {
      throw new Error(`Trainer with ID ${normalizedTrainerId} already exists.`);
    }
  }
};

/**
 * Subscribe to real-time trainer updates
 * @param {Function} callback - Function called with updated trainers array
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToTrainers = (callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const trainers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(dedupeTrainerRecords(trainers));
    },
    (error) => {
      console.error("Error subscribing to trainers:", error);
    },
  );
};

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
    const normalizedTrainerId = normalizeTrainerId(trainer_id);
    const normalizedEmail = normalizeEmail(email);

    // Validate ID format
    if (!TRAINER_ID_REGEX.test(normalizedTrainerId)) {
      throw new Error(
        `Invalid Trainer ID format. Must be GA-TXXX (e.g., GA-T001). Received: ${trainer_id}`,
      );
    }

    await assertTrainerUnique({ trainer_id: normalizedTrainerId });

    // Create Auth User first
    let uid;
    try {
      uid = await createUserWithoutLoggingIn(normalizedEmail, password);
    } catch (authError) {
      // If auth fails (e.g. email exists), throw immediately
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // Use UID as Document ID
    await setDoc(doc(db, COLLECTION_NAME, uid), {
      uid, // redundancy but useful
      role: "trainer",
      trainer_id: normalizedTrainerId,
      name: name.trim(),
      domain,
      specialisation,
      topics,
      email: normalizedEmail,
      emailLower: normalizedEmail,
      createdAt: serverTimestamp(),
    });

    // Send Onboarding Email
    await sendTrainerOnboardingEmail({
      name: name.trim(),
      email: normalizedEmail,
      temporary_password: password,
    });

    // Update counter (skip during batch — batch updates once at the end)
    if (!skipCounterUpdate) {
      const num = extractTrainerNumber(normalizedTrainerId);
      if (num > 0) {
        const currentCounter = await getTrainerIdCounter();
        if (num > currentCounter) {
          await updateTrainerIdCounter(num);
        }
      }
    }

    // Return compatible object
    return {
      id: uid,
      trainer_id: normalizedTrainerId,
      name: name.trim(),
      email: normalizedEmail,
    };
  } catch (error) {
    console.error("Error adding trainer:", error);
    throw error;
  }
};

// Update an existing trainer
export const updateTrainer = async (id, updates) => {
  try {
    const sanitizedUpdates = { ...updates };

    if (sanitizedUpdates.trainer_id) {
      sanitizedUpdates.trainer_id = normalizeTrainerId(
        sanitizedUpdates.trainer_id,
      );
    }

    if (sanitizedUpdates.email) {
      sanitizedUpdates.email = normalizeEmail(sanitizedUpdates.email);
      sanitizedUpdates.emailLower = sanitizedUpdates.email;
    }

    if (sanitizedUpdates.trainer_id) {
      await assertTrainerUnique(sanitizedUpdates, id);
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...sanitizedUpdates,
      updatedAt: serverTimestamp(),
    });
    return { id, ...sanitizedUpdates };
  } catch (error) {
    console.error("Error updating trainer:", error);
    throw error;
  }
};

// Soft delete a trainer (sets isDeleted flag instead of removing the document)
export const deleteTrainer = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error deleting trainer:", error);
    throw error;
  }
};

// Get all trainers (with pagination)
export const getAllTrainers = async (limitCount = 10, lastDoc = null, includeDeleted = true) => {
  try {
    let q;
    const baseCol = collection(db, COLLECTION_NAME);
    
    if (includeDeleted) {
      q = query(baseCol, limit(limitCount));
    } else {
      q = query(baseCol, where("isDeleted", "!=", true), limit(limitCount));
    }

    if (lastDoc) {
      if (includeDeleted) {
        q = query(baseCol, startAfter(lastDoc), limit(limitCount));
      } else {
        q = query(baseCol, where("isDeleted", "!=", true), startAfter(lastDoc), limit(limitCount));
      }
    }

    const querySnapshot = await getDocs(q);
    const trainers = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      trainers: dedupeTrainerRecords(trainers),
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
      hasMore: querySnapshot.docs.length === limitCount,
    };
  } catch (error) {
    console.error("Error getting trainers:", error);
    throw error;
  }
};

// Get trainer by ID (returns null for soft-deleted trainers)
export const getTrainerById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Exclude soft-deleted trainers
      if (data.isDeleted === true) return null;
      return { id: docSnap.id, ...data };
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
    const existingTrainerId = normalizeTrainerId(data.trainer_id);

    if (existingTrainerId) existingIds.add(existingTrainerId);
  });

  // 2. Track IDs within this batch to catch intra-batch duplicates
  const batchIds = new Set();

  for (const trainer of trainers) {
    try {
      const trainerId = normalizeTrainerId(trainer.trainer_id);
      const email = normalizeEmail(trainer.email);

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
      const added = await addTrainer(
        { ...trainer, trainer_id: trainerId, email },
        { skipCounterUpdate: true },
      );
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

const cleanTrainerName = (name = "") =>
  name
    .toLowerCase()
    .replace(/\b(mr|dr|mrs|ms|prof|trainer)\.?\b/gi, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isTrainerNameMatch = (nameA = "", nameB = "") => {
  const a = cleanTrainerName(nameA);
  const b = cleanTrainerName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const wordsA = a.split(" ").filter((w) => w.length > 2);
  const wordsB = b.split(" ").filter((w) => w.length > 2);
  if (wordsA.length > 0 && wordsB.length > 0) {
    const commonWords = wordsA.filter((w) => wordsB.includes(w));
    if (
      commonWords.length >= 2 ||
      (wordsA.length === 1 && commonWords.length === 1 && wordsB.length === 1)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Accurately extracts a specific trainer's compiled stats from a session document.
 * Handles single-trainer, multi-trainer (byTrainer mapping), and legacy format sessions.
 * Prevents multi-trainer whole-session data leaking into a single trainer's metrics.
 */
export const resolveTrainerStatsFromSession = (session, trainer) => {
  if (!session || !trainer) return null;
  const cs = session.compiledStats || session.stats;
  if (!cs) return null;

  const tId = trainer.id;
  const tTrainerId = trainer.trainer_id;
  const tName = trainer.name || "";
  const tEmail = trainer.email ? trainer.email.trim().toLowerCase() : "";

  // Check if trainer was assigned to this session
  const assigned = session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : []);
  const isAssigned =
    assigned.some((t) => {
      if (!t) return false;
      if (typeof t === "string") {
        if (tId && t === tId) return true;
        if (tTrainerId && t.trim().toUpperCase() === tTrainerId.trim().toUpperCase()) return true;
        if (tName && isTrainerNameMatch(t, tName)) return true;
        return false;
      }
      if (tId && (t.id === tId || t.trainer_id === tId || t.uid === tId)) return true;
      if (tTrainerId && (t.trainer_id === tTrainerId || t.id === tTrainerId)) return true;
      if (tEmail && t.email && t.email.trim().toLowerCase() === tEmail) return true;
      if (tName && t.name && isTrainerNameMatch(t.name, tName)) return true;
      return false;
    }) ||
    (session.trainerIds && Array.isArray(session.trainerIds) && (
      (tId && session.trainerIds.includes(tId)) ||
      (tTrainerId && session.trainerIds.includes(tTrainerId))
    )) ||
    (session.trainerId && (session.trainerId === tId || session.trainerId === tTrainerId)) ||
    (session.trainerName && isTrainerNameMatch(session.trainerName, tName));

  const hasByTrainer =
    cs.byTrainer &&
    typeof cs.byTrainer === "object" &&
    Object.keys(cs.byTrainer).length > 0;

  // 1. If per-trainer breakdown (byTrainer) exists, check if this trainer is matched
  if (hasByTrainer) {
    if (tId && cs.byTrainer[tId]) {
      return cs.byTrainer[tId];
    }
    if (tTrainerId && cs.byTrainer[tTrainerId]) {
      return cs.byTrainer[tTrainerId];
    }
    const matchedKey = Object.keys(cs.byTrainer).find((key) => {
      const entry = cs.byTrainer[key];
      if (!entry) return false;
      const entryName = entry.trainerName || entry.name || "";
      const entryEmail = (entry.email || entry.trainerEmail || "").trim().toLowerCase();
      if (tEmail && entryEmail && tEmail === entryEmail) return true;
      if (tName && entryName && isTrainerNameMatch(entryName, tName)) return true;
      if (tTrainerId && key.trim().toUpperCase() === tTrainerId.trim().toUpperCase()) return true;
      if (tId && key === tId) return true;
      if (tName && isTrainerNameMatch(key, tName)) return true;
      return false;
    });

    if (matchedKey && cs.byTrainer[matchedKey]) {
      return cs.byTrainer[matchedKey];
    }

    // If byTrainer only has 1 key and trainer was assigned or only 1 trainer assigned to session
    const byTrainerKeys = Object.keys(cs.byTrainer);
    if (byTrainerKeys.length === 1 && (isAssigned || !session.assignedTrainers || session.assignedTrainers.length <= 1)) {
      return cs.byTrainer[byTrainerKeys[0]];
    }

    // If trainer was assigned to the session, fallback to overall stats
    if (isAssigned) {
      return cs;
    }

    return null;
  }

  // 2. If NO byTrainer breakdown exists (unsegmented session):
  if (isAssigned) {
    return cs;
  }

  return null;
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
