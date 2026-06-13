import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/**
 * Pure compilation logic to aggregate stats from session responses
 */
const compileSessionStatsFromResponses = (responses, sessionQuestions = []) => {
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

  const responseStats = responses.map(response => {
    const answers = response.answers || [];
    const ratingAnswers = answers.filter(a => {
      const type = (a.type || "").toLowerCase();
      return type === 'rating' || type === 'overall';
    });
    const avgRating = ratingAnswers.length > 0
      ? ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) / ratingAnswers.length
      : 0;
    
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

  const allRatings = responseStats.map(r => r.avgRating).filter(r => r > 0);
  const globalAvgRating = allRatings.length > 0
    ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
    : 2.5;

  const sortedResponses = [...responseStats].sort((a, b) => b.avgRating - a.avgRating);
  const totalCount = sortedResponses.length;

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
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
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
 * Main helper to compile active sessions statistics
 */
async function compileActiveSessions() {
  const sessionsCol = db.collection("sessions");
  const activeSessionsQuery = sessionsCol.where("status", "==", "active");
  const snapshot = await activeSessionsQuery.get();

  console.log(`Found ${snapshot.docs.length} active sessions to compile.`);
  
  let processedCount = 0;
  
  for (const sessionDoc of snapshot.docs) {
    const sessionData = sessionDoc.data();
    const sessionId = sessionDoc.id;
    
    // Fetch all raw responses for this session subcollection
    const responsesRef = db.collection("sessions").doc(sessionId).collection("responses");
    const responsesSnap = await responsesRef.get();
    
    const rawResponses = responsesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    console.log(`Session ${sessionId}: Found ${rawResponses.length} responses.`);
    
    const newStats = compileSessionStatsFromResponses(rawResponses, sessionData.questions || []);
    
    await sessionDoc.ref.update({
      compiledStats: newStats
    });
    
    processedCount++;
  }
  
  return processedCount;
}

/**
 * Scheduled Function: Morning run at 6:00 AM IST (00:30 UTC)
 */
export const compileActiveSessionsMorning = onSchedule({
  schedule: "0 6 * * *",
  timeZone: "Asia/Kolkata",
  memory: "256MiB",
  timeoutSeconds: 300,
}, async (event) => {
  console.log("Starting scheduled morning active sessions compilation...");
  try {
    const processed = await compileActiveSessions();
    console.log(`Successfully completed morning compilation. Processed ${processed} sessions.`);
  } catch (error) {
    console.error("Error during morning active sessions compilation:", error);
  }
});

/**
 * Scheduled Function: Evening run at 6:00 PM IST (12:30 UTC)
 */
export const compileActiveSessionsEvening = onSchedule({
  schedule: "0 18 * * *",
  timeZone: "Asia/Kolkata",
  memory: "256MiB",
  timeoutSeconds: 300,
}, async (event) => {
  console.log("Starting scheduled evening active sessions compilation...");
  try {
    const processed = await compileActiveSessions();
    console.log(`Successfully completed evening compilation. Processed ${processed} sessions.`);
  } catch (error) {
    console.error("Error during evening active sessions compilation:", error);
  }
});

/**
 * HTTPS HTTP Request Function: On-Demand Compilation (for testing / manual run)
 */
export const compileActiveSessionsOnDemand = onRequest({
  cors: true,
  memory: "256MiB",
  timeoutSeconds: 300,
}, async (req, res) => {
  console.log("Received HTTP request for on-demand active sessions compilation.");
  try {
    const processed = await compileActiveSessions();
    res.status(200).json({
      success: true,
      message: `Successfully processed ${processed} active sessions.`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error during on-demand compilation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error"
    });
  }
});
