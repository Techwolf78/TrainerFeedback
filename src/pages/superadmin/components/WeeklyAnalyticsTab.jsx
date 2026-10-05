import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Calendar as CalendarIcon,
  Building2,
  BookOpen,
  User,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
  Star,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  Download,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  LayoutDashboard,
  RotateCcw,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  generateAlertsFromFeedbacks,
  getResolvedAlerts,
} from "@/services/superadmin/alertService";

export default function WeeklyAnalyticsTab() {
  const {
    sessions,
    colleges,
    trainers,
    allSessionsMap,
    loadAllSessionsMetadata,
  } = useSuperAdminData();
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [statusStage, setStatusStage] = useState("Connecting to database...");
  const [expandedDates, setExpandedDates] = useState({});

  // Resolved state for alerts
  const [resolvedAlertIds, setResolvedAlertIds] = useState(new Set());

  // Combined full session list for accurate session resolution across older dates
  const allSessionsList = useMemo(() => {
    const map = { ...(allSessionsMap || {}) };
    sessions.forEach((s) => {
      map[s.id] = s;
    });
    return Object.values(map);
  }, [sessions, allSessionsMap]);

  // Fetch resolved alerts from Firestore on mount
  useEffect(() => {
    const loadResolved = async () => {
      try {
        const dbResolved = await getResolvedAlerts();
        setResolvedAlertIds(dbResolved);
      } catch (err) {
        console.error("Failed to load resolved alerts:", err);
      }
    };
    loadResolved();
  }, []);

  // Compute unresolved alerts count
  const unresolvedAlertsCount = useMemo(() => {
    if (!feedbacks || feedbacks.length === 0) return 0;
    const computed = generateAlertsFromFeedbacks(
      feedbacks,
      allSessionsList,
      trainers,
      colleges,
    );
    return computed.filter((a) => !resolvedAlertIds.has(a.id)).length;
  }, [feedbacks, allSessionsList, trainers, colleges, resolvedAlertIds]);

  // Maximum allowed date range in days for interactive real-time inspection
  const MAX_CUSTOM_RANGE_DAYS = 62;

  // Format Helper: Get YYYY-MM-DD key (local timezone safe)
  const formatDateKey = (date) => {
    if (!date || isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper to calculate exact calendar days difference between two dates
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

  // Date filter states: last7, thisWeek, lastWeek, last30, last60, custom
  const [preset, setPreset] = useState("last7");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  // Date Picker popover state and uncommitted tempRange (prevents premature queries / lag)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempRange, setTempRange] = useState(() => ({
    from: startDate,
    to: endDate,
  }));

  // Handle preset clicks (immediate query for standard presets)
  const applyPreset = (presetType) => {
    setPreset(presetType);
    const now = new Date();
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    switch (presetType) {
      case "thisWeek": {
        // Monday to Sunday of current week
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        break;
      }
      case "lastWeek": {
        // Monday to Sunday of previous week
        const day = now.getDay();
        const diff = now.getDate() - day - 6;
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setDate(diff + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
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

  const handleResetDates = () => {
    applyPreset("last7");
  };

  // Fetch feedbacks for selected range with chunking and progressive loading HUD
  const fetchFeedbacks = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setLoadingProgress(12);
    setLoadedCount(0);
    setStatusStage("Querying feedback records...");

    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev < 35) return prev + 5;
        if (prev < 65) return prev + 2;
        if (prev < 88) return prev + 0.8;
        return prev;
      });
    }, 120);

    try {
      let start = new Date(startDate);
      let end = new Date(endDate);

      // Clamp query safely without triggering state re-renders
      const diffDays = getDaysDiff(start, end);
      if (diffDays > MAX_CUSTOM_RANGE_DAYS) {
        start = new Date(end);
        start.setDate(end.getDate() - MAX_CUSTOM_RANGE_DAYS);
        start.setHours(0, 0, 0, 0);
      }

      if (loadAllSessionsMetadata) {
        await loadAllSessionsMetadata();
      }

      const data = await getFeedbacksByDateRange(start, end, 500, (count) => {
        setLoadedCount(count);
        setStatusStage(`Retrieved ${count.toLocaleString()} responses...`);
        setLoadingProgress((prev) =>
          Math.max(prev, Math.min(90, 30 + Math.floor(count / 70))),
        );
      });

      setStatusStage("Mapping hierarchy & metrics...");
      setLoadingProgress(96);
      await new Promise((r) => setTimeout(r, 100));
      setLoadingProgress(100);
      setFeedbacks(data || []);

      // Auto-expand the first date if present
      if (data && data.length > 0) {
        const firstFeedback = data[0];
        let dateStr = "";
        if (firstFeedback.submittedAt?.toDate) {
          dateStr = formatDateKey(firstFeedback.submittedAt.toDate());
        } else {
          dateStr = formatDateKey(new Date(firstFeedback.submittedAt));
        }
        if (dateStr) {
          setExpandedDates((prev) => ({ ...prev, [dateStr]: true }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch feedbacks for weekly analytics:", error);
      toast.error("Failed to load feedbacks for the selected range.");
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
        setLoadedCount(0);
      }, 200);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Format Helper: Format key to readable day (e.g. "Monday, Jun 15, 2026")
  const formatReadableDate = (dateKey) => {
    if (dateKey === "Unknown Date") return dateKey;
    const date = new Date(dateKey);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Grouping & aggregation pipeline
  const groupedData = useMemo(() => {
    const groups = {};
    const collegeMap = {};
    colleges.forEach((c) => {
      collegeMap[c.id] = c;
    });
    const trainerMap = {};
    trainers.forEach((t) => {
      trainerMap[t.id] = t;
    });
    const sessionMap = { ...(allSessionsMap || {}) };
    sessions.forEach((s) => {
      sessionMap[s.id] = s;
    });

    feedbacks.forEach((response) => {
      let date;
      if (response.submittedAt?.toDate) {
        date = response.submittedAt.toDate();
      } else if (response.submittedAt) {
        date = new Date(response.submittedAt);
      }

      if (!date || isNaN(date.getTime())) return;

      const dateStr = formatDateKey(date);
      const sessionId = response.sessionId;
      const session = sessionMap[sessionId];

      const collegeId =
        response.collegeId || session?.collegeId || "unknown_college";
      const collegeName =
        collegeMap[collegeId]?.name ||
        response.collegeName ||
        session?.collegeName ||
        "Unknown College";

      const trainerId =
        response.selectedTrainerId ||
        response.trainerId ||
        session?.assignedTrainer?.id ||
        session?.assignedTrainerId ||
        "unknown_trainer";
      const trainerName =
        trainerMap[trainerId]?.name ||
        response.selectedTrainerName ||
        session?.assignedTrainer?.name ||
        "Unknown Trainer";

      // Calculate response average rating
      const ratingAnswers = (response.answers || []).filter((a) => {
        const type = (a.type || "").toLowerCase();
        return type === "rating" || type === "overall";
      });
      const responseAvg =
        ratingAnswers.length > 0
          ? ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) /
            ratingAnswers.length
          : null;

      // Build tree
      groups[dateStr] = groups[dateStr] || {};
      const dateNode = groups[dateStr];

      dateNode[collegeId] = dateNode[collegeId] || {
        id: collegeId,
        name: collegeName,
        sessions: {},
      };
      const collegeNode = dateNode[collegeId];

      collegeNode.sessions[sessionId] = collegeNode.sessions[sessionId] || {
        id: sessionId,
        title: session?.sessionTopic || session?.topic || "Untitled Session",
        course: session?.course || "Unknown Course",
        batch:
          response.selectedBatch ||
          response.batch ||
          session?.batch ||
          "All Batches",
        sessionDate: session?.sessionDate || "N/A",
        trainers: {},
      };
      const sessionNode = collegeNode.sessions[sessionId];

      sessionNode.trainers[trainerId] = sessionNode.trainers[trainerId] || {
        id: trainerId,
        name: trainerName,
        ratingSum: 0,
        ratingCount: 0,
        responseCount: 0,
      };
      const trainerNode = sessionNode.trainers[trainerId];

      trainerNode.responseCount += 1;
      if (responseAvg !== null) {
        trainerNode.ratingSum += responseAvg;
        trainerNode.ratingCount += 1;
      }
    });

    // Convert grouped tree structures to sorted arrays for rendering
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      const collegesArr = Object.values(groups[dateStr]).map((college) => {
        const sessionsArr = Object.values(college.sessions).map((session) => {
          const trainersArr = Object.values(session.trainers).map((trainer) => {
            return {
              ...trainer,
              avgRating:
                trainer.ratingCount > 0
                  ? trainer.ratingSum / trainer.ratingCount
                  : 0,
            };
          });

          return {
            ...session,
            trainers: trainersArr,
          };
        });

        // Sort sessions by name
        sessionsArr.sort((a, b) => a.title.localeCompare(b.title));

        return {
          ...college,
          sessions: sessionsArr,
          totalResponses: sessionsArr.reduce(
            (sum, s) =>
              sum + s.trainers.reduce((s2, t) => s2 + t.responseCount, 0),
            0,
          ),
        };
      });

      // Sort colleges by response count descending
      collegesArr.sort((a, b) => b.totalResponses - a.totalResponses);

      const totalResponsesForDate = collegesArr.reduce(
        (sum, c) => sum + c.totalResponses,
        0,
      );

      // Calculate overall average rating for the date
      let dateRatingSum = 0;
      let dateRatingCount = 0;
      collegesArr.forEach((c) => {
        c.sessions.forEach((s) => {
          s.trainers.forEach((t) => {
            dateRatingSum += t.ratingSum;
            dateRatingCount += t.ratingCount;
          });
        });
      });
      const dateAvgRating =
        dateRatingCount > 0 ? dateRatingSum / dateRatingCount : 0;

      return {
        dateStr,
        readableDate: formatReadableDate(dateStr),
        colleges: collegesArr,
        totalResponses: totalResponsesForDate,
        avgRating: dateAvgRating,
      };
    });
  }, [feedbacks, colleges, trainers, sessions, allSessionsMap]);

  // Overall range stats
  const rangeStats = useMemo(() => {
    let responseCount = feedbacks.length;
    let ratingSum = 0;
    let ratingCount = 0;
    const activeTrainers = new Set();
    const activeColleges = new Set();

    const sessionMap = { ...(allSessionsMap || {}) };
    sessions.forEach((s) => {
      sessionMap[s.id] = s;
    });

    feedbacks.forEach((f) => {
      const cId = f.collegeId || sessionMap[f.sessionId]?.collegeId;
      if (cId && cId !== "unknown_college") {
        activeColleges.add(cId);
      }
      if (f.selectedTrainerId || f.trainerId) {
        activeTrainers.add(f.selectedTrainerId || f.trainerId);
      }

      const ratingAnswers = (f.answers || []).filter((a) => {
        const type = (a.type || "").toLowerCase();
        return type === "rating" || type === "overall";
      });

      if (ratingAnswers.length > 0) {
        const avg =
          ratingAnswers.reduce((sum, a) => sum + (Number(a.value) || 0), 0) /
          ratingAnswers.length;
        ratingSum += avg;
        ratingCount += 1;
      }
    });

    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;

    return {
      responseCount,
      avgRating,
      uniqueColleges: activeColleges.size,
      uniqueTrainers: activeTrainers.size,
    };
  }, [feedbacks, sessions, allSessionsMap]);

  // Check if all displayed dates are expanded
  const isAllExpanded = useMemo(() => {
    if (groupedData.length === 0) return false;
    return groupedData.every((day) => expandedDates[day.dateStr]);
  }, [groupedData, expandedDates]);

  // Toggle date expansion
  const toggleDate = (dateStr) => {
    setExpandedDates((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  // Expand/Collapse all
  const toggleAllDates = (expand) => {
    const updated = {};
    if (expand) {
      groupedData.forEach((d) => {
        updated[d.dateStr] = true;
      });
    }
    setExpandedDates(updated);
  };

  // Helper to get rating text badge styles
  const getRatingBadgeClass = (rating) => {
    if (rating === 0) return "bg-slate-100 text-slate-500 border-slate-200";
    if (rating >= 4.5)
      return "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400";
    if (rating >= 3.5)
      return "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400";
    return "bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400";
  };

  const getRatingStarColor = (rating) => {
    if (rating === 0) return "text-slate-300";
    if (rating >= 4.5) return "text-emerald-500 fill-emerald-500";
    if (rating >= 3.5) return "text-amber-500 fill-amber-500";
    return "text-rose-500 fill-rose-500";
  };

  return (
    <div className="space-y-3">
      {/* iOS-Style Clean Light-Themed Dynamic Progress HUD */}
      {loading && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3 px-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50 slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            {/* Apple 12-segment spinner */}
            <div className="relative w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 animate-spin text-blue-600"
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

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  {statusStage}
                </span>
                {loadedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[10px] font-bold">
                    {loadedCount.toLocaleString()} responses
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Syncing batched data from Firestore safely without delays
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-56 shrink-0">
            <div className="flex-1 bg-slate-100/90 rounded-full h-2 overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 transition-all duration-300 ease-out shadow-xs"
                style={{
                  width: `${Math.min(100, Math.max(6, loadingProgress))}%`,
                }}
              />
            </div>
            <span className="text-xs font-bold text-blue-600 font-mono w-9 text-right">
              {Math.round(loadingProgress)}%
            </span>
          </div>
        </div>
      )}

      {/* 1. Header Filter Section */}
      <Card className="border-slate-200/80 bg-white/95 backdrop-blur shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-2.5 pt-3 px-3.5 sm:px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="h-4.5 w-4.5 text-blue-600" />
                Daily Feedbacks Hierarchy
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500 mt-0.5">
                Day-wise structured hierarchy showing College → Session →
                Trainer with instant counts and averages.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/super-admin/management-overview")}
                className="h-7.5 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-1.5 shadow-2xs font-semibold px-2.5"
              >
                <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                Overview
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7.5 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-1.5 shadow-2xs font-medium px-2.5"
                onClick={fetchFeedbacks}
                disabled={loading}
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
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isAllExpanded) {
                    setExpandedDates({});
                  } else {
                    const updated = {};
                    groupedData.forEach((day) => {
                      updated[day.dateStr] = true;
                    });
                    setExpandedDates(updated);
                  }
                }}
                className="h-7.5 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium px-2.5 shadow-2xs"
              >
                {isAllExpanded ? "Collapse All" : "Expand All"}
              </Button>
              <div className="relative inline-block">
                <Button
                  size="sm"
                  onClick={() => navigate("/super-admin/weekly-analytics/alerts")}
                  className="h-7.5 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold border-0 shadow-2xs px-3"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Alerts & Notifications
                </Button>
                {unresolvedAlertsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-white shadow-xs animate-bounce">
                    {unresolvedAlertsCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="border-t border-slate-100/90 pt-2.5 pb-2.5 px-3.5 sm:px-4 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
                Time Window:
              </span>
              {[
                { id: "last7", label: "7 Days" },
                { id: "thisWeek", label: "This Week" },
                { id: "lastWeek", label: "Last Week" },
                { id: "last30", label: "30 Days" },
                { id: "last60", label: "60 Days" },
              ].map((item) => (
                <Button
                  key={item.id}
                  variant={preset === item.id ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-6.5 text-[11px] px-2.5 py-0 rounded-md font-semibold transition-all",
                    preset === item.id
                      ? "bg-slate-900 text-white shadow-2xs border-slate-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                  onClick={() => applyPreset(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {/* Custom Range Popover & Reset */}
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
                        : "border-slate-200 text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 text-blue-600 shrink-0" />
                    <span>
                      {startDate ? (
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

                  {/* Popover Action Footer with Live Range Summary & Apply */}
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
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  {format(tempRange.from, "dd MMM yyyy")} &rarr;{" "}
                                  {format(tempRange.to, "dd MMM yyyy")}
                                  <span className="ml-1.5 font-bold text-blue-600">
                                    ({tempDaysCount}{" "}
                                    {tempDaysCount === 1 ? "day" : "days"})
                                  </span>
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-slate-400">
                              Select a start and end date from the calendar
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsDatePickerOpen(false)}
                            className="h-7 text-xs text-slate-600 hover:bg-slate-200/60"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={isApplyDisabled}
                            onClick={handleApplyCustomRange}
                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3"
                          >
                            Apply Date Range
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </PopoverContent>
              </Popover>

              {/* Reset Filter Button */}
              {preset !== "last7" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetDates}
                  className="h-6.5 text-[11px] px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 gap-1 rounded-md transition-colors"
                  title="Reset to default 7 days"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Key Metrics Card Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {loading && feedbacks.length === 0
          ? [1, 2, 3, 4].map((i) => (
              <Card
                key={`metric-skeleton-${i}`}
                className="border-slate-200/80 bg-white shadow-xs overflow-hidden relative"
              >
                <CardContent className="p-2.5 px-3 flex items-center justify-between">
                  <div className="space-y-1.5 w-full pr-2">
                    <div className="h-2.5 w-20 bg-slate-200/80 rounded animate-pulse" />
                    <div className="h-6 w-14 bg-slate-200 rounded animate-pulse" />
                    <div className="h-2 w-28 bg-slate-100 rounded animate-pulse" />
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-100/80 shrink-0 animate-pulse" />
                </CardContent>
              </Card>
            ))
          : [
              {
                label: "Total Feedbacks",
                value: rangeStats.responseCount.toLocaleString(),
                icon: Users,
                desc: "Submitted responses in range",
              },
              {
                label: "Average Rating",
                value:
                  rangeStats.avgRating > 0
                    ? rangeStats.avgRating.toFixed(2)
                    : "0.00",
                icon: Star,
                desc: "Range aggregated rating",
                rating: rangeStats.avgRating,
              },
              {
                label: "Active Colleges",
                value: rangeStats.uniqueColleges,
                icon: Building2,
                desc: "Colleges with feedback",
              },
              {
                label: "Active Trainers",
                value: rangeStats.uniqueTrainers,
                icon: User,
                desc: "Trainers rated in range",
              },
            ].map((m, idx) => (
              <Card
                key={idx}
                className="border-slate-200 bg-white shadow-xs overflow-hidden relative"
              >
                <CardContent className="p-2.5 px-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {m.label}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xl font-extrabold text-slate-800">
                        {m.value}
                      </h3>
                      {m.rating !== undefined && m.rating > 0 && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[9px] text-slate-500 font-medium">
                      {m.desc}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100/50">
                    <m.icon className="h-5 w-5 text-slate-500" />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* 3. Grouped Content Listing */}
      {loading && feedbacks.length === 0 ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((s) => (
            <Card
              key={`row-skeleton-${s}`}
              className="border-slate-200/80 bg-white overflow-hidden shadow-xs"
            >
              <div className="p-3 px-4 flex items-center justify-between bg-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-slate-200/80 rounded animate-pulse" />
                    <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-20 bg-slate-100 rounded-lg animate-pulse" />
                  <div className="h-5 w-5 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="p-3 bg-slate-50/40 space-y-2">
                <div className="h-8 bg-white border border-slate-200/60 rounded-lg animate-pulse" />
                <div className="h-14 bg-white border border-slate-200/60 rounded-lg animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : !loading && groupedData.length === 0 ? (
        <Card className="border-slate-200 bg-white p-12 shadow-sm text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <AlertCircle className="h-10 w-10 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">
              No feedbacks found in this range
            </h4>
            <p className="text-xs text-slate-500">
              Try choosing a wider range or verify if responses are present.
            </p>
          </div>
        </Card>
      ) : (
        <div className={cn("space-y-2 transition-opacity duration-200", loading && groupedData.length > 0 && "opacity-60 pointer-events-none")}>
          {groupedData.map((day) => {
            const isExpanded = !!expandedDates[day.dateStr];
            return (
              <Card
                key={day.dateStr}
                className={cn(
                  "border-slate-200 bg-white overflow-hidden shadow-sm hover:border-slate-300 transition-all",
                  isExpanded ? "ring-1 ring-blue-500/20" : "",
                )}
              >
                {/* Date Accordion Header */}
                <div
                  className={cn(
                    "p-2.5 px-3.5 flex items-center justify-between cursor-pointer select-none transition-colors",
                    isExpanded
                      ? "bg-slate-50 border-b border-slate-100"
                      : "hover:bg-slate-50/50",
                  )}
                  onClick={() => toggleDate(day.dateStr)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/55 font-bold text-sm">
                      {new Date(day.dateStr).getDate()}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        {day.readableDate}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span>
                          {day.colleges.length}{" "}
                          {day.colleges.length === 1 ? "College" : "Colleges"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>
                          {day.totalResponses}{" "}
                          {day.totalResponses === 1 ? "Response" : "Responses"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Date Avg Rating */}
                    {day.avgRating > 0 && (
                      <div
                        className={cn(
                          "px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-sm",
                          getRatingBadgeClass(day.avgRating),
                        )}
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            getRatingStarColor(day.avgRating),
                          )}
                        />
                        <span>{day.avgRating.toFixed(2)} Avg</span>
                      </div>
                    )}

                    {/* Expand/Collapse Icon */}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Date Accordion Body */}
                {isExpanded && (
                  <div className="p-2.5 bg-slate-50/20 space-y-2.5">
                    {day.colleges.map((college) => (
                      <div
                        key={college.id}
                        className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm"
                      >
                        {/* College Sub-Header */}
                        <div className="px-3.5 py-1.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <h5 className="text-xs font-extrabold text-slate-700 tracking-tight">
                              {college.name}
                            </h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              College Total:
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold">
                              {college.totalResponses} responses
                            </span>
                          </div>
                        </div>

                        {/* College Sessions Details Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/20 text-slate-400 border-b border-slate-100 text-[9px] font-bold uppercase tracking-wider">
                                <th className="px-3.5 py-1.5">Session details</th>
                                <th className="px-3.5 py-1.5">Batch</th>
                                <th className="px-3.5 py-1.5">Trainer name</th>
                                <th className="px-3.5 py-1.5 text-center">
                                  Responses count
                                </th>
                                <th className="px-3.5 py-1.5 text-right">
                                  Avg rating
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {college.sessions.map((session) => (
                                <React.Fragment key={session.id}>
                                  {session.trainers.map((trainer, tIdx) => (
                                    <tr
                                      key={`${session.id}-${trainer.id}`}
                                      className="hover:bg-slate-50/50 transition-colors"
                                    >
                                      {/* Only show session details for the first trainer row of this session */}
                                      {tIdx === 0 && (
                                        <td
                                          className="px-3.5 py-2 font-semibold text-slate-800 align-middle"
                                          rowSpan={session.trainers.length}
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-slate-800 text-xs hover:text-blue-600 transition-colors flex items-center gap-1">
                                              <BookOpen className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                              {session.title}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                              Course: {session.course}
                                            </span>
                                          </div>
                                        </td>
                                      )}

                                      {/* Batch name */}
                                      {tIdx === 0 && (
                                        <td
                                          className="px-3.5 py-2 font-medium text-slate-500 align-middle"
                                          rowSpan={session.trainers.length}
                                        >
                                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/50 text-[10px] font-medium">
                                            {session.batch}
                                          </span>
                                        </td>
                                      )}

                                      {/* Trainer name */}
                                      <td className="px-3.5 py-2 align-middle font-medium text-slate-700">
                                        <div className="flex items-center gap-1.5">
                                          <div className="h-6 w-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-[10px] font-bold border border-blue-100">
                                            {trainer.name.charAt(0)}
                                          </div>
                                          <span className="font-semibold">
                                            {trainer.name}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Response count */}
                                      <td className="px-3.5 py-2 align-middle text-center font-bold text-slate-800">
                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100/50">
                                          {trainer.responseCount}
                                        </span>
                                      </td>

                                      {/* Rating Average */}
                                      <td className="px-3.5 py-2 align-middle text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          {trainer.avgRating > 0 ? (
                                            <span
                                              className={cn(
                                                "px-2 py-0.5 rounded border text-[11px] font-extrabold flex items-center gap-1 shadow-sm",
                                                getRatingBadgeClass(
                                                  trainer.avgRating,
                                                ),
                                              )}
                                            >
                                              <Star
                                                className={cn(
                                                  "h-3 w-3",
                                                  getRatingStarColor(
                                                    trainer.avgRating,
                                                  ),
                                                )}
                                              />
                                              {trainer.avgRating.toFixed(2)}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                              No ratings
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
