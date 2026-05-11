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
  Search,
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
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAllSessions } from "@/services/superadmin/sessionService";
import { getAllTrainers } from "@/services/superadmin/trainerService";
import { getAcademicConfig } from "@/services/superadmin/academicService";
import { getResponseTrendData, getResponses, compileSessionStatsFromResponses } from "@/services/superadmin/responseService";

// Helper function to get a color from red (0) to yellow (2.5) to green (5)
const getDynamicColor = (rating) => {
  const safeRating = Number(rating) || 0;
  // Hue 0 = red, 60 = yellow, 120 = green
  const hue = Math.max(0, Math.min(120, (safeRating / 5) * 120));
  // Professional, muted tones (lower saturation)
  return `hsl(${hue}, 65%, 45%)`;
};

// Professional palette for categorical data (e.g., domains)
const DOMAIN_COLORS = [
  "hsl(215, 85%, 55%)", // Blue
  "hsl(275, 75%, 60%)", // Purple
  "hsl(330, 80%, 65%)", // Pink
  "hsl(175, 75%, 45%)", // Teal
  "hsl(30, 90%, 60%)",  // Orange
  "hsl(245, 75%, 65%)", // Indigo
  "hsl(350, 80%, 65%)", // Coral
  "hsl(190, 85%, 50%)", // Cyan
];

