import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import { getFeedbacksByDateRange } from "@/services/superadmin/responseService";
import {
  generateAlertsFromFeedbacks,
  getResolvedAlerts,
  resolveAlertInDb,
  unresolveAlertInDb,
  SEVERITY,
  ALERT_TYPE,
  ALERT_TYPE_LABELS,
  ALERT_TYPE_DESCRIPTIONS,
  formatRelativeTime,
} from "@/services/superadmin/alertService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
  ChevronRight,
  User,
  BookOpen,
  Users,
  Star,
  TrendingDown,
  Filter,
  Bell,
  ExternalLink,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const SeverityBadge = ({ severity }) => {
  if (severity === SEVERITY.CRITICAL) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        Critical
      </span>
    );
  }
  if (severity === SEVERITY.WARNING) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Resolved
    </span>
  );
};

const AlertTypeIcon = ({ type }) => {
  switch (type) {
    case ALERT_TYPE.LOW_RATING:
      return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case ALERT_TYPE.BELOW_THRESHOLD:
      return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    case ALERT_TYPE.LOW_PARTICIPATION:
      return <Users className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    case ALERT_TYPE.RATING_DROP:
      return <TrendingDown className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-slate-400 flex-shrink-0" />;
  }
};

const RatingPill = ({ rating }) => {
  if (rating === null || rating === undefined)
    return <span className="text-xs text-slate-400">No ratings</span>;
  let cls = "bg-slate-100 text-slate-600 border-slate-200";
  if (rating < 2.5) cls = "bg-red-50 text-red-600 border-red-200";
  else if (rating < 3.5) cls = "bg-amber-50 text-amber-600 border-amber-200";
  else cls = "bg-emerald-50 text-emerald-600 border-emerald-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold",
        cls,
      )}
    >
      <Star className="h-2.5 w-2.5 fill-current" />
      {rating.toFixed(2)} / 5
    </span>
  );
};

