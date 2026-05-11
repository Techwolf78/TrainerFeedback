import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  PlayCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  BarChart3,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  XCircle,
  Filter,
  RotateCcw,
} from "lucide-react";
import { FiCheckSquare } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalClose,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createSession,
  deleteSession,
  updateSession,
  closeSessionWithStats,
} from "@/services/superadmin/sessionService";
import { compileSessionStats, getResponses, compileSessionStatsFromResponses } from "@/services/superadmin/responseService";
import { serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { getAcademicConfig } from "@/services/superadmin/academicService";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import SessionAnalytics from "./SessionAnalytics";
import SessionWizard from "@/components/shared/SessionWizard";
import { ShareSessionModal } from "@/components/shared/ShareSessionModal";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";

// Define domain options configuration

const SessionsTab = ({
  colleges,
  academicConfig: globalConfig,
  onRefresh,
  isDialogOpen,
  setDialogOpen,
}) => {
  const {
    sessions,
    trainers,
    templates,
    projectCodes,
    loadSessions,
    loadMoreSessions,
    hasMoreSessions,
    loadingMoreSessions,
  } = useSuperAdminData();
  const [loading, setLoading] = useState(false);

  // Session Tab State (All, Active, Past)
  const [sessionTab, setSessionTab] = useState("all");

  // Filters State
  const [filters, setFilters] = useState({
    collegeId: "all",
    course: "all",
    domain: "all",
    topic: "",
    trainerId: "all",
    projectCode: "all",
  });

  const resetFilters = () => {
    setFilters({
      collegeId: "all",
      course: "all",
      domain: "all",
      topic: "",
      trainerId: "all",
      projectCode: "all",
    });
  };

  // Session stats for cards
  const sessionStats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter((s) => s.status === "active").length;
    const inactive = sessions.filter((s) => s.status === "inactive").length;
    return { total, active, inactive };
  }, [sessions]);

  // Dialog & Wizard State - Use props if provided, otherwise local state
  const [localSessionDialogOpen, setLocalSessionDialogOpen] = useState(false);
  const sessionDialogOpen =
    isDialogOpen !== undefined ? isDialogOpen : localSessionDialogOpen;
  const setSessionDialogOpen = setDialogOpen || setLocalSessionDialogOpen;

  const [editingSessionId, setEditingSessionId] = useState(null); // null = create mode, id = edit mode

  // Export Confirmation Dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [sessionToExport, setSessionToExport] = useState(null);

  // Share Session Modal
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sessionToShare, setSessionToShare] = useState(null);

  // Inline Analytics View
  const [selectedSessionForAnalytics, setSelectedSessionForAnalytics] =
    useState(null);

  // Form Data

  // Dynamic Options based on selection

  // Removed useEffect - data comes from context with real-time subscription
  // useEffect for domain-based trainer filtering still needed

  // loadInitialData removed - data comes from context

  // Filter Logic (including tab filter)
  // Filter Logic (including tab filter)
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => {
        // Tab filter
        if (sessionTab === "active" && session.status !== "active")
          return false;
        if (sessionTab === "inactive" && session.status !== "inactive")
          return false;

        // Existing filters
        if (
          filters.collegeId !== "all" &&
          session.collegeId !== filters.collegeId
        )
          return false;
        if (filters.course !== "all" && session.course !== filters.course)
          return false;
        if (filters.domain !== "all" && session.domain !== filters.domain)
          return false;
        if (
          filters.trainerId !== "all" &&
          !(session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : [])).some(t => t.id === filters.trainerId)
        )
          return false;
        if (
          filters.projectCode !== "all" &&
          session.projectCode !== filters.projectCode
        )
          return false; // [NEW]
        if (
          filters.topic &&
          !session.topic.toLowerCase().includes(filters.topic.toLowerCase())
        )
          return false;

        return true;
      })
      .sort((a, b) => {
        // Sort by sessionDate descending
        const dateA = new Date(a.sessionDate || 0);
        const dateB = new Date(b.sessionDate || 0);
        return dateB - dateA;
      });
  }, [sessions, sessionTab, filters]);

  // Session Creation Logic

  const handleToggleStatus = async (session) => {
    // Only allow closing active sessions - no reopening allowed
    if (session.status !== "active") {
      toast.error("This phase is permanently closed and cannot be reopened. Create a new session instead.");
      return;
    }

    const confirmed = confirm(
      "⚠️  PERMANENT ACTION\n\nClosing this session phase will:\n• Compile all current feedback statistics\n• Lock this phase permanently (cannot be reopened)\n• Allow you to create a new session for the next phase\n\nThis action cannot be undone.\n\nProceed?"
    );

    if (!confirmed) return;

    try {
      toast.loading("Compiling feedback statistics...");
      await closeSessionWithStats(session.id);
      toast.dismiss();
      toast.success("Session phase permanently closed with compiled statistics");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to close session");
      console.error(error);
    }
  };

  const handleDelete = async (sessionId) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await deleteSession(sessionId);
      toast.success("Session deleted");
    } catch (error) {
      toast.error("Failed to delete session");
    }
  };

