import React, { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Users,
  Star,
  TrendingUp,
  ClipboardList,
  Calendar,
  Filter,
  RotateCcw,
  MessageSquare,
  ArrowLeft,
  Loader2,
  BookOpen,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  User,
  ThumbsUp,
  ThumbsDown,
  Printer,
  Search,
  Award,
  Layers,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import { getSessionsByTrainer } from "@/services/superadmin/sessionService";
import { getResponseTrendData } from "@/services/superadmin/responseService";
import { resolveTrainerStatsFromSession } from "@/services/superadmin/trainerService";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";

// Semantic colors for rating distribution (5 Star down to 1 Star)
const RATING_COLORS = {
  5: "#10b981", // Emerald
  4: "#06b6d4", // Cyan/Teal
  3: "#f59e0b", // Amber
  2: "#f97316", // Orange
  1: "#ef4444", // Rose/Red
};

const CATEGORY_NAMES = {
  knowledge: "Knowledge",
  communication: "Communication",
  delivery: "Delivery",
  engagement: "Engagement",
  content: "Content Quality",
  overall: "Overall",
};

const cleanCommentText = (rawText) => {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.trim();
  text = text.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  text = text.replace(
    /\b(pls|please|plz|pleeease|pleaseee)\b(\s+\b(pls|please|plz|pleeease|pleaseee)\b){2,}/gi,
    "please"
  );
  text = text.replace(/([!?.]){3,}/g, "$1$1");
  return text;
};

const blankSegmentStats = {
  totalResponses: 0,
  avgRating: 0,
  ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  categoryAverages: {},
  topComments: [],
  leastRatedComments: [],
  avgComments: [],
  topicsLearned: [],
  futureTopics: [],
};

/**
 * Modern Feedback Quote Card
 */
const FeedbackQuoteCard = ({ comment, type = "positive" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const text = typeof comment === "string" ? comment : comment.text;
  const rating =
    typeof comment === "object"
      ? comment.rating || (type === "positive" ? 5 : 2)
      : type === "positive"
        ? 5
        : 2;
  const isLong = text && text.length > 150;

  const isPositive = type === "positive";
  const isFuture = type === "future";

  const borderAccent = isFuture
    ? "border-l-indigo-500 bg-indigo-500/[0.03]"
    : isPositive
      ? "border-l-emerald-500 bg-emerald-500/[0.03]"
      : "border-l-amber-500 bg-amber-500/[0.03]";

  const badgeColor = isFuture
    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
    : isPositive
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div
      className={`text-xs border border-border/70 border-l-[3px] ${borderAccent} rounded-xl p-3 transition-all space-y-1.5 shadow-2xs`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
          {isFuture ? "Future Demand" : "Student Review"}
        </span>
        {!isFuture && (
          <span
            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${badgeColor} flex items-center gap-0.5 shrink-0`}
          >
            <Star className="h-2.5 w-2.5 fill-current" />
            {Number(rating).toFixed(1)}
          </span>
        )}
      </div>

      <p
        className={`text-foreground/90 leading-relaxed text-[11.5px] ${
          !isExpanded && isLong ? "line-clamp-2" : ""
        }`}
      >
        “{text}”
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] font-semibold text-primary hover:underline block pt-0.5 cursor-pointer"
        >
          {isExpanded ? "Show less" : "Read full review"}
        </button>
      )}
    </div>
  );
};

const TrainerAnalytics = ({
  trainer,
  trainerId,
  trainerName,
  allSessions = null,
  onBack,
}) => {
  const { trainers } = useSuperAdminData();
  const currentTrainer = useMemo(() => {
    if (trainer) return trainer;
    if (trainers && trainers.length > 0) {
      const found = trainers.find(
        (t) => t.id === trainerId || t.trainer_id === trainerId
      );
      if (found) return found;
    }
    return { id: trainerId, name: trainerName };
  }, [trainer, trainerId, trainerName, trainers]);

  // Data state
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState({
    collegeId: "all",
    course: "all",
    department: "all",
    year: "all",
    batch: "all",
    dateRange: "all",
  });

  // UI state for qualitative feedback
  const [praiseLimit, setPraiseLimit] = useState(4);
  const [feedbackSearch, setFeedbackSearch] = useState("");

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      const tid = currentTrainer?.id || trainerId;
      const tcode = currentTrainer?.trainer_id || null;
      if (!tid && !tcode && !currentTrainer?.name) return;

      if (allSessions && allSessions.length > 0) {
        const matched = allSessions.filter((s) => {
          const st = resolveTrainerStatsFromSession(s, currentTrainer);
          return !!st;
        });
        setSessions(matched);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await getSessionsByTrainer(currentTrainer || tid, tcode);
        setSessions(results || []);
      } catch (error) {
        console.error("Failed to load trainer analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentTrainer, trainerId, allSessions]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.collegeId !== "all") count++;
    if (filters.course !== "all") count++;
    if (filters.department !== "all") count++;
    if (filters.year !== "all") count++;
    if (filters.batch !== "all") count++;
    if (filters.dateRange !== "all") count++;
    return count;
  }, [filters]);

  // Reset Filters
  const resetFilters = () => {
    setFilters({
      collegeId: "all",
      course: "all",
      department: "all",
      year: "all",
      batch: "all",
      dateRange: "all",
    });
  };

  // Helper: Get Date Range
  const getDateRange = (range) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate = null;

    switch (range) {
      case "7days":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30days":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90days":
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        return { startDate: null, endDate: null };
    }
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate: today };
  };

  // --- Derived Filter Options ---

  // Unique Colleges
  const availableColleges = useMemo(() => {
    const uniqueIds = [...new Set(sessions.map((s) => s.collegeId))].filter(Boolean);
    return uniqueIds.map((id) => {
      const session = sessions.find((s) => s.collegeId === id);
      return { id, name: session?.collegeName || "Unknown College" };
    });
  }, [sessions]);

  // Unique Courses
  const availableCourses = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);

    const courses = [...new Set(filtered.map((s) => s.course))].filter(Boolean);
    return courses.sort();
  }, [sessions, filters.collegeId]);

  // Unique Departments
  const availableDepartments = useMemo(() => {
    if (filters.course === "all") return [];
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);
    if (filters.course !== "all")
      filtered = filtered.filter((s) => s.course === filters.course);

    const depts = [
      ...new Set(filtered.map((s) => s.branch || s.department)),
    ].filter(Boolean);
    return depts.sort();
  }, [sessions, filters.collegeId, filters.course]);

  // Unique Years
  const availableYears = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);
    if (filters.course !== "all")
      filtered = filtered.filter((s) => s.course === filters.course);
    if (filters.department !== "all")
      filtered = filtered.filter(
        (s) => (s.branch || s.department) === filters.department
      );

    const years = [...new Set(filtered.map((s) => s.year))].filter(Boolean);
    return years.sort();
  }, [sessions, filters]);

  // Unique Batches
  const availableBatches = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);
    if (filters.course !== "all")
      filtered = filtered.filter((s) => s.course === filters.course);
    if (filters.department !== "all")
      filtered = filtered.filter(
        (s) => (s.branch || s.department) === filters.department
      );
    if (filters.year !== "all")
      filtered = filtered.filter((s) => s.year === filters.year);

    const batches = [...new Set(filtered.map((s) => s.batch))].filter(Boolean);
    return batches.sort();
  }, [sessions, filters]);

  // --- Filtered Data & Stats Aggregation ---

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const isAnalyticStatus =
        session.status === "inactive" ||
        session.status === "completed" ||
        session.status === "active";
      if (!isAnalyticStatus) return false;
      if (!session.compiledStats && !session.stats) return false;

      if (filters.collegeId !== "all" && session.collegeId !== filters.collegeId)
        return false;
      if (filters.course !== "all" && session.course !== filters.course)
        return false;
      if (
        filters.department !== "all" &&
        (session.branch || session.department) !== filters.department &&
        !(session.branches && session.branches.includes(filters.department))
      )
        return false;
      if (filters.year !== "all" && session.year !== filters.year) return false;
      if (
        filters.batch !== "all" &&
        session.batch !== filters.batch &&
        !(session.batches && session.batches.includes(filters.batch))
      )
        return false;

      if (filters.dateRange !== "all") {
        const { startDate, endDate } = getDateRange(filters.dateRange);
        if (startDate && endDate) {
          const sessionDate = new Date(session.sessionDate);
          if (sessionDate > endDate) return false;
        }
      }
      return true;
    });
  }, [sessions, filters]);

  // Unique Colleges Reached
  const uniqueCollegesCount = useMemo(() => {
    const collegesSet = new Set();
    filteredSessions.forEach((s) => {
      if (s.collegeName) collegesSet.add(s.collegeName);
      else if (s.collegeId) collegesSet.add(s.collegeId);
    });
    return collegesSet.size;
  }, [filteredSessions]);

  const aggregatedStats = useMemo(() => {
    if (filteredSessions.length === 0) {
      return {
        totalSessions: 0,
        totalResponses: 0,
        totalRatingsCount: 0,
        totalHours: 0,
        avgRating: "0.00",
        positivePercentage: "0.0",
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: {},
        qualitative: { high: [], low: [], future: [] },
      };
    }

    const stats = {
      totalResponses: 0,
      totalRatingsCount: 0,
      ratingSum: 0,
      totalHours: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryTotals: {},
      categoryCounts: {},
      qualitativeHigh: [],
      qualitativeLow: [],
      futureTopics: [],
    };

    let validSessionsCount = 0;
    filteredSessions.forEach((session) => {
      const cs = session.compiledStats || session.stats;
      if (!cs) return;

      const trainerStats = resolveTrainerStatsFromSession(session, currentTrainer);
      if (!trainerStats) return;

      validSessionsCount += 1;
      let statsToUse = trainerStats;

      if (filters.batch !== "all") {
        statsToUse = cs.byBatch?.[filters.batch] || blankSegmentStats;
      } else if (filters.department !== "all") {
        statsToUse = cs.byBranch?.[filters.department] || blankSegmentStats;
      }

      const distCount = Object.values(statsToUse.ratingDistribution || {}).reduce(
        (sum, count) => sum + (Number(count) || 0),
        0
      );
      const responses =
        Number(statsToUse.totalResponses) ||
        Number(statsToUse.responseCount) ||
        distCount ||
        0;

      stats.totalResponses += responses;
      stats.totalHours += (Number(session.sessionDuration) || 60) / 60;

      // Fast capped comments extraction
      if (statsToUse.topComments && Array.isArray(statsToUse.topComments)) {
        statsToUse.topComments.forEach((c) => {
          if (stats.qualitativeHigh.length < 30 && c && c.text) {
            stats.qualitativeHigh.push({
              text: c.text,
              rating: c.avgRating || c.rating || 5,
            });
          }
        });
      } else if (statsToUse.comments && Array.isArray(statsToUse.comments)) {
        for (const c of statsToUse.comments) {
          if (!c || !c.text) continue;
          if (c.rating >= 4 && stats.qualitativeHigh.length < 30) {
            stats.qualitativeHigh.push(c);
          } else if (c.rating <= 2 && stats.qualitativeLow.length < 30) {
            stats.qualitativeLow.push(c);
          }
          if (
            stats.qualitativeHigh.length >= 30 &&
            stats.qualitativeLow.length >= 30
          )
            break;
        }
      }

      if (
        statsToUse.leastRatedComments &&
        Array.isArray(statsToUse.leastRatedComments)
      ) {
        statsToUse.leastRatedComments.forEach((c) => {
          if (stats.qualitativeLow.length < 30 && c && c.text) {
            stats.qualitativeLow.push({
              text: c.text,
              rating: c.avgRating || c.rating || 2,
            });
          }
        });
      }

      if (statsToUse.futureTopics && Array.isArray(statsToUse.futureTopics)) {
        statsToUse.futureTopics.forEach((c) => {
          if (stats.futureTopics.length < 20 && (c.name || c.text)) {
            stats.futureTopics.push({ text: c.name || c.text, rating: 4 });
          }
        });
      }

      // Ratings & Distribution
      let ratingsInDist = 0;
      Object.entries(statsToUse.ratingDistribution || {}).forEach(([rating, count]) => {
        const numRating = Number(rating);
        const numCount = Number(count) || 0;
        if (numRating > 0 && numCount > 0) {
          stats.ratingDistribution[numRating] =
            (stats.ratingDistribution[numRating] || 0) + numCount;
          stats.ratingSum += numRating * numCount;
          stats.totalRatingsCount += numCount;
          ratingsInDist += numCount;
        }
      });

      if (ratingsInDist === 0 && statsToUse.avgRating && responses > 0) {
        const avg = Number(statsToUse.avgRating) || 0;
        stats.ratingSum += avg * responses;
        stats.totalRatingsCount += responses;
      }

      // Categories
      const catData = statsToUse.categoryAverages || statsToUse.categoryData || {};
      Object.entries(catData).forEach(([cat, val]) => {
        const normalizedCat = cat.toLowerCase();
        if (typeof val === "object" && val !== null) {
          stats.categoryTotals[normalizedCat] =
            (stats.categoryTotals[normalizedCat] || 0) + (val.sum || 0);
          stats.categoryCounts[normalizedCat] =
            (stats.categoryCounts[normalizedCat] || 0) + (val.count || 0);
        } else {
          const weight = statsToUse.totalResponses || 1;
          const numVal = Number(val) || 0;
          stats.categoryTotals[normalizedCat] =
            (stats.categoryTotals[normalizedCat] || 0) + numVal * weight;
          stats.categoryCounts[normalizedCat] =
            (stats.categoryCounts[normalizedCat] || 0) + weight;
        }
      });
    });

    const avgRatingNum =
      stats.totalRatingsCount > 0 ? stats.ratingSum / stats.totalRatingsCount : 0;
    const avgRating = avgRatingNum.toFixed(2);

    const positiveRatingsCount =
      (stats.ratingDistribution[4] || 0) + (stats.ratingDistribution[5] || 0);
    const positivePercentage =
      stats.totalRatingsCount > 0
        ? ((positiveRatingsCount / stats.totalRatingsCount) * 100).toFixed(1)
        : "0.0";

    const categoryAverages = {};
    Object.keys(CATEGORY_NAMES).forEach((cat) => {
      categoryAverages[cat] =
        stats.categoryCounts[cat] > 0
          ? Number((stats.categoryTotals[cat] / stats.categoryCounts[cat]).toFixed(2))
          : avgRatingNum > 0
            ? Number(avgRatingNum.toFixed(2))
            : 0;
    });

    // Fast single-pass deduplication
    const seenHigh = new Set();
    const uniqueHigh = [];
    for (const c of stats.qualitativeHigh) {
      if (!c || !c.text) continue;
      const clean = cleanCommentText(c.text);
      if (clean.length > 5 && !seenHigh.has(clean.toLowerCase())) {
        seenHigh.add(clean.toLowerCase());
        uniqueHigh.push({ text: clean, rating: c.rating || 5 });
        if (uniqueHigh.length >= 20) break;
      }
    }

    const seenLow = new Set();
    const uniqueLow = [];
    for (const c of stats.qualitativeLow) {
      if (!c || !c.text) continue;
      const clean = cleanCommentText(c.text);
      if (clean.length > 5 && !seenLow.has(clean.toLowerCase())) {
        seenLow.add(clean.toLowerCase());
        uniqueLow.push({ text: clean, rating: c.rating || 2 });
        if (uniqueLow.length >= 20) break;
      }
    }

    const seenFuture = new Set();
    const uniqueFuture = [];
    for (const c of stats.futureTopics) {
      if (!c || !c.text) continue;
      const clean = cleanCommentText(c.text);
      if (clean.length > 3 && !seenFuture.has(clean.toLowerCase())) {
        seenFuture.add(clean.toLowerCase());
        uniqueFuture.push({ text: clean });
        if (uniqueFuture.length >= 15) break;
      }
    }

    return {
      totalSessions: validSessionsCount,
      totalResponses: stats.totalResponses,
      totalRatingsCount: stats.totalRatingsCount,
      totalHours: Math.round(stats.totalHours * 10) / 10,
      avgRating,
      positivePercentage,
      ratingDistribution: stats.ratingDistribution,
      categoryAverages,
      qualitative: {
        high: uniqueHigh,
        low: uniqueLow,
        future: uniqueFuture,
      },
    };
  }, [filteredSessions, currentTrainer, filters]);

  // Rating Distribution chart data
  const ratingDistributionData = useMemo(() => {
    const distribution = aggregatedStats.ratingDistribution || {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    const total =
      (distribution[1] || 0) +
      (distribution[2] || 0) +
      (distribution[3] || 0) +
      (distribution[4] || 0) +
      (distribution[5] || 0) || 1;

    return [
      {
        rating: "5 Stars",
        tier: 5,
        count: distribution[5] || 0,
        pct: (((distribution[5] || 0) / total) * 100).toFixed(1),
        color: RATING_COLORS[5],
      },
      {
        rating: "4 Stars",
        tier: 4,
        count: distribution[4] || 0,
        pct: (((distribution[4] || 0) / total) * 100).toFixed(1),
        color: RATING_COLORS[4],
      },
      {
        rating: "3 Stars",
        tier: 3,
        count: distribution[3] || 0,
        pct: (((distribution[3] || 0) / total) * 100).toFixed(1),
        color: RATING_COLORS[3],
      },
      {
        rating: "2 Stars",
        tier: 2,
        count: distribution[2] || 0,
        pct: (((distribution[2] || 0) / total) * 100).toFixed(1),
        color: RATING_COLORS[2],
      },
      {
        rating: "1 Star",
        tier: 1,
        count: distribution[1] || 0,
        pct: (((distribution[1] || 0) / total) * 100).toFixed(1),
        color: RATING_COLORS[1],
      },
    ];
  }, [aggregatedStats]);

  // Radar chart data
  const categoryRadarData = useMemo(() => {
    const categories = [
      "knowledge",
      "communication",
      "delivery",
      "engagement",
      "content",
    ];
    return categories.map((key) => ({
      category: CATEGORY_NAMES[key] || key,
      score: aggregatedStats.categoryAverages[key] || 0,
      fullMark: 5,
    }));
  }, [aggregatedStats]);

  // Response Trend
  const [responseTrendData, setResponseTrendData] = useState([]);

  useEffect(() => {
    const calculateResponseTrend = async () => {
      const validSessions = sessions.filter((s) => s.id && (s.compiledStats || s.stats));
      if (validSessions.length === 0) {
        setResponseTrendData([]);
        return;
      }

      const sessionIds = validSessions.map((s) => s.id);

      try {
        const responseTrendMap = await getResponseTrendData(sessionIds);

        let trendEntries = Object.entries(responseTrendMap);
        if (filters.dateRange !== "all") {
          const { startDate, endDate } = getDateRange(filters.dateRange);
          if (startDate && endDate) {
            trendEntries = trendEntries.filter(([dateStr]) => {
              const responseDate = new Date(dateStr);
              return responseDate >= startDate && responseDate <= endDate;
            });
          }
        }

        const chartData = trendEntries
          .map(([date, responses]) => {
            const d = new Date(date);
            const formatted = !isNaN(d.getTime())
              ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : date;
            return {
              dateStr: date,
              day: formatted,
              fullDate: date,
              responses,
            };
          })
          .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
          .slice(-30);

        setResponseTrendData(chartData);
      } catch (error) {
        console.error("Error calculating response trend:", error);
        setResponseTrendData([]);
      }
    };

    calculateResponseTrend();
  }, [sessions, filters]);

  // Filtered comments based on search query
  const filteredComments = useMemo(() => {
    const query = feedbackSearch.toLowerCase().trim();
    const filterFn = (item) => !query || item.text.toLowerCase().includes(query);

    return {
      high: aggregatedStats.qualitative.high.filter(filterFn),
      low: aggregatedStats.qualitative.low.filter(filterFn),
      future: aggregatedStats.qualitative.future.filter(filterFn),
    };
  }, [aggregatedStats.qualitative, feedbackSearch]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium animate-pulse">
          Loading trainer metrics and feedback...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* 1. Hero Header & Profile Banner */}
      <div className="relative overflow-hidden bg-card border rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            {/* Back Button */}
            {onBack && (
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                className="h-9 w-9 rounded-xl shrink-0 shadow-2xs hover:bg-muted/80"
                title="Back to Trainers Directory"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            {/* Avatar */}
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 text-primary flex items-center justify-center font-bold text-lg shadow-inner shrink-0">
              <User className="h-6 w-6" />
            </div>

            {/* Trainer Identity & Metadata */}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                  {currentTrainer.name || trainerName || "Trainer"}
                </h2>
                {currentTrainer.trainer_id && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground border shrink-0 font-medium"
                  >
                    {currentTrainer.trainer_id}
                  </Badge>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Profile
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {currentTrainer.email && (
                  <span className="truncate">{currentTrainer.email}</span>
                )}
                {currentTrainer.domain && (
                  <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-primary text-primary-foreground shadow-2xs">
                    {currentTrainer.domain}
                  </span>
                )}
                {currentTrainer.specialisation && (
                  <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-secondary text-secondary-foreground border">
                    {currentTrainer.specialisation}
                  </span>
                )}
              </div>

              {/* Skills / Topics */}
              {currentTrainer.topics && currentTrainer.topics.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] font-semibold text-muted-foreground mr-1">
                    Skills:
                  </span>
                  {currentTrainer.topics.map((topic, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-medium px-1.5 py-0.2 bg-muted/80 rounded border text-muted-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 text-xs px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset ({activeFiltersCount})</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs px-3 gap-1.5 shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Snapshot</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Sleek Filter Studio */}
      <Card className="shadow-xs border rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xs">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* College */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary/70" /> College
              </Label>
              <Select
                value={filters.collegeId}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    collegeId: v,
                    course: "all",
                    department: "all",
                    year: "all",
                    batch: "all",
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background/80 shadow-2xs">
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {availableColleges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Course */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-primary/70" /> Course
              </Label>
              <Select
                value={filters.course}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    course: v,
                    department: "all",
                    year: "all",
                    batch: "all",
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background/80 shadow-2xs">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {availableCourses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary/70" /> Department
              </Label>
              <Select
                value={filters.department}
                onValueChange={(v) =>
                  setFilters({ ...filters, department: v, year: "all", batch: "all" })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background/80 shadow-2xs">
                  <SelectValue placeholder="All Depts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {availableDepartments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3 text-primary/70" /> Year
              </Label>
              <Select
                value={filters.year}
                onValueChange={(v) =>
                  setFilters({ ...filters, year: v, batch: "all" })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-background/80 shadow-2xs">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Batch */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3 text-primary/70" /> Batch
              </Label>
              <Select
                value={filters.batch}
                onValueChange={(v) => setFilters({ ...filters, batch: v })}
              >
                <SelectTrigger className="h-8 text-xs bg-background/80 shadow-2xs">
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {availableBatches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary/70" /> Range
              </Label>
              <Select
                value={filters.dateRange}
                onValueChange={(v) => setFilters({ ...filters, dateRange: v })}
              >
                <SelectTrigger className="h-8 text-xs bg-background/80 shadow-2xs">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Key Performance Indicators (5 Metric Cards Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Sessions */}
        <Card className="shadow-2xs border bg-card/80 hover:shadow-xs transition-all">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Sessions
              </span>
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {aggregatedStats.totalSessions}
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Delivered Modules
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Student Reach */}
        <Card className="shadow-2xs border bg-card/80 hover:shadow-xs transition-all">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Responses
              </span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {aggregatedStats.totalResponses.toLocaleString()}
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Student Reviews
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Rating */}
        <Card className="shadow-2xs border bg-card/80 hover:shadow-xs transition-all">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Avg Rating
              </span>
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Star className="h-4 w-4 fill-current" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                  {aggregatedStats.avgRating}
                </span>
                <span className="text-xs text-muted-foreground">/ 5.0</span>
              </div>
              <span className="inline-flex items-center text-[9.5px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20 mt-0.5">
                {aggregatedStats.positivePercentage}% Positive
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Training Hours */}
        <Card className="shadow-2xs border bg-card/80 hover:shadow-xs transition-all">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Hours
              </span>
              <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {aggregatedStats.totalHours} hrs
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Classroom Delivery
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Institutes Reached */}
        <Card className="shadow-2xs border bg-card/80 hover:shadow-xs transition-all col-span-2 sm:col-span-1">
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Institutes
              </span>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {uniqueCollegesCount}
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Colleges Reached
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Performance Trends & Category Radar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Performance Trends Area Chart */}
        <Card className="lg:col-span-2 shadow-xs border rounded-2xl overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Performance & Response Trends
              </CardTitle>
              <CardDescription className="text-xs">
                Feedback volume timeline over recent training sessions.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-3">
            <div className="h-[280px] w-full">
              {responseTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={responseTrendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="trainerTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      className="opacity-30"
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      stroke="currentColor"
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="currentColor"
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="bg-popover text-popover-foreground border rounded-xl p-2.5 shadow-md text-xs space-y-1">
                            <p className="font-bold border-b pb-1 text-[11px]">
                              {payload[0].payload.fullDate || label}
                            </p>
                            <div className="flex items-center justify-between gap-3 text-primary font-bold">
                              <span>Student Responses:</span>
                              <span className="font-mono">{payload[0].value}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="responses"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#trainerTrendGrad)"
                      dot={{ r: 3, fill: "#3b82f6", strokeWidth: 1 }}
                      activeDot={{ r: 5, fill: "#3b82f6" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-1">
                  <TrendingUp className="h-8 w-8 opacity-20" />
                  <p className="text-xs">No response timeline data available.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Skills Radar & Numerical Scorecard */}
        <Card className="shadow-xs border rounded-2xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Category Skills Scorecard
            </CardTitle>
            <CardDescription className="text-xs">
              Evaluation across 5 core teaching pillars.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-3.5 space-y-3">
            {/* Radar Chart */}
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="75%"
                  data={categoryRadarData}
                >
                  <PolarGrid stroke="currentColor" className="opacity-25" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fontSize: 9.5, fill: "currentColor" }}
                    className="text-muted-foreground font-medium"
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 5]}
                    tick={{ fontSize: 8 }}
                    stroke="currentColor"
                    className="opacity-20"
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Scorecard Table */}
            <div className="space-y-1.5 pt-1 border-t">
              {Object.entries(CATEGORY_NAMES)
                .filter(([k]) => k !== "overall")
                .map(([key, label]) => {
                  const score = aggregatedStats.categoryAverages[key] || 0;
                  const pct = (score / 5) * 100;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs gap-2"
                    >
                      <span className="text-[11px] text-muted-foreground truncate w-28">
                        {label}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[11px] text-foreground w-8 text-right">
                        {score.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Rating Breakdown & Qualitative Student Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Star Rating Distribution */}
        <Card className="shadow-xs border rounded-2xl overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Star Rating Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Feedback count and percentage across 1 to 5 star ratings.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Bar Chart */}
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ratingDistributionData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    className="opacity-30"
                  />
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const entry = payload[0].payload;
                      return (
                        <div className="bg-popover text-popover-foreground border rounded-xl p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-bold border-b pb-1 text-[11px]">{label}</p>
                          <div className="flex justify-between gap-3">
                            <span>Count:</span>
                            <span className="font-bold font-mono">
                              {entry.count.toLocaleString()} responses
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 text-muted-foreground text-[10px]">
                            <span>Share:</span>
                            <span className="font-bold font-mono">{entry.pct}%</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {ratingDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Percentage Breakdown List */}
            <div className="space-y-2 pt-2 border-t">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Distribution Breakdown
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ratingDistributionData.map((r) => (
                  <div
                    key={r.tier}
                    className="p-2 rounded-xl bg-muted/30 border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="font-medium text-foreground">
                        {r.rating}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {r.count.toLocaleString()}
                      </span>
                      <span className="text-[11px] font-bold font-mono px-1.5 py-0.2 rounded bg-background border text-foreground shadow-2xs">
                        {r.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Highlights / Positive Student Feedback */}
        <Card className="shadow-xs border rounded-2xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-3.5 pb-2.5 border-b bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Recent Highlights
              </CardTitle>
              <CardDescription className="text-[11px]">
                Student review quotes and praise highlights from recent sessions.
              </CardDescription>
            </div>

            {filteredComments.high.length > 0 && (
              <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1 w-fit shadow-2xs">
                <ThumbsUp className="h-2.5 w-2.5" /> {filteredComments.high.length} Highlights
              </span>
            )}
          </CardHeader>

          <CardContent className="p-3.5 space-y-3">
            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search highlights by keyword..."
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
                className="h-7 text-xs pl-8 bg-muted/30 shadow-2xs"
              />
            </div>

            {/* Highlights stream */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {filteredComments.high.length > 0 ? (
                <div className="space-y-1.5">
                  {filteredComments.high.slice(0, praiseLimit).map((c, i) => (
                    <FeedbackQuoteCard key={i} comment={c} type="positive" />
                  ))}

                  {filteredComments.high.length > 4 && (
                    <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        Showing {Math.min(praiseLimit, filteredComments.high.length)} of{" "}
                        {filteredComments.high.length} highlights
                      </span>
                      {praiseLimit < filteredComments.high.length ? (
                        <button
                          type="button"
                          onClick={() => setPraiseLimit((prev) => prev + 4)}
                          className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 hover:bg-primary/15 px-2 py-0.5 rounded border border-primary/20 transition-colors"
                        >
                          Load More (+4)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPraiseLimit(4)}
                          className="text-muted-foreground hover:text-foreground font-medium hover:underline cursor-pointer"
                        >
                          Show Less
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground italic text-xs border border-dashed rounded-xl">
                  {feedbackSearch
                    ? "No student highlights found matching your search."
                    : "No student praise highlights recorded for this filter selection."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrainerAnalytics;
