import React, { useState, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  BarChart3,
  Loader2,
  Medal,
  Search,
  Star,
  Trophy,
  User,
  Users,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveTrainerStatsFromSession } from "@/services/superadmin/trainerService";

const getRatingBreakdown = (stats) => {
  const distribution = stats?.ratingDistribution || {};
  let ratingSum = 0;
  let ratingCount = 0;

  Object.entries(distribution).forEach(([rating, count]) => {
    const numericRating = Number(rating);
    const numericCount = Number(count) || 0;
    if (numericRating > 0 && numericCount > 0) {
      ratingSum += numericRating * numericCount;
      ratingCount += numericCount;
    }
  });

  const responses =
    Number(stats?.totalResponses) ||
    Number(stats?.responseCount) ||
    ratingCount ||
    0;

  if (ratingCount === 0 && stats?.avgRating && responses > 0) {
    ratingCount = responses;
    ratingSum = (Number(stats.avgRating) || 0) * responses;
  }

  return { ratingSum, ratingCount, responses };
};

const scoreTrainer = (trainer, sessions, globalAverage, maxResponses, maxSessions) => {
  const totals = {
    sessionCount: 0,
    totalResponses: 0,
    ratingSum: 0,
    ratingCount: 0,
    latestSessionDate: null,
  };

  sessions.forEach((session) => {
    const stats = resolveTrainerStatsFromSession(session, trainer);
    if (!stats) return;

    const { ratingSum, ratingCount, responses } = getRatingBreakdown(stats);

    totals.sessionCount += 1;
    totals.totalResponses += responses;
    totals.ratingSum += ratingSum;
    totals.ratingCount += ratingCount;

    const sessionDate = session.sessionDate || session.createdAt?.toDate?.();
    if (sessionDate) {
      const dateValue = new Date(sessionDate);
      if (!Number.isNaN(dateValue.getTime())) {
        if (!totals.latestSessionDate || dateValue > totals.latestSessionDate) {
          totals.latestSessionDate = dateValue;
        }
      }
    }
  });

  const avgRating =
    totals.ratingCount > 0 ? totals.ratingSum / totals.ratingCount : 0;
  const confidenceRatings = 20;
  const weightedRating =
    totals.ratingCount > 0
      ? (totals.ratingSum + globalAverage * confidenceRatings) /
        (totals.ratingCount + confidenceRatings)
      : 0;
  const responseScore =
    maxResponses > 0
      ? (Math.log1p(totals.totalResponses) / Math.log1p(maxResponses)) * 20
      : 0;
  const sessionScore =
    maxSessions > 0
      ? (Math.log1p(totals.sessionCount) / Math.log1p(maxSessions)) * 10
      : 0;
  const ratingScore = (weightedRating / 5) * 70;
  const score =
    totals.totalResponses > 0
      ? Math.round((ratingScore + responseScore + sessionScore) * 10) / 10
      : 0;

  return {
    ...trainer,
    avgRating,
    latestSessionDate: totals.latestSessionDate,
    rankScore: score,
    sessionCount: totals.sessionCount,
    totalResponses: totals.totalResponses,
  };
};

const getRankTone = (rank) => {
  if (rank === 1) return "border-amber-300 bg-amber-50 text-amber-700";
  if (rank === 2) return "border-slate-300 bg-slate-50 text-slate-700";
  if (rank === 3) return "border-orange-300 bg-orange-50 text-orange-700";
  return "border-border bg-background text-muted-foreground";
};

