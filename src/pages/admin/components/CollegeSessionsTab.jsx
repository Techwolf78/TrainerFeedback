import React, { useState, useEffect, useMemo } from "react";
import { useAdminData } from "@/contexts/AdminDataContext";

import SessionAnalytics from "../../superadmin/components/SessionAnalytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Filter,
  RotateCcw,
  Loader2,
  Share2,
  BarChart3,
  Calendar,
  Activity,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parse,
} from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CollegeSessionsTab = () => {
  const { college, trainers, loadTrainers, sessions, loadSessions, loading } =
    useAdminData();

  // local loading state derived from context
  const isSessionsLoading = loading.sessions && sessions.length === 0;

  // State
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'active', 'inactive'
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    course: "all",
    department: "all",
    year: "all",
    batch: "all",
    trainer: "all",
    dateRange: "all",
  });

  // Ensure sessions and trainers are loaded on mount
  useEffect(() => {
    if (college?.id) {
      loadTrainers();
      if (sessions.length === 0) loadSessions();
    }
  }, [college, loadTrainers, loadSessions, sessions.length]);

  // Derived Active & Recent Sessions from Context Data (for stats if needed)
  const sessionStats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter((s) => s.status === "active").length;
    const inactive = sessions.filter((s) => s.status === "inactive").length;
    return { total, active, inactive };
  }, [sessions]);

  // Derived Filter Options (Cascading)
  const filterOptions = useMemo(() => {
    // 1. Courses (Always all available)
    const courses = [
      ...new Set(sessions.map((s) => s.course).filter(Boolean)),
    ].sort();

    // 2. Years (Dependent on Course)
    let yearSessions = sessions;
    if (filters.course !== "all") {
      yearSessions = yearSessions.filter((s) => s.course === filters.course);
    }
    const years = [
      ...new Set(yearSessions.map((s) => s.year).filter(Boolean)),
    ].sort();

    // 3. Departments (Dependent on Course AND Year)
    let deptSessions = yearSessions;
    if (filters.year !== "all") {
      deptSessions = deptSessions.filter((s) => s.year === filters.year);
    }
    const departments = [
      ...new Set(deptSessions.map((s) => s.branch).filter(Boolean)),
    ].sort();

    // 4. Batches (Dependent on Course AND Year AND Dept)
    let batchSessions = deptSessions;
    if (filters.department !== "all") {
      batchSessions = batchSessions.filter(
        (s) => s.branch === filters.department,
      );
    }
    const batches = [
      ...new Set(batchSessions.map((s) => s.batch).filter(Boolean)),
    ].sort();

    return { courses, departments, years, batches };
  }, [sessions, filters.course, filters.year, filters.department]);

  // Get date range from preset
  const getDateRange = (range) => {
    const today = new Date();
    switch (range) {
      case "7days":
        return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) };
      case "30days":
        return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
      case "90days":
        return { from: startOfDay(subDays(today, 89)), to: endOfDay(today) };
      default:
        return null;
    }
  };

  // Filter Logic
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => {
        // Tab filter
        if (activeTab === "active" && session.status !== "active") return false;
        if (activeTab === "inactive" && session.status !== "inactive")
          return false;

        // Search filter
        const matchSearch =
          !searchQuery ||
          session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          session.course?.toLowerCase().includes(searchQuery.toLowerCase());

        // Dropdown filters
        const matchCourse =
          filters.course === "all" || session.course === filters.course;
        const matchDept =
          filters.department === "all" || session.branch === filters.department;
        const matchYear =
          filters.year === "all" || session.year === filters.year;
        const matchBatch =
          filters.batch === "all" || session.batch === filters.batch;
        const matchTrainer =
          filters.trainer === "all" ||
          session.assignedTrainer?.id === filters.trainer;

        // Date filter
        let matchDate = true;
        if (filters.dateRange !== "all") {
          const range = getDateRange(filters.dateRange);
          if (range && session.sessionDate) {
            // Robust parsing: force 'yyyy-MM-dd' to be read as local time
            // This avoids UTC midnight shifting to previous day
            const sessionDate = parse(
              session.sessionDate,
              "yyyy-MM-dd",
              new Date(),
            );
            matchDate = isWithinInterval(sessionDate, range);
          }
        }

        return (
          matchSearch &&
          matchCourse &&
          matchDept &&
          matchYear &&
          matchBatch &&
          matchTrainer &&
          matchDate
        );
      })
      .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));
  }, [sessions, activeTab, searchQuery, filters]);

  // Actions
  const copyLink = (sessionId) => {
    // Find the session to get its reactivationCount
    const session = sessions.find((s) => s.id === sessionId);
    const versionQuery = session?.reactivationCount ? `?v=${session.reactivationCount}` : '';
    const link = `${window.location.origin}/feedback/anonymous/${sessionId}${versionQuery}`;
    navigator.clipboard.writeText(link);
    toast.success("Feedback link copied to clipboard");
  };

  // Render Analytics View
  if (selectedSession) {
    return (
      <SessionAnalytics
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  // Loading State
  if (isSessionsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card data-tour="sessions-filters">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({
                  course: "all",
                  department: "all",
                  year: "all",
                  batch: "all",
                  trainer: "all",
                  dateRange: "all",
                });
                setSearchQuery("");
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Course</Label>
              <Select
                value={filters.course}
                onValueChange={(v) =>
                  setFilters((prev) => ({
                    ...prev,
                    course: v,
                    year: "all",
                    department: "all",
                    batch: "all",
                  }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {filterOptions.courses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
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
                  setFilters((prev) => ({
                    ...prev,
                    year: v,
                    department: "all",
                    batch: "all",
                  }))
                }
                disabled={filters.course === "all"}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {filterOptions.years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
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
                  setFilters((prev) => ({
                    ...prev,
                    department: v,
                    batch: "all",
                  }))
                }
                disabled={filters.year === "all"} // Strictly cascading: Course -> Year -> Dept
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {filterOptions.departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Batch</Label>
              <Select
                value={filters.batch}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, batch: v }))
                }
                disabled={filters.department === "all"}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {filterOptions.batches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Trainer</Label>
              <Select
                value={filters.trainer}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, trainer: v }))
                }
              >
                <SelectTrigger className="h-9">
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

            {/* <div className="space-y-1 col-span-2 md:col-span-2 lg:col-span-1">
              <Label className="text-xs">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={v => setFilters(prev => ({ ...prev, dateRange: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>

                </SelectContent>
              </Select>
            </div> */}
          </div>
        </CardContent>
      </Card>

      {/* Session Tab Toggle */}
      <div
        data-tour="sessions-tabs"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6"
      >
        <div className="flex p-1 bg-muted/30 rounded-xl border border-border/50 md:col-span-3">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg",
              activeTab === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            All Sessions ({sessionStats.total})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg",
              activeTab === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            Active Sessions ({sessionStats.active})
          </button>
          <button
            onClick={() => setActiveTab("inactive")}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg",
              activeTab === "inactive"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            Inactive Sessions ({sessionStats.inactive})
          </button>
        </div>
      </div>

      {/* Sessions Table */}
      <div
        data-tour="sessions-table"
        className="border rounded-lg overflow-hidden bg-card shadow-sm"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Code</TableHead>
              <TableHead>Topic / Domain</TableHead>
              <TableHead>Course / Batch</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No sessions found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => (
                <TableRow
                  key={session.id}
                  className={cn(
                    "hover:bg-muted/50 transition-colors",
                    session.isLive && "bg-blue-50/30 hover:bg-blue-50/50"
                  )}
                >
                  <TableCell className="text-sm font-medium">
                    {session.projectCode || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">
                        {session.topic}
                      </div>
                      {session.isLive && (
                         <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 animate-pulse border border-blue-200">
                           <Activity className="h-2.5 w-2.5" />
                           LIVE
                         </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.domain}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {session.course} - {session.branch}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Year {session.year} • Batch {session.batch} •{" "}
                      {session.academicYear}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                        {session.assignedTrainer?.name?.[0] || "?"}
                      </div>
                      <span className="text-sm">
                        {session.assignedTrainer?.name || "Unassigned"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {session.sessionDate
                        ? format(new Date(session.sessionDate), "MMM d, yyyy")
                        : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.sessionTime}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold">{session.responseCount || 0}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Resp</span>
                      </div>
                      {session.compiledStats?.avgRating && (
                         <div className="flex items-center gap-1">
                           <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                           <span className="text-[11px] font-medium text-muted-foreground">
                             {session.compiledStats.avgRating} / 5
                           </span>
                         </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-foreground"
                              onClick={() => setSelectedSession(session)}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Analytics</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => copyLink(session.id)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy Feedback Link</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Showing {filteredSessions.length} sessions
      </div>
    </div>
  );
};

export default CollegeSessionsTab;