const CollegeAnalytics = ({ collegeId, collegeName, collegeLogo, onBack }) => {
  const [loading, setLoading] = useState(true);

  // Data State
  const [sessions, setSessions] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [academicOptions, setAcademicOptions] = useState(null);
  const [filteredResponses, setFilteredResponses] = useState([]);

  // Filter State
  const [filters, setFilters] = useState({
    projectCode: "all",
    trainerId: "all",
    course: "all",
    department: "all",
    year: "all",
    batch: "all",
    dateRange: "all",
    customStartDate: null,
    customEndDate: null,
  });

  const [searchQueries, setSearchQueries] = useState({
    trainerId: "",
    course: "",
    department: "",
    year: "",
    batch: "",
  });

  const handleSearchChange = (field, value) => {
    setSearchQueries((prev) => ({ ...prev, [field]: value }));
  };

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
      customStartDate: null,
      customEndDate: null,
    });
    setSearchQueries({
      trainerId: "",
      course: "",
      department: "",
      year: "",
      batch: "",
    });
  };

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

    // If date range filter is active, recalculate from individual responses
    if (filters.dateRange !== "all" && filteredResponses.length > 0) {
      const compiledStats = compileSessionStatsFromResponses(filteredResponses);
      
      // Build question-to-category map from sessions
      const questionCategoryMap = {};
      filteredSessions.forEach((session) => {
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
      
      return {
        totalSessions: filteredSessions.length,
        totalResponses: compiledStats.totalResponses || 0,
        totalRatingsCount: Object.values(compiledStats.ratingDistribution || {}).reduce((a, b) => a + b, 0),
        totalHours: (Number(filteredSessions.reduce((sum, s) => sum + (Number(s.sessionDuration) || 60), 0)) || 0) / 60,
        avgRating: (compiledStats.avgRating || 0).toFixed(2),
        ratingDistribution: compiledStats.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages,
        qualitative: { high: compiledStats.topComments || [], low: compiledStats.leastRatedComments || [], future: compiledStats.futureTopics || [] },
        topicsLearned: compiledStats.topicsLearned || [],
      };
    }

    // Default: Use pre-compiled session stats
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
          stats.ratingDistribution[rating] =
            (stats.ratingDistribution[rating] || 0) + count;
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
          stats.categoryTotals[cat] =
            (stats.categoryTotals[cat] || 0) + avg * sessionCount;
          stats.categoryCounts[cat] =
            (stats.categoryCounts[cat] || 0) + sessionCount;
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
  }, [filteredSessions, filteredResponses, filters.dateRange]);

  // Load and filter responses by submission date
  useEffect(() => {
    const loadFilteredResponses = async () => {
      if (filteredSessions.length === 0) {
        setFilteredResponses([]);
        return;
      }

      try {
        // Load all responses for filtered sessions with sessionId attached
        const allResponsesToLoad = await Promise.all(
          filteredSessions.map((session) =>
            getResponses(session.id)
              .then((responses) =>
                responses.map((r) => ({ ...r, sessionId: session.id }))
              )
              .catch(() => [])
          )
        );
        
        let allResponses = allResponsesToLoad.flat();

        // Filter by response submission date if date range is not "all"
        if (filters.dateRange !== "all") {
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
              
              return responseDate >= startDate && responseDate <= endDate;
            });
          }
        }

        setFilteredResponses(allResponses);
      } catch (error) {
        console.error("Error loading filtered responses:", error);
        setFilteredResponses([]);
      }
    };

    loadFilteredResponses();
  }, [filteredSessions, filters.dateRange, filters.customStartDate, filters.customEndDate]);

  // Response trend - group by actual response submission dates
  const [responseTrendData, setResponseTrendData] = React.useState([]);

  React.useEffect(() => {
    const calculateResponseTrend = async () => {
      if (filteredSessions.length === 0) {
        setResponseTrendData([]);
        return;
      }

      try {
        let responsesToProcess = filteredResponses;

        // If no date range filter, fetch all responses from all sessions
        if (filters.dateRange === "all" && responsesToProcess.length === 0) {
          const sessionIds = filteredSessions.map((s) => s.id).filter(Boolean);
          if (sessionIds.length === 0) {
            setResponseTrendData([]);
            return;
          }
          
          const responseTrendMap = await getResponseTrendData(sessionIds);
          const chartData = Object.entries(responseTrendMap)
            .map(([date, responses]) => ({
              fullDate: date,
              day: new Date(date).getDate(),
              responses,
            }))
            .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

          setResponseTrendData(chartData);
          return;
        }

        // Build trend map from filtered responses
        const trendMap = {};
        responsesToProcess.forEach((response) => {
          let date;

          if (response.submittedAt?.toDate) {
            const dateObj = response.submittedAt.toDate();
            date = dateObj.toISOString().split("T")[0];
          } else if (typeof response.submittedAt === "string") {
            date = response.submittedAt.split("T")[0];
          } else if (response.submittedAt instanceof Date) {
            date = response.submittedAt.toISOString().split("T")[0];
          }

          if (date) {
            trendMap[date] = (trendMap[date] || 0) + 1;
          }
        });

        const chartData = Object.entries(trendMap)
          .map(([date, responses]) => ({
            fullDate: date,
            day: new Date(date).getDate(),
            responses,
          }))
          .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

        setResponseTrendData(chartData);
      } catch (error) {
        console.error("Error calculating response trend:", error);
        setResponseTrendData([]);
      }
    };

    calculateResponseTrend();
  }, [filteredSessions, filteredResponses, filters.dateRange]);

  const responseTrend = responseTrendData;

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

    // Use filtered responses if date range is active
    if (filters.dateRange !== "all" && filteredResponses.length > 0) {
      const sessionMap = {};
      filteredSessions.forEach((session) => {
        sessionMap[session.id] = session;
      });

      filteredResponses.forEach((response) => {
        const session = sessionMap[response.sessionId];
        if (!session) return;

        const domain = session.domain || "Other";
        if (!domainMap[domain]) {
          domainMap[domain] = { responses: 0, ratingSum: 0, ratingsCount: 0 };
        }

        domainMap[domain].responses += 1;

        // Extract ratings from response answers
        const answers = response.answers || [];
        const ratingAnswers = answers.filter(
          (a) => (a.type || "").toLowerCase() === "rating" || (a.type || "").toLowerCase() === "overall"
        );
        ratingAnswers.forEach((a) => {
          const rating = Number(a.value) || 0;
          if (rating > 0) {
            domainMap[domain].ratingSum += rating;
            domainMap[domain].ratingsCount += 1;
          }
        });
      });
    } else {
      // Default: Use session compiled stats
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
    }

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
  }, [filteredSessions, filteredResponses, filters.dateRange]);

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

    // Use filtered responses if date range is active
    if (filters.dateRange !== "all" && filteredResponses.length > 0) {
      // Build trainer stats from filtered responses
      const sessionMap = {};
      filteredSessions.forEach((session) => {
        sessionMap[session.id] = session;
      });

      filteredResponses.forEach((response) => {
        const sessionId = response.sessionId;
        const session = sessionMap[sessionId];
        if (!session) return;

        const trainerId = session.assignedTrainer?.id;
        const trainerName = session.assignedTrainer?.name || "Unknown";
        if (!trainerId) return;

        if (!trainerStats[trainerId]) {
          trainerStats[trainerId] = {
            name: trainerName,
            ratingSum: 0,
            ratingCount: 0,
            sessions: new Set(),
            responses: 0,
            recentComments: [],
            domains: new Set(),
            topics: new Set(),
          };
        }

        if (session.domain) {
          trainerStats[trainerId].domains.add(session.domain);
        }

        if (session.topic) {
          trainerStats[trainerId].topics.add(session.topic);
        }

        trainerStats[trainerId].sessions.add(session.id);
        trainerStats[trainerId].responses += 1;

        // Extract ratings from response answers
        const answers = response.answers || [];
        const ratingAnswers = answers.filter(
          (a) => (a.type || "").toLowerCase() === "rating" || (a.type || "").toLowerCase() === "overall"
        );
        ratingAnswers.forEach((a) => {
          const rating = Number(a.value) || 0;
          if (rating > 0) {
            trainerStats[trainerId].ratingSum += rating;
            trainerStats[trainerId].ratingCount += 1;
          }
        });

        // Extract comments
        const textAnswers = answers.filter(
          (a) =>
            ((a.type || "").toLowerCase() === "text" ||
              (a.type || "").toLowerCase() === "comment" ||
              (a.type || "").toLowerCase() === "feedback") &&
            a.value?.trim()
        );
        textAnswers.forEach((a) => {
          if (trainerStats[trainerId].recentComments.length < 3) {
            trainerStats[trainerId].recentComments.push({
              text: a.value,
              date: session.sessionDate,
            });
          }
        });
      });

      return Object.entries(trainerStats)
        .map(([id, data]) => ({
          id,
          ...data,
          domains: Array.from(data.domains),
          topics: Array.from(data.topics),
          sessions: data.sessions.size,
          avgRating:
            data.ratingCount > 0
              ? parseFloat((data.ratingSum / data.ratingCount).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 10);
    }

    // Default: Use session compiled stats
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
          domains: new Set(),
          topics: new Set(),
        };
      }

      if (session.domain) {
        trainerStats[trainerId].domains.add(session.domain);
      }

      if (session.topic) {
        trainerStats[trainerId].topics.add(session.topic);
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
        domains: Array.from(data.domains),
        topics: Array.from(data.topics),
        avgRating:
          data.ratingCount > 0
            ? (data.ratingSum / data.ratingCount).toFixed(1)
            : 0,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);
  }, [filteredSessions, filteredResponses, filters.dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 bg-background">
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
            <h1 className="text-xl font-bold text-foreground">
              {collegeName || "College Analytics"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deep dive into institutional performance and feedback
            </p>
          </div>
        </div>

        {collegeLogo && (
          <img
            src={collegeLogo}
            alt={collegeName}
            className="h-10 w-auto object-contain"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
      </div>

      <Card className="py-0">
        <CardHeader className="pb-0.5 pt-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="text-sm">Filters</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="default"
                size="sm"
                onClick={resetFilters}
                className="gap-1 h-6 px-1.5 bg-primary hover:bg-primary/90 text-white text-[13px] font-medium"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-1.5">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-1.5">
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold">Course</Label>
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
                <SelectTrigger className="h-7 text-[13px] font-medium px-2">
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
                  <SelectItem value="all" className="text-[13px] font-medium">
                    All Courses
                  </SelectItem>
                  {availableCourses
                    .filter((c) => !searchQueries.course || c.toLowerCase().includes(searchQueries.course.toLowerCase()))
                    .map((c) => (
                    <SelectItem key={c} value={c} className="text-[13px] font-medium">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold">Department</Label>
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
                  className={`h-7 text-[13px] font-medium px-2 ${filters.course === "all" ? "opacity-50" : ""}`}
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input 
                        type="text" 
                        placeholder="Search departments..." 
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700" 
                        value={searchQueries.department}
                        onChange={(e) => handleSearchChange("department", e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                      />
                    </div>
                  </div>
                  <SelectItem value="all" className="text-[13px] font-medium">
                    All Departments
                  </SelectItem>
                  {availableDepartments
                    .filter((d) => !searchQueries.department || d.toLowerCase().includes(searchQueries.department.toLowerCase()))
                    .map((d) => (
                    <SelectItem key={d} value={d} className="text-[13px] font-medium">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5 col-span-1">
              <Label className="text-[11px] font-semibold">Year</Label>
              <Select
                value={filters.year}
                onValueChange={(v) =>
                  setFilters({ ...filters, year: v, batch: "all" })
                }
                disabled={filters.course === "all"}
              >
                <SelectTrigger
                  className={`h-7 text-[13px] font-medium px-2 ${filters.course === "all" ? "opacity-50" : ""}`}
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
                  <SelectItem value="all" className="text-[13px] font-medium">
                    All Years
                  </SelectItem>
                  {availableYears
                    .filter((y) => !searchQueries.year || y.toLowerCase().includes(searchQueries.year.toLowerCase()))
                    .map((y) => (
                    <SelectItem key={y} value={y} className="text-[13px] font-medium">
                      Year {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5 col-span-1">
              <Label className="text-[11px] font-semibold">Batch</Label>
              <Select
                value={filters.batch}
                onValueChange={(v) => setFilters({ ...filters, batch: v })}
                disabled={filters.course === "all"}
              >
                <SelectTrigger
                  className={`h-7 text-[13px] font-medium px-2 ${filters.course === "all" ? "opacity-50" : ""}`}
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
                  <SelectItem value="all" className="text-[13px] font-medium">
                    All Batches
                  </SelectItem>
                  {availableBatches
                    .filter((b) => !searchQueries.batch || b.toLowerCase().includes(searchQueries.batch.toLowerCase()))
                    .map((b) => (
                    <SelectItem key={b} value={b} className="text-[13px] font-medium">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5 col-span-2">
              <Label className="text-[11px] font-semibold">Time Range</Label>
              <div className="flex gap-1">
                <Select
                  value={filters.dateRange}
                  onValueChange={(v) => {
                    if (v !== "custom") {
                      setFilters({
                        ...filters,
                        dateRange: v,
                        customStartDate: null,
                        customEndDate: null,
                      });
                    } else {
                      setFilters({ ...filters, dateRange: v });
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-[13px] font-medium px-2 flex-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[13px] font-medium">
                      All Time
                    </SelectItem>
                    <SelectItem value="7days" className="text-[13px] font-medium">
                      Last 7 Days
                    </SelectItem>
                    <SelectItem value="30days" className="text-[13px] font-medium">
                      Last 30 Days
                    </SelectItem>
                    <SelectItem value="90days" className="text-[13px] font-medium">
                      Last 90 Days
                    </SelectItem>
                    <SelectItem value="custom" className="text-[13px] font-medium">
                      Custom
                    </SelectItem>
                  </SelectContent>
                </Select>

                {filters.dateRange === "custom" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-7 text-[13px] font-medium px-2 justify-start text-left font-normal flex-1"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {filters.customStartDate && filters.customEndDate
                            ? `${format(filters.customStartDate, "dd MMM")} - ${format(filters.customEndDate, "dd MMM")}`
                            : filters.customStartDate
                              ? `${format(filters.customStartDate, "dd MMM")} - ?`
                              : filters.customEndDate
                                ? `? - ${format(filters.customEndDate, "dd MMM")}`
                                : "Select dates"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="range"
                        selected={{
                          from: filters.customStartDate,
                          to: filters.customEndDate,
                        }}
                        onSelect={(range) => {
                          setFilters({
                            ...filters,
                            customStartDate: range?.from || null,
                            customEndDate: range?.to || null,
                          });
                        }}
                        initialFocus
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold">Trainer</Label>
              <Select
                value={filters.trainerId}
                onValueChange={(v) => setFilters({ ...filters, trainerId: v })}
              >
                <SelectTrigger className="h-7 text-[13px] font-medium px-2">
                  <SelectValue placeholder="All" />
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
                  <SelectItem value="all" className="text-[13px] font-medium">
                    All Trainers
                  </SelectItem>
                  {trainers
                    .filter((t) => !searchQueries.trainerId || t.name.toLowerCase().includes(searchQueries.trainerId.toLowerCase()))
                    .map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-[13px] font-medium">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">
                  Overall Rating
                </p>
                <h3 className="text-xl font-bold text-primary mt-0.5">
                  {aggregatedStats.avgRating}
                </h3>
              </div>
              <div className="p-1.5 rounded-full" style={{ backgroundColor: getDynamicColor(aggregatedStats.avgRating).replace('hsl', 'hsla').replace(')', ', 0.1)') }}>
                <Star className="h-4 w-4" style={{ fill: getDynamicColor(aggregatedStats.avgRating), color: getDynamicColor(aggregatedStats.avgRating) }} />
              </div>
            </div>
            <div className="mt-2 h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: getDynamicColor(aggregatedStats.avgRating).replace('hsl', 'hsla').replace(')', ', 0.1)') }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(parseFloat(aggregatedStats.avgRating) / 5) * 100}%`,
                  backgroundColor: getDynamicColor(aggregatedStats.avgRating)
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">
                  Total Responses
                </p>
                <h3 className="text-xl font-bold text-blue-600 mt-0.5">
                  {aggregatedStats.totalResponses}
                </h3>
              </div>
              <div className="bg-blue-500/10 p-1.5 rounded-full">
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Across {aggregatedStats.totalSessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">
                  Training Hours
                </p>
                <h3 className="text-xl font-bold text-green-600 mt-0.5">
                  {Math.round(aggregatedStats.totalHours)}h
                </h3>
              </div>
              <div className="bg-green-500/10 p-1.5 rounded-full">
                <Clock className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Total engagement time
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">
                  Active Domains
                </p>
                <h3 className="text-xl font-bold text-purple-600 mt-0.5">
                  {domainAnalyticsData.chartData.length}
                </h3>
              </div>
              <div className="bg-purple-500/10 p-1.5 rounded-full">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Areas of training
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">Performance Trend</CardTitle>
            <CardDescription className="text-[10px]">
              Response volume
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
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
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border p-1.5 rounded-lg shadow-xl">
                              <p className="text-[10px] text-muted-foreground font-medium mb-0.5">
                                {payload[0].payload.fullDate}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <p className="text-[13px] font-bold">
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
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRes)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[13px] font-medium">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">Category Scores</CardTitle>
            <CardDescription className="text-[10px]">
              Metrics breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              {categoryRadarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={categoryRadarData}
                  >
                    <PolarGrid stroke="hsl(var(--muted-foreground)/0.2)" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={(props) => {
                        const { payload, x, y, textAnchor, index } = props;
                        const categoryData = categoryRadarData[index];
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
                          <text x={x} y={y} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))" fontSize={9}>
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

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">Domain Breakdown</CardTitle>
            <CardDescription className="text-[10px]">
              Training performance
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              {domainAnalyticsData.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={domainAnalyticsData.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="responses"
                    >
                      {domainAnalyticsData.chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[13px] font-medium">
                  No domain data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">Rating Distribution</CardTitle>
            <CardDescription className="text-[10px]">
              Feedback volume
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
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
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border p-1.5 rounded shadow-lg">
                            <p className="text-[13px] font-bold">
                              {payload[0].value} ratings
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
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
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">Trainers</CardTitle>
            <CardDescription className="text-[10px]">
              Highest rated
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[160px] overflow-hidden scrollbar-hide">
            <div className="space-y-2">
              {topTrainers.length > 0 ? (
                topTrainers.map((trainer, idx) => (
                  <div
                    key={trainer.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                        #{idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[13px] font-medium leading-none">
                          {trainer.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {trainer.sessions} sessions · {trainer.responses}{" "}
                          responses
                        </p>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {trainer.domains.map((domain, i) => (
                            <span
                              key={i}
                              className="px-1 py-0.5 bg-blue-500/10 text-blue-600 rounded text-[10px] font-medium"
                            >
                              {domain}
                            </span>
                          ))}
                          {trainer.topics.slice(0, 3).map((topic, i) => (
                            <span
                              key={i}
                              className="px-1 py-0.5 bg-green-500/10 text-green-600 rounded text-[10px]"
                            >
                              {topic}
                            </span>
                          ))}
                          {trainer.topics.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{trainer.topics.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 bg-primary/10 px-1.5 py-0.5 rounded-full">
                      <Star className="h-2.5 w-2.5 text-primary fill-primary" />
                      <span className="text-[10px] font-bold text-primary">
                        {trainer.avgRating}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-[13px] font-medium">
                  No trainer data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">Topics Summary</CardTitle>
            <CardDescription className="text-[10px]">
              Frequent topics
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[160px] overflow-hidden scrollbar-hide pt-0 pb-1">
            <div className="flex flex-wrap gap-1.5">
              {aggregatedStats.topicsLearned.length > 0 ? (
                aggregatedStats.topicsLearned.map((topic, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 bg-primary/5 border border-primary/20 px-2 py-1 rounded-full whitespace-nowrap"
                  >
                    <span className="text-[11px] font-semibold">
                      {topic.name}
                    </span>
                    <span className="text-[8px] bg-primary/10 px-1 rounded-full text-primary">
                      {topic.count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-[13px] font-medium w-full">
                  No topic data available
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
