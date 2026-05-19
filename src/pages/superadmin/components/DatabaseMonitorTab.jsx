import React, { useState, useEffect, useMemo } from "react";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  Loader2,
  HardDrive,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { migrateSessionStats } from "@/services/superadmin/responseService";
import { updateSession } from "@/services/superadmin/sessionService";

const estimateDocSize = (obj) => {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getSizeBadge = (bytes) => {
  if (bytes > 50000) return { label: "High", color: "bg-red-100 text-red-700 border-red-200" };
  if (bytes > 20000) return { label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Low", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
};

const DatabaseMonitorTab = () => {
  const { sessions = [] } = useSuperAdminData();
  const [searchQuery, setSearchQuery] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [migratingIds, setMigratingIds] = useState(new Set());
  const [optimizingIds, setOptimizingIds] = useState(new Set());

  const sessionAnalysis = useMemo(() => {
    return sessions.map((session) => {
      const estimatedSize = estimateDocSize(session);
      const sizeBadge = getSizeBadge(estimatedSize);

      // Check for duplicate questions
      const questionIds = (session.questions || []).map((q) => q.id);
      const uniqueIds = new Set(questionIds);
      const hasDuplicates = uniqueIds.size < questionIds.length;
      const duplicateCount = questionIds.length - uniqueIds.size;

      // Check if using legacy stats (compiledStats on parent)
      const hasLegacyStats = !!session.compiledStats && session.compiledStats.totalResponses !== undefined && session.compiledStats.ratingDistribution !== undefined;

      const needsAttention = hasDuplicates || estimatedSize > 50000 || hasLegacyStats;

      return {
        ...session,
        estimatedSize,
        sizeBadge,
        hasDuplicates,
        duplicateCount,
        hasLegacyStats,
        needsAttention,
      };
    });
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let result = sessionAnalysis;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.topic?.toLowerCase().includes(q) ||
          s.collegeName?.toLowerCase().includes(q) ||
          s.id?.toLowerCase().includes(q)
      );
    }

    if (sizeFilter !== "all") {
      result = result.filter((s) => s.sizeBadge.label.toLowerCase() === sizeFilter);
    }

    if (healthFilter === "attention") {
      result = result.filter((s) => s.needsAttention);
    } else if (healthFilter === "healthy") {
      result = result.filter((s) => !s.needsAttention);
    } else if (healthFilter === "legacy") {
      result = result.filter((s) => s.hasLegacyStats);
    }

    return result;
  }, [sessionAnalysis, searchQuery, sizeFilter, healthFilter]);

  const stats = useMemo(() => {
    const total = sessionAnalysis.length;
    const attention = sessionAnalysis.filter((s) => s.needsAttention).length;
    const legacy = sessionAnalysis.filter((s) => s.hasLegacyStats).length;
    const totalSize = sessionAnalysis.reduce((sum, s) => sum + s.estimatedSize, 0);
    return { total, attention, legacy, totalSize };
  }, [sessionAnalysis]);

  const handleMigrate = async (session) => {
    setMigratingIds((prev) => new Set([...prev, session.id]));
    const toastId = toast.loading(`Migrating ${session.topic}...`);
    try {
      const success = await migrateSessionStats(session.id, session);
      if (success) {
        toast.success("Legacy stats migrated to subcollections!", { id: toastId });
      } else {
        toast.error("No legacy stats found to migrate", { id: toastId });
      }
    } catch (err) {
      toast.error("Migration failed", { id: toastId });
      console.error(err);
    } finally {
      setMigratingIds((prev) => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    }
  };

  const handleDeduplicateQuestions = async (session) => {
    setOptimizingIds((prev) => new Set([...prev, session.id]));
    const toastId = toast.loading("Deduplicating questions...");
    try {
      const questions = session.questions || [];
      const seen = new Set();
      const deduped = questions.filter((q) => {
        if (seen.has(q.id)) return false;
        seen.add(q.id);
        return true;
      });

      if (deduped.length === questions.length) {
        toast.info("No duplicates found", { id: toastId });
        return;
      }

      await updateSession(session.id, { questions: deduped });
      toast.success(`Removed ${questions.length - deduped.length} duplicate question(s)`, { id: toastId });
    } catch (err) {
      toast.error("Deduplication failed", { id: toastId });
      console.error(err);
    } finally {
      setOptimizingIds((prev) => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Documents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.attention}</p>
              <p className="text-xs text-muted-foreground">Needs Attention</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.legacy}</p>
              <p className="text-xs text-muted-foreground">Legacy (Unmigrated)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatBytes(stats.totalSize)}</p>
              <p className="text-xs text-muted-foreground">Est. Total Size</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by topic, college, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[130px]">
              <Label className="text-xs">Size</Label>
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Health</Label>
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="attention">Needs Attention</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="legacy">Legacy Stats</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>College</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Est. Size</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No sessions match your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.slice(0, 50).map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">{session.topic}</p>
                      <p className="text-xs text-muted-foreground">{session.sessionDate}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{session.collegeName || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-xs">
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline" className={`text-xs ${session.sizeBadge.color}`}>
                        {formatBytes(session.estimatedSize)}
                      </Badge>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            session.estimatedSize > 500000 ? "bg-red-500" :
                            session.estimatedSize > 50000 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, (session.estimatedSize / 1048576) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {session.needsAttention ? (
                        <>
                          {session.hasDuplicates && (
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {session.duplicateCount} dupes
                            </span>
                          )}
                          {session.hasLegacyStats && (
                            <span className="text-xs text-purple-600 flex items-center gap-1">
                              <Database className="h-3 w-3" /> Legacy stats
                            </span>
                          )}
                          {session.estimatedSize > 50000 && (
                            <span className="text-xs text-red-600 flex items-center gap-1">
                              <HardDrive className="h-3 w-3" /> Large doc
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Healthy
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {session.hasDuplicates && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={optimizingIds.has(session.id)}
                          onClick={() => handleDeduplicateQuestions(session)}
                        >
                          {optimizingIds.has(session.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Optimize"
                          )}
                        </Button>
                      )}
                      {session.hasLegacyStats && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                          disabled={migratingIds.has(session.id)}
                          onClick={() => handleMigrate(session)}
                        >
                          {migratingIds.has(session.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Migrate"
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filteredSessions.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t">
            Showing 50 of {filteredSessions.length} sessions
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseMonitorTab;
