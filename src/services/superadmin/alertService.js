import { db } from "../firebase";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Alert Service
 * Generates structured alerts dynamically from feedback data.
 * No hardcoded data — all alerts are computed from real Firestore records.
 *
 * Alert Types:
 *   - LOW_RATING:       avg trainer rating < 2.5  → CRITICAL
 *   - BELOW_THRESHOLD:  avg trainer rating >= 2.5 and < 3.5 → WARNING
 *   - LOW_PARTICIPATION: response count < 5 for a session → WARNING
 *   - RATING_DROP:      current week rating drops > 20% vs previous week → WARNING
 */

export const SEVERITY = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  RESOLVED: "RESOLVED",
};

export const ALERT_TYPE = {
  LOW_RATING: "LOW_RATING",
  BELOW_THRESHOLD: "BELOW_THRESHOLD",
  LOW_PARTICIPATION: "LOW_PARTICIPATION",
  RATING_DROP: "RATING_DROP",
};

export const ALERT_TYPE_LABELS = {
  LOW_RATING: "Critical Trainer Performance Alert",
  BELOW_THRESHOLD: "Trainer Rating Below Threshold",
  LOW_PARTICIPATION: "Low Participation Alert",
  RATING_DROP: "Significant Rating Drop Detected",
};

export const ALERT_TYPE_DESCRIPTIONS = {
  LOW_RATING: "Trainer average rating is critically low and requires immediate review.",
  BELOW_THRESHOLD: "Trainer average rating is below the acceptable threshold of 3.5.",
  LOW_PARTICIPATION: "Session received very few feedback responses (< 5).",
  RATING_DROP: "Trainer's rating dropped more than 20% compared to the previous week.",
};

/**
 * Extract the average rating from a single feedback response's answers array.
 * @param {Array} answers
 * @returns {number|null}
 */
const extractResponseAvgRating = (answers = []) => {
  const ratingAnswers = answers.filter((a) => {
    const type = (a.type || "").toLowerCase();
    return type === "rating" || type === "overall";
  });
  if (ratingAnswers.length === 0) return null;
  return (
    ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) /
    ratingAnswers.length
  );
};

/**
 * Build a key string for uniquely identifying a trainer-session combo.
 */
const buildKey = (trainerId, sessionId) => `${trainerId}||${sessionId}`;

/**
 * Get ISO week number string (YYYY-WW) for a date.
 */
const getWeekKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

/**
 * Format a relative time string (e.g. "2 hours ago", "Today")
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "";
  let date;
  if (timestamp?.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Main function: generate all alerts from raw Firestore feedback data.
 *
 * @param {Array} feedbacks     - Array of feedback documents from Firestore
 * @param {Array} sessions      - Array of session documents
 * @param {Array} trainers      - Array of trainer documents
 * @param {Array} colleges      - Array of college documents
 * @returns {Alert[]}
 */
