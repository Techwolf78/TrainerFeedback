import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import { getFeedbacksByDateRange } from "@/services/superadmin/responseService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  TrendingUp,
  Building2,
  Users,
  Star,
  Award,
  AlertTriangle,
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
  ArrowUpRight,
  CheckCircle2,
  Activity,
  Sparkles,
  ChevronRight,
  BarChart3,
  Layers,
  ShieldCheck,
  Zap,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ManagementOverviewTab() {
  const {
    sessions,
    colleges,
    trainers,
    allSessionsMap,
    loadAllSessionsMetadata,
  } = useSuperAdminData();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [statusStage, setStatusStage] = useState("Connecting to database...");
  const [isExporting, setIsExporting] = useState(false);

  // Maximum allowed date range in days for live dashboard (two full 31-day months)
  const MAX_CUSTOM_RANGE_DAYS = 62;

  // Format Helper: Get YYYY-MM-DD key (local timezone safe)
  const formatDateKey = (date) => {
    if (!date || isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDaysDiff = (d1, d2) => {
    const t1 = new Date(
      d1.getFullYear(),
      d1.getMonth(),
      d1.getDate(),
    ).getTime();
    const t2 = new Date(
      d2.getFullYear(),
      d2.getMonth(),
      d2.getDate(),
    ).getTime();
    return Math.round(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24));
  };

  // Date filter presets: last7, last30, last60, lifetime, custom
  const [preset, setPreset] = useState("last30");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  // Lifetime Warning Dialog & Stream Cancellation Ref
  const [isLifetimeWarningOpen, setIsLifetimeWarningOpen] = useState(false);
  const cancelStreamRef = useRef(false);

  // Date Picker popover state and uncommitted tempRange (prevents premature queries)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempRange, setTempRange] = useState(() => ({
    from: startDate,
    to: endDate,
  }));

  // Full view modals state
  const [isTrainersModalOpen, setIsTrainersModalOpen] = useState(false);
  const [trainerSearchQuery, setTrainerSearchQuery] = useState("");
  const [trainerTierFilter, setTrainerTierFilter] = useState("all");

  const [isCollegesModalOpen, setIsCollegesModalOpen] = useState(false);
  const [collegeSearchQuery, setCollegeSearchQuery] = useState("");
  const [collegeTierFilter, setCollegeTierFilter] = useState("all");
  const [collegeSortBy, setCollegeSortBy] = useState("volume");

  // Handle preset clicks (immediate query for standard presets, confirmation for lifetime)
  const applyPreset = (presetType) => {
    if (presetType === "lifetime") {
      setIsLifetimeWarningOpen(true);
      return;
    }

    setPreset(presetType);
    const now = new Date();
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    switch (presetType) {
      case "last7":
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case "last30":
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case "last60":
        start.setDate(now.getDate() - 60);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
    setTempRange({ from: start, to: end });
  };

  // Confirm loading lifetime dataset after user accepts warning
  const handleConfirmLifetime = () => {
    setIsLifetimeWarningOpen(false);
    setPreset("lifetime");
    setStartDate(null);
    setEndDate(null);
  };

  // Explicit Apply handler for Custom Date Range
  const handleApplyCustomRange = () => {
    if (!tempRange?.from || !tempRange?.to) {
      toast.error("Please select both start and end dates before applying.");
      return;
    }

    const newStart = new Date(tempRange.from);
    newStart.setHours(0, 0, 0, 0);

    const newEnd = new Date(tempRange.to);
    newEnd.setHours(23, 59, 59, 999);

    if (newStart > newEnd) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    const diffDays = getDaysDiff(newStart, newEnd) + 1;
    if (diffDays > MAX_CUSTOM_RANGE_DAYS) {
      toast.error(
        `Selected date range is ${diffDays} days. Please select a range of ${MAX_CUSTOM_RANGE_DAYS} days or fewer.`,
      );
      return;
    }

    setPreset("custom");
    setStartDate(newStart);
    setEndDate(newEnd);
    setIsDatePickerOpen(false);
  };

  // Fetch feedbacks for selected range with dynamic progress and safe batch streaming
  const fetchFeedbacks = useCallback(async () => {
    if (preset !== "lifetime" && (!startDate || !endDate)) return;
    setLoading(true);
    setLoadingProgress(10);
    setLoadedCount(0);
    cancelStreamRef.current = false;
    setStatusStage(
      preset === "lifetime"
        ? "Connecting and streaming complete historical dataset..."
        : "Querying feedback records...",
    );

    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (preset === "lifetime") {
          if (prev < 90) return prev + 0.4;
          return prev;
        }
        if (prev < 35) return prev + 5;
        if (prev < 65) return prev + 2;
        if (prev < 88) return prev + 0.8;
        return prev;
      });
    }, 120);

    try {
      let start = startDate;
      let end = endDate;

      if (preset !== "lifetime" && start && end) {
        const diffDays = getDaysDiff(start, end);
        if (diffDays > MAX_CUSTOM_RANGE_DAYS) {
          start = new Date(end);
          start.setDate(end.getDate() - MAX_CUSTOM_RANGE_DAYS);
          start.setHours(0, 0, 0, 0);
        }
      }

      const batchSize = preset === "lifetime" ? 1000 : 500;

      // Ensure all session metadata is loaded so older/lifetime sessions resolve their college info
      if (loadAllSessionsMetadata) {
        await loadAllSessionsMetadata();
      }

      const data = await getFeedbacksByDateRange(
        start,
        end,
        batchSize,
        (count) => {
          setLoadedCount(count);
          setStatusStage(`Retrieved ${count.toLocaleString()} responses...`);
          if (preset === "lifetime") {
            setLoadingProgress((prev) =>
              Math.max(prev, Math.min(94, 10 + Math.floor(count / 1500))),
            );
          } else {
            setLoadingProgress((prev) =>
              Math.max(prev, Math.min(90, 30 + Math.floor(count / 70))),
            );
          }
        },
        () => cancelStreamRef.current,
      );

      setStatusStage("Synthesizing metrics & CSAT benchmarks...");
      setLoadingProgress(96);
      await new Promise((r) => setTimeout(r, 120));
      setLoadingProgress(100);
      setFeedbacks(data || []);
    } catch (error) {
      console.error(
        "Failed to fetch feedbacks for management overview:",
        error,
      );
      toast.error("Failed to load management overview data.");
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
        setLoadedCount(0);
      }, 220);
    }
  }, [startDate, endDate, preset]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Handle PNG snapshot export
  const handleExportSnapshot = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading("Generating Management Overview snapshot...");
    try {
      await new Promise((r) => setTimeout(r, 400));
      const dataUrl = await toPng(printRef.current, {
        quality: 0.95,
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download =
        preset === "lifetime"
          ? "Management-Overview-Lifetime-All-Time.png"
          : `Management-Overview-${formatDateKey(startDate)}-to-${formatDateKey(endDate)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Executive snapshot saved successfully!", { id: toastId });
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to generate image snapshot", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Aggregation & KPI Computation Pipeline
  const analytics = useMemo(() => {
    const sessionMap = { ...(allSessionsMap || {}) };
    sessions.forEach((s) => {
      sessionMap[s.id] = s;
    });

    const collegeMap = {};
    colleges.forEach((c) => {
      collegeMap[c.id] = c;
    });

    const trainerMap = {};
    trainers.forEach((t) => {
      trainerMap[t.id] = t;
    });

    let totalRatingSum = 0;
    let totalRatingCount = 0;
    let highRatingCount = 0; // >= 4.0
    let criticalRatingCount = 0; // < 3.5

    const collegeStats = {};
    const trainerStats = {};
    const dailyMap = {};
    const sessionTrainerStats = {};
    const dailyTrainerStats = {};
    const sessionFeedbackCounts = {};

    feedbacks.forEach((f) => {
      const sessionId = f.sessionId;
      const session = sessionMap[sessionId];

      if (sessionId) {
        sessionFeedbackCounts[sessionId] =
          (sessionFeedbackCounts[sessionId] || 0) + 1;
      }

      const collegeId = f.collegeId || session?.collegeId || "unknown_college";
      const collegeName =
        collegeMap[collegeId]?.name ||
        f.collegeName ||
        session?.collegeName ||
        "Unknown College";

      const trainerId =
        f.selectedTrainerId ||
        f.trainerId ||
        session?.assignedTrainer?.id ||
        session?.assignedTrainerId ||
        "unknown_trainer";
      const trainerName =
        trainerMap[trainerId]?.name ||
        f.selectedTrainerName ||
        session?.assignedTrainer?.name ||
        "Unknown Trainer";

      // Calculate feedback average rating
      const ratingAnswers = (f.answers || []).filter((a) => {
        const type = (a.type || "").toLowerCase();
        return type === "rating" || type === "overall";
      });

      const avgRating =
        ratingAnswers.length > 0
          ? ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) /
            ratingAnswers.length
          : null;

      if (avgRating !== null) {
        totalRatingSum += avgRating;
        totalRatingCount += 1;
        if (avgRating >= 4.0) highRatingCount += 1;
        if (avgRating < 3.5) criticalRatingCount += 1;
      }

      // College Grouping
      if (!collegeStats[collegeId]) {
        collegeStats[collegeId] = {
          id: collegeId,
          name: collegeName,
          feedbackCount: 0,
          ratingSum: 0,
          ratingCount: 0,
          trainers: new Set(),
        };
      }
      collegeStats[collegeId].feedbackCount += 1;
      collegeStats[collegeId].trainers.add(trainerId);
      if (avgRating !== null) {
        collegeStats[collegeId].ratingSum += avgRating;
        collegeStats[collegeId].ratingCount += 1;
      }

      // Trainer Grouping
      if (!trainerStats[trainerId]) {
        trainerStats[trainerId] = {
          id: trainerId,
          name: trainerName,
          feedbackCount: 0,
          ratingSum: 0,
          ratingCount: 0,
          colleges: new Set(),
        };
      }
      trainerStats[trainerId].feedbackCount += 1;
      trainerStats[trainerId].colleges.add(collegeId);
      if (avgRating !== null) {
        trainerStats[trainerId].ratingSum += avgRating;
        trainerStats[trainerId].ratingCount += 1;
      }

      // Daily trend mapping
      let fDate;
      let dateKey = "";
      if (f.submittedAt?.toDate) fDate = f.submittedAt.toDate();
      else if (f.submittedAt) fDate = new Date(f.submittedAt);

      if (fDate && !isNaN(fDate.getTime())) {
        dateKey = formatDateKey(fDate);
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = {
            date: dateKey,
            responses: 0,
            ratingSum: 0,
            ratingCount: 0,
          };
        }
        dailyMap[dateKey].responses += 1;
        if (avgRating !== null) {
          dailyMap[dateKey].ratingSum += avgRating;
          dailyMap[dateKey].ratingCount += 1;
        }
      }

      const displayDate =
        dateKey ||
        (fDate
          ? formatDateKey(fDate)
          : session?.sessionDate || session?.date || "N/A");

      // 1. Group by session-trainer-day to catch day-specific issues
      const dateTrainerKey = `${sessionId || "no_session"}__${trainerId || "no_trainer"}__${displayDate}`;
      if (!dailyTrainerStats[dateTrainerKey]) {
        dailyTrainerStats[dateTrainerKey] = {
          id: dateTrainerKey,
          sessionId: sessionId || "",
          sessionTitle:
            session?.sessionTopic ||
            session?.topic ||
            f.sessionTopic ||
            f.topic ||
            "Untitled Session",
          collegeName,
          trainerName,
          date: displayDate,
          ratingSum: 0,
          ratingCount: 0,
          responseCount: 0,
        };
      }
      dailyTrainerStats[dateTrainerKey].responseCount += 1;
      if (avgRating !== null) {
        dailyTrainerStats[dateTrainerKey].ratingSum += avgRating;
        dailyTrainerStats[dateTrainerKey].ratingCount += 1;
      }

      // 2. Group by session-trainer for overall session stats
      const sessionTrainerKey = `${sessionId || "no_session"}__${trainerId || "no_trainer"}`;
      if (!sessionTrainerStats[sessionTrainerKey]) {
        sessionTrainerStats[sessionTrainerKey] = {
          id: sessionTrainerKey,
          sessionId: sessionId || "",
          sessionTitle:
            session?.sessionTopic ||
            session?.topic ||
            f.sessionTopic ||
            f.topic ||
            "Untitled Session",
          collegeName,
          trainerName,
          date: displayDate,
          ratingSum: 0,
          ratingCount: 0,
          responseCount: 0,
        };
      }
      sessionTrainerStats[sessionTrainerKey].responseCount += 1;
      if (avgRating !== null) {
        sessionTrainerStats[sessionTrainerKey].ratingSum += avgRating;
        sessionTrainerStats[sessionTrainerKey].ratingCount += 1;
      }
    });

    // Flag legitimately low-rated days/sessions (< 3.8★ avg with at least 5 responses to avoid rogue single-submission false alerts)
    const lowRatedDailyIncidents = Object.values(dailyTrainerStats)
      .filter((item) => item.ratingCount > 0 && item.responseCount >= 5)
      .map((item) => ({
        ...item,
        sessionResponseCount: item.responseCount,
        rating: Number((item.ratingSum / item.ratingCount).toFixed(2)),
      }))
      .filter((item) => item.rating < 3.8);

    const lowRatedOverallSessions = Object.values(sessionTrainerStats)
      .filter((item) => item.ratingCount > 0 && item.responseCount >= 5)
      .map((item) => ({
        ...item,
        sessionResponseCount: item.responseCount,
        rating: Number((item.ratingSum / item.ratingCount).toFixed(2)),
      }))
      .filter((item) => item.rating < 3.8);

    // Combine and deduplicate flagged items
    const flaggedMap = new Map();
    [...lowRatedDailyIncidents, ...lowRatedOverallSessions].forEach((item) => {
      if (!flaggedMap.has(item.id)) {
        flaggedMap.set(item.id, item);
      }
    });

    const lowRatedSessions = Array.from(flaggedMap.values()).sort(
      (a, b) => a.rating - b.rating,
    );

    const overallAvgRating =
      totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0;
    const satisfactionRate =
      totalRatingCount > 0 ? (highRatingCount / totalRatingCount) * 100 : 0;

    // Convert colleges to sorted array
    const sortedColleges = Object.values(collegeStats)
      .map((c) => ({
        ...c,
        avgRating: c.ratingCount > 0 ? c.ratingSum / c.ratingCount : 0,
        trainerCount: c.trainers.size,
      }))
      .sort((a, b) => b.feedbackCount - a.feedbackCount);

    // Convert trainers to sorted array
    const sortedTrainers = Object.values(trainerStats)
      .map((t) => ({
        ...t,
        avgRating: t.ratingCount > 0 ? t.ratingSum / t.ratingCount : 0,
        collegeCount: t.colleges.size,
      }))
      .sort((a, b) => b.feedbackCount - a.feedbackCount);

    // Trainer Performance Tiers
    const starTrainers = sortedTrainers.filter((t) => t.avgRating >= 4.5);
    const goodTrainers = sortedTrainers.filter(
      (t) => t.avgRating >= 3.8 && t.avgRating < 4.5,
    );
    const attentionTrainers = sortedTrainers.filter(
      (t) => t.avgRating < 3.8 && t.ratingCount > 0,
    );

    const tierData = [
      {
        name: "Excellence (4.5 - 5.0)",
        value: starTrainers.length,
        color: "#10b981",
        barBg: "bg-emerald-500",
      },
      {
        name: "Proficient (3.8 - 4.49)",
        value: goodTrainers.length,
        color: "#3b82f6",
        barBg: "bg-blue-500",
      },
      {
        name: "Needs Attention (< 3.8)",
        value: attentionTrainers.length,
        color: "#f43f5e",
        barBg: "bg-rose-500",
      },
    ];

    // Sorted Daily Timeline Data
    const trendData = Object.keys(dailyMap)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => ({
        date: k.slice(5), // MM-DD
        fullDate: k,
        responses: dailyMap[k].responses,
        avgRating:
          dailyMap[k].ratingCount > 0
            ? Number(
                (dailyMap[k].ratingSum / dailyMap[k].ratingCount).toFixed(2),
              )
            : null,
      }));

    // College Performance Breakdown
    const starColleges = sortedColleges.filter((c) => c.avgRating >= 4.5);
    const goodColleges = sortedColleges.filter(
      (c) => c.avgRating >= 3.8 && c.avgRating < 4.5,
    );
    const attentionColleges = sortedColleges.filter(
      (c) => c.avgRating < 3.8 && c.ratingCount > 0,
    );

    return {
      totalResponses: feedbacks.length,
      overallAvgRating,
      satisfactionRate,
      activeCollegesCount: sortedColleges.length,
      activeTrainersCount: sortedTrainers.length,
      colleges: sortedColleges,
      trainers: sortedTrainers,
      topTrainers: sortedTrainers.slice(0, 5),
      topColleges: sortedColleges.slice(0, 5),
      tierData,
      starCollegesCount: starColleges.length,
      goodCollegesCount: goodColleges.length,
      attentionCollegesCount: attentionColleges.length,
      trendData,
      lowRatedSessions: lowRatedSessions.slice(0, 8),
      criticalCount: criticalRatingCount,
    };
  }, [feedbacks, sessions, colleges, trainers, allSessionsMap]);

  // Filtered trainers for the "View All" Leaderboard Modal
  const modalFilteredTrainers = useMemo(() => {
    if (!analytics.trainers) return [];
    return analytics.trainers.filter((t) => {
      const matchesSearch =
        !trainerSearchQuery.trim() ||
        t.name?.toLowerCase().includes(trainerSearchQuery.toLowerCase().trim());

      let matchesTier = true;
      if (trainerTierFilter === "star") matchesTier = t.avgRating >= 4.5;
      else if (trainerTierFilter === "good")
        matchesTier = t.avgRating >= 3.8 && t.avgRating < 4.5;
      else if (trainerTierFilter === "attention")
        matchesTier = t.avgRating < 3.8;

      return matchesSearch && matchesTier;
    });
  }, [analytics.trainers, trainerSearchQuery, trainerTierFilter]);

  // Filtered colleges for the "View All" Colleges Modal
  const modalFilteredColleges = useMemo(() => {
    if (!analytics.colleges) return [];
    let list = analytics.colleges.filter((c) => {
      const matchesSearch =
        !collegeSearchQuery.trim() ||
        c.name?.toLowerCase().includes(collegeSearchQuery.toLowerCase().trim());

      let matchesTier = true;
      if (collegeTierFilter === "star") matchesTier = c.avgRating >= 4.5;
      else if (collegeTierFilter === "good")
        matchesTier = c.avgRating >= 3.8 && c.avgRating < 4.5;
      else if (collegeTierFilter === "attention")
        matchesTier = c.avgRating < 3.8;

      return matchesSearch && matchesTier;
    });

    if (collegeSortBy === "rating") {
      list.sort((a, b) => b.avgRating - a.avgRating);
    } else if (collegeSortBy === "trainers") {
      list.sort((a, b) => b.trainerCount - a.trainerCount);
    } else if (collegeSortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
      // default: volume
      list.sort((a, b) => b.feedbackCount - a.feedbackCount);
    }

    return list;
  }, [
    analytics.colleges,
    collegeSearchQuery,
    collegeTierFilter,
    collegeSortBy,
  ]);

  return (
    <div
      className="space-y-3.5 font-sans relative min-h-[450px]"
      ref={printRef}
    >
      {/* iOS Style Fresh Light Glassmorphism Loader with Progress */}
      {loading && (
        <div className="fixed inset-0 z-[100] bg-slate-900/15 backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-300 select-none animate-in fade-in duration-200">
          <div className="relative bg-white/95 backdrop-blur-3xl border border-white/90 rounded-[28px] p-6 sm:p-7 max-w-[340px] w-full shadow-[0_25px_60px_-15px_rgba(15,23,42,0.22),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] text-center flex flex-col items-center gap-4 ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">
            {/* Apple iOS 12-segment Spinner in Fresh Blue */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg
                className="w-10 h-10 animate-spin text-blue-600"
                viewBox="0 0 100 100"
                style={{ animationDuration: "0.85s" }}
              >
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
                  (deg, i) => (
                    <rect
                      key={deg}
                      x="46.5"
                      y="10"
                      width="7"
                      height="22"
                      rx="3.5"
                      transform={`rotate(${deg} 50 50)`}
                      fill="currentColor"
                      opacity={(i + 1) / 12}
                    />
                  ),
                )}
              </svg>
            </div>

            {/* Label & Dynamic Progress Stage */}
            <div className="space-y-1 w-full">
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">
                Compiling Overview
              </h3>
              <p className="text-[12px] text-slate-500 font-medium truncate px-2">
                {statusStage}
              </p>
            </div>

            {/* iOS Apple Style Smooth Progress Bar */}
            <div className="w-full space-y-1.5">
              <div className="w-full h-2 bg-slate-100/90 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 transition-all duration-300 ease-out shadow-xs"
                  style={{
                    width: `${Math.min(100, Math.max(6, loadingProgress))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-0.5">
                <span>
                  {loadedCount > 0 ? (
                    <span className="text-slate-700 font-bold">
                      {loadedCount.toLocaleString()} reviews
                    </span>
                  ) : (
                    "Syncing..."
                  )}
                </span>
                <span className="text-blue-600 font-bold">
                  {Math.round(loadingProgress)}%
                </span>
              </div>
            </div>

            {/* Fresh Light Capsule Live Tag & Stop Stream Action */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/90 border border-blue-200/70 text-[11px] font-semibold text-blue-700 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Data Sync
              </div>
              {preset === "lifetime" && loadedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    cancelStreamRef.current = true;
                    toast.info("Stopping stream and processing loaded records...");
                  }}
                  className="h-6.5 text-[11px] px-3 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-full shadow-2xs"
                >
                  Stop & View ({loadedCount.toLocaleString()})
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Fresh & Crisp Executive Header Card (Compact & High-Density) */}
      <Card className="border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/30 shadow-xs rounded-xl overflow-hidden relative backdrop-blur-sm">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-400/5 rounded-full blur-2xl pointer-events-none" />
        <CardContent className="p-3 sm:p-3.5 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-2xs shrink-0">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                  Management Overview
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 max-w-2xl leading-tight">
                Strategic performance summary across partner institutions,
                trainer excellence metrics, CSAT satisfaction, and priority
                action alerts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/super-admin/weekly-analytics")}
                className="h-7 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-1.5 shadow-2xs rounded-lg font-medium px-2.5"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                Weekly Hierarchy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchFeedbacks}
                disabled={loading}
                className="h-7 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-1.5 shadow-2xs rounded-lg font-medium px-2.5"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 text-slate-500",
                    loading && "animate-spin text-blue-600",
                  )}
                />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={handleExportSnapshot}
                disabled={isExporting || loading}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-xs rounded-lg border-0 px-3"
              >
                <Download className="h-3.5 w-3.5" />
                Export Snapshot
              </Button>
            </div>
          </div>

          {/* Quick Date Range Bar inside Header */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
                Time Window:
              </span>
              {[
                { id: "last7", label: "7 Days" },
                { id: "last30", label: "30 Days" },
                { id: "last60", label: "60 Days" },
                { id: "lifetime", label: "Lifetime (All Time)" },
              ].map((p) => (
                <Button
                  key={p.id}
                  variant={preset === p.id ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-6.5 text-[11px] px-2.5 py-0 rounded-md font-semibold transition-all",
                    preset === p.id
                      ? p.id === "lifetime"
                        ? "bg-amber-600 text-white shadow-2xs border-amber-600 hover:bg-amber-700"
                        : "bg-slate-900 text-white shadow-2xs border-slate-900"
                      : p.id === "lifetime"
                      ? "border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Popover
                open={isDatePickerOpen}
                onOpenChange={(open) => {
                  setIsDatePickerOpen(open);
                  if (open) {
                    setTempRange({ from: startDate, to: endDate });
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-6.5 text-[11px] px-2.5 py-0 rounded-md border bg-white font-medium shadow-2xs flex items-center gap-1.5 transition-all",
                      preset === "custom"
                        ? "border-blue-500 text-blue-700 bg-blue-50/60 ring-1 ring-blue-500/20 font-semibold"
                        : preset === "lifetime"
                        ? "border-amber-400 text-amber-800 bg-amber-50/60 ring-1 ring-amber-400/20 font-semibold"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <CalendarIcon className={cn("h-3 w-3 shrink-0", preset === "lifetime" ? "text-amber-600" : "text-blue-600")} />
                    <span>
                      {preset === "lifetime" ? (
                        <span className="font-semibold text-amber-800">All Time (Complete History)</span>
                      ) : startDate ? (
                        endDate ? (
                          <>
                            {format(startDate, "LLL dd, y")} -{" "}
                            {format(endDate, "LLL dd, y")}
                          </>
                        ) : (
                          format(startDate, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick dates</span>
                      )}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 border border-slate-200 shadow-2xl rounded-2xl overflow-hidden bg-white"
                  align="end"
                >
                  <div className="p-3 bg-white">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={tempRange?.from || startDate || new Date()}
                      selected={tempRange}
                      onSelect={(range) => {
                        setTempRange(range || { from: null, to: null });
                      }}
                      numberOfMonths={2}
                    />
                  </div>

                  {/* Popover Action Footer with Confirmation and Summary */}
                  {(() => {
                    const tempDaysCount =
                      tempRange?.from && tempRange?.to
                        ? getDaysDiff(tempRange.from, tempRange.to) + 1
                        : 0;
                    const isExceedingLimit =
                      tempDaysCount > MAX_CUSTOM_RANGE_DAYS;
                    const isApplyDisabled =
                      !tempRange?.from || !tempRange?.to || isExceedingLimit;

                    return (
                      <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                        <div className="text-xs font-medium">
                          {tempRange?.from && tempRange?.to ? (
                            isExceedingLimit ? (
                              <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {format(tempRange.from, "dd MMM yyyy")} &rarr;{" "}
                                  {format(tempRange.to, "dd MMM yyyy")}
                                  <span className="ml-1.5 font-bold text-rose-600">
                                    ({tempDaysCount} days &bull; Max{" "}
                                    {MAX_CUSTOM_RANGE_DAYS} days allowed)
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <span className="font-semibold text-slate-900">
                                {format(tempRange.from, "dd MMM yyyy")} &rarr;{" "}
                                {format(tempRange.to, "dd MMM yyyy")}
                                <span className="ml-1.5 text-[11px] font-semibold text-emerald-600">
                                  ({tempDaysCount} days)
                                </span>
                              </span>
                            )
                          ) : tempRange?.from ? (
                            <span className="text-blue-600 font-medium animate-pulse">
                              Select end date...
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Select start and end dates (Max{" "}
                              {MAX_CUSTOM_RANGE_DAYS} days)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2.5 text-slate-600 hover:text-slate-900"
                            onClick={() => {
                              setTempRange({ from: startDate, to: endDate });
                              setIsDatePickerOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={isApplyDisabled}
                            className={cn(
                              "h-7 text-xs px-3 font-semibold rounded-lg shadow-xs transition-all",
                              isApplyDisabled
                                ? "opacity-50 cursor-not-allowed bg-slate-200 text-slate-400 border border-slate-300/50 hover:bg-slate-200 hover:text-slate-400"
                                : "bg-blue-600 hover:bg-blue-700 text-white",
                            )}
                            onClick={handleApplyCustomRange}
                          >
                            Apply Range
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </PopoverContent>
              </Popover>

              {/* Reset Filter button when custom range or non-default preset is active */}
              {preset !== "last30" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("last30")}
                  className="h-6.5 text-[11px] px-2 py-0 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 hover:border-rose-200 font-semibold flex items-center gap-1 shadow-2xs transition-all animate-in fade-in zoom-in-95 duration-150"
                  title="Reset date filter to default 30 days"
                >
                  <RotateCcw className="h-3 w-3 text-slate-400 group-hover:text-rose-500" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Primary Executive KPI Row (Fresh, Light & High-Density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1: Overall Average Rating */}
        <Card className="border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all rounded-xl">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Average Rating (CSAT)
              </span>
              <div className="h-6 w-6 rounded-md bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <Star className="h-3.5 w-3.5 fill-amber-500" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {analytics.overallAvgRating > 0
                  ? analytics.overallAvgRating.toFixed(2)
                  : "0.00"}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                / 5.0
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10.5px] text-emerald-600 font-semibold leading-none">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {analytics.satisfactionRate.toFixed(1)}% positive responses
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Total Feedback Volume */}
        <Card className="border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all rounded-xl">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Feedback
              </span>
              <div className="h-6 w-6 rounded-md bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {analytics.totalResponses.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                reviews
              </span>
            </div>
            <div className="mt-1 text-[10.5px] text-slate-500 font-medium leading-none truncate">
              Over {startDate && endDate ? `${getDaysDiff(startDate, endDate) + 1}-day` : "lifetime"} inspection window
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Institutional Partner Coverage */}
        <Card className="border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all rounded-xl">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Active Colleges
              </span>
              <div className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {analytics.activeCollegesCount}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                campuses
              </span>
            </div>
            <div className="mt-1 text-[10.5px] text-indigo-600 font-semibold flex items-center gap-1 leading-none truncate">
              <Users className="h-3 w-3 shrink-0" />
              <span>{analytics.activeTrainersCount} deployed trainers</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Trainer Excellence Ratio */}
        <Card className="border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all rounded-xl">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                High-Performer Ratio
              </span>
              <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <Award className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {analytics.activeTrainersCount > 0
                  ? (
                      (analytics.tierData[0].value /
                        analytics.activeTrainersCount) *
                      100
                    ).toFixed(0)
                  : "0"}
                %
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                rated ≥ 4.5
              </span>
            </div>
            <div className="mt-1 text-[10.5px] text-slate-500 font-medium leading-none truncate">
              {analytics.tierData[0].value} of {analytics.activeTrainersCount}{" "}
              trainers in Star Tier
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Trend Analytics & Performance Tier Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Trend Area Chart (2 Cols) */}
        <Card className="lg:col-span-2 border-slate-200/80 bg-white shadow-xs rounded-xl">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Response Volume & Daily Velocity
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Timeline of student feedback submissions over the selected
                period
              </CardDescription>
            </div>
            <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {analytics.trendData.length} active days
            </span>
          </CardHeader>
          <CardContent className="p-3 pt-4">
            {analytics.trendData.length > 0 ? (
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.trendData}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorResponsesLight"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#0284c7"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0284c7"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0",
                        borderRadius: "10px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        color: "#0f172a",
                        fontSize: "12px",
                      }}
                      formatter={(value, name) => [
                        value,
                        name === "responses" ? "Feedback Count" : "Avg Rating",
                      ]}
                      labelFormatter={(label, items) =>
                        items?.[0]?.payload?.fullDate || label
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="responses"
                      stroke="#0284c7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorResponsesLight)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[210px] flex items-center justify-center text-xs text-slate-400 font-medium">
                No trend data available for this range
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Tiers Distribution (1 Col) */}
        <Card className="border-slate-200/80 bg-white shadow-xs rounded-xl flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" />
              Trainer Quality Tiers
            </CardTitle>
            <CardDescription className="text-[11px] text-slate-500">
              Trainer distribution across rating tiers
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            <div className="space-y-3">
              {analytics.tierData.map((tier, idx) => {
                const total = analytics.activeTrainersCount || 1;
                const percentage = Math.round((tier.value / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tier.color }}
                        />
                        {tier.name}
                      </span>
                      <span className="font-bold text-slate-900">
                        {tier.value}{" "}
                        <span className="text-slate-400 font-normal">
                          ({percentage}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: tier.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between font-medium">
              <span>Total Active Trainers:</span>
              <span className="font-bold text-slate-900">
                {analytics.activeTrainersCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Top Performing Colleges & Trainers Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Institutional Partners */}
        <Card className="border-slate-200/80 bg-white shadow-xs rounded-xl">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              Top Institutional Partners
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">
                By volume
              </span>
              {analytics.colleges && analytics.colleges.length > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCollegesModalOpen(true)}
                  className="h-6 text-[11px] px-2 rounded-md border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100/90 font-semibold flex items-center gap-1 shadow-2xs transition-all"
                >
                  View All ({analytics.colleges.length})
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {analytics.topColleges.map((college, idx) => (
                <div
                  key={college.id}
                  className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-6 w-6 rounded-md bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {college.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {college.trainerCount} assigned trainers •{" "}
                        {college.feedbackCount} feedbacks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1",
                        college.avgRating >= 4.5
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : college.avgRating >= 3.8
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-rose-50 text-rose-700 border-rose-200",
                      )}
                    >
                      <Star className="h-3 w-3 fill-current" />
                      {college.avgRating.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {analytics.topColleges.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No college data in this range
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Star Trainers */}
        <Card className="border-slate-200/80 bg-white shadow-xs rounded-xl">
          <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              Leaderboard: Top Star Trainers
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">
                Highest rated
              </span>
              {analytics.trainers && analytics.trainers.length > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTrainersModalOpen(true)}
                  className="h-6 text-[11px] px-2 rounded-md border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/90 font-semibold flex items-center gap-1 shadow-2xs transition-all"
                >
                  View All ({analytics.trainers.length})
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {analytics.topTrainers.map((trainer, idx) => (
                <div
                  key={trainer.id}
                  className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-6 w-6 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      ★{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {trainer.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {trainer.collegeCount} colleges •{" "}
                        {trainer.feedbackCount} verified reviews
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                      {trainer.avgRating.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {analytics.topTrainers.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No trainer data in this range
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Executive Action Table: Critical Low-Rated Sessions */}
      {analytics.lowRatedSessions.length > 0 && (
        <Card className="border border-rose-200 bg-rose-50/25 shadow-xs rounded-xl">
          <CardHeader className="py-2.5 px-4 border-b border-rose-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Management Action Required: Low-Rated Sessions (&lt; 3.8 Rating)
            </CardTitle>
            <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200/60">
              {analytics.lowRatedSessions.length} sessions flagged
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-rose-100/60 text-xs">
              {analytics.lowRatedSessions.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 px-4 flex items-center justify-between hover:bg-rose-50/60 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 truncate">
                        {item.sessionTitle}
                      </p>
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100/80 text-rose-700 rounded-md border border-rose-200/60">
                        {item.sessionResponseCount}{" "}
                        {item.sessionResponseCount === 1
                          ? "response"
                          : "responses"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {item.collegeName} • Trainer:{" "}
                      <span className="font-semibold text-slate-700">
                        {item.trainerName}
                      </span>{" "}
                      • {item.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-rose-700 bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                      ★ {item.rating.toFixed(2)}
                    </span>
                    {item.sessionId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/super-admin/sessions/${item.sessionId}/responses${item.trainerName && item.trainerName !== "Unknown Trainer" ? `?trainer=${encodeURIComponent(item.trainerName)}` : ""}`,
                            {
                              state: { selectedTrainerName: item.trainerName },
                            },
                          )
                        }
                        className="h-6 text-[11px] text-rose-700 hover:bg-rose-100 px-2 font-semibold"
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* iOS Style Clean Deployed Trainers Modal (High-Density Compact Layout) */}
      <Dialog open={isTrainersModalOpen} onOpenChange={setIsTrainersModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] p-0 rounded-[20px] border-white/80 bg-white/95 backdrop-blur-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/5 flex flex-col overflow-hidden">
          {/* Compact Header */}
          <div className="p-3.5 sm:p-4 pb-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shadow-2xs">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Trainers Leaderboard
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                    All {analytics.trainers.length} deployed trainers ranked by
                    student rating (
                    {startDate && endDate
                      ? `${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM yyyy")}`
                      : "Complete Lifetime History"}
                    )
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Compact Search & Tier Filters */}
            <div className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search trainer by name..."
                  value={trainerSearchQuery}
                  onChange={(e) => setTrainerSearchQuery(e.target.value)}
                  className="w-full h-7 pl-7 pr-3 text-[11px] rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium shadow-2xs"
                />
                {trainerSearchQuery && (
                  <button
                    onClick={() => setTrainerSearchQuery("")}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Tier Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
                {[
                  { id: "all", label: `All (${analytics.trainers.length})` },
                  {
                    id: "star",
                    label: `≥ 4.5 (${analytics.tierData[0].value})`,
                  },
                  {
                    id: "good",
                    label: `3.8-4.49 (${analytics.tierData[1].value})`,
                  },
                  {
                    id: "attention",
                    label: `< 3.8 (${analytics.tierData[2].value})`,
                  },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setTrainerTierFilter(tier.id)}
                    className={cn(
                      "h-6 text-[10px] px-2 rounded-md font-semibold transition-all whitespace-nowrap",
                      trainerTierFilter === tier.id
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body: High Density Scrollable Trainers List */}
          <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 divide-y divide-slate-100/80 max-h-[62vh] sm:max-h-[68vh]">
            {modalFilteredTrainers.map((trainer, idx) => {
              const isStar = trainer.avgRating >= 4.5;
              const isGood =
                trainer.avgRating >= 3.8 && trainer.avgRating < 4.5;

              return (
                <div
                  key={trainer.id}
                  className="py-1.5 px-2 sm:px-2.5 rounded-lg flex items-center justify-between hover:bg-slate-50/90 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "h-5 w-5 sm:h-5.5 sm:w-5.5 rounded-md font-extrabold text-[10px] flex items-center justify-center shrink-0 border",
                        idx === 0
                          ? "bg-amber-100 text-amber-800 border-amber-300 shadow-2xs"
                          : idx === 1
                            ? "bg-slate-200 text-slate-800 border-slate-300 shadow-2xs"
                            : idx === 2
                              ? "bg-amber-50 text-amber-900 border-amber-200/80 shadow-2xs"
                              : "bg-slate-100 text-slate-600 border-slate-200 font-semibold",
                      )}
                    >
                      ★{idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {trainer.name}
                        </p>
                        <span
                          className={cn(
                            "text-[9px] font-semibold px-1 py-0 rounded border",
                            isStar
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isGood
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-rose-50 text-rose-700 border-rose-200",
                          )}
                        >
                          {isStar
                            ? "Excellence"
                            : isGood
                              ? "Proficient"
                              : "Needs Attention"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                        {trainer.collegeCount} campus
                        {trainer.collegeCount !== 1 ? "es" : ""} •{" "}
                        <span className="font-semibold text-slate-700">
                          {trainer.feedbackCount}
                        </span>{" "}
                        reviews
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <span
                      className={cn(
                        "text-xs font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-2xs",
                        isStar
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isGood
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-rose-50 text-rose-700 border-rose-200",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-3 w-3 fill-current",
                          isStar
                            ? "text-emerald-600"
                            : isGood
                              ? "text-blue-600"
                              : "text-rose-600",
                        )}
                      />
                      {trainer.avgRating.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}

            {modalFilteredTrainers.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <Users className="h-5 w-5 text-slate-300 mx-auto" />
                <p className="font-medium text-slate-500 text-[11px]">
                  No trainers matched your filter
                </p>
              </div>
            )}
          </div>

          {/* Compact Footer */}
          <div className="py-2 px-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              Showing{" "}
              <span className="font-bold text-slate-800">
                {modalFilteredTrainers.length}
              </span>{" "}
              of {analytics.trainers.length} deployed trainers
            </span>
            <Button
              size="sm"
              onClick={() => setIsTrainersModalOpen(false)}
              className="h-7 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* iOS Style Clean Partner Colleges Modal (High-Density Compact Layout) */}
      <Dialog open={isCollegesModalOpen} onOpenChange={setIsCollegesModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] p-0 rounded-[20px] border-white/80 bg-white/95 backdrop-blur-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/5 flex flex-col overflow-hidden">
          {/* Compact Header */}
          <div className="p-3.5 sm:p-4 pb-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-2xs">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Partner Institutions Performance
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                    All {analytics.colleges.length} active campuses ranked across
                    selected window (
                    {startDate && endDate
                      ? `${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM yyyy")}`
                      : "Complete Lifetime History"}
                    )
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Compact Search, Filters & Sort Bar */}
            <div className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search college by name..."
                  value={collegeSearchQuery}
                  onChange={(e) => setCollegeSearchQuery(e.target.value)}
                  className="w-full h-7 pl-7 pr-3 text-[11px] rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium shadow-2xs"
                />
                {collegeSearchQuery && (
                  <button
                    onClick={() => setCollegeSearchQuery("")}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Tier Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
                {[
                  { id: "all", label: `All (${analytics.colleges.length})` },
                  {
                    id: "star",
                    label: `≥ 4.5 (${analytics.starCollegesCount})`,
                  },
                  {
                    id: "good",
                    label: `3.8-4.49 (${analytics.goodCollegesCount})`,
                  },
                  {
                    id: "attention",
                    label: `< 3.8 (${analytics.attentionCollegesCount})`,
                  },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setCollegeTierFilter(tier.id)}
                    className={cn(
                      "h-6 text-[10px] px-2 rounded-md font-semibold transition-all whitespace-nowrap",
                      collegeTierFilter === tier.id
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1">
                {[
                  { id: "volume", label: "Volume" },
                  { id: "rating", label: "Rating" },
                  { id: "trainers", label: "Trainers" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCollegeSortBy(s.id)}
                    className={cn(
                      "h-6 text-[10px] px-1.5 rounded-md font-medium transition-all",
                      collegeSortBy === s.id
                        ? "bg-indigo-600 text-white font-bold shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body: High Density Scrollable Colleges List */}
          <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 divide-y divide-slate-100/80 max-h-[62vh] sm:max-h-[68vh]">
            {modalFilteredColleges.map((college, idx) => {
              const isStar = college.avgRating >= 4.5;
              const isGood =
                college.avgRating >= 3.8 && college.avgRating < 4.5;

              return (
                <div
                  key={college.id}
                  className="py-2 px-2.5 sm:px-3 rounded-lg flex items-center justify-between hover:bg-slate-50/90 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "h-5 w-5 sm:h-5.5 sm:w-5.5 rounded-md font-extrabold text-[10px] flex items-center justify-center shrink-0 border",
                        idx === 0
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs"
                          : idx === 1
                            ? "bg-slate-200 text-slate-800 border-slate-300 shadow-2xs"
                            : idx === 2
                              ? "bg-indigo-50 text-indigo-900 border-indigo-200/80 shadow-2xs"
                              : "bg-slate-100 text-slate-600 border-slate-200 font-semibold",
                      )}
                    >
                      #{idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {college.name}
                        </p>
                        <span
                          className={cn(
                            "text-[9px] font-semibold px-1 py-0 rounded border",
                            isStar
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isGood
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-rose-50 text-rose-700 border-rose-200",
                          )}
                        >
                          {isStar
                            ? "Excellence"
                            : isGood
                              ? "Proficient"
                              : "Needs Attention"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                        <span className="font-semibold text-slate-700">
                          {college.trainerCount}
                        </span>{" "}
                        assigned trainer
                        {college.trainerCount !== 1 ? "s" : ""} •{" "}
                        <span className="font-semibold text-slate-700">
                          {college.feedbackCount.toLocaleString()}
                        </span>{" "}
                        feedbacks
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <span
                      className={cn(
                        "text-xs font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-2xs",
                        isStar
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isGood
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-rose-50 text-rose-700 border-rose-200",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-3 w-3 fill-current",
                          isStar
                            ? "text-emerald-600"
                            : isGood
                              ? "text-blue-600"
                              : "text-rose-600",
                        )}
                      />
                      {college.avgRating.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}

            {modalFilteredColleges.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <Building2 className="h-5 w-5 text-slate-300 mx-auto" />
                <p className="font-medium text-slate-500 text-[11px]">
                  No colleges matched your filter
                </p>
              </div>
            )}
          </div>

          {/* Compact Footer */}
          <div className="py-2 px-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              Showing{" "}
              <span className="font-bold text-slate-800">
                {modalFilteredColleges.length}
              </span>{" "}
              of {analytics.colleges.length} partner institutions
            </span>
            <Button
              size="sm"
              onClick={() => setIsCollegesModalOpen(false)}
              className="h-7 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Lifetime / All-Time Data Loading Confirmation & Safety Warning Modal */}
      <Dialog
        open={isLifetimeWarningOpen}
        onOpenChange={setIsLifetimeWarningOpen}
      >
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl bg-white">
          <div className="p-5 space-y-4">
            {/* Header with Amber Warning Accent */}
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                  High-Volume Database Operation
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                  You are about to query the complete historical feedback archive
                  (estimated <span className="font-semibold text-slate-700">200,000+ responses</span>).
                </DialogDescription>
              </div>
            </div>

            {/* Information & Architecture Safeguards Box */}
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  <strong className="font-semibold text-slate-900">Safe Throttled Streaming:</strong>{" "}
                  Data will be loaded sequentially in batches of 1,000 with micro-pauses to protect your browser memory and network.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <Zap className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  <strong className="font-semibold text-slate-900">Live Progress HUD:</strong>{" "}
                  You can monitor the live count and stop the stream anytime to view loaded data instantly.
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium leading-normal">
              Note: This will perform multiple Firestore read operations. Proceed if you need full-historical analytics for leadership review.
            </p>
          </div>

          {/* Dialog Action Buttons */}
          <div className="py-3 px-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLifetimeWarningOpen(false)}
              className="h-8 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmLifetime}
              className="h-8 px-4 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1.5"
            >
              <Activity className="h-3.5 w-3.5" />
              Yes, Load Lifetime Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