const TrainerLeaderboard = ({
  trainers,
  sessions,
  loading = false,
  searchQuery,
  onSelectTrainer,
  selectedForComparison = [],
  onToggleCompare,
}) => {
  const [sortField, setSortField] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");

  const baseLeaderboard = useMemo(() => {
    const activeTrainers = trainers.filter((trainer) => !trainer.isDeleted);
    const analyticSessions = sessions.filter(
      (session) => !!(session.compiledStats || session.stats),
    );

    let globalRatingSum = 0;
    let globalRatingCount = 0;
    analyticSessions.forEach((session) => {
      const cs = session.compiledStats || session.stats;
      const { ratingSum, ratingCount } = getRatingBreakdown(cs);
      globalRatingSum += ratingSum;
      globalRatingCount += ratingCount;
    });
    const globalAverage =
      globalRatingCount > 0 ? globalRatingSum / globalRatingCount : 3.5;

    const rawRows = activeTrainers.map((trainer) =>
      scoreTrainer(trainer, analyticSessions, globalAverage, 1, 1),
    );

    const maxResponses = Math.max(...rawRows.map((row) => row.totalResponses), 0);
    const maxSessions = Math.max(...rawRows.map((row) => row.sessionCount), 0);

    const scored = activeTrainers
      .map((trainer) =>
        scoreTrainer(
          trainer,
          analyticSessions,
          globalAverage,
          maxResponses,
          maxSessions,
        ),
      )
      .sort((a, b) => {
        if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        if (b.totalResponses !== a.totalResponses) {
          return b.totalResponses - a.totalResponses;
        }
        return (a.name || "").localeCompare(b.name || "");
      });

    return scored.map((trainer, index) => ({
      ...trainer,
      baseRank: index + 1,
    }));
  }, [sessions, trainers]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "trainer" || field === "rank" ? "asc" : "desc");
    }
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const filtered = baseLeaderboard.filter((trainer) => {
      if (!searchLower) return true;
      return (
        trainer.name?.toLowerCase().includes(searchLower) ||
        trainer.email?.toLowerCase().includes(searchLower) ||
        trainer.domain?.toLowerCase().includes(searchLower) ||
        trainer.specialisation?.toLowerCase().includes(searchLower) ||
        trainer.trainer_id?.toLowerCase().includes(searchLower)
      );
    });

    return [...filtered].sort((a, b) => {
      const modifier = sortOrder === "asc" ? 1 : -1;
      if (sortField === "rating") {
        const diff = (a.avgRating || 0) - (b.avgRating || 0);
        if (diff !== 0) return diff * modifier;
        return (b.totalResponses - a.totalResponses) * modifier;
      }
      if (sortField === "responses") {
        const diff = (a.totalResponses || 0) - (b.totalResponses || 0);
        if (diff !== 0) return diff * modifier;
        return (b.avgRating - a.avgRating) * modifier;
      }
      if (sortField === "sessions") {
        const diff = (a.sessionCount || 0) - (b.sessionCount || 0);
        if (diff !== 0) return diff * modifier;
        return (b.totalResponses - a.totalResponses) * modifier;
      }
      if (sortField === "trainer") {
        return (a.name || "").localeCompare(b.name || "") * modifier;
      }
      if (sortField === "rank") {
        return (a.baseRank - b.baseRank) * modifier;
      }
      // Default: 'score'
      if (b.rankScore !== a.rankScore) {
        return (a.rankScore - b.rankScore) * modifier;
      }
      if (b.avgRating !== a.avgRating) {
        return (a.avgRating - b.avgRating) * modifier;
      }
      if (b.totalResponses !== a.totalResponses) {
        return (a.totalResponses - b.totalResponses) * modifier;
      }
      return (a.name || "").localeCompare(b.name || "") * modifier;
    });
  }, [baseLeaderboard, searchLower, sortField, sortOrder]);

  const topThree = baseLeaderboard.slice(0, 3);

  const isTrainerSelected = (trainer) => {
    return selectedForComparison.some(
      (t) => t.id === trainer.id || t.trainer_id === trainer.trainer_id
    );
  };

  const renderSortHeader = (label, field, align = "right") => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
          align === "right" ? "justify-end ml-auto" : "justify-start"
        } ${
          isActive
            ? "text-primary font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title={`Sort by ${label} (${isActive && sortOrder === "asc" ? "Ascending" : "Descending"})`}
      >
        <span>{label}</span>
        <span
          className={`inline-flex items-center transition-all ${
            isActive
              ? "text-primary opacity-100"
              : "opacity-35 group-hover:opacity-75"
          }`}
        >
          {isActive ? (
            sortOrder === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3" />
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {topThree.map((trainer, index) => {
          const rank = index + 1;
          const isSelected = isTrainerSelected(trainer);
          return (
            <div
              key={trainer.id}
              className={`relative text-left border rounded-xl p-3.5 shadow-xs transition-all ${
                isSelected ? "ring-2 ring-primary border-primary" : ""
              } ${getRankTone(rank)}`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => onSelectTrainer(trainer)}
                  className="min-w-0 text-left flex-1"
                >
                  <div className="flex items-center gap-1.5">
                    {rank === 1 ? (
                      <Trophy className="h-4 w-4" />
                    ) : (
                      <Medal className="h-4 w-4" />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wide">
                      Rank {rank}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-foreground truncate hover:underline">
                    {trainer.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {trainer.trainer_id} - {trainer.domain || "No domain"}
                  </p>
                </button>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="h-8 w-8 rounded-full bg-background/80 border flex items-center justify-center shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  {onToggleCompare && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCompare(trainer);
                      }}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background/90 text-muted-foreground hover:text-foreground border-border"
                      }`}
                      title="Toggle compare"
                    >
                      {isSelected ? "✓ Compare" : "+ Compare"}
                    </button>
                  )}
                </div>
              </div>

              <div
                onClick={() => onSelectTrainer(trainer)}
                className="mt-3 grid grid-cols-3 gap-1.5 text-center cursor-pointer"
              >
                <div className="rounded-md bg-background/70 border px-1.5 py-1.5">
                  <p className="text-base font-bold text-foreground">
                    {trainer.rankScore}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Score</p>
                </div>
                <div className="rounded-md bg-background/70 border px-1.5 py-1.5">
                  <p className="text-base font-bold text-foreground">
                    {trainer.avgRating ? trainer.avgRating.toFixed(2) : "0.00"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Rating</p>
                </div>
                <div className="rounded-md bg-background/70 border px-1.5 py-1.5">
                  <p className="text-base font-bold text-foreground">
                    {trainer.totalResponses}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Responses</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="grid grid-cols-[40px_50px_1.5fr_1fr_90px_90px_90px_80px] gap-2.5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b min-w-[880px] items-center">
          <span className="flex items-center justify-center text-muted-foreground" title="Compare selection">
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </span>
          {renderSortHeader("Rank", "rank", "left")}
          {renderSortHeader("Trainer", "trainer", "left")}
          <span>Domain</span>
          {renderSortHeader("Score", "score", "right")}
          {renderSortHeader("Rating", "rating", "right")}
          {renderSortHeader("Responses", "responses", "right")}
          {renderSortHeader("Sessions", "sessions", "right")}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[880px] divide-y">
            {visibleRows.map((trainer) => {
              const isSelected = isTrainerSelected(trainer);
              return (
                <div
                  key={trainer.id}
                  className={`grid w-full grid-cols-[40px_50px_1.5fr_1fr_90px_90px_90px_80px] gap-2.5 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors items-center ${
                    isSelected ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  {/* Compare Toggle Checkbox */}
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleCompare && onToggleCompare(trainer)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                      title={isSelected ? "Remove from comparison" : "Add to comparison"}
                    />
                  </div>

                  {/* Rank Badge */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center cursor-pointer"
                  >
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${getRankTone(trainer.baseRank)}`}
                      title={`Overall Leaderboard Rank #${trainer.baseRank}`}
                    >
                      {trainer.baseRank}
                    </span>
                  </div>

                  {/* Trainer Info */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                        {trainer.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {trainer.trainer_id} - {trainer.email}
                      </p>
                    </div>
                  </div>

                  {/* Domain & Specialisation */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center min-w-0 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {trainer.domain || "No domain"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {trainer.specialisation || "No specialisation"}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center justify-end cursor-pointer"
                  >
                    <span className="text-sm font-bold">{trainer.rankScore}</span>
                  </div>

                  {/* Rating */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center justify-end gap-1 cursor-pointer"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold">
                      {trainer.avgRating ? trainer.avgRating.toFixed(2) : "0.00"}
                    </span>
                  </div>

                  {/* Responses */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center justify-end gap-1 cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{trainer.totalResponses}</span>
                  </div>

                  {/* Sessions */}
                  <div
                    onClick={() => onSelectTrainer(trainer)}
                    className="flex items-center justify-end gap-1 cursor-pointer"
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{trainer.sessionCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {visibleRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/10 border-2 border-dashed border-muted rounded-2xl text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-xl font-semibold mt-4">No leaderboard matches</h3>
          <p className="text-muted-foreground mt-2">
            Try a trainer name, ID, domain, or specialisation.
          </p>
        </div>
      )}
    </div>
  );
};

export default TrainerLeaderboard;

