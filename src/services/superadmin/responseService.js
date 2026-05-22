import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  getCountFromServer,
  deleteDoc,
  doc,
} from "firebase/firestore";

/**
 * Response Service
 * Handles feedback responses stored in subcollections: sessions/{sessionId}/responses
 * NOTE: Responses are IMMUTABLE once created. No update or delete operations exist by design.
 */

const getResponsesCollection = (sessionId) => {
  return collection(db, "sessions", sessionId, "responses");
};

/**
 * Add a new response to a session's responses subcollection
 * @param {string} sessionId - The session document ID
 * @param {Object} responseData - The response data
 * @param {string} responseData.deviceId - Unique device identifier
 * @param {Array} responseData.answers - Array of answer objects
 * @returns {Promise<Object>} - Created response with ID
 */
export const addResponse = async (sessionId, responseData) => {
  try {
    const responsesRef = getResponsesCollection(sessionId);

    const docRef = await addDoc(responsesRef, {
      ...responseData,
      submittedAt: serverTimestamp(),
    });

    return { id: docRef.id, ...responseData };
  } catch (error) {
    console.error("Error adding response:", error);
    throw error;
  }
};

/**
 * Get all responses for a session
 * @param {string} sessionId - The session document ID
 * @returns {Promise<Array>} - Array of response objects
 */
