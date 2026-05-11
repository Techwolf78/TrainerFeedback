import { db } from "../firebase";
import {
  collection,
  setDoc,
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

const getSessionMetadata = (data) => {
  const collegePart = (data.collegeName || "COL")
    .split(" ")[0]
    .substring(0, 3)
    .toUpperCase();
  const datePart = (data.sessionDate || new Date().toISOString().split("T")[0])
    .replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return {
    datePart,
    randomPart,
    sessionId: `SESS-${collegePart}-${datePart}-${randomPart}`
  };
};

/**
 * Create a new session with a custom human-readable document ID
 * @param {Object} data - Session data
 * @returns {Promise<Object>} - Created session
 */
export const createSession = async (data) => {
  try {
    const { datePart, randomPart, sessionId } = getSessionMetadata(data);
    const docRef = doc(db, COLLECTION_NAME, sessionId);

    const sessionData = {
      ...data,
      id: sessionId,
      status: "active",
      phaseId: `PHASE-${datePart}-${randomPart}`,
      phaseStartedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reactivationCount: 0,
    };

    await setDoc(docRef, sessionData);
    return sessionData;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
};

/**
 * Subscribe to real-time session updates with live responses for active sessions
 * @param {Function} callback - (sessions, lastDoc, hasMore)
 */
export const subscribeToSessions = (callback) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
    limit(50),
  );

  let activeSessionUnsubscribes = {}; // { sessionId: unsubscribeFunction }

  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Identify sessions that need live response tracking or have existing stats in doc
    // We now start listeners for ALL fetched sessions so that stats are loaded correctly in lists
    const sessionIdsInView = new Set(sessions.map((s) => s.id));

    // Cleanup unsubscribes for sessions that are no longer in view
    Object.keys(activeSessionUnsubscribes).forEach((id) => {
      if (!sessionIdsInView.has(id)) {
        activeSessionUnsubscribes[id]();
        delete activeSessionUnsubscribes[id];
      }
    });

    // Setup new unsubscribes for sessions
    sessions.forEach((session) => {
      if (!activeSessionUnsubscribes[session.id]) {
        // console.log(`[Stats] Starting sub-listener for session: ${session.id}`);
        const responsesRef = collection(db, COLLECTION_NAME, session.id, "responses");
        const responsesQuery = query(responsesRef, orderBy("submittedAt", "desc"));

        activeSessionUnsubscribes[session.id] = onSnapshot(responsesQuery, async (responseSnapshot) => {
          const responses = responseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          if (responses.length > 0) {
            const { compileSessionStatsFromResponses } = await import("./responseService");
            const liveStats = compileSessionStatsFromResponses(responses, session.questions || []);

            // Identify current session in the list and update it
            const updatedSessions = sessions.map(s => 
              s.id === session.id ? { ...s, compiledStats: liveStats, isLive: s.status === "active", responseCount: responses.length } : s
            );
            
            callback(
              updatedSessions,
              snapshot.docs[snapshot.docs.length - 1],
              snapshot.docs.length === 50
            );
          }
        });
      }
    });

    // Initial callback for the main sessions update
    callback(
      sessions,
      snapshot.docs[snapshot.docs.length - 1],
      snapshot.docs.length === 50,
    );
  });
};

/**
 * Subscribe to real-time session updates for a specific college
 * @param {string} collegeId - College ID to filter sessions
 * @param {Function} callback - (sessions, lastDoc, hasMore)
 */
