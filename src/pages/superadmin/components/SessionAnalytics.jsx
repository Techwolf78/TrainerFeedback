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
        { field: "Trainer", value: session.assignedTrainer?.name || "N/A" },
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
    <div className="space-y-6 p-2" ref={analyticsRef}>
  <div className="flex items-start justify-between">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{session.topic}</h1>
        {session.status === "active" && (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 animate-pulse flex items-center gap-1.5"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live
          </Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
        <span>{session.collegeName}</span>
        <span className="text-muted-foreground/50">•</span>
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3" />
          <span>{session.assignedTrainer?.name || "Trainer not assigned"}</span>
        </div>
        {session.domain && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              <span>{session.domain}</span>
            </div>
          </>
        )}
        
      </div>
    </div>

    <div className="flex items-center gap-2 snapshot-ignore">
      {session.status === "active" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLiveStats(true)}
          className="gap-2"
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh Live Data
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-4 w-4 mr-2" /> Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportSnapshot}
        className="gap-2"
      >
        <Camera className="h-4 w-4" /> Snapshot
      </Button>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
    </div>
  </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Responses
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalResponses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Student submissions
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Average Rating
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.avgRating.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i <= Math.round(stats.avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                out of 5.0
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Rating</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.topRating.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Highest score</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Content</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.categoryAverages?.content || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Content quality
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Knowledge</CardTitle>
            <User className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.categoryAverages?.knowledge || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Trainer expertise
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.categoryAverages?.engagement || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Student involvement
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Communication</CardTitle>
            <MessageSquare className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.categoryAverages?.communication || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Clarity & delivery
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delivery</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.categoryAverages?.delivery || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Presentation skills
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>
              Number of responses per rating level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDataAll}>
                  <defs>
                    <linearGradient
                      id="barGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={1}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.6}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    vertical={false}
                  />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <RechartsTooltip
                    cursor={false}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [value, "Responses"]}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#barGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>
              Average scores across evaluation categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="53%"
                    outerRadius="50%"
                    data={radarData}
                  >
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={(props) => {
                        const { payload, x, y, textAnchor, index } = props;
                        const categoryData = radarData[index];
                        if (categoryData) {
                          const isBottom = y > 128;
                          return (
                            <g>
                              <text
                                x={x}
                                y={isBottom ? y + 12 : y - 15}
                                textAnchor={textAnchor}
                                fill="hsl(var(--foreground))"
                                fontSize={10}
                                fontWeight="normal"
                              >
                                {payload.value}
                              </text>
                              <text
                                x={x}
                                y={isBottom ? y + 26 : y - 1}
                                textAnchor={textAnchor}
                                fill="hsl(var(--primary))"
                                fontSize={11}
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
                            fill="hsl(var(--foreground))"
                            fontSize={10}
                          >
                            {payload.value}
                          </text>
                        );
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 5]}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 9,
                      }}
                      tickCount={6}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.4}
                      strokeWidth={2}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [
                        parseFloat(value).toFixed(2),
                        "Score",
                      ]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No category data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rating Breakdown</CardTitle>
            <CardDescription>
              Percentage distribution of ratings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ratingDataFiltered}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {ratingDataFiltered.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`hsl(var(--primary) / ${0.4 + index * 0.15})`}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Student Comments
              </div>
              <Badge variant="secondary" className="font-mono">
                {stats.totalResponses} Total
              </Badge>
            </CardTitle>
            <CardDescription>
              Feedback from different rating levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="top" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="top">Top Comments</TabsTrigger>
                <TabsTrigger value="average">Average Comments</TabsTrigger>
                <TabsTrigger value="improvement">Improvement Areas</TabsTrigger>
              </TabsList>

              <TabsContent value="top" className="mt-4">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {(stats.topComments || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments available
                    </p>
                  ) : (
                    stats.topComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border bg-card/50 relative"
                      >
                        <div className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-sm italic pr-8">"{c.text}"</p>
                        <div className="flex items-center gap-1 mt-2">
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

              <TabsContent value="average" className="mt-4">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {(stats.avgComments || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments available
                    </p>
                  ) : (
                    stats.avgComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border bg-card/50 relative"
                      >
                        <div className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-sm italic pr-8">"{c.text}"</p>
                        <div className="flex items-center gap-1 mt-2">
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

              <TabsContent value="improvement" className="mt-4">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {(stats.leastRatedComments || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments available
                    </p>
                  ) : (
                    stats.leastRatedComments.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border bg-card/50 relative"
                      >
                        <div className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{i + 1}
                        </div>
                        <p className="text-sm italic pr-8">"{c.text}"</p>
                        <div className="flex items-center gap-1 mt-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Session Topics
            </CardTitle>
            <CardDescription>
              Topics learned and future suggestions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="learned" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="learned">Topics Learned</TabsTrigger>
                <TabsTrigger value="future">Future Topics</TabsTrigger>
              </TabsList>

              <TabsContent value="learned" className="mt-0">
                <div className="max-h-80 overflow-y-auto pr-1">
                  {(stats.topicsLearned || []).length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2 p-2">
                        <TooltipProvider>
                          {learnedToShow.map((topic, idx) => (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-sm font-semibold hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all cursor-default shadow-sm hover:shadow-md">
                                  <div className="flex items-center justify-center bg-white/80 group-hover:bg-amber-500 group-hover:text-white rounded px-1 min-w-[20px] h-5 text-[10px] border border-amber-200/50 transition-colors">
                                    {topic.count}
                                  </div>
                                  {topic.name || topic.text}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-semibold text-xs">
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
                    <div className="text-center py-8 text-muted-foreground text-sm italic">
                      No topics recorded yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="future" className="mt-0">
                <div className="max-h-80 overflow-y-auto pr-1">
                  {(stats.futureTopics || []).length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2 p-2">
                        {futureToShow.map((topic, idx) => {
                          const label = topic.text || topic.name || "";
                          return (
                            <div
                              key={idx}
                              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-sm font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all cursor-default shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center justify-center bg-white/80 group-hover:bg-blue-500 group-hover:text-white rounded px-1 min-w-[20px] h-5 text-[10px] border border-blue-200/50 transition-colors">
                                {topic.count}
                              </div>
                              <Sparkles className="h-3.5 w-3.5 opacity-70 group-hover:animate-pulse" />
                              {label}
                            </div>
                          );
                        })}
                      </div>

                      {stats.futureTopics.length > futureLimit && (
                        <div className="flex justify-center mt-2">
                          <Button
                            size="sm"
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
                    <div className="text-center py-8 text-muted-foreground text-sm italic">
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
