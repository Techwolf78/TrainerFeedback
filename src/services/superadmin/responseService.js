import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp,
  getCountFromServer,
  deleteDoc,
  doc
} from 'firebase/firestore';

/**
 * Response Service
 * Handles feedback responses stored in subcollections: sessions/{sessionId}/responses
 */

/**
 * Deletes all responses in a session's subcollection
 * Used when reactivating a session so it can start fresh.
 * @param {string} sessionId
 */
export const deleteResponsesForSession = async (sessionId) => {
  try {
    const responsesRef = getResponsesCollection(sessionId);
    const snapshot = await getDocs(responsesRef);
    
    // Process in batches if there are many, but Promise.all is fine for typical session sizes (<200)
    const deletePromises = snapshot.docs.map(document => 
      deleteDoc(doc(db, 'sessions', sessionId, 'responses', document.id))
    );
    
    await Promise.all(deletePromises);
    return snapshot.docs.length; // Return count of deleted items
  } catch (error) {
    console.error('Error deleting responses for session:', error);
    throw error;
  }
};

const getResponsesCollection = (sessionId) => {
  return collection(db, 'sessions', sessionId, 'responses');
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
      submittedAt: serverTimestamp()
    });
    
    return { id: docRef.id, ...responseData };
  } catch (error) {
    console.error('Error adding response:', error);
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
    const q = query(responsesRef, orderBy('submittedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting responses:', error);
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
    console.error('Error getting response count:', error);
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
        console.error(`Failed to fetch responses for session ${sessionId}:`, error);
        return [];
      })
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
export const compileSessionStatsFromResponses = (responses, sessionQuestions = []) => {
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
      compiledAt: new Date().toISOString()
    };
  }

  // Calculate per-response averages and extract comments
  const responseStats = responses.map(response => {
    const answers = response.answers || [];
    
    // Get rating answers
    const ratingAnswers = answers.filter(a => {
      const type = (a.type || "").toLowerCase();
      return type === 'rating' || type === 'overall';
    });
    const avgRating = ratingAnswers.length > 0
      ? ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) / ratingAnswers.length
      : 0;
    
    // Get text comments
    const textAnswers = answers.filter(a => {
      const type = (a.type || "").toLowerCase();
      return (type === 'text' || type === 'comment' || type === 'feedback') && a.value?.trim();
    });
    
    return {
      responseId: response.id,
      avgRating,
      textComments: textAnswers.map(a => a.value),
      answers
    };
  });

  // Calculate global average rating
  const allRatings = responseStats.map(r => r.avgRating).filter(r => r > 0);
  const globalAvgRating = allRatings.length > 0
    ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
    : 2.5; // Default to middle if no ratings

  // Sort all responses by rating (descending) for percentile-based categorization
  const sortedResponses = [...responseStats].sort((a, b) => b.avgRating - a.avgRating);
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
          responseId: resp.responseId 
        });
        localUsedResponseIds.add(resp.responseId);
        if (globalUsedIds) globalUsedIds.add(resp.responseId);
      }
    }
    return comments;
  };

  const usedInBuckets = new Set();
  const topComments = extractAllComments(highRated, usedInBuckets).sort((a, b) => b.text.length - a.text.length);
  const leastRatedComments = extractAllComments(lowRated, usedInBuckets).sort((a, b) => b.text.length - a.text.length);
  const avgComments = extractAllComments(avgRated, usedInBuckets).sort((a, b) => b.text.length - a.text.length);

  // Topics/Future
  const topicsLearnedRaw = [];
  const futureTopicsRaw = [];
  responses.forEach(resp => {
    (resp.answers || []).forEach(ans => {
      const type = (ans.type || "").toLowerCase();
      if ((type === 'topicslearned' || type === 'topics' || type === 'learned') && ans.value?.trim()) {
        const val = Array.isArray(ans.value) ? ans.value.join(", ") : ans.value;
        const topics = val.split(',').map(t => t.trim()).filter(Boolean);
        topicsLearnedRaw.push(...topics);
      }
      if ((type === 'futuresession' || type === 'future' || type === 'futuretopics') && ans.value?.trim()) {
        const val = Array.isArray(ans.value) ? ans.value.join(", ") : ans.value;
        const futures = val.split(',').map(t => t.trim()).filter(Boolean);
        futures.forEach(f => {
          futureTopicsRaw.push({ 
            text: f, 
            avgRating: Math.round(resp.avgRating * 100) / 100, 
            responseId: resp.id 
          });
        });
      }
    });
  });

  const topicCounts = {};
  topicsLearnedRaw.forEach(t => {
    const normalized = t.toLowerCase();
    topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
  });
  const topicsLearned = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
    .slice(0, 15);

  const futureTopicCounts = {};
  futureTopicsRaw.forEach(f => {
    const normalized = f.text.trim();
    if (!normalized) return;
    if (!futureTopicCounts[normalized]) {
      futureTopicCounts[normalized] = { count: 0, ratingSum: 0 };
    }
    futureTopicCounts[normalized].count++;
    futureTopicCounts[normalized].ratingSum += (f.avgRating || 0);
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
      avgRating: Math.round((data.ratingSum / data.count) * 100) / 100
    }))
    .slice(0, 100);

  const avgRatingResult = globalAvgRating;
  const topRating = allRatings.length > 0 ? Math.max(...allRatings) : 0;
  const leastRating = allRatings.length > 0 ? Math.min(...allRatings) : 0;

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  responseStats.forEach(resp => {
    resp.answers.filter(a => a.type === 'rating').forEach(a => {
      const val = Math.round(Number(a.value) || 0);
      if (val >= 1 && val <= 5) ratingDistribution[val]++;
    });
  });

  const questionStats = {};
  responseStats.forEach(resp => {
    resp.answers.forEach(answer => {
      if (!questionStats[answer.questionId]) {
        questionStats[answer.questionId] = { type: answer.type, values: [], count: 0 };
      }
      questionStats[answer.questionId].values.push(answer.value);
      questionStats[answer.questionId].count++;
    });
  });

  Object.keys(questionStats).forEach(qId => {
    const stat = questionStats[qId];
    if (stat.type === 'rating') {
      const numericValues = stat.values.map(v => Number(v) || 0);
      stat.avg = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
      stat.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      numericValues.forEach(v => {
        const rounded = Math.round(v);
        if (rounded >= 1 && rounded <= 5) stat.distribution[rounded]++;
      });
    } else if (stat.type === 'mcq') {
      stat.optionCounts = {};
      stat.values.forEach(v => { stat.optionCounts[v] = (stat.optionCounts[v] || 0) + 1; });
    }
    delete stat.values;
  });

  // Categories
  const questionCategoryMap = {};
  (sessionQuestions || []).forEach(q => { if (q.id && q.category) questionCategoryMap[q.id] = q.category; });
  
  const categoryTotals = {};
  const categoryCounts = {};
  responseStats.forEach(resp => {
    resp.answers.filter(a => a.type === 'rating').forEach(a => {
      const category = questionCategoryMap[a.questionId] || 'overall';
      const value = Number(a.value) || 0;
      if (!categoryTotals[category]) { categoryTotals[category] = 0; categoryCounts[category] = 0; }
      categoryTotals[category] += value;
      categoryCounts[category]++;
    });
  });
  
  const categoryAverages = {};
  Object.keys(categoryTotals).forEach(cat => {
    categoryAverages[cat] = Math.round((categoryTotals[cat] / categoryCounts[cat]) * 100) / 100;
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
    compiledAt: new Date().toISOString()
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
    const { getSessionById } = await import('./sessionService');
    const sessionDoc = await getSessionById(sessionId);
    
    // Filter responses to only include those matching the current version
    const responses = allResponses.filter(r => (r.version ?? 0) === version);
    
    return compileSessionStatsFromResponses(responses, sessionDoc?.questions || []);
  } catch (error) {
    console.error('Error compiling session stats:', error);
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
    return Math.round((((avg1 * w1) + (avg2 * w2)) / (w1 + w2)) * 100) / 100;
  };

  const avgRating = mergeWeightedAvg(existing.avgRating || 0, existingWeight, delta.avgRating || 0, deltaWeight);
  const topRating = Math.max(existing.topRating || 0, delta.topRating || 0);
  // If one of them is 0 (meaning no ratings), take the other. Otherwise min.
  const leastRatingOrig = [existing.leastRating, delta.leastRating].filter(r => r > 0);
  const leastRating = leastRatingOrig.length > 0 ? Math.min(...leastRatingOrig) : 0;

  // Merge Rating Distribution
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  [1, 2, 3, 4, 5].forEach(stars => {
    ratingDistribution[stars] = (existing.ratingDistribution?.[stars] || 0) + (delta.ratingDistribution?.[stars] || 0);
  });

  // Merge Comments (Combine, re-sort by rating, and format, taking top 5)
  // We don't have perfect raw data, but we can do our best with the top 5 of each
  const mergeCommentArrays = (arr1, arr2, type = 'top') => {
    const combined = [...(arr1 || []), ...(arr2 || [])];
    const unique = [];
    const seen = new Set();
    combined.forEach(c => {
      if (c && c.text && !seen.has(c.text.toLowerCase())) {
        seen.add(c.text.toLowerCase());
        unique.push(c);
      }
    });

    if (type === 'top') {
      return unique.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0)).slice(0, 5);
    } else if (type === 'least') {
      return unique.sort((a, b) => (a.avgRating || 0) - (b.avgRating || 0)).slice(0, 5);
    } else {
      // average comments: sort towards the middle
      const middle = avgRating || 3;
      return unique.sort((a, b) => Math.abs((a.avgRating || 0) - middle) - Math.abs((b.avgRating || 0) - middle)).slice(0, 5);
    }
  };

  // Merge Category Averages
  const categoryAverages = { ...(existing.categoryAverages || {}) };
  Object.keys(delta.categoryAverages || {}).forEach(cat => {
    if (categoryAverages[cat]) {
      categoryAverages[cat] = mergeWeightedAvg(categoryAverages[cat], existingWeight, delta.categoryAverages[cat], deltaWeight);
    } else {
      categoryAverages[cat] = delta.categoryAverages[cat];
    }
  });

  // Merge Question Stats
  const questionStats = JSON.parse(JSON.stringify(existing.questionStats || {})); // Deep copy
  Object.keys(delta.questionStats || {}).forEach(qId => {
    const dStat = delta.questionStats[qId];
    if (!questionStats[qId]) {
      questionStats[qId] = dStat;
    } else {
      const eStat = questionStats[qId];
      if (eStat.type === 'rating') {
        eStat.avg = mergeWeightedAvg(eStat.avg || 0, eStat.count || 0, dStat.avg || 0, dStat.count || 0);
        eStat.count = (eStat.count || 0) + (dStat.count || 0);
        [1, 2, 3, 4, 5].forEach(star => {
          if (!eStat.distribution) eStat.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          eStat.distribution[star] = (eStat.distribution[star] || 0) + (dStat.distribution?.[star] || 0);
        });
      } else if (eStat.type === 'mcq') {
        eStat.count = (eStat.count || 0) + (dStat.count || 0);
        Object.keys(dStat.optionCounts || {}).forEach(opt => {
          if (!eStat.optionCounts) eStat.optionCounts = {};
          eStat.optionCounts[opt] = (eStat.optionCounts[opt] || 0) + dStat.optionCounts[opt];
        });
      }
    }
  });

  // Merge Topics Learned (combine counts, sort, take top 15)
  const mergedTopics = {};
  [...(existing.topicsLearned || []), ...(delta.topicsLearned || [])].forEach(t => {
    const normalized = t.name.toLowerCase();
    mergedTopics[normalized] = {
      name: t.name,
      count: (mergedTopics[normalized]?.count || 0) + t.count
    };
  });
  const topicsLearned = Object.values(mergedTopics)
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  // Merge Future Topics (combine, dedupe, take 100)
  const futureTopics = [];
  const ftSeen = new Set();
  [...(delta.futureTopics || []), ...(existing.futureTopics || [])].forEach(ft => {
    const topicText = (ft?.text || ft?.name || "").toString().trim();
    if (topicText && !ftSeen.has(topicText.toLowerCase())) {
      ftSeen.add(topicText.toLowerCase());
      futureTopics.push({
        ...ft,
        text: topicText,
        name: topicText,
      });
    }
  });

  return {
    totalResponses,
    avgRating,
    topRating,
    leastRating,
    ratingDistribution,
    topComments: mergeCommentArrays(existing.topComments, delta.topComments, 'top'),
    leastRatedComments: mergeCommentArrays(existing.leastRatedComments, delta.leastRatedComments, 'least'),
    avgComments: mergeCommentArrays(existing.avgComments, delta.avgComments, 'avg'),
    questionStats,
    categoryAverages,
    topicsLearned,
    futureTopics: futureTopics.slice(0, 5),
    compiledAt: new Date().toISOString()
  };
};