export const generateAlertsFromFeedbacks = (
  feedbacks = [],
  sessions = [],
  trainers = [],
  colleges = []
) => {
  if (!feedbacks.length) return [];

  // Build lookup maps
  const sessionMap = {};
  sessions.forEach((s) => (sessionMap[s.id] = s));
  const trainerMap = {};
  trainers.forEach((t) => (trainerMap[t.id] = t));
  const collegeMap = {};
  colleges.forEach((c) => (collegeMap[c.id] = c));

  // ---------------------------------------------------------------
  // Phase 1: Aggregate per trainer-session stats AND per week stats
  // ---------------------------------------------------------------
  // Structure: trainerSessionMap[key] = { trainerId, trainerName, sessionId, sessionTitle, program, batch, collegeName, collegeId, ratingSum, ratingCount, responseCount, latestTimestamp }
  const trainerSessionMap = {};

  // Structure for week-over-week: weeklyTrainerRatings[trainerId][weekKey] = { ratingSum, ratingCount }
  const weeklyTrainerRatings = {};

  feedbacks.forEach((fb) => {
    const session = sessionMap[fb.sessionId] || {};
    const trainerId =
      fb.selectedTrainerId ||
      fb.trainerId ||
      session.assignedTrainer?.id ||
      session.assignedTrainerId ||
      null;
    if (!trainerId) return; // skip feedbacks without trainer

    const trainerName =
      trainerMap[trainerId]?.name ||
      fb.selectedTrainerName ||
      session.assignedTrainer?.name ||
      "Unknown Trainer";
    const sessionId = fb.sessionId || "unknown_session";
    const sessionTitle =
      session.sessionTopic || session.topic || "Untitled Session";
    const program = session.course || fb.course || "Unknown Program";
    const batch =
      fb.selectedBatch || fb.batch || session.batch || "Unknown Batch";
    const collegeId =
      fb.collegeId || session.collegeId || "unknown_college";
    const collegeName =
      collegeMap[collegeId]?.name ||
      fb.collegeName ||
      session.collegeName ||
      "Unknown College";

    const avgRating = extractResponseAvgRating(fb.answers);

    // --- Trainer-Session aggregation ---
    const key = buildKey(trainerId, sessionId);
    if (!trainerSessionMap[key]) {
      trainerSessionMap[key] = {
        trainerId,
        trainerName,
        sessionId,
        sessionTitle,
        program,
        batch,
        collegeName,
        collegeId,
        ratingSum: 0,
        ratingCount: 0,
        responseCount: 0,
        latestTimestamp: null,
      };
    }
    const entry = trainerSessionMap[key];
    entry.responseCount += 1;
    if (avgRating !== null) {
      entry.ratingSum += avgRating;
      entry.ratingCount += 1;
    }

    // Track the most recent feedback timestamp
    let fbDate = null;
    if (fb.submittedAt?.toDate) fbDate = fb.submittedAt.toDate();
    else if (fb.submittedAt) fbDate = new Date(fb.submittedAt);

    if (fbDate && !isNaN(fbDate.getTime())) {
      if (!entry.latestTimestamp || fbDate > entry.latestTimestamp) {
        entry.latestTimestamp = fbDate;
      }
    }

    // --- Weekly aggregation for trend alerts ---
    if (avgRating !== null && fbDate && !isNaN(fbDate.getTime())) {
      const weekKey = getWeekKey(fbDate);
      if (!weeklyTrainerRatings[trainerId]) {
        weeklyTrainerRatings[trainerId] = {};
      }
      if (!weeklyTrainerRatings[trainerId][weekKey]) {
        weeklyTrainerRatings[trainerId][weekKey] = { ratingSum: 0, ratingCount: 0 };
      }
      weeklyTrainerRatings[trainerId][weekKey].ratingSum += avgRating;
      weeklyTrainerRatings[trainerId][weekKey].ratingCount += 1;
    }
  });

  // ---------------------------------------------------------------
  // Phase 2: Determine "current" and "previous" week keys
  // ---------------------------------------------------------------
  const now = new Date();
  const currentWeekKey = getWeekKey(now);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const prevWeekKey = getWeekKey(lastWeek);

  // ---------------------------------------------------------------
  // Phase 3: Generate alerts from aggregated data
  // ---------------------------------------------------------------
  const alerts = [];
  let alertIdCounter = 1;

  Object.values(trainerSessionMap).forEach((entry) => {
    const avgRating =
      entry.ratingCount > 0 ? entry.ratingSum / entry.ratingCount : null;

    // --- LOW_RATING (CRITICAL) ---
    if (avgRating !== null && avgRating < 2.5) {
      alerts.push({
        id: `alert-${alertIdCounter++}`,
        severity: SEVERITY.CRITICAL,
        type: ALERT_TYPE.LOW_RATING,
        trainerId: entry.trainerId,
        trainerName: entry.trainerName,
        sessionId: entry.sessionId,
        sessionTitle: entry.sessionTitle,
        program: entry.program,
        batch: entry.batch,
        collegeName: entry.collegeName,
        collegeId: entry.collegeId,
        avgRating: Math.round(avgRating * 100) / 100,
        threshold: 2.5,
        responseCount: entry.responseCount,
        timestamp: entry.latestTimestamp,
        resolved: false,
      });
      return; // Don't double-alert same entry
    }

    // --- BELOW_THRESHOLD (WARNING) ---
    if (avgRating !== null && avgRating >= 2.5 && avgRating < 3.5) {
      alerts.push({
        id: `alert-${alertIdCounter++}`,
        severity: SEVERITY.WARNING,
        type: ALERT_TYPE.BELOW_THRESHOLD,
        trainerId: entry.trainerId,
        trainerName: entry.trainerName,
        sessionId: entry.sessionId,
        sessionTitle: entry.sessionTitle,
        program: entry.program,
        batch: entry.batch,
        collegeName: entry.collegeName,
        collegeId: entry.collegeId,
        avgRating: Math.round(avgRating * 100) / 100,
        threshold: 3.5,
        responseCount: entry.responseCount,
        timestamp: entry.latestTimestamp,
        resolved: false,
      });
    }

    // --- LOW_PARTICIPATION (WARNING) ---
    if (entry.responseCount < 5) {
      alerts.push({
        id: `alert-${alertIdCounter++}`,
        severity: SEVERITY.WARNING,
        type: ALERT_TYPE.LOW_PARTICIPATION,
        trainerId: entry.trainerId,
        trainerName: entry.trainerName,
        sessionId: entry.sessionId,
        sessionTitle: entry.sessionTitle,
        program: entry.program,
        batch: entry.batch,
        collegeName: entry.collegeName,
        collegeId: entry.collegeId,
        avgRating: avgRating !== null ? Math.round(avgRating * 100) / 100 : null,
        threshold: 5,
        responseCount: entry.responseCount,
        timestamp: entry.latestTimestamp,
        resolved: false,
      });
    }
  });

  // --- RATING_DROP (WARNING) — per trainer, across all sessions ---
  Object.entries(weeklyTrainerRatings).forEach(([trainerId, weekData]) => {
    const currentWeekData = weekData[currentWeekKey];
    const prevWeekData = weekData[prevWeekKey];
    if (!currentWeekData || !prevWeekData) return;

    const currentAvg =
      currentWeekData.ratingCount > 0
        ? currentWeekData.ratingSum / currentWeekData.ratingCount
        : null;
    const prevAvg =
      prevWeekData.ratingCount > 0
        ? prevWeekData.ratingSum / prevWeekData.ratingCount
        : null;

    if (currentAvg === null || prevAvg === null || prevAvg === 0) return;

    const dropPercent = ((prevAvg - currentAvg) / prevAvg) * 100;
    if (dropPercent > 20) {
      const trainerName =
        trainerMap[trainerId]?.name || "Unknown Trainer";

      // Find most recent session for this trainer
      const trainerEntry = Object.values(trainerSessionMap).find(
        (e) => e.trainerId === trainerId
      );

      alerts.push({
        id: `alert-${alertIdCounter++}`,
        severity: SEVERITY.WARNING,
        type: ALERT_TYPE.RATING_DROP,
        trainerId,
        trainerName,
        sessionId: trainerEntry?.sessionId || "",
        sessionTitle: trainerEntry?.sessionTitle || "",
        program: trainerEntry?.program || "",
        batch: trainerEntry?.batch || "",
        collegeName: trainerEntry?.collegeName || "",
        collegeId: trainerEntry?.collegeId || "",
        avgRating: Math.round(currentAvg * 100) / 100,
        prevAvgRating: Math.round(prevAvg * 100) / 100,
        dropPercent: Math.round(dropPercent),
        threshold: 20,
        responseCount: currentWeekData.ratingCount,
        timestamp: trainerEntry?.latestTimestamp || null,
        resolved: false,
      });
    }
  });

  // Sort: CRITICAL first, then by most recent timestamp
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      if (a.severity === SEVERITY.CRITICAL) return -1;
      if (b.severity === SEVERITY.CRITICAL) return 1;
    }
    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tB - tA;
  });

  return alerts;
};

const RESOLVED_COLLECTION = "resolvedAlerts";

/**
 * Fetch all resolved alert IDs from Firestore.
 * @returns {Promise<Set<string>>}
 */
export const getResolvedAlerts = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, RESOLVED_COLLECTION));
    const ids = querySnapshot.docs.map((doc) => doc.id);
    return new Set(ids);
  } catch (error) {
    console.error("Error loading resolved alerts from DB:", error);
    return new Set();
  }
};

/**
 * Persist an alert as resolved in Firestore.
 * @param {string} alertId
 */
export const resolveAlertInDb = async (alertId) => {
  try {
    const docRef = doc(db, RESOLVED_COLLECTION, alertId);
    await setDoc(docRef, {
      resolvedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error resolving alert in DB:", error);
    throw error;
  }
};

/**
 * Remove resolved status for an alert from Firestore.
 * @param {string} alertId
 */
export const unresolveAlertInDb = async (alertId) => {
  try {
    const docRef = doc(db, RESOLVED_COLLECTION, alertId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error unresolving alert in DB:", error);
    throw error;
  }
};