export const getResponses = async (sessionId) => {
  try {
    const responsesRef = getResponsesCollection(sessionId);
    const q = query(responsesRef, orderBy("submittedAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting responses:", error);
    throw error;
  }
};

/**
 * Get response count for a session (efficient count query)
 * @param {string} sessionId - The session document ID
 * @returns {Promise<number>} - Count of responses
 */
export const getResponseCount = async (sessionId) => {
  try {
    const responsesRef = getResponsesCollection(sessionId);
    const snapshot = await getCountFromServer(responsesRef);
    return snapshot.data().count;
  } catch (error) {
    console.error("Error getting response count:", error);
    throw error;
  }
};

/**
 * Get response trend data aggregated across multiple sessions
 * Groups responses by submission date (YYYY-MM-DD format)
 * @param {Array<string>} sessionIds - Array of session document IDs
 * @returns {Promise<Object>} - Object with date keys and response counts: {"2026-04-20": 5, "2026-04-21": 8}
 */
export const getResponseTrendData = async (sessionIds) => {
  try {
    if (!sessionIds || sessionIds.length === 0) return {};

    const trendMap = {};

    // Fetch responses for all sessions in parallel
    const responsePromises = sessionIds.map((sessionId) =>
      getResponses(sessionId).catch((error) => {
        console.error(
          `Failed to fetch responses for session ${sessionId}:`,
          error,
        );
        return [];
      }),
    );

    const allResponses = await Promise.all(responsePromises);

    // Aggregate responses by submission date
    allResponses.forEach((responses) => {
      responses.forEach((response) => {
        let date;

        // Extract date from Firestore Timestamp or ISO string
        if (response.submittedAt?.toDate) {
          const dateObj = response.submittedAt.toDate();
          date = dateObj.toISOString().split("T")[0];
        } else if (typeof response.submittedAt === "string") {
          date = response.submittedAt.split("T")[0];
        } else if (response.submittedAt instanceof Date) {
          date = response.submittedAt.toISOString().split("T")[0];
        }

        if (date) {
          trendMap[date] = (trendMap[date] || 0) + 1;
        }
      });
    });

    return trendMap;
  } catch (error) {
    console.error("Error getting response trend data:", error);
    throw error;
  }
};

/**
 * Compile statistics from an array of raw response objects (Pure logic for live data)
 * @param {Array} responses - Array of response objects from Firestore
 * @param {Array} sessionQuestions - The questions array from the session document
 * @returns {Object} - Compiled statistics object
 */
export const compileSessionStatsFromResponses = (
  responses,
  sessionQuestions = [],
) => {
  if (!responses || responses.length === 0) {
    return {
      totalResponses: 0,
      avgRating: 0,
      topRating: 0,
      leastRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      topComments: [],
      leastRatedComments: [],
      avgComments: [],
      questionStats: {},
      categoryAverages: {},
      topicsLearned: [],
      futureTopics: [],
      compiledAt: new Date().toISOString(),
    };
  }

  // Calculate per-response averages and extract comments
  const responseStats = responses.map((response) => {
    const answers = response.answers || [];

    // Get rating answers
    const ratingAnswers = answers.filter((a) => {
      const type = (a.type || "").toLowerCase();
      return type === "rating" || type === "overall";
    });
    const avgRating =
      ratingAnswers.length > 0
        ? ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) /
          ratingAnswers.length
        : 0;

    // Get text comments
    const textAnswers = answers.filter((a) => {
      const type = (a.type || "").toLowerCase();
      return (
        (type === "text" || type === "comment" || type === "feedback") &&
        a.value?.trim()
      );
    });

    return {
      responseId: response.id,
      sessionId: response.sessionId,
      avgRating,
      textComments: textAnswers.map((a) => a.value),
      answers,
    };
  });

  // Calculate global average rating
  const allRatings = responseStats.map((r) => r.avgRating).filter((r) => r > 0);
  const globalAvgRating =
    allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
      : 2.5; // Default to middle if no ratings

  // Sort all responses by rating (descending) for percentile-based categorization
  const sortedResponses = [...responseStats].sort(
    (a, b) => b.avgRating - a.avgRating,
  );
  const totalCount = sortedResponses.length;

  // Percentile-based split: Top 20%, Middle 60%, Bottom 20%
  const topCutoff = Math.ceil(totalCount * 0.2);
  const bottomCutoff = Math.ceil(totalCount * 0.2);

  const highRated = sortedResponses.slice(0, topCutoff);
  const lowRated = sortedResponses.slice(totalCount - bottomCutoff).reverse();
  const avgRated = sortedResponses.slice(topCutoff, totalCount - bottomCutoff);

  const extractAllComments = (categoryResponses, globalUsedIds = null) => {
    const comments = [];
    const localUsedResponseIds = new Set();

    for (const resp of categoryResponses) {
      if (globalUsedIds && globalUsedIds.has(resp.responseId)) continue;
      if (localUsedResponseIds.has(resp.responseId)) continue;

      for (const comment of resp.textComments) {
        comments.push({
          text: comment,
          avgRating: Math.round(resp.avgRating * 100) / 100,
          responseId: resp.responseId,
          sessionId: resp.sessionId,
        });
        localUsedResponseIds.add(resp.responseId);
        if (globalUsedIds) globalUsedIds.add(resp.responseId);
      }
    }
    return comments;
  };

  const usedInBuckets = new Set();
  const topComments = processQualitativeComments(
    extractAllComments(highRated, usedInBuckets),
    "high",
  );
  const leastRatedComments = processQualitativeComments(
    extractAllComments(lowRated, usedInBuckets),
    "low",
  );
  const avgComments = processQualitativeComments(
    extractAllComments(avgRated, usedInBuckets),
  );

  // Topics/Future
  const topicsLearnedRaw = [];
  const futureTopicsRaw = [];
  responses.forEach((resp) => {
    (resp.answers || []).forEach((ans) => {
      const type = (ans.type || "").toLowerCase();
      if (
        (type === "topicslearned" || type === "topics" || type === "learned") &&
        ans.value?.trim()
      ) {
        const val = Array.isArray(ans.value) ? ans.value.join(", ") : ans.value;
        const topics = val
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && isValidTopicOrInterest(t));
        topics.forEach((t) => {
          topicsLearnedRaw.push({
            name: t,
            sessionId: resp.sessionId || resp.id,
          });
        });
      }
      if (
        (type === "futuresession" ||
          type === "future" ||
          type === "futuretopics") &&
        ans.value?.trim()
      ) {
        const val = Array.isArray(ans.value) ? ans.value.join(", ") : ans.value;
        const futures = val
          .split(",")
          .map((t) => t.trim())
          .filter((f) => f && isValidTopicOrInterest(f));
        futures.forEach((f) => {
          futureTopicsRaw.push({
            text: f,
            avgRating: Math.round(resp.avgRating * 100) / 100,
            responseId: resp.responseId,
            sessionId: resp.sessionId,
          });
        });
      }
    });
  });

  const topicCounts = Object.create(null);
  const topicSessionIds = Object.create(null);
  topicsLearnedRaw.forEach((tObj) => {
    const normalized = tObj.name.toLowerCase();
    topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
    if (!topicSessionIds[normalized]) {
      topicSessionIds[normalized] = new Set();
    }
    if (tObj.sessionId) {
      topicSessionIds[normalized].add(tObj.sessionId);
    }
  });
  const topicsLearned = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      sessionId: Array.from(topicSessionIds[name] || []).join(", "),
    }))
    .slice(0, 15);

  const futureTopicCounts = Object.create(null);
  futureTopicsRaw.forEach((f) => {
    const normalized = f.text.trim();
    if (!normalized) return;
    if (!futureTopicCounts[normalized]) {
      futureTopicCounts[normalized] = { count: 0, ratingSum: 0, sessionIds: new Set() };
    }
    futureTopicCounts[normalized].count++;
    futureTopicCounts[normalized].ratingSum += f.avgRating || 0;
    if (f.sessionId) {
      futureTopicCounts[normalized].sessionIds.add(f.sessionId);
    }
  });

  const futureTopics = Object.entries(futureTopicCounts)
    .sort((a, b) => {
      // Primary sort: Most mentions (count)
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      // Secondary sort: Longest descriptive text (more specific topics first)
      return b[0].length - a[0].length;
    })
    .map(([name, data]) => ({
      name,
      text: name,
      count: data.count,
      avgRating: Math.round((data.ratingSum / data.count) * 100) / 100,
      sessionId: Array.from(data.sessionIds).join(", "),
    }))
    .slice(0, 100);

  const avgRatingResult = globalAvgRating;
  const topRating = allRatings.length > 0 ? Math.max(...allRatings) : 0;
  const leastRating = allRatings.length > 0 ? Math.min(...allRatings) : 0;

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  responseStats.forEach((resp) => {
    resp.answers
      .filter((a) => a.type === "rating")
      .forEach((a) => {
        const val = Math.round(Number(a.value) || 0);
        if (val >= 1 && val <= 5) ratingDistribution[val]++;
      });
  });

  const questionStats = {};
  responseStats.forEach((resp) => {
    resp.answers.forEach((answer) => {
      if (!questionStats[answer.questionId]) {
        questionStats[answer.questionId] = {
          type: answer.type,
          values: [],
          count: 0,
        };
      }
      questionStats[answer.questionId].values.push(answer.value);
      questionStats[answer.questionId].count++;
    });
  });

  Object.keys(questionStats).forEach((qId) => {
    const stat = questionStats[qId];
    if (stat.type === "rating") {
      const numericValues = stat.values.map((v) => Number(v) || 0);
      stat.avg =
        numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
      stat.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      numericValues.forEach((v) => {
        const rounded = Math.round(v);
        if (rounded >= 1 && rounded <= 5) stat.distribution[rounded]++;
      });
    } else if (stat.type === "mcq") {
      stat.optionCounts = {};
      stat.values.forEach((v) => {
        stat.optionCounts[v] = (stat.optionCounts[v] || 0) + 1;
      });
    }
    delete stat.values;
  });

  // Categories
  const questionCategoryMap = {};
  (sessionQuestions || []).forEach((q) => {
    if (q.id && q.category) questionCategoryMap[q.id] = q.category;
  });

  const categoryTotals = {};
  const categoryCounts = {};
  responseStats.forEach((resp) => {
    resp.answers
      .filter((a) => a.type === "rating")
      .forEach((a) => {
        const category = questionCategoryMap[a.questionId] || "overall";
        const value = Number(a.value) || 0;
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
          categoryCounts[category] = 0;
        }
        categoryTotals[category] += value;
        categoryCounts[category]++;
      });
  });

  const categoryAverages = {};
  Object.keys(categoryTotals).forEach((cat) => {
    categoryAverages[cat] =
      Math.round((categoryTotals[cat] / categoryCounts[cat]) * 100) / 100;
  });

  // --- Per-Trainer Breakdown (byTrainer) ---
  // Group responses by selectedTrainerId and compute lean stats per trainer.
  // Legacy responses without selectedTrainerId only contribute to global stats.
  const byTrainer = {};
  const trainerGroups = {};
  responses.forEach((r) => {
    const tid = r.selectedTrainerId;
    if (tid) {
      if (!trainerGroups[tid]) trainerGroups[tid] = [];
      trainerGroups[tid].push(r);
    }
  });

  Object.entries(trainerGroups).forEach(([trainerId, trainerResponses]) => {
    // Lean per-trainer compilation (same logic, capped arrays to save doc size)
    const tRatingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let tRatingSum = 0;
    let tRatingCount = 0;
    const tCategoryTotals = {};
    const tCategoryCounts = {};
    const tComments = [];

    trainerResponses.forEach((resp) => {
      const answers = resp.answers || [];
      answers.forEach((a) => {
        const type = (a.type || "").toLowerCase();
        if (type === "rating" || type === "overall") {
          const val = Math.round(Number(a.value) || 0);
          if (val >= 1 && val <= 5) {
            tRatingDist[val]++;
            tRatingSum += val;
            tRatingCount++;
          }
          const category = questionCategoryMap[a.questionId] || "overall";
          const numVal = Number(a.value) || 0;
          if (!tCategoryTotals[category]) {
            tCategoryTotals[category] = 0;
            tCategoryCounts[category] = 0;
          }
          tCategoryTotals[category] += numVal;
          tCategoryCounts[category]++;
        }
        if (
          (type === "text" || type === "comment" || type === "feedback") &&
          a.value?.trim() &&
          tComments.length < 5
        ) {
          tComments.push({ text: a.value.trim() });
        }
      });
    });

    const tCategoryAverages = {};
    Object.keys(tCategoryTotals).forEach((cat) => {
      tCategoryAverages[cat] =
        Math.round((tCategoryTotals[cat] / tCategoryCounts[cat]) * 100) / 100;
    });

    byTrainer[trainerId] = {
      totalResponses: trainerResponses.length,
      avgRating:
        tRatingCount > 0
          ? Math.round((tRatingSum / tRatingCount) * 100) / 100
          : 0,
      ratingDistribution: tRatingDist,
      categoryAverages: tCategoryAverages,
      topComments: tComments.slice(0, 3),
      leastRatedComments: [],
      trainerName: trainerResponses[0]?.selectedTrainerName || "",
    };
  });

  return {
    totalResponses: responses.length,
    avgRating: Math.round(avgRatingResult * 100) / 100,
    topRating: Math.round(topRating * 100) / 100,
    leastRating: Math.round(leastRating * 100) / 100,
    ratingDistribution,
    topComments,
    leastRatedComments,
    avgComments,
    questionStats,
    categoryAverages,
    topicsLearned,
    futureTopics,
    byTrainer: Object.keys(byTrainer).length > 0 ? byTrainer : undefined,
    compiledAt: new Date().toISOString(),
  };
};

