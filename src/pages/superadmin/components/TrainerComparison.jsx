import React, { useMemo, useState } from "react";
import {
  Users,
  Star,
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  MessageSquare,
  Building2,
  X,
  Printer,
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowRight,
  User,
  ThumbsUp,
  ThumbsDown,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { resolveTrainerStatsFromSession } from "@/services/superadmin/trainerService";
import { processQualitativeComments } from "@/services/superadmin/responseService";

export const TRAINER_THEMES = [
  {
    index: 0,
    label: "Trainer 1",
    color: "#3b82f6", // Blue
    fill: "rgba(59, 130, 246, 0.25)",
    border: "border-blue-500/40",
    badgeBg:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    avatarBg:
      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    dot: "bg-blue-500",
    cardHighlight: "bg-blue-500/[0.03] border-blue-500/30",
    metricHighlight: "text-blue-600 dark:text-blue-400",
    bgSoft: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    index: 1,
    label: "Trainer 2",
    color: "#a855f7", // Purple
    fill: "rgba(168, 85, 247, 0.25)",
    border: "border-purple-500/40",
    badgeBg:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    avatarBg:
      "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    dot: "bg-purple-500",
    cardHighlight: "bg-purple-500/[0.03] border-purple-500/30",
    metricHighlight: "text-purple-600 dark:text-purple-400",
    bgSoft: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    index: 2,
    label: "Trainer 3",
    color: "#f59e0b", // Amber
    fill: "rgba(245, 158, 11, 0.25)",
    border: "border-amber-500/40",
    badgeBg:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    avatarBg:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
    cardHighlight: "bg-amber-500/[0.03] border-amber-500/30",
    metricHighlight: "text-amber-600 dark:text-amber-400",
    bgSoft: "bg-amber-50 dark:bg-amber-950/30",
  },
];

const CATEGORY_NAMES = {
  knowledge: "Knowledge",
  communication: "Communication",
  delivery: "Delivery",
  engagement: "Engagement",
  content: "Content Quality",
  overall: "Overall",
};

/**
 * Cleans student comment text by condensing spam repetitions and formatting.
 */
const cleanCommentText = (rawText) => {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.trim();

  // Strip leading/trailing quote marks
  text = text.replace(/^["'“”]+|["'“”]+$/g, "").trim();

  // Condense extreme spam repetitions (e.g. "pls pls pls pls" -> "please...")
  text = text.replace(
    /\b(pls|please|plz|pleeease|pleaseee)\b(\s+\b(pls|please|plz|pleeease|pleaseee)\b){2,}/gi,
    "please",
  );

  // Condense repeated punctuation
  text = text.replace(/([!?.]){3,}/g, "$1$1");

  return text;
};

/**
 * Computes aggregated statistics for a single trainer across all sessions.
 */
export const computeTrainerComparisonStats = (trainer, sessions = []) => {
  if (!trainer) return null;

  const stats = {
    trainer,
    sessionCount: 0,
    totalResponses: 0,
    totalHours: 0,
    ratingSum: 0,
    totalRatingsCount: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    categoryTotals: {},
    categoryCounts: {},
    uniqueColleges: new Set(),
    qualitativeHigh: [],
    qualitativeLow: [],
    futureTopics: [],
  };

  (sessions || []).forEach((session) => {
    const cs = session.compiledStats || session.stats;
    if (!cs) return;

    const trainerStats = resolveTrainerStatsFromSession(session, trainer);
    if (!trainerStats) return;

    stats.sessionCount += 1;

    // Track Colleges
    if (session.collegeName) {
      stats.uniqueColleges.add(session.collegeName);
    } else if (session.collegeId) {
      stats.uniqueColleges.add(session.collegeId);
    }

    // Hours
    const hours = (Number(session.sessionDuration) || 60) / 60;
    stats.totalHours += hours;

    // Responses & Rating Distribution
    let ratingsInDist = 0;
    Object.entries(trainerStats.ratingDistribution || {}).forEach(
      ([rating, count]) => {
        const numRating = Number(rating);
        const numCount = Number(count) || 0;
        if (numRating > 0 && numCount > 0) {
          stats.ratingDistribution[numRating] =
            (stats.ratingDistribution[numRating] || 0) + numCount;
          stats.ratingSum += numRating * numCount;
          stats.totalRatingsCount += numCount;
          ratingsInDist += numCount;
        }
      },
    );

    const responses =
      Number(trainerStats.totalResponses) ||
      Number(trainerStats.responseCount) ||
      ratingsInDist ||
      0;
    stats.totalResponses += responses;

    if (ratingsInDist === 0 && trainerStats.avgRating && responses > 0) {
      const avg = Number(trainerStats.avgRating) || 0;
      stats.ratingSum += avg * responses;
      stats.totalRatingsCount += responses;
    }

    // Categories
    const catData =
      trainerStats.categoryAverages || trainerStats.categoryData || {};
    Object.entries(catData).forEach(([cat, val]) => {
      const normalizedCat = cat.toLowerCase();
      if (typeof val === "object" && val !== null) {
        stats.categoryTotals[normalizedCat] =
          (stats.categoryTotals[normalizedCat] || 0) + (val.sum || 0);
        stats.categoryCounts[normalizedCat] =
          (stats.categoryCounts[normalizedCat] || 0) + (val.count || 0);
      } else {
        const weight = responses || 1;
        const numVal = Number(val) || 0;
        stats.categoryTotals[normalizedCat] =
          (stats.categoryTotals[normalizedCat] || 0) + numVal * weight;
        stats.categoryCounts[normalizedCat] =
          (stats.categoryCounts[normalizedCat] || 0) + weight;
      }
    });

    // Qualitative comments
    if (trainerStats.comments && Array.isArray(trainerStats.comments)) {
      trainerStats.comments.forEach((c) => {
        if (c.rating >= 4) stats.qualitativeHigh.push(c);
        else if (c.rating <= 2) stats.qualitativeLow.push(c);
        if (
          c.text?.toLowerCase().includes("need") ||
          c.text?.toLowerCase().includes("future")
        ) {
          stats.futureTopics.push(c);
        }
      });
    } else {
      if (trainerStats.topComments && Array.isArray(trainerStats.topComments)) {
        trainerStats.topComments.forEach((c) =>
          stats.qualitativeHigh.push({
            text: c.text,
            rating: c.avgRating || c.rating || 5,
          }),
        );
      }
      if (
        trainerStats.leastRatedComments &&
        Array.isArray(trainerStats.leastRatedComments)
      ) {
        trainerStats.leastRatedComments.forEach((c) =>
          stats.qualitativeLow.push({
            text: c.text,
            rating: c.avgRating || c.rating || 2,
          }),
        );
      }
      if (
        trainerStats.futureTopics &&
        Array.isArray(trainerStats.futureTopics)
      ) {
        trainerStats.futureTopics.forEach((c) =>
          stats.futureTopics.push({
            text: c.name || c.text,
            rating: c.avgRating || c.rating || 4,
          }),
        );
      }
    }
  });

  const avgRatingNum =
    stats.totalRatingsCount > 0 ? stats.ratingSum / stats.totalRatingsCount : 0;
  const avgRating = avgRatingNum.toFixed(2);

  // Positive feedback % (4 & 5 stars)
  const positiveRatingsCount =
    (stats.ratingDistribution[4] || 0) + (stats.ratingDistribution[5] || 0);
  const positivePercentage =
    stats.totalRatingsCount > 0
      ? ((positiveRatingsCount / stats.totalRatingsCount) * 100).toFixed(1)
      : "0.0";

  // Category Averages
  const categoryAverages = {};
  Object.keys(CATEGORY_NAMES).forEach((cat) => {
    if (stats.categoryCounts[cat] > 0) {
      categoryAverages[cat] = Number(
        (stats.categoryTotals[cat] / stats.categoryCounts[cat]).toFixed(2),
      );
    } else {
      categoryAverages[cat] =
        avgRatingNum > 0 ? Number(avgRatingNum.toFixed(2)) : 0;
    }
  });

  // Deduplicate and process comments
  const processedHigh = processQualitativeComments(
    stats.qualitativeHigh,
    "high",
  )
    .map((c) => ({ ...c, text: cleanCommentText(c.text) }))
    .filter((c) => c.text && c.text.length > 5);

  const processedLow = processQualitativeComments(stats.qualitativeLow, "low")
    .map((c) => ({ ...c, text: cleanCommentText(c.text) }))
    .filter((c) => c.text && c.text.length > 5);

  // Unique deduplication by text
  const uniqueHigh = Array.from(
    new Map(processedHigh.map((item) => [item.text, item])).values(),
  );
  const uniqueLow = Array.from(
    new Map(processedLow.map((item) => [item.text, item])).values(),
  );

  return {
    trainer,
    sessionCount: stats.sessionCount,
    totalResponses: stats.totalResponses,
    totalHours: Math.round(stats.totalHours * 10) / 10,
    totalRatingsCount: stats.totalRatingsCount,
    avgRating,
    avgRatingNum,
    positivePercentage,
    ratingDistribution: stats.ratingDistribution,
    categoryAverages,
    uniqueCollegesCount: stats.uniqueColleges.size,
    topComments: uniqueHigh,
    leastRatedComments: uniqueLow,
  };
};

/**
 * Feedback quote card with expandable toggle and clean border accent
 */
const FeedbackQuoteItem = ({ comment, type = "positive" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const text = typeof comment === "string" ? comment : comment.text;
  const rating =
    typeof comment === "object"
      ? comment.rating || (type === "positive" ? 5 : 2)
      : type === "positive"
        ? 5
        : 2;
  const isLong = text && text.length > 150;

  const isPositive = type === "positive";
  const borderAccent = isPositive
    ? "border-l-emerald-500 bg-emerald-500/[0.03]"
    : "border-l-amber-500 bg-amber-500/[0.03]";
  const badgeColor = isPositive
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div
      className={`text-xs border border-border/70 border-l-[3px] ${borderAccent} rounded-lg p-2 px-2.5 transition-all space-y-1 shadow-2xs`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[9.5px] font-semibold text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-2.5 w-2.5 text-muted-foreground/60" />
          Student Review
        </span>
        <span
          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${badgeColor} flex items-center gap-0.5 shrink-0`}
        >
          <Star className="h-2.5 w-2.5 fill-current" />
          {Number(rating).toFixed(1)}
        </span>
      </div>

      <p
        className={`text-foreground/90 leading-snug text-[11px] ${
          !isExpanded && isLong ? "line-clamp-2" : ""
        }`}
      >
        “{text}”
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[9.5px] font-semibold text-primary hover:underline block pt-0.5 cursor-pointer"
        >
          {isExpanded ? "Show less" : "Read full review"}
        </button>
      )}
    </div>
  );
};

const TrainerComparison = ({
  trainers = [],
  sessions = [],
  onClose,
  onRemoveTrainer,
  onSelectTrainerForAnalytics,
}) => {
  // Sentiment filter for qualitative feedback
  const [feedbackView, setFeedbackView] = useState("all"); // 'all' | 'praises' | 'constructive'
  const [praiseLimit, setPraiseLimit] = useState(4);
  const [constructiveLimit, setConstructiveLimit] = useState(4);

  // Compute stats for each selected trainer
  const computedTrainers = useMemo(() => {
    return trainers.map((t, index) => {
      const stats = computeTrainerComparisonStats(t, sessions);
      return {
        ...stats,
        theme: TRAINER_THEMES[index % TRAINER_THEMES.length],
      };
    });
  }, [trainers, sessions]);

  // Radar chart data formatted for Recharts
  const radarData = useMemo(() => {
    const categories = [
      "knowledge",
      "communication",
      "delivery",
      "engagement",
      "content",
    ];
    return categories.map((catKey) => {
      const item = {
        category: CATEGORY_NAMES[catKey] || catKey,
        fullMark: 5,
      };
      computedTrainers.forEach((t, i) => {
        item[`trainer_${i}`] = t.categoryAverages[catKey] || 0;
      });
      return item;
    });
  }, [computedTrainers]);

  // Rating distribution bar chart data
  const barData = useMemo(() => {
    const starLabels = [
      { key: 5, label: "5 Stars" },
      { key: 4, label: "4 Stars" },
      { key: 3, label: "3 Stars" },
      { key: 2, label: "2 Stars" },
      { key: 1, label: "1 Star" },
    ];

    return starLabels.map(({ key, label }) => {
      const item = { rating: label };
      computedTrainers.forEach((t, i) => {
        item[`trainer_${i}`] = t.ratingDistribution[key] || 0;
      });
      return item;
    });
  }, [computedTrainers]);

  // Determine leaders for key metrics
  const leaders = useMemo(() => {
    if (computedTrainers.length < 2) return {};
    const maxRating = Math.max(...computedTrainers.map((t) => t.avgRatingNum));
    const maxResponses = Math.max(
      ...computedTrainers.map((t) => t.totalResponses),
    );
    const maxSessions = Math.max(
      ...computedTrainers.map((t) => t.sessionCount),
    );
    const maxHours = Math.max(...computedTrainers.map((t) => t.totalHours));
    const maxPositive = Math.max(
      ...computedTrainers.map((t) => parseFloat(t.positivePercentage) || 0),
    );

    return {
      avgRating: maxRating > 0 ? maxRating : null,
      totalResponses: maxResponses > 0 ? maxResponses : null,
      sessionCount: maxSessions > 0 ? maxSessions : null,
      totalHours: maxHours > 0 ? maxHours : null,
      positivePercentage: maxPositive > 0 ? maxPositive.toFixed(1) : null,
    };
  }, [computedTrainers]);

  const gridColsClass =
    computedTrainers.length === 3
      ? "grid-cols-1 md:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2";

  const handlePrint = () => {
    window.print();
  };

  if (trainers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-2xl text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="text-base font-semibold">No Trainers Selected</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Select at least 2 trainers to see their side-by-side comparison.
        </p>
        <Button size="sm" onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shadow-inner">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Side-by-Side Trainer Comparison
              </h2>
              <Badge
                variant="outline"
                className="text-[11px] font-medium bg-muted/60"
              >
                {computedTrainers.length} Faculty Selected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Comparing ratings, student feedback, teaching category radars, and
              training volume.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs px-3 gap-1.5 shadow-2xs print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print Report</span>
          </Button>
          {onClose && (
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs px-3.5 gap-1.5 shadow-xs"
            >
              <X className="h-3.5 w-3.5" />
              Close Comparison
            </Button>
          )}
        </div>
      </div>

      {/* Trainer Profiles Grid */}
      <div className={`grid gap-3 ${gridColsClass}`}>
        {computedTrainers.map((t, idx) => {
          const theme = t.theme;
          return (
            <div
              key={t.trainer.id || idx}
              className={`relative flex flex-col bg-card border ${theme.border} rounded-xl p-2.5 px-3 shadow-xs transition-all ${theme.cardHighlight}`}
            >
              {/* Top Banner Tag & Close */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {theme.label}
                  </span>
                </div>
                {onRemoveTrainer && computedTrainers.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onRemoveTrainer(t.trainer.id)}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                    title="Remove from comparison"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Profile Card Info */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center border shadow-inner font-bold ${theme.avatarBg}`}
                >
                  <User className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <h3
                      className="text-xs font-bold text-foreground truncate"
                      title={t.trainer.name}
                    >
                      {t.trainer.name}
                    </h3>
                    <span className="text-[9px] font-mono bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground border shrink-0">
                      {t.trainer.trainer_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate leading-none">
                    {t.trainer.email}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {t.trainer.domain && (
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-primary text-primary-foreground">
                        {t.trainer.domain}
                      </span>
                    )}
                    {t.trainer.specialisation && (
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground border">
                        {t.trainer.specialisation}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Skills Tags & Action Button in one compact row */}
              <div className="mt-2 pt-1.5 border-t flex items-center justify-between gap-2">
                <div className="flex items-center flex-wrap gap-1 min-w-0 flex-1">
                  <span className="text-[9px] font-medium text-muted-foreground shrink-0">
                    Skills:
                  </span>
                  {t.trainer.topics && t.trainer.topics.length > 0 ? (
                    t.trainer.topics.map((topic, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-medium px-1.5 py-0.2 bg-muted/90 rounded border text-muted-foreground whitespace-normal break-words"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-muted-foreground italic">
                      No topics listed
                    </span>
                  )}
                </div>

                {onSelectTrainerForAnalytics && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectTrainerForAnalytics(t.trainer)}
                    className="h-5 text-[10px] px-1.5 gap-0.5 text-primary hover:bg-primary/10 shrink-0 font-medium"
                  >
                    <span>Full Analytics</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Key Metrics Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Key Performance
          Indicators
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Average Rating */}
          <Card className="shadow-2xs">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{" "}
                Avg Rating
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {computedTrainers.map((t, idx) => {
                const isLeader =
                  leaders.avgRating &&
                  t.avgRatingNum === leaders.avgRating &&
                  computedTrainers.length > 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate max-w-[85px]">
                      <span className={`h-2 w-2 rounded-full ${t.theme.dot}`} />
                      {t.trainer.name.split(" ")[0]}
                    </span>
                    <div className="flex items-center gap-1.5 justify-end">
                      {isLeader && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          ★ Top
                        </span>
                      )}
                      <span className="font-bold text-sm text-foreground font-mono">
                        {t.avgRating}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 2. Total Responses */}
          <Card className="shadow-2xs">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-blue-500" /> Total Students
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {computedTrainers.map((t, idx) => {
                const isLeader =
                  leaders.totalResponses &&
                  t.totalResponses === leaders.totalResponses &&
                  computedTrainers.length > 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate max-w-[85px]">
                      <span className={`h-2 w-2 rounded-full ${t.theme.dot}`} />
                      {t.trainer.name.split(" ")[0]}
                    </span>
                    <div className="flex items-center gap-1.5 justify-end">
                      {isLeader && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Leader
                        </span>
                      )}
                      <span className="font-bold text-sm text-foreground font-mono">
                        {t.totalResponses.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 3. Training Sessions */}
          <Card className="shadow-2xs">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-purple-500" /> Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {computedTrainers.map((t, idx) => {
                const isLeader =
                  leaders.sessionCount &&
                  t.sessionCount === leaders.sessionCount &&
                  computedTrainers.length > 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate max-w-[85px]">
                      <span className={`h-2 w-2 rounded-full ${t.theme.dot}`} />
                      {t.trainer.name.split(" ")[0]}
                    </span>
                    <div className="flex items-center gap-1.5 justify-end">
                      {isLeader && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Max
                        </span>
                      )}
                      <span className="font-bold text-sm text-foreground font-mono">
                        {t.sessionCount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 4. Total Hours */}
          <Card className="shadow-2xs">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-emerald-500" /> Training
                Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {computedTrainers.map((t, idx) => {
                const isLeader =
                  leaders.totalHours &&
                  t.totalHours === leaders.totalHours &&
                  computedTrainers.length > 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate max-w-[85px]">
                      <span className={`h-2 w-2 rounded-full ${t.theme.dot}`} />
                      {t.trainer.name.split(" ")[0]}
                    </span>
                    <div className="flex items-center gap-1.5 justify-end">
                      {isLeader && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Max
                        </span>
                      )}
                      <span className="font-bold text-sm text-foreground font-mono">
                        {t.totalHours} hrs
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 5. Positive Feedback % */}
          <Card className="shadow-2xs col-span-2 sm:col-span-1">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" /> Positive
                Rate (4-5★)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {computedTrainers.map((t, idx) => {
                const isLeader =
                  leaders.positivePercentage &&
                  t.positivePercentage === leaders.positivePercentage &&
                  computedTrainers.length > 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate max-w-[85px]">
                      <span className={`h-2 w-2 rounded-full ${t.theme.dot}`} />
                      {t.trainer.name.split(" ")[0]}
                    </span>
                    <div className="flex items-center gap-1.5 justify-end">
                      {isLeader && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                          Top
                        </span>
                      )}
                      <span className="font-bold text-sm text-foreground font-mono">
                        {t.positivePercentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Visual Charts: Category Radar & Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart: Category Comparison */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Category Skills
                Comparison
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-dimensional rating comparison across standard evaluation
                pillars.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="currentColor" className="opacity-20" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground"
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 5]}
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="opacity-40"
                  />
                  {computedTrainers.map((t, idx) => (
                    <Radar
                      key={idx}
                      name={t.trainer.name}
                      dataKey={`trainer_${idx}`}
                      stroke={t.theme.color}
                      fill={t.theme.color}
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  ))}
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-popover text-popover-foreground border rounded-lg p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-bold border-b pb-1 mb-1">
                            {label}
                          </p>
                          {payload.map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-3"
                            >
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: entry.stroke }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.stroke }}
                                />
                                {entry.name}:
                              </span>
                              <span className="font-mono font-bold">
                                {Number(entry.value).toFixed(2)} / 5.0
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) => (
                      <span className="text-foreground font-medium">
                        {value}
                      </span>
                    )}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Numerical breakdown table */}
            <div className="mt-3 pt-3 border-t overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b text-[11px]">
                    <th className="text-left py-1 font-semibold">Category</th>
                    {computedTrainers.map((t, i) => (
                      <th
                        key={i}
                        className="text-right py-1 font-semibold"
                        style={{ color: t.theme.color }}
                      >
                        {t.trainer.name.split(" ")[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {Object.entries(CATEGORY_NAMES)
                    .filter(([k]) => k !== "overall")
                    .map(([key, label]) => {
                      const values = computedTrainers.map(
                        (t) => t.categoryAverages[key] || 0,
                      );
                      const maxVal = Math.max(...values);
                      return (
                        <tr
                          key={key}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-1.5 font-medium text-foreground">
                            {label}
                          </td>
                          {computedTrainers.map((t, i) => {
                            const val = t.categoryAverages[key] || 0;
                            const isMax =
                              maxVal > 0 &&
                              val === maxVal &&
                              computedTrainers.length > 1;
                            return (
                              <td
                                key={i}
                                className="text-right py-1.5 font-mono"
                              >
                                <span
                                  className={
                                    isMax
                                      ? "font-bold text-foreground"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {val.toFixed(2)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Grouped Bar Chart: Star Rating Distribution */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Star Rating
              Distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparison of feedback count distribution from 5-star to 1-star.
            </p>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    className="opacity-30"
                  />
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-popover text-popover-foreground border rounded-lg p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-bold border-b pb-1 mb-1">
                            {label}
                          </p>
                          {payload.map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-3"
                            >
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: entry.fill }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.fill }}
                                />
                                {entry.name}:
                              </span>
                              <span className="font-mono font-bold">
                                {entry.value} responses
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) => (
                      <span className="text-foreground font-medium">
                        {value}
                      </span>
                    )}
                  />
                  {computedTrainers.map((t, idx) => (
                    <Bar
                      key={idx}
                      name={t.trainer.name}
                      dataKey={`trainer_${idx}`}
                      fill={t.theme.color}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribution Percentages Breakdown */}
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Rating Breakdown Percentages:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {computedTrainers.map((t, i) => {
                  const distSum =
                    (t.ratingDistribution[1] || 0) +
                    (t.ratingDistribution[2] || 0) +
                    (t.ratingDistribution[3] || 0) +
                    (t.ratingDistribution[4] || 0) +
                    (t.ratingDistribution[5] || 0);
                  const total = distSum > 0 ? distSum : (t.totalRatingsCount || t.totalResponses || 1);
                  const fiveStarPct = (
                    ((t.ratingDistribution[5] || 0) / total) *
                    100
                  ).toFixed(1);
                  const fourStarPct = (
                    ((t.ratingDistribution[4] || 0) / total) *
                    100
                  ).toFixed(1);
                  const lowStarPct = (
                    (((t.ratingDistribution[1] || 0) +
                      (t.ratingDistribution[2] || 0)) /
                      total) *
                    100
                  ).toFixed(1);

                  return (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-muted/40 border text-xs space-y-1"
                    >
                      <div
                        className="font-bold truncate"
                        style={{ color: t.theme.color }}
                      >
                        {t.trainer.name}
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>5★ Rating:</span>
                        <span className="font-semibold text-foreground">
                          {fiveStarPct}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>4★ Rating:</span>
                        <span className="font-semibold text-foreground">
                          {fourStarPct}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>1-2★ Concerns:</span>
                        <span className="font-semibold text-foreground">
                          {lowStarPct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Feedback & Qualitative Highlights Comparison */}
      <Card className="shadow-xs border rounded-xl overflow-hidden">
        <CardHeader className="p-3 py-2 border-b bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" /> Qualitative
              Student Feedback
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Side-by-side verbatim student feedback, praise highlights, and
              constructive reviews.
            </p>
          </div>

          {/* Sentiment Filter Switcher */}
          <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border">
            <button
              type="button"
              onClick={() => setFeedbackView("all")}
              className={`text-[11px] px-2 py-0.5 rounded-md transition-all font-medium ${
                feedbackView === "all"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Feedback
            </button>
            <button
              type="button"
              onClick={() => setFeedbackView("praises")}
              className={`text-[11px] px-2 py-0.5 rounded-md transition-all font-medium flex items-center gap-1 ${
                feedbackView === "praises"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ThumbsUp className="h-2.5 w-2.5" /> Praises
            </button>
            <button
              type="button"
              onClick={() => setFeedbackView("constructive")}
              className={`text-[11px] px-2 py-0.5 rounded-md transition-all font-medium flex items-center gap-1 ${
                feedbackView === "constructive"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ThumbsDown className="h-2.5 w-2.5" /> Needs Attention
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          <div className={`grid gap-3 ${gridColsClass}`}>
            {computedTrainers.map((t, idx) => {
              const theme = t.theme;
              const hasPraises = t.topComments && t.topComments.length > 0;
              const hasConstructive =
                t.leastRatedComments && t.leastRatedComments.length > 0;

              return (
                <div
                  key={idx}
                  className={`bg-muted/15 border ${theme.border} rounded-xl p-2.5 space-y-2 flex flex-col justify-between`}
                >
                  {/* Column Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full ${theme.dot} shrink-0`}
                        />
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {t.trainer.name}
                        </h4>
                      </div>
                      <span className="text-[9.5px] font-mono text-muted-foreground px-1.5 py-0.2 bg-muted rounded border shrink-0">
                        {t.positivePercentage}% Positive
                      </span>
                    </div>

                    {/* Scrollable Feedback Stream with synchronized max height */}
                    <div
                      className={`mt-2 space-y-2 overflow-y-auto pr-1 ${
                        feedbackView === "all"
                          ? "max-h-[300px]"
                          : "max-h-[420px]"
                      }`}
                    >
                      {/* 1. Student Praises & Highlights (4-5 Stars) */}
                      {(feedbackView === "all" ||
                        feedbackView === "praises") && (
                        <div className="space-y-1.5">
                          {feedbackView === "all" && (
                            <div className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> Praises &
                                Strengths
                              </span>
                              <span className="text-[9.5px] text-muted-foreground font-normal">
                                {t.topComments.length} reviews
                              </span>
                            </div>
                          )}

                          {hasPraises ? (
                            <div className="space-y-1.5">
                              {(feedbackView === "all"
                                ? t.topComments.slice(0, 3)
                                : t.topComments.slice(0, praiseLimit)
                              ).map((c, i) => (
                                <FeedbackQuoteItem
                                  key={i}
                                  comment={c}
                                  type="positive"
                                />
                              ))}

                              {/* Load More for Praises */}
                              {feedbackView === "praises" &&
                                t.topComments.length > 4 && (
                                  <div className="pt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>
                                      {Math.min(
                                        praiseLimit,
                                        t.topComments.length,
                                      )}{" "}
                                      of {t.topComments.length} reviews
                                    </span>
                                    {praiseLimit < t.topComments.length ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPraiseLimit((prev) => prev + 4)
                                        }
                                        className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 hover:bg-primary/15 px-2 py-0.5 rounded border border-primary/20 transition-colors"
                                      >
                                        Load More (+4)
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setPraiseLimit(4)}
                                        className="text-muted-foreground hover:text-foreground font-medium hover:underline cursor-pointer"
                                      >
                                        Show Less
                                      </button>
                                    )}
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground italic bg-muted/30 p-2 rounded-lg border border-dashed text-center">
                              No praise quotes recorded.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Constructive Feedback & Areas for Improvement (1-2 Stars) */}
                      {(feedbackView === "all" ||
                        feedbackView === "constructive") && (
                        <div className="space-y-1.5 pt-0.5">
                          {feedbackView === "all" && (
                            <div className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <AlertCircle className="h-2.5 w-2.5" />{" "}
                                Constructive Feedback
                              </span>
                              <span className="text-[9.5px] text-muted-foreground font-normal">
                                {t.leastRatedComments.length} reviews
                              </span>
                            </div>
                          )}

                          {hasConstructive ? (
                            <div className="space-y-1.5">
                              {(feedbackView === "all"
                                ? t.leastRatedComments.slice(0, 3)
                                : t.leastRatedComments.slice(
                                    0,
                                    constructiveLimit,
                                  )
                              ).map((c, i) => (
                                <FeedbackQuoteItem
                                  key={i}
                                  comment={c}
                                  type="constructive"
                                />
                              ))}

                              {/* Load More for Needs Attention */}
                              {feedbackView === "constructive" &&
                                t.leastRatedComments.length > 4 && (
                                  <div className="pt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>
                                      {Math.min(
                                        constructiveLimit,
                                        t.leastRatedComments.length,
                                      )}{" "}
                                      of {t.leastRatedComments.length} reviews
                                    </span>
                                    {constructiveLimit <
                                    t.leastRatedComments.length ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConstructiveLimit(
                                            (prev) => prev + 4,
                                          )
                                        }
                                        className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 hover:bg-primary/15 px-2 py-0.5 rounded border border-primary/20 transition-colors"
                                      >
                                        Load More (+4)
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConstructiveLimit(4)}
                                        className="text-muted-foreground hover:text-foreground font-medium hover:underline cursor-pointer"
                                      >
                                        Show Less
                                      </button>
                                    )}
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground italic bg-muted/30 p-2 rounded-lg border border-dashed text-center">
                              No critical feedback submitted.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* College Reach Footnote */}
                  <div className="pt-1.5 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-2.5 w-2.5" />{" "}
                      {t.uniqueCollegesCount} Institutes Reached
                    </span>
                    <span className="font-mono">{t.totalHours} hrs Total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainerComparison;
