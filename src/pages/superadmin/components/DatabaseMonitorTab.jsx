import React, { useState } from "react";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import { updateSession } from "@/services/superadmin/sessionService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  HardDrive,
  Info,
} from "lucide-react";

// Firestore Billing Rules-based Document Size Estimator
const calculateFirestoreDocSize = (docId, data) => {
  let size = 32; // Document overhead
  size += `sessions/${docId}`.length; // Size of document path

  const calculateValSize = (val) => {
    if (val === null || val === undefined) return 1;
    if (typeof val === "string") return val.length + 1;
    if (typeof val === "number") return 8;
    if (typeof val === "boolean") return 1;
    if (val instanceof Date) return 8;
    // Handle Firestore Timestamp
    if (val && typeof val === "object" && (val.seconds !== undefined || val.toDate)) return 8;

    if (Array.isArray(val)) {
      let arrSize = 1;
      val.forEach((item) => {
        arrSize += calculateValSize(item);
      });
      return arrSize;
    }

    if (typeof val === "object") {
      let mapSize = 1;
      Object.entries(val).forEach(([k, v]) => {
        mapSize += k.length + 1;
        mapSize += calculateValSize(v);
      });
      return mapSize;
    }
    return 0;
  };

  if (data && typeof data === "object") {
    Object.entries(data).forEach(([key, value]) => {
      size += key.length + 1;
      size += calculateValSize(value);
    });
  }

  return size;
};

// Deduplication Helper for Session Optimization
const deduplicateQuestions = (questions) => {
  if (!questions || !Array.isArray(questions)) return [];
  const seenTexts = new Set();
  return questions.filter((q) => {
    const text = (q.text || q.question || "").trim().toLowerCase();
    if (!text) return true;
    if (seenTexts.has(text)) {
      return false;
    }
    seenTexts.add(text);
    return true;
  });
};