/**
 * Compile statistics from responses for a session, filtered by version
 * @param {string} sessionId - The session document ID
 * @param {number} [version=0] - The reactivation version to compile stats for
 * @returns {Promise<Object>} - Compiled statistics object
 */
export const compileSessionStats = async (sessionId, version = 0) => {
  try {
    const allResponses = await getResponses(sessionId);
    const { getSessionById } = await import("./sessionService");
    const sessionDoc = await getSessionById(sessionId);

    // Filter responses to only include those matching the current version
    const responses = allResponses.filter((r) => (r.version ?? 0) === version);

    const compiledSegments = compileAllSegmentsFromResponses(
      responses,
      sessionDoc?.questions || [],
      sessionDoc,
    );

    // Save detailed stats in stats subcollection documents
    await saveDecoupledStats(sessionId, compiledSegments);

    // Return duplicated full stats for the parent document
    return {
      ...compiledSegments.overall,
      byTrainer: compiledSegments.byTrainer,
      byBatch: compiledSegments.byBatch,
      byBranch: compiledSegments.byBranch,
    };
  } catch (error) {
    console.error("Error compiling session stats:", error);
    throw error;
  }
};

/**
 * Merge two compiled session stats objects
 * Used when closing a reactivated session to combine its existing stats with the new delta stats
 * @param {Object} existing - The existing compiled stats on the session
 * @param {Object} delta - The newly compiled stats from the new responses
 * @returns {Object} - The merged stats object
 */
