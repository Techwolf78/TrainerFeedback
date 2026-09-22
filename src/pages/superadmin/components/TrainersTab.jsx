import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  Trophy,
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
import { getAllSessions } from "@/services/superadmin/sessionService";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import TrainerAnalytics from "./TrainerAnalytics";
import TrainerLeaderboard from "./TrainerLeaderboard";
import TrainerComparison from "./TrainerComparison";
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
    sessions,
    loadTrainers,
    updateTrainersList,
    loading: contextLoading,
  } = useSuperAdminData();
  const loading = contextLoading.trainers;
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const showArchived = viewMode === "archived";
  const showLeaderboard = viewMode === "leaderboard";

  // Dedicated one-time on-demand state for complete historical sessions for Leaderboard
  const [leaderboardSessions, setLeaderboardSessions] = useState([]);
  const [loadingLeaderboardSessions, setLoadingLeaderboardSessions] = useState(false);

  const handleSwitchToLeaderboard = () => {
    setViewMode("leaderboard");
    if (leaderboardSessions.length === 0 && !loadingLeaderboardSessions) {
      setLoadingLeaderboardSessions(true);
      getAllSessions()
        .then((fetchedSessions) => {
          setLeaderboardSessions(fetchedSessions || []);
        })
        .catch((err) => {
          console.error("Failed to load all sessions for leaderboard:", err);
        })
        .finally(() => {
          setLoadingLeaderboardSessions(false);
        });
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (showLeaderboard && leaderboardSessions.length === 0 && !loadingLeaderboardSessions) {
      setLoadingLeaderboardSessions(true);
      getAllSessions()
        .then((fetchedSessions) => {
          if (isMounted) {
            setLeaderboardSessions(fetchedSessions || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load all sessions for leaderboard:", err);
        })
        .finally(() => {
          if (isMounted) setLoadingLeaderboardSessions(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [showLeaderboard, leaderboardSessions.length, loadingLeaderboardSessions]);

  const isLeaderboardLoading =
    showLeaderboard &&
    (loadingLeaderboardSessions || leaderboardSessions.length === 0);

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

  const [searchParams, setSearchParams] = useSearchParams();
  const trainerIdParam = searchParams.get("trainerId");

  // Analytics view state
  const [selectedTrainerForAnalytics, setSelectedTrainerForAnalytics] =
    useState(null);

  // Comparison view state (up to 3 trainers)
  const [selectedTrainersForComparison, setSelectedTrainersForComparison] =
    useState([]);
  const [isComparing, setIsComparing] = useState(false);

  const handleToggleCompare = (trainer) => {
    if (!trainer) return;
    setSelectedTrainersForComparison((prev) => {
      const exists = prev.some(
        (t) => t.id === trainer.id || t.trainer_id === trainer.trainer_id
      );
      if (exists) {
        return prev.filter(
          (t) => t.id !== trainer.id && t.trainer_id !== trainer.trainer_id
        );
      }
      if (prev.length >= 3) {
        toast.info("You can compare up to 3 trainers at a time. Please deselect one first.");
        return prev;
      }
      return [...prev, trainer];
    });
  };

  const handleStartComparison = () => {
    if (selectedTrainersForComparison.length < 2) {
      toast.info("Please select at least 2 trainers to compare.");
      return;
    }
    if (leaderboardSessions.length === 0 && !loadingLeaderboardSessions) {
      setLoadingLeaderboardSessions(true);
      getAllSessions()
        .then((fetchedSessions) => {
          setLeaderboardSessions(fetchedSessions || []);
        })
        .catch((err) => {
          console.error("Failed to load all sessions for comparison:", err);
        })
        .finally(() => {
          setLoadingLeaderboardSessions(false);
        });
    }
    setIsComparing(true);
  };

  const handleRemoveFromComparison = (trainerId) => {
    setSelectedTrainersForComparison((prev) =>
      prev.filter((t) => t.id !== trainerId && t.trainer_id !== trainerId)
    );
  };

  const handleClearComparison = () => {
    setSelectedTrainersForComparison([]);
  };

  const handleSelectTrainerForAnalytics = (trainer) => {
    if (trainer) {
      setSelectedTrainerForAnalytics(trainer);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("trainerId", trainer.id);
      setSearchParams(newParams);
    } else {
      setSelectedTrainerForAnalytics(null);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("trainerId");
      setSearchParams(newParams);
    }
  };

  useEffect(() => {
    if (trainerIdParam && trainers && trainers.length > 0) {
      const found = trainers.find(
        (t) => t.id === trainerIdParam || t.trainer_id === trainerIdParam
      );
      if (found) {
        setSelectedTrainerForAnalytics(found);
      }
    } else if (!trainerIdParam) {
      setSelectedTrainerForAnalytics(null);
    }
  }, [trainerIdParam, trainers]);

  // Force refresh trainers from context
  const refreshTrainers = () => {
    loadTrainers(true);
    if (showLeaderboard) {
      setLoadingLeaderboardSessions(true);
      getAllSessions()
        .then((fetchedSessions) => {
          setLeaderboardSessions(fetchedSessions || []);
        })
        .catch((err) => {
          console.error("Failed to refresh leaderboard sessions:", err);
        })
        .finally(() => {
          setLoadingLeaderboardSessions(false);
        });
    }
  };
  
  // Filter Logic
  const allFilteredTrainers = trainers
    .filter((t) => {
      if (showLeaderboard) return false;

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

  // If comparing trainers, show comparison view
  if (isComparing && selectedTrainersForComparison.length >= 2) {
    return (
      <TrainerComparison
        trainers={selectedTrainersForComparison}
        sessions={leaderboardSessions.length > 0 ? leaderboardSessions : sessions}
        onClose={() => setIsComparing(false)}
        onRemoveTrainer={handleRemoveFromComparison}
        onSelectTrainerForAnalytics={(trainer) => {
          setIsComparing(false);
          handleSelectTrainerForAnalytics(trainer);
        }}
      />
    );
  }

  // If a trainer is selected for analytics, show analytics view
  if (selectedTrainerForAnalytics) {
    return (
      <TrainerAnalytics
        trainer={selectedTrainerForAnalytics}
        trainerId={selectedTrainerForAnalytics.id}
        trainerName={selectedTrainerForAnalytics.name}
        allSessions={leaderboardSessions.length > 0 ? leaderboardSessions : null}
        onBack={() => handleSelectTrainerForAnalytics(null)}
      />
    );
  }

  return (
    <>
      <div className="space-y-3.5">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "active" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("active")}
              className="h-8 text-xs px-3.5 rounded-full shadow-xs"
            >
              All Active
            </Button>
            <Button
              variant={viewMode === "archived" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("archived")}
              className="h-8 text-xs px-3.5 rounded-full shadow-xs gap-1.5"
            >
              <ShieldBan className="h-3.5 w-3.5" />
              Archived/Deleted
            </Button>
            <Button
              variant={viewMode === "leaderboard" ? "default" : "ghost"}
              size="sm"
              onClick={handleSwitchToLeaderboard}
              className="h-8 text-xs px-3.5 rounded-full shadow-xs gap-1.5"
            >
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </Button>
          </div>

          {/* Search and Action Buttons */}
          <div className="flex items-center gap-2.5 flex-1 sm:justify-end">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search ${
                  showLeaderboard
                    ? "leaderboard"
                    : showArchived
                      ? "archived"
                      : "active"
                } by name, email, ID...`}
                className="pl-8 h-8 text-xs bg-card/50 shadow-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-3 h-8 flex items-center rounded-md border shadow-2xs">
              {showLeaderboard
                ? `${trainers.filter((t) => !t.isDeleted).length} Ranked`
                : `${filteredTrainers.length} ${
                    filteredTrainers.length === 1 ? "Trainer" : "Trainers"
                  }`}
            </div>

            {/* Batch Import & Add Trainer Buttons */}
            {!showArchived && !showLeaderboard && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2.5 gap-1.5 shadow-xs border-dashed"
                  onClick={() => setBatchDialogOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Batch Import</span>
                </Button>

                <Button
                  size="sm"
                  className="h-8 text-xs px-3 gap-1.5 gradient-hero text-primary-foreground shadow-xs hover:shadow-sm transition-all"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Trainer
                </Button>
              </div>
            )}
          </div>
        </div>

        {showLeaderboard ? (
          isLeaderboardLoading ? (
            <div className="flex flex-col items-center justify-center py-20 min-h-[350px]">
              <Loader fullScreen={false} />
              <p className="mt-4 text-xs font-medium text-muted-foreground animate-pulse">
                Calculating lifetime leaderboard rankings...
              </p>
            </div>
          ) : (
            <TrainerLeaderboard
              trainers={trainers}
              sessions={leaderboardSessions}
              loading={loadingLeaderboardSessions}
              searchQuery={searchQuery}
              onSelectTrainer={handleSelectTrainerForAnalytics}
              selectedForComparison={selectedTrainersForComparison}
              onToggleCompare={handleToggleCompare}
            />
          )
        ) : (
          /* Trainers Grid */
          <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrainers.map((trainer, index) => {
              const isSelectedForCompare = selectedTrainersForComparison.some(
                (t) => t.id === trainer.id || t.trainer_id === trainer.trainer_id
              );
              return (
                <div
                  key={trainer.id}
                  className={`group relative flex flex-col bg-card border rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 overflow-hidden ${
                    isSelectedForCompare
                      ? "ring-2 ring-primary border-primary shadow-sm bg-primary/[0.02]"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="p-3.5 px-4 flex items-start gap-3.5">
                    {/* Avatar */}
                    <div className="h-11 w-11 rounded-full flex-shrink-0 bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center border border-primary/10 text-primary shadow-inner mt-0.5">
                      <User className="h-7 w-7" />
                    </div>

                    {/* Details Column */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={`font-bold text-sm leading-tight truncate ${
                            trainer.isDeleted
                              ? "text-muted-foreground/70"
                              : "text-foreground"
                          }`}
                          title={trainer.name}
                        >
                          {trainer.name}
                        </h3>
                        <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground border shrink-0">
                          {trainer.trainer_id}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-none truncate ${
                          trainer.isDeleted
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {trainer.email}
                      </p>

                      {/* Domain & Specialisation */}
                      {(trainer.domain || trainer.specialisation) && (
                        <div
                          className={`pt-1 flex flex-wrap gap-1.5 text-[10px] ${
                            trainer.isDeleted ? "opacity-50 grayscale" : ""
                          }`}
                        >
                          {trainer.domain && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium shadow-xs">
                              {trainer.domain}
                            </span>
                          )}
                          {trainer.specialisation && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary text-secondary-foreground border font-medium">
                              {trainer.specialisation}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Skills / Topics */}
                      <div
                        className={`pt-1 ${
                          trainer.isDeleted ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex flex-wrap gap-1">
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
                                <span className="text-[10px] px-1 py-0.5 text-muted-foreground">
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
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent -mr-1.5 -mt-1 shrink-0"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => handleToggleCompare(trainer)}
                        >
                          <span className="mr-2">⚖️</span>
                          {isSelectedForCompare ? "Remove from Compare" : "Add to Compare"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSelectTrainerForAnalytics(trainer)}
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

                  {/* Card Bottom Quick Actions */}
                  <div className="px-4 py-2 border-t border-border/40 mt-auto flex items-center justify-between bg-muted/20">
                    <button
                      type="button"
                      onClick={() => handleToggleCompare(trainer)}
                      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                        isSelectedForCompare
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                          : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border"
                      }`}
                      title={isSelectedForCompare ? "Remove from comparison" : "Select to compare side-by-side"}
                    >
                      <span>⚖️</span>
                      <span>{isSelectedForCompare ? "Selected" : "Compare"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTrainerForAnalytics(trainer)}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                    >
                      <BarChart3 className="h-3 w-3" />
                      <span>Analytics</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Loading State */}
            {loading && trainers.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Loader fullScreen={false} />
                <p className="text-muted-foreground text-xs mt-2 animate-pulse">
                  Syncing trainer database...
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredTrainers.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-14 bg-muted/10 border-2 border-dashed border-muted rounded-2xl">
                <div className="bg-background p-3 rounded-full shadow-2xs mb-3 border">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {searchQuery
                    ? "No trainers match your search"
                    : "No trainers found"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm text-center mt-1">
                  {searchQuery
                    ? "Try checking for typos or searching by a different field (ID, Domain, etc)."
                    : "Get started by adding your first faculty member or importing a batch file."}
                </p>
                {searchQuery ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-xs"
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={openCreateDialog}
                    className="mt-3 gap-1.5 text-xs gradient-hero text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add First Trainer
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Import Modal */}
      {batchDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg border border-border animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex flex-col space-y-1.5 p-5 pb-3">
              <h2 className="text-base font-semibold leading-none tracking-tight">
                Batch Import Trainers
              </h2>
              <p className="text-xs text-muted-foreground">
                Upload a JSON file containing an array of trainer objects.
              </p>
            </div>
            <div className="p-5 pt-0 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-medium">Select File</p>
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
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Format: JSON array of objects with trainer_id, name, etc.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-5 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setBatchDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBatchUpload}
                disabled={!batchFile || isUploading}
                className="gradient-hero text-primary-foreground text-xs"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
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
            <div className="flex flex-col space-y-1.5 p-5 pb-3">
              <h2 className="text-base font-semibold leading-none tracking-tight">
                {isEditing ? "Edit Trainer" : "Add New Trainer"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "Update trainer details"
                  : "Add a new trainer to the platform"}
              </p>
            </div>
            <div className="p-5 pt-0 overflow-y-auto space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Trainer ID * (GA-TXXX)</Label>
                  <Input
                    value={currentTrainer.trainer_id}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCurrentTrainer({
                        ...currentTrainer,
                        trainer_id: val,
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
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input
                    value={currentTrainer.name}
                    onChange={(e) =>
                      setCurrentTrainer({
                        ...currentTrainer,
                        name: e.target.value,
                      })
                    }
                    placeholder="John Doe"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
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
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Domain</Label>
                  <Select
                    value={currentTrainer.domain}
                    onValueChange={(value) =>
                      setCurrentTrainer({
                        ...currentTrainer,
                        domain: value,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
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
                <div className="space-y-1">
                  <Label className="text-xs">Specialisation</Label>
                  <Input
                    value={currentTrainer.specialisation}
                    onChange={(e) =>
                      setCurrentTrainer({
                        ...currentTrainer,
                        specialisation: e.target.value,
                      })
                    }
                    placeholder="Core expertise"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Topics (comma separated)</Label>
                <Textarea
                  value={currentTrainer.topics}
                  onChange={(e) =>
                    setCurrentTrainer({
                      ...currentTrainer,
                      topics: e.target.value,
                    })
                  }
                  placeholder="Java, Python, React, System Design"
                  rows={2}
                  className="text-xs"
                />
              </div>
              {!isEditing && (
                <div className="space-y-1">
                  <Label className="text-xs">Password (Initial)</Label>
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
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Account will be created with this password.
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-5 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setTrainerDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTrainer}
                className="gradient-hero text-primary-foreground text-xs"
              >
                {isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Comparison Action Bar */}
      {selectedTrainersForComparison.length > 0 && !isComparing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-card/95 backdrop-blur-md border border-primary/30 shadow-2xl px-4 py-2.5 rounded-full max-w-xl w-[92vw] sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 overflow-hidden">
              {selectedTrainersForComparison.map((t, i) => (
                <div
                  key={t.id || i}
                  className="h-7 w-7 rounded-full bg-primary/20 text-primary border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-xs"
                  title={t.name}
                >
                  {t.name?.charAt(0) || "T"}
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
              {selectedTrainersForComparison.length}/3 Selected
            </span>
          </div>

          <div className="h-4 w-px bg-border mx-0.5" />

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              disabled={selectedTrainersForComparison.length < 2}
              onClick={handleStartComparison}
              className="h-7 text-xs px-3.5 gap-1.5 gradient-hero text-primary-foreground shadow-xs font-semibold rounded-full disabled:opacity-50"
            >
              <span>⚖️</span>
              <span>
                {selectedTrainersForComparison.length < 2
                  ? "Select 1 more"
                  : `Compare Now (${selectedTrainersForComparison.length})`}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearComparison}
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
              title="Clear selection"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default TrainersTab;
