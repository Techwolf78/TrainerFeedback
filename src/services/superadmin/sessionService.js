import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
} from "firebase/firestore";

const COLLECTION_NAME = "sessions";

// Create a new session
export const createSession = async (sessionData) => {
  try {
    const {
      collegeId,
      collegeName,
      academicYear,
      course,
      branch,
      batch,
      year,
      sessionTime, // 'Morning' | 'Afternoon'
      sessionDate,
      assignedTrainer, // { id, name }
      topic,
      domain,
      sessionDuration = 60, // minutes
      questions = [],
      ttl = 24, // hours until expiry
      projectId = "",
      projectCode = "",
    } = sessionData;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      collegeId,
      collegeName,
      academicYear,
      course,
      branch,
      batch,
      year,
      sessionTime,
      sessionDate,
      assignedTrainer,
      topic,
      domain,
      sessionDuration,
      questions,
      projectId,
      projectCode,
      status: "active",
      templateId: sessionData.templateId || null,
      createdAt: serverTimestamp(),
    });

    return { id: docRef.id, ...sessionData };
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
};

// Update an existing session
export const updateSession = async (id, updates) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { id, ...updates };
  } catch (error) {
    console.error("Error updating session:", error);
    throw error;
  }
};

// Delete a session
export const deleteSession = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const session = { id: docSnap.id, ...docSnap.data() };

      // If session contributed to analytics, remove its stats from cache
      if (session.status === "inactive" && session.compiledStats) {
        try {
          // Dynamic import to avoid circular dependency
          const { updateCollegeCache, updateTrainerCache } =
            await import("./cacheService");

          await Promise.all([
            updateCollegeCache(session, session.compiledStats, true), // true = isDelete
            updateTrainerCache(session, session.compiledStats, true),
          ]);
        } catch (cacheErr) {
          console.error(
            "Failed to cleanup cache for deleted session:",
            cacheErr,
          );
          // Continue with deletion anyway
        }
      }
    }

    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting session:", error);
    throw error;
  }
};

// Get all sessions (allows filtering)
export const getAllSessions = async (collegeId = null) => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc"),
    );

    if (collegeId) {
      q = query(
        collection(db, COLLECTION_NAME),
        where("collegeId", "==", collegeId),
        orderBy("createdAt", "desc"),
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting sessions:", error);
    throw error;
  }
};

// Get sessions by Trainer ID
export const getSessionsByTrainer = async (trainerId) => {
  try {
    // Note: Removed orderBy to avoid strict index requirement for now
    const q = query(
      collection(db, COLLECTION_NAME),
      where("assignedTrainer.id", "==", trainerId),
    );

    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Client-side sort by createdAt desc
    return sessions.sort((a, b) => {
      const dateA = a.createdAt?.toDate
        ? a.createdAt.toDate()
        : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate
        ? b.createdAt.toDate()
        : new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting trainer sessions:", error);
    throw error;
  }
};

/**
 * Get paginated sessions for a college
 * @param {string} collegeId
 * @param {number} pageSize
 * @param {Object} lastDoc - The last document from previous fetch (for cursor)
 */
export const getSessionsByCollege = async (
  collegeId,
  pageSize = 50,
  lastDoc = null,
) => {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("collegeId", "==", collegeId),
      orderBy("sessionDate", "desc"),
      orderBy("createdAt", "desc"), // Secondary sort for stability
      limit(pageSize),
    );

    if (lastDoc) {
      q = query(
        collection(db, COLLECTION_NAME),
        where("collegeId", "==", collegeId),
        orderBy("sessionDate", "desc"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize),
      );
    }

    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      sessions,
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    console.error("Error getting paginated sessions:", error);
    throw error;
  }
};

/**
 * Get active sessions for a college (for pinning to top)
 */
export const getActiveSessionsByCollege = async (collegeId) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("collegeId", "==", collegeId),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting active sessions:", error);
    // Don't throw, just return empty if error (resilience)
    return [];
  }
};

// Get session by ID
export const getSessionById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting session:", error);
    throw error;
  }
};

/**
 * Close a session and compile all response statistics
 * This stores the compiled stats in the session document itself
 * and updates the college/trainer cache documents safely using a transaction
 * to prevent double-counting race conditions.
 * @param {string} id - Session ID
 * @returns {Promise<Object>} - Updated session with compiled stats
 */