export const mergeStats = (existing, delta) => {
  if (!existing || existing.totalResponses === 0) return delta;
  if (!delta || delta.totalResponses === 0) return existing;

  const totalResponses = existing.totalResponses + delta.totalResponses;

  // Weighted average for ratings
  const existingWeight = existing.totalResponses;
  const deltaWeight = delta.totalResponses;

  const mergeWeightedAvg = (avg1, w1, avg2, w2) => {
    if (w1 + w2 === 0) return 0;
    return Math.round(((avg1 * w1 + avg2 * w2) / (w1 + w2)) * 100) / 100;
  };

  const avgRating = mergeWeightedAvg(
    existing.avgRating || 0,
    existingWeight,
    delta.avgRating || 0,
    deltaWeight,
  );
  const topRating = Math.max(existing.topRating || 0, delta.topRating || 0);
  // If one of them is 0 (meaning no ratings), take the other. Otherwise min.
  const leastRatingOrig = [existing.leastRating, delta.leastRating].filter(
    (r) => r > 0,
  );
  const leastRating =
    leastRatingOrig.length > 0 ? Math.min(...leastRatingOrig) : 0;

  // Merge Rating Distribution
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  [1, 2, 3, 4, 5].forEach((stars) => {
    ratingDistribution[stars] =
      (existing.ratingDistribution?.[stars] || 0) +
      (delta.ratingDistribution?.[stars] || 0);
  });

  // Merge Comments (Combine, re-sort by rating, and format, taking top 5)
  // We don't have perfect raw data, but we can do our best with the top 5 of each
  const mergeCommentArrays = (arr1, arr2, type = "top") => {
    const combined = [...(arr1 || []), ...(arr2 || [])];
    const unique = [];
    const seen = new Set();
    combined.forEach((c) => {
      if (c && c.text && !seen.has(c.text.toLowerCase())) {
        seen.add(c.text.toLowerCase());
        unique.push(c);
      }
    });

    if (type === "top") {
      return unique
        .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        .slice(0, 5);
    } else if (type === "least") {
      return unique
        .sort((a, b) => (a.avgRating || 0) - (b.avgRating || 0))
        .slice(0, 5);
    } else {
      // average comments: sort towards the middle
      const middle = avgRating || 3;
      return unique
        .sort(
          (a, b) =>
            Math.abs((a.avgRating || 0) - middle) -
            Math.abs((b.avgRating || 0) - middle),
        )
        .slice(0, 5);
    }
  };

  // Merge Category Averages
  const categoryAverages = { ...(existing.categoryAverages || {}) };
  Object.keys(delta.categoryAverages || {}).forEach((cat) => {
    if (categoryAverages[cat]) {
      categoryAverages[cat] = mergeWeightedAvg(
        categoryAverages[cat],
        existingWeight,
        delta.categoryAverages[cat],
        deltaWeight,
      );
    } else {
      categoryAverages[cat] = delta.categoryAverages[cat];
    }
  });

  // Merge Question Stats
  const questionStats = JSON.parse(
    JSON.stringify(existing.questionStats || {}),
  ); // Deep copy
  Object.keys(delta.questionStats || {}).forEach((qId) => {
    const dStat = delta.questionStats[qId];
    if (!questionStats[qId]) {
      questionStats[qId] = dStat;
    } else {
      const eStat = questionStats[qId];
      if (eStat.type === "rating") {
        eStat.avg = mergeWeightedAvg(
          eStat.avg || 0,
          eStat.count || 0,
          dStat.avg || 0,
          dStat.count || 0,
        );
        eStat.count = (eStat.count || 0) + (dStat.count || 0);
        [1, 2, 3, 4, 5].forEach((star) => {
          if (!eStat.distribution)
            eStat.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          eStat.distribution[star] =
            (eStat.distribution[star] || 0) + (dStat.distribution?.[star] || 0);
        });
      } else if (eStat.type === "mcq") {
        eStat.count = (eStat.count || 0) + (dStat.count || 0);
        Object.keys(dStat.optionCounts || {}).forEach((opt) => {
          if (!eStat.optionCounts) eStat.optionCounts = {};
          eStat.optionCounts[opt] =
            (eStat.optionCounts[opt] || 0) + dStat.optionCounts[opt];
        });
      }
    }
  });

  // Merge Topics Learned (combine counts, sort, take top 15)
  const mergedTopics = {};
  [...(existing.topicsLearned || []), ...(delta.topicsLearned || [])].forEach(
    (t) => {
      const normalized = t.name.toLowerCase();
      mergedTopics[normalized] = {
        name: t.name,
        count: (mergedTopics[normalized]?.count || 0) + t.count,
      };
    },
  );
  const topicsLearned = Object.values(mergedTopics)
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  // Merge Future Topics (combine, dedupe, take 100)
  const futureTopics = [];
  const ftSeen = new Set();
  [...(delta.futureTopics || []), ...(existing.futureTopics || [])].forEach(
    (ft) => {
      const topicText = (ft?.text || ft?.name || "").toString().trim();
      if (topicText && !ftSeen.has(topicText.toLowerCase())) {
        ftSeen.add(topicText.toLowerCase());
        futureTopics.push({
          ...ft,
          text: topicText,
          name: topicText,
        });
      }
    },
  );

  // Merge byTrainer maps
  const byTrainer = { ...(existing.byTrainer || {}) };
  Object.entries(delta.byTrainer || {}).forEach(([tid, dStats]) => {
    if (!byTrainer[tid]) {
      byTrainer[tid] = dStats;
    } else {
      const eStats = byTrainer[tid];
      const mergedDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      [1, 2, 3, 4, 5].forEach((s) => {
        mergedDist[s] =
          (eStats.ratingDistribution?.[s] || 0) +
          (dStats.ratingDistribution?.[s] || 0);
      });
      const eTotalResp = eStats.totalResponses || 0;
      const dTotalResp = dStats.totalResponses || 0;
      byTrainer[tid] = {
        totalResponses: eTotalResp + dTotalResp,
        avgRating: mergeWeightedAvg(
          eStats.avgRating || 0,
          eTotalResp,
          dStats.avgRating || 0,
          dTotalResp,
        ),
        ratingDistribution: mergedDist,
        categoryAverages: {
          ...(eStats.categoryAverages || {}),
          ...(dStats.categoryAverages || {}),
        },
        topComments: [
          ...(eStats.topComments || []),
          ...(dStats.topComments || []),
        ].slice(0, 3),
        leastRatedComments: [
          ...(eStats.leastRatedComments || []),
          ...(dStats.leastRatedComments || []),
        ].slice(0, 3),
        trainerName: dStats.trainerName || eStats.trainerName || "",
      };
    }
  });

  return {
    totalResponses,
    avgRating,
    topRating,
    leastRating,
    ratingDistribution,
    topComments: mergeCommentArrays(
      existing.topComments,
      delta.topComments,
      "top",
    ),
    leastRatedComments: mergeCommentArrays(
      existing.leastRatedComments,
      delta.leastRatedComments,
      "least",
    ),
    avgComments: mergeCommentArrays(
      existing.avgComments,
      delta.avgComments,
      "avg",
    ),
    questionStats,
    categoryAverages,
    topicsLearned,
    futureTopics: futureTopics.slice(0, 5),
    byTrainer: Object.keys(byTrainer).length > 0 ? byTrainer : undefined,
    compiledAt: new Date().toISOString(),
  };
};

