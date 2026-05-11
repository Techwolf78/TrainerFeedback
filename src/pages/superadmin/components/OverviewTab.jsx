import React, { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import {
  Building2,
  Users,
  Star,
  TrendingUp,
  ClipboardList,
  Calendar as CalendarIcon,
  Filter,
  RotateCcw,
  MessageSquare,
  FolderCode,
  Clock,
  BookOpen,
  Sparkles,
  AlertTriangle,
  Search,
  Frown,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { getResponseTrendData, getResponses, compileSessionStatsFromResponses } from "@/services/superadmin/responseService";
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
  const [filteredResponses, setFilteredResponses] = useState([]);

  // Filter state
  const [filters, setFilters] = useState({
    projectCode: "all",
    collegeId: "all",
    trainerId: "all",
    course: "all",
    year: "all",
    batch: "all",
    dateRange: "all",
    customStartDate: null,
    customEndDate: null,
  });

  const [searchQueries, setSearchQueries] = useState({
    projectCode: "",
    collegeId: "",
    trainerId: "",
    course: "",
    year: "",
    batch: "",
  });

  const handleSearchChange = (field, value) => {
    setSearchQueries((prev) => ({ ...prev, [field]: value }));
  };

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

    // Format topics learned as array
    const topicsLearnedArray = Object.entries(agg.topicsLearned || {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Formatting category averages
    const categoryAverages = {};
    Object.entries(agg.categoryTotals).forEach(([cat, sum]) => {
      const count = agg.categoryCounts[cat];
      categoryAverages[cat] = count > 0 ? (sum / count).toFixed(2) : 0;
    });

    return {
      ...agg,
      topicsLearned: topicsLearnedArray,
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
      customStartDate: null,
      customEndDate: null,
    });
    setSearchQueries({
      projectCode: "",
      collegeId: "",
      trainerId: "",
      course: "",
      year: "",
      batch: "",
    });
    setAcademicOptions(null);
  };

  // Calculate date range boundaries
  const getDateRange = (range, customStart, customEnd) => {
    if (range === "custom" && customStart && customEnd) {
      const startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
    
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
        // Don't pass date filters to getAnalyticsSessions when filtering by response submission date
        // Instead, load all sessions and filter responses by submission date separately
        const { startDate: sdObj, endDate: edObj } = getDateRange(
          filters.dateRange,
          filters.customStartDate,
          filters.customEndDate
        );
        
        const formatDate = (d) => {
          if (!d) return null;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        // If date range filter is active, don't pass dates to getAnalyticsSessions
        // We'll filter by response submission date instead
        const shouldFilterByResponseDate = sdObj && edObj && filters.dateRange !== "all";
        
        const fetchedSessions = await getAnalyticsSessions({
          ...filters,
          ...(shouldFilterByResponseDate ? {} : {
            startDate: formatDate(sdObj),
            endDate: formatDate(edObj),
          }),
          limitCount: 50,
          includeActive: true, // Show live analytics in filtered view
        });

        console.log("📊 Sessions fetched for analytics:", fetchedSessions.length, "shouldFilterByResponseDate:", shouldFilterByResponseDate);
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

  // Load and filter responses by submission date when date range is active
  useEffect(() => {
    const loadFilteredResponses = async () => {
      if (filters.dateRange === "all" || fetchedFilteredSessions.length === 0) {
        setFilteredResponses([]);
        return;
      }

      try {
        // Load all responses for filtered sessions with sessionId attached
        const allResponsesToLoad = await Promise.all(
          fetchedFilteredSessions.map((session) =>
            getResponses(session.id)
              .then((responses) =>
                responses.map((r) => ({ ...r, sessionId: session.id }))
              )
              .catch(() => [])
          )
        );

        let allResponses = allResponsesToLoad.flat();

        // Filter by response submission date
        const { startDate, endDate } = getDateRange(
          filters.dateRange,
          filters.customStartDate,
          filters.customEndDate
        );

        if (startDate && endDate) {
          allResponses = allResponses.filter((response) => {
            let responseDate;
            if (response.submittedAt?.toDate) {
              responseDate = response.submittedAt.toDate();
            } else if (typeof response.submittedAt === "string") {
              responseDate = new Date(response.submittedAt);
            } else if (response.submittedAt instanceof Date) {
              responseDate = response.submittedAt;
            }

            const isInRange = responseDate >= startDate && responseDate <= endDate;
            return isInRange;
          });
        }

        setFilteredResponses(allResponses);
      } catch (error) {
        console.error("Error loading filtered responses:", error);
        setFilteredResponses([]);
      }
    };

    loadFilteredResponses();
  }, [fetchedFilteredSessions, filters.dateRange, filters.customStartDate, filters.customEndDate]);

  // Calculate aggregated stats from sessions
  const aggregatedStats = useMemo(() => {
    let result = null;

    // If date range filter is active and we have filtered responses, recalculate from responses
    if (!isDefaultView && filters.dateRange !== "all" && filteredResponses.length > 0) {
      const compiledStats = compileSessionStatsFromResponses(filteredResponses);

      // Build question-to-category map from sessions
      const questionCategoryMap = {};
      fetchedFilteredSessions.forEach((session) => {
        if (session.questions && Array.isArray(session.questions)) {
          session.questions.forEach((q) => {
            if (q.id && q.category) {
              questionCategoryMap[q.id] = q.category;
            }
          });
        }
      });

      // Calculate category averages from individual responses
      const categoryStats = {};
      filteredResponses.forEach((response) => {
        const answers = response.answers || [];
        answers.forEach((ans) => {
          const category = questionCategoryMap[ans.questionId];
          const isRating = (ans.type || "").toLowerCase() === "rating" || (ans.type || "").toLowerCase() === "overall";
          const rating = Number(ans.value);

          if (category && isRating && rating > 0) {
            if (!categoryStats[category]) {
              categoryStats[category] = { sum: 0, count: 0 };
            }
            categoryStats[category].sum += rating;
            categoryStats[category].count += 1;
          }
        });
      });

      const categoryAverages = {};
      Object.entries(categoryStats).forEach(([cat, data]) => {
        categoryAverages[cat] = data.count > 0 ? (data.sum / data.count).toFixed(2) : 0;
      });

      // Get unique session IDs that actually have responses in this date range
      const sessionIdsWithResponses = new Set(filteredResponses.map(r => r.sessionId));
      const sessionsInThisRange = fetchedFilteredSessions.filter(s => sessionIdsWithResponses.has(s.id));

      result = {
        totalSessions: sessionsInThisRange.length,
        totalResponses: compiledStats.totalResponses || 0,
        totalRatingsCount: Object.values(compiledStats.ratingDistribution || {}).reduce((a, b) => a + b, 0),
        totalHours: (Number(sessionsInThisRange.reduce((sum, s) => sum + (Number(s.sessionDuration) || 60), 0)) || 0) / 60,
        avgRating: (compiledStats.avgRating || 0).toFixed(2),
        ratingDistribution: compiledStats.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages,
        qualitative: {
          high: compiledStats.topComments || [],
          low: compiledStats.leastRatedComments || [],
          future: compiledStats.futureTopics || [],
        },
        topicsLearned: compiledStats.topicsLearned || [],
      };
    } else if (!isDefaultView && filters.dateRange !== "all" && analyticsData) {
      // When date range is filtered but we don't have filtered responses yet, return empty structure
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
    } else if (!isDefaultView && analyticsData) {
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
  }, [analyticsData, sessions, isDefaultView, filters, filteredResponses, fetchedFilteredSessions]);

  // College performance data for bar chart
  const allCollegesPerformance = useMemo(() => {
    if (!colleges || colleges.length === 0) return [];

    // When date range is filtered, use filteredResponses (even if empty)
    const shouldUseFilteredResponses = !isDefaultView && filters.dateRange !== "all";
    
    if (shouldUseFilteredResponses) {
      if (filteredResponses.length === 0) return [];
      // Group responses by college
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

      // Calculate from filtered responses
      filteredResponses.forEach((response) => {
        const session = fetchedFilteredSessions.find(s => s.id === response.sessionId);
        if (!session) return;
        
        const stats = collegeStats[session.collegeId];
        if (!stats) return;
        
        stats.responses += 1;
        
        // Count ratings from answers
        const answers = response.answers || [];
        answers.forEach((ans) => {
          const rating = Number(ans.value);
          if ((ans.type || "").toLowerCase() === "rating" && rating > 0) {
            stats.ratingSum += rating;
            stats.ratingCount += 1;
          }
        });
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
    } else {
      // Use session-based calculation for non-filtered view
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
    }
  }, [sessions, fetchedFilteredSessions, isDefaultView, colleges, filters.dateRange, filteredResponses]);

  // Combined trend data for charts - group by response submission dates
  const [trendData, setTrendData] = React.useState([]);
  
  useEffect(() => {
    const calculateTrendData = async () => {
      // When date range is filtered, use filteredResponses (even if empty)
      const shouldUseFilteredResponses = !isDefaultView && filters.dateRange !== "all";
      
      if (shouldUseFilteredResponses) {
        if (filteredResponses.length === 0) {
          setTrendData([]);
          return;
        }
        // Calculate trend from filtered responses
        const dateMap = {};
        filteredResponses.forEach((response) => {
          let responseDate;
          if (response.submittedAt?.toDate) {
            responseDate = response.submittedAt.toDate();
          } else if (typeof response.submittedAt === "string") {
            responseDate = new Date(response.submittedAt);
          } else if (response.submittedAt instanceof Date) {
            responseDate = response.submittedAt;
          }

          if (responseDate) {
            const dateStr = `${responseDate.getFullYear()}-${String(responseDate.getMonth() + 1).padStart(2, "0")}-${String(responseDate.getDate()).padStart(2, "0")}`;
            dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
          }
        });

        const chartData = Object.entries(dateMap)
          .map(([dateStr, responseCount]) => ({
            day: parseInt(dateStr.split("-")[2]),
            responses: responseCount,
            sessions: 0,
            fullDate: dateStr,
          }))
          .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

        setTrendData(chartData);
      } else {
        // Use session-based trend data for non-filtered view
        const sessionList = isDefaultView ? sessions : fetchedFilteredSessions;
        if (!sessionList || sessionList.length === 0) {
          setTrendData([]);
          return;
        }

        const sessionIds = sessionList.map((s) => s.id).filter(Boolean);
        if (sessionIds.length === 0) {
          setTrendData([]);
          return;
        }

        try {
          const responseTrendMap = await getResponseTrendData(sessionIds);

          const chartData = Object.entries(responseTrendMap)
            .map(([dateStr, responseCount]) => ({
              day: parseInt(dateStr.split("-")[2]),
              responses: responseCount,
              sessions: 0,
              fullDate: dateStr,
            }))
            .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
            .slice(-30);

          setTrendData(chartData);
        } catch (error) {
          console.error("Error calculating trend data:", error);
          setTrendData([]);
        }
      }
    };

    calculateTrendData();
  }, [sessions, fetchedFilteredSessions, isDefaultView, filters.dateRange, filteredResponses]);

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
              className="h-8 gap-1.5 text-[11px] font-medium hover:text-black bg-white hover:bg-slate-50 border-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
        <CardContent className="p-3 lg:p-4">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
            {/* Project Code */}
            <div className="space-y-1 w-[120px]">
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
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search projects..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.projectCode}
                        onChange={(e) => handleSearchChange("projectCode", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectCodes
                    .filter((pc) => pc.collegeId && (!searchQueries.projectCode || pc.code.toLowerCase().includes(searchQueries.projectCode.toLowerCase())))
                    .map((pc) => (
                      <SelectItem key={pc.code} value={pc.code}>
                        {pc.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-[120px]">
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
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search colleges..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.collegeId}
                        onChange={(e) => handleSearchChange("collegeId", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {colleges
                    .filter((c) => !searchQueries.collegeId || c.code.toLowerCase().includes(searchQueries.collegeId.toLowerCase()))
                    .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-[120px]">
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
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search courses..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.course}
                        onChange={(e) => handleSearchChange("course", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Courses</SelectItem>
                  {availableCourses
                    .filter((c) => !searchQueries.course || c.toLowerCase().includes(searchQueries.course.toLowerCase()))
                    .map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-[70px]">
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
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search years..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.year}
                        onChange={(e) => handleSearchChange("year", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears
                    .filter((y) => !searchQueries.year || y.toLowerCase().includes(searchQueries.year.toLowerCase()))
                    .map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-[70px]">
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
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search batches..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.batch}
                        onChange={(e) => handleSearchChange("batch", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Batches</SelectItem>
                  {availableBatches
                    .filter((b) => !searchQueries.batch || b.toLowerCase().includes(searchQueries.batch.toLowerCase()))
                    .map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-[120px]">
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
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search trainers..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.trainerId}
                        onChange={(e) => handleSearchChange("trainerId", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all">All Trainers</SelectItem>
                  {trainers
                    .filter((t) => !searchQueries.trainerId || t.name.toLowerCase().includes(searchQueries.trainerId.toLowerCase()))
                    .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 w-[120px]">
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
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filters.dateRange === "custom" && (
              <div className="space-y-1 self-end mb-0">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Select Dates</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "h-8 w-[220px] justify-start text-left font-normal text-xs bg-white border-slate-200",
                        !filters.customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {filters.customStartDate ? (
                        filters.customEndDate ? (
                          <>
                            {format(filters.customStartDate, "LLL dd, y")}{" - "}
                            {format(filters.customEndDate, "LLL dd, y")}
                          </>
                        ) : (
                          format(filters.customStartDate, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={filters.customStartDate}
                      selected={{
                        from: filters.customStartDate,
                        to: filters.customEndDate,
                      }}
                      onSelect={(range) => {
                        setFilters({
                          ...filters,
                          customStartDate: range?.from,
                          customEndDate: range?.to,
                        });
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
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
            {allCollegesPerformance.length > 0 ? (
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
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Frown className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium">Sorry, no data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">Delivery Profile</CardTitle>
            <CardDescription className="text-[11px]">Performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] p-2 pt-0">
            {categoryRadarData.length > 0 ? (
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
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Frown className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium">Sorry, no data available</p>
              </div>
            )}
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
            {trendData.length > 0 ? (
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
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Frown className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium">Sorry, no data available</p>
              </div>
            )}
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
              items: (aggregatedStats.topicsLearned || []).map(topic => ({
                text: topic.name || topic,
                count: topic.count || 1
              })),
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
