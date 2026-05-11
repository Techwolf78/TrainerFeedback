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
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
// Removed legacy mock imports
import { getAnalyticsSessions } from "@/services/superadmin/sessionService"; 
import { toast } from "sonner";

const TrainerOverview = ({ sessions = [], isLoading: isDashboardLoading = false }) => {
  const { user } = useAuth();

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsCache, setAnalyticsCache] = useState({});
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    collegeId: "all",
    course: "all",
    department: "all",
    year: "all",
    batch: "all",
    dateRange: "all",
  });

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

  // Unique Colleges from Sessions
  const availableColleges = useMemo(() => {
    const uniqueMap = new Map();
    sessions.forEach((s) => {
      if (s.collegeId && s.collegeName) {
        uniqueMap.set(s.collegeId, s.collegeName);
      }
    });
    return Array.from(uniqueMap, ([id, name]) => ({ id, name }));
  }, [sessions]);

  // Unique Courses
  const availableCourses = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);

    const courses = [...new Set(filtered.map((s) => s.course))].filter(Boolean);
    return courses.sort();
  }, [sessions, filters.collegeId]);

  // Unique Years (Dependent on Course)
  const availableYears = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);
    if (filters.course !== "all")
      filtered = filtered.filter((s) => s.course === filters.course);

    const years = [...new Set(filtered.map((s) => s.year))].filter(Boolean);
    return years.sort();
  }, [sessions, filters.collegeId, filters.course]);

  // Unique Departments (Dependent on Course AND Year)
  const availableDepartments = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);
    if (filters.course !== "all")
      filtered = filtered.filter((s) => s.course === filters.course);
    if (filters.year !== "all")
      filtered = filtered.filter((s) => s.year === filters.year);

    const depts = [
      ...new Set(filtered.map((s) => s.branch || s.department)),
    ].filter(Boolean);
    return depts.sort();
  }, [sessions, filters.collegeId, filters.course, filters.year]);

  // Unique Batches (Dependent on Course AND Year AND Dept)
  const availableBatches = useMemo(() => {
    let filtered = sessions;
    if (filters.collegeId !== "all")
      filtered = filtered.filter((s) => s.collegeId === filters.collegeId);
    if (filters.course !== "all")
      filtered = filtered.filter((s) => s.course === filters.course);
    if (filters.year !== "all")
      filtered = filtered.filter((s) => s.year === filters.year);
    if (filters.department !== "all")
      filtered = filtered.filter(
        (s) => (s.branch || s.department) === filters.department,
      );

    const batches = [...new Set(filtered.map((s) => s.batch))].filter(Boolean);
    return batches.sort();
  }, [
    sessions,
    filters.collegeId,
    filters.course,
    filters.year,
    filters.department,
  ]);

  // --- Filtered Data & Stats Aggregation ---

  // --- Dynamic Analytics Fetching ---

  const getCacheKey = (filters) => {
    return JSON.stringify({
      trainerId: user?.id || user?.uid, // Filter by current trainer
      ...filters,
    });
  };

  const aggregateStatsFromSessions = (sessionList) => {
    const stats = {
      totalResponses: 0,
      totalRatingsCount: 0,
      ratingSum: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryTotals: {},
      categoryCounts: {},
      totalSessions: sessionList.length,
      totalHours: 0,
      qualitative: { high: [], low: [], avg: [], future: [] }
    };

    sessionList.forEach((session) => {
      const cs = session.compiledStats;
      if (!cs) return;

      stats.totalResponses += cs.totalResponses || 0;
      stats.totalHours += (Number(session.sessionDuration) || 60) / 60;

      Object.entries(cs.ratingDistribution || {}).forEach(([rating, count]) => {
        stats.ratingDistribution[rating] =
          (stats.ratingDistribution[rating] || 0) + count;
        stats.ratingSum += Number(rating) * count;
        stats.totalRatingsCount += count;
      });

      Object.entries(cs.categoryAverages || {}).forEach(([cat, avg]) => {
        const count = cs.totalResponses || 1;
        stats.categoryTotals[cat] =
          (stats.categoryTotals[cat] || 0) + avg * count;
        stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + count;
      });

      // Comment date fallback helper for UI
      const withDate = (comment) => ({
        ...comment,
        date:
          comment.date ||
          comment.createdAt ||
          comment.submittedAt ||
          session.sessionDate ||
          session.closedAt ||
          session.updatedAt ||
          null,
      });

      // Aggregate qualitative feedback with date fallback
      if (cs.topComments)
        stats.qualitative.high.push(...cs.topComments.map((c) => withDate(c)));
      if (cs.leastRatedComments)
        stats.qualitative.low.push(...cs.leastRatedComments.map((c) => withDate(c)));
      if (cs.avgComments)
        stats.qualitative.avg.push(...cs.avgComments.map((c) => withDate(c)));
      if (cs.futureTopics)
        stats.qualitative.future.push(...cs.futureTopics.map((c) => withDate(c)));
    });

    const avgRating =
      stats.totalRatingsCount > 0
        ? (stats.ratingSum / stats.totalRatingsCount).toFixed(2)
        : "0.00";

    const categoryAverages = {};
    Object.keys(stats.categoryTotals).forEach((cat) => {
      categoryAverages[cat] =
        stats.categoryCounts[cat] > 0
          ? (stats.categoryTotals[cat] / stats.categoryCounts[cat]).toFixed(2)
          : 0;
    });

    // Sort and limit qualitative insights
    return {
      totalSessions: stats.totalSessions,
      totalResponses: stats.totalResponses,
      totalRatingsCount: stats.totalRatingsCount,
      totalHours: stats.totalHours,
      avgRating,
      ratingDistribution: stats.ratingDistribution,
      categoryAverages,
      qualitative: {
        high: stats.qualitative.high.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0)).slice(0, 5),
        low: stats.qualitative.low.sort((a, b) => (a.avgRating || 0) - (b.avgRating || 0)).slice(0, 5),
        future: stats.qualitative.future.sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 10)
      },
    };
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      const trainerId = user?.id || user?.uid;
      if (!trainerId) return;

      const cacheKey = getCacheKey(filters);
      if (analyticsCache[cacheKey]) {
        setAnalyticsData(analyticsCache[cacheKey]);
        return;
      }

      setIsFetchingAnalytics(true);
      try {
        const fetchedSessions = await getAnalyticsSessions({
          trainerId,
          ...filters,
          limitCount: 50,
          includeActive: true, // include active sessions too
        });

        const computedStats = aggregateStatsFromSessions(fetchedSessions);

        setAnalyticsCache((prev) => ({ ...prev, [cacheKey]: computedStats }));
        setAnalyticsData(computedStats);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setAnalyticsData(null);
      } finally {
        setIsFetchingAnalytics(false);
      }
    };

    const timer = setTimeout(fetchAnalytics, 300);
    return () => clearTimeout(timer);
  }, [filters, user]);

  const filteredSessions = useMemo(() => [], []);

  const aggregatedStats = useMemo(() => {
    // 1. Initial State / Global View -> Use aggregation of all trainer sessions
    const isDefaultView =
      filters.collegeId === "all" &&
      filters.course === "all" &&
      filters.department === "all" &&
      filters.year === "all" &&
      filters.batch === "all" &&
      filters.dateRange === "all";

    if (isDefaultView && sessions.length > 0) {
      return aggregateStatsFromSessions(sessions);
    }

    // 2. Filtered View -> Use Dynamic Data
    return (
      analyticsData || {
        totalSessions: 0,
        totalResponses: 0,
        totalRatingsCount: 0,
        totalHours: 0,
        avgRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: {},
        qualitative: { high: [], low: [], future: [] },
      }
    );
  }, [analyticsData, sessions, filters]);

  // 1. Rating Distribution
  const ratingDistributionData = useMemo(() => {
    const distribution = aggregatedStats.ratingDistribution || {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    return Object.entries(distribution).map(([rating, count]) => ({
      rating: `${rating} Star`,
      count: count || 0,
    }));
  }, [aggregatedStats]);

  // 2. Category Breakdown
  const categoryRadarData = useMemo(() => {
    const labels = {
      knowledge: "Knowledge",
      communication: "Communication",
      engagement: "Engagement",
      content: "Content Quality",
      delivery: "Delivery",
      overall: "Overall",
    };
    return Object.entries(aggregatedStats.categoryAverages || {}).map(
      ([key, value]) => ({
        category: labels[key] || key,
        score: parseFloat(value) || 0,
        fullMark: 5,
      }),
    );
  }, [aggregatedStats]);

  // Response Trend - compute from sessions instead of cache trends
  const responseTrend = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];

    const trendMap = {};
    sessions.forEach((s) => {
      const date = s.sessionDate; // 'YYYY-MM-DD'
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
  }, [sessions]);

  const trendPeriod = useMemo(() => {
    if (!responseTrend || responseTrend.length === 0) return "current month";
    const first = responseTrend[0].fullDate;
    const last = responseTrend[responseTrend.length - 1].fullDate;
    const firstMonth = first?.slice(0, 7);
    const lastMonth = last?.slice(0, 7);
    if (!firstMonth || !lastMonth) return "current month";
    return firstMonth === lastMonth ? firstMonth : `${firstMonth} - ${lastMonth}`;
  }, [responseTrend]);

  if (isDashboardLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters (Commented out for now as requested) */}
      {/* 
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            <Button variant="default" size="sm" onClick={resetFilters} className="gap-2 bg-primary hover:bg-primary/90 text-white">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
             <div className="space-y-1">
              <Label className="text-xs">College</Label>
              <Select 
                value={filters.collegeId} 
                onValueChange={v => setFilters({...filters, collegeId: v, course: 'all', department: 'all', year: 'all', batch: 'all'})}
              >
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {availableColleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Course</Label>
              <Select 
                value={filters.course} 
                onValueChange={v => setFilters({...filters, course: v, year: 'all', department: 'all', batch: 'all'})}
              >
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {availableCourses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Select 
                value={filters.year} 
                onValueChange={v => setFilters({...filters, year: v, department: 'all', batch: 'all'})}
                disabled={filters.course === 'all'}
              >
                <SelectTrigger className={filters.course === 'all' ? 'opacity-50' : ''}>
                   <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select 
                value={filters.department} 
                onValueChange={v => setFilters({...filters, department: v, batch: 'all'})}
                disabled={filters.year === 'all'}
              >
                <SelectTrigger className={filters.year === 'all' ? 'opacity-50' : ''}>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {availableDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Batch</Label>
              <Select 
                value={filters.batch} 
                onValueChange={v => setFilters({...filters, batch: v})}
                disabled={filters.department === 'all'}
              >
                <SelectTrigger className={filters.department === 'all' ? 'opacity-50' : ''}>
                   <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {availableBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={v => setFilters({...filters, dateRange: v})}>
                <SelectTrigger><SelectValue placeholder="All Time" /></SelectTrigger>
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
      */}

      {/* Stats Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Responses
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {aggregatedStats.totalResponses}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Student Responses
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Average Rating
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {aggregatedStats.avgRating}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i <= Math.round(Number(aggregatedStats.avgRating)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                out of 5.0
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {aggregatedStats.totalSessions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Conducted Sessions
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {aggregatedStats.totalHours}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Training Hours Delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts - Row 1 */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Category Breakdown (Now First) */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>
              Performance across feedback categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {categoryRadarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="53%"
                    outerRadius="50%"
                    data={categoryRadarData}
                  >
                    <PolarGrid />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={(props) => {
                        const { payload, x, y, textAnchor, index } = props;
                        const categoryData = categoryRadarData[index];
                        if (categoryData) {
                          const isBottom = y > 128;
                          return (
                            <g>
                              <text
                                x={x}
                                y={isBottom ? y + 12 : y - 15}
                                textAnchor={textAnchor}
                                fill="hsl(var(--foreground))"
                                fontSize={10}
                                fontWeight="normal"
                              >
                                {payload.value}
                              </text>
                              <text
                                x={x}
                                y={isBottom ? y + 26 : y - 1}
                                textAnchor={textAnchor}
                                fill="hsl(var(--primary))"
                                fontSize={11}
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
                            fill="hsl(var(--foreground))"
                            fontSize={10}
                          >
                            {payload.value}
                          </text>
                        );
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 5]}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 9,
                      }}
                      tickCount={6}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.4}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px" }}
                      formatter={(value) => [
                        parseFloat(value).toFixed(2),
                        "Score",
                      ]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution (Now Second) */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>
              X: Star Rating | Y: Response Count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDistributionData}>
                  <defs>
                    <linearGradient
                      id="barGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={1}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.6}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    vertical={false}
                  />
                  <XAxis dataKey="rating" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ borderRadius: "8px" }}
                    formatter={(value) => [value, "Responses"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#barGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Response Trend & Student Voices */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Response Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Response Trend</CardTitle>
            <CardDescription>
              X: Day | Y: Responses ({trendPeriod})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {responseTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={responseTrend}>
                    <defs>
                      <linearGradient
                        id="colorResponses"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="day"
                      className="text-xs"
                      tickFormatter={(day) => `${day}`}
                    />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(day) => `Day ${day}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="responses"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      activeDot={{ r: 6 }}
                      fillOpacity={1}
                      fill="url(#colorResponses)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No trend data available for this month yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Student Voices */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Student Voices</CardTitle>
            </div>
            <CardDescription>Highlights from student feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {aggregatedStats.qualitative && (
              <Tabs defaultValue="high" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger
                    value="high"
                    className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800 text-xs"
                  >
                    Praise
                  </TabsTrigger>
                  <TabsTrigger
                    value="low"
                    className="data-[state=active]:bg-red-100 data-[state=active]:text-red-800 text-xs"
                  >
                    Concerns
                  </TabsTrigger>
                  <TabsTrigger
                    value="future"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 text-xs"
                  >
                    Future Topics
                  </TabsTrigger>
                </TabsList>

                {["high", "low"].map((type) => (
                  <TabsContent key={type} value={type} className="mt-0">
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {aggregatedStats.qualitative?.[type]?.length > 0 ? (
                        aggregatedStats.qualitative[type]
                          .slice(0, 5)
                          .map((comment, idx) => (
                            <div
                              key={idx}
                              className={`flex flex-col p-3 rounded-lg border ${type === "high" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-3 w-3 ${star <= Math.round(Number(comment.rating || comment.avgRating || 0)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                                    />
                                  ))}
                                </div>
                                {comment.date || comment.createdAt ? (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(comment.date || comment.createdAt).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">No date</span>
                                )}
                              </div>
                              <p className="text-sm italic text-foreground/80 mb-2">
                                "{comment.text}"
                              </p>
                              <div
                                className={`pt-2 border-t flex justify-between items-center text-xs text-muted-foreground font-medium ${type === "high" ? "border-green-100" : "border-red-100"}`}
                              >
                                <span
                                  className={`opacity-70 px-1.5 py-0.5 bg-white/50 rounded-md border ${type === "high" ? "border-green-200/50" : "border-red-200/50"}`}
                                >
                                  {comment.course}
                                </span>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm italic">
                          No {type === "high" ? "praise" : "concerns"} yet.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                ))}

                {/* Future Topics Tab */}
                <TabsContent value="future" className="mt-0">
                  <div className="max-h-80 overflow-y-auto pr-1">
                    {aggregatedStats.qualitative?.future?.length > 0 ? (
                      <div className="flex flex-wrap gap-2 p-2">
                        {aggregatedStats.qualitative.future.map(
                          (topic, idx) => (
                            <div
                              key={idx}
                              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-sm font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all cursor-default shadow-sm hover:shadow-md"
                            >
                              <Sparkles className="h-3.5 w-3.5 opacity-70 group-hover:animate-pulse" />
                              {topic.name || topic.text}
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm italic">
                        No future topics suggested yet.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrainerOverview;