/**
 * Compiles overall, trainer, batch, and branch segments simultaneously from raw responses.
 * The overall uses the full compileSessionStatsFromResponses for rich stats,
 * while per-segment stats are leaner (totalResponses, avgRating, ratingDistribution, categoryAverages, topComments).
 */
export const compileAllSegmentsFromResponses = (
  responses,
  sessionQuestions = [],
  sessionDoc = null,
) => {
  const overall = compileSessionStatsFromResponses(responses, sessionQuestions);

  const questionCategoryMap = {};
  (sessionQuestions || []).forEach((q) => {
    if (q.id && q.category) questionCategoryMap[q.id] = q.category;
  });

  const byTrainer = {};
  const byBatch = {};
  const byBranch = {};

  const trainerGroups = {};
  const batchGroups = {};
  const branchGroups = {};

  // Extract session metadata for fallbacks if sessionDoc is provided
  const sessionBranch = sessionDoc?.branch || "";
  const sessionBranches =
    sessionDoc?.branches || (sessionBranch ? [sessionBranch] : []);
  const defaultBranch =
    sessionBranches.length === 1 ? sessionBranches[0] : null;

  const sessionBatch = sessionDoc?.batch || "";
  const sessionBatches =
    sessionDoc?.batches || (sessionBatch ? [sessionBatch] : []);
  const defaultBatch = sessionBatches.length === 1 ? sessionBatches[0] : null;

  const sessionTrainers =
    sessionDoc?.assignedTrainers ||
    (sessionDoc?.assignedTrainer ? [sessionDoc?.assignedTrainer] : []);
  const defaultTrainer =
    sessionTrainers.length === 1 ? sessionTrainers[0] : null;

  responses.forEach((r) => {
    // 1. Trainer grouping
    let tid = r.selectedTrainerId;
    if (!tid && defaultTrainer) {
      tid = defaultTrainer.id;
    }
    if (tid) {
      if (!trainerGroups[tid]) trainerGroups[tid] = [];

      // Ensure r has selectedTrainerName for compileSegment to use
      const updatedR = { ...r };
      if (!updatedR.selectedTrainerName) {
        if (tid === defaultTrainer?.id) {
          updatedR.selectedTrainerName = defaultTrainer.name;
        } else {
          const matchingTrainer = sessionTrainers.find((t) => t.id === tid);
          if (matchingTrainer)
            updatedR.selectedTrainerName = matchingTrainer.name;
        }
      }
      trainerGroups[tid].push(updatedR);
    }

    // 2. Batch grouping
    let bid = r.selectedBatch || r.batch;
    if (!bid && defaultBatch) {
      bid = defaultBatch;
    }
    if (bid) {
      if (!batchGroups[bid]) batchGroups[bid] = [];
      batchGroups[bid].push(r);
    }

    // 3. Branch/Department grouping
    let dept = r.selectedBranch || r.branch || r.department;
    if (!dept && defaultBranch) {
      dept = defaultBranch;
    }
    if (dept) {
      if (!branchGroups[dept]) branchGroups[dept] = [];
      branchGroups[dept].push(r);
    }
  });

  const compileSegment = (segmentResponses, displayName = "") => {
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    let ratingCount = 0;
    const categoryTotals = {};
    const categoryCounts = {};
    const comments = [];

    segmentResponses.forEach((resp) => {
      const answers = resp.answers || [];
      answers.forEach((a) => {
        const type = (a.type || "").toLowerCase();
        if (type === "rating" || type === "overall") {
          const val = Math.round(Number(a.value) || 0);
          if (val >= 1 && val <= 5) {
            ratingDist[val]++;
            ratingSum += val;
            ratingCount++;
          }
          const category = questionCategoryMap[a.questionId] || "overall";
          const numVal = Number(a.value) || 0;
          if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
            categoryCounts[category] = 0;
          }
          categoryTotals[category] += numVal;
          categoryCounts[category]++;
        }
        if (
          (type === "text" || type === "comment" || type === "feedback") &&
          a.value?.trim() &&
          comments.length < 5
        ) {
          comments.push({ text: a.value.trim() });
        }
      });
    });

    const categoryAverages = {};
    Object.keys(categoryTotals).forEach((cat) => {
      categoryAverages[cat] =
        Math.round((categoryTotals[cat] / categoryCounts[cat]) * 100) / 100;
    });

    return {
      totalResponses: segmentResponses.length,
      avgRating:
        ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : 0,
      ratingDistribution: ratingDist,
      categoryAverages,
      topComments: comments.slice(0, 3),
      leastRatedComments: [],
      name: displayName,
    };
  };

  Object.entries(trainerGroups).forEach(([trainerId, tResps]) => {
    byTrainer[trainerId] = compileSegment(
      tResps,
      tResps[0]?.selectedTrainerName || "",
    );
    byTrainer[trainerId].trainerName = byTrainer[trainerId].name;
  });

  Object.entries(batchGroups).forEach(([batchId, bResps]) => {
    byBatch[batchId] = compileSegment(bResps, batchId);
  });

  Object.entries(branchGroups).forEach(([branchId, dResps]) => {
    byBranch[branchId] = compileSegment(dResps, branchId);
  });

  return {
    overall,
    byTrainer,
    byBatch,
    byBranch,
  };
};

/**
 * Saves decoupled statistics into individual documents under sessions/{sessionId}/stats subcollection.
 * This replaces storing everything in the parent session doc's compiledStats field.
 */
