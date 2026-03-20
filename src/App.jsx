import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import { Landing } from "@/pages/Landing";
import Home from "@/pages/Home";
import { Login } from "@/pages/Login";
import { NewLogin } from "@/pages/NewLogin";
import { SuperAdminDashboard } from "@/pages/superadmin/SuperAdminDashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import SessionResponses from "@/pages/admin/SessionResponses";
import TrainerDashboard from "@/pages/trainer/TrainerDashboard";
import { AnonymousFeedback } from "@/pages/feedback/AnonymousFeedback";
import NotFound from "@/pages/NotFound";
import SeedData from "@/pages/SeedData";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/newLogin" element={<NewLogin />} />
                <Route
                  path="/feedback/anonymous/:sessionId"
                  element={<AnonymousFeedback />}
                />
                {import.meta.env.DEV && (
                  <Route path="/seed-data" element={<SeedData />} />
                )}

                {/* Super Admin Routes - has its own built-in layout */}
                <Route
                  path="/super-admin"
                  element={<Navigate to="/super-admin/dashboard" replace />}
                />
                <Route
                  path="/super-admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/colleges"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/admins"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/trainers"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/sessions"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/sessions/:sessionId/responses"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/templates"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/project-codes"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/academic-config"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/tickets"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/profile"
                  element={
                    <ProtectedRoute allowedRoles={["superAdmin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* College Admin Routes - has its own built-in layout */}
                <Route
                  path="/admin"
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["collegeAdmin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sessions"
                  element={
                    <ProtectedRoute allowedRoles={["collegeAdmin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/feedback"
                  element={
                    <ProtectedRoute allowedRoles={["collegeAdmin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sessions/:sessionId/responses"
                  element={
                    <ProtectedRoute allowedRoles={["collegeAdmin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/help"
                  element={
                    <ProtectedRoute allowedRoles={["collegeAdmin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/profile"
                  element={
                    <ProtectedRoute allowedRoles={["collegeAdmin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Trainer Routes - has its own built-in layout */}
                <Route
                  path="/trainer"
                  element={<Navigate to="/trainer/dashboard" replace />}
                />
                <Route
                  path="/trainer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["trainer"]}>
                      <TrainerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trainer/sessions"
                  element={
                    <ProtectedRoute allowedRoles={["trainer"]}>
                      <TrainerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trainer/feedback"
                  element={
                    <ProtectedRoute allowedRoles={["trainer"]}>
                      <TrainerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trainer/help"
                  element={
                    <ProtectedRoute allowedRoles={["trainer"]}>
                      <TrainerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trainer/profile"
                  element={
                    <ProtectedRoute allowedRoles={["trainer"]}>
                      <TrainerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
