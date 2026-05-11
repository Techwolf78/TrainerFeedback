import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";

// Initialize Firebase using the hardcoded config from your environment
const firebaseConfig = {
  apiKey: "AIzaSyCdRbGZVROkMOt5QaFQSSB1dQnz5waQlkw",
  authDomain: "trainer-feedback-f59f0.firebaseapp.com",
  projectId: "trainer-feedback-f59f0",
  storageBucket: "trainer-feedback-f59f0.firebasestorage.app",
  messagingSenderId: "978849822812",
  appId: "1:978849822812:web:1de5014f1ddc802e1b8e99",
  measurementId: "G-W0MK9LDYYJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Pure compilation logic extracted from your responseService.js
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
 * Main script to run the fix
 */
const runFix = async () => {
  try {
    console.log("Starting Firebase stats recalculation script...");
    
    // Fetch all closed/inactive sessions
    const sessionsQuery = query(collection(db, "sessions"), where("status", "==", "inactive"));
    const snapshot = await getDocs(sessionsQuery);
    
    console.log(`Found ${snapshot.docs.length} inactive sessions to process.`);
    
    let fixedCount = 0;

    for (const sessionDoc of snapshot.docs) {
      const sessionData = sessionDoc.data();
      const sessionId = sessionDoc.id;
      
      // Fetch all raw responses for this session
      const responsesRef = collection(db, "sessions", sessionId, "responses");
      const responsesSnap = await getDocs(responsesRef);
      
      const rawResponses = responsesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const actualResponseCount = rawResponses.length;
      
      const currentStats = sessionData.compiledStats;
      const recordedCount = currentStats ? currentStats.totalResponses : 0;
      
      if (recordedCount !== actualResponseCount) {
        console.log(`[Session ${sessionId}] Discrepancy found! Recorded: ${recordedCount}, Actual Raw Responses: ${actualResponseCount}`);
        console.log(`-> Recalculating stats...`);
        
        const newStats = compileSessionStatsFromResponses(rawResponses, sessionData.questions || []);
        
        await updateDoc(doc(db, "sessions", sessionId), {
          compiledStats: newStats
        });
        
        console.log(`-> Fixed and updated Session ${sessionId}!`);
        fixedCount++;
      } else {
        console.log(`[Session ${sessionId}] OK (Count: ${actualResponseCount})`);
      }
    }
    
    console.log(`\n========================================`);
    console.log(`Finished! Successfully fixed ${fixedCount} corrupted sessions.`);
    console.log(`========================================`);
    process.exit(0);

  } catch (error) {
    console.error("An error occurred during the script:", error);
    process.exit(1);
  }
};

runFix();