export const subscribeToCollegeSessions = (collegeId, callback) => {
  if (!collegeId) return () => {};

  const q = query(
    collection(db, COLLECTION_NAME),
    where("collegeId", "==", collegeId),
    orderBy("createdAt", "desc"),
    limit(100),
  );

  let activeSessionUnsubscribes = {};

  return onSnapshot(q, (snapshot) => {
    let currentSessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Identify sessions that need live response tracking or have existing stats
    // We now start listeners for ALL fetched sessions so that stats are loaded correctly in lists
    const sessionIdsInView = new Set(currentSessions.map((s) => s.id));

    // Cleanup unsubscribes
    Object.keys(activeSessionUnsubscribes).forEach((id) => {
      if (!sessionIdsInView.has(id)) {
        if (typeof activeSessionUnsubscribes[id] === "function") {
          activeSessionUnsubscribes[id]();
        }
        delete activeSessionUnsubscribes[id];
      }
    });

    // Setup sub-listeners for sessions
    currentSessions.forEach((session) => {
      if (!activeSessionUnsubscribes[session.id]) {
        const responsesRef = collection(db, COLLECTION_NAME, session.id, "responses");
        const responsesQuery = query(responsesRef, orderBy("submittedAt", "desc"));

        activeSessionUnsubscribes[session.id] = onSnapshot(responsesQuery, async (responseSnapshot) => {
          const responses = responseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          if (responses.length > 0) {
            const { compileSessionStatsFromResponses } = await import("./responseService");
            const liveStats = compileSessionStatsFromResponses(responses, session.questions || []);

            // Update the specific session in the list
            currentSessions = currentSessions.map(s => 
              s.id === session.id ? { ...s, compiledStats: liveStats, isLive: s.status === "active", responseCount: responses.length } : s
            );
            
            callback(
              currentSessions,
              snapshot.docs[snapshot.docs.length - 1],
              snapshot.docs.length === 100
            );
          }
        });
      }
    });

    // Initial callback
    callback(
      currentSessions,
      snapshot.docs[snapshot.docs.length - 1],
      snapshot.docs.length === 100,
    );
  });
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
      /* Cache removal logic deprecated: all dashboards now read from sessions directly */
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

// Get sessions by Trainer ID (supports both old and new format)
export const getSessionsByTrainer = async (trainerId) => {
  try {
    // Query 1: New format (trainerIds array)
    const q1 = query(
      collection(db, COLLECTION_NAME),
      where("trainerIds", "array-contains", trainerId),
      orderBy("createdAt", "desc"),
    );

    // Query 2: Legacy format (assignedTrainer.id)
    const q2 = query(
      collection(db, COLLECTION_NAME),
      where("assignedTrainer.id", "==", trainerId),
      orderBy("createdAt", "desc"),
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    // Merge and deduplicate by doc ID
    const seen = new Set();
    const results = [];
    [...snap1.docs, ...snap2.docs].forEach((doc) => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        results.push({ id: doc.id, ...doc.data() });
      }
    });

    return results;
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

    // 1. Compile statistics directly from ALL responses (outside transaction)
    // We completely bypass delta stats and merging logic to prevent double-counting.
    // This simply recalculates the true state from the raw response documents.
    const { getResponses, compileSessionStatsFromResponses } = await import("./responseService");
    const { runTransaction } = await import("firebase/firestore");

    const sessionSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionDataToCompile = sessionSnap.data();

    const allResponses = await getResponses(id);
    const finalMergedStats = compileSessionStatsFromResponses(allResponses, sessionDataToCompile.questions || []);

    let sessionDataForCache = null;

    // 2. Run Transaction
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, COLLECTION_NAME, id);
      const sessionDoc = await transaction.get(docRef);

      if (!sessionDoc.exists()) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data();

      // CRITICAL: Prevent any updates to permanently closed sessions
      if (sessionData.permanentlyClosed) {
        throw new Error(
          "Session is permanently closed and cannot be modified. This phase is archived.",
        );
      }

      // CRITICAL GUARD
      if (sessionData.status === "inactive") {
        throw new Error(
          "Session is already closed. Updates aborted to prevent double-counting.",
        );
      }

      const session = { id: sessionDoc.id, ...sessionData };
      sessionDataForCache = session;

      // Update session with status, final stats, and phase-out timing
      transaction.update(docRef, {
        status: "inactive",
        permanentlyClosed: true,
        compiledStats: finalMergedStats,
        phaseEndedAt: serverTimestamp(),
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return { id, status: "inactive", compiledStats: finalMergedStats };
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
      includeActive = false, // New parameter to include live sessions
    } = params;

    const constraints = [];
    
    // Only filter by status if we explicitly want only inactive sessions
    if (!includeActive) {
      constraints.push(where("status", "==", "inactive"));
    }

    if (collegeId && collegeId !== "all")
      constraints.push(where("collegeId", "==", collegeId));
    // NOTE: trainer filter is handled separately via dual-query for backward compat (see below)
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

    // If trainer filter is active, run dual queries for backward compat
    if (trainerId && trainerId !== "all") {
      // Build constraints without trainer filter
      const baseConstraints = constraints.filter(
        (c) => c !== constraints.find((x) => x._field?.segments?.includes?.("trainerIds"))
      );
      // Actually just rebuild without the trainer constraint
      const sharedConstraints = [];
      if (!includeActive) sharedConstraints.push(where("status", "==", "inactive"));
      if (collegeId && collegeId !== "all") sharedConstraints.push(where("collegeId", "==", collegeId));
      if (course && course !== "all") sharedConstraints.push(where("course", "==", course));
      if (year && year !== "all") sharedConstraints.push(where("year", "==", year));
      if (department && department !== "all") sharedConstraints.push(where("branch", "==", department));
      if (batch && batch !== "all") sharedConstraints.push(where("batch", "==", batch));
      if (projectCode && projectCode !== "all") sharedConstraints.push(where("projectCode", "==", projectCode));
      if (startDate) sharedConstraints.push(where("sessionDate", ">=", startDate));
      if (endDate) sharedConstraints.push(where("sessionDate", "<=", endDate));
      sharedConstraints.push(orderBy("sessionDate", "desc"));
      sharedConstraints.push(limit(limitCount));

      const q1 = query(collection(db, COLLECTION_NAME), where("trainerIds", "array-contains", trainerId), ...sharedConstraints);
      const q2 = query(collection(db, COLLECTION_NAME), where("assignedTrainer.id", "==", trainerId), ...sharedConstraints);

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const seen = new Set();
      const sessions = [];
      [...snap1.docs, ...snap2.docs].forEach((doc) => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          sessions.push({ id: doc.id, ...doc.data() });
        }
      });

      // Sort by sessionDate desc and apply limit
      sessions.sort((a, b) => (b.sessionDate || "").localeCompare(a.sessionDate || ""));
      const limitedSessions = sessions.slice(0, limitCount);

      return limitedSessions;
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints);

    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // For active sessions (live), ensure we can still show stats even if they have not been closed/compiled yet.
    const activeWithoutStats = sessions.filter(
      (s) => s.status === "active" && !s.compiledStats,
    );

    if (activeWithoutStats.length > 0) {
      try {
        const { compileSessionStats } = await import("./responseService");
        await Promise.all(
          activeWithoutStats.map(async (s) => {
            try {
              const reactivationCount = s.reactivationCount || 0;
              s.compiledStats = await compileSessionStats(s.id, reactivationCount);
            } catch (err) {
              // Best-effort: leave compiledStats undefined if compilation fails
              console.warn(
                `Failed to compile stats for active session ${s.id}:`,
                err,
              );
            }
          }),
        );
      } catch (err) {
        console.warn("Failed to dynamically import responseService for live stats:", err);
      }
    }

    return sessions;
  } catch (error) {
    console.error("Error fetching analytics sessions:", error);
    // Return empty array on error to prevent crash
    return [];
  }
};
