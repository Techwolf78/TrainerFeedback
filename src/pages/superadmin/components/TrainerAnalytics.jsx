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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import { getSessionsByTrainer } from "@/services/superadmin/sessionService";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const TrainerAnalytics = ({ trainerId, trainerName, onBack }) => {
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

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      if (!trainerId) return;

      setIsLoading(true);
      try {
        const results = await getSessionsByTrainer(trainerId);
        setSessions(results || []);
      } catch (error) {
        console.error("Failed to load trainer analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [trainerId]);

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
        (s) => (s.branch || s.department) === filters.department,
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
        (s) => (s.branch || s.department) === filters.department,
      );
    if (filters.year !== "all")
      filtered = filtered.filter((s) => s.year === filters.year);

    const batches = [...new Set(filtered.map((s) => s.batch))].filter(Boolean);
    return batches.sort();
  }, [sessions, filters]);

  // --- Filtered Data & Stats Aggregation ---

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Allow live sessions in analytics if they have stats
      const isAnalyticStatus = session.status === "inactive" || session.status === "completed" || session.status === "active";
      if (!isAnalyticStatus) return false;
      if (!session.compiledStats) return false;

      if (filters.collegeId !== "all" && session.collegeId !== filters.collegeId) return false;
      if (filters.course !== "all" && session.course !== filters.course) return false;
      if (filters.department !== "all" && (session.branch || session.department) !== filters.department) return false;
      if (filters.year !== "all" && session.year !== filters.year) return false;
      if (filters.batch !== "all" && session.batch !== filters.batch) return false;

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
      qualitative: { high: [], low: [], future: [] },
    };

    filteredSessions.forEach((session) => {
      const cs = session.compiledStats;
      if (!cs) return;

      stats.totalResponses += cs.totalResponses || 0;
      stats.totalHours += (Number(session.sessionDuration) || 60) / 60;

      // Qualitative Feedback
      if (cs.comments) {
        cs.comments.forEach((c) => {
          if (c.rating >= 4) stats.qualitative.high.push(c);
          else if (c.rating <= 2) stats.qualitative.low.push(c);
          if (c.text?.toLowerCase().includes("need") || c.text?.toLowerCase().includes("future")) {
            stats.qualitative.future.push(c);
          }
        });
      }

      Object.entries(cs.ratingDistribution || {}).forEach(([rating, count]) => {
        stats.ratingDistribution[rating] = (stats.ratingDistribution[rating] || 0) + count;
        stats.ratingSum += Number(rating) * count;
        stats.totalRatingsCount += count;
      });

      // Categories
      const catData = cs.categoryAverages || cs.categoryData || {};
      Object.entries(catData).forEach(([cat, val]) => {
        // If it's categoryData object {sum, count}
        if (typeof val === 'object') {
           stats.categoryTotals[cat] = (stats.categoryTotals[cat] || 0) + (val.sum || 0);
           stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + (val.count || 0);
        } else {
           // If it's already an average
           const weight = cs.totalResponses || 1;
           stats.categoryTotals[cat] = (stats.categoryTotals[cat] || 0) + val * weight;
           stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + weight;
        }
      });
    });

    const avgRating = stats.totalRatingsCount > 0
      ? (stats.ratingSum / stats.totalRatingsCount).toFixed(2)
      : "0.00";

    const categoryAverages = {};
    Object.keys(stats.categoryTotals).forEach((cat) => {
      categoryAverages[cat] =
        stats.categoryCounts[cat] > 0
          ? (stats.categoryTotals[cat] / stats.categoryCounts[cat]).toFixed(2)
          : 0;
    });

    return {
      totalSessions: filteredSessions.length,
      totalResponses: stats.totalResponses,
      totalRatingsCount: stats.totalRatingsCount,
      totalHours: stats.totalHours,
      avgRating,
      ratingDistribution: stats.ratingDistribution,
      categoryAverages,
      qualitative: stats.qualitative,
    };
  }, [filteredSessions]);

  const ratingDistributionData = useMemo(() => {
    const distribution = aggregatedStats.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return Object.entries(distribution).map(([rating, count]) => ({
      rating: `${rating} Star`,
      count: count || 0,
    }));
  }, [aggregatedStats]);

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

  const responseTrend = useMemo(() => {
    const trendMap = {};
    sessions.forEach((s) => {
      if (!s.compiledStats) return;
      const date = s.sessionDate;
      if (!date) return;
      if (!trendMap[date]) trendMap[date] = 0;
      trendMap[date] += s.compiledStats.totalResponses || 0;
    });

    return Object.entries(trendMap)
      .map(([date, responses]) => ({
        day: parseInt(date.split("-")[2]),
        fullDate: date,
        responses,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .slice(-30);
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{trainerName}</h2>
            <p className="text-sm text-muted-foreground">Detailed metrics and student feedback</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">College</Label>
              <Select value={filters.collegeId} onValueChange={(v) => setFilters({...filters, collegeId: v, course: 'all', department: 'all', year: 'all', batch: 'all'})}>
                <SelectTrigger><SelectValue placeholder="All Colleges" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {availableColleges.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Course</Label>
              <Select value={filters.course} onValueChange={(v) => setFilters({...filters, course: v, department: 'all', year: 'all', batch: 'all'})}>
                <SelectTrigger><SelectValue placeholder="All Courses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {availableCourses.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={filters.department} onValueChange={(v) => setFilters({...filters, department: v, year: 'all', batch: 'all'})}>
                <SelectTrigger><SelectValue placeholder="All Depts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {availableDepartments.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Select value={filters.year} onValueChange={(v) => setFilters({...filters, year: v, batch: 'all'})}>
                <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Batch</Label>
              <Select value={filters.batch} onValueChange={(v) => setFilters({...filters, batch: v})}>
                <SelectTrigger><SelectValue placeholder="All Batches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {availableBatches.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Range</Label>
              <Select value={filters.dateRange} onValueChange={(v) => setFilters({...filters, dateRange: v})}>
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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sessions</p>
                <h3 className="text-2xl font-bold mt-1">{aggregatedStats.totalSessions}</h3>
              </div>
              <ClipboardList className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Responses</p>
                <h3 className="text-2xl font-bold mt-1">{aggregatedStats.totalResponses}</h3>
              </div>
              <Users className="h-8 w-8 text-emerald-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                <h3 className="text-2xl font-bold mt-1">{aggregatedStats.avgRating}</h3>
              </div>
              <Star className="h-8 w-8 text-amber-500 opacity-20 fill-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Training Hours</p>
                <h3 className="text-2xl font-bold mt-1">{Math.round(aggregatedStats.totalHours)}</h3>
              </div>
              <Clock className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Performance Trends</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={responseTrend}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="day" fontSize={11} />
                 <YAxis fontSize={11} />
                 <Tooltip />
                 <Area type="monotone" dataKey="responses" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
               </AreaChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Category Scores</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryRadarData}>
                 <PolarGrid />
                 <PolarAngleAxis dataKey="category" tick={{fontSize: 10}} />
                 <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
               </RadarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Rating Breakdown</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={ratingDistributionData}>
                 <XAxis dataKey="rating" fontSize={10} />
                 <YAxis fontSize={10} />
                 <Tooltip />
                 <Bar dataKey="count">
                   {ratingDistributionData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Highlights</CardTitle></CardHeader>
          <CardContent>
             <div className="space-y-4">
               {aggregatedStats.qualitative.high.slice(0, 3).map((c, i) => (
                 <div key={i} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 italic text-sm text-emerald-800">
                   "{c.text}"
                 </div>
               ))}
               {aggregatedStats.qualitative.high.length === 0 && (
                 <p className="text-center text-muted-foreground py-8">No feedback highlights yet</p>
               )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrainerAnalytics;
