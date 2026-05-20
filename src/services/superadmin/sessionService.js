import { db } from "../firebase";
import {
  collection,
  setDoc,
  updateDoc,
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

  return onSnapshot(q, async (snapshot) => {
    let sessions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        isLive: data.status === "active",
        responseCount: data.compiledStats?.totalResponses || 0,
      };
    });

    // Resolve stats once if compiledStats is null or missing ratingDistribution for inactive sessions.
    // We do NOT subscribe to active sessions' responses or auto-compile them dynamically in-memory.
    for (let session of sessions) {
      if (session.status !== "active") {
        if (!session.compiledStats || !session.compiledStats.ratingDistribution) {
          try {
            const { getSessionStats } = await import("./responseService");
            const fullStats = await getSessionStats(session.id, session);
            if (fullStats) {
              sessions = sessions.map(s => 
                s.id === session.id 
                  ? { 
                      ...s, 
                      compiledStats: fullStats,
                      responseCount: fullStats.totalResponses || 0 
                    } 
                  : s
              );
              callback(
                sessions,
                snapshot.docs[snapshot.docs.length - 1],
                snapshot.docs.length === 50
              );
            }
          } catch (e) {
            console.error("Failed to resolve stats for inactive session in subscribe:", session.id, e);
          }
        }
      }
    }

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

  return onSnapshot(q, async (snapshot) => {
    let currentSessions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        isLive: data.status === "active",
        responseCount: data.compiledStats?.totalResponses || 0,
      };
    });

    // Resolve stats once if compiledStats is null or missing ratingDistribution for inactive sessions.
    // We do NOT subscribe to active sessions' responses or auto-compile them dynamically in-memory.
    for (let session of currentSessions) {
      if (session.status !== "active") {
        if (!session.compiledStats || !session.compiledStats.ratingDistribution) {
          try {
            const { getSessionStats } = await import("./responseService");
            const fullStats = await getSessionStats(session.id, session);
            if (fullStats) {
              currentSessions = currentSessions.map(s => 
                s.id === session.id 
                  ? { 
                      ...s, 
                      compiledStats: fullStats,
                      responseCount: fullStats.totalResponses || 0 
                    } 
                  : s
              );
              callback(
                currentSessions,
                snapshot.docs[snapshot.docs.length - 1],
                snapshot.docs.length === 100
              );
            }
          } catch (e) {
            console.error("Failed to resolve stats for inactive session in subscribeToCollegeSessions:", session.id, e);
          }
        }
      }
    }

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

// Soft delete (archive) a session
export const deleteSession = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      archived: true,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error archiving session:", error);
    throw error;
  }
};

// Restore a soft-deleted (archived) session
export const restoreSession = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      archived: false,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error restoring session:", error);
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
    const { getResponses, compileAllSegmentsFromResponses, saveDecoupledStats } = await import("./responseService");
    const { runTransaction } = await import("firebase/firestore");

    const sessionSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!sessionSnap.exists()) throw new Error("Session not found");
    const sessionDataToCompile = sessionSnap.data();

    const allResponses = await getResponses(id);
    const compiledSegments = compileAllSegmentsFromResponses(allResponses, sessionDataToCompile.questions || [], sessionDataToCompile);

    // Save detailed stats in stats subcollection documents
    await saveDecoupledStats(id, compiledSegments);

    // Save duplicated full stats on parent session document
    const finalMergedStats = {
      ...compiledSegments.overall,
      byTrainer: compiledSegments.byTrainer,
      byBatch: compiledSegments.byBatch,
      byBranch: compiledSegments.byBranch,
    };

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

      // Update session with status, lightweight stats, and phase-out timing
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
    const rawSessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Resolve full stats for older inactive sessions
    const { getSessionStats } = await import("./responseService");
    const sessions = await Promise.all(
      rawSessions.map(async (session) => {
        const isLive = session.status === "active";
        if (isLive) {
          return {
            ...session,
            isLive,
            responseCount: session.compiledStats?.totalResponses || 0,
          };
        }
        
        let resolvedSession = { ...session, isLive };
        if (!session.compiledStats || !session.compiledStats.ratingDistribution) {
          try {
            const fullStats = await getSessionStats(session.id, session);
            if (fullStats) {
              resolvedSession.compiledStats = fullStats;
            }
          } catch (e) {
            console.error("Failed to resolve stats for older session:", session.id, e);
          }
        }
        resolvedSession.responseCount = resolvedSession.compiledStats?.totalResponses || 0;
        return resolvedSession;
      })
    );

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

    if (collegeId && collegeId !== "all")
      constraints.push(where("collegeId", "==", collegeId));

    // Date filtering — must come before orderBy on the same field
    if (startDate) constraints.push(where("sessionDate", ">=", startDate));
    if (endDate) constraints.push(where("sessionDate", "<=", endDate));

    // orderBy must come AFTER all where clauses, fetch a large pool to support client-side filters
    constraints.push(orderBy("sessionDate", "desc"));
    constraints.push(limit(500));

    let rawSessions = [];

    // If trainer filter is active, run dual queries for backward compat
    if (trainerId && trainerId !== "all") {
      const q1 = query(collection(db, COLLECTION_NAME), where("trainerIds", "array-contains", trainerId), ...constraints);
      const q2 = query(collection(db, COLLECTION_NAME), where("assignedTrainer.id", "==", trainerId), ...constraints);

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const seen = new Set();
      [...snap1.docs, ...snap2.docs].forEach((doc) => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          rawSessions.push({ id: doc.id, ...doc.data() });
        }
      });
    } else {
      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const snapshot = await getDocs(q);
      rawSessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    // Filter dynamically on the Javascript side to avoid composite index limits
    let filtered = rawSessions;

    // Filter by status if not includeActive
    if (!includeActive) {
      filtered = filtered.filter((s) => s.status === "inactive");
    }

    // Filter by course
    if (course && course !== "all") {
      filtered = filtered.filter((s) => s.course === course);
    }

    // Filter by year
    if (year && year !== "all") {
      filtered = filtered.filter((s) => s.year === year);
    }

    // Filter by projectCode
    if (projectCode && projectCode !== "all") {
      filtered = filtered.filter((s) => s.projectCode === projectCode);
    }

    // Filter by branch/department and batch in Javascript to support array lists cleanly
    if (department && department !== "all") {
      filtered = filtered.filter((s) => 
        s.branch === department || 
        (s.branches && s.branches.includes(department))
      );
    }

    if (batch && batch !== "all") {
      filtered = filtered.filter((s) => 
        s.batch === batch || 
        (s.batches && s.batches.includes(batch))
      );
    }

    // Sort by sessionDate desc
    filtered.sort((a, b) => (b.sessionDate || "").localeCompare(a.sessionDate || ""));

    // Slice to desired limitCount
    const sessions = filtered.slice(0, limitCount).map((s) => ({
      ...s,
      isLive: s.status === "active",
      responseCount: s.compiledStats?.totalResponses || 0,
    }));

    return sessions;
  } catch (error) {
    console.error("Error fetching analytics sessions:", error);
    // Return empty array on error to prevent crash
    return [];
  }
};
