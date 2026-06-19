import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  generateAlertsFromFeedbacks,
  getResolvedAlerts,
} from "@/services/superadmin/alertService";

export default function WeeklyAnalyticsTab() {
  const { sessions, colleges, trainers } = useSuperAdminData();
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});

  // Resolved state for alerts
  const [resolvedAlertIds, setResolvedAlertIds] = useState(new Set());

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
      sessions,
      trainers,
      colleges
    );
    return computed.filter((a) => !resolvedAlertIds.has(a.id)).length;
  }, [feedbacks, sessions, trainers, colleges, resolvedAlertIds]);

  // Date filter states
  const [preset, setPreset] = useState("last7"); // last7, thisWeek, lastWeek, last30, custom
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

  // Handle preset clicks
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
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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
      default:
        return; // custom allows manual change
    }

    setStartDate(start);
    setEndDate(end);
  };

  // Fetch feedbacks for selected range
  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const data = await getFeedbacksByDateRange(start, end);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [startDate, endDate]);

  // Format Helper: Get YYYY-MM-DD key
  const formatDateKey = (date) => {
    if (!date || isNaN(date.getTime())) return "Unknown Date";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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
    const sessionMap = {};
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
  }, [feedbacks, colleges, trainers, sessions]);

  // Overall range stats
  const rangeStats = useMemo(() => {
    let responseCount = feedbacks.length;
    let ratingSum = 0;
    let ratingCount = 0;
    const activeTrainers = new Set();
    const activeColleges = new Set();

    const sessionMap = {};
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
  }, [feedbacks, sessions]);

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
      {/* 1. Header Filter Section */}
      <Card className="border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <CardHeader className="pb-2.5 pt-3 px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-500" />
                Daily Feedbacks
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500 mt-0.5">
                Day-wise structured hierarchy showing College → Session →
                Trainer with instant counts and averages.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-slate-200 hover:bg-slate-50 hover:text-slate-700 gap-1.5"
                onClick={fetchFeedbacks}
                disabled={loading}
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3",
                    loading ? "animate-spin text-blue-500" : "",
                  )}
                />
                Refresh Data
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
                className="h-8 text-xs border-slate-200 hover:bg-slate-50 hover:text-slate-700"
              >
                {isAllExpanded ? "Collapse All" : "Expand All"}
              </Button>
              <div className="relative inline-block">
                <Button
                  size="sm"
                  onClick={() => navigate("/super-admin/weekly-analytics/alerts")}
                  className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold border-0 shadow-sm"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Calculated Alerts
                </Button>
                {unresolvedAlertsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-white shadow animate-bounce">
                    {unresolvedAlertsCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="border-t border-slate-100 pt-3 pb-3 px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            {/* Quick Presets */}
            <div className="col-span-1 lg:col-span-6 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Date Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "last7", label: "Last 7 Days" },
                  { id: "thisWeek", label: "This Week" },
                  { id: "lastWeek", label: "Last Week" },
                  { id: "last30", label: "Last 30 Days" },
                  { id: "custom", label: "Custom Range" },
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={preset === item.id ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs px-3 font-medium rounded-lg transition-all",
                      preset === item.id
                        ? "bg-slate-800 text-white hover:bg-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700",
                    )}
                    onClick={() => applyPreset(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Range Date Fields */}
            <div className="col-span-1 lg:col-span-6 grid grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full h-8 text-xs px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  value={startDate.toISOString().split("T")[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      setPreset("custom");
                      const d = new Date(e.target.value);
                      d.setHours(0, 0, 0, 0);
                      setStartDate(d);
                    }
                  }}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full h-8 text-xs px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  value={endDate.toISOString().split("T")[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      setPreset("custom");
                      const d = new Date(e.target.value);
                      d.setHours(23, 59, 59, 999);
                      setEndDate(d);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Key Metrics Card Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          {
            label: "Total Feedbacks",
            value: rangeStats.responseCount,
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
            className="border-slate-200 bg-white shadow-sm overflow-hidden relative"
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
      {loading ? (
        <Card className="border-slate-200 bg-white p-12 shadow-sm text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="h-10 w-10 text-blue-500 animate-spin" />
            <h4 className="text-sm font-bold text-slate-700">
              Loading daily feedbacks...
            </h4>
            <p className="text-xs text-slate-500">
              Querying Firestore feedbacks and mapping relationships.
            </p>
          </div>
        </Card>
      ) : groupedData.length === 0 ? (
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
        <div className="space-y-2">
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