/*
  const handleRecalculateStats = async (session) => {
    if (!confirm("Are you sure you want to recalculate stats from raw responses? This will overwrite the existing compiled stats.")) return;
    const toastId = toast.loading("Recalculating stats...");
    try {
      const allResponses = await getResponses(session.id);
      const newStats = compileSessionStatsFromResponses(allResponses, session.questions || []);
      await updateDoc(doc(db, "sessions", session.id), {
        compiledStats: newStats
      });
      toast.success("Stats recalculated successfully!", { id: toastId });
    } catch (error) {
      toast.error("Failed to recalculate stats", { id: toastId });
      console.error(error);
    }
  };
*/

  const handleCompileStats = async (session) => {
    // Only allow manual compilation for active sessions
    if (session.status !== "active") {
      toast.error("Cannot compile stats for a closed phase. Stats are permanently archived.");
      return;
    }

    try {
      toast.loading("Compiling live feedback statistics...");
      const stats = await compileSessionStats(session.id, session.reactivationCount || 0);
      
      // Update session document with latest compiled stats without closing it
      await updateSession(session.id, {
        compiledStats: stats,
        lastCompiledAt: serverTimestamp(),
      });
      
      toast.dismiss();
      toast.success("Statistics updated for all dashboards");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to compile statistics");
      console.error(error);
    }
  };

  const handleExportResponses = (session) => {
    // Show confirmation dialog
    setSessionToExport(session);
    setExportDialogOpen(true);
  };

  const confirmExport = async () => {
    const session = sessionToExport;
    if (!session) return;

    try {
      const stats = session.compiledStats;
      if (!stats) {
        toast.error("No compiled stats available");
        return;
      }

      toast.loading("Fetching responses and generating Excel report...");

      // [NEW] Fetch detailed responses
      const { getResponses } =
        await import("@/services/superadmin/responseService");
      const responses = await getResponses(session.id);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Gryphon Academy";
      workbook.created = new Date();

      // --- SHEET 1: RESPONSES ---
      const responsesSheet = workbook.addWorksheet("Responses");

      // Dynamic columns based on questions
      const questions = session.questions || [];
      const columns = [
        { header: "Response ID", key: "id", width: 20 },
        { header: "Submitted At", key: "submittedAt", width: 20 },
        { header: "Device ID", key: "deviceId", width: 20 },
        ...questions.map((q, i) => ({
          header: `Q${i + 1}: ${q.text || q.question}`,
          key: `q_${q.id}`,
          width: 30,
        })),
      ];
      responsesSheet.columns = columns;

      // Add rows
      const rows = responses.map((resp) => {
        const row = {
          id: resp.id,
          submittedAt: resp.submittedAt?.toDate
            ? resp.submittedAt.toDate().toLocaleString()
            : new Date(resp.submittedAt).toLocaleString(),
          deviceId: resp.deviceId,
        };
        // Map answers to columns
        if (resp.answers) {
          resp.answers.forEach((ans) => {
            row[`q_${ans.questionId}`] = ans.value;
          });
        }
        return row;
      });
      responsesSheet.addRows(rows);

      // Style Header
      responsesSheet.getRow(1).font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      responsesSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };

      // --- SHEET 2: SUMMARY ---
      const summarySheet = workbook.addWorksheet("Summary Stats");
      summarySheet.columns = [
        { header: "Field", key: "field", width: 25 },
        { header: "Value", key: "value", width: 40 },
      ];
      summarySheet.addRows([
        { field: "Session Topic", value: session.topic },
        { field: "College", value: session.collegeName },
        { field: "Trainer", value: (session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : [])).map(t => t.name).join(", ") || "N/A" },
        { field: "Domain", value: session.domain },
        { field: "Course", value: session.course },
        { field: "Batch", value: session.batch },
        { field: "Session Date", value: session.sessionDate },
        { field: "Session Time", value: session.sessionTime },
        { field: "", value: "" },
        { field: "Total Responses", value: stats.totalResponses },
        { field: "Average Rating", value: stats.avgRating },
        { field: "Top Rating", value: stats.topRating },
        { field: "Least Rating", value: stats.leastRating },
      ]);
      // Style header
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };
      summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // Append classic stats (Rating Dist, Comments) to Summary Sheet or separate sheets?
      // User asked for "second sheet will contain the summary stats with the comments and stuff entire stats"
      // So I'll put everything else in subsequent sheets or append to Summary.
      // Let's create separate sheets for clarity as per previous design, but keep Summary as Sheet 2.

      // ... (Existing Rating Distribution Logic) ...
      const ratingSheet = workbook.addWorksheet("Rating Distribution");
      ratingSheet.columns = [
        { header: "Rating", key: "rating", width: 15 },
        { header: "Count", key: "count", width: 15 },
        { header: "Percentage", key: "percentage", width: 15 },
      ];
      const totalRatings = Object.values(stats.ratingDistribution || {}).reduce(
        (a, b) => a + b,
        0,
      );
      Object.entries(stats.ratingDistribution || {}).forEach(
        ([rating, count]) => {
          ratingSheet.addRow({
            rating: `${rating} Star`,
            count: count,
            percentage:
              totalRatings > 0
                ? `${((count / totalRatings) * 100).toFixed(1)}%`
                : "0%",
          });
        },
      );
      ratingSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ratingSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };

      // ... (Existing Comments Logic) ...
      const commentsSheet = workbook.addWorksheet("Comments");
      commentsSheet.columns = [
        { header: "Category", key: "category", width: 20 },
        { header: "Comment", key: "comment", width: 60 },
        { header: "Avg Rating", key: "avgRating", width: 15 },
      ];
      (stats.topComments || []).forEach((c) => {
        commentsSheet.addRow({
          category: "Top Rated",
          comment: c.text,
          avgRating: c.avgRating,
        });
      });
      (stats.avgComments || []).forEach((c) => {
        commentsSheet.addRow({
          category: "Average",
          comment: c.text,
          avgRating: c.avgRating,
        });
      });
      (stats.leastRatedComments || []).forEach((c) => {
        commentsSheet.addRow({
          category: "Least Rated",
          comment: c.text,
          avgRating: c.avgRating,
        });
      });
      commentsSheet.getRow(1).font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      commentsSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        blob,
        `feedback_${session.topic.replace(/[^a-z0-9]/gi, "_")}_${session.sessionDate}.xlsx`,
      );

      toast.dismiss();
      toast.success("Excel report exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.dismiss();
      toast.error("Failed to export report");
    } finally {
      setExportDialogOpen(false);
      setSessionToExport(null);
    }
  };

  const uniqueCourses = [...new Set(sessions.map((s) => s.course))].filter(
    Boolean,
  );
  const uniqueDomains = [...new Set(sessions.map((s) => s.domain))].filter(
    Boolean,
  );

  // Show analytics inline when a session is selected
  if (selectedSessionForAnalytics) {
    return (
      <SessionAnalytics
        session={selectedSessionForAnalytics}
        onBack={() => setSelectedSessionForAnalytics(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div></div>
      </div>
      <Modal
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        className="max-w-2xl p-0 overflow-hidden"
      >
        <ModalClose
          onClose={() => {
            setSessionDialogOpen(false);
            setEditingSessionId(null);
          }}
        />
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <ModalHeader className="mb-4">
            <ModalTitle>
              {editingSessionId ? "Edit" : "Create"} Feedback Session
            </ModalTitle>
            <ModalDescription>
              Complete the batch selection and session details.
            </ModalDescription>
          </ModalHeader>
          <SessionWizard
            key={editingSessionId || "new"}
            session={
              editingSessionId
                ? sessions.find((s) => s.id === editingSessionId)
                : null
            }
            colleges={colleges}
            trainers={trainers}
            projectCodes={projectCodes} // [NEW]
            onSuccess={() => {
              setSessionDialogOpen(false);
              setEditingSessionId(null);
              onRefresh && onRefresh();
            }}
            onCancel={() => {
              setSessionDialogOpen(false);
              setEditingSessionId(null);
            }}
          />
        </div>
      </Modal>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-4 p-4 bg-card border rounded-xl">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">
              {sessionStats.total}
            </p>
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-card border rounded-xl">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">
              {sessionStats.active}
            </p>
            <p className="text-sm text-muted-foreground">Active Sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-card border rounded-xl">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <FiCheckSquare className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">
              {sessionStats.inactive}
            </p>
            <p className="text-sm text-muted-foreground">Completed Sessions</p>
          </div>
        </div>
      </div>

      <ShareSessionModal
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        session={sessionToShare}
      />

      {/* Session Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6">
        <div className="flex p-1 bg-muted/30 rounded-xl border border-border/50 md:col-span-3">
          <button
            onClick={() => setSessionTab("all")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg ${
              sessionTab === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            All Sessions
          </button>
          <button
            onClick={() => setSessionTab("active")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg ${
              sessionTab === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Active Sessions
          </button>
          <button
            onClick={() => setSessionTab("inactive")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg ${
              sessionTab === "inactive"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Inactive Sessions
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">College</Label>
              <Select
                value={filters.collegeId}
                onValueChange={(v) => setFilters({ ...filters, collegeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {colleges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Course</Label>
              <Select
                value={filters.course}
                onValueChange={(v) => setFilters({ ...filters, course: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {uniqueCourses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Domain</Label>
              <Select
                value={filters.domain}
                onValueChange={(v) => setFilters({ ...filters, domain: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Domains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {uniqueDomains.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
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
              <Label className="text-xs">Project Code</Label>
              <Select
                value={filters.projectCode}
                onValueChange={(v) =>
                  setFilters({ ...filters, projectCode: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Project Codes</SelectItem>
                  {projectCodes
                    .filter((pc) => pc.collegeId)
                    .map((pc) => (
                      <SelectItem key={pc.id} value={pc.code}>
                        {pc.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Search Topic</Label>
              <Input
                placeholder="Search topics..."
                value={filters.topic}
                onChange={(e) =>
                  setFilters({ ...filters, topic: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Code</TableHead>
              <TableHead>Topic / Domain</TableHead>
              <TableHead>College / Batch</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredSessions.length === 0 ? (
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
                <TableRow key={session.id}>
                  <TableCell className="text-sm font-medium">
                    {session.projectCode || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{session.topic}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.domain}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{session.collegeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.batch} ({session.branch})
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const trainers = session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : []);
                      if (trainers.length > 1) {
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary cursor-default"
                            title={trainers.map(t => t.name).join(", ")}
                          >
                            {trainers.length} Trainers
                          </span>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                            {trainers[0]?.name?.[0] || "?"}
                          </div>
                          <span>{trainers[0]?.name || "Unassigned"}</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{session.sessionDate}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.sessionTime} ({session.sessionDuration}m)
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        session.status === "active" ? "default" : "secondary"
                      }
                      className={cn(
                        "capitalize font-medium block w-fit",
                        session.status === "active"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-700 border-gray-200",
                      )}
                    >
                      {session.status === "active" ? "Current Phase Open" : "Phase Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {session.status === "active" && (
                          <DropdownMenuItem onClick={() => handleCompileStats(session)}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Compile Stats
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setSessionToShare(session);
                            setShareDialogOpen(true);
                          }}
                        >
                          <Share2 className="mr-2 h-4 w-4" /> Share Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setSessionDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Update
                        </DropdownMenuItem>
                        {session.status === "active" && (
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(session)}
                          >
                            <Power className="mr-2 h-4 w-4" /> Close Phase
                          </DropdownMenuItem>
                        )}
                        {/* Live Analytics for Active Sessions */}
                        {session.status === "active" && (
                          <DropdownMenuItem
                            onClick={() =>
                              setSelectedSessionForAnalytics(session)
                            }
                          >
                            <BarChart3 className="mr-2 h-4 w-4" /> Live Analytics
                          </DropdownMenuItem>
                        )}
                        {session.status === "inactive" &&
                          session.compiledStats && (
                            <>
                              {/*
                              <DropdownMenuItem
                                onClick={() => handleRecalculateStats(session)}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" /> Recalculate Stats
                              </DropdownMenuItem>
                              */}
                              <DropdownMenuItem
                                onClick={() =>
                                  setSelectedSessionForAnalytics(session)
                                }
                              >
                                <BarChart3 className="mr-2 h-4 w-4" /> View
                                Analytics
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExportResponses(session)}
                              >
                                <Download className="mr-2 h-4 w-4" /> Export to
                                Excel
                              </DropdownMenuItem>
                            </>
                          )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(session.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        <span className="text-xs text-muted-foreground">
          Showing {filteredSessions.length} of {sessions.length} loaded sessions
        </span>
        {hasMoreSessions && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={loadMoreSessions}
            disabled={loadingMoreSessions}
          >
            {loadingMoreSessions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {loadingMoreSessions ? "Loading..." : "Load More Sessions"}
          </Button>
        )}
      </div>

      {/* Export Confirmation Dialog */}
      <Modal open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <div className="p-6">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Feedback Report
            </ModalTitle>
            <ModalDescription className="space-y-2 mt-2">
              <p>You are about to export feedback data for:</p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium text-foreground">
                  {sessionToExport?.topic}
                </p>
                <p>
                  {sessionToExport?.collegeName} •{" "}
                  {sessionToExport?.sessionDate}
                </p>
              </div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-lg mt-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  This report contains{" "}
                  <strong>
                    {sessionToExport?.compiledStats?.totalResponses || 0}
                  </strong>{" "}
                  responses.
                </p>
              </div>
            </ModalDescription>
          </ModalHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmExport}
              className="gradient-hero text-primary-foreground"
            >
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SessionsTab;

