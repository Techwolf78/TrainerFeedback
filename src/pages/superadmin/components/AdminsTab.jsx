import React, { useState, useEffect } from "react";
import {
  Users,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  Building,
  Loader2,
  MoreVertical,
  Eye,
  EyeOff,
  Search,
  School,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loader from "@/components/ui/Loader";
import {
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  updateAdminPassword,
} from "@/services/superadmin/userService";
import { changePassword } from "@/services/authService";

import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import { useAuth } from "@/contexts/AuthContext";

const AdminsTab = ({ colleges, onRefresh, isDialogOpen, setDialogOpen }) => {
  const { admins, loadAdmins, loading: contextLoading } = useSuperAdminData();
  const { user: currentUser } = useAuth();
  const loading = contextLoading.admins || contextLoading.colleges;
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const dialogOpen =
    isDialogOpen !== undefined ? isDialogOpen : localDialogOpen;
  const setDialog = setDialogOpen || setLocalDialogOpen;

  // Form State
  const defaultFormState = {
    name: "",
    email: "",
    role: "collegeAdmin", // Default
    collegeId: "",
    password: "", // Only for creation
    newPassword: "", // For password change when editing own account
    currentPassword: "", // Current password verification
  };
  const [formData, setFormData] = useState(defaultFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch users on mount using Context (uses cache)
  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const closeDialog = () => {
    setDialog(false);
    setIsEditing(false);
    setEditingId(null);
    setShowPasswordFields(false);
    setShowPassword(false);
    setShowNewPassword(false);
    setFormData(defaultFormState);
  };

  const openCreateDialog = () => {
    setFormData(defaultFormState);
    setIsEditing(false);
    setEditingId(null);
    setDialog(true);
  };

  const openEditDialog = (user) => {
    setFormData({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "collegeAdmin",
      collegeId: user.collegeId || "",
      password: "", // Don't show password
    });
    setIsEditing(true);
    setEditingId(user.id); // user.uid is typically the ID
    setDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.role) {
      toast.error("Please fill in required fields");
      return;
    }

    if (formData.role === "collegeAdmin" && !formData.collegeId) {
      toast.error("Please select a college for College Admin");
      return;
    }

    if (!isEditing && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    // Validate password fields if changing password
    if (showPasswordFields && !formData.newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        // Update user details
        const updates = {
          name: formData.name,
          role: formData.role,
          collegeId:
            formData.role === "collegeAdmin" ? formData.collegeId : null,
        };
        await updateSystemUser(editingId, updates);

        // If SuperAdmin is changing someone's password
        if (showPasswordFields && formData.newPassword && currentUser?.role === "superAdmin") {
          await updateAdminPassword(editingId, formData.newPassword);
          toast.success("User updated and password changed successfully");
        } else {
          toast.success("User updated successfully");
        }
      } else {
        // Create
        await createSystemUser(formData, formData.password);
        toast.success("User created successfully");
      }
      closeDialog();
      loadAdmins(true); // Force refresh context cache
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (
      confirm(
        "Are you sure you want to delete this user? Their access will be revoked immediately.",
      )
    ) {
      try {
        await deleteSystemUser(id);
        toast.success("User deleted");
        loadAdmins(true); // Sync with context cache
      } catch (error) {
        toast.error("Failed to delete user");
      }
    }
  };

  // Helper to get college name
  const getCollegeName = (id) => {
    if (!id) return "Unknown College";
    const college = colleges.find((c) => c.id === id);
    if (college) return college.name;

    // If still loading or not found, but we have a collegeId, return "Loading..." variant or "Not Found"
    // instead of defaulting immediately to "Unknown College" if it might just be a loading issue
    if (contextLoading.colleges) return "Loading...";

    return "Unknown College";
  };

  // Helper to format college dropdown labels with code/initials
  const getCollegeDisplayLabel = (college) => {
    if (!college) return "";
    const code = college.code?.trim();
    if (code) return `${code} - ${college.name}`;

    const initials = college.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return `${initials} - ${college.name}`;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredAdmins = admins.filter((admin) => {
    const searchLower = searchTerm.toLowerCase();
    const collegeName =
      admin.role === "superAdmin"
        ? "Gryphon Academy Pvt Ltd"
        : getCollegeName(admin.collegeId);

    const matchesSearch = (admin.name || "").toLowerCase().includes(searchLower) ||
      (admin.email || "").toLowerCase().includes(searchLower) ||
      collegeName.toLowerCase().includes(searchLower);

    const matchesRole = roleFilter === "all" || admin.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search admins or colleges..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 bg-background/50 backdrop-blur-sm border-muted-foreground/20 focus:border-primary/50 transition-all rounded-xl w-full"
          />
        </div>

        {/* Role Filters */}
        <div className="flex bg-muted/40 p-1 rounded-xl border border-border/50 backdrop-blur-sm self-start lg:self-auto">
          {[
            { id: "all", label: "All Users", icon: Users },
            { id: "superAdmin", label: "Super Admins", icon: ShieldCheck },
            { id: "collegeAdmin", label: "College Admins", icon: Building },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleFilter(role.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                roleFilter === role.id
                  ? "bg-white text-primary shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50"
              )}
            >
              <role.icon className={cn("h-4 w-4", roleFilter === role.id ? "text-primary" : "text-muted-foreground")} />
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg border border-border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex flex-col space-y-1.5 p-6 pb-4 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {isEditing ? "Edit User" : "Add New Admin"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditing
                  ? "Update user details"
                  : "Create a new system administrator or college admin"}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 pt-0 overflow-y-auto">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Full Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@example.com"
                    disabled={isEditing}
                  />
                </div>

                {isEditing && (
                  <div className="p-3 bg-muted/30 border rounded-lg space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                      Security
                    </Label>

                    {/* SuperAdmin Password Change Option */}
                    {currentUser?.role === "superAdmin" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="changePassword"
                            checked={showPasswordFields}
                            onChange={(e) => {
                              setShowPasswordFields(e.target.checked);
                              if (!e.target.checked) {
                                setFormData({...formData, newPassword: "", currentPassword: ""});
                              }
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <Label htmlFor="changePassword" className="text-sm font-medium cursor-pointer">
                            Change password directly
                          </Label>
                        </div>

                        {showPasswordFields && (
                          <div className="space-y-2 mt-2 pt-2 border-t border-muted">
                            <div>
                              <Label className="text-xs">New Password</Label>
                              <div className="relative">
                                <Input
                                  type={showNewPassword ? "text" : "password"}
                                  value={formData.newPassword}
                                  onChange={(e) =>
                                    setFormData({ ...formData, newPassword: e.target.value })
                                  }
                                  placeholder="Enter new password"
                                  className="text-sm pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {showNewPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!isEditing && (
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Enter password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(val) =>
                      setFormData({ ...formData, role: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superAdmin">Super Admin</SelectItem>
                      <SelectItem value="collegeAdmin">
                        College Admin
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role === "collegeAdmin" && (
                  <div className="space-y-2 animate-fade-in">
                    <Label>College</Label>
                    <Select
                      value={formData.collegeId}
                      onValueChange={(val) =>
                        setFormData({ ...formData, collegeId: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select College" />
                      </SelectTrigger>
                      <SelectContent>
                        {colleges.map((college) => (
                          <SelectItem key={college.id} value={college.id}>
                            {getCollegeDisplayLabel(college)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSubmitting}
                className="gradient-hero text-primary-foreground"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAdmins.map((user, index) => (
          <div
            key={user.id}
            className="group relative flex flex-col bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 animate-fade-up overflow-hidden"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="p-5 flex items-center gap-5">
              {/* Avatar */}
              <div
                className={`h-16 w-16 rounded-full flex-shrink-0 flex items-center justify-center border shadow-inner ${
                  user.role === "superAdmin"
                    ? "bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-100 text-purple-600"
                    : "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 text-blue-600"
                }`}
              >
                {user.role === "superAdmin" ? (
                  <ShieldCheck className="h-8 w-8" />
                ) : (
                  <Building className="h-8 w-8" />
                )}
              </div>

              {/* Details Column */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg text-foreground leading-none">
                    {user.name}
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground leading-none">
                  {user.email}
                </p>

                {/* Organization Tag */}
                <div className="pt-1">
                  {user.role === "superAdmin" ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Gryphon Academy Pvt Ltd
                    </span>
                  ) : (
                    user.collegeId && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                        <Building className="h-3.5 w-3.5 text-muted-foreground" />
                        {getCollegeName(user.collegeId)}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Action Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent -mr-2 -mt-2 self-start"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => openEditDialog(user)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit User
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={() => handleDelete(user.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {loading && (
          <div className="col-span-full flex justify-center py-12">
            <Loader fullScreen={false} />
          </div>
        )}

        {!loading && filteredAdmins.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {admins.length === 0 ? "No admins found" : "No matching admins found"}
            </h3>
            <p className="text-muted-foreground">
              {admins.length === 0 
                ? "Create your first system administrator."
                : `No results found for "${searchTerm}"`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminsTab;
