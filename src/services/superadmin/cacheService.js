import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  increment,
  FieldPath,
} from "firebase/firestore";

/**
 * Cache Service
 * Handles analytics cache updates for colleges and trainers
 */

const COLLEGE_CACHE_COLLECTION = "collegeCache";
const TRAINER_CACHE_COLLECTION = "trainerCache";

/**
 * Get current year-month string (e.g., "2026-02")
 */
const getYearMonth = (dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

/**
 * Get day of month string (e.g., "03")
 */
const getDayOfMonth = (dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  return String(date.getDate()).padStart(2, "0");
};

/**
 * Sanitize field name for Firestore paths
 * Firestore uses dots as path separators, so we replace them with underscores
 * e.g., "B.E." becomes "B_E_"
 * NOTE: This is only used for simple single-level paths. For nested course hierarchy,
 * we use separate updates with FieldPath which handles dots properly.
 */
const sanitizeFieldName = (name) => {
  if (!name) return "unknown";
  return String(name).replace(/\./g, "_").trim();
};

/**
 * Helper to update a nested field using FieldPath (handles dots in field names)
 * @param {DocumentReference} docRef
 * @param {string[]} pathSegments - Array of path segments e.g., ['courses', 'B.E.', 'totalResponses']
 * @param {any} value - Value to set
 */
const updateNestedField = async (docRef, pathSegments, value) => {
  const fieldPath = new FieldPath(...pathSegments);
  await updateDoc(docRef, { [fieldPath]: value });
};

/**
 * Update college cache after session close
 * @param {Object} session - The closed session object
 * @param {Object} stats - Compiled stats from the session
 * @param {boolean} isDelete - Whether this is a deletion (decrement stats)
 * @param {Object} transaction - Optional Firestore transaction
 */
/**
 * Update college cache after session close
 * @param {Object} session - The closed session object
 * @param {Object} stats - Compiled stats from the session
 * @param {boolean} isDelete - Whether this is a deletion (decrement stats)
 * @param {Object} transaction - Optional Firestore transaction
 */
/**
 * Helper to get cache references for pre-fetching in transactions
 */
export const getCollegeCacheRefs = (collegeId, sessionDate) => {
  const yearMonth = getYearMonth(sessionDate);
  return {
    cacheRef: doc(db, COLLEGE_CACHE_COLLECTION, collegeId),
    trendRef: doc(db, COLLEGE_CACHE_COLLECTION, collegeId, "trends", yearMonth),
  };
};

export const getTrainerCacheRefs = (trainerId, sessionDate) => {
  const yearMonth = getYearMonth(sessionDate);
  return {
    cacheRef: doc(db, TRAINER_CACHE_COLLECTION, trainerId),
    trendRef: doc(db, TRAINER_CACHE_COLLECTION, trainerId, "trends", yearMonth),
  };
};

/**
 * Update college cache after session close
 * @param {Object} session - The closed session object
 * @param {Object} stats - Compiled stats from the session
 * @param {boolean} isDelete - Whether this is a deletion (decrement stats)
 * @param {Object} transaction - Optional Firestore transaction
 * @param {Object} preFetchedDocs - Optional { cacheDoc, trendDoc } to avoid reads
 */
export const updateCollegeCache = async (
  session,
  stats,
  isDelete = false,
  transaction = null,
  preFetchedDocs = null,
) => {
  try {
    const collegeId = session.collegeId;
    const cacheRef = doc(db, COLLEGE_CACHE_COLLECTION, collegeId);

    // Trend Refs
    const sessionDate = session.sessionDate;
    const yearMonth = getYearMonth(sessionDate);
    const day = getDayOfMonth(sessionDate);
    const trendRef = doc(
      db,
      COLLEGE_CACHE_COLLECTION,
      collegeId,
      "trends",
      yearMonth,
    );

    // ============ 1. READ PHASE ============
    // Perform ALL reads before ANY writes
    let cacheDoc, trendDoc;

    if (preFetchedDocs) {
      cacheDoc = preFetchedDocs.cacheDoc;
      trendDoc = preFetchedDocs.trendDoc;
    } else if (transaction) {
      cacheDoc = await transaction.get(cacheRef);
      trendDoc = await transaction.get(trendRef);
    } else {
      cacheDoc = await getDoc(cacheRef);
      trendDoc = await getDoc(trendRef);
    }

    // ============ 2. CALCULATION PHASE ============

    const { totalResponses, ratingDistribution, categoryAverages } = stats;

    // Calculate rating sum and count from distribution
    const ratingSum = Object.entries(ratingDistribution || {}).reduce(
      (sum, [rating, count]) => sum + Number(rating) * count,
      0,
    );
    const totalRatingsCount = Object.values(ratingDistribution || {}).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Calculate session hours
    const sessionHours = (Number(session.sessionDuration) || 60) / 60;

    // Build category data increments
    const categoryIncrements = {};
    Object.entries(categoryAverages || {}).forEach(([cat, avg]) => {
      categoryIncrements[cat] = {
        sum: avg * totalResponses,
        count: totalResponses,
      };
    });

    const courseName = session.course || "Unknown";
    const yearName = session.year || "1";
    const batchName = session.batch || "A";
    const domain = session.domain ? sanitizeFieldName(session.domain) : null;
    const multiplier = isDelete ? -1 : 1;

    // ============ 3. WRITE PHASE ============

    // --- Update College Main Cache ---
    if (cacheDoc.exists()) {
      // Collect all updates into a flat array [field, value, field, value...]
      // capable of handling both strings and FieldPath objects.
      const flatUpdates = [];
      const addUpdate = (field, value) => flatUpdates.push(field, value);

      addUpdate("totalSessions", increment(1 * multiplier));
      addUpdate("totalResponses", increment(totalResponses * multiplier));
      addUpdate("totalRatingsCount", increment(totalRatingsCount * multiplier));
      addUpdate("ratingSum", increment(ratingSum * multiplier));
      addUpdate("totalHours", increment(sessionHours * multiplier));
      addUpdate("updatedAt", new Date().toISOString());

      // Update Topics Learned
      (stats.topicsLearned || []).forEach(({ name, count }) => {
        try {
          const topicPath = new FieldPath("topicsLearned", name);
          addUpdate(topicPath, increment(count * multiplier));
        } catch (err) {
          const safeName = sanitizeFieldName(name);
          addUpdate(`topicsLearned.${safeName}`, increment(count * multiplier));
        }
      });

      Object.entries(ratingDistribution || {}).forEach(([rating, count]) => {
        addUpdate(
          `ratingDistribution.${rating}`,
          increment(count * multiplier),
        );
      });

      Object.entries(categoryIncrements).forEach(([cat, data]) => {
        const safeCat = sanitizeFieldName(cat);
        addUpdate(
          `categoryData.${safeCat}.sum`,
          increment(data.sum * multiplier),
        );
        addUpdate(
          `categoryData.${safeCat}.count`,
          increment(data.count * multiplier),
        );
      });

      // Update Domain Stats
      if (domain) {
        addUpdate(
          `domains.${domain}.totalResponses`,
          increment(totalResponses * multiplier),
        );
        addUpdate(
          `domains.${domain}.totalRatingsCount`,
          increment(totalRatingsCount * multiplier),
        );
        addUpdate(
          `domains.${domain}.ratingSum`,
          increment(ratingSum * multiplier),
        );
      }

      // Course Hierarchy Updates (using FieldPath for safety with special chars in names)
      try {
        const coursePath = (...segments) =>
          new FieldPath("courses", courseName, ...segments);
        const yearPath = (...segments) =>
          new FieldPath("courses", courseName, "years", yearName, ...segments);
        const batchPath = (...segments) =>
          new FieldPath(
            "courses",
            courseName,
            "years",
            yearName,
            "batches",
            batchName,
            ...segments,
          );

        addUpdate(
          coursePath("totalResponses"),
          increment(totalResponses * multiplier),
        );
        addUpdate(
          coursePath("totalRatingsCount"),
          increment(totalRatingsCount * multiplier),
        );
        addUpdate(coursePath("ratingSum"), increment(ratingSum * multiplier));

        addUpdate(
          yearPath("totalResponses"),
          increment(totalResponses * multiplier),
        );
        addUpdate(
          yearPath("totalRatingsCount"),
          increment(totalRatingsCount * multiplier),
        );
        addUpdate(yearPath("ratingSum"), increment(ratingSum * multiplier));

        addUpdate(
          batchPath("totalResponses"),
          increment(totalResponses * multiplier),
        );
        addUpdate(
          batchPath("totalRatingsCount"),
          increment(totalRatingsCount * multiplier),
        );
        addUpdate(batchPath("ratingSum"), increment(ratingSum * multiplier));
      } catch (pathErr) {
        console.warn("Could not construct course paths:", pathErr.message);
      }

      // Perform the update
      if (flatUpdates.length > 0) {
        if (transaction) {
          transaction.update(cacheRef, ...flatUpdates);
        } else {
          await updateDoc(cacheRef, ...flatUpdates);
        }
      }
    } else if (!isDelete) {
      // Create new
      const newCache = {
        totalSessions: 1,
        totalResponses,
        totalRatingsCount,
        ratingSum,
        totalHours: sessionHours,
        ratingDistribution: ratingDistribution || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
        categoryData: {},
        domains: {}, // Initialize domains map
        topicsLearned: (stats.topicsLearned || []).reduce(
          (acc, { name, count }) => {
            acc[name] = count;
            return acc;
          },
          {},
        ),
        courses: {
          [courseName]: {
            totalResponses,
            totalRatingsCount,
            ratingSum,
            years: {
              [yearName]: {
                totalResponses,
                totalRatingsCount,
                ratingSum,
                batches: {
                  [batchName]: { totalResponses, totalRatingsCount, ratingSum },
                },
              },
            },
          },
        },
        updatedAt: new Date().toISOString(),
      };

      Object.entries(categoryIncrements).forEach(([cat, data]) => {
        newCache.categoryData[cat] = { sum: data.sum, count: data.count };
      });

      // Add initial domain stats
      if (domain) {
        newCache.domains[domain] = {
          totalResponses,
          totalRatingsCount,
          ratingSum,
        };
      }

      if (transaction) {
        transaction.set(cacheRef, newCache);
      } else {
        await setDoc(cacheRef, newCache);
      }
    }

    // --- Update Daily Trend ---
    // We already read trendDoc at the start, so we use that directly.

    if (trendDoc.exists()) {
      const updates = {
        [`dailyResponses.${day}`]: increment(totalResponses * multiplier),
        [`dailySessions.${day}`]: increment(1 * multiplier),
      };
      if (transaction) transaction.update(trendRef, updates);
      else await updateDoc(trendRef, updates);
    } else if (!isDelete) {
      const newData = {
        dailyResponses: { [day]: totalResponses },
        dailySessions: { [day]: 1 },
      };
      if (transaction) transaction.set(trendRef, newData);
      else await setDoc(trendRef, newData);
    }
  } catch (error) {
    console.error("Error updating college cache:", error);
    throw error;
  }
};

/**
 * Update trainer cache after session close
 */
export const updateTrainerCache = async (
  session,
  stats,
  isDelete = false,
  transaction = null,
  preFetchedDocs = null,
) => {
  try {
    const trainerId = session.assignedTrainer?.id;
    if (!trainerId) return;

    const cacheRef = doc(db, TRAINER_CACHE_COLLECTION, trainerId);

    // Trend Refs
    const sessionDate = session.sessionDate;
    const yearMonth = getYearMonth(sessionDate);
    const day = getDayOfMonth(sessionDate);
    const trendRef = doc(
      db,
      TRAINER_CACHE_COLLECTION,
      trainerId,
      "trends",
      yearMonth,
    );

    // ============ 1. READ PHASE ============
    let cacheDoc, trendDoc;
    if (preFetchedDocs) {
      cacheDoc = preFetchedDocs.cacheDoc;
      trendDoc = preFetchedDocs.trendDoc;
    } else if (transaction) {
      cacheDoc = await transaction.get(cacheRef);
      trendDoc = await transaction.get(trendRef);
    } else {
      cacheDoc = await getDoc(cacheRef);
      trendDoc = await getDoc(trendRef);
    }

    // ============ 2. CALCULATION PHASE ============
    const { totalResponses, ratingDistribution, categoryAverages } = stats;

    // Calculate sums...
    const ratingSum = Object.entries(ratingDistribution || {}).reduce(
      (sum, [rating, count]) => sum + Number(rating) * count,
      0,
    );
    const totalRatingsCount = Object.values(ratingDistribution || {}).reduce(
      (sum, count) => sum + count,
      0,
    );

    const categoryIncrements = {};
    Object.entries(categoryAverages || {}).forEach(([cat, avg]) => {
      categoryIncrements[cat] = {
        sum: avg * totalResponses,
        count: totalResponses,
      };
    });

    const multiplier = isDelete ? -1 : 1;
    // Calculate session hours
    const sessionHours = (Number(session.sessionDuration) || 60) / 60;

    // ============ 3. WRITE PHASE ============

    // --- Update Trainer Main Cache ---
    if (cacheDoc.exists()) {
      const flatUpdates = [];
      const addUpdate = (field, value) => flatUpdates.push(field, value);

      addUpdate("totalSessions", increment(1 * multiplier));
      addUpdate("totalResponses", increment(totalResponses * multiplier));
      addUpdate("totalRatingsCount", increment(totalRatingsCount * multiplier));
      addUpdate("ratingSum", increment(ratingSum * multiplier));
      addUpdate("totalHours", increment(sessionHours * multiplier));
      addUpdate("updatedAt", new Date().toISOString());

      // Update Topics Learned
      (stats.topicsLearned || []).forEach(({ name, count }) => {
        try {
          const topicPath = new FieldPath("topicsLearned", name);
          addUpdate(topicPath, increment(count * multiplier));
        } catch (err) {
          const safeName = sanitizeFieldName(name);
          addUpdate(`topicsLearned.${safeName}`, increment(count * multiplier));
        }
      });

      Object.entries(ratingDistribution || {}).forEach(([rating, count]) => {
        addUpdate(
          `ratingDistribution.${rating}`,
          increment(count * multiplier),
        );
      });
      Object.entries(categoryIncrements).forEach(([cat, data]) => {
        addUpdate(`categoryData.${cat}.sum`, increment(data.sum * multiplier));
        addUpdate(
          `categoryData.${cat}.count`,
          increment(data.count * multiplier),
        );
      });

      if (transaction) transaction.update(cacheRef, ...flatUpdates);
      else await updateDoc(cacheRef, ...flatUpdates);
    } else if (!isDelete) {
      const newCache = {
        totalSessions: 1,
        totalResponses,
        totalRatingsCount,
        ratingSum,
        totalHours: sessionHours,
        topicsLearned: (stats.topicsLearned || []).reduce(
          (acc, { name, count }) => {
            acc[name] = count;
            return acc;
          },
          {},
        ),
        ratingDistribution: ratingDistribution || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
        categoryData: {},
        updatedAt: new Date().toISOString(),
      };
      Object.entries(categoryIncrements).forEach(([cat, data]) => {
        newCache.categoryData[cat] = { sum: data.sum, count: data.count };
      });

      if (transaction) transaction.set(cacheRef, newCache);
      else await setDoc(cacheRef, newCache);
    }

    // --- Update Daily Trend ---
    // We already read trendDoc at the start, so we use that directly.
    if (trendDoc.exists()) {
      const updates = {
        [`dailyResponses.${day}`]: increment(totalResponses * multiplier),
        [`dailySessions.${day}`]: increment(1 * multiplier),
      };
      if (transaction) transaction.update(trendRef, updates);
      else await updateDoc(trendRef, updates);
    } else if (!isDelete) {
      const newData = {
        dailyResponses: { [day]: totalResponses },
        dailySessions: { [day]: 1 },
      };
      if (transaction) transaction.set(trendRef, newData);
      else await setDoc(trendRef, newData);
    }
  } catch (error) {
    console.error("Error updating trainer cache:", error);
    throw error;
  }
};

// ============ READ FUNCTIONS ============

/**
 * Get college cache data
 */
export const getCollegeCache = async (collegeId) => {
  try {
    const cacheRef = doc(db, COLLEGE_CACHE_COLLECTION, collegeId);
    const cacheDoc = await getDoc(cacheRef);

    if (cacheDoc.exists()) {
      return { id: cacheDoc.id, ...cacheDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting college cache:", error);
    throw error;
  }
};

/**
 * Get college trends for a specific month (or current month)
 */
export const getCollegeTrends = async (collegeId, yearMonth = null) => {
  try {
    const month = yearMonth || getYearMonth();
    const trendRef = doc(
      db,
      COLLEGE_CACHE_COLLECTION,
      collegeId,
      "trends",
      month,
    );
    const trendDoc = await getDoc(trendRef);

    if (trendDoc.exists()) {
      return { yearMonth: month, ...trendDoc.data() };
    }
    return { yearMonth: month, dailyResponses: {}, dailySessions: {} };
  } catch (error) {
    console.error("Error getting college trends:", error);
    throw error;
  }
};

/**
 * Get trainer cache data
 */
export const getTrainerCache = async (trainerId) => {
  try {
    const cacheRef = doc(db, TRAINER_CACHE_COLLECTION, trainerId);
    const cacheDoc = await getDoc(cacheRef);

    if (cacheDoc.exists()) {
      return { id: cacheDoc.id, ...cacheDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting trainer cache:", error);
    throw error;
  }
};

/**
 * Get trainer trends for a specific month (or current month)
 */
export const getTrainerTrends = async (trainerId, yearMonth = null) => {
  try {
    const month = yearMonth || getYearMonth();
    const trendRef = doc(
      db,
      TRAINER_CACHE_COLLECTION,
      trainerId,
      "trends",
      month,
    );
    const trendDoc = await getDoc(trendRef);

    if (trendDoc.exists()) {
      return { yearMonth: month, ...trendDoc.data() };
    }
    return { yearMonth: month, dailyResponses: {}, dailySessions: {} };
  } catch (error) {
    console.error("Error getting trainer trends:", error);
    throw error;
  }
};

/**
 * Get sessions by trainer and college for filtered analytics
 * Used when both trainer and college filters are active
 */
/**
 * Get sessions by trainer and college for filtered analytics
 * Used when both trainer and college filters are active
 */
export const getSessionsByTrainerAndCollege = async (trainerId, collegeId) => {
  try {
    const sessionsRef = collection(db, "sessions");
    const q = query(
      sessionsRef,
      where("collegeId", "==", collegeId),
      where("assignedTrainer.id", "==", trainerId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting sessions by trainer and college:", error);
    throw error;
  }
};

// ============ QUALITATIVE INSIGHTS ============

/**
 * Merge and Rank Comments for Cache
 * Keeps Top 3 based on criteria
 */
const mergeComments = (existing, incoming, type) => {
  // 1. Combine lists
  let combined = [...(existing || []), ...(incoming || [])];

  // 2. Deduplicate (by unique responseId)
  const seen = new Set();
  combined = combined.filter((c) => {
    const uid = c.responseId;
    if (seen.has(uid)) return false;
    seen.add(uid);
    return true;
  });

  // 3. Sort based on Type
  // Ensure ratings are numbers and dates are comparable
  combined.forEach((c) => {
    c.rating = Number(c.rating || c.avgRating || 0);
  });

  if (type === "high") {
    // Highest Rating first, then Newest
    combined.sort(
      (a, b) => b.rating - a.rating || new Date(b.date) - new Date(a.date),
    );
  } else if (type === "low") {
    // Lowest Rating first, then Newest
    combined.sort(
      (a, b) => a.rating - b.rating || new Date(b.date) - new Date(a.date),
    );
  } else {
    // Avg / Recent / Future: Just Newest
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // 4. Keep Top 5 (Increased from 3 for better insights)
  return combined.slice(0, 5);
};

/**
 * Update Qualitative Cache (Comments)
 * This is called AFTER the critical transaction to avoid bloating it.
 * It merges new top comments into the college and trainer cache.
 */
export const updateQualitativeCache = async (session, stats) => {
  try {
    const { topComments, leastRatedComments, avgComments, futureTopics } =
      stats;

    // Helper to format comments for cache (add metadata)
    const formatForCache = (comments) =>
      comments.map((c) => ({
        text: c.text,
        rating: c.avgRating || 0,
        responseId: c.responseId,
        sessionId: session.id,
        date: session.sessionDate || new Date().toISOString(),
        course: session.course,
        trainerName: session.assignedTrainer?.name,
      }));

    const newHigh = formatForCache(topComments || []);
    const newLow = formatForCache(leastRatedComments || []);
    const newAvg = formatForCache(avgComments || []);
    const newFuture = formatForCache(futureTopics || []);

    // 1. Update College Cache
    if (session.collegeId) {
      const collegeRef = doc(db, "collegeCache", session.collegeId);
      const collegeDoc = await getDoc(collegeRef);

      if (collegeDoc.exists()) {
        const currentData = collegeDoc.data().qualitative || {
          high: [],
          low: [],
          avg: [],
          future: [],
        };

        const updatedQualitative = {
          high: mergeComments(currentData.high, newHigh, "high"),
          low: mergeComments(currentData.low, newLow, "low"),
          avg: mergeComments(currentData.avg, newAvg, "avg"),
          future: mergeComments(currentData.future, newFuture, "future"),
        };

        await updateDoc(collegeRef, { qualitative: updatedQualitative });
      }
    }

    // 2. Update Trainer Cache
    if (session.assignedTrainer?.id) {
      const trainerRef = doc(db, "trainerCache", session.assignedTrainer.id);
      const trainerDoc = await getDoc(trainerRef);

      if (trainerDoc.exists()) {
        const currentData = trainerDoc.data().qualitative || {
          high: [],
          low: [],
          avg: [],
          future: [],
        };

        const updatedQualitative = {
          high: mergeComments(currentData.high, newHigh, "high"),
          low: mergeComments(currentData.low, newLow, "low"),
          avg: mergeComments(currentData.avg, newAvg, "avg"),
          future: mergeComments(currentData.future, newFuture, "future"),
        };

        await updateDoc(trainerRef, { qualitative: updatedQualitative });
      }
    }
  } catch (error) {
    console.error("Error updating qualitative cache:", error);
    // Suppress error as this is non-critical
  }
};