export const saveDecoupledStats = async (sessionId, compiledData) => {
  const { overall, byTrainer, byBatch, byBranch } = compiledData;
  const promises = [];

  const prunedOverall = { ...overall };
  delete prunedOverall.byTrainer;
  delete prunedOverall.byBatch;
  delete prunedOverall.byBranch;

  promises.push(
    setDoc(doc(db, "sessions", sessionId, "stats", "overall"), prunedOverall),
  );

  Object.entries(byTrainer || {}).forEach(([trainerId, data]) => {
    promises.push(
      setDoc(doc(db, "sessions", sessionId, "stats", `trainer_${trainerId}`), {
        ...data,
        type: "trainer",
        trainerId,
      }),
    );
  });

  Object.entries(byBatch || {}).forEach(([batchId, data]) => {
    promises.push(
      setDoc(doc(db, "sessions", sessionId, "stats", `batch_${batchId}`), {
        ...data,
        type: "batch",
        batchId,
      }),
    );
  });

  Object.entries(byBranch || {}).forEach(([branchId, data]) => {
    promises.push(
      setDoc(doc(db, "sessions", sessionId, "stats", `branch_${branchId}`), {
        ...data,
        type: "branch",
        branchId,
      }),
    );
  });

  await Promise.all(promises);
};

/**
 * Unified statistics bridge: Loads stats from subcollections first,
 * falling back to parent doc's compiledStats if subcollection doesn't exist.
 * This ensures both new (decoupled) and legacy (monolithic) sessions work seamlessly.
 */
export const getSessionStats = async (sessionId, parentSessionData = null) => {
  try {
    const overallDocRef = doc(db, "sessions", sessionId, "stats", "overall");
    const overallDoc = await getDoc(overallDocRef);

    if (overallDoc.exists()) {
      const overallData = overallDoc.data();
      const statsColRef = collection(db, "sessions", sessionId, "stats");
      const statsSnapshot = await getDocs(statsColRef);

      const byTrainer = {};
      const byBatch = {};
      const byBranch = {};

      statsSnapshot.docs.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();

        if (id.startsWith("trainer_")) {
          const tid = data.trainerId || id.replace("trainer_", "");
          byTrainer[tid] = data;
        } else if (id.startsWith("batch_")) {
          const bid = data.batchId || id.replace("batch_", "");
          byBatch[bid] = data;
        } else if (id.startsWith("branch_")) {
          const brid = data.branchId || id.replace("branch_", "");
          byBranch[brid] = data;
        }
      });

      return {
        ...overallData,
        byTrainer: Object.keys(byTrainer).length > 0 ? byTrainer : undefined,
        byBatch: Object.keys(byBatch).length > 0 ? byBatch : undefined,
        byBranch: Object.keys(byBranch).length > 0 ? byBranch : undefined,
      };
    }

    // Fallback: try parent session data passed in
    if (parentSessionData && parentSessionData.compiledStats) {
      return parentSessionData.compiledStats;
    }

    // Fallback: read parent session doc directly
    const parentSessionDoc = await getDoc(doc(db, "sessions", sessionId));
    if (parentSessionDoc.exists()) {
      return parentSessionDoc.data().compiledStats || null;
    }

    return null;
  } catch (error) {
    console.error(`Error loading getSessionStats for ${sessionId}:`, error);
    if (parentSessionData) return parentSessionData.compiledStats || null;
    return null;
  }
};

/**
 * Self-healing migrator for legacy sessions.
 * Copies compiledStats from parent session doc into stats subcollection,
 * then nulls out the parent field to complete the migration.
 */
export const migrateSessionStats = async (sessionId, sessionData = null) => {
  try {
    let data = sessionData;
    if (!data) {
      const parentSessionDoc = await getDoc(doc(db, "sessions", sessionId));
      data = parentSessionDoc.exists()
        ? { id: parentSessionDoc.id, ...parentSessionDoc.data() }
        : null;
    }

    if (!data || !data.compiledStats) return false;

    const stats = data.compiledStats;
    const byTrainer = stats.byTrainer || {};
    const byBatch = stats.byBatch || {};
    const byBranch = stats.byBranch || {};

    await saveDecoupledStats(sessionId, {
      overall: stats,
      byTrainer,
      byBatch,
      byBranch,
    });

    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "sessions", sessionId), {
      compiledStats: null,
    });

    console.log(
      `[Migration] Legacy session ${sessionId} successfully migrated to decoupled subcollections.`,
    );
    return true;
  } catch (err) {
    console.error(`[Migration] Failed to migrate session ${sessionId}:`, err);
    return false;
  }
};

/**
 * Processes, filters, de-duplicates, and sorts qualitative feedback comments.
 * It filters out useless comments (like '.', 'no', 'na', etc.) and sorts the rest
 * by word count and length descending, so lengthier comments bubble to the top.
 * Optional sentiment analysis will filter mismatched comments if `type` ('high' or 'low') is provided.
 * @param {Array} comments - Array of comments (can be strings or objects with a text property)
 * @param {String|null} type - Optional type ('high' for highlights, 'low' for pain points) to run sentiment checks
 * @returns {Array} - Cleaned and sorted comments
 */
