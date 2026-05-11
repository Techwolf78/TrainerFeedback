import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge"; // Added for live indicator
import {
  ArrowLeft,
  Star,
  Users,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Download,
  Calendar,
  User,
  Building2,
  Sparkles,
  Camera,
  RefreshCw, // Added for live analytics refresh
  Loader2, // Added for loading state
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import { useRef } from "react";

// Helper function to get a color from red (0) to yellow (2.5) to green (5)
const getDynamicColor = (rating) => {
  const safeRating = Number(rating) || 0;
  // Hue 0 = red, 60 = yellow, 120 = green
  const hue = Math.max(0, Math.min(120, (safeRating / 5) * 120));
  // Professional, muted tones (lower saturation)
  return `hsl(${hue}, 65%, 45%)`;
};

const SessionAnalytics = ({ session, onBack }) => {
  const analyticsRef = useRef(null);
  const [stats, setStats] = useState(session?.compiledStats || null);
  const [loading, setLoading] = useState(!session?.compiledStats);
  const [isLive, setIsLive] = useState(session?.status === "active");
  const [learnedLimit, setLearnedLimit] = useState(25);
  const [futureLimit, setFutureLimit] = useState(25);

  const fetchLiveStats = async (showToast = false) => {
    try {
      if (showToast) toast.loading("Fetching live data...");
      setLoading(true);

      const { getResponses, compileSessionStatsFromResponses } =
        await import("@/services/superadmin/responseService");

      const responses = await getResponses(session.id);

      // Filter by session version if it exists
      const currentVersionResponses = responses.filter(
        (r) => (r.version ?? 0) === (session.version ?? 0),
      );

      const compiled = compileSessionStatsFromResponses(
        currentVersionResponses,
        session.questions || [],
      );

      setStats(compiled);
      console.group(`--- Live Analytics: ${session.topic} ---`);
      console.log("Total Responses:", compiled.totalResponses);
      console.log("Top Rated Comments:", compiled.topComments);
      console.log("Average Rated Comments:", compiled.avgComments);
      console.log("Improvement Areas:", compiled.leastRatedComments);
      console.log("Full Compiled Stats:", compiled);
      console.groupEnd();
      if (showToast) {
        toast.dismiss();
        toast.success("Live data updated");
      }
    } catch (error) {
      console.error("Failed to fetch live stats:", error);
      if (showToast) {
        toast.dismiss();
        toast.error("Failed to update live data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.compiledStats || session?.status === "active") {
      fetchLiveStats();
    }
  }, [session?.id]);

  const handleExport = async () => {
    if (!stats) return;

    try {
      toast.loading("Exporting report...");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Gryphon Academy";

      // [NEW] Fetch detailed responses
      const { getResponses } =
        await import("@/services/superadmin/responseService");
      const allResponses = await getResponses(session.id);

      // Filter by session version if it exists
      const responses = allResponses.filter(
        (r) => (r.version ?? 0) === (session.version ?? 0),
      );

      // --- SHEET 1: RESPONSES ---
      const responsesSheet = workbook.addWorksheet("Responses");
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

      const rows = responses.map((resp) => {
        const row = {
          id: resp.id,
          submittedAt: resp.submittedAt?.toDate
            ? resp.submittedAt.toDate().toLocaleString()
            : new Date(resp.submittedAt).toLocaleString(),
          deviceId: resp.deviceId,
        };
        if (resp.answers) {
          resp.answers.forEach((ans) => {
            row[`q_${ans.questionId}`] = ans.value;
          });
        }
        return row;
      });
      responsesSheet.addRows(rows);
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
        { field: "Total Responses", value: stats.totalResponses },
        { field: "Average Rating", value: stats.avgRating },
      ]);
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF6366F1" },
      };
      summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      // --- SHEET 3: COMMENTS ---
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

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        blob,
        `analytics_${session.topic.replace(/[^a-z0-9]/gi, "_")}.xlsx`,
      );

      toast.dismiss();
      toast.success("Report exported");
    } catch (error) {
      console.error("Export failed:", error);
      toast.dismiss();
      toast.error("Export failed");
    }
  };

  const handleExportSnapshot = async () => {
    if (!analyticsRef.current) return;

    try {
      toast.loading("Generating analytics snapshot...");

      // Small delay to ensure any layout/animations are ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(analyticsRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        filter: (node) => {
          if (node.classList && node.classList.contains("snapshot-ignore")) {
            return false;
          }
          return true;
        },
      });

      saveAs(
        dataUrl,
        `snapshot_${session.topic.replace(/[^a-z0-9]/gi, "_")}.png`,
      );
      toast.dismiss();
      toast.success("Snapshot saved successfully!");
    } catch (error) {
      console.error("Snapshot capture failed:", error);
      toast.dismiss();
      toast.error("Failed to capture snapshot");
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Calculating live analytics...</p>
      </div>
    );
  }

  if (!stats || stats.totalResponses === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {session.status === "active"
            ? "No responses received yet for this active session."
            : "No analytics data available for this session."}
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" /> Back to Sessions
          </Button>
          {session.status === "active" && (
            <Button
              variant="default"
              size="lg"
              className="gap-2"
              onClick={() => fetchLiveStats(true)}
            >
              <RefreshCw className="h-5 w-5" /> Refresh
            </Button>
          )}
        </div>
      </div>
    );
  }

  const loadMoreStep = 25;

  const learnedToShow = (stats.topicsLearned || []).slice(0, learnedLimit);
  const futureToShow = (stats.futureTopics || []).slice(0, futureLimit);

  // Prepare chart data - all ratings for bar chart (including zeros)
  const ratingDataAll = Object.entries(stats.ratingDistribution || {}).map(
    ([rating, count]) => ({
      name: `${rating} Star`,
      value: count,
      rating: parseInt(rating),
    }),
  );

  // Filtered data for pie chart (exclude zeros)
  const ratingDataFiltered = ratingDataAll.filter((item) => item.value > 0);

  // Prepare radar chart data from category averages
  const categoryLabels = {
    knowledge: "Knowledge",
    communication: "Communication",
    engagement: "Engagement",
    content: "Content",
    delivery: "Delivery",
    overall: "Overall",
  };

  const radarData = Object.entries(stats.categoryAverages || {}).map(
    ([key, value]) => ({
      category: categoryLabels[key] || key,
      score: value,
      fullMark: 5,
    }),
  );

  return (
    <div className="space-y-4 p-2 bg-background" ref={analyticsRef}>
      {/* Top Header Section */}
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                {session.topic}
              </h1>
              {session.status === "active" && (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 animate-pulse flex items-center gap-1 h-5 text-[10px] px-1.5 py-0 font-medium"
                >
                  <div className="h-1 w-1 rounded-full bg-green-500" />
                  Live
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{session.collegeName}</span>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{(session.assignedTrainers || (session.assignedTrainer ? [session.assignedTrainer] : [])).map(t => t.name).join(", ") || "Trainer not assigned"}</span>
              </div>
              {session.domain && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>{session.domain}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 snapshot-ignore">
          {session.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLiveStats(true)}
              className="gap-1 h-7 text-[13px] px-2 font-medium"
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1 h-7 text-[13px] px-2 font-medium"
          >
            <Download className="h-3 w-3" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSnapshot}
            className="gap-1 h-7 text-[13px] px-2 font-medium"
          >
            <Camera className="h-3 w-3" /> Snapshot
          </Button>
        </div>
      </div>

      {/* Advanced Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Overall Rating */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Overall Rating
                </p>
                <h3 className="text-xl font-bold text-primary mt-1">
                  {stats.avgRating.toFixed(2)}
                </h3>
              </div>
              <div
                className="p-1.5 rounded-full"
                style={{
                  backgroundColor: getDynamicColor(stats.avgRating)
                    .replace("hsl", "hsla")
                    .replace(")", ", 0.1)"),
                }}
              >
                <Star
                  className="h-4 w-4"
                  style={{
                    fill: getDynamicColor(stats.avgRating),
                    color: getDynamicColor(stats.avgRating),
                  }}
                />
              </div>
            </div>
            <div
              className="mt-2 h-1 w-full rounded-full overflow-hidden"
              style={{
                backgroundColor: getDynamicColor(stats.avgRating)
                  .replace("hsl", "hsla")
                  .replace(")", ", 0.1)"),
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(parseFloat(stats.avgRating) / 5) * 100}%`,
                  backgroundColor: getDynamicColor(stats.avgRating),
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Total Responses */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Total Responses
                </p>
                <h3 className="text-xl font-bold text-blue-600 mt-1">
                  {stats.totalResponses}
                </h3>
              </div>
              <div className="bg-blue-500/10 p-1.5 rounded-full">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Student submissions
            </p>
          </CardContent>
        </Card>

        {/* Top Rating */}
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Top Rating
                </p>
                <h3 className="text-xl font-bold text-green-600 mt-1">
                  {stats.topRating.toFixed(2)}
                </h3>
              </div>
              <div className="bg-green-500/10 p-1.5 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Highest score</p>
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="bg-cyan-500/5 border-cyan-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Content Quality
                </p>
                <h3 className="text-xl font-bold text-cyan-600 mt-1">
                  {(stats.categoryAverages?.content || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-cyan-500/10 p-1.5 rounded-full">
                <MessageSquare className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Subject relevance</p>
          </CardContent>
        </Card>

        {/* Knowledge */}
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Knowledge
                </p>
                <h3 className="text-xl font-bold text-amber-600 mt-1">
                  {(stats.categoryAverages?.knowledge || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-amber-500/10 p-1.5 rounded-full">
                <User className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Expertise of trainer</p>
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Engagement
                </p>
                <h3 className="text-xl font-bold text-purple-600 mt-1">
                  {(stats.categoryAverages?.engagement || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-purple-500/10 p-1.5 rounded-full">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Student involvement</p>
          </CardContent>
        </Card>

        {/* Communication */}
        <Card className="bg-pink-500/5 border-pink-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Communication
                </p>
                <h3 className="text-xl font-bold text-pink-600 mt-1">
                  {(stats.categoryAverages?.communication || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-pink-500/10 p-1.5 rounded-full">
                <MessageSquare className="h-4 w-4 text-pink-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Clarity & delivery</p>
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card className="bg-indigo-500/5 border-indigo-500/20">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight">
                  Delivery
                </p>
                <h3 className="text-xl font-bold text-indigo-600 mt-1">
                  {(stats.categoryAverages?.delivery || 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-indigo-500/10 p-1.5 rounded-full">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Presentation skills</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Rating Distribution (BarChart) */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">
              Rating Distribution
            </CardTitle>
            <CardDescription className="text-[10px]">
              Response count per rating level
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDataAll} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="hsl(var(--muted-foreground)/0.1)"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
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
                              {payload[0].value} responses
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {ratingDataAll.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.rating === 5
                            ? "#22c55e"
                            : entry.rating === 4
                              ? "#84cc16"
                              : entry.rating === 3
                                ? "#eab308"
                                : entry.rating === 2
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

        {/* Category Performance (RadarChart) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">
              Category Scores
            </CardTitle>
            <CardDescription className="text-[10px]">
              Metrics breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="hsl(var(--muted-foreground)/0.2)" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={(props) => {
                        const { payload, x, y, textAnchor, index } = props;
                        const categoryData = radarData[index];
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
                          <text
                            x={x}
                            y={y}
                            textAnchor={textAnchor}
                            fill="hsl(var(--muted-foreground))"
                            fontSize={9}
                          >
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

        {/* Rating Breakdown (PieChart) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-1 pt-2">
            <CardTitle className="text-[13px] font-medium">
              Rating Breakdown
            </CardTitle>
            <CardDescription className="text-[10px]">
              Percentage distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <div className="h-[160px] w-full">
              {ratingDataFiltered.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ratingDataFiltered}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {ratingDataFiltered.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`hsl(215, 85%, ${75 - index * 6}%)`}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[13px] font-medium">
                  No distribution data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Lower Layout: Comments & Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Student Comments */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[13px] font-medium">
                Student Comments
              </CardTitle>
              <CardDescription className="text-[10px]">
                Feedback by rating level
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1 bg-secondary text-secondary-foreground">
              {stats.totalResponses} Total
            </Badge>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <Tabs defaultValue="top" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-7 p-0.5 bg-muted rounded-md mb-2">
                <TabsTrigger value="top" className="text-[11px] font-medium py-1">Top</TabsTrigger>
                <TabsTrigger value="average" className="text-[11px] font-medium py-1">Average</TabsTrigger>
                <TabsTrigger value="improvement" className="text-[11px] font-medium py-1">Areas of Imp</TabsTrigger>
              </TabsList>

              <TabsContent value="top" className="mt-0">
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(stats.topComments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No top comments available
                    </p>
                  ) : (
                    stats.topComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border/60 bg-card/50 relative hover:border-primary/20 transition-colors"
                      >
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-xs italic pr-8 text-foreground leading-normal">
                          "{c.text}"
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {c.avgRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="average" className="mt-0">
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(stats.avgComments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No average comments available
                    </p>
                  ) : (
                    stats.avgComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border/60 bg-card/50 relative hover:border-primary/20 transition-colors"
                      >
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-xs italic pr-8 text-foreground leading-normal">
                          "{c.text}"
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {c.avgRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="improvement" className="mt-0">
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(stats.leastRatedComments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                      No improvement areas recorded
                    </p>
                  ) : (
                    stats.leastRatedComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg border border-border/60 bg-card/50 relative hover:border-primary/20 transition-colors"
                      >
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-xs italic pr-8 text-foreground leading-normal">
                          "{c.text}"
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {c.avgRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Session Topics */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[13px] font-medium">
                Topics & Suggestions
              </CardTitle>
              <CardDescription className="text-[10px]">
                Topics covered and future requests
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            <Tabs defaultValue="learned" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-7 p-0.5 bg-muted rounded-md mb-2">
                <TabsTrigger value="learned" className="text-[11px] font-medium py-1">Learned</TabsTrigger>
                <TabsTrigger value="future" className="text-[11px] font-medium py-1">Future</TabsTrigger>
              </TabsList>

              <TabsContent value="learned" className="mt-0">
                <div className="max-h-[160px] overflow-y-auto pr-1">
                  {(stats.topicsLearned || []).length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5 p-1">
                        <TooltipProvider>
                          {learnedToShow.map((topic, idx) => (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-xs font-semibold hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all cursor-default shadow-sm hover:shadow-md">
                                  <div className="flex items-center justify-center bg-white/80 group-hover:bg-amber-500 group-hover:text-white rounded px-1 min-w-[16px] h-4 text-[9px] border border-amber-200/50 transition-colors">
                                    {topic.count}
                                  </div>
                                  {topic.name || topic.text}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-semibold text-[10px]">
                                  {topic.count} Student Mentions
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </TooltipProvider>
                      </div>

                      {stats.topicsLearned.length > learnedLimit && (
                        <div className="flex justify-center mt-2">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px] font-medium"
                            onClick={() =>
                              setLearnedLimit((v) =>
                                Math.min(
                                  v + loadMoreStep,
                                  stats.topicsLearned.length,
                                ),
                              )
                            }
                          >
                            Load{" "}
                            {Math.min(
                              loadMoreStep,
                              stats.topicsLearned.length - learnedLimit,
                            )}{" "}
                            more
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs italic">
                      No topics recorded yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="future" className="mt-0">
                <div className="max-h-[160px] overflow-y-auto pr-1">
                  {(stats.futureTopics || []).length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5 p-1">
                        {futureToShow.map((topic, idx) => {
                          const label = topic.text || topic.name || "";
                          return (
                            <div
                              key={idx}
                              className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all cursor-default shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center justify-center bg-white/80 group-hover:bg-blue-500 group-hover:text-white rounded px-1 min-w-[16px] h-4 text-[9px] border border-blue-200/50 transition-colors">
                                {topic.count}
                              </div>
                              <Sparkles className="h-3 w-3 opacity-70 group-hover:animate-pulse" />
                              {label}
                            </div>
                          );
                        })}
                      </div>

                      {stats.futureTopics.length > futureLimit && (
                        <div className="flex justify-center mt-2">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[11px] font-medium"
                            onClick={() =>
                              setFutureLimit((v) =>
                                Math.min(
                                  v + loadMoreStep,
                                  stats.futureTopics.length,
                                ),
                              )
                            }
                          >
                            Load{" "}
                            {Math.min(
                              loadMoreStep,
                              stats.futureTopics.length - futureLimit,
                            )}{" "}
                            more
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs italic">
                      No future topics suggested yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SessionAnalytics;
