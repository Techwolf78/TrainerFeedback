import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/services/firebase";
import { getSessionsByTrainer, subscribeToSessions } from "@/services/superadmin/sessionService";
import {
  getCollegeById,
  getAllColleges,
} from "@/services/superadmin/collegeService";
import { getAllProjectCodes } from "@/services/superadmin/projectCodeService"; // [NEW] Import service
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalClose,
} from "@/components/ui/modal";
import SessionWizard from "@/components/shared/SessionWizard";
import { toast } from "sonner";
import {
  LayoutDashboard,
  RefreshCw,
  LogOut,
  GraduationCap,
  Plus,
  Download,
  HelpCircle,
  User,
  Menu,
  X,
  ChevronDown,
  Pencil,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import TrainerOverview from "./components/TrainerOverview";
import TrainerSessions from "./components/TrainerSessions";
import HelpTab from "@/components/shared/HelpTab";
import ProfilePage from "@/components/shared/ProfilePage";
import Loader from "@/components/ui/Loader";

const TrainerDashboard = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]); // [NEW] Project codes state
  const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null); // Track session being edited
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get current section from URL
  const currentSection = location.pathname.split("/").pop() || "dashboard";
  const getActiveTab = (section) => {
    switch (section) {
      case "dashboard":
        return "overview";
      case "sessions":
        return "sessions";
      case "help":
        return "help";
      case "profile":
        return "profile";
      default:
        return "overview";
    }
  };
  const activeTab = getActiveTab(currentSection);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Real-time updates for Trainer
  useEffect(() => {
    const trainerId = user?.uid || user?.id;
    if (!trainerId) return;

    const unsubscribe = subscribeToSessions((allSessions) => {
      const mySessions = allSessions.filter(s => s.trainerIds?.includes(trainerId) || s.assignedTrainer?.id === trainerId);
      setSessions(mySessions);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.id]);

  const loadData = async () => {
    // Skip if no authenticated user (prevents post-logout errors)
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
      if (user) {
        // 1. Load College(s)
        if (user.collegeId) {
          // Trainer has assigned college - load just that one
          try {
            const colData = await getCollegeById(user.collegeId);
            if (colData) setColleges([colData]);
          } catch (e) {
            console.error("College load failed", e);
          }
        } else {
          // No assigned college - load all colleges for selection
          try {
            const allColleges = await getAllColleges();
            setColleges(allColleges || []);
          } catch (e) {
            console.error("Failed to load colleges", e);
          }
        }

        // 2. Load Sessions (Real-time subscription handles this, but we can do a one-shot fetch for initial load if needed)
        // However, the useEffect with subscribeToSessions already handles the primary data flow.
        const trainerId = user.uid || user.id;
        
        // 3. Load Project Codes
        // Trainers need project codes for filtering and session creation
        try {
          const codes = await getAllProjectCodes();
          setProjectCodes(codes || []);
        } catch (e) {
          console.error("Failed to load project codes", e);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSessionSaved = () => {
    setIsSessionFormOpen(false);
    setEditingSession(null);
    loadData(); // Refresh list to show changes
  };

  const handleCreateClick = () => {
    setEditingSession(null);
    setIsSessionFormOpen(true);
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
    setIsSessionFormOpen(true);
  };

  // Check access
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Please Login
          </h1>
          <Button onClick={() => navigate("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (user.role !== "trainer" && user.role !== "superAdmin") {
    // Allow superAdmin for testing
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 text-destructive mx-auto mb-4" />
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

  if (isLoading && !sessions.length && !colleges.length) {
    return <Loader />;
  }

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

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown as overlay when menu open */}
      <aside
        className={`bg-primary text-primary-foreground border-r border-primary/80 flex flex-col transition-all duration-300 ease-in-out h-screen z-50
          ${isSidebarCollapsed ? "w-20" : "w-64"}
          fixed lg:relative
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Mobile Close Button */}
        <button
          className="lg:hidden absolute top-3 right-3 text-primary-foreground/80 hover:text-primary-foreground z-10"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>

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

        {/* Trainer Profile Section */}
        <div
          className={`py-6 border-b border-primary-foreground/10 ${isSidebarCollapsed ? "px-2" : "px-4"}`}
        >
          {!isSidebarCollapsed ? (
            <div
              className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all flex items-center gap-3 group relative overflow-hidden"
              onClick={() => {
                navigate("/trainer/profile");
                setIsMobileMenuOpen(false);
              }}
              title="Go to Profile"
            >
              <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0 overflow-hidden relative">
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-pink-600 font-bold text-sm">
                    {user?.name?.charAt(0).toUpperCase() || "T"}
                  </span>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                  {user?.name}
                </p>
                <p className="text-[11px] font-medium text-slate-500 truncate">
                  Trainer
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />
            </div>
          ) : (
            <div
              className="h-12 w-12 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-all overflow-hidden mx-auto relative"
              onClick={() => {
                navigate("/trainer/profile");
                setIsMobileMenuOpen(false);
              }}
              title={user?.name}
            >
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user?.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-pink-600 font-bold">
                  {user?.name?.charAt(0).toUpperCase() || "T"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 mt-2">
          <NavItem
            id="overview"
            label="Dashboard"
            icon={LayoutDashboard}
            path="/trainer/dashboard"
          />
          <NavItem
            id="sessions"
            label="Sessions"
            icon={RefreshCw}
            path="/trainer/sessions"
          />
          <NavItem
            id="help"
            label="Help & Support"
            icon={HelpCircle}
            path="/trainer/help"
          />
        </nav>

        {/* Sign Out at Bottom */}
        <div
          className={`p-3 border-t border-primary-foreground/20 ${isSidebarCollapsed ? "flex justify-center" : ""}`}
        >
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
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
              </TooltipTrigger>
              {isSidebarCollapsed && (
                <TooltipContent side="right" className="font-medium">
                  Sign Out
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      {/* Main Content Area with Navbar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-auto min-h-[3.5rem] md:h-28 flex-shrink-0 border-b bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between z-20 shadow-sm px-4 md:px-6 py-3 md:py-0 gap-2 sm:gap-0">
          {/* Left: Hamburger + Page Title */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                {activeTab === "overview" && "Trainer Dashboard"}
                {activeTab === "sessions" && "My Sessions"}
                {activeTab === "help" && "Help & Support"}
                {activeTab === "profile" && "My Profile"}
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                {activeTab === "overview" &&
                  "Manage your sessions and view feedback"}
                {activeTab === "sessions" &&
                  "View and manage your training sessions"}
                {activeTab === "help" && "Report issues or request features"}
                {activeTab === "profile" && "Update your profile and password"}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="default"
              onClick={loadData}
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-muted/5 p-3 md:p-6 scroll-smooth">
          <div
            className={`mx-auto transition-all duration-300 ${isSidebarCollapsed ? "px-0 lg:px-6" : "px-0"}`}
          >
            {/* Session Form Modal (Shared for Create/Edit) - HIDDEN
            <Modal open={isSessionFormOpen} onOpenChange={setIsSessionFormOpen} className="sm:max-w-[600px]">
                <ModalClose onClose={() => {
                    setIsSessionFormOpen(false);
                    setEditingSession(null);
                }} />
                <div className="p-6 max-h-[90vh] overflow-y-auto">
                    <ModalHeader className="mb-4">
                        <ModalTitle>{editingSession ? 'Edit Session' : 'Create New Session'}</ModalTitle>
                        <ModalDescription>
                            {editingSession ? 'Update the details of your session below.' : 'Fill in the details below to create a new session.'}
                        </ModalDescription>
                    </ModalHeader>
                    <SessionWizard
                        session={editingSession}
                        colleges={colleges}
                        defaultCollegeId={user.collegeId || null}
                        trainers={user ? [{ id: user.uid || user.id, name: user.name }] : []}
                        defaultDomain={user.domain || ''}
                        defaultTrainerId={user?.uid || user?.id}
                        currentUserId={user?.uid || user?.id}
                        currentUserName={user.name}
                        onSuccess={handleSessionSaved}
                        onCancel={() => {
                            setIsSessionFormOpen(false);
                            setEditingSession(null);
                        }}
                    />
                </div>
            </Modal>

            {/* Content Tabs */}
            {activeTab === "overview" && (
              <TrainerOverview sessions={sessions} isLoading={isLoading} />
            )}

            {activeTab === "sessions" && (
              <div className="space-y-6 animate-in fade-in-50 duration-500">
                <TrainerSessions
                  sessions={sessions}
                  loading={isLoading}
                  onEdit={handleEditSession}
                  onRefresh={loadData}
                  projectCodes={projectCodes}
                />
              </div>
            )}

            {activeTab === "help" && <HelpTab />}

            {activeTab === "profile" && <ProfilePage />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TrainerDashboard;