const DatabaseMonitorTab = () => {
  const { sessions, isInitialLoading, refreshAll } = useSuperAdminData();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBadge, setFilterBadge] = useState("all");
  const [filterAttentionOnly, setFilterAttentionOnly] = useState("all"); // 'all' or 'attention'
  const [optimizingId, setOptimizingId] = useState(null);

  // Estimate size and analyze each session document
  const analyzedSessions = (sessions || []).map((session) => {
    const sizeBytes = calculateFirestoreDocSize(session.id, session);
    const sizeKB = sizeBytes / 1024;

    const totalQuestions = session.questions?.length || 0;
    const uniqueQuestions = deduplicateQuestions(session.questions || []).length;
    const hasDuplicates = totalQuestions > uniqueQuestions;

    // Badges definitions
    // Low: < 20 KB (Totally Safe)
    // Medium: 20 KB - 50 KB (Moderate)
    // High: > 50 KB (Needs Attention)
    let badge = "low";
    if (sizeKB > 50) badge = "high";
    else if (sizeKB > 20) badge = "medium";

    // Attention condition
    const needsAttention = badge === "high" || hasDuplicates;

    return {
      ...session,
      sizeBytes,
      sizeKB,
      badge,
      needsAttention,
      totalQuestions,
      uniqueQuestions,
      hasDuplicates,
      duplicateCount: totalQuestions - uniqueQuestions,
    };
  });

  // Filtering
  const filteredSessions = analyzedSessions.filter((s) => {
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = s.id?.toLowerCase().includes(q);
      const matchTopic = s.topic?.toLowerCase().includes(q);
      const matchCollege = s.collegeName?.toLowerCase().includes(q);
      if (!matchId && !matchTopic && !matchCollege) return false;
    }

    // Badge filter
    if (filterBadge !== "all" && s.badge !== filterBadge) return false;

    // Attention only filter
    if (filterAttentionOnly === "attention" && !s.needsAttention) return false;

    return true;
  });

  // Stats calculation
  const totalMonitored = analyzedSessions.length;
  const avgSizeKB = totalMonitored > 0
    ? (analyzedSessions.reduce((sum, s) => sum + s.sizeKB, 0) / totalMonitored)
    : 0;
  const totalAttention = analyzedSessions.filter((s) => s.needsAttention).length;
  const totalDuplicatesDetected = analyzedSessions.reduce((sum, s) => sum + (s.hasDuplicates ? 1 : 0), 0);

  // Optimize handler
  const handleOptimize = async (session) => {
    setOptimizingId(session.id);
    const toastId = toast.loading(`Optimizing session ${session.id}...`);

    try {
      const deduplicated = deduplicateQuestions(session.questions || []);
      
      // Update in Firestore
      await updateSession(session.id, {
        questions: deduplicated,
      });

      // Local recalculation preview
      const oldSize = session.sizeKB;
      const cleanSessionData = {
        ...session,
        questions: deduplicated,
      };
      const newSizeBytes = calculateFirestoreDocSize(session.id, cleanSessionData);
      const newSizeKB = newSizeBytes / 1024;
      const savedKB = oldSize - newSizeKB;
      const savedPct = Math.round((savedKB / oldSize) * 100);

      toast.success(
        `Optimization Complete! Reduced size from ${oldSize.toFixed(2)} KB to ${newSizeKB.toFixed(2)} KB (Saved ${savedPct}% space).`,
        { id: toastId }
      );

      // Refresh super admin data context
      await refreshAll();
    } catch (error) {
      console.error("Optimization failed:", error);
      toast.error("Failed to optimize session. Please try again.", { id: toastId });
    } finally {
      setOptimizingId(null);
    }
  };

  const getBadgeStyle = (badge) => {
    switch (badge) {
      case "high":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "low":
      default:
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Database className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sessions</p>
              <h3 className="text-xl font-bold text-slate-800">{totalMonitored}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <HardDrive className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Doc Size</p>
              <h3 className="text-xl font-bold text-slate-800">{avgSizeKB.toFixed(2)} KB</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Needs Attention</p>
              <h3 className="text-xl font-bold text-rose-600">{totalAttention}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duplicate Records</p>
              <h3 className="text-xl font-bold text-slate-800">{totalDuplicatesDetected} Detected</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description Info Alert */}
      <Card className="border-blue-100 bg-blue-50/50 shadow-none">
        <CardContent className="p-4 flex gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Storage & Limits Guidance</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              Google Cloud Firestore enforces a strict **1 MB document limit** (1,024 KB). 
              Our optimized database stores individual student feedback safely inside a subcollection (allowing billions of entries), but session dashboards read from the session document itself. 
              **Low (&lt; 20 KB)** and **Medium (20 - 50 KB)** levels are extremely healthy. 
              If any session document exceeds **50 KB** or contains **duplicate questions** from prior updates, it will trigger a "Needs Attention" alert, allowing you to instantly consolidate it using the "Optimize" tool.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-800">Filters & Sorting</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by ID, Topic, College..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            {/* Badge Status Filter */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Document Size Badge</Label>
              <Select value={filterBadge} onValueChange={setFilterBadge}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All sizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="low">Low (&lt; 20 KB)</SelectItem>
                  <SelectItem value="medium">Medium (20 - 50 KB)</SelectItem>
                  <SelectItem value="high">High (&gt; 50 KB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Attention Status Filter */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Health Category</Label>
              <Select value={filterAttentionOnly} onValueChange={setFilterAttentionOnly}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="attention">Needs Attention Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Grid / Table */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">
          Showing {filteredSessions.length} of {totalMonitored} sessions
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          className="gap-2 text-xs border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 transition-all font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Force Refresh
        </Button>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Database className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No Sessions Found</h3>
          <p className="text-sm text-slate-400">
            {searchQuery || filterBadge !== "all" || filterAttentionOnly !== "all"
              ? "No sessions match your search or filter configuration."
              : "No session records found in Firestore."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSessions.map((session) => {
            const progressPercent = Math.min((session.sizeKB / 1024) * 100, 100);

            return (
              <div
                key={session.id}
                className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md hover:border-blue-300/50 ${
                  session.needsAttention ? "border-rose-100 bg-rose-50/10" : "border-slate-200"
                }`}
              >
                {/* Session Identification & Details */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-slate-800 text-sm tracking-tight font-mono truncate">
                      {session.id}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 uppercase font-bold border ${getBadgeStyle(session.badge)}`}>
                      {session.badge} Size
                    </Badge>
                    {session.needsAttention && (
                      <Badge className="text-[10px] px-2 py-0.5 font-bold bg-rose-500 hover:bg-rose-600 text-white gap-1 flex items-center shadow-sm">
                        <AlertTriangle className="h-3 w-3" /> Needs Attention
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 leading-normal">
                    <p className="text-slate-800 text-sm font-bold leading-none mb-1.5 truncate">{session.collegeName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5 text-slate-400" />
                        Topic: <strong className="text-slate-700">{session.topic}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        Questions: <strong className={session.hasDuplicates ? "text-rose-600 font-bold" : "text-slate-700"}>{session.totalQuestions}</strong>
                        {session.hasDuplicates && (
                          <span className="text-[10px] text-rose-500 font-bold">
                            ({session.duplicateCount} duplicates)
                          </span>
                        )}
                      </span>
                      <span>•</span>
                      <span>
                        Trainers: <strong className="text-slate-700">{session.trainerIds?.length || 1}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Size gauge, percentage, and limit */}
                <div className="w-full md:w-60 space-y-1.5 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400">Document Size</span>
                    <span className="text-slate-800 font-mono">{session.sizeKB.toFixed(2)} KB / 1,024 KB</span>
                  </div>
                  {/* Gauge Progress Bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        session.badge === "high"
                          ? "bg-rose-500 shadow-sm shadow-rose-500/20"
                          : session.badge === "medium"
                          ? "bg-amber-500 shadow-sm shadow-amber-500/20"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${progressPercent || 1}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 text-right uppercase tracking-wider leading-none">
                    {progressPercent.toFixed(3)}% of Firestore Limit
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="flex items-center justify-end flex-shrink-0 md:pl-2">
                  {session.hasDuplicates ? (
                    <Button
                      onClick={() => handleOptimize(session)}
                      disabled={optimizingId === session.id}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-sm border border-blue-700/20 transition-all"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${optimizingId === session.id ? "animate-spin" : ""}`} />
                      {optimizingId === session.id ? "Optimizing..." : "Optimize Now"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="h-4 w-4" />
                      Optimized
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DatabaseMonitorTab;
