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
  FolderCode,
  Clock,
  BookOpen,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import { getAcademicConfig } from "@/services/superadmin/academicService";
import { getAnalyticsSessions } from "@/services/superadmin/sessionService";
import { cn } from "@/lib/utils";

const COLORS = [
  "#2563eb", // Blue 600
  "#059669", // Emerald 600
  "#d97706", // Amber 600
  "#dc2626", // Red 600
  "#7c3aed", // Violet 600
  "#db2777", // Pink 600
];

const OverviewTab = ({
  colleges,
  admins,
  projectCodes = [],
  isExporting = false,
}) => {
  const { sessions = [], trainers = [] } = useSuperAdminData();

  // Data State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsCache, setAnalyticsCache] = useState({});
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [fetchedFilteredSessions, setFetchedFilteredSessions] = useState([]);

  // Filter state
  const [filters, setFilters] = useState({
    projectCode: "all",
    collegeId: "all",
    trainerId: "all",
    course: "all",
    year: "all",
    batch: "all",
    dateRange: "all",
  });

  // Academic config for selected college
  const [academicOptions, setAcademicOptions] = useState(null);

  // Expand/collapse state for student sentiment cards
  const [expandedSections, setExpandedSections] = useState({});

  const aggregateStatsFromSessions = (sessionList) => {
    const agg = {
      // Count all sessions (active + inactive)
      totalSessions: sessionList.length,
      totalResponses: 0,
      ratingSum: 0,
      ratingCount: 0,
      totalHours: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryTotals: {},
      categoryCounts: {},
      qualitative: { high: [], low: [], future: [] },
      topicsLearned: {},
    };

    sessionList.forEach((s) => {
      const stats = s.compiledStats;

      // Always count session duration even if we don't have compiled stats yet
      agg.totalHours += s.sessionDuration ? (Number(s.sessionDuration) / 60) : 1;
      if (!stats) return;

      agg.totalResponses += stats.totalResponses || 0;

      // Rating sum and count from the session's overall stats
      const sessionAvg = Number(stats.avgRating) || 0;
      const sessionCount = Number(stats.totalResponses) || 0;
      
      if (sessionCount > 0) {
        agg.ratingSum += sessionAvg * sessionCount;
        agg.ratingCount += sessionCount;
      }

      // Qualitative Feedback - use comments if available
      const comments = [
        ...(stats.topComments || []),
        ...(stats.leastRatedComments || []),
        ...(stats.avgComments || []),
      ];

      comments.forEach((c) => {
        if (c.avgRating >= 4) agg.qualitative.high.push(c);
        else if (c.avgRating <= 2.5) agg.qualitative.low.push(c);
      });

      // Rating Distribution
      if (stats.ratingDistribution) {
        Object.entries(stats.ratingDistribution).forEach(([r, c]) => {
          agg.ratingDistribution[r] = (agg.ratingDistribution[r] || 0) + c;
        });
      }

      // Category Averages aggregation
      if (stats.categoryAverages) {
        Object.entries(stats.categoryAverages).forEach(([cat, avg]) => {
          if (!agg.categoryTotals[cat]) {
            agg.categoryTotals[cat] = 0;
            agg.categoryCounts[cat] = 0;
          }
          agg.categoryTotals[cat] += avg * sessionCount;
          agg.categoryCounts[cat] += sessionCount;
        });
      }

      // Topics
      if (stats.topicsLearned) {
        stats.topicsLearned.forEach(topic => {
          const name = topic.name.toLowerCase();
          agg.topicsLearned[name] = (agg.topicsLearned[name] || 0) + topic.count;
        });
      }

      // Future Topics
      if (stats.futureTopics) {
        stats.futureTopics.forEach(topic => {
          const name = (topic.name || "").toLowerCase();
          if (!agg.qualitative.futureTopics) agg.qualitative.futureTopics = {};
          if (!agg.qualitative.futureTopics[name]) {
            agg.qualitative.futureTopics[name] = { count: 0, ratingSum: 0 };
          }
          agg.qualitative.futureTopics[name].count += (topic.count || 1);
          agg.qualitative.futureTopics[name].ratingSum += (topic.avgRating || 0) * (topic.count || 1);
        });
      }
    });

    // Process future topics into list
    const future = Object.entries(agg.qualitative.futureTopics || {})
      .map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: data.count,
        avgRating: (data.ratingSum / data.count).toFixed(2)
      }))
      .sort((a, b) => b.count - a.count);

    // Formatting category averages
    const categoryAverages = {};
    Object.entries(agg.categoryTotals).forEach(([cat, sum]) => {
      const count = agg.categoryCounts[cat];
      categoryAverages[cat] = count > 0 ? (sum / count).toFixed(2) : 0;
    });

    return {
      ...agg,
      avgRating: agg.ratingCount > 0 ? (agg.ratingSum / agg.ratingCount).toFixed(2) : 0,
      categoryAverages,
      qualitative: {
        ...agg.qualitative,
        future
      }
    };
  };

  // Helper to check if filters are at default (all)
  const isDefaultView = useMemo(() => {
    return (
      filters.projectCode === "all" &&
      filters.collegeId === "all" &&
      filters.trainerId === "all" &&
      filters.course === "all" &&
      filters.year === "all" &&
      filters.batch === "all" &&
      filters.dateRange === "all"
    );
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      projectCode: "all",
      collegeId: "all",
      trainerId: "all",
      course: "all",
      year: "all",
      batch: "all",
      dateRange: "all",
    });
    setAcademicOptions(null);
  };

  // Calculate date range boundaries
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

  // Load academic config when college changes
  useEffect(() => {
    const loadAcademicConfig = async () => {
      if (filters.collegeId && filters.collegeId !== "all") {
        try {
          const config = await getAcademicConfig(filters.collegeId);
          setAcademicOptions(config || {});
        } catch (err) {
          console.error("Failed to load academic config:", err);
          setAcademicOptions({});
        }
      } else {
        setAcademicOptions(null);
      }
    };
    loadAcademicConfig();
  }, [filters.collegeId]);

  // Load analytics when filters change
  useEffect(() => {
    if (isDefaultView) {
      setAnalyticsData(null);
      setFetchedFilteredSessions([]);
      return;
    }

    const fetchAnalytics = async () => {
      const cacheKey = JSON.stringify(filters);
      if (analyticsCache[cacheKey]) {
        setAnalyticsData(analyticsCache[cacheKey].stats);
        setFetchedFilteredSessions(analyticsCache[cacheKey].sessions || []);
        return;
      }

      setIsFetchingAnalytics(true);
      try {
        const { startDate: sdObj, endDate: edObj } = getDateRange(filters.dateRange);
        const formatDate = (d) => {
          if (!d) return null;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        const fetchedSessions = await getAnalyticsSessions({
          ...filters,
          startDate: formatDate(sdObj),
          endDate: formatDate(edObj),
          limitCount: 50,
          includeActive: true, // Show live analytics in filtered view
        });

        const computedStats = aggregateStatsFromSessions(fetchedSessions);
        const cacheEntry = { stats: computedStats, sessions: fetchedSessions };

        setAnalyticsCache((prev) => ({ ...prev, [cacheKey]: cacheEntry }));
        setAnalyticsData(computedStats);
        setFetchedFilteredSessions(fetchedSessions);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setAnalyticsData(null);
      } finally {
        setIsFetchingAnalytics(false);
      }
    };

    const timer = setTimeout(fetchAnalytics, 300);
    return () => clearTimeout(timer);
  }, [filters, isDefaultView]);

  // Calculate aggregated stats from sessions
  const aggregatedStats = useMemo(() => {
    let result = null;
    if (!isDefaultView && analyticsData) {
      result = analyticsData;
    } else if (isDefaultView && sessions.length > 0) {
      result = aggregateStatsFromSessions(sessions);
    } else {
      result = {
        totalSessions: 0,
        totalResponses: 0,
        totalRatingsCount: 0,
        totalHours: 0,
        avgRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: {},
        qualitative: { high: [], low: [], future: [] },
        topicsLearned: [],
      };
    }

    return result;
  }, [analyticsData, sessions, isDefaultView, filters]);

  // College performance data for bar chart
  const allCollegesPerformance = useMemo(() => {
    const sessionList = isDefaultView ? sessions : fetchedFilteredSessions;
    if (!sessionList || sessionList.length === 0) return [];

    const collegeStats = {};
    colleges.forEach((college) => {
      collegeStats[college.id] = {
        name: college.code || college.id,
        fullName: college.name,
        ratingSum: 0,
        ratingCount: 0,
        responses: 0,
      };
    });

    sessionList.forEach((session) => {
      const stats = collegeStats[session.collegeId];
      if (!stats) return;

      const cs = session.compiledStats;
      if (cs) {
        Object.entries(cs.ratingDistribution || {}).forEach(([rating, count]) => {
          stats.ratingSum += Number(rating) * count;
          stats.ratingCount += count;
        });
        stats.responses += cs.totalResponses || 0;
      }
    });

    return Object.values(collegeStats)
      .map((data) => ({
        name: data.name,
        fullName: data.fullName,
        avgRating: data.ratingCount > 0 ? parseFloat((data.ratingSum / data.ratingCount).toFixed(2)) : 0,
        responses: data.responses,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .filter((d) => d.responses > 0)
      .slice(0, 30);
  }, [sessions, fetchedFilteredSessions, isDefaultView, colleges]);

  // Combined trend data for charts
  const trendData = useMemo(() => {
    const sessionList = isDefaultView ? sessions : fetchedFilteredSessions;
    if (!sessionList || sessionList.length === 0) return [];

    const trendMap = {};
    sessionList.forEach((s) => {
      const date = s.sessionDate;
      if (!date) return;
      if (!trendMap[date]) trendMap[date] = { responses: 0, sessions: 0 };
      const stats = s.compiledStats;
      if (stats) {
        trendMap[date].responses += stats.totalResponses || 0;
        trendMap[date].sessions += 1;
      }
    });

    return Object.entries(trendMap)
      .map(([dateStr, data]) => ({
        day: parseInt(dateStr.split("-")[2]),
        responses: data.responses,
        sessions: data.sessions,
        fullDate: dateStr,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .slice(-30);
  }, [sessions, fetchedFilteredSessions, isDefaultView]);

  const ratingDistributionData = useMemo(() => {
    const distribution = aggregatedStats.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return Object.entries(distribution).map(([rating, count]) => ({
      rating: `${rating} Star`,
      count: count || 0,
    }));
  }, [aggregatedStats]);

  const categoryRadarData = useMemo(() => {
    const categoryLabels = {
      knowledge: "Knowledge",
      communication: "Communication",
      engagement: "Engagement",
      content: "Content",
      delivery: "Delivery",
      overall: "Overall",
    };

    return Object.entries(aggregatedStats.categoryAverages || {}).map(([key, value]) => ({
      category: categoryLabels[key] || key,
      score: parseFloat(value) || 0,
      fullMark: 5,
    }));
  }, [aggregatedStats]);

  const availableCourses = useMemo(() => {
    if (!academicOptions?.courses) return [];
    return Object.keys(academicOptions.courses);
  }, [academicOptions]);

  const availableYears = useMemo(() => {
    if (!academicOptions?.courses || filters.course === "all") return [];
    const course = academicOptions.courses[filters.course];
    return course?.years ? Object.keys(course.years).sort() : [];
  }, [academicOptions, filters.course]);

  const availableBatches = useMemo(() => {
    if (!academicOptions?.courses || filters.course === "all") return [];
    const allBatches = new Set();
    const course = academicOptions.courses[filters.course];
    if (course?.years) {
      const yearsToScan = filters.year !== "all" ? [filters.year] : Object.keys(course.years);
      yearsToScan.forEach((yearKey) => {
        const yearData = course.years[yearKey];
        if (yearData?.departments) {
          Object.values(yearData.departments).forEach((deptData) => {
            if (deptData?.batches) deptData.batches.forEach((b) => allBatches.add(b));
          });
        }
      });
    }
    return [...allBatches].sort();
  }, [academicOptions, filters.course, filters.year]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-8">
      {/* Search & Filter Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Analytics Overview</h2>
          <p className="text-xs text-muted-foreground">Monitor performance and student feedback across all programs.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8 gap-1.5 text-[11px] font-medium bg-white hover:bg-slate-50 border-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
        <CardContent className="p-3 lg:p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Project Code */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Project</Label>
              <Select
                value={filters.projectCode}
                onValueChange={(v) => {
                  setFilters({
                    ...filters,
                    projectCode: v,
                    collegeId: "all",
                    course: "all",
                    year: "all",
                    batch: "all",
                  });
                }}
                disabled={filters.collegeId !== "all"}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 text-xs bg-white border-slate-200",
                    filters.collegeId !== "all" && "opacity-50"
                  )}
                >
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectCodes
                    .filter((pc) => pc.collegeId)
                    .map((pc) => (
                      <SelectItem key={pc.code} value={pc.code}>
                        {pc.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">College</Label>
              <Select
                value={filters.collegeId}
                onValueChange={(v) => {
                  setFilters({
                    ...filters,
                    collegeId: v,
                    projectCode: "all",
                    course: "all",
                    year: "all",
                    batch: "all",
                  });
                }}
                disabled={filters.projectCode !== "all"}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 text-xs bg-white border-slate-200",
                    filters.projectCode !== "all" && "opacity-50"
                  )}
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {colleges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Course</Label>
              <Select
                value={filters.course}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    course: v,
                    year: "all",
                    batch: "all",
                  })
                }
                disabled={filters.collegeId === "all"}
              >
                <SelectTrigger
                   className={cn(
                    "h-8 text-xs bg-white border-slate-200",
                    filters.collegeId === "all" && "opacity-50"
                  )}
                >
                  <SelectValue placeholder="All" />
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

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Year</Label>
              <Select
                value={filters.year}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    year: v,
                    batch: "all",
                  })
                }
                disabled={filters.course === "all"}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 text-xs bg-white border-slate-200",
                    filters.course === "all" && "opacity-50"
                  )}
                >
                  <SelectValue placeholder="All" />
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

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Batch</Label>
              <Select
                value={filters.batch}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    batch: v,
                  })
                }
                disabled={filters.year === "all"}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 text-xs bg-white border-slate-200",
                    filters.year === "all" && "opacity-50"
                  )}
                >
                  <SelectValue placeholder="All" />
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

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trainer</Label>
              <Select
                value={filters.trainerId}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    trainerId: v,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                  <SelectValue placeholder="All Trainers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trainers</SelectItem>
                  {trainers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Period</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    dateRange: v,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
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

      {/* Main Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Sessions", value: aggregatedStats.totalSessions, icon: ClipboardList, color: "blue", tag: "Completed" },
          { label: "Responses", value: aggregatedStats.totalResponses, icon: Users, color: "emerald", tag: "Received" },
          { label: "Avg Rating", value: aggregatedStats.avgRating, icon: Star, color: "amber", tag: "Aggregate", isRating: true },
          { label: "Training Hours", value: Math.round(aggregatedStats.totalHours), icon: Clock, color: "violet", tag: "Delivered" }
        ].map((stat, i) => (
          <Card key={i} className="relative overflow-hidden border-slate-200/60 shadow-sm transition-all hover:shadow-md group">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-slate-500 tracking-tight">{stat.label}</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-xl font-bold text-slate-900 leading-none tracking-tight">
                      {isFetchingAnalytics ? "..." : stat.value}
                    </h3>
                    {stat.isRating && <span className="text-[10px] font-semibold text-slate-400">/ 5.0</span>}
                  </div>
                </div>
                <div className={cn(
                  "p-2 rounded-lg transition-transform duration-300 group-hover:scale-105",
                  stat.color === "blue" && "bg-blue-50 text-blue-600",
                  stat.color === "emerald" && "bg-emerald-50 text-emerald-600",
                  stat.color === "amber" && "bg-amber-50 text-amber-600",
                  stat.color === "violet" && "bg-violet-50 text-violet-600",
                )}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none",
                  stat.color === "blue" && "bg-blue-100/50 text-blue-700",
                  stat.color === "emerald" && "bg-emerald-100/50 text-emerald-700",
                  stat.color === "amber" && "bg-amber-100/50 text-amber-700",
                  stat.color === "violet" && "bg-violet-100/50 text-violet-700",
                )}>
                  {stat.tag}
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">College Performance</CardTitle>
              <CardDescription className="text-[11px]">Average student ratings</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[280px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allCollegesPerformance} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 5]} hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#64748b"
                  fontSize={10}
                  width={60}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2 rounded-lg shadow-xl border-0 ring-1 ring-white/10">
                          <p className="font-bold text-[10px] mb-1 text-slate-300 uppercase tracking-widest">{data.fullName}</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-lg font-bold flex items-center gap-1">
                              {data.avgRating}
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            </span>
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400 leading-none">Responses</p>
                              <p className="text-xs font-bold">{data.responses}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avgRating" radius={[0, 4, 4, 0]} barSize={16}>
                  {allCollegesPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">Delivery Profile</CardTitle>
            <CardDescription className="text-[11px]">Performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={categoryRadarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9, fill: "#64748b", fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="#2563eb"
                  fillOpacity={0.15}
                />
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">Volume Trends</CardTitle>
              <CardDescription className="text-[11px]">Daily feedback collection</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[220px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="fullDate" 
                  fontSize={9} 
                  stroke="#94a3b8" 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }} 
                />
                <YAxis fontSize={9} stroke="#94a3b8" axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="responses"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorResponses)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">Rating Mix</CardTitle>
            <CardDescription className="text-[11px]">Star level breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px] p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistributionData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="rating" fontSize={9} stroke="#64748b" axisLine={false} tickLine={false} />
                <YAxis fontSize={9} stroke="#64748b" axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={20}>
                  {ratingDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Student Voices */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-slate-900 flex items-center justify-center">
            <MessageSquare className="h-3 w-3 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Student Sentiment</h2>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Qualitative insights</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Highlights",
              description: "Exceptional feedback",
              icon: <Sparkles className="h-3.5 w-3.5 text-emerald-600" />,
              color: "border-l-emerald-500",
              items: aggregatedStats.qualitative.high || [],
              empty: "No highlights yet.",
              theme: "emerald"
            },
            {
              title: "Attention",
              description: "Pain points",
              icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
              color: "border-l-red-500",
              items: aggregatedStats.qualitative.low || [],
              empty: "No concerns reported.",
              theme: "red"
            },
            {
              title: "Key Learning",
              description: "Topics mastered",
              icon: <BookOpen className="h-3.5 w-3.5 text-blue-600" />,
              color: "border-l-blue-500",
              items: Object.entries(aggregatedStats.topicsLearned || {})
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ text: name, count })),
              empty: "Analysis in progress.",
              theme: "blue"
            },
            {
              title: "Future Demand",
              description: "Upcoming interests",
              icon: <TrendingUp className="h-3.5 w-3.5 text-violet-600" />,
              color: "border-l-violet-500",
              items: (aggregatedStats.qualitative.future || []).map(item => ({
                ...item,
                // Ensure avgRating is hidden if it's 0 or null (often happens with text-only data)
                avgRating: Number(item.avgRating) > 0 ? item.avgRating : null
              })),
              empty: "No requests yet.",
              theme: "violet"
            },
          ].map((section) => {
            const expanded = expandedSections[section.title];
            const maxItems = 8;
            const itemsToShow = expanded ? section.items : section.items.slice(0, maxItems);
            const moreCount = Math.max(0, section.items.length - itemsToShow.length);

            return (
              <Card key={section.title} className={cn("flex flex-col h-[350px] border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow", section.color, "border-l-[4px]")}>
                <CardHeader className="p-3 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {section.icon}
                    <CardTitle className="text-xs font-bold text-slate-900">
                      {section.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    {section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <div className="h-full overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {section.items && section.items.length > 0 ? (
                      <>
                        {itemsToShow.map((item, index) => (
                          <div
                            key={`${section.title}-${index}`}
                            className="group rounded-lg border border-slate-100 p-2.5 bg-white hover:border-slate-200 transition-all"
                          >
                            <p className="text-[11px] leading-tight text-slate-700 font-medium italic">
                              "{item.text || item.value || item.name || "—"}"
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                              {item.avgRating != null && (
                                <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100/50">
                                  <Star className="h-2.5 w-2.5 fill-amber-600" />
                                  {item.avgRating}
                                </div>
                              )}
                              {item.count != null && (
                                <p className="text-[8px] font-bold text-slate-400 uppercase">
                                  {item.count} {item.count === 1 ? "Cit." : "Cits."}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}

                        {section.items.length > maxItems && (
                          <button
                            type="button"
                            onClick={() => setExpandedSections((prev) => ({
                              ...prev,
                              [section.title]: !prev[section.title],
                            }))}
                            className="w-full rounded-lg border border-dashed border-slate-200 bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            {expanded ? "Show less" : `+${moreCount} more...`}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-50">
                        <MessageSquare className="h-4 w-4 text-slate-300 mb-2" />
                        <p className="text-[10px] font-semibold text-slate-400 italic uppercase tracking-widest">{section.empty}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
