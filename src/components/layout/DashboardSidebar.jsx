import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  RefreshCw,
  Building2,
  Users,
  FileQuestion,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
  UserCheck,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

// SuperAdmin navigation links
const superAdminLinks = [
  { to: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/super-admin/colleges', icon: Building2, label: 'Colleges' },
  { to: '/super-admin/admins', icon: Users, label: 'Admins' },
  { to: '/super-admin/sessions', icon: RefreshCw, label: 'Sessions' },
  { to: '/super-admin/academic-config', icon: BookOpen, label: 'Academic Config' },
  { to: '/super-admin/analytics', icon: BarChart3, label: 'Analytics' },
];

// CollegeAdmin navigation links
const collegeAdminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/sessions', icon: RefreshCw, label: 'Sessions' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
];

// Trainer navigation links
const trainerLinks = [
  { to: '/trainer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trainer/sessions', icon: RefreshCw, label: 'My Sessions' },
  { to: '/trainer/feedback', icon: ClipboardList, label: 'Feedback' },
];

export const DashboardSidebar = ({
  isCollapsed: externalIsCollapsed,
  onToggleCollapse
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = onToggleCollapse || setInternalIsCollapsed;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getLinks = () => {
    switch (user?.role) {
      case 'superAdmin':
        return superAdminLinks;
      case 'collegeAdmin':
        return collegeAdminLinks;
      case 'trainer':
        return trainerLinks;
      default:
        return [];
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'superAdmin':
        return Building2;
      case 'collegeAdmin':
        return GraduationCap;
      case 'trainer':
        return UserCheck;
      default:
        return Users;
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'superAdmin':
        return 'Super Admin';
      case 'collegeAdmin':
        return 'College Admin';
      case 'trainer':
        return 'Trainer';
      default:
        return 'User';
    }
  };

  const links = getLinks();
  const RoleIcon = getRoleIcon();

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen max-h-screen overflow-hidden gradient-hero transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-56"
    )}>
      <div className="flex h-full min-h-full flex-col">
        {/* Logo and Toggle */}
        {isCollapsed ? (
          <div className="flex flex-col items-center px-4 py-5 border-b border-sidebar-border gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
              <GraduationCap className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors duration-200"
              title="Expand Sidebar"
            >
              <ChevronRight className="h-4 w-4 text-sidebar-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
                <GraduationCap className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-lg font-semibold text-sidebar-foreground">
                  Gryphon
                </h1>
                <p className="text-xs text-sidebar-foreground/70">Feedback System</p>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors duration-200"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4 text-sidebar-foreground" />
            </button>
          </div>
        )}

        {/* User Info */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent overflow-hidden">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <RoleIcon className="h-5 w-5 text-sidebar-accent-foreground" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-sidebar-foreground/70">{getRoleLabel()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isCollapsed ? "justify-center px-2" : "",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
              title={isCollapsed ? link.label : undefined}
            >
              <link.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200",
              isCollapsed ? "justify-center px-2" : "w-full"
            )}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
