import React, { useMemo } from "react";
import {
  Award,
  BarChart3,
  Medal,
  Search,
  Star,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

  if (ratingCount === 0 && stats?.avgRating && stats?.totalResponses) {
    ratingCount = Number(stats.totalResponses) || 0;
    ratingSum = (Number(stats.avgRating) || 0) * ratingCount;
  }

  return { ratingSum, ratingCount };
};

const getAssignedTrainers = (session) =>
  session.assignedTrainers ||
  (session.assignedTrainer ? [session.assignedTrainer] : []);

const getTrainerStatsForSession = (session, trainerId) => {
  const compiledStats = session.compiledStats;
  if (!compiledStats) return null;

  if (compiledStats.byTrainer?.[trainerId]) {
    return compiledStats.byTrainer[trainerId];
  }

  const assignedTrainers = getAssignedTrainers(session);
  const trainerIds = session.trainerIds || assignedTrainers.map((t) => t.id);
  const isAssigned = trainerIds.includes(trainerId);

  if (isAssigned && assignedTrainers.length <= 1) {
    return compiledStats;
  }

  return null;
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
    const stats = getTrainerStatsForSession(session, trainer.id);
    if (!stats) return;

    const responses = Number(stats.totalResponses) || 0;
    const { ratingSum, ratingCount } = getRatingBreakdown(stats);

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
  searchQuery,
  onSelectTrainer,
}) => {
  const leaderboard = useMemo(() => {
    const activeTrainers = trainers.filter((trainer) => !trainer.isDeleted);
    const analyticSessions = sessions.filter(
      (session) =>
        session.compiledStats &&
        ["inactive", "completed", "active"].includes(session.status),
    );

    let globalRatingSum = 0;
    let globalRatingCount = 0;
    analyticSessions.forEach((session) => {
      const { ratingSum, ratingCount } = getRatingBreakdown(session.compiledStats);
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

    return activeTrainers
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
  }, [sessions, trainers]);

  const searchLower = searchQuery.trim().toLowerCase();
  const visibleRows = useMemo(() => leaderboard.filter((trainer) => {
    if (!searchLower) return true;
    return (
      trainer.name?.toLowerCase().includes(searchLower) ||
      trainer.email?.toLowerCase().includes(searchLower) ||
      trainer.domain?.toLowerCase().includes(searchLower) ||
      trainer.specialisation?.toLowerCase().includes(searchLower) ||
      trainer.trainer_id?.toLowerCase().includes(searchLower)
    );
  }), [leaderboard, searchLower]);

  const topThree = visibleRows.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topThree.map((trainer, index) => {
          const rank = index + 1;
          return (
            <button
              key={trainer.id}
              type="button"
              onClick={() => onSelectTrainer(trainer)}
              className={`text-left border rounded-xl p-5 shadow-sm hover:shadow-md transition-all ${getRankTone(rank)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {rank === 1 ? (
                      <Trophy className="h-5 w-5" />
                    ) : (
                      <Medal className="h-5 w-5" />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      Rank {rank}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-foreground truncate">
                    {trainer.name}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {trainer.trainer_id} - {trainer.domain || "No domain"}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-background/80 border flex items-center justify-center">
                  <Award className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-background/70 border px-2 py-2">
                  <p className="text-lg font-bold text-foreground">
                    {trainer.rankScore}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Score</p>
                </div>
                <div className="rounded-lg bg-background/70 border px-2 py-2">
                  <p className="text-lg font-bold text-foreground">
                    {trainer.avgRating ? trainer.avgRating.toFixed(2) : "0.00"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Rating</p>
                </div>
                <div className="rounded-lg bg-background/70 border px-2 py-2">
                  <p className="text-lg font-bold text-foreground">
                    {trainer.totalResponses}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Responses</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-[72px_1.5fr_1fr_120px_120px_120px_110px] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 min-w-[920px]">
          <span>Rank</span>
          <span>Trainer</span>
          <span>Domain</span>
          <span className="text-right">Score</span>
          <span className="text-right">Rating</span>
          <span className="text-right">Responses</span>
          <span className="text-right">Sessions</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[920px] divide-y">
            {visibleRows.map((trainer, index) => {
              const rank = index + 1;
              return (
                <button
                  key={trainer.id}
                  type="button"
                  onClick={() => onSelectTrainer(trainer)}
                  className="grid w-full grid-cols-[72px_1.5fr_1fr_120px_120px_120px_110px] gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold ${getRankTone(rank)}`}
                    >
                      {rank}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{trainer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {trainer.trainer_id} - {trainer.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {trainer.domain || "No domain"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {trainer.specialisation || "No specialisation"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className="text-lg font-bold">{trainer.rankScore}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">
                      {trainer.avgRating ? trainer.avgRating.toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{trainer.totalResponses}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span>{trainer.sessionCount}</span>
                  </div>
                </button>
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