export const isValidTopicOrInterest = (topic) => {
  if (!topic) return false;
  let text = "";
  if (typeof topic === "string") {
    text = topic;
  } else if (typeof topic === "object") {
    text = topic.name || topic.text || "";
  }
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  
  if (trimmed.length < 2) {
    const char = trimmed.toLowerCase();
    if (char !== "c" && char !== "r") {
      return false;
    }
  }

  if (/^[.,\/#!$%\^&\*;:{}=\-_`~()?\s]+$/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();

  const uselessWords = new Set([
    "no",
    "na",
    "nil",
    "none",
    "nothing",
    "n/a",
    "no feedback",
    "no comments",
    "good",
    "nice",
    "ok",
    "yes",
    "thanks",
    "thank you",
    "sir",
    "ma'am",
    "mam",
    "okay",
    "no concerns",
    "no concerns reported",
    "nothing yet",
    "not",
    "neither",
    "null",
    "undefined",
  ]);

  if (uselessWords.has(lower)) return false;

  return true;
};

/**
 * Filters and sanitizes raw feedback comments by stripping out useless fillers,
 * removing duplicates, and sorting by content quality (length & detail).
 *
 * @param {Array} comments - The raw comment objects.
 * @param {string} [type] - Optional ('high'|'low') to run sentiment checks.
 * @returns {Array}
 */
export const processQualitativeComments = (comments, type = null) => {
  if (!comments || !Array.isArray(comments)) return [];

  const uselessWords = new Set([
    "no",
    "na",
    "nil",
    "none",
    "nothing",
    "n/a",
    "no feedback",
    "no comments",
    "none.",
    "good",
    "nice",
    "ok",
    "yes",
    "thanks",
    "thank you",
    "sir",
    "ma'am",
    "mam",
    "okay",
    "no concerns",
    "no concerns reported",
    "nothing yet",
    "na.",
    "nil.",
    "no.",
  ]);

  const seenTexts = new Set();
  const processed = [];

  for (const comment of comments) {
    if (!comment) continue;
    const textStr = typeof comment === "string" ? comment : comment.text || "";
    const trimmedText = textStr.trim();

    // Filter by length (minimum 4 characters) and check if it's just punctuation/spaces
    if (
      trimmedText.length < 4 ||
      /^[.,\/#!$%\^&\*;:{}=\-_`~()?\s]+$/.test(trimmedText)
    ) {
      continue;
    }

    const normalizedText = trimmedText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .trim();

    // Filter if normalized text is empty or matches blacklisted useless words
    if (!normalizedText || uselessWords.has(normalizedText)) {
      continue;
    }

    // Sentiment check to prevent mismatches (e.g. positive comments showing as pain points)
    if (type === "high" && getSentimentScore(trimmedText) < 0) {
      continue;
    }
    if (type === "low" && getSentimentScore(trimmedText) > 0) {
      continue;
    }

    // De-duplicate: check if we've already seen this exact normalized comment text
    if (seenTexts.has(normalizedText)) {
      continue;
    }
    seenTexts.add(normalizedText);

    processed.push({
      ...(typeof comment === "string" ? { text: trimmedText } : comment),
      text: trimmedText,
    });
  }

  // Sort by word count (descending), then by string length (descending)
  return processed.sort((a, b) => {
    const wordCountA = a.text.split(/\s+/).length;
    const wordCountB = b.text.split(/\s+/).length;

    if (wordCountB !== wordCountA) {
      return wordCountB - wordCountA;
    }
    return b.text.length - a.text.length;
  });
};

/**
 * Analyzes the sentiment of a text feedback comment.
 * Returns a score where:
 * > 0 is positive sentiment
 * < 0 is negative sentiment (pain point / concern / suggestion for improvement)
 * = 0 is neutral
 */
export const getSentimentScore = (text) => {
  if (!text) return 0;

  // Clean text and split to words
  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const positiveWords = new Set([
    // General praise
    "good",
    "great",
    "excellent",
    "amazing",
    "awesome",
    "perfect",
    "wonderful",
    "fantastic",
    "brilliant",
    "superb",
    "outstanding",
    "exceptional",
    "remarkable",
    "incredible",
    "magnificent",
    "phenomenal",
    "stellar",
    "marvelous",
    "splendid",

    // Learning outcomes
    "informative",
    "helpful",
    "useful",
    "valuable",
    "educational",
    "enlightening",
    "insightful",
    "meaningful",
    "productive",
    "beneficial",
    "practical",
    "applicable",
    "relevant",
    "comprehensive",
    "thorough",
    "in-depth",
    "detailed",
    "clear",

    // Satisfaction
    "satisfied",
    "pleased",
    "happy",
    "glad",
    "delighted",
    "grateful",
    "thankful",
    "appreciate",
    "enjoyed",
    "loved",
    "liked",
    "admired",
    "impressed",
    "amazed",

    // Communication & Delivery
    "clear",
    "concise",
    "crisp",
    "articulate",
    "eloquent",
    "fluent",
    "coherent",
    "understandable",
    "accessible",
    "simple",
    "straightforward",
    "well-organized",
    "structured",
    "systematic",
    "logical",
    "methodical",
    "smooth",
    "seamless",

    // Engagement & Interaction
    "engaging",
    "interactive",
    "participative",
    "collaborative",
    "discussion",
    "dialogue",
    "conversation",
    "responsive",
    "attentive",
    "approachable",
    "accessible",
    "friendly",
    "welcoming",
    "encouraging",
    "supportive",

    // Trainer qualities
    "expert",
    "knowledgeable",
    "experienced",
    "skilled",
    "proficient",
    "competent",
    "qualified",
    "professional",
    "prepared",
    "organized",
    "punctual",
    "reliable",
    "dependable",
    "patient",
    "understanding",
    "empathetic",
    "enthusiastic",
    "energetic",
    "dynamic",
    "charismatic",
    "inspiring",
    "motivating",
    "cooperative",

    // Content & Material
    "rich",
    "comprehensive",
    "well-prepared",
    "well-researched",
    "up-to-date",
    "current",
    "modern",
    "innovative",
    "creative",
    "thought-provoking",
    "challenging",
    "stimulating",
    "absorbing",
    "captivating",
    "compelling",

    // Pace & Timing
    "well-paced",
    "appropriate",
    "balanced",
    "perfect timing",
    "good speed",
    "comfortable pace",
    "right pace",
    "well-timed",
    "efficient",

    // Action words
    "learned",
    "understood",
    "grasped",
    "mastered",
    "acquired",
    "gained",
    "improved",
    "enhanced",
    "developed",
    "strengthened",
    "boosted",

    // Short forms & common expressions
    "gr8",
    "v.good",
    "v good",
    "v nice",
    "fab",
    "awesome sauce",
    "cool",
    "lit",
    "fire",
    "goated",
    "legendary",
    "goat",
    "w",
    "win",
    "winning",
    "solid",
    "decent",
    "fine",
    "okay",
    "alright",
    "acceptable",

    // Comparative positive
    "better",
    "best",
    "greater",
    "superior",
    "improved",

    // Appreciation
    "thank",
    "thanks",
    "thankyou",
    "thx",
    "tysm",
    "appreciated",
  ]);

  const negativeWords = new Set([
    // General dissatisfaction
    "bad",
    "poor",
    "terrible",
    "awful",
    "horrible",
    "disappointing",
    "disappointed",
    "unsatisfactory",
    "subpar",
    "inferior",
    "mediocre",
    "lackluster",
    "underwhelming",
    "unacceptable",
    "frustrating",
    "annoying",
    "irritating",
    "upsetting",
    "discouraging",

    // Difficulty & Comprehension issues
    "hard",
    "difficult",
    "tough",
    "challenging",
    "complicated",
    "complex",
    "confusing",
    "confused",
    "unclear",
    "ambiguous",
    "vague",
    "unintelligible",
    "incomprehensible",
    "muddled",
    "jumbled",
    "disorganized",
    "messy",
    "chaotic",

    // Pace problems
    "slow",
    "sluggish",
    "dragging",
    "lagging",
    "behind",
    "delayed",
    "fast",
    "quick",
    "rapid",
    "speedy",
    "hurried",
    "rushed",
    "hectic",
    "crammed",
    "packed",
    "overwhelming",
    "intense",
    "breakneck",

    // Quality issues
    "boring",
    "dull",
    "monotonous",
    "tedious",
    "repetitive",
    "redundant",
    "pointless",
    "useless",
    "worthless",
    "futile",
    "vain",
    "empty",
    "shallow",
    "superficial",
    "basic",
    "elementary",
    "fundamental",
    "beginner",

    // Technical/Logistical issues
    "loud",
    "noisy",
    "distracting",
    "interrupted",
    "disrupted",
    "glitchy",
    "laggy",
    "buffering",
    "technical",
    "connection",
    "audio",
    "video",
    "microphone",
    "mic",
    "speaker",
    "volume",
    "sound",
    "echo",

    // Trainer criticism
    "unprepared",
    "disorganized",
    "unprofessional",
    "unreliable",
    "inconsistent",
    "unresponsive",
    "inattentive",
    "dismissive",
    "arrogant",
    "condescending",
    "patronizing",
    "rude",
    "impatient",
    "unhelpful",
    "unfriendly",
    "cold",
    "distant",
    "unapproachable",
    "intimidating",
    "monotone",
    "robotic",

    // Content criticism
    "outdated",
    "obsolete",
    "irrelevant",
    "inapplicable",
    "impractical",
    "theoretical",
    "academic",
    "bookish",
    "theoretical only",
    "no examples",
    "lack of examples",
    "insufficient",
    "incomplete",
    "missing",
    "lacking",

    // Common negative expressions
    "waste",
    "wasted",
    "useless",
    "pointless",
    "nonsense",
    "ridiculous",
    "absurd",
    "terrible",
    "horrendous",
    "dreadful",
    "lousy",
    "crummy",

    // Short forms
    "nope",
    "nah",
    "meh",
    "bleh",
    "ugh",
    "ew",
    "yikes",
    "oof",
    "rip",
    "trash",
    "garbage",
    "sucks",
    "suck",
    "stinks",
    "stank",
    "wack",
    "mid",
    "cap",
    "lies",
    "fake",
    "scam",
    "fraud",
    "wasteful",

    // Comparative negative
    "worse",
    "worst",
    "lesser",
    "inferior",
    "declining",
    "deteriorating",

    // Need for improvement
    "improve",
    "improvement",
    "needs improvement",
    "could be better",
    "should improve",
    "needs work",
    "lacking",
    "deficient",
    "insufficient",
    "inadequate",
    "poorly",
    "badly",
    "wrong",
    "incorrect",
    "misleading",
    "inaccurate",
    "flawed",
    "problematic",
    "troublesome",
    "concerning",

    // Doubt & Uncertainty
    "doubt",
    "doubts",
    "unclear",
    "uncertain",
    "unsure",
    "questionable",
    "skeptical",
    "hesitant",
    "reluctant",
    "unconvinced",

    // Concerns
    "issue",
    "issues",
    "problem",
    "problems",
    "concern",
    "concerns",
    "complaint",
    "complaints",
    "grievance",
    "grievances",
    "glitch",
    "bug",
    "error",
    "mistake",
    "flaw",
    "defect",
    "weakness",
    "weak",

    // Negation patterns (handled separately in logic, but included for completeness)
    "not",
    "no",
    "never",
    "none",
    "nothing",
    "nowhere",
    "nobody",
    "cannot",
    "can't",
    "could not",
    "couldn't",
    "would not",
    "wouldn't",
    "should not",
    "shouldn't",
    "does not",
    "doesn't",
    "did not",
    "didn't",
    "was not",
    "wasn't",
    "were not",
    "weren't",
    "is not",
    "isn't",
    "are not",
    "aren't",
    "have not",
    "haven't",
    "has not",
    "hasn't",
    "had not",
    "hadn't",
    "don't",
    "dont",
    "cant",
    "wont",
    "won't",
  ]);

  // Handle double-word patterns (e.g. "not clear", "not good")
  let score = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check bigrams for negation
    if (
      word === "not" ||
      word === "no" ||
      word === "dont" ||
      word === "didnt" ||
      word === "wasnt" ||
      word === "never"
    ) {
      if (i + 1 < words.length) {
        const nextWord = words[i + 1];
        if (positiveWords.has(nextWord)) {
          score -= 2; // "not good" is negative
          i++; // skip next word
          continue;
        }
        if (negativeWords.has(nextWord)) {
          score += 1; // "not bad" is slightly positive
          i++; // skip next word
          continue;
        }
      }
    }

    if (positiveWords.has(word)) {
      score += 1;
    } else if (negativeWords.has(word)) {
      score -= 1;
    }
  }

  return score;
};
