import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Users,
  Star,
  TrendingUp,
  ClipboardList,
  Calendar,
  Filter,
  RotateCcw,
  MessageSquare,
  RefreshCw,
  BookOpen,
  Clock,
  Sparkles,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getAllSessions } from "@/services/superadmin/sessionService";
import { getAllTrainers } from "@/services/superadmin/trainerService";
import { getAcademicConfig } from "@/services/superadmin/academicService";

const CollegeAnalytics = ({ collegeId, collegeName, collegeLogo, onBack }) => {
  const [loading, setLoading] = useState(true);

  // Data State
  const [sessions, setSessions] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [academicOptions, setAcademicOptions] = useState(null);

  // Filter State
  const [filters, setFilters] = useState({
    projectCode: "all",
    trainerId: "all",
    course: "all",
    department: "all",
    year: "all",
    batch: "all",
    dateRange: "all",
  });

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      if (!collegeId) return;

      setLoading(true);
      try {
        const results = await Promise.all([
          getAllSessions(collegeId),
          getAllTrainers(1000),
          getAcademicConfig(collegeId),
        ]);

        setSessions(results[0] || []);
        setTrainers(results[1]?.trainers || []);
        setAcademicOptions(results[2]);
      } catch (error) {
        console.error("Failed to load college analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [collegeId]);

  // Helper Functions
  const resetFilters = () => {
    setFilters({
      projectCode: "all",
      trainerId: "all",
      course: "all",
      department: "all",
      year: "all",
      batch: "all",
      dateRange: "all",
    });
  };

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

  // Extract available lists for filters
  const availableCourses = useMemo(() => {
    if (!academicOptions?.courses) return [];
    return Object.keys(academicOptions.courses);
  }, [academicOptions]);

  const availableYears = useMemo(() => {
    if (!academicOptions?.courses || filters.course === "all") return [];
    const course = academicOptions.courses[filters.course];
    if (course?.years) {
      return Object.keys(course.years).sort();
    }
    return [];
  }, [academicOptions, filters.course]);

  const availableDepartments = useMemo(() => {
    if (!academicOptions?.courses || filters.course === "all") return [];
    const allDepts = new Set();
    const course = academicOptions.courses[filters.course];

    if (course?.years) {
      if (filters.year !== "all") {
        const yearData = course.years[filters.year];
        if (yearData?.departments) {
          Object.keys(yearData.departments).forEach((d) => allDepts.add(d));
        }
      } else {
        Object.values(course.years).forEach((yearData) => {
          if (yearData?.departments) {
            Object.keys(yearData.departments).forEach((d) => allDepts.add(d));
          }
        });
      }
    }
    return [...allDepts].sort();
  }, [academicOptions, filters.course, filters.year]);

  const availableBatches = useMemo(() => {
    if (!academicOptions?.courses || filters.course === "all") return [];
    const allBatches = new Set();
    const course = academicOptions.courses[filters.course];

    if (course?.years) {
      const yearsToScan =
        filters.year !== "all" ? [filters.year] : Object.keys(course.years);

      yearsToScan.forEach((yearKey) => {
        const yearData = course.years[yearKey];
        if (!yearData?.departments) return;

        const deptsToScan =
          filters.department !== "all"
            ? [filters.department]
            : Object.keys(yearData.departments);

        deptsToScan.forEach((deptKey) => {
          const deptData = yearData.departments[deptKey];
          if (deptData?.batches) {
            deptData.batches.forEach((b) => allBatches.add(b));
          }
        });
      });
    }

    return [...allBatches].sort();
  }, [academicOptions, filters.course, filters.department, filters.year]);

  const filteredSessions = useMemo(() => {
    if (sessions.length === 0) return [];

    return sessions.filter((session) => {
      // Allow both inactive (compiled) and active (live) sessions to show up
      if (!session.compiledStats) return false;

      if (
        filters.trainerId !== "all" &&
        session.assignedTrainer?.id !== filters.trainerId
      )
        return false;
      if (filters.course !== "all" && session.course !== filters.course)
        return false;
      if (filters.department !== "all" && session.branch !== filters.department)
        return false;
      if (filters.year !== "all" && session.year !== filters.year) return false;
      if (filters.batch !== "all" && session.batch !== filters.batch)
        return false;

      if (filters.dateRange !== "all") {
        const { startDate, endDate } = getDateRange(filters.dateRange);
        if (startDate && endDate) {
          const sessionDate = new Date(session.sessionDate);
          if (sessionDate < startDate || sessionDate > endDate) return false;
        }
      }
      return true;
    });
  }, [sessions, filters]);

  // Aggregate stats from filtered sessions
  const aggregatedStats = useMemo(() => {
    if (filteredSessions.length === 0) {
      return {
        totalSessions: 0,
        totalResponses: 0,
        totalRatingsCount: 0,
        totalHours: 0,
        avgRating: "0.00",
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: {},
        qualitative: { high: [], low: [], future: [] },
        topicsLearned: [],
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
      allTopics: {},
    };

    filteredSessions.forEach((session) => {
      const cs = session.compiledStats;
      if (!cs) return;

      const sessionCount = cs.totalResponses || 0;
      stats.totalResponses += sessionCount;
      stats.totalHours += (Number(session.sessionDuration) || 60) / 60;

      // Use rating distribution if present
      if (cs.ratingDistribution) {
        Object.entries(cs.ratingDistribution).forEach(([rating, count]) => {
          stats.ratingDistribution[rating] = (stats.ratingDistribution[rating] || 0) + count;
          stats.ratingSum += Number(rating) * count;
          stats.totalRatingsCount += count;
        });
      } else if (cs.avgRating) {
        // Fallback for live stats that might not have full distribution yet
        stats.ratingSum += (cs.avgRating || 0) * sessionCount;
        stats.totalRatingsCount += sessionCount;
      }

      // Aggregate Category Averages
      if (cs.categoryAverages) {
        Object.entries(cs.categoryAverages).forEach(([cat, avg]) => {
          stats.categoryTotals[cat] = (stats.categoryTotals[cat] || 0) + avg * sessionCount;
          stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + sessionCount;
        });
      }

      // Aggregate topics
      if (cs.topicsLearned) {
        cs.topicsLearned.forEach((topic) => {
          const name = topic.name.toLowerCase();
          stats.allTopics[name] = (stats.allTopics[name] || 0) + topic.count;
        });
      }
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

    const topicsLearned = Object.entries(stats.allTopics)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
      .slice(0, 10);

    return {
      totalSessions: filteredSessions.length,
      totalResponses: stats.totalResponses,
      totalRatingsCount: stats.totalRatingsCount,
      totalHours: stats.totalHours,
      avgRating,
      ratingDistribution: stats.ratingDistribution,
      categoryAverages,
      qualitative: { high: [], low: [], future: [] },
      topicsLearned,
    };
  }, [filteredSessions]);

  // Response trend
  const responseTrend = useMemo(() => {
    const trendMap = {};
    filteredSessions.forEach((session) => {
      const date = session.sessionDate;
      const responses = session.compiledStats?.totalResponses || 0;
      trendMap[date] = (trendMap[date] || 0) + responses;
    });

    return Object.entries(trendMap)
      .map(([date, responses]) => ({
        fullDate: date,
        day: new Date(date).getDate(),
        responses,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [filteredSessions]);

  // Category radar data
  const categoryRadarData = useMemo(() => {
    const categoryLabels = {
      knowledge: "Knowledge",
      communication: "Communication",
      engagement: "Engagement",
      content: "Content Quality",
      delivery: "Delivery",
      overall: "Overall",
    };

    return Object.entries(aggregatedStats.categoryAverages || {}).map(
      ([key, value]) => ({
        category: categoryLabels[key] || key,
        score: parseFloat(value) || 0,
        fullMark: 5,
      }),
    );
  }, [aggregatedStats]);

  // Domain Analytics
  const domainAnalyticsData = useMemo(() => {
    const domainMap = {};
    filteredSessions.forEach((session) => {
      const domain = session.domain || "Other";
      if (!domainMap[domain]) {
        domainMap[domain] = { responses: 0, ratingSum: 0, ratingsCount: 0 };
      }

      const cs = session.compiledStats;
      if (cs) {
        domainMap[domain].responses += cs.totalResponses || 0;
        Object.entries(cs.ratingDistribution || {}).forEach(
          ([rating, count]) => {
            domainMap[domain].ratingSum += Number(rating) * count;
            domainMap[domain].ratingsCount += count;
          },
        );
      }
    });

    let totalResponses = 0;
    const chartData = Object.entries(domainMap).map(([name, data]) => {
      totalResponses += data.responses;
      return {
        name,
        responses: data.responses,
        avgRating:
          data.ratingsCount > 0
            ? parseFloat((data.ratingSum / data.ratingsCount).toFixed(2))
            : 0,
        totalRatings: data.ratingsCount,
      };
    });

    return { chartData, totalResponses };
  }, [filteredSessions]);

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

  const topTrainers = useMemo(() => {
    const trainerStats = {};
    filteredSessions.forEach((session) => {
      const trainerId = session.assignedTrainer?.id;
      const trainerName = session.assignedTrainer?.name || "Unknown";
      if (!trainerId) return;

      if (!trainerStats[trainerId]) {
        trainerStats[trainerId] = {
          name: trainerName,
          ratingSum: 0,
          ratingCount: 0,
          sessions: 0,
          responses: 0,
          recentComments: [],
        };
      }

      const cs = session.compiledStats;
      if (cs) {
        Object.entries(cs.ratingDistribution || {}).forEach(
          ([rating, count]) => {
            trainerStats[trainerId].ratingSum += Number(rating) * count;
            trainerStats[trainerId].ratingCount += count;
          },
        );
        trainerStats[trainerId].responses += cs.totalResponses || 0;
        trainerStats[trainerId].sessions += 1;
        const comments = cs.comments || [];
        comments.slice(0, 2).forEach((c) => {
          if (trainerStats[trainerId].recentComments.length < 3) {
            trainerStats[trainerId].recentComments.push({
              text: typeof c === "string" ? c : c.text,
              date: session.sessionDate,
            });
          }
        });
      }
    });

    return Object.entries(trainerStats)
      .map(([id, data]) => ({
        id,
        ...data,
        avgRating:
          data.ratingCount > 0
            ? (data.ratingSum / data.ratingCount).toFixed(1)
            : 0,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);
  }, [filteredSessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-primary/5 print:hidden"
          >
            <ArrowLeft className="h-6 w-6 text-primary" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-foreground">
              {collegeName || "College Analytics"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deep dive into institutional performance and feedback
            </p>
          </div>
        </div>

        {collegeLogo && (
          <img
            src={collegeLogo}
            alt={collegeName}
            className="h-16 w-auto object-contain"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={resetFilters}
                className="gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Course</Label>
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
                <SelectTrigger>
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
              <Label className="text-xs">Department</Label>
              <Select
                value={filters.department}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    department: v,
                    year: "all",
                    batch: "all",
                  })
                }
                disabled={filters.course === "all"}
              >
                <SelectTrigger
                  className={filters.course === "all" ? "opacity-50" : ""}
                >
                  <SelectValue placeholder="All" />
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

            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Select
                value={filters.year}
                onValueChange={(v) =>
                  setFilters({ ...filters, year: v, batch: "all" })
                }
                disabled={filters.course === "all"}
              >
                <SelectTrigger
                  className={filters.course === "all" ? "opacity-50" : ""}
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      Year {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Batch</Label>
              <Select
                value={filters.batch}
                onValueChange={(v) => setFilters({ ...filters, batch: v })}
                disabled={filters.course === "all"}
              >
                <SelectTrigger
                  className={filters.course === "all" ? "opacity-50" : ""}
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
              <Label className="text-xs">Time Range</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(v) => setFilters({ ...filters, dateRange: v })}
              >
                <SelectTrigger>
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

            <div className="space-y-1">
              <Label className="text-xs">Trainer</Label>
              <Select
                value={filters.trainerId}
                onValueChange={(v) => setFilters({ ...filters, trainerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Overall Rating
                </p>
                <h3 className="text-2xl font-bold text-primary mt-1">
                  {aggregatedStats.avgRating}
                </h3>
              </div>
              <div className="bg-primary/10 p-2 rounded-full">
                <Star className="h-5 w-5 text-primary fill-primary" />
              </div>
            </div>
            <div className="mt-4 h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{
                  width: `${(parseFloat(aggregatedStats.avgRating) / 5) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Responses
                </p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {aggregatedStats.totalResponses}
                </h3>
              </div>
              <div className="bg-blue-500/10 p-2 rounded-full">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Across {aggregatedStats.totalSessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Training Hours
                </p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  {Math.round(aggregatedStats.totalHours)}h
                </h3>
              </div>
              <div className="bg-green-500/10 p-2 rounded-full">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Total engagement time
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active Domains
                </p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">
                  {domainAnalyticsData.chartData.length}
                </h3>
              </div>
              <div className="bg-purple-500/10 p-2 rounded-full">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Areas of training
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Response volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {responseTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={responseTrend}>
                    <defs>
                      <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--muted-foreground)/0.1)"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border p-3 rounded-lg shadow-xl">
                              <p className="text-xs text-muted-foreground font-medium mb-1">
                                {payload[0].payload.fullDate}
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                                <p className="text-sm font-bold">
                                  {payload[0].value} Responses
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="responses"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorRes)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Scores</CardTitle>
            <CardDescription>Metrics breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {categoryRadarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryRadarData}>
                    <PolarGrid stroke="hsl(var(--muted-foreground)/0.2)" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
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
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.5}
                    />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No category data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Feedback volume by star rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDistributionData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="hsl(var(--muted-foreground)/0.1)"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="rating"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border p-2 rounded shadow-lg">
                            <p className="text-sm font-bold">
                              {payload[0].value} ratings
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  >
                    {ratingDistributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 4
                            ? "#22c55e"
                            : index === 3
                              ? "#84cc16"
                              : index === 2
                                ? "#eab308"
                                : index === 1
                                  ? "#f97316"
                                  : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Trainers</CardTitle>
            <CardDescription>Highest rated for this college</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topTrainers.length > 0 ? (
                topTrainers.map((trainer, idx) => (
                  <div key={trainer.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-none">
                          {trainer.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {trainer.sessions} sessions · {trainer.responses} responses
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                      <Star className="h-3 w-3 text-primary fill-primary" />
                      <span className="text-xs font-bold text-primary">
                        {trainer.avgRating}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No trainer data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Topics Summary</CardTitle>
            <CardDescription>Most frequently mentioned topics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {aggregatedStats.topicsLearned.length > 0 ? (
                aggregatedStats.topicsLearned.map((topic, i) => (
                  <div key={i} className="flex items-center gap-2 bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-full">
                    <span className="text-xs font-medium">{topic.name}</span>
                    <span className="text-[10px] bg-primary/10 px-1.5 rounded-full text-primary">
                      {topic.count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground w-full">
                  No topic data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domain Breakdown</CardTitle>
            <CardDescription>Performance by training category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {domainAnalyticsData.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={domainAnalyticsData.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="responses"
                    >
                      {domainAnalyticsData.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.3 + (index * 0.1)})`} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No domain data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CollegeAnalytics;
