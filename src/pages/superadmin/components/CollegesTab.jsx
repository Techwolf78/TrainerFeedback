import React, { useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  GraduationCap,
  BarChart3,
  MoreVertical,
  Upload,
  Loader2,
  ListPlus,
  Search,
  X,
} from "lucide-react";
import { uploadImage } from "@/services/cloudinaryService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import { toast } from "sonner";
import {
  addCollege,
  updateCollege,
  deleteCollege,
  bulkAddColleges,
} from "@/services/superadmin/collegeService";
import CollegeAnalytics from "./CollegeAnalytics";

const CollegesTab = ({
  colleges,
  admins,
  onRefresh,
  isDialogOpen,
  setDialogOpen,
}) => {
  // Use local state if props not provided (for backward compatibility)
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const collegeDialogOpen =
    isDialogOpen !== undefined ? isDialogOpen : localDialogOpen;
  const setCollegeDialogOpen = setDialogOpen || setLocalDialogOpen;

  // Form states
  const [newCollege, setNewCollege] = useState({
    name: "",
    code: "",
    logoUrl: "",
  });
  const [isEditingCollege, setIsEditingCollege] = useState(false);
  const [editingCollegeId, setEditingCollegeId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Bulk add states
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null); // { count, entries } after file parsed
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Analytics view state
  const [selectedCollegeForAnalytics, setSelectedCollegeForAnalytics] =
    useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredColleges = normalizedSearch
    ? colleges.filter((college) => {
        const name = college.name?.toLowerCase() || "";
        const code = college.code?.toLowerCase() || "";
        return (
          name.includes(normalizedSearch) || code.includes(normalizedSearch)
        );
      })
    : colleges;

  const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const highlightMatch = (text) => {
    if (!normalizedSearch || !text) return text;
    const regex = new RegExp(`(${escapeRegExp(normalizedSearch)})`, "gi");
    const parts = String(text).split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="rounded bg-yellow-100 px-1 text-foreground">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  // Handlers
  const closeCollegeDialog = () => {
    setCollegeDialogOpen(false);
    setIsEditingCollege(false);
    setEditingCollegeId(null);
    setNewCollege({ name: "", code: "", logoUrl: "" });
  };

  const openCreateCollegeDialog = () => {
    setNewCollege({ name: "", code: "", logoUrl: "" });
    setIsEditingCollege(false);
    setEditingCollegeId(null);
    setCollegeDialogOpen(true);
  };

  const openEditCollegeDialog = (college) => {
    setNewCollege({
      name: college.name,
      code: college.code,
      logoUrl: college.logoUrl || "",
    });
    setIsEditingCollege(true);
    setEditingCollegeId(college.id);
    setCollegeDialogOpen(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      toast.error("File size should be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      setNewCollege((prev) => ({ ...prev, logoUrl: url }));
      toast.success("Logo uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateOrUpdateCollege = async () => {
    if (!newCollege.name.trim() || !newCollege.code.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      if (isEditingCollege) {
        await updateCollege(editingCollegeId, {
          name: newCollege.name.trim(),
          code: newCollege.code.trim().toUpperCase(),
          logoUrl: newCollege.logoUrl.trim(),
        });
        toast.success("College updated successfully");
      } else {
        await addCollege({
          name: newCollege.name.trim(),
          code: newCollege.code.trim().toUpperCase(),
          logoUrl: newCollege.logoUrl.trim(),
        });
        toast.success("College created successfully");
      }
      setCollegeDialogOpen(false);
      setNewCollege({ name: "", code: "", logoUrl: "" });
      onRefresh(); // Trigger reload in parent
    } catch (error) {
      toast.error(error.message || "Failed to save college");
    }
  };

  const handleDeleteCollege = async (id) => {
    if (confirm("Are you sure you want to delete this college?")) {
      try {
        await deleteCollege(id);
        toast.success("College deleted");
        onRefresh();
      } catch (error) {
        toast.error("Failed to delete college");
      }
    }
  };

  const handleBulkFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Please upload a .json file");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const sanitized = evt.target.result.trim().replace(/,\s*]/g, "]");
        const parsed = JSON.parse(sanitized);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          toast.error("JSON file must contain a non-empty array.");
          return;
        }
        setBulkFile(parsed);
        setBulkPreview({
          count: parsed.length,
          entries: parsed.slice(0, 5), // show first 5 as preview
        });
      } catch {
        toast.error("Invalid JSON in file. Please check the format.");
      }
    };
    reader.readAsText(file);
  };

  const handleBulkAdd = async () => {
    if (!bulkFile || bulkFile.length === 0) {
      toast.error("Please upload a JSON file first");
      return;
    }

    setIsBulkAdding(true);
    try {
      const result = await bulkAddColleges(bulkFile);
      const messages = [];
      if (result.added > 0) messages.push(`${result.added} added`);
      if (result.skipped > 0) messages.push(`${result.skipped} skipped`);
      toast.success(`Bulk add complete: ${messages.join(", ")}`);

      if (result.errors.length > 0) {
        toast.warning(result.errors.slice(0, 5).join("\n"), { duration: 8000 });
      }

      setBulkDialogOpen(false);
      setBulkFile(null);
      setBulkPreview(null);
      onRefresh();
    } catch (error) {
      toast.error(error.message || "Bulk add failed");
    } finally {
      setIsBulkAdding(false);
    }
  };

  const closeBulkDialog = () => {
    setBulkDialogOpen(false);
    setBulkFile(null);
    setBulkPreview(null);
  };

  // If a college is selected for analytics, show analytics view
  if (selectedCollegeForAnalytics) {
    return (
      <CollegeAnalytics
        collegeId={selectedCollegeForAnalytics.id}
        collegeName={selectedCollegeForAnalytics.name}
        collegeLogo={selectedCollegeForAnalytics.logoUrl}
        filters={{}} // No course/batch filters in this view
        onBack={() => setSelectedCollegeForAnalytics(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Colleges</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {searchQuery
              ? `${filteredColleges.length} of ${colleges.length}`
              : `${colleges.length} Total`}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search colleges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2.5 h-6 w-6 rounded-full bg-muted/30 hover:bg-muted/50 flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                closeBulkDialog();
                setBulkDialogOpen(true);
              }}
              variant="outline"
              className="shadow hover:shadow-md transition-all duration-300"
            >
              <ListPlus className="mr-2 h-4 w-4" /> Bulk Add
            </Button>
            <Button
              onClick={openCreateCollegeDialog}
              className="gradient-hero text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="mr-2 h-4 w-4" /> Add College
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={collegeDialogOpen}
        onOpenChange={setCollegeDialogOpen}
        className="p-5"
      >
        <ModalContent>
          <ModalClose onClose={closeCollegeDialog} />
          <ModalHeader>
            <ModalTitle>
              {isEditingCollege ? "Edit College" : "Create New College"}
            </ModalTitle>
            <ModalDescription>
              {isEditingCollege
                ? "Update college details"
                : "Add a new college to the platform"}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>College Name</Label>
              <Input
                value={newCollege.name}
                onChange={(e) =>
                  setNewCollege({ ...newCollege, name: e.target.value })
                }
                placeholder="e.g., Gryphon Institute of Technology"
              />
            </div>
            <div className="space-y-2">
              <Label>College Code</Label>
              <Input
                value={newCollege.code}
                onChange={(e) =>
                  setNewCollege({
                    ...newCollege,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., GIT"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg border border-border/50 flex items-center justify-center bg-muted/20 overflow-hidden relative group">
                  {newCollege.logoUrl ? (
                    <img
                      src={newCollege.logoUrl}
                      alt="Preview"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground opacity-50" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  <div className="text-xs text-muted-foreground">
                    Or stick with URL:
                    <Input
                      value={newCollege.logoUrl}
                      onChange={(e) =>
                        setNewCollege({
                          ...newCollege,
                          logoUrl: e.target.value,
                        })
                      }
                      placeholder="https://..."
                      className="h-7 mt-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={closeCollegeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrUpdateCollege}
              className="gradient-hero text-primary-foreground"
            >
              {isEditingCollege ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        className="p-5"
      >
        <ModalContent className="max-w-2xl">
          <ModalClose onClose={closeBulkDialog} />
          <ModalHeader>
            <ModalTitle>Bulk Add Colleges</ModalTitle>
            <ModalDescription>
              Upload a <strong>.json</strong> file containing an array of
              colleges with <strong>"Name"</strong> and{" "}
              <strong>"College Code"</strong> fields.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Expected JSON format:
              </p>
              <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{`[\n  { "Name": "College Name", "College Code": "CODE" },\n  { "Name": "Another College", "College Code": "AC" }\n]`}</pre>
            </div>

            <div className="space-y-2">
              <Label>Select JSON File</Label>
              <Input
                type="file"
                accept=".json"
                onChange={handleBulkFileChange}
                className="cursor-pointer"
              />
            </div>

            {bulkPreview && (
              <div className="rounded-lg border border-border/50 p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  📄 {bulkPreview.count} college(s) found in file
                </p>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-1 px-2 text-muted-foreground font-medium">
                          #
                        </th>
                        <th className="text-left py-1 px-2 text-muted-foreground font-medium">
                          Name
                        </th>
                        <th className="text-left py-1 px-2 text-muted-foreground font-medium">
                          Code
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.entries.map((entry, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-1 px-2 text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="py-1 px-2">
                            {entry.Name || entry.name || "—"}
                          </td>
                          <td className="py-1 px-2 font-mono">
                            {entry["College Code"] || entry.code || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkPreview.count > 5 && (
                    <p className="text-xs text-muted-foreground mt-1 px-2">
                      ...and {bulkPreview.count - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={closeBulkDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAdd}
              disabled={isBulkAdding || !bulkFile}
              className="gradient-hero text-primary-foreground"
            >
              {isBulkAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <ListPlus className="mr-2 h-4 w-4" /> Add All
                </>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredColleges.map((college, index) => (
          <div
            key={college.id}
            className="glass-card rounded-xl p-5 animate-fade-up relative group flex flex-col gap-4"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between">
              {/* Logo Section - Wider container for better visibility, removed grey bg */}
              <div className="h-20 w-auto rounded-lg border border-border/50 flex items-center justify-center bg-white p-1 overflow-hidden">
                {college.logoUrl ? (
                  <img
                    src={college.logoUrl}
                    alt={college.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <GraduationCap className="h-8 w-8 text-primary/50" />
                )}
              </div>

              {/* Action Menu - Replaces individual buttons */}
              <div className="-mr-2 -mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setSelectedCollegeForAnalytics(college)}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" /> View Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openEditCollegeDialog(college)}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit College
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => handleDeleteCollege(college.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete College
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="space-y-1">
              <h3
                className="font-semibold text-lg text-foreground leading-tight line-clamp-2"
                title={college.name}
              >
                {highlightMatch(college.name)}
              </h3>
              <p className="text-sm font-medium text-muted-foreground">
                Code: <span className="text-foreground/80">{highlightMatch(college.code)}</span>
              </p>
            </div>

            <div className="pt-2 mt-auto border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {admins.filter((a) => a.collegeId === college.id).length} admin(s)
              </span>
              <span className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </span>
            </div>
          </div>
        ))}

        {filteredColleges.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {searchQuery ? "No colleges match your search" : "No colleges yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery ? (
                <>
                  Try an exact name or code, or use fewer characters for a broader
                  match.
                </>
              ) : (
                "Create your first college to get started"
              )}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollegesTab;
