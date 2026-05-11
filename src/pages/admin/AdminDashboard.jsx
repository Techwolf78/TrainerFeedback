import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Joyride, { STATUS } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  LogOut,
  GraduationCap,
  BarChart3,
  Calendar,
  LayoutDashboard,
  RefreshCw,
  Menu,
  Database,
  HelpCircle,
  User,
  ChevronDown,
  Pencil,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminDataProvider, useAdminData } from "@/contexts/AdminDataContext";
import CollegeOverviewTab from "./components/CollegeOverviewTab";
import TrainerFeedbackTab from "./components/TrainerFeedbackTab";
import CollegeSessionsTab from "./components/CollegeSessionsTab";
import HelpTab from "@/components/shared/HelpTab";
import ProfilePage from "@/components/shared/ProfilePage";
import Loader from "@/components/ui/Loader";

// Inner component to consume context
const AdminDashboardContent = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { college, loading } = useAdminData();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  // Joyride tour steps
  const tourSteps = [
    {
      target: "[data-tour='profile']",
      content:
        "Welcome! This is your profile card. Click it to go to the Profile page where you can update your display name, upload a profile photo, and change your password.",
      placement: "right",
      disableBeacon: true,
    },
    {
      target: "[data-tour='nav-overview']",
      content:
        "This is the Dashboard tab — your home base. Let's explore what's inside.",
      placement: "right",
    },
    // --- CollegeOverviewTab steps (shown right after Dashboard sidebar item) ---
    {
      target: "[data-tour='overview-filters']",
      content:
        "Use these filters to narrow down your data. Filter by Course, Year, Department, Batch, Trainer, or Date Range. Hit Reset to clear all filters, or Refresh to fetch the latest data.",
      placement: "bottom",
    },
    {
      target: "[data-tour='overview-stats']",
      content:
        "These are your key metrics at a glance — Total Responses received, Average Rating (out of 5), Total Sessions conducted, and Total Training Hours delivered. They update automatically based on your active filters.",
      placement: "bottom",
    },
    {
      target: "[data-tour='overview-charts']",
      content:
        "Visual analytics: Domain Performance shows average ratings per training domain. Category Breakdown is a radar chart of scores across categories like Communication, Knowledge, and Engagement. Rating Distribution displays how many responses fell into each star rating.",
      placement: "top-start",
    },
    {
      target: "[data-tour='overview-trends']",
      content:
        "Response Trend tracks daily response counts for the current month. Student Voices shows actual feedback comments categorized into Praise, Concerns, Lessons Learned, and Future Suggestions — giving you direct insight into student sentiment.",
      placement: "bottom",
    },
    // --- Back to sidebar: Sessions ---
    {
      target: "[data-tour='nav-sessions']",
      content: "This is the Feedback Sessions tab — let's see what's inside.",
      placement: "right",
    },
    // --- CollegeSessionsTab steps ---
    {
      target: "[data-tour='sessions-filters']",
      content:
        "Filter sessions by Course, Year, Department, Batch, or Trainer. Hit Reset to clear all filters and the search bar.",
      placement: "bottom",
    },
    {
      target: "[data-tour='sessions-tabs']",
      content:
        "Toggle between All Sessions, Active Sessions (currently collecting responses), and Inactive Sessions (completed or closed). The count for each is shown in the tab.",
      placement: "bottom",
    },
    {
      target: "[data-tour='sessions-table']",
      content:
        "This table lists all feedback sessions with Topic, Course/Batch, Trainer, Schedule date, and Status. Click the analytics icon to view detailed response data for any session, or the share icon to copy the anonymous feedback link.",
      placement: "top",
    },
    // --- Back to sidebar: Help ---
    {
      target: "[data-tour='nav-help']",
      content: "This is the Help & Support tab — let's explore it.",
      placement: "right",
    },
    // --- HelpTab steps ---
    {
      target: "[data-tour='help-tickets']",
      content:
        "Here you can view all your submitted tickets and their statuses (Open, In Progress, Resolved, Closed). Click 'Create Ticket' to raise a new bug report, complaint, feature request, or general inquiry. You'll also see admin responses right on each ticket.",
      placement: "bottom",
    },
    // --- Final sidebar items ---
    {
      target: "[data-tour='tour-btn']",
      content:
        "You can replay this guided tour any time by clicking this button. It will walk you through all the features again.",
      placement: "top",
    },
    {
      target: "[data-tour='logout']",
      content:
        "When you're done, click Sign Out to securely log out of your account.",
      placement: "top",
    },
  ];

  const tourFinishedRef = React.useRef(false);

  // Helper: stop the tour completely
  const stopTour = () => {
    tourFinishedRef.current = true;
    setRunTour(false);
    setTourStepIndex(0);
    localStorage.setItem("adminTourCompleted", "true");
  };

  // Helper: check if target is a sidebar / always-visible element
  const isSidebarTarget = (target) =>
    target.includes("nav-") ||
    target.includes("profile") ||
    target.includes("tour-btn") ||
    target.includes("logout");

  const handleJoyrideCallback = (data) => {
    const { status, action, index, type } = data;

    // Handle finish / skip / close
    if (
      [STATUS.FINISHED, STATUS.SKIPPED].includes(status) ||
      action === "close"
    ) {
      stopTour();
      return;
    }

    if (type === "step:after") {
      const nextIndex = index + (action === "prev" ? -1 : 1);

      // Out of bounds → end
      if (nextIndex < 0 || nextIndex >= tourSteps.length) {
        stopTour();
        return;
      }

      const nextTarget = tourSteps[nextIndex]?.target || "";

      // Navigate to the correct route for the next step
      if (
        nextTarget.includes("overview-") ||
        nextTarget.includes("nav-overview")
      ) {
        navigate("/admin/dashboard");
      } else if (
        nextTarget.includes("sessions-") ||
        nextTarget.includes("nav-sessions")
      ) {
        navigate("/admin/sessions");
      } else if (
        nextTarget.includes("help-") ||
        nextTarget.includes("nav-help")
      ) {
        navigate("/admin/help");
      }

      const mainContent = document.querySelector("main");

      if (isSidebarTarget(nextTarget)) {
        // Sidebar items are always visible — scroll main to top & advance
        if (mainContent) mainContent.scrollTo({ top: 0 });
        setTourStepIndex(nextIndex);
      } else {
        // Content steps: pause → wait for render → scroll to center → resume
        tourFinishedRef.current = false;
        setRunTour(false);
        setTourStepIndex(nextIndex);

        setTimeout(() => {
          const targetEl = document.querySelector(tourSteps[nextIndex]?.target);
          if (targetEl) {
            const elHeight = targetEl.getBoundingClientRect().height;
            const viewportHeight = window.innerHeight;
            // Tall elements (>40% of viewport): scroll to start so tooltip fits below
            // Normal elements: center them for best visibility
            targetEl.scrollIntoView({
              behavior: "smooth",
              block: elHeight > viewportHeight * 0.4 ? "start" : "center",
            });
          }
          // Resume tour after scroll animation settles
          setTimeout(() => {
            if (!tourFinishedRef.current) {
              setRunTour(true);
            }
          }, 600);
        }, 300);
      }
    }
  };

  // Auto-start tour for first-time users
  useEffect(() => {
    if (
      !loading.initial &&
      user &&
      !localStorage.getItem("adminTourCompleted")
    ) {
      // Scroll to top before starting
      const mainContent = document.querySelector("main");
      if (mainContent) mainContent.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
      const timer = setTimeout(() => setRunTour(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading.initial, user]);

  // Get current section from URL
  const currentSection = location.pathname.split("/").pop() || "dashboard";
  // Map routes to tab names
  const getActiveTab = (path) => {
    if (path === "dashboard") return "overview";
    if (path === "sessions") return "sessions";
    if (path === "feedback") return "feedback";
    if (path === "help") return "help";
    if (path === "profile") return "profile";
    return "overview";
  };
  const activeTab = getActiveTab(currentSection);

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

  const NavItem = ({ id, label, icon: Icon, path }) => {
    const isActive = activeTab === id;
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full justify-start h-10 mb-1 ${
                isSidebarCollapsed ? "px-2 justify-center" : "px-3 gap-3"
              } ${
                isActive
                  ? "bg-primary-foreground text-primary hover:bg-primary-foreground hover:text-primary"
                  : "text-primary-foreground hover:bg-primary/80"
              }`}
              onClick={() => navigate(path)}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!isSidebarCollapsed && <span>{label}</span>}
            </Button>
          </TooltipTrigger>
          {isSidebarCollapsed && (
            <TooltipContent side="right" className="font-medium">
              {label}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Loading state
  if (loading.initial) {
    return <Loader />;
  }

  // Check access
  if (!user || (user.role !== "collegeAdmin" && user.role !== "superAdmin")) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <Button onClick={handleLogout} variant="outline">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Check if college admin has a collegeId assigned
  if (user.role === "collegeAdmin" && !user.collegeId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md">
          <GraduationCap className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            No College Assigned
          </h1>
          <p className="text-muted-foreground mb-4">
            Your account does not have a college assigned. Please contact the
            Super Admin to link your account to a college.
          </p>
          <Button onClick={handleLogout} variant="outline">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <Joyride
        steps={tourSteps}
        run={runTour}
        stepIndex={tourStepIndex}
        continuous
        showProgress
        showSkipButton
        disableScrolling
        disableScrollParentFix
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: "hsl(222.2, 47.4%, 11.2%)",
            zIndex: 10000,
            overlayColor: "rgba(0, 0, 0, 0.5)",
          },
          beacon: {
            inner: "#ef4444",
            outer: "#ef4444",
          },
          beaconInner: {
            backgroundColor: "#ef4444",
          },
          beaconOuter: {
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderColor: "#ef4444",
          },
          tooltip: {
            borderRadius: 12,
            padding: 20,
          },
          buttonNext: {
            borderRadius: 8,
            padding: "8px 16px",
          },
          buttonBack: {
            borderRadius: 8,
            marginRight: 8,
            color: "#ef4444",
          },
          buttonSkip: {
            borderRadius: 8,
          },
        }}
        locale={{
          back: "Back",
          close: "Got it",
          last: "Finish",
          next: "Next",
          skip: "Skip Tour",
        }}
      />
      {/* Full-Height Sidebar */}
      <aside
        className={`bg-primary text-primary-foreground border-r border-primary/80 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out h-screen ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo Section at Top - Full Width */}
        <div
          className={`h-28 border-b border-primary-foreground/20 flex items-center justify-center ${isSidebarCollapsed ? "px-2" : "px-3"}`}
        >
          {!isSidebarCollapsed ? (
            <img
              src="/logo.png"
              alt="Logo"
              className="h-20 w-full object-contain"
              onError={(e) => (e.target.style.display = "none")}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-white p-1 shadow-md overflow-hidden flex items-center justify-center">
              <img
                src="/shortlogo.png"
                alt="Logo"
                className="h-full w-full object-contain"
                onError={(e) => (e.target.style.display = "none")}
              />
            </div>
          )}
        </div>

        {/* Admin Profile Section */}
        <div
          data-tour="profile"
          className={`py-6 border-b border-primary-foreground/10 ${isSidebarCollapsed ? "px-2" : "px-4"}`}
        >
          {!isSidebarCollapsed ? (
            <div
              className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all flex items-center gap-3 group relative overflow-hidden"
              onClick={() => navigate("/admin/profile")}
            >
              <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0 overflow-hidden relative">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-pink-600 font-bold text-sm">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                  {user.name}
                </p>
                <p className="text-[11px] font-medium text-slate-500 truncate uppercase tracking-wider">
                  {college?.code || "College Admin"}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />
            </div>
          ) : (
            <div
              className="h-12 w-12 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-all overflow-hidden mx-auto relative"
              onClick={() => navigate("/admin/profile")}
              title={user.name}
            >
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-pink-600 font-bold">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 mt-2">
          <div data-tour="nav-overview">
            <NavItem
              id="overview"
              label="Dashboard"
              icon={LayoutDashboard}
              path="/admin/dashboard"
            />
          </div>
          <div data-tour="nav-sessions">
            <NavItem
              id="sessions"
              label="Feedback Sessions"
              icon={Calendar}
              path="/admin/sessions"
            />
          </div>
          <div data-tour="nav-help">
            <NavItem
              id="help"
              label="Help & Support"
              icon={HelpCircle}
              path="/admin/help"
            />
          </div>
        </nav>

        {/* Tour + Sign Out at Bottom */}
        <div
          className={`p-3 border-t border-primary-foreground/20 flex flex-col gap-1 ${isSidebarCollapsed ? "items-center" : ""}`}
        >
          <Button
            data-tour="tour-btn"
            variant="ghost"
            className={`text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground ${
              isSidebarCollapsed
                ? "h-10 w-10 p-0"
                : "w-full justify-start gap-3"
            }`}
            onClick={() => {
              // Full reset: stop everything, go to dashboard, scroll up, restart
              tourFinishedRef.current = false;
              setRunTour(false);
              setTourStepIndex(0);
              navigate("/admin/dashboard");
              const mainContent = document.querySelector("main");
              if (mainContent) mainContent.scrollTo({ top: 0 });
              window.scrollTo({ top: 0 });
              // Use two-phase delay: let navigation + scroll settle, then start
              setTimeout(() => {
                setTourStepIndex(0);
                setTimeout(() => setRunTour(true), 100);
              }, 500);
            }}
          >
            <PlayCircle className="h-4 w-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Take a Tour</span>}
          </Button>
          <Button
            data-tour="logout"
            variant="ghost"
            className={`text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground ${
              isSidebarCollapsed
                ? "h-10 w-10 p-0"
                : "w-full justify-start gap-3"
            }`}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Area with Navbar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-28 flex-shrink-0 border-b bg-white flex items-center justify-between z-20 shadow-sm px-6">
          {/* Left: Page Title */}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "sessions" && "Session Management"}
              {activeTab === "feedback" && "Trainer Feedback"}
              {activeTab === "help" && "Help & Support"}
              {activeTab === "profile" && "My Profile"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {college?.name || ""}
            </p>
          </div>

          {/* Right: College Logo */}
          <div className="h-full flex items-center">
            {college && college.logoUrl && (
              <img
                src={college.logoUrl}
                alt={college.name}
                className="h-full w-auto object-contain py-3"
              />
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-muted/5 p-2 scroll-smooth">
          <div
            className={` mx-auto transition-all duration-300 ${isSidebarCollapsed ? "px-6" : "px-0"}`}
          >
            {activeTab === "overview" && <CollegeOverviewTab />}
            {activeTab === "feedback" && <TrainerFeedbackTab />}
            {activeTab === "sessions" && <CollegeSessionsTab />}
            {activeTab === "help" && <HelpTab />}
            {activeTab === "profile" && <ProfilePage />}
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  return (
    <AdminDataProvider>
      <AdminDashboardContent />
    </AdminDataProvider>
  );
};

export default AdminDashboard;
