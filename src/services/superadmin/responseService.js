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
 * Compile statistics from responses for a session, filtered by version
 * @param {string} sessionId - The session document ID
 * @param {number} [version=0] - The reactivation version to compile stats for
 * @returns {Promise<Object>} - Compiled statistics object
 */
export const compileSessionStats = async (sessionId, version = 0) => {
  try {
    const allResponses = await getResponses(sessionId);
    
    // Filter responses to only include those matching the current version
    // Responses without a version field are treated as version 0 (original)
    const responses = allResponses.filter(r => (r.version ?? 0) === version);
    
    if (responses.length === 0) {
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
        compiledAt: new Date().toISOString()
      };
    }

    // Calculate per-response averages and extract comments
    const responseStats = responses.map(response => {
      const answers = response.answers || [];
      
      // Get rating answers
      const ratingAnswers = answers.filter(a => a.type === 'rating');
      const avgRating = ratingAnswers.length > 0
        ? ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) / ratingAnswers.length
        : 0;
      
      // Get text comments
      const textAnswers = answers.filter(a => a.type === 'text' && a.value?.trim());
      
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
    // This ensures consistent distribution regardless of actual rating values
    const topCutoff = Math.ceil(totalCount * 0.2);       // Top 20%
    const bottomCutoff = Math.ceil(totalCount * 0.2);    // Bottom 20%

    const highRated = sortedResponses.slice(0, topCutoff);
    const lowRated = sortedResponses.slice(totalCount - bottomCutoff).reverse(); // Reverse so lowest first
    const avgRated = sortedResponses.slice(topCutoff, totalCount - bottomCutoff);

    // Extract comments from a category
    const extractComments = (responses, count = 5) => {
      const comments = [];
      const usedResponseIds = new Set();
      
      for (const resp of responses) {
        if (usedResponseIds.has(resp.responseId)) continue;
        
        for (const comment of resp.textComments) {
          if (comments.length < count) {
            comments.push({ 
              text: comment, 
              avgRating: Math.round(resp.avgRating * 100) / 100,
              responseId: resp.responseId 
            });
            usedResponseIds.add(resp.responseId);
          }
        }
        if (comments.length >= count) break;
      }
      return comments;
    };

    // Extract non-overlapping comments for each category
    const topComments = extractComments(highRated, 5);
    const leastRatedComments = extractComments(lowRated, 5);
    const avgComments = extractComments(avgRated, 5);

    // [NEW] Extract Topics Learned & Future Expectations
    const topicsLearnedRaw = [];
    const futureTopicsRaw = [];

    responses.forEach(resp => {
      (resp.answers || []).forEach(ans => {
        if (ans.type === 'topicslearned' && ans.value?.trim()) {
          // Split by commas and clean up
          const topics = ans.value.split(',').map(t => t.trim()).filter(Boolean);
          topicsLearnedRaw.push(...topics);
        }
        if (ans.type === 'futureSession' && ans.value?.trim()) {
          futureTopicsRaw.push({
            text: ans.value,
            avgRating: 0, // We'll fill this if needed
            responseId: resp.id
          });
        }
      });
    });

    // Process Topics Learned (Unique and Counted)
    const topicCounts = {};
    topicsLearnedRaw.forEach(t => {
      const normalized = t.toLowerCase();
      topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
    });
    
    // Sort and get top 15 topics
    const topicsLearned = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
      .slice(0, 15);

    // Process Future Topics (Top 5 Recent/Relevant)
    // For now we just take the first 5 unique ones
    const futureTopics = futureTopicsRaw.slice(0, 5);

    // Global rating stats
    const avgRating = globalAvgRating;
    const topRating = allRatings.length > 0 ? Math.max(...allRatings) : 0;
    const leastRating = allRatings.length > 0 ? Math.min(...allRatings) : 0;

    // Rating distribution (count of each rating value across all answers)
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    responseStats.forEach(resp => {
      resp.answers.filter(a => a.type === 'rating').forEach(a => {
        const val = Math.round(Number(a.value) || 0);
        if (val >= 1 && val <= 5) {
          ratingDistribution[val]++;
        }
      });
    });

    // Per-question stats
    const questionStats = {};
    responseStats.forEach(resp => {
      resp.answers.forEach(answer => {
        if (!questionStats[answer.questionId]) {
          questionStats[answer.questionId] = {
            type: answer.type,
            values: [],
            count: 0
          };
        }
        questionStats[answer.questionId].values.push(answer.value);
        questionStats[answer.questionId].count++;
      });
    });

    // Calculate averages for rating questions
    Object.keys(questionStats).forEach(qId => {
      const stat = questionStats[qId];
      if (stat.type === 'rating') {
        const numericValues = stat.values.map(v => Number(v) || 0);
        stat.avg = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
        stat.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        numericValues.forEach(v => {
          const rounded = Math.round(v);
          if (rounded >= 1 && rounded <= 5) {
            stat.distribution[rounded]++;
          }
        });
      } else if (stat.type === 'mcq') {
        // Count option frequencies
        stat.optionCounts = {};
        stat.values.forEach(v => {
          stat.optionCounts[v] = (stat.optionCounts[v] || 0) + 1;
        });
      }
      // Clean up raw values array to save space
      delete stat.values;
    });

    // Calculate category averages for radar chart
    // We need to get the session to look up question categories
    const { getSessionById } = await import('./sessionService');
    const session = await getSessionById(sessionId);
    const sessionQuestions = session?.questions || [];
    
    // Build a map of questionId -> category
    const questionCategoryMap = {};
    sessionQuestions.forEach(q => {
      if (q.category) {
        questionCategoryMap[q.id] = q.category;
      }
    });
    
    // Aggregate ratings by category
    const categoryTotals = {};
    const categoryCounts = {};
    
    responseStats.forEach(resp => {
      resp.answers.filter(a => a.type === 'rating').forEach(a => {
        const category = questionCategoryMap[a.questionId] || 'overall';
        const value = Number(a.value) || 0;
        
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
          categoryCounts[category] = 0;
        }
        categoryTotals[category] += value;
        categoryCounts[category]++;
      });
    });
    
    // Calculate averages per category
    const categoryAverages = {};
    Object.keys(categoryTotals).forEach(cat => {
      categoryAverages[cat] = Math.round((categoryTotals[cat] / categoryCounts[cat]) * 100) / 100;
    });

    return {
      totalResponses: responses.length,
      avgRating: Math.round(avgRating * 100) / 100,
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
    .slice(0, 15);

  // Merge Future Topics (combine, dedupe, take 5)
  const futureTopics = [];
  const ftSeen = new Set();
  [...(delta.futureTopics || []), ...(existing.futureTopics || [])].forEach(ft => {
    if (ft && ft.text && !ftSeen.has(ft.text.toLowerCase())) {
      ftSeen.add(ft.text.toLowerCase());
      futureTopics.push(ft);
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