export const closeSessionWithStats = async (id) => {
  try {
    // Import compileSessionStats dynamically to avoid circular dependency

    // 1. Compile statistics first (outside transaction)
    // IMPORTANT: compileSessionStats now ONLY compiles the *current* responses in the subcollection.
    // Due to the reactivation clear logic, this represents the "delta" stats since the last activation.
    const { compileSessionStats, mergeStats } =
      await import("./responseService");
    const {
      updateCollegeCache,
      updateTrainerCache,
      getCollegeCacheRefs,
      getTrainerCacheRefs,
    } = await import("./cacheService");
    const { runTransaction } = await import("firebase/firestore");

    const deltaStats = await compileSessionStats(id);

    let sessionDataForCache = null;
    let finalMergedStats = deltaStats;

    // 2. Run Transaction
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, COLLECTION_NAME, id);
      const sessionDoc = await transaction.get(docRef);

      if (!sessionDoc.exists()) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data();

      // CRITICAL GUARD
      if (sessionData.status === "inactive") {
        throw new Error(
          "Session is already closed. Updates aborted to prevent double-counting.",
        );
      }

      const session = { id: sessionDoc.id, ...sessionData };
      sessionDataForCache = session;

      // If the session was previously closed and reactivated, it will already have compiledStats.
      // We need to merge the existing stats with the new delta stats for the session document,
      // but we ONLY send the deltaStats to the ecosystem caches to prevent double-counting.
      if (sessionData.compiledStats) {
        finalMergedStats = mergeStats(sessionData.compiledStats, deltaStats);
      }

      // ============ PRE-FETCH CACHE DOCS ============
      // We must perform ALL reads before ANY writes to satisfy Firestore Transaction rules.
      // We can't rely on updateCollegeCache/updateTrainerCache to read, because
      // updateCollegeCache would Write, preventing updateTrainerCache from Reading.

      const { cacheRef: cRef, trendRef: ctRef } = getCollegeCacheRefs(
        session.collegeId,
        session.sessionDate,
      );
      let tRef, ttRef;
      const reads = [transaction.get(cRef), transaction.get(ctRef)];

      if (session.assignedTrainer?.id) {
        const { cacheRef, trendRef } = getTrainerCacheRefs(
          session.assignedTrainer.id,
          session.sessionDate,
        );
        tRef = cacheRef;
        ttRef = trendRef;
        reads.push(transaction.get(tRef));
        reads.push(transaction.get(ttRef));
      }

      const snapshots = await Promise.all(reads);

      // Unpack snapshots
      const collegeCacheDoc = snapshots[0];
      const collegeTrendDoc = snapshots[1];
      const trainerCacheDoc = session.assignedTrainer?.id ? snapshots[2] : null;
      const trainerTrendDoc = session.assignedTrainer?.id ? snapshots[3] : null;

      // ============ EXECUTE UPDATES ============
      // Pass pre-fetched docs to update functions so they don't try to read again.
      // pass deltaStats so we only increment by the new responses
      await updateCollegeCache(session, deltaStats, false, transaction, {
        cacheDoc: collegeCacheDoc,
        trendDoc: collegeTrendDoc,
      });

      if (session.assignedTrainer?.id) {
        // pass deltaStats so we only increment by the new responses
        await updateTrainerCache(session, deltaStats, false, transaction, {
          cacheDoc: trainerCacheDoc,
          trendDoc: trainerTrendDoc,
        });
      }

      // Update session with status and MERGED compiled stats (Write)
      transaction.update(docRef, {
        status: "inactive",
        compiledStats: finalMergedStats,
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    // 3. Post-Transaction: Update Qualitative Cache (Experience Data)
    // This is run asynchronously and does not
    //  block the success return if it takes time.
    // It handles merging top/worst comments into the global cache.
    if (sessionDataForCache) {
      const { updateQualitativeCache } = await import("./cacheService");
      updateQualitativeCache(sessionDataForCache, compiledStats).catch((err) =>
        console.error("Background qualitative update failed:", err),
      );
    }

    return { id, status: "inactive", compiledStats };
  } catch (error) {
    if (error.message.includes("Session is already closed")) {
      console.warn("Session close ignored:", error.message);
      // Return existing state if known, or just the inactive status
      return { id, status: "inactive" };
    }
    console.error("Error closing session with stats:", error);
    throw error;
  }
};

/**
 * Subscribe to real-time session updates
 * Limited to 50 most recent sessions to reduce read costs
 * @param {Function} callback - Callback function receiving (sessions, lastDoc, hasMore)
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToSessions = (callback) => {
  const PAGE_SIZE = 50;
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === PAGE_SIZE;
      callback(sessions, lastDoc, hasMore);
    },
    (error) => {
      console.error("Error in sessions subscription:", error);
    },
  );
};

/**
 * Fetch older sessions beyond the real-time subscription window
 * Uses cursor-based pagination with startAfter
 * @param {Object} lastDoc - The last document snapshot from previous fetch
 * @param {number} pageSize - Number of sessions to fetch per page
 * @returns {Promise<{sessions: Array, lastDoc: Object, hasMore: boolean}>}
 */
export const getOlderSessions = async (lastDoc, pageSize = 50) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(pageSize),
    );

    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      sessions,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    console.error("Error fetching older sessions:", error);
    throw error;
  }
};

/**
 * Fetch sessions for analytics with dynamic filters and limit
 * Used for Overview Dashboards to avoid processing all sessions client-side
 * @param {Object} params - { collegeId, trainerId, course, year, branch, batch, projectCode, limit }
 * @returns {Promise<Array>} - List of sessions with compiledStats
 */
export const getAnalyticsSessions = async (params) => {
  try {
    const {
      collegeId,
      trainerId,
      course,
      year,
      department, // mapped to branch in db
      batch,
      projectCode,
      startDate, // 'YYYY-MM-DD'
      endDate, // 'YYYY-MM-DD'
      limitCount = 30,
    } = params;

    const constraints = [
      where("status", "==", "inactive"), // Only closed sessions have stats
    ];

    if (collegeId && collegeId !== "all")
      constraints.push(where("collegeId", "==", collegeId));
    if (trainerId && trainerId !== "all")
      constraints.push(where("assignedTrainer.id", "==", trainerId));
    if (course && course !== "all")
      constraints.push(where("course", "==", course));
    if (year && year !== "all") constraints.push(where("year", "==", year));
    if (department && department !== "all")
      constraints.push(where("branch", "==", department));
    if (batch && batch !== "all") constraints.push(where("batch", "==", batch));
    if (projectCode && projectCode !== "all")
      constraints.push(where("projectCode", "==", projectCode));

    // Date filtering — must come before orderBy on the same field
    if (startDate) constraints.push(where("sessionDate", ">=", startDate));
    if (endDate) constraints.push(where("sessionDate", "<=", endDate));

    // orderBy and limit must come AFTER all where clauses
    constraints.push(orderBy("sessionDate", "desc"));
    constraints.push(limit(limitCount));

    const q = query(collection(db, COLLECTION_NAME), ...constraints);

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching analytics sessions:", error);
    // Return empty array on error to prevent crash
    return [];
  }
};
