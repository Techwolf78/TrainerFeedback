import React, { useState } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Upload,
  User,
  Loader2,
  BarChart3,
  Search,
  MoreVertical,
  RotateCcw,
  ShieldBan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { toast } from "sonner";
import {
  addTrainer,
  updateTrainer,
  deleteTrainer,
  addTrainersBatch,
  getTrainerIdCounter,
} from "@/services/superadmin/trainerService";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import TrainerAnalytics from "./TrainerAnalytics";
import Loader from "@/components/ui/Loader";

// Add these ShadCN UI imports if you haven't imported them in this file yet
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper to generate formatted trainer ID
const formatTrainerId = (num) => `GA-T${num.toString().padStart(3, "0")}`;

const TRAINER_ID_REGEX = /^GA-T\d{3,}$/;

const TrainersTab = () => {
  // Get trainers from context (cached, no re-fetch on tab switch)
  const {
    trainers,
    loadTrainers,
    updateTrainersList,
    loading: contextLoading,
  } = useSuperAdminData();
  const loading = contextLoading.trainers;
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Dialog states
  const [trainerDialogOpen, setTrainerDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // Form states
  const defaultTrainerState = {
    trainer_id: "",
    name: "",
    email: "",
    domain: "",
    specialisation: "",
    topics: "", // comma separated string for input
    password: "", // Only for creation not stored
  };
  const [currentTrainer, setCurrentTrainer] = useState(defaultTrainerState);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [batchFile, setBatchFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Analytics view state
  const [selectedTrainerForAnalytics, setSelectedTrainerForAnalytics] =
    useState(null);

  // Force refresh trainers from context
  const refreshTrainers = () => loadTrainers(true);
  
  // Filter Logic
  const allFilteredTrainers = trainers
    .filter((t) => {
      // Primary filter: isDeleted status
      if (showArchived) {
        if (!t.isDeleted) return false;
      } else {
        if (t.isDeleted) return false;
      }

      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      return (
        t.name?.toLowerCase().includes(searchLower) ||
        t.email?.toLowerCase().includes(searchLower) ||
        t.domain?.toLowerCase().includes(searchLower) ||
        t.trainer_id?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) =>
      (a.trainer_id || "").localeCompare(b.trainer_id || "", undefined, {
        numeric: true,
      }),
    );

  const filteredTrainers = allFilteredTrainers;

  // Handlers
  const openCreateDialog = async () => {
    try {
      const lastId = await getTrainerIdCounter();
      const nextId = formatTrainerId(lastId + 1);
      setCurrentTrainer({
        ...defaultTrainerState,
        trainer_id: nextId,
        password: nextId,
      });
      setIsEditing(false);
      setEditingId(null);
      setTrainerDialogOpen(true);
    } catch (error) {
      toast.error("Failed to fetch ID counter");
    }
  };

  const openEditDialog = (trainer) => {
    setCurrentTrainer({
      trainer_id: trainer.trainer_id,
      name: trainer.name,
      email: trainer.email,
      domain: trainer.domain || "",
      specialisation: trainer.specialisation || "",
      topics: trainer.topics ? trainer.topics.join(", ") : "",
      password: "", // Don't preload password (it's not stored anyway)
    });
    setIsEditing(true);
    setEditingId(trainer.id);
    setTrainerDialogOpen(true);
  };

  const handleSaveTrainer = async () => {
    if (
      !currentTrainer.name.trim() ||
      !currentTrainer.trainer_id.trim() ||
      !currentTrainer.email.trim()
    ) {
      toast.error("Please fill in required fields (ID, Name, Email)");
      return;
    }

    if (!isEditing && !currentTrainer.password) {
      toast.error("Password is required for new trainers");
      return;
    }

    // Process topics
    const topicsArray = currentTrainer.topics
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);

    // Validate ID format
    if (!TRAINER_ID_REGEX.test(currentTrainer.trainer_id.trim())) {
      toast.error("Trainer ID must be in GA-TXXX format (e.g., GA-T001)");
      return;
    }

    const trainerData = {
      trainer_id: currentTrainer.trainer_id.trim().toUpperCase(),
      name: currentTrainer.name.trim(),
      email: currentTrainer.email.trim(),
      domain: currentTrainer.domain.trim(),
      specialisation: currentTrainer.specialisation.trim(),
      topics: topicsArray,
      password: currentTrainer.password, // Passed but service handles it (ignores/logs but not stored in doc)
    };

    try {
      if (isEditing) {
        // Remove trainer_id and password from update if you don't want them changeable or minimal update
        // Usually ID shouldn't change. Password isn't stored so valid to send?
        // Service updateTrainer takes "updates" object.
        const { trainer_id, password, ...updates } = trainerData;
        await updateTrainer(editingId, updates);
        toast.success("Trainer updated successfully");

        // Update context state to reflect change without full reload
        updateTrainersList((prev) =>
          prev.map((t) => (t.id === editingId ? { ...t, ...updates } : t)),
        );
      } else {
        await addTrainer(trainerData);
        toast.success("Trainer created successfully");
        refreshTrainers(); // Reload to get fresh list
      }
      setTrainerDialogOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to save trainer");
    }
  };

  const handleDeleteTrainer = async (id) => {
    if (confirm("Are you sure you want to delete this trainer? Deletion is soft and for safe records.")) {
      try {
        await deleteTrainer(id);
        toast.success("Trainer deleted");
        updateTrainersList((prev) => 
          prev.map((t) => (t.id === id ? { ...t, isDeleted: true } : t))
        );
      } catch (error) {
        toast.error("Failed to delete trainer");
      }
    }
  };

  const handleRestoreTrainer = async (id) => {
    try {
      await updateTrainer(id, { isDeleted: false, deletedAt: null });
      toast.success("Trainer restored successfully");
      updateTrainersList((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isDeleted: false, deletedAt: null } : t))
      );
    } catch (error) {
      toast.error("Failed to restore trainer");
    }
  };

  const handleBatchFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/json") {
      setBatchFile(file);
    } else {
      toast.error("Please upload a valid JSON file");
      e.target.value = null;
    }
  };

  const handleBatchUpload = async () => {
    if (!batchFile) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!Array.isArray(json)) {
          throw new Error("JSON must be an array of trainer objects");
        }

        const results = await addTrainersBatch(json);

        let message = `Import Result: ${results.success.length} added`;
        if (results.skipped.length > 0)
          message += `, ${results.skipped.length} skipped (duplicates)`;
        if (results.errors.length > 0)
          message += `, ${results.errors.length} failed`;

        if (results.errors.length > 0) {
          toast.error(message);
          console.warn("Batch errors:", results.errors);
        } else if (results.skipped.length > 0) {
          toast.warning(message);
        } else {
          toast.success(message);
        }

        setBatchDialogOpen(false);
        setBatchFile(null);
        refreshTrainers();
      } catch (error) {
        toast.error("Error parsing or uploading JSON: " + error.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(batchFile);
  };

  // If a trainer is selected for analytics, show analytics view
  if (selectedTrainerForAnalytics) {
    return (
      <TrainerAnalytics
        trainerId={selectedTrainerForAnalytics.id}
        trainerName={selectedTrainerForAnalytics.name}
        onBack={() => setSelectedTrainerForAnalytics(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section - All items on same line */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
           <Button 
            variant={showArchived ? "ghost" : "default"} 
            size="sm" 
            onClick={() => setShowArchived(false)}
            className="rounded-full shadow-sm"
          >
            All Active
          </Button>
          <Button 
            variant={showArchived ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setShowArchived(true)}
            className="rounded-full shadow-sm gap-2"
          >
            <ShieldBan className="h-3.5 w-3.5" />
            Archived/Deleted
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex max-w-md items-center gap-3">
            <div className="relative flex-1">
              <Input
                placeholder={`Search ${showArchived ? "archived" : "active"} by name, email, or domain...`}
                className="pl-10 bg-card/50 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-3 py-1.5 rounded-md border">
              {filteredTrainers.length}{" "}
              {filteredTrainers.length === 1 ? "Trainer" : "Trainers"}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Batch Import Button */}
            {!showArchived && (
              <>
                <Button
                  variant="outline"
                  className="gap-2 shadow-sm border-dashed"
                  onClick={() => setBatchDialogOpen(true)}
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden md:inline">Batch Import</span>
                </Button>

                {/* Add Trainer Button */}
                <Button
                  className="gap-2 gradient-hero text-primary-foreground shadow-md hover:shadow-lg transition-all"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-4 w-4" />
                  Add Trainer
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Batch Import Modal */}
        {batchDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background rounded-xl shadow-xl w-full max-w-lg border border-border animate-in zoom-in-95 duration-200 flex flex-col">
              <div className="flex flex-col space-y-1.5 p-6 pb-4">
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  Batch Import Trainers
                </h2>
                <p className="text-sm text-muted-foreground">
                  Upload a JSON file containing an array of trainer objects.
                </p>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Select File</p>
                  <a
                    href="/sample-trainers.json"
                    download="sample-trainers.json"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Download Sample JSON
                  </a>
                </div>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleBatchFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  Format: JSON array of objects with trainer_id, name, etc.
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setBatchDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchUpload}
                  disabled={!batchFile || isUploading}
                  className="gradient-hero text-primary-foreground"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Upload
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Trainer Modal */}
        {trainerDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background rounded-xl shadow-xl w-full max-w-lg border border-border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex flex-col space-y-1.5 p-6 pb-4">
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  {isEditing ? "Edit Trainer" : "Add New Trainer"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isEditing
                    ? "Update trainer details"
                    : "Add a new trainer to the platform"}
                </p>
              </div>
              <div className="p-6 pt-0 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trainer ID * (Format: GA-TXXX)</Label>
                    <Input
                      value={currentTrainer.trainer_id}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCurrentTrainer({
                          ...currentTrainer,
                          trainer_id: val,
                          // If create mode, also update password if they were matched
                          password:
                            !isEditing &&
                            currentTrainer.password ===
                              currentTrainer.trainer_id
                              ? val
                              : currentTrainer.password,
                        });
                      }}
                      disabled={isEditing}
                      placeholder="GA-T001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={currentTrainer.name}
                      onChange={(e) =>
                        setCurrentTrainer({
                          ...currentTrainer,
                          name: e.target.value,
                        })
                      }
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={currentTrainer.email}
                    onChange={(e) =>
                      setCurrentTrainer({
                        ...currentTrainer,
                        email: e.target.value,
                      })
                    }
                    placeholder="john@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Select
                      value={currentTrainer.domain}
                      onValueChange={(value) =>
                        setCurrentTrainer({
                          ...currentTrainer,
                          domain: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Domain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technical">Technical</SelectItem>
                        <SelectItem value="Soft Skills">
                          Soft Skills
                        </SelectItem>
                        <SelectItem value="Aptitude">Aptitude</SelectItem>
                        <SelectItem value="Tools">Tools</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Specialisation</Label>
                    <Input
                      value={currentTrainer.specialisation}
                      onChange={(e) =>
                        setCurrentTrainer({
                          ...currentTrainer,
                          specialisation: e.target.value,
                        })
                      }
                      placeholder="Core expertise"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Topics (comma separated)</Label>
                  <Textarea
                    value={currentTrainer.topics}
                    onChange={(e) =>
                      setCurrentTrainer({
                        ...currentTrainer,
                        topics: e.target.value,
                      })
                    }
                    placeholder="Java, Python, React, System Design"
                    rows={3}
                  />
                </div>
                {!isEditing && (
                  <div className="space-y-2">
                    <Label>Password (Initial)</Label>
                    <Input
                      type="password"
                      value={currentTrainer.password}
                      onChange={(e) =>
                        setCurrentTrainer({
                          ...currentTrainer,
                          password: e.target.value,
                        })
                      }
                      placeholder="******"
                    />
                    <p className="text-xs text-muted-foreground">
                      Account will be created with this password.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0">
                <Button
                  variant="outline"
                  onClick={() => setTrainerDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTrainer}
                  className="gradient-hero text-primary-foreground"
                >
                  {isEditing ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Redesigned Trainers Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredTrainers.map((trainer, index) => (
          <div
            key={trainer.id}
            className="group relative flex flex-col bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 animate-fade-up overflow-hidden"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="p-5 flex items-center gap-5">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-full flex-shrink-0 bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center border border-primary/10 text-primary shadow-inner">
                <User className="h-12 w-12" />
              </div>

              {/* Details Column */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-3">
                  <h3 className={`font-bold text-lg leading-none ${trainer.isDeleted ? "text-muted-foreground/70" : "text-foreground"}`}>
                    {trainer.name}
                  </h3>
                  <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground border shrink-0">
                    {trainer.trainer_id}
                  </span>
                </div>

                <p className={`text-sm leading-none ${trainer.isDeleted ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                  {trainer.email}
                </p>

                {/* Domain & Specialisation */}
                {(trainer.domain || trainer.specialisation) && (
                  <div className={`pt-2 flex flex-wrap gap-2 text-xs ${trainer.isDeleted ? "opacity-50 grayscale" : ""}`}>
                    {trainer.domain && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-medium shadow-sm">
                        {trainer.domain}
                      </span>
                    )}
                    {trainer.specialisation && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-secondary-foreground border">
                        {trainer.specialisation}
                      </span>
                    )}
                  </div>
                )}

                {/* Skills / Topics */}
                <div className={`pt-2 ${trainer.isDeleted ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {trainer.topics && trainer.topics.length > 0 ? (
                      <>
                        {trainer.topics.slice(0, 3).map((topic, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-medium px-1.5 py-0.5 bg-muted/80 rounded border text-muted-foreground"
                          >
                            {topic}
                          </span>
                        ))}
                        {trainer.topics.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                            +{trainer.topics.length - 3}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] italic text-muted-foreground opacity-60">
                        No skills listed
                      </span>
                    )}
                  </div>
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
                  <DropdownMenuItem
                    onClick={() => setSelectedTrainerForAnalytics(trainer)}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" /> View Analytics
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openEditDialog(trainer)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                  </DropdownMenuItem>
                  {trainer.isDeleted ? (
                    <DropdownMenuItem
                      className="text-primary focus:text-primary focus:bg-primary/10"
                      onClick={() => handleRestoreTrainer(trainer.id)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore Trainer
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => handleDeleteTrainer(trainer.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Trainer
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {/* Loading State */}
        {loading && trainers.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <Loader fullScreen={false} />
            <p className="text-muted-foreground animate-pulse">
              Syncing trainer database...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTrainers.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/10 border-2 border-dashed border-muted rounded-2xl">
            <div className="bg-background p-4 rounded-full shadow-sm mb-4">
              <Users className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              {searchQuery
                ? "No trainers match your search"
                : "No trainers found"}
            </h3>
            <p className="text-muted-foreground max-w-sm text-center mt-2">
              {searchQuery
                ? "Try checking for typos or searching by a different field (ID, Domain, etc)."
                : "Get started by adding your first faculty member or importing a batch file."}
            </p>
            {searchQuery ? (
              <Button
                variant="link"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={openCreateDialog}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" /> Add First Trainer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainersTab;
