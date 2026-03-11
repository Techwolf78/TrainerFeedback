import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ClipboardList,
  BarChart3,
  Lightbulb,
  Zap,
  LogIn,
  Users,
  Star,
  TrendingUp,
  MessageSquare,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  CheckCircle2,
  ListChecks,
  AlignLeft,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Smartphone,
  ChevronLeft,
  Wifi,
  Battery,
  Signal,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const Home = () => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const words = ["insight.", "action.", "improvement.", "excellence."];

  // Dummy Data for Analytics
  const stats = [
    {
      label: "Total Responses",
      value: "45",
      subtitle: "Total Student Responses",
      icon: ClipboardList,
      rating: null,
    },
    {
      label: "Average Rating",
      value: "4.71",
      subtitle: "out of 5.0",
      icon: Star,
      rating: 4.71,
    },
    {
      label: "Total Sessions",
      value: "3",
      subtitle: "Conducted Sessions",
      icon: Clock,
      rating: null,
    },
    {
      label: "Total Hours",
      value: "18",
      subtitle: "Training Hours Delivered",
      icon: Clock,
      rating: null,
    },
  ];

  const responseTrendData = [
    { name: "Jan", responses: 400, rate: 45 },
    { name: "Feb", responses: 300, rate: 52 },
    { name: "Mar", responses: 600, rate: 48 },
    { name: "Apr", responses: 800, rate: 61 },
    { name: "May", responses: 500, rate: 55 },
    { name: "Jun", responses: 900, rate: 67 },
    { name: "Jul", responses: 700, rate: 59 },
    { name: "Aug", responses: 1100, rate: 72 },
  ];

  const categoryData = [
    { category: "Technical Skills", score: 4.8 },
    { category: "Soft Skills", score: 4.5 },
    { category: "Course Content", score: 4.2 },
    { category: "Environment", score: 3.9 },
    { category: "Support", score: 4.6 },
  ];

  const distributionData = [
    { rating: "5 Stars", count: 4500 },
    { rating: "4 Stars", count: 3200 },
    { rating: "3 Stars", count: 800 },
    { rating: "2 Stars", count: 300 },
    { rating: "1 Star", count: 150 },
  ];

  const domainData = [
    { name: "Aptitude", avgRating: 4.1 },
    { name: "Technical", avgRating: 4.5 },
    { name: "Soft Skills", avgRating: 4.2 },
    { name: "Tools", avgRating: 3.9 },
  ];

  const npsData = [
    { name: "Promoters", value: 65, color: "#10b981" },
    { name: "Passives", value: 25, color: "#f59e0b" },
    { name: "Detractors", value: 10, color: "#ef4444" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, 2000); // Change word every 2 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-12 md:h-16 w-auto object-contain brightness-0 invert"
              />
            </div>

            <div>
              <Link to="/login">
                <Button className="bg-white text-primary hover:bg-white/90 px-8 py-2 font-medium">
                  Login <LogIn className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 w-full pt-40 pb-12 flex flex-col items-center">
        {/* Main Heading */}
        <h1 className="text-3xl md:text-5xl font-bold text-center tracking-tight max-w-5xl leading-tight text-slate-900 flex flex-wrap justify-center items-baseline gap-x-2 px-4">
          <span>Where student voice becomes</span>
          <span className="text-primary inline-grid transition-all duration-500 ease-in-out text-left overflow-hidden h-[1.1em] align-top">
            {words.map((word, index) => (
              <span
                key={word}
                className={`col-start-1 row-start-1 transition-all duration-500 ease-in-out flex items-center ${
                  index === currentWordIndex
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
              >
                {word}
              </span>
            ))}
          </span>
        </h1>

        {/* Description Paragraph */}
        <p className="mt-8 text-lg text-center text-slate-600 max-w-4xl leading-relaxed">
          Unlock the true potential of your training programs with a dynamic
          feedback designed to turn student voice into real impact. Seamlessly
          connecting students and trainers, it enables data-driven decisions,
          continuous growth, and a higher standard of educational excellence.
        </p>

        {/* Hero Section with Tabs Outside */}
        <div className="mt-20 w-[80%]">
          <Tabs defaultValue="insights" className="w-full">
            <div className="flex justify-center mb-10">
              <TabsList className="bg-slate-100/50 rounded-full p-1 h-auto flex gap-1 shadow-sm border border-slate-200 backdrop-blur-sm">
                <TabsTrigger
                  value="insights"
                  className="rounded-full px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md flex items-center gap-2 transition-all font-semibold text-sm"
                >
                  <ClipboardList className="w-4 h-4" />
                  Student Feedback
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="rounded-full px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md flex items-center gap-2 transition-all font-semibold text-sm"
                >
                  <BarChart3 className="w-4 h-4" />
                  Feedback Analysis
                </TabsTrigger>
                <TabsTrigger
                  value="voices"
                  className="rounded-full px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md flex items-center gap-2 transition-all font-semibold text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Student Voices
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="bg-white rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-[6px] border-white overflow-hidden w-full">
              <div className="bg-[#f0f2f5] rounded-sm min-h-[400px] relative overflow-hidden px-6 pb-6 pt-4">
                <TabsContent
                  value="insights"
                  className="mt-0 outline-none w-full h-full data-[state=inactive]:hidden"
                >
                  <div className="flex gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Left: Feedback Question Cards Grid */}
                    <div className="flex-1 [column-count:2] lg:[column-count:3] [column-gap:0.625rem] [&>*]:mb-2.5 [&>*]:break-inside-avoid">
                      {/* Star Rating */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            1. The trainer demonstrated in-depth knowledge of
                            the subject matter.{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <p className="text-[9px] text-primary/70 mb-2">
                            Rate from 1 (Poor) to 5 (Excellent)
                          </p>
                          <div className="flex gap-1">
                            {[1, 2, 3].map((s) => (
                              <Star
                                key={s}
                                className="w-5 h-5 fill-yellow-400 text-yellow-400"
                              />
                            ))}
                            {[4, 5].map((s) => (
                              <Star
                                key={s}
                                className="w-5 h-5 text-slate-300"
                              />
                            ))}
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[8px] text-slate-400">
                              Poor
                            </span>
                            <span className="text-[8px] text-slate-400">
                              Excellent
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Multiple Choice */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            2. How would you rate the pace of the session?{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <div className="space-y-1.5">
                            {[
                              "Too slow",
                              "Just right",
                              "Too fast",
                              "Varied throughout",
                            ].map((opt, i) => (
                              <label
                                key={i}
                                className={`flex items-center gap-2 text-[10px] text-slate-600 p-1.5 rounded border ${i === 1 ? "border-primary bg-primary/5" : "border-slate-100"}`}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${i === 1 ? "border-primary" : "border-slate-300"}`}
                                >
                                  {i === 1 && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  )}
                                </div>
                                {opt}
                              </label>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Yes/No */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            3. Would you recommend this trainer to others?{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <div className="flex gap-3 mt-2">
                            <div className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-green-200 bg-green-50 cursor-pointer">
                              <ThumbsUp className="w-5 h-5 text-green-500" />
                              <span className="text-[10px] font-medium text-green-700">
                                Yes
                              </span>
                            </div>
                            <div className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-slate-200 cursor-pointer">
                              <ThumbsDown className="w-5 h-5 text-slate-400" />
                              <span className="text-[10px] font-medium text-slate-500">
                                No
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Long Answer */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            4. What suggestions do you have for improving this
                            session?
                          </p>
                          <div className="border border-slate-200 rounded p-2 min-h-[60px] bg-slate-50">
                            <p className="text-[9px] text-slate-400 italic">
                              The examples and case studies were very helpful. I
                              would suggest adding more hands-on practice...
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Topics Learned */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            5. What topics did you learn?{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              "React Basics",
                              "State Mgmt",
                              "API Integration",
                              "Testing",
                              "Deployment",
                            ].map((tag, i) => (
                              <span
                                key={i}
                                className={`text-[9px] px-2 py-0.5 rounded-full border ${i < 3 ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-slate-50 border-slate-200 text-slate-500"}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Agree/Disagree */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            6. The session materials were well-organized.{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <div className="space-y-1.5">
                            {[
                              "Strongly Agree",
                              "Agree",
                              "Neutral",
                              "Disagree",
                              "Strongly Disagree",
                            ].map((opt, i) => (
                              <label
                                key={i}
                                className={`flex items-center gap-2 text-[10px] text-slate-600 p-1.5 rounded border ${i === 1 ? "border-primary bg-primary/5" : "border-slate-100"}`}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${i === 1 ? "border-primary" : "border-slate-300"}`}
                                >
                                  {i === 1 && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  )}
                                </div>
                                {opt}
                              </label>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Rating Scale */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            7. How engaging was the session content?{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <p className="text-[9px] text-primary/70 mb-2">
                            Rate from 1 (Poor) to 5 (Excellent)
                          </p>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((s) => (
                              <Star
                                key={s}
                                className="w-5 h-5 fill-yellow-400 text-yellow-400"
                              />
                            ))}
                            {[5].map((s) => (
                              <Star
                                key={s}
                                className="w-5 h-5 text-slate-300"
                              />
                            ))}
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[8px] text-slate-400">
                              Poor
                            </span>
                            <span className="text-[8px] text-slate-400">
                              Excellent
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dropdown Select */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            8. What is your department?{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <div className="border border-slate-200 rounded p-2 flex items-center justify-between bg-white">
                            <span className="text-[10px] text-slate-600">
                              Computer Science
                            </span>
                            <ChevronLeft className="w-3 h-3 text-slate-400 -rotate-90" />
                          </div>
                        </CardContent>
                      </Card>

                      {/* NPS / Number Scale */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            9. On a scale of 1-10, how likely are you to attend
                            future sessions?{" "}
                            <span className="text-red-500">*</span>
                          </p>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <div
                                key={n}
                                className={`flex-1 h-7 flex items-center justify-center rounded text-[9px] font-medium border ${n === 8 ? "bg-primary text-white border-primary" : "bg-slate-50 border-slate-200 text-slate-500"}`}
                              >
                                {n}
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[8px] text-slate-400">
                              Not likely
                            </span>
                            <span className="text-[8px] text-slate-400">
                              Very likely
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Short Answer */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            10. What topics would you like covered in future
                            sessions?
                          </p>
                          <div className="border border-slate-200 rounded p-2 bg-slate-50">
                            <p className="text-[9px] text-slate-400 italic">
                              Advanced React patterns, system design...
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Long Answer 2 */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            11. What was the most valuable takeaway from this
                            session?
                          </p>
                          <div className="border border-slate-200 rounded p-2 min-h-[140px] bg-slate-50">
                            <p className="text-[9px] text-slate-400 italic">
                              The practical demonstrations and live coding
                              examples helped me understand the concepts much
                              better. The step-by-step approach made complex
                              topics accessible and easy to follow. I especially
                              liked the real-world project examples...
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Would attend again - Yes/No */}
                      <Card className="bg-white rounded-sm border border-slate-200 shadow-none hover:shadow-md transition-all overflow-hidden">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-slate-700 mb-3">
                            12. Would you attend a session by this trainer
                            again? <span className="text-red-500">*</span>
                          </p>
                          <div className="flex gap-3 mt-2">
                            <div className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-green-200 bg-green-50 cursor-pointer">
                              <ThumbsUp className="w-5 h-5 text-green-500" />
                              <span className="text-[10px] font-medium text-green-700">
                                Yes
                              </span>
                            </div>
                            <div className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-slate-200 cursor-pointer">
                              <ThumbsDown className="w-5 h-5 text-slate-400" />
                              <span className="text-[10px] font-medium text-slate-500">
                                No
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right: Mobile Phone Mockup */}
                    <div className="hidden lg:flex flex-col items-center">
                      <div className="w-[280px] relative">
                        {/* Phone Frame */}
                        <div className="bg-slate-800 rounded-[32px] p-2.5 shadow-2xl">
                          {/* Status Bar */}
                          <div className="bg-white rounded-t-[24px] px-5 pt-3 pb-0">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[9px] font-semibold text-slate-800">
                                9:41
                              </span>
                              <div className="flex gap-1 items-center">
                                <Signal className="w-3 h-3 text-slate-800" />
                                <Wifi className="w-3 h-3 text-slate-800" />
                                <Battery className="w-3.5 h-3 text-slate-800" />
                              </div>
                            </div>
                            {/* Nav */}
                            <div className="flex items-center gap-2 pb-2">
                              <ChevronLeft className="w-5 h-5 text-slate-600" />
                              <div className="flex-1 text-center">
                                <div className="bg-primary rounded-sm px-3 py-2 flex items-center justify-center">
                                  <img
                                    src="/logo.png"
                                    alt="Logo"
                                    className="h-6 w-auto object-contain brightness-0 invert"
                                  />
                                </div>
                              </div>
                              <div className="w-5" />
                            </div>
                          </div>
                          {/* Form Content */}
                          <div className="bg-white px-4 pb-5 rounded-b-[24px] max-h-[480px] overflow-hidden">
                            <div className="space-y-3 mt-3">
                              {/* Q1 - Star Rating */}
                              <div className="border border-slate-200 rounded-lg p-3.5">
                                <p className="text-[10px] font-semibold text-slate-700 mb-2">
                                  1. The trainer demonstrated in-depth knowledge
                                  of the subject matter.{" "}
                                  <span className="text-red-500">*</span>
                                </p>
                                <p className="text-[8px] text-primary/60 mb-2">
                                  Rate from 1 (Poor) to 5 (Excellent)
                                </p>
                                <div className="flex gap-2 justify-center">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className="w-6 h-6 text-slate-300"
                                    />
                                  ))}
                                </div>
                              </div>
                              {/* Q2 - Star Rating */}
                              <div className="border border-slate-200 rounded-lg p-3.5">
                                <p className="text-[10px] font-semibold text-slate-700 mb-2">
                                  2. The trainer encouraged questions and
                                  provided clear answers.{" "}
                                  <span className="text-red-500">*</span>
                                </p>
                                <p className="text-[8px] text-primary/60 mb-2">
                                  Rate from 1 (Poor) to 5 (Excellent)
                                </p>
                                <div className="flex gap-2 justify-center">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className="w-6 h-6 text-slate-300"
                                    />
                                  ))}
                                </div>
                              </div>
                              {/* Q3 - Star Rating */}
                              <div className="border border-slate-200 rounded-lg p-3.5">
                                <p className="text-[10px] font-semibold text-slate-700 mb-2">
                                  3. The trainer created an inclusive and
                                  respectful learning environment.{" "}
                                  <span className="text-red-500">*</span>
                                </p>
                                <p className="text-[8px] text-primary/60 mb-2">
                                  Rate from 1 (Poor) to 5 (Excellent)
                                </p>
                                <div className="flex gap-2 justify-center">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className="w-6 h-6 text-slate-300"
                                    />
                                  ))}
                                </div>
                              </div>
                              {/* Q4 - Star Rating */}
                              <div className="border border-slate-200 rounded-lg p-3.5">
                                <p className="text-[10px] font-semibold text-slate-700 mb-2">
                                  4. The trainer effectively integrated theory
                                  with practice.{" "}
                                  <span className="text-red-500">*</span>
                                </p>
                                <p className="text-[8px] text-primary/60 mb-2">
                                  Rate from 1 (Poor) to 5 (Excellent)
                                </p>
                                <div className="flex gap-2 justify-center">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className="w-6 h-6 text-slate-300"
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent
                  value="analytics"
                  className="mt-0 outline-none w-full h-full data-[state=inactive]:hidden"
                >
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* TOP ROW: Stats (left) | Response Trend (right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: 2x2 Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {stats.map((stat, i) => (
                          <Card
                            key={i}
                            className="border border-slate-200 shadow-none overflow-hidden bg-white group hover:shadow-sm transition-all rounded-sm"
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-xs font-medium text-slate-500">
                                  {stat.label}
                                </p>
                                <stat.icon className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <h4 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                                {stat.value}
                              </h4>
                              <div className="mt-1">
                                {stat.rating ? (
                                  <div className="flex items-center gap-1">
                                    <div className="flex">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`w-3 h-3 ${
                                            star <= Math.round(stat.rating)
                                              ? "fill-yellow-400 text-yellow-400"
                                              : "text-slate-300"
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      {stat.subtitle}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400">
                                    {stat.subtitle}
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Right: Response Trend */}
                      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm">
                        <CardHeader className="py-2 px-4 border-b border-slate-50">
                          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Response Trend
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-400">
                            Monthly Responses
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={responseTrendData}>
                                <defs>
                                  <linearGradient
                                    id="colorRes"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="hsl(var(--primary))"
                                      stopOpacity={0.15}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="hsl(var(--primary))"
                                      stopOpacity={0.01}
                                    />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                  className="stroke-muted"
                                />
                                <XAxis
                                  dataKey="name"
                                  className="text-[10px]"
                                  tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                  className="text-[10px]"
                                  tick={{ fontSize: 10 }}
                                  allowDecimals={false}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                  }}
                                  formatter={(value) => [value, "Responses"]}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="responses"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={3}
                                  dot={{ fill: "hsl(var(--primary))", r: 3 }}
                                  activeDot={{ r: 5 }}
                                  fillOpacity={1}
                                  fill="url(#colorRes)"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* BOTTOM ROW: Category Breakdown | Domain Performance | Rating Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Category Breakdown Radar */}
                      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm">
                        <CardHeader className="py-2 px-4 border-b border-slate-50">
                          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Category Breakdown
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-400">
                            Score by Category (0-5)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart
                                cx="50%"
                                cy="53%"
                                outerRadius="50%"
                                data={categoryData}
                              >
                                <defs>
                                  <linearGradient
                                    id="radarGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="0%"
                                      stopColor="hsl(var(--primary))"
                                      stopOpacity={0.6}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor="hsl(var(--primary))"
                                      stopOpacity={0.2}
                                    />
                                  </linearGradient>
                                </defs>
                                <PolarGrid
                                  stroke="hsl(var(--primary))"
                                  opacity={0.1}
                                />
                                <PolarAngleAxis
                                  dataKey="category"
                                  tick={(props) => {
                                    const { payload, x, y, textAnchor, index } =
                                      props;
                                    const item = categoryData[index];
                                    if (item) {
                                      const isTop = y < 115;
                                      const isBottom = y > 145;
                                      const isRight = textAnchor === "start";
                                      const isLeft = textAnchor === "end";
                                      let dy = 0;
                                      if (isTop) dy = -30;
                                      else if (isBottom) dy = 20;
                                      let dx = 0;
                                      if (isRight) dx = 10;
                                      if (isLeft) dx = -10;
                                      return (
                                        <g>
                                          <text
                                            x={x + dx}
                                            y={y + dy}
                                            textAnchor={textAnchor}
                                            fill="hsl(var(--foreground))"
                                            fontSize={9}
                                            fontWeight="600"
                                          >
                                            {payload.value}
                                          </text>
                                          <text
                                            x={x + dx}
                                            y={y + dy + 12}
                                            textAnchor={textAnchor}
                                            fill="hsl(var(--primary))"
                                            fontSize={10}
                                            fontWeight="800"
                                          >
                                            {item.score.toFixed(1)}
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
                                        fontSize={9}
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
                                    fontSize: 8,
                                  }}
                                  tickCount={6}
                                />
                                <Radar
                                  name="Score"
                                  dataKey="score"
                                  stroke="hsl(var(--primary))"
                                  fill="url(#radarGradient)"
                                  fillOpacity={1}
                                  strokeWidth={2}
                                  dot={{
                                    fill: "hsl(var(--primary))",
                                    r: 3,
                                    fillOpacity: 1,
                                  }}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                  }}
                                  formatter={(value) => [
                                    parseFloat(value).toFixed(2),
                                    "Score",
                                  ]}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Domain Performance */}
                      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm">
                        <CardHeader className="py-2 px-4 border-b border-slate-50">
                          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Domain Performance
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-400">
                            Avg Rating (0-5)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={domainData}>
                                <defs>
                                  <linearGradient
                                    id="domainBarGradient"
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
                                <XAxis
                                  dataKey="name"
                                  className="text-[10px]"
                                  tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                  domain={[0, 5]}
                                  tickCount={6}
                                  className="text-[10px]"
                                  tick={{ fontSize: 10 }}
                                />
                                <RechartsTooltip
                                  cursor={false}
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                  }}
                                  formatter={(value) => [
                                    value.toFixed(2),
                                    "Avg Rating",
                                  ]}
                                />
                                <Bar
                                  dataKey="avgRating"
                                  fill="url(#domainBarGradient)"
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Rating Distribution */}
                      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm">
                        <CardHeader className="py-2 px-4 border-b border-slate-50">
                          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Rating Distribution
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-400">
                            Responses by Star Rating
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={distributionData}>
                                <defs>
                                  <linearGradient
                                    id="ratingBarGradient"
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
                                <XAxis
                                  dataKey="rating"
                                  className="text-[10px]"
                                  tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  className="text-[10px]"
                                  tick={{ fontSize: 10 }}
                                />
                                <RechartsTooltip
                                  cursor={false}
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                  }}
                                  formatter={(value) => [value, "Responses"]}
                                />
                                <Bar
                                  dataKey="count"
                                  fill="url(#ratingBarGradient)"
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent
                  value="voices"
                  className="mt-0 outline-none w-full h-full data-[state=inactive]:hidden"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Col 1: Praise */}
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm h-full">
                      <CardHeader className="py-3 px-4 border-b border-slate-50 bg-green-50/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                            <ThumbsUp className="w-3 h-3 text-green-600" />
                          </div>
                          <CardTitle className="text-xs font-bold text-green-800 uppercase tracking-wider">
                            Praise
                          </CardTitle>
                        </div>
                        <CardDescription className="text-[10px] text-green-600/70">
                          What students appreciated
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {[
                          {
                            text: "The trainer explained complex concepts in a very simple and understandable way.",
                            author: "Student #12",
                            rating: 5,
                          },
                          {
                            text: "Excellent real-world examples that made the theory come alive.",
                            author: "Student #7",
                            rating: 5,
                          },
                          {
                            text: "Very patient and always willing to repeat explanations when needed.",
                            author: "Student #23",
                            rating: 4,
                          },
                          {
                            text: "The hands-on exercises were incredibly helpful for understanding.",
                            author: "Student #5",
                            rating: 5,
                          },
                          {
                            text: "Great energy and passion for the subject matter.",
                            author: "Student #31",
                            rating: 4,
                          },
                        ].map((item, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded border border-green-100 bg-green-50/30 hover:bg-green-50/60 transition-colors"
                          >
                            <p className="text-[10px] text-slate-700 leading-relaxed">
                              "{item.text}"
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[9px] text-slate-400">
                                {item.author}
                              </span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-2.5 h-2.5 ${s <= item.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Col 2: Concerns */}
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm h-full">
                      <CardHeader className="py-3 px-4 border-b border-slate-50 bg-amber-50/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <ThumbsDown className="w-3 h-3 text-amber-600" />
                          </div>
                          <CardTitle className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                            Concerns
                          </CardTitle>
                        </div>
                        <CardDescription className="text-[10px] text-amber-600/70">
                          Areas needing improvement
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {[
                          {
                            text: "The session pace was a bit too fast for beginners to keep up with.",
                            author: "Student #9",
                            rating: 3,
                          },
                          {
                            text: "Would have liked more time for Q&A at the end of each module.",
                            author: "Student #15",
                            rating: 3,
                          },
                          {
                            text: "Some slides had too much text and were hard to follow quickly.",
                            author: "Student #21",
                            rating: 2,
                          },
                          {
                            text: "The audio quality during online sessions could be improved.",
                            author: "Student #18",
                            rating: 3,
                          },
                          {
                            text: "Need more practical coding exercises rather than just theory.",
                            author: "Student #33",
                            rating: 3,
                          },
                        ].map((item, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded border border-amber-100 bg-amber-50/30 hover:bg-amber-50/60 transition-colors"
                          >
                            <p className="text-[10px] text-slate-700 leading-relaxed">
                              "{item.text}"
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[9px] text-slate-400">
                                {item.author}
                              </span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-2.5 h-2.5 ${s <= item.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Col 3: Two rows */}
                    <div className="flex flex-col gap-4 h-full">
                      {/* Topics Learned */}
                      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm flex-1">
                        <CardHeader className="py-3 px-4 border-b border-slate-50 bg-blue-50/50">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                              <BookOpen className="w-3 h-3 text-blue-600" />
                            </div>
                            <CardTitle className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Topics Learned
                            </CardTitle>
                          </div>
                          <CardDescription className="text-[10px] text-blue-600/70">
                            What students picked up
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "React Hooks", count: 18 },
                              { label: "State Management", count: 15 },
                              { label: "REST APIs", count: 14 },
                              { label: "Component Design", count: 12 },
                              { label: "Testing", count: 10 },
                              { label: "TypeScript", count: 9 },
                              { label: "Git Workflow", count: 8 },
                              { label: "CSS Flexbox", count: 7 },
                              { label: "Debugging", count: 6 },
                            ].map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 font-medium"
                              >
                                {tag.label}
                                <span className="text-[8px] bg-blue-200/50 text-blue-800 px-1 rounded-full">
                                  {tag.count}
                                </span>
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Future Topics */}
                      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-sm flex-1">
                        <CardHeader className="py-3 px-4 border-b border-slate-50 bg-purple-50/50">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                              <Lightbulb className="w-3 h-3 text-purple-600" />
                            </div>
                            <CardTitle className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                              Future Topics
                            </CardTitle>
                          </div>
                          <CardDescription className="text-[10px] text-purple-600/70">
                            What students want next
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "Advanced React", count: 22 },
                              { label: "System Design", count: 19 },
                              { label: "Cloud Deploy", count: 16 },
                              { label: "Docker/K8s", count: 14 },
                              { label: "GraphQL", count: 11 },
                              { label: "CI/CD Pipelines", count: 10 },
                              { label: "Microservices", count: 9 },
                              { label: "Security", count: 7 },
                              { label: "AI/ML Basics", count: 5 },
                            ].map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-purple-50 border border-purple-200/60 text-purple-700 font-medium"
                              >
                                {tag.label}
                                <span className="text-[8px] bg-purple-200/50 text-purple-800 px-1 rounded-full">
                                  {tag.count}
                                </span>
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Home;