const AlertRow = ({ alert, onResolve, onViewTrainer }) => {
  const isResolved = alert.severity === SEVERITY.RESOLVED;
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-5 py-3.5 border-b border-slate-100 transition-all duration-150 hover:bg-slate-50/80",
        isResolved && "opacity-60",
        alert.severity === SEVERITY.CRITICAL &&
          !isResolved &&
          "border-l-2 border-l-red-400",
      )}
    >
      {/* Left: Severity color strip + icon */}
      <div className="flex-shrink-0 pt-0.5">
        <AlertTypeIcon type={alert.type} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <SeverityBadge severity={alert.severity} />
          <span className="text-[11px] font-bold text-slate-700">
            {ALERT_TYPE_LABELS[alert.type]}
          </span>
        </div>

        {/* Details row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <User className="h-3 w-3 text-slate-400" />
            <span className="font-semibold">{alert.trainerName}</span>
          </span>
          {alert.program && alert.program !== "Unknown Program" && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <BookOpen className="h-3 w-3 text-slate-400" />
              {alert.program}
            </span>
          )}
          {alert.batch && alert.batch !== "Unknown Batch" && (
            <span className="text-xs text-slate-400 font-medium">
              Batch: <span className="text-slate-600">{alert.batch}</span>
            </span>
          )}
          {alert.collegeName && alert.collegeName !== "Unknown College" && (
            <span className="text-xs text-slate-400 font-medium truncate max-w-[180px]">
              {alert.collegeName}
            </span>
          )}
        </div>

        {/* Metrics row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
          <RatingPill rating={alert.avgRating} />
          {alert.prevAvgRating !== undefined && (
            <span className="text-[10px] text-slate-400 font-medium">
              Prev:{" "}
              <span className="font-bold text-slate-500">
                {alert.prevAvgRating?.toFixed(2)}
              </span>{" "}
              <span className="text-red-500">▼ {alert.dropPercent}%</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
            <Users className="h-3 w-3" />
            {alert.responseCount}{" "}
            {alert.responseCount === 1 ? "response" : "responses"}
          </span>
          {alert.type === ALERT_TYPE.LOW_RATING && (
            <span className="text-[10px] text-red-500 font-bold uppercase tracking-wide">
              Requires Immediate Review
            </span>
          )}
        </div>
      </div>

      {/* Right: Timestamp + Actions */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
        <span className="flex items-center gap-1 text-[10px] text-slate-400 whitespace-nowrap">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(alert.timestamp) || "Unknown time"}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {alert.trainerId && (
            <button
              onClick={() => onViewTrainer(alert.trainerId)}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline px-1.5 py-0.5 rounded bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100"
            >
              View Trainer
            </button>
          )}
          {!isResolved && (
            <button
              onClick={() => onResolve(alert.id)}
              className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline px-1.5 py-0.5 rounded bg-emerald-50/50 hover:bg-emerald-50 transition-colors border border-emerald-100"
            >
              Mark Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main AlertsTab Component
// ─────────────────────────────────────────────

const RATING_RANGES = [
  { id: "0-2", label: "0 – 2", min: 0, max: 2 },
  { id: "2-3", label: "2 – 3", min: 2, max: 3 },
  { id: "3-3.5", label: "3 – 3.5", min: 3, max: 3.5 },
];

const TABS = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warning" },
  { id: "resolved", label: "Resolved" },
];

export default function AlertsTab() {
  const { sessions, colleges, trainers } = useSuperAdminData();
  const navigate = useNavigate();

  // Data state
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Resolved state (persisted to Firestore)
  const [resolvedIds, setResolvedIds] = useState(new Set());

  // Load resolved alerts on mount
  useEffect(() => {
    const loadResolved = async () => {
      const dbResolved = await getResolvedAlerts();
      setResolvedIds(dbResolved);
    };
    loadResolved();
  }, []);

  // UI state
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRatingRanges, setSelectedRatingRanges] = useState([]);
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState("");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("");
  const [selectedProgramFilter, setSelectedProgramFilter] = useState("");
  const [dateRange, setDateRange] = useState("last30");

  const searchRef = useRef(null);

  // ── Fetch feedbacks ─────────────────────────────────────────────
  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      switch (dateRange) {
        case "last7":
          startDate.setDate(now.getDate() - 7);
          break;
        case "last30":
          startDate.setDate(now.getDate() - 30);
          break;
        case "last90":
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      const data = await getFeedbacksByDateRange(startDate, endDate);
      setFeedbacks(data || []);
    } catch (error) {
      console.error("Failed to fetch feedbacks for alerts:", error);
      toast.error("Failed to load feedback data for alerts.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // ── Generate raw alerts ─────────────────────────────────────────
  const rawAlerts = useMemo(
    () => generateAlertsFromFeedbacks(feedbacks, sessions, trainers, colleges),
    [feedbacks, sessions, trainers, colleges],
  );

  // ── Apply resolved state ────────────────────────────────────────
  const alerts = useMemo(
    () =>
      rawAlerts.map((a) =>
        resolvedIds.has(a.id)
          ? { ...a, severity: SEVERITY.RESOLVED, resolved: true }
          : a,
      ),
    [rawAlerts, resolvedIds],
  );

  // ── Counts ──────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const critical = alerts.filter(
      (a) => a.severity === SEVERITY.CRITICAL,
    ).length;
    const warning = alerts.filter(
      (a) => a.severity === SEVERITY.WARNING,
    ).length;
    const resolved = alerts.filter(
      (a) => a.severity === SEVERITY.RESOLVED,
    ).length;
    return { total: alerts.length, critical, warning, resolved };
  }, [alerts]);

  // ── Unique filter options ───────────────────────────────────────
  const filterOptions = useMemo(() => {
    const trainerSet = new Set();
    const batchSet = new Set();
    const programSet = new Set();
    alerts.forEach((a) => {
      if (a.trainerName && a.trainerName !== "Unknown Trainer")
        trainerSet.add(a.trainerName);
      if (a.batch && a.batch !== "Unknown Batch") batchSet.add(a.batch);
      if (a.program && a.program !== "Unknown Program")
        programSet.add(a.program);
    });
    return {
      trainers: [...trainerSet].sort(),
      batches: [...batchSet].sort(),
      programs: [...programSet].sort(),
    };
  }, [alerts]);

  // ── Filtered alerts ─────────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    let result = alerts;

    // Tab filter
    if (activeTab === "critical")
      result = result.filter((a) => a.severity === SEVERITY.CRITICAL);
    else if (activeTab === "warning")
      result = result.filter((a) => a.severity === SEVERITY.WARNING);
    else if (activeTab === "resolved")
      result = result.filter((a) => a.severity === SEVERITY.RESOLVED);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.trainerName?.toLowerCase().includes(q) ||
          a.program?.toLowerCase().includes(q) ||
          a.batch?.toLowerCase().includes(q) ||
          a.collegeName?.toLowerCase().includes(q) ||
          ALERT_TYPE_LABELS[a.type]?.toLowerCase().includes(q),
      );
    }

    // Rating range filter
    if (selectedRatingRanges.length > 0) {
      result = result.filter((a) => {
        if (a.avgRating === null || a.avgRating === undefined) return false;
        return selectedRatingRanges.some((rangeId) => {
          const range = RATING_RANGES.find((r) => r.id === rangeId);
          return range && a.avgRating >= range.min && a.avgRating <= range.max;
        });
      });
    }

    // Trainer filter
    if (selectedTrainerFilter) {
      result = result.filter((a) => a.trainerName === selectedTrainerFilter);
    }

    // Batch filter
    if (selectedBatchFilter) {
      result = result.filter((a) => a.batch === selectedBatchFilter);
    }

    // Program filter
    if (selectedProgramFilter) {
      result = result.filter((a) => a.program === selectedProgramFilter);
    }

    return result;
  }, [
    alerts,
    activeTab,
    searchQuery,
    selectedRatingRanges,
    selectedTrainerFilter,
    selectedBatchFilter,
    selectedProgramFilter,
  ]);

  // ── Actions ─────────────────────────────────────────────────────
  const handleResolve = useCallback(async (alertId) => {
    try {
      await resolveAlertInDb(alertId);
      setResolvedIds((prev) => {
        const next = new Set(prev);
        next.add(alertId);
        return next;
      });
      toast.success("Alert marked as resolved.");
    } catch {
      toast.error("Failed to mark alert as resolved in database.");
    }
  }, []);

  const handleUnresolve = useCallback(async (alertId) => {
    try {
      await unresolveAlertInDb(alertId);
      setResolvedIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
      toast.info("Alert reopened.");
    } catch {
      toast.error("Failed to reopen alert in database.");
    }
  }, []);

  const handleViewTrainer = useCallback(
    (trainerId) => {
      navigate(
        `/super-admin/trainers?trainerId=${encodeURIComponent(trainerId)}`,
      );
    },
    [navigate],
  );

  const toggleRatingRange = (id) => {
    setSelectedRatingRanges((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedRatingRanges([]);
    setSelectedTrainerFilter("");
    setSelectedBatchFilter("");
    setSelectedProgramFilter("");
  };

  const hasActiveFilters =
    searchQuery ||
    selectedRatingRanges.length > 0 ||
    selectedTrainerFilter ||
    selectedBatchFilter ||
    selectedProgramFilter;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-1 flex-col overflow-hidden bg-[#f8fafc]"
      style={{ height: "100%" }}
    >
      {/* Top bar: Search + actions */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 sticky top-0 z-10">
        {/* Back Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/super-admin/weekly-analytics")}
          className="h-8 gap-1.5 border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to Analytics</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <div className="h-6 w-px bg-slate-200" />

        {/* Search */}
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search alerts by trainer, program, batch…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-8 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Tab pills with counts */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
          {TABS.map((tab) => {
            let count = counts.total;
            if (tab.id === "critical") count = counts.critical;
            else if (tab.id === "warning") count = counts.warning;
            else if (tab.id === "resolved") count = counts.resolved;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5",
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    activeTab === tab.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-200 text-slate-500",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFeedbacks}
          disabled={loading}
          className="h-8 gap-1.5 border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        >
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5",
              loading && "animate-spin text-blue-500",
            )}
          />
          Refresh
        </Button>
      </div>

      {/* Horizontal Filters Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 select-none">
        {/* Date Range Select */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Date Range:
          </span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-7 text-xs px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
          >
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
          </select>
        </div>

        {/* Trainer Select */}
        {filterOptions.trainers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Trainer:
            </span>
            <select
              value={selectedTrainerFilter}
              onChange={(e) => setSelectedTrainerFilter(e.target.value)}
              className="h-7 text-xs px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 max-w-[160px] font-medium"
            >
              <option value="">All Trainers</option>
              {filterOptions.trainers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Program Select */}
        {filterOptions.programs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Program:
            </span>
            <select
              value={selectedProgramFilter}
              onChange={(e) => setSelectedProgramFilter(e.target.value)}
              className="h-7 text-xs px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 max-w-[160px] font-medium"
            >
              <option value="">All Programs</option>
              {filterOptions.programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Batch Select */}
        {filterOptions.batches.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Batch:
            </span>
            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value)}
              className="h-7 text-xs px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 max-w-[160px] font-medium"
            >
              <option value="">All Batches</option>
              {filterOptions.batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Rating Range */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Rating Range:
          </span>
          <div className="flex items-center gap-1">
            {RATING_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => toggleRatingRange(r.id)}
                className={cn(
                  "text-[10px] px-2.5 py-0.5 rounded-md border font-bold transition-colors shadow-sm",
                  selectedRatingRanges.includes(r.id)
                    ? "bg-slate-800 text-white border-slate-700"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="ml-auto text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear all filters
          </button>
        )}
      </div>

      {/* ── MAIN CONTENT AREA — independent scroll column ──────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Stats summary bar */}
        <div className="bg-white border-b border-slate-100 px-5 py-2 flex items-center gap-6">
          <div className="flex items-center gap-5 text-xs">
            <span className="text-slate-500">
              <span className="font-bold text-slate-800">
                {filteredAlerts.length}
              </span>{" "}
              <span>
                {filteredAlerts.length === 1 ? "alert" : "alerts"} shown
              </span>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="flex items-center gap-1.5 text-red-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Critical: <span className="font-bold">{counts.critical}</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Warning: <span className="font-bold">{counts.warning}</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Resolved: <span className="font-bold">{counts.resolved}</span>
            </span>
          </div>

          {hasActiveFilters && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              <Filter className="h-2.5 w-2.5" />
              Filters active
            </span>
          )}
        </div>

        {/* Alert list */}
        <div className="bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">
                Calculating alerts from feedback data…
              </p>
              <p className="text-xs text-slate-400">
                Querying Firestore and running alert rules
              </p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-700">
                {hasActiveFilters
                  ? "No alerts match your filters"
                  : "No alerts found"}
              </h3>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                {hasActiveFilters
                  ? "Try adjusting your search or filter criteria."
                  : "All trainer ratings are within acceptable thresholds for the selected period."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div>
              {filteredAlerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onResolve={handleResolve}
                  onViewTrainer={handleViewTrainer}
                />
              ))}
              {/* Bottom padding */}
              <div className="h-10" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
