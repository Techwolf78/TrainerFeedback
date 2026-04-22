import React, { useState, useRef, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { useAuth } from "@/contexts/AuthContext";
import {
  SuperAdminDataProvider,
  useSuperAdminData,
} from "@/contexts/SuperAdminDataContext";
import { usersApi, academicConfigApi, analyticsApi } from "@/lib/dataService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Building2,
  Shield,
  LogOut,
  GraduationCap,
  UserPlus,
  RefreshCw,
  BookOpen,
  Users,
  FileText,
  LayoutDashboard,
  Barcode,
  Ticket,
  User,
  Plus,
  Download,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Import Tab Components
import OverviewTab from "./components/OverviewTab";
import CollegesTab from "./components/CollegesTab";
import AdminsTab from "./components/AdminsTab";
import SessionsTab from "./components/SessionsTab";
import AcademicConfigTab from "./components/AcademicConfigTab";
import TrainersTab from "./components/TrainersTab";
import TemplatesTab from "./components/TemplatesTab";
import ProjectCodesTab from "./components/ProjectCodesTab";
import TicketsTab from "./components/TicketsTab";
import SessionResponses from "../admin/SessionResponses";
import ProfilePage from "@/components/shared/ProfilePage";
import Loader from "@/components/ui/Loader";

// Inner dashboard component that consumes context
const SuperAdminDashboardInner = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Dialog and action states for navbar buttons
  const [isCollegeDialogOpen, setIsCollegeDialogOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isProjectCodeImportOpen, setIsProjectCodeImportOpen] = useState(false);

  const dashboardRef = useRef(null);

  // Get data from context
  const {
    colleges,
    admins,
    trainers,
    sessions,
    templates,
    projectCodes, // [NEW] Get project codes
    isInitialLoading,
    refreshAll,
  } = useSuperAdminData();

  // Export screenshot handler
  const handleExport = useCallback(async () => {
    const toastId = toast.loading("Generating snapshot...");
    try {
      const el = dashboardRef.current;
      if (!el) {
        toast.error("Dashboard content not found", { id: toastId });
        return;
      }

      // Small delay for chart rendering
      await new Promise((resolve) => setTimeout(resolve, 400));

      const dataUrl = await toPng(el, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2, // 2x is usually enough and faster
        cacheBust: true,
        style: {
          fontFamily: "Inter, sans-serif",
        },
        filter: (node) => {
          if (
            node.classList &&
            (node.classList.contains("print:hidden") ||
              node.classList.contains("snapshot-ignore"))
          ) {
            return false;
          }
          return true;
        },
      });

      const link = document.createElement("a");
      link.download = `TrainerFeedBack-${new Date().toLocaleDateString().replace(/\//g, "-")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Snapshot saved", { id: toastId });
    } catch (err) {
      console.error("Export failed:", err);
      toast.error(
        "Export failed. Check internet connection or CORS settings.",
        { id: toastId },
      );
    }
  }, []);

  // Legacy data from mock/local storage (academicConfig, globalStats)
  const academicConfig = academicConfigApi.getActive() || {};
  const stats = analyticsApi.getGlobalStats();
  const globalStats = { ...stats, totalColleges: colleges.length };

  // Get active tab from URL
  const currentSection = location.pathname.split("/").pop() || "dashboard";
  const getActiveTab = (section) => {
    switch (section) {
      case "dashboard":
        return "overview";
      case "colleges":
        return "colleges";
      case "admins":
        return "admins";
      case "trainers":
        return "trainers";
      case "sessions":
        return "sessions";
      case "templates":
        return "templates";
      case "project-codes":
        return "project-codes";
      case "tickets":
        return "tickets";
      case "academic-config":
        return "config";
      case "analytics":
        return "analytics";
      case "profile":
        return "profile";
      default:
        // Check if we are in a sub-view (analytics) within colleges/trainers
        // We handle this by making the snapshot button always visible for these base tabs
        return section;
    }
  };
  const activeTab = getActiveTab(currentSection);

  // Determine if snapshot is allowed (including sub-views)
  const isSnapshotAllowed =
    activeTab === "overview" ||
    activeTab === "colleges" ||
    activeTab === "trainers" ||
    activeTab === "analytics";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleMouseEnter = () => {
    setIsSidebarCollapsed(false);
  };

  const handleMouseLeave = () => {
    setIsSidebarCollapsed(true);
  };

  // If viewing session responses
  if (sessionId) {
    return <SessionResponses />;
  }

  if (!user || user.role !== "superAdmin") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return <Loader />;
  }

  // NavItem component for consistent navigation
  const NavItem = ({ id, label, icon: Icon, path }) => {
    const isActive = activeTab === id;
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-8 mb-0.5 text-xs transition-all",
                isSidebarCollapsed ? "px-1 justify-center" : "px-2 gap-2",
                isActive
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
              onClick={() => navigate(path)}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "")} />
              {!isSidebarCollapsed && <span className="text-sm font-medium">{label}</span>}
            </Button>
          </TooltipTrigger>
          {isSidebarCollapsed && (
            <TooltipContent side="right" className="font-semibold bg-slate-900 border-slate-800">
              {label}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Get page title based on active tab
  const getPageTitle = () => {
    switch (activeTab) {
      case "overview":
        return "Dashboard Overview";
      case "colleges":
        return "Colleges Management";
      case "config":
        return "Academic Configuration";
      case "admins":
        return "Admins Management";
      case "trainers":
        return "Trainers Management";
      case "sessions":
        return "Sessions Management";
      case "templates":
        return "Templates Management";
      case "project-codes":
        return "Project Codes";
      case "tickets":
        return "Support Tickets";
      case "profile":
        return "My Profile";
      default:
        return "Super Admin Dashboard";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] font-sans">
      {/* Full-Height Sidebar */}
      <aside
        className={cn(
          "bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out h-full z-30 border-r border-slate-800 shadow-xl flex-shrink-0",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo Section */}
        <div className={cn("h-24 flex items-center justify-center transition-all", isSidebarCollapsed ? "px-2" : "px-6")}>
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3 w-full group cursor-pointer" onClick={() => navigate("/super-admin/dashboard")}>
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white tracking-tight leading-none text-lg">TRNR<span className="text-blue-500">FEED</span></span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Super Admin</span>
              </div>
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 hover:scale-105 transition-transform cursor-pointer" onClick={() => navigate("/super-admin/dashboard")}>
               <GraduationCap className="h-6 w-6 text-white" />
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-3 space-y-0.5 custom-scrollbar", isSidebarCollapsed ? "px-2" : "px-3")}>
          <div className="space-y-1">
            {!isSidebarCollapsed && <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Main</p>}
            <NavItem id="overview" label="Dashboard" icon={LayoutDashboard} path="/super-admin/dashboard" />
          </div>

          <div className="pt-6 space-y-1">
            {!isSidebarCollapsed && <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Network</p>}
            <NavItem id="colleges" label="Colleges" icon={Building2} path="/super-admin/colleges" />
            <NavItem id="admins" label="Admins" icon={Shield} path="/super-admin/admins" />
            <NavItem id="trainers" label="Trainers" icon={Users} path="/super-admin/trainers" />
          </div>

          <div className="pt-6 space-y-1">
            {!isSidebarCollapsed && <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Education</p>}
            <NavItem id="sessions" label="Sessions" icon={FileText} path="/super-admin/sessions" />
            <NavItem id="templates" label="Templates" icon={BookOpen} path="/super-admin/templates" />
            <NavItem id="project-codes" label="Project Codes" icon={Barcode} path="/super-admin/project-codes" />
          </div>

          <div className="pt-6 space-y-1">
            {!isSidebarCollapsed && <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Operations</p>}
            <NavItem id="config" label="Configuration" icon={RefreshCw} path="/super-admin/academic-config" />
            <NavItem id="tickets" label="Support" icon={Ticket} path="/super-admin/tickets" />

          </div>
        </nav>

        {/* Sidebar Footer / User Section */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          {!isSidebarCollapsed ? (
             <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 mb-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                   <User className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex flex-col min-w-0">
                   <p className="text-xs font-bold text-white truncate">{user?.name || "Administrator"}</p>
                   <p className="text-[10px] text-slate-500 font-medium">Active Session</p>
                </div>
             </div>
          ) : (
            <div className="flex justify-center mb-3">
               <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                  <User className="h-4 w-4 text-slate-400" />
               </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            className={cn(
              "w-full text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all",
              isSidebarCollapsed ? "px-0 justify-center" : "justify-start gap-3 px-3"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!isSidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main View Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Global Nav Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="h-10 w-px bg-slate-100 hidden lg:block" />
             <div className="flex flex-col">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                  {getPageTitle()}
                </h2>
                <div className="flex items-center gap-2">
                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Live Monitoring</p>
                </div>
             </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Action Buttons based on context */}
            {activeTab === "admins" && (
              <Button
                variant="default"
                size="sm"
                className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all px-4"
                onClick={() => setIsAdminDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Admin
              </Button>
            )}
            {activeTab === "sessions" && (
              <Button
                variant="default"
                size="sm"
                className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all px-4"
                onClick={() => setIsSessionDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Session
              </Button>
            )}

            {/* Global Snapshot Button */}
            {isSnapshotAllowed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-9 gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 font-medium transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Export Snapshot</span>
              </Button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 scroll-smooth custom-scrollbar">
          <div
            ref={dashboardRef}
            className="mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            {activeTab === "overview" && (
              <OverviewTab
                colleges={colleges}
                admins={admins}
                sessions={sessions}
                projectCodes={projectCodes} // [NEW] Pass project codes
              />
            )}

            {activeTab === "colleges" && (
              <CollegesTab
                colleges={colleges}
                admins={admins}
                onRefresh={refreshAll}
                isDialogOpen={isCollegeDialogOpen}
                setDialogOpen={setIsCollegeDialogOpen}
              />
            )}

            {activeTab === "config" && (
              <AcademicConfigTab colleges={colleges} />
            )}

            {activeTab === "admins" && (
              <AdminsTab
                colleges={colleges}
                onRefresh={refreshAll}
                isDialogOpen={isAdminDialogOpen}
                setDialogOpen={setIsAdminDialogOpen}
              />
            )}

            {activeTab === "trainers" && <TrainersTab />}

            {activeTab === "sessions" && (
              <SessionsTab
                sessions={sessions}
                colleges={colleges}
                trainers={trainers}
                academicConfig={academicConfig}
                onRefresh={refreshAll}
                isDialogOpen={isSessionDialogOpen}
                setDialogOpen={setIsSessionDialogOpen}
              />
            )}

            {activeTab === "templates" && <TemplatesTab />}

            {activeTab === "project-codes" && <ProjectCodesTab />}

            {activeTab === "tickets" && <TicketsTab />}

            {activeTab === "profile" && <ProfilePage />}
          </div>
        </main>
      </div>
    </div>
  );
};

// Wrapper component that provides the context
export const SuperAdminDashboard = () => {
  return (
    <SuperAdminDataProvider>
      <SuperAdminDashboardInner />
    </SuperAdminDataProvider>
  );
};
