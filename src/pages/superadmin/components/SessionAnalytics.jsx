import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Star,
  Users,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Download,
  Calendar,
  User,
  Building2,
  Sparkles,
  Camera,
  RefreshCw, // Added for live analytics refresh
  Loader2, // Added for loading state
  BarChart3,
  Activity,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Line,
  Area,
  Legend,
  LabelList,
} from "recharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import { useRef } from "react";
import { db } from "@/services/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { processQualitativeComments, compileSessionStats, isValidTopicOrInterest, compileSessionStatsFromResponses } from "@/services/superadmin/responseService";
import { updateSession } from "@/services/superadmin/sessionService";
import { cn } from "@/lib/utils";

// Helper function to get a color from red (0) to yellow (2.5) to green (5)
const getDynamicColor = (rating) => {
  const safeRating = Number(rating) || 0;
  // Hue 0 = red, 60 = yellow, 120 = green
  const hue = Math.max(0, Math.min(120, (safeRating / 5) * 120));
  // Professional, muted tones (lower saturation)
  return `hsl(${hue}, 65%, 45%)`;
};

const SessionAnalytics = ({ session, onBack, initialTrainer = null }) => {
  const analyticsRef = useRef(null);
  const hasFullStats = session?.compiledStats && session?.compiledStats.ratingDistribution;
  const [baseStats, setBaseStats] = useState(() => {
    if (!hasFullStats) return null;
    const cs = session.compiledStats;
    return {
      ...cs,
      topComments: processQualitativeComments(cs.topComments, 'high'),
      leastRatedComments: processQualitativeComments(cs.leastRatedComments, 'low'),
      avgComments: processQualitativeComments(cs.avgComments)
    };
  });
  const setStats = setBaseStats;
  const [loading, setLoading] = useState(!hasFullStats);
  const [isLive, setIsLive] = useState(session?.status === "active");
  const [learnedLimit, setLearnedLimit] = useState(25);
  const [futureLimit, setFutureLimit] = useState(25);
  const [liveResponses, setLiveResponses] = useState([]);
  const [trendViewMode, setTrendViewMode] = useState("area"); // 'area' | 'bar'

  const fetchLiveStats = async (showToast = false) => {
    try {
      if (showToast) toast.loading("Fetching live data...");
      setLoading(true);

      const { getSessionStats } = await import("@/services/superadmin/responseService");

      if (session.status !== "active") {
        // Closed session: fetch resolved stats from subcollections / parent fallback
        const resolvedStats = await getSessionStats(session.id, session);
        if (resolvedStats) {
          setStats({
            ...resolvedStats,
            topComments: processQualitativeComments(resolvedStats.topComments, 'high'),
            leastRatedComments: processQualitativeComments(resolvedStats.leastRatedComments, 'low'),
            avgComments: processQualitativeComments(resolvedStats.avgComments)
          });
        } else {
          setStats(null);
        }
      } else {
        // Active session: fetch the latest session document from Firestore to check for manually compiled stats
        const { getSessionById } = await import("@/services/superadmin/sessionService");
        const latestSession = await getSessionById(session.id);
        if (latestSession && latestSession.compiledStats) {
          setStats({
            ...latestSession.compiledStats,
            topComments: processQualitativeComments(latestSession.compiledStats.topComments, 'high'),
            leastRatedComments: processQualitativeComments(latestSession.compiledStats.leastRatedComments, 'low'),
            avgComments: processQualitativeComments(latestSession.compiledStats.avgComments)
          });
        } else {
          setStats(null);
        }
      }
      if (showToast) {
        toast.dismiss();
        toast.success("Data updated");
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      if (showToast) {
        toast.dismiss();
        toast.error("Failed to update data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompile = async () => {
    try {
      toast.loading("Compiling session statistics...");
      setLoading(true);
      
      const compiled = await compileSessionStats(session.id, session.reactivationCount || 0);
      
      // Update session document with latest compiled stats without closing it
      const { serverTimestamp } = await import("firebase/firestore");
      await updateSession(session.id, {
        compiledStats: compiled,
        lastCompiledAt: serverTimestamp(),
      });

      setStats({
        ...compiled,
        topComments: processQualitativeComments(compiled.topComments, 'high'),
        leastRatedComments: processQualitativeComments(compiled.leastRatedComments, 'low'),
        avgComments: processQualitativeComments(compiled.avgComments)
      });
      
      toast.dismiss();
      toast.success("Statistics compiled successfully");
    } catch (error) {
      console.error("Failed to compile stats:", error);
      toast.dismiss();
      toast.error("Failed to compile statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.id) return;

    if (session.status !== "active") {
      fetchLiveStats();
      // Load responses for closed sessions to compute dynamic trainer analytics and date-wise timeline
      const loadClosedResponses = async () => {
        try {
          const { getResponses } = await import("@/services/superadmin/responseService");
          const allResponses = await getResponses(session.id);
          const version = session.reactivationCount || 0;
          let responses = (allResponses || []).filter((r) => (r.version ?? 0) === version);
          if (responses.length === 0 && (allResponses || []).length > 0) {
            responses = allResponses;
          }
          setLiveResponses(responses);
        } catch (err) {
          console.error("Failed to load closed session responses for timeline:", err);
        }
      };
      loadClosedResponses();
      return;
    }

    // Live subscription for active sessions to recalculate stats in real time on client side
    setLoading(true);
    const responsesRef = collection(db, "sessions", session.id, "responses");
    const q = query(responsesRef, orderBy("submittedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawResponses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const version = session.reactivationCount || 0;
        let responses = rawResponses.filter((r) => (r.version ?? 0) === version);
        if (responses.length === 0 && rawResponses.length > 0) {
          responses = rawResponses;
        }

        const compiled = compileSessionStatsFromResponses(
          responses,
          session.questions || [],
          session.id
        );

        setBaseStats({
          ...compiled,
          topComments: processQualitativeComments(compiled.topComments, "high"),
          leastRatedComments: processQualitativeComments(compiled.leastRatedComments, "low"),
          avgComments: processQualitativeComments(compiled.avgComments),
        });
        setLiveResponses(responses);
        setLoading(false);
      },
      (error) => {
        console.error("Real-time responses listener failed:", error);
        fetchLiveStats();
      }
    );

    return () => unsubscribe();
  }, [session?.id, session?.status]);

  // 1. Session Trainers Extraction
  const sessionTrainers = useMemo(() => {
    const map = new Map();
    // From session assigned trainers
    const assigned = session?.assignedTrainers || (session?.assignedTrainer ? [session.assignedTrainer] : []);
    assigned.forEach((t) => {
      const name = t?.name?.trim();
      const id = t?.id || name;
      if (name) {
        map.set(name.toLowerCase(), { id, name });
      }
    });
    // From live responses
    (liveResponses || []).forEach((r) => {
      const name = r.selectedTrainerName?.trim() || r.trainerName?.trim();
      const id = r.selectedTrainerId || r.trainerId || name;
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), { id, name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [session, liveResponses]);

  // Trainer response counts
  const trainerResponseCounts = useMemo(() => {
    const counts = {};
    if (!liveResponses || liveResponses.length === 0) return counts;

    if (sessionTrainers.length === 1) {
      counts[sessionTrainers[0].name] = liveResponses.length;
      return counts;
    }

    sessionTrainers.forEach((t) => {
      const targetName = t.name.trim().toLowerCase();
      const targetId = String(t.id || "").trim().toLowerCase();

      const matchedCount = liveResponses.filter((r) => {
        const tName = (r.selectedTrainerName || r.trainerName || "").trim().toLowerCase();
        const tId = String(r.selectedTrainerId || r.trainerId || "").trim().toLowerCase();
        if (tName === targetName || (targetId && tId === targetId)) return true;
        if (tName && targetName && (tName.includes(targetName) || targetName.includes(tName))) return true;
        return false;
      }).length;

      counts[t.name] = matchedCount;
    });

    return counts;
  }, [liveResponses, sessionTrainers]);

  // Active session trainers with > 0 reviews (or fallback to assigned trainers if no reviews yet)
  const activeSessionTrainers = useMemo(() => {
    if (!liveResponses || liveResponses.length === 0) return sessionTrainers;
    const withResponses = sessionTrainers.filter(
      (t) => (trainerResponseCounts[t.name] || 0) > 0,
    );
    return withResponses.length > 0 ? withResponses : sessionTrainers;
  }, [sessionTrainers, trainerResponseCounts, liveResponses]);

  // 2. Selected Trainer state
  const [selectedTrainer, setSelectedTrainer] = useState(() => {
    if (initialTrainer) return initialTrainer;
    return "all";
  });

  // Sync selectedTrainer when initialTrainer or activeSessionTrainers change
  useEffect(() => {
    if (
      initialTrainer &&
      activeSessionTrainers.some(
        (t) => t.name.toLowerCase() === initialTrainer.toLowerCase(),
      )
    ) {
      const matched = activeSessionTrainers.find(
        (t) => t.name.toLowerCase() === initialTrainer.toLowerCase(),
      );
      setSelectedTrainer(matched.name);
    } else if (activeSessionTrainers.length === 1) {
      setSelectedTrainer(activeSessionTrainers[0].name);
    } else if (
      selectedTrainer !== "all" &&
      activeSessionTrainers.length > 0 &&
      !activeSessionTrainers.some(
        (t) => t.name.toLowerCase() === selectedTrainer.toLowerCase(),
      )
    ) {
      setSelectedTrainer("all");
    }
  }, [initialTrainer, activeSessionTrainers]);

  // 3. Filtered responses by selected trainer
  const filteredResponses = useMemo(() => {
    if (!liveResponses || liveResponses.length === 0) return [];
    if (selectedTrainer === "all") return liveResponses;
    if (
      activeSessionTrainers.length === 1 &&
      activeSessionTrainers[0].name.toLowerCase() ===
        selectedTrainer.toLowerCase()
    ) {
      return liveResponses;
    }
    const target = selectedTrainer.trim().toLowerCase();
    const matchedTrainerObj = sessionTrainers.find(
      (t) => t.name.toLowerCase() === target,
    );
    const targetId = matchedTrainerObj?.id
      ? String(matchedTrainerObj.id).trim().toLowerCase()
      : "";

    return liveResponses.filter((r) => {
      const tName = (
        r.selectedTrainerName ||
        r.trainerName ||
        ""
      )
        .trim()
        .toLowerCase();
      const tId = String(r.selectedTrainerId || r.trainerId || "")
        .trim()
        .toLowerCase();
      if (tName === target) return true;
      if (targetId && tId === targetId) return true;
      if (
        tName &&
        target &&
        (tName.includes(target) || target.includes(tName))
      )
        return true;
      return false;
    });
  }, [liveResponses, selectedTrainer, sessionTrainers, activeSessionTrainers]);

  // 4. Effective Stats for Selected Trainer or Entire Session
  const stats = useMemo(() => {
    const responsesToUse =
      selectedTrainer === "all"
        ? (liveResponses && liveResponses.length > 0 ? liveResponses : [])
        : filteredResponses;

    if (responsesToUse && responsesToUse.length > 0) {
      const compiled = compileSessionStatsFromResponses(
        responsesToUse,
        session?.questions || [],
        session?.id
      );
      return {
        ...compiled,
        topComments: processQualitativeComments(compiled.topComments, "high"),
        leastRatedComments: processQualitativeComments(compiled.leastRatedComments, "low"),
        avgComments: processQualitativeComments(compiled.avgComments),
      };
    }

    if (selectedTrainer !== "all" && filteredResponses.length === 0) {
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
        categoryAverages: {
          knowledge: 0,
          communication: 0,
          engagement: 0,
          content: 0,
          delivery: 0,
          overall: 0,
        },
        topicsLearned: [],
        futureTopics: [],
        compiledAt: new Date().toISOString(),
      };
    }

    return baseStats;
  }, [baseStats, liveResponses, filteredResponses, selectedTrainer, session]);

  // Compute Date-wise Timeline Data & Metrics for the Session
  const { dateWiseTrend, trendMetrics } = useMemo(() => {
    const responsesToUse = filteredResponses;
    if (!responsesToUse || responsesToUse.length === 0) {
      return { dateWiseTrend: [], trendMetrics: null };
    }

    const dateMap = {};

    responsesToUse.forEach((r) => {
      let d;
      if (r.submittedAt?.toDate) {
        d = r.submittedAt.toDate();
      } else if (r.submittedAt) {
        d = new Date(r.submittedAt);
      }

      if (!d || isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;

      const shortMonth = d.toLocaleDateString("en-US", { month: "short" });
      const dayNum = d.getDate();
      const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short" });

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          dateKey,
          displayDate: `${dayNum} ${shortMonth}`,
          fullDate: `${dayOfWeek}, ${dayNum} ${shortMonth} ${year}`,
          count: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
      }

      dateMap[dateKey].count += 1;

      // Extract rating from answers or response object
      let respRating = null;
      if (typeof r.avgRating === "number" && r.avgRating > 0) {
        respRating = r.avgRating;
      } else if (r.answers && Array.isArray(r.answers)) {
        const ratingAnswers = r.answers.filter((a) => {
          const type = (a.type || "").toLowerCase();
          if (type === "rating" || type === "overall" || type === "star" || type === "scale") return true;
          const numVal = Number(a.value);
          return !isNaN(numVal) && numVal >= 1 && numVal <= 5 && String(a.value).trim() !== "" && (type === "" || type === "number");
        });
        if (ratingAnswers.length > 0) {
          respRating =
            ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) /
            ratingAnswers.length;
        }
      }

      if (respRating !== null && respRating > 0) {
        dateMap[dateKey].ratingSum += respRating;
        dateMap[dateKey].ratingCount += 1;
      }
    });

    const sortedKeys = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

    const trend = sortedKeys.map((k) => ({
      date: dateMap[k].displayDate,
      fullDate: dateMap[k].fullDate,
      responses: dateMap[k].count,
      avgRating:
        dateMap[k].ratingCount > 0
          ? Number((dateMap[k].ratingSum / dateMap[k].ratingCount).toFixed(2))
          : 0,
    }));

    let peakDay = null;
    let maxResponses = 0;
    let totalSubmissions = 0;
    let weightedRatingSum = 0;

    trend.forEach((item) => {
      totalSubmissions += item.responses;
      if (item.responses > maxResponses) {
        maxResponses = item.responses;
        peakDay = item;
      }
      if (item.avgRating > 0) {
        weightedRatingSum += item.avgRating * item.responses;
      }
    });

    const avgDaily = trend.length > 0 ? Math.round(totalSubmissions / trend.length) : 0;
    const overallAvgRating = totalSubmissions > 0 ? (weightedRatingSum / totalSubmissions).toFixed(2) : "0.00";

    const validRatings = trend.map((t) => t.avgRating).filter((r) => r > 0);
    const minRating = validRatings.length > 0 ? Math.min(...validRatings) : 4.0;
    const maxRating = validRatings.length > 0 ? Math.max(...validRatings) : 5.0;

    // Adaptive rating scale so the curve doesn't flatten at 5.0
    let ratingMin = Math.max(0, Math.floor(minRating * 2) / 2 - 0.5);
    if (ratingMin > 4.0) ratingMin = 4.0;
    if (minRating < 2.5) ratingMin = 0;

    const ratingTicks = [];
    const step = (5.0 - ratingMin) / 4;
    for (let v = ratingMin; v <= 5.001; v += step) {
      ratingTicks.push(Number(v.toFixed(2)));
    }

    return {
      dateWiseTrend: trend,
      trendMetrics: {
        totalDays: trend.length,
        totalSubmissions,
        peakDay: peakDay ? `${peakDay.date} (${peakDay.responses})` : "N/A",
        avgDaily,
        overallAvgRating,
        ratingMin,
        ratingMax: 5.0,
        ratingTicks,
      },
    };
  }, [filteredResponses]);

  const filteredTopicsLearned = useMemo(() => {
    return (stats?.topicsLearned || []).filter(isValidTopicOrInterest);
  }, [stats?.topicsLearned]);

  const filteredFutureTopics = useMemo(() => {
    return (stats?.futureTopics || []).filter(isValidTopicOrInterest);
  }, [stats?.futureTopics]);

  // Get active trainers who actually received responses
  const activeTrainers = React.useMemo(() => {
    const trainersSet = new Set();

    // 1. Try to extract from live responses first (most fresh)
    if (liveResponses.length > 0) {
      liveResponses.forEach((r) => {
        if (r.selectedTrainerName && r.selectedTrainerName.trim()) {
          trainersSet.add(r.selectedTrainerName.trim());
        }
      });
    }

    // 2. Fallback to byTrainer compiled stats
    if (trainersSet.size === 0 && stats?.byTrainer) {
      Object.values(stats.byTrainer).forEach((t) => {
        if (t.trainerName && t.trainerName.trim()) {
          trainersSet.add(t.trainerName.trim());
        }
      });
    }

    return Array.from(trainersSet).sort((a, b) => a.localeCompare(b));
  }, [liveResponses, stats?.byTrainer]);

  const handleExport = async () => {
    if (!stats) return;

    try {
      toast.loading("Exporting report...");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Gryphon Academy";

      // [NEW] Fetch detailed responses
      const { getResponses } =
        await import("@/services/superadmin/responseService");
      const allResponses = await getResponses(session.id);

      // Filter by session version if it exists
      const responses = allResponses.filter(
        (r) => (r.version ?? 0) === (session.version ?? 0),
      );

      // --- SHEET 1: RESPONSES ---
      const responsesSheet = workbook.addWorksheet("Responses");
      const questions = session.questions || [];
      const columns = [
        { header: "Response ID", key: "id", width: 20 },
        { header: "Submitted At", key: "submittedAt", width: 20 },
        { header: "Device ID", key: "deviceId", width: 20 },
        { header: "Trainer Name", key: "selectedTrainerName", width: 25 },
        ...questions.map((q, i) => ({
          header: `Q${i + 1}: ${q.text || q.question}`,
          key: `q_${q.id}`,
          width: 30,
        })),
      ];
      responsesSheet.columns = columns;

      const rows = responses.map((resp) => {
        const row = {
          id: resp.id,
          submittedAt: resp.submittedAt?.toDate
            ? resp.submittedAt.toDate().toLocaleString()
            : new Date(resp.submittedAt).toLocaleString(),
          deviceId: resp.deviceId,
          selectedTrainerName: resp.selectedTrainerName || "N/A",
        };
        if (resp.answers) {
          resp.answers.forEach((ans) => {
            row[`q_${ans.questionId}`] = ans.value;
          });
        }
        return row;
      });
      responsesSheet.addRows(rows);
      responsesSheet.getRow(1).font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      responsesSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };

      // --- SHEET 2: SUMMARY ---
      const summarySheet = workbook.addWorksheet("Summary Stats");
      summarySheet.columns = [
        { header: "Field", key: "field", width: 25 },
        { header: "Value", key: "value", width: 40 },
      ];
      summarySheet.addRows([
        { field: "Session Topic", value: session.topic },
        { field: "College", value: session.collegeName },
        { field: "Trainer", value: activeTrainers.length > 0 ? activeTrainers.join(", ") : (session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : [])).map(t => t.name).join(", ") || "N/A" },
        { field: "Domain", value: session.domain },
        { field: "Course", value: session.course },
        { field: "Batch", value: (session.batches || (session.batch ? [session.batch] : [])).join(", ") || "N/A" },
        { field: "Department", value: (session.branches || (session.branch ? [session.branch] : [])).join(", ") || "N/A" },
        { field: "Session Date", value: session.sessionDate },
        { field: "Session Time", value: session.sessionTime },
        { field: "", value: "" },
        { field: "Total Responses", value: stats.totalResponses },
        { field: "Average Rating", value: stats.avgRating },
        { field: "Top Rating", value: stats.topRating },
        { field: "Least Rating", value: stats.leastRating },
      ]);
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };
      summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // --- SHEET 3: RATING DISTRIBUTION ---
      const ratingSheet = workbook.addWorksheet("Rating Distribution");
      ratingSheet.columns = [
        { header: "Rating", key: "rating", width: 15 },
        { header: "Count", key: "count", width: 15 },
        { header: "Percentage", key: "percentage", width: 15 },
      ];
      const totalRatings = Object.values(stats.ratingDistribution || {}).reduce(
        (a, b) => a + b,
        0,
      );
      Object.entries(stats.ratingDistribution || {}).forEach(
        ([rating, count]) => {
          ratingSheet.addRow({
            rating: `${rating} Star`,
            count: count,
            percentage:
              totalRatings > 0
                ? `${((count / totalRatings) * 100).toFixed(1)}%`
                : "0%",
          });
        },
      );
      ratingSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ratingSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };

      // --- SHEET 4: COMMENTS ---
      const commentsSheet = workbook.addWorksheet("Comments");
      commentsSheet.columns = [
        { header: "Category", key: "category", width: 20 },
        { header: "Comment", key: "comment", width: 60 },
        { header: "Avg Rating", key: "avgRating", width: 15 },
      ];
      (stats.topComments || []).forEach((c) => {
        commentsSheet.addRow({
          category: "Top Rated",
          comment: c.text,
          avgRating: c.avgRating,
        });
      });
      (stats.avgComments || []).forEach((c) => {
        commentsSheet.addRow({
          category: "Average",
          comment: c.text,
          avgRating: c.avgRating,
        });
      });
      (stats.leastRatedComments || []).forEach((c) => {
        commentsSheet.addRow({
          category: "Least Rated",
          comment: c.text,
          avgRating: c.avgRating,
        });
      });
      commentsSheet.getRow(1).font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      commentsSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        blob,
        `feedback_${session.topic.replace(/[^a-z0-9]/gi, "_")}_${session.sessionDate}.xlsx`,
      );

      toast.dismiss();
      toast.success("Excel report exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.dismiss();
      toast.error("Export failed");
    }
  };

  const handleExportSnapshot = async () => {
    if (!analyticsRef.current) return;

    try {
      toast.loading("Generating analytics snapshot...");

      // Small delay to ensure any layout/animations are ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(analyticsRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        filter: (node) => {
          if (node.classList && node.classList.contains("snapshot-ignore")) {
            return false;
          }
          return true;
        },
      });

      saveAs(
        dataUrl,
        `snapshot_${session.topic.replace(/[^a-z0-9]/gi, "_")}.png`,
      );
      toast.dismiss();
      toast.success("Snapshot saved successfully!");
    } catch (error) {
      console.error("Snapshot capture failed:", error);
      toast.dismiss();
      toast.error("Failed to capture snapshot");
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Calculating live analytics...</p>
      </div>
    );
  }

  if (!stats || stats.totalResponses === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {session.status === "active"
            ? "No statistics compiled yet for this active session."
            : "No analytics data available for this session."}
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" /> Back to Sessions
          </Button>
          {session.status === "active" && (
            <Button
              variant="default"
              size="lg"
              className="gap-2"
              onClick={handleCompile}
              disabled={loading}
            >
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /> Compile Stats
            </Button>
          )}
        </div>
      </div>
    );
  }

  const loadMoreStep = 25;

  const learnedToShow = filteredTopicsLearned.slice(0, learnedLimit);
  const futureToShow = filteredFutureTopics.slice(0, futureLimit);

  const ratingColors = {
    5: "#10b981", // Emerald
    4: "#3b82f6", // Blue
    3: "#f59e0b", // Amber
    2: "#f97316", // Orange
    1: "#ef4444", // Rose
  };

  const totalRatingVotes = Object.values(stats.ratingDistribution || {}).reduce(
    (sum, count) => sum + (Number(count) || 0),
    0,
  );

  // Prepare chart data - all ratings for bar chart (including zeros)
  const ratingDataAll = Object.entries(stats.ratingDistribution || {}).map(
    ([rating, count]) => {
      const rNum = parseInt(rating);
      const percentage =
        totalRatingVotes > 0
          ? ((count / totalRatingVotes) * 100).toFixed(1)
          : "0.0";
      return {
        name: `${rating} Star`,
        value: count,
        rating: rNum,
        percentage,
        color: ratingColors[rNum] || "#64748b",
      };
    },
  );

  // State for hovered bar in Rating Distribution chart
  const [hoveredBarRating, setHoveredBarRating] = useState(null);
  // State for hovered slice in Rating Breakdown Donut chart
  const [hoveredDonutRating, setHoveredDonutRating] = useState(null);

  // Maximum value for domain scaling with label clearance
  const maxRatingCount = useMemo(() => {
    return Math.max(...ratingDataAll.map((d) => d.value || 0), 1);
  }, [ratingDataAll]);

  // Filtered data for pie chart (exclude zeros)
  const ratingDataFiltered = ratingDataAll.filter((item) => item.value > 0);

  // Prepare radar chart data from category averages
  const categoryLabels = {
    knowledge: "Knowledge",
    communication: "Communication",
    engagement: "Engagement",
    content: "Content",
    delivery: "Delivery",
    overall: "Overall",
  };

  const radarData = Object.entries(stats.categoryAverages || {}).map(
    ([key, value]) => ({
      category: categoryLabels[key] || key,
      score: value,
      fullMark: 5,
    }),
  );

  return (
    <div className="space-y-4 p-2 bg-background" ref={analyticsRef}>
      {/* Top Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-primary/5 print:hidden h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4 text-primary" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                {session.topic}
              </h1>
              {session.status === "active" && (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 animate-pulse flex items-center gap-1 h-5 text-[10px] px-1.5 py-0 font-medium"
                >
                  <div className="h-1 w-1 rounded-full bg-green-500" />
                  Live
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{session.collegeName}</span>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="font-semibold text-primary">
                  {activeTrainers.length > 0
                    ? activeTrainers.join(", ")
                    : (session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : [])).map(t => t.name).join(", ") || "Trainer not assigned"}
                </span>
              </div>
              {session.domain && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>{session.domain}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap snapshot-ignore">
          {/* Trainer Filter Dropdown (Only shows trainers who have > 0 reviews) */}
          {activeSessionTrainers.length > 0 && (
            <div className="flex items-center gap-1">
              <Select
                value={selectedTrainer}
                onValueChange={(val) => setSelectedTrainer(val)}
              >
                <SelectTrigger className="h-7 text-xs font-semibold bg-white border-slate-200 min-w-[170px] max-w-[260px] shadow-2xs">
                  <User className="h-3.5 w-3.5 text-indigo-600 mr-1 shrink-0" />
                  <SelectValue placeholder="Select Trainer" />
                </SelectTrigger>
                <SelectContent>
                  {activeSessionTrainers.length > 1 && (
                    <SelectItem value="all" className="text-xs font-semibold">
                      All Trainers ({liveResponses.length} Submissions)
                    </SelectItem>
                  )}
                  {activeSessionTrainers.map((t) => (
                    <SelectItem key={t.name} value={t.name} className="text-xs font-medium">
                      {t.name} {trainerResponseCounts[t.name] !== undefined ? `(${trainerResponseCounts[t.name]} reviews)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {session.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompile}
              className="gap-1 h-7 text-[13px] px-2 font-medium"
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Compile Stats
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1 h-7 text-[13px] px-2 font-medium"
          >
            <Download className="h-3 w-3" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSnapshot}
            className="gap-1 h-7 text-[13px] px-2 font-medium"
          >
            <Camera className="h-3 w-3" /> Snapshot
          </Button>
        </div>
      </div>

      {/* Advanced Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Overall Rating */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Overall Rating
                </p>
                <h3 className="text-xl font-bold text-primary mt-1">
                  {stats.avgRating.toFixed(2)}
                </h3>
              </div>
              <div
                className="p-1.5 rounded-full"
                style={{
                  backgroundColor: getDynamicColor(stats.avgRating)
                    .replace("hsl", "hsla")
                    .replace(")", ", 0.1)"),
                }}
              >
                <Star
                  className="h-4 w-4"
                  style={{
                    fill: getDynamicColor(stats.avgRating),
                    color: getDynamicColor(stats.avgRating),
                  }}
                />
              </div>
            </div>
            <div
              className="mt-2 h-1 w-full rounded-full overflow-hidden"
              style={{
                backgroundColor: getDynamicColor(stats.avgRating)
                  .replace("hsl", "hsla")
                  .replace(")", ", 0.1)"),
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(parseFloat(stats.avgRating) / 5) * 100}%`,
                  backgroundColor: getDynamicColor(stats.avgRating),
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Total Responses */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Total Responses
                </p>
                <h3 className="text-xl font-bold text-blue-600 mt-1">
                  {stats.totalResponses}
                </h3>
              </div>
              <div className="bg-blue-500/10 p-1.5 rounded-full">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Student submissions
            </p>
          </CardContent>
        </Card>

        {/* Top Rating */}
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Top Rating
                </p>
                <h3 className="text-xl font-bold text-green-600 mt-1">
                  {stats.topRating.toFixed(2)}
                </h3>
              </div>
              <div className="bg-green-500/10 p-1.5 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Highest score</p>
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="bg-cyan-500/5 border-cyan-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Content Quality
                </p>
                <h3 className="text-xl font-bold text-cyan-600 mt-1">
                  {(stats.categoryAverages?.content || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-cyan-500/10 p-1.5 rounded-full">
                <MessageSquare className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Subject relevance</p>
          </CardContent>
        </Card>

        {/* Knowledge */}
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Knowledge
                </p>
                <h3 className="text-xl font-bold text-amber-600 mt-1">
                  {(stats.categoryAverages?.knowledge || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-amber-500/10 p-1.5 rounded-full">
                <User className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Expertise of trainer</p>
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Engagement
                </p>
                <h3 className="text-xl font-bold text-purple-600 mt-1">
                  {(stats.categoryAverages?.engagement || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-purple-500/10 p-1.5 rounded-full">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Student involvement</p>
          </CardContent>
        </Card>

        {/* Communication */}
        <Card className="bg-pink-500/5 border-pink-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Communication
                </p>
                <h3 className="text-xl font-bold text-pink-600 mt-1">
                  {(stats.categoryAverages?.communication || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-pink-500/10 p-1.5 rounded-full">
                <MessageSquare className="h-4 w-4 text-pink-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Clarity & delivery</p>
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card className="bg-indigo-500/5 border-indigo-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Delivery
                </p>
                <h3 className="text-xl font-bold text-indigo-600 mt-1">
                  {(stats.categoryAverages?.delivery || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-indigo-500/10 p-1.5 rounded-full">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Presentation skills</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Rating Distribution (BarChart with Interactive Numbers) */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">
              Rating Distribution
            </CardTitle>
            <CardDescription className="text-[10px]">
              Response count per rating level
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={`bar-${selectedTrainer}-${filteredResponses.length}`}
                  data={ratingDataAll}
                  layout="vertical"
                  margin={{ top: 2, right: 38, left: -4, bottom: 2 }}
                  onMouseMove={(state) => {
                    if (state?.isTooltipActive && state?.activePayload?.length) {
                      setHoveredBarRating(state.activePayload[0].payload.rating);
                    } else {
                      setHoveredBarRating(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredBarRating(null)}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="hsl(var(--muted-foreground)/0.1)"
                  />
                  <XAxis
                    type="number"
                    domain={[0, Math.ceil(maxRatingCount * 1.2)]}
                    hide
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-lg text-xs space-y-0.5">
                            <p
                              className="font-bold flex items-center gap-1.5"
                              style={{ color: item.color }}
                            >
                              <Star className="h-3 w-3 fill-current" />
                              {item.name}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-800">
                              {item.value} responses ({item.percentage}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                    onMouseEnter={(entry) => setHoveredBarRating(entry.rating)}
                    onMouseLeave={() => setHoveredBarRating(null)}
                  >
                    {ratingDataAll.map((entry, index) => {
                      const isHovered = hoveredBarRating === entry.rating;
                      const isAnyHovered = hoveredBarRating !== null;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.rating === 5
                              ? "#22c55e"
                              : entry.rating === 4
                                ? "#84cc16"
                                : entry.rating === 3
                                  ? "#eab308"
                                  : entry.rating === 2
                                    ? "#f97316"
                                    : "#ef4444"
                          }
                          opacity={isAnyHovered ? (isHovered ? 1 : 0.38) : 1}
                          className="transition-opacity duration-150 cursor-pointer"
                        />
                      );
                    })}
                    <LabelList
                      dataKey="value"
                      position="right"
                      content={(props) => {
                        const { x, y, width, height, value, index } = props;
                        const entry = ratingDataAll[index];
                        if (!entry) return null;

                        const isHovered = hoveredBarRating === entry.rating;
                        const isAnyHovered = hoveredBarRating !== null;

                        // When any bar is hovered, hide other numbers so ONLY the hovered bar is visible
                        if (isAnyHovered && !isHovered) {
                          return null;
                        }

                        return (
                          <text
                            x={x + width + 8}
                            y={y + height / 2 + 3.5}
                            fill={isHovered ? entry.color : "#64748b"}
                            fontSize={isHovered ? "11px" : "10px"}
                            fontWeight={isHovered ? "800" : "600"}
                            className="transition-all duration-150 select-none"
                          >
                            {value}
                            {isHovered && (
                              <tspan
                                dx="4"
                                fontSize="9px"
                                fontWeight="500"
                                fill="#94a3b8"
                              >
                                ({entry.percentage}%)
                              </tspan>
                            )}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Performance (RadarChart) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">
              Category Scores
            </CardTitle>
            <CardDescription className="text-[10px]">
              Metrics breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    key={`radar-${selectedTrainer}-${filteredResponses.length}`}
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={radarData}
                  >
                    <PolarGrid stroke="hsl(var(--muted-foreground)/0.2)" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={(props) => {
                        const { payload, x, y, textAnchor, index } = props;
                        const categoryData = radarData[index];
                        if (categoryData) {
                          const isBottom = y > 80;
                          return (
                            <g>
                              <text
                                x={x}
                                y={isBottom ? y + 10 : y - 10}
                                textAnchor={textAnchor}
                                fill="hsl(var(--foreground))"
                                fontSize={9}
                              >
                                {payload.value}
                              </text>
                              <text
                                x={x}
                                y={isBottom ? y + 20 : y - 1}
                                textAnchor={textAnchor}
                                fill="hsl(215, 85%, 65%)"
                                fontSize={10}
                                fontWeight="bold"
                              >
                                {categoryData.score.toFixed(1)}
                              </text>
                            </g>
                          );
                        }
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor={textAnchor}
                            fill="hsl(var(--muted-foreground))"
                            fontSize={9}
                          >
                            {payload.value}
                          </text>
                        );
                      }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 5]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(215, 85%, 65%)"
                      fill="hsl(215, 85%, 65%)"
                      fillOpacity={0.25}
                    />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[13px] font-medium">
                  No category data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rating Breakdown (Donut Chart with Dynamic Center Highlight & Legend Sync) */}
        <Card className="lg:col-span-3 flex flex-col justify-between">
          <CardHeader className="pb-1 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[13px] font-medium">
                  Rating Breakdown
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Percentage share by star
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0 h-4 bg-slate-50 text-slate-700">
                {stats.totalResponses} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2 flex-1 flex flex-col justify-center">
            {ratingDataFiltered.length > 0 ? (
              <div className="flex items-center justify-between gap-1.5">
                {/* Left: Donut Chart with Dynamic Center Highlight (No Obstructing Tooltip) */}
                <div className="relative h-[135px] w-[130px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart key={`pie-${selectedTrainer}-${filteredResponses.length}`}>
                      <Pie
                        data={ratingDataFiltered}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={52}
                        paddingAngle={2.5}
                        dataKey="value"
                        onMouseEnter={(_, index) =>
                          setHoveredDonutRating(ratingDataFiltered[index])
                        }
                        onMouseLeave={() => setHoveredDonutRating(null)}
                      >
                        {ratingDataFiltered.map((entry) => {
                          const isHovered =
                            hoveredDonutRating?.rating === entry.rating;
                          const isAnyHovered = hoveredDonutRating !== null;
                          return (
                            <Cell
                              key={`cell-${entry.rating}`}
                              fill={entry.color}
                              stroke="#ffffff"
                              strokeWidth={isHovered ? 2.5 : 1.5}
                              opacity={isAnyHovered ? (isHovered ? 1 : 0.35) : 1}
                              className="transition-all duration-150 cursor-pointer"
                            />
                          );
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Score Overlay - Seamlessly switches to Hovered Slice Details */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-150">
                    {hoveredDonutRating ? (
                      <>
                        <span
                          className="text-xs font-black leading-none animate-in zoom-in-95 duration-100"
                          style={{ color: hoveredDonutRating.color }}
                        >
                          {hoveredDonutRating.percentage}%
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 mt-0.5 truncate max-w-[55px]">
                          {hoveredDonutRating.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-extrabold text-slate-800 leading-none">
                          {stats.avgRating.toFixed(2)}
                        </span>
                        <span className="text-[8px] text-slate-400 font-semibold mt-0.5">
                          Avg ★
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Interactive Legend with Percentages & Exact Counts */}
                <div className="flex-1 space-y-0.5 min-w-0 pr-0.5">
                  {ratingDataFiltered
                    .slice()
                    .sort((a, b) => b.rating - a.rating)
                    .map((item) => {
                      const isHovered =
                        hoveredDonutRating?.rating === item.rating;
                      const isAnyHovered = hoveredDonutRating !== null;
                      return (
                        <div
                          key={item.rating}
                          onMouseEnter={() => setHoveredDonutRating(item)}
                          onMouseLeave={() => setHoveredDonutRating(null)}
                          className={cn(
                            "flex items-center justify-between text-[10px] leading-tight py-0.5 px-1 rounded transition-all cursor-pointer",
                            isHovered
                              ? "bg-slate-100 font-bold scale-[1.02] shadow-2xs"
                              : "hover:bg-slate-50",
                            isAnyHovered && !isHovered && "opacity-40",
                          )}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 transition-transform"
                              style={{
                                backgroundColor: item.color,
                                transform: isHovered ? "scale(1.25)" : "scale(1)",
                              }}
                            />
                            <span
                              className={cn(
                                "font-semibold truncate",
                                isHovered ? "text-slate-900" : "text-slate-700",
                              )}
                            >
                              {item.rating}★
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={cn(
                                "font-bold",
                                isHovered ? "text-slate-950" : "text-slate-800",
                              )}
                            >
                              {item.percentage}%
                            </span>
                            <span className="text-[8.5px] text-slate-400">
                              ({item.value})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[135px] text-muted-foreground text-[13px] font-medium">
                No distribution data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Date-Wise Feedback Trend (Submission Volume & Avg Rating) */}
      {dateWiseTrend.length > 0 && (
        <Card className="border border-slate-200/90 shadow-xs bg-white overflow-hidden rounded-xl">
          <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/15">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-[13px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  Daily Response Velocity & Satisfaction Trend
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Day-by-day submission pace and rating trajectory across active dates
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Interactive View Mode Switcher */}
              <div className="flex items-center bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setTrendViewMode("area")}
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-all ${
                    trendViewMode === "area"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Activity className="h-3 w-3" /> Wave
                </button>
                <button
                  type="button"
                  onClick={() => setTrendViewMode("bar")}
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-all ${
                    trendViewMode === "bar"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BarChart3 className="h-3 w-3" /> Columns
                </button>
              </div>

              {/* Legend Badges */}
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium pl-1 border-l border-slate-200">
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                  Submissions
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100" />
                  Avg Rating
                </span>
              </div>
            </div>
          </CardHeader>

          {/* Quick Metrics Bar */}
          {trendMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-2 bg-slate-50/30 border-b border-slate-100">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-600 truncate">Duration</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{trendMetrics.totalDays} Active Days</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
                <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-600 truncate">Total Volume</p>
                  <p className="text-xs font-bold text-blue-600 truncate">{trendMetrics.totalSubmissions} Feedback</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-600 truncate">Daily Pace</p>
                  <p className="text-xs font-bold text-indigo-600 truncate">~{trendMetrics.avgDaily} / day</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-600 truncate">Peak Submissions</p>
                  <p className="text-xs font-bold text-amber-700 truncate">{trendMetrics.peakDay}</p>
                </div>
              </div>
            </div>
          )}

          <CardContent className="pt-3 pb-2 px-3 sm:px-4">
            <div className="h-[185px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  key={`trend-${selectedTrainer}-${filteredResponses.length}`}
                  data={dateWiseTrend}
                  margin={{ top: 8, right: 10, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sessionAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="sessionBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="#f1f5f9"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    dy={4}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[trendMetrics?.ratingMin ?? 3.5, 5]}
                    ticks={trendMetrics?.ratingTicks || [3.5, 4.0, 4.5, 5.0]}
                    tick={{ fontSize: 10, fill: "#d97706", fontWeight: 600 }}
                    tickFormatter={(val) => `${Number(val).toFixed(1)}★`}
                    axisLine={false}
                    tickLine={false}
                  />

                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-slate-200/90 text-xs space-y-1.5 min-w-[180px]">
                            <p className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-blue-600" />
                              {data.fullDate || data.date}
                            </p>
                            <div className="flex items-center justify-between gap-3 pt-0.5">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Submissions:
                              </span>
                              <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                                {data.responses} students
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Satisfaction:
                              </span>
                              <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                {data.avgRating > 0 ? data.avgRating.toFixed(2) : "N/A"}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {trendViewMode === "area" ? (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="responses"
                      name="Submissions"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fill="url(#sessionAreaGrad)"
                      activeDot={{ r: 5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  ) : (
                    <Bar
                      yAxisId="left"
                      dataKey="responses"
                      name="Submissions"
                      fill="url(#sessionBarGrad)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                  )}

                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgRating"
                    name="Avg Rating"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#ffffff", stroke: "#f59e0b", strokeWidth: 2 }}
                    activeDot={{ r: 5.5, fill: "#f59e0b" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Lower Layout: Comments & Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Student Comments */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[13px] font-medium">
                Student Comments
              </CardTitle>
              <CardDescription className="text-[10px]">
                Feedback by rating level
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1 bg-secondary text-secondary-foreground">
              {stats.totalResponses} Total
            </Badge>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <Tabs defaultValue="top" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-7 p-0.5 bg-muted rounded-md mb-2">
                <TabsTrigger value="top" className="text-[11px] font-medium py-1">
                  Top ({stats.topComments?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="average" className="text-[11px] font-medium py-1">
                  Average ({stats.avgComments?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="improvement" className="text-[11px] font-medium py-1">
                  Areas of Imp ({stats.leastRatedComments?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="top" className="mt-0">
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(stats.topComments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No top comments available
                    </p>
                  ) : (
                    stats.topComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border/60 bg-card/50 relative hover:border-primary/20 transition-colors"
                      >
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-xs italic pr-8 text-foreground leading-normal">
                          "{c.text}"
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {c.avgRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="average" className="mt-0">
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(stats.avgComments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No average comments available
                    </p>
                  ) : (
                    stats.avgComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border/60 bg-card/50 relative hover:border-primary/20 transition-colors"
                      >
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-xs italic pr-8 text-foreground leading-normal">
                          "{c.text}"
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {c.avgRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="improvement" className="mt-0">
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(stats.leastRatedComments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No improvement areas recorded
                    </p>
                  ) : (
                    stats.leastRatedComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border/60 bg-card/50 relative hover:border-primary/20 transition-colors"
                      >
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-xs italic pr-8 text-foreground leading-normal">
                          "{c.text}"
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {c.avgRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Session Topics */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[13px] font-medium">
                Topics & Suggestions
              </CardTitle>
              <CardDescription className="text-[10px]">
                Topics covered and future requests
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <Tabs defaultValue="learned" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-7 p-0.5 bg-muted rounded-md mb-2">
                <TabsTrigger value="learned" className="text-[11px] font-medium py-1">Learned</TabsTrigger>
                <TabsTrigger value="future" className="text-[11px] font-medium py-1">Future</TabsTrigger>
                <TabsTrigger value="trainers" className="text-[11px] font-medium py-1">Trainers ({activeTrainers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="learned" className="mt-0">
                <div className="max-h-[160px] overflow-y-auto pr-1">
                  {filteredTopicsLearned.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5 p-1">
                        <TooltipProvider>
                          {learnedToShow.map((topic, idx) => (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-xs font-semibold hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all cursor-default shadow-sm hover:shadow-md">
                                  <div className="flex items-center justify-center bg-white/80 group-hover:bg-amber-500 group-hover:text-white rounded px-1 min-w-[16px] h-4 text-[9px] border border-amber-200/50 transition-colors">
                                    {topic.count}
                                  </div>
                                  {topic.name || topic.text}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-semibold text-[10px]">
                                  {topic.count} Student Mentions
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </TooltipProvider>
                      </div>

                      {filteredTopicsLearned.length > learnedLimit && (
                        <div className="flex justify-center mt-2">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px] font-medium"
                            onClick={() =>
                              setLearnedLimit((v) =>
                                Math.min(
                                  v + loadMoreStep,
                                  filteredTopicsLearned.length,
                                ),
                              )
                            }
                          >
                            Load{" "}
                            {Math.min(
                              loadMoreStep,
                              filteredTopicsLearned.length - learnedLimit,
                            )}{" "}
                            more
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs italic">
                      No topics recorded yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="future" className="mt-0">
                <div className="max-h-[160px] overflow-y-auto pr-1">
                  {filteredFutureTopics.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5 p-1">
                        {futureToShow.map((topic, idx) => {
                          const label = topic.text || topic.name || "";
                          return (
                            <div
                              key={idx}
                              className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all cursor-default shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center justify-center bg-white/80 group-hover:bg-blue-500 group-hover:text-white rounded px-1 min-w-[16px] h-4 text-[9px] border border-blue-200/50 transition-colors">
                                {topic.count}
                              </div>
                              <Sparkles className="h-3 w-3 opacity-70 group-hover:animate-pulse" />
                              {label}
                            </div>
                          );
                        })}
                      </div>

                      {filteredFutureTopics.length > futureLimit && (
                        <div className="flex justify-center mt-2">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px] font-medium"
                            onClick={() =>
                              setFutureLimit((v) =>
                                Math.min(
                                  v + loadMoreStep,
                                  filteredFutureTopics.length,
                                ),
                              )
                            }
                          >
                            Load{" "}
                            {Math.min(
                              loadMoreStep,
                              filteredFutureTopics.length - futureLimit,
                            )}{" "}
                            more
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs italic">
                      No future topics suggested yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trainers" className="mt-0">
                <div className="max-h-[160px] overflow-y-auto pr-1">
                  {activeTrainers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-1">
                      {activeTrainers.map((trainerName, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shadow-sm hover:shadow-md transition-all cursor-default"
                        >
                          <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold animate-pulse">
                            {trainerName[0]?.toUpperCase() || "?"}
                          </div>
                          <span>{trainerName}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-xs italic">
                      No trainers have received feedback responses yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SessionAnalytics;
