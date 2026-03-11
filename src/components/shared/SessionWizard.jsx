import React, { useState, useEffect } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { getAcademicConfig } from "@/services/superadmin/academicService";
import { getAllTemplates as getTemplates } from "@/services/superadmin/templateService";
import {
  createSession,
  updateSession,
} from "@/services/superadmin/sessionService";
import { toast } from "sonner";

// Config
const DOMAIN_OPTIONS = [
  "Technical",
  "Soft Skills",
  "Tools",
  "Aptitude",
  "Other",
];

const SessionWizard = ({
  session = null,
  colleges = [],
  trainers = [], // Pass filtered valid trainers for this context
  projectCodes = [], // [NEW] Accept project codes
  defaultCollegeId = null,
  defaultDomain = null,
  defaultTrainerId = null,
  currentUserId,
  currentUserName,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [academicConfig, setAcademicConfig] = useState({});
  const [academicOptions, setAcademicOptions] = useState(null); // To store current college's config
  const [templates, setTemplates] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);

  // [NEW] Project Code Selection
  const [selectedProjectCode, setSelectedProjectCode] = useState(
    session?.projectCode || "",
  );

  // [NEW] Trainer Search State
  const [trainerSearch, setTrainerSearch] = useState("");
  const [trainerPopoverOpen, setTrainerPopoverOpen] = useState(false);

  const [formData, setFormData] = useState({
    collegeId: session?.collegeId || defaultCollegeId || "",
    collegeName: session?.collegeName || "",
    academicYear: session?.academicYear || "2025-26",
    course: session?.course || "",
    branch: session?.branch || "",
    year: session?.year || "",
    batch: session?.batch || "",
    topic: session?.topic || "",
    domain: session?.domain || defaultDomain || "",
    assignedTrainer:
      session?.assignedTrainer ||
      (defaultTrainerId && trainers.length > 0
        ? { id: trainers[0].id, name: trainers[0].name }
        : null),
    sessionDate: session?.sessionDate || "",
    sessionTime: session?.sessionTime || "Morning",
    sessionDuration: session?.sessionDuration || 60,
    questions: session?.questions || [],
    templateId: session?.templateId || "",
    ttl: session?.ttl || "720",
    projectCode: session?.projectCode || "", // [NEW] Verify storage
  });

  // Load Templates on Mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const t = await getTemplates();
        setTemplates(t || []);
      } catch (error) {
        console.error("Failed to load templates", error);
      }
    };
    loadTemplates();
  }, []);

  // Load Config when College Changes
  useEffect(() => {
    const loadConfig = async () => {
      if (formData.collegeId) { 
        try {
          const config = await getAcademicConfig(formData.collegeId);
          setAcademicOptions(config || {});

          // If college list is provided, find name
          if (colleges && colleges.length > 0) {
            const c = colleges.find((c) => c.id === formData.collegeId);
            if (c) setFormData((prev) => ({ ...prev, collegeName: c.name }));
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    loadConfig();
  }, [formData.collegeId, colleges]);

  // Sync defaultCollegeId (for Trainer Mode context loading)
  useEffect(() => {
    if (defaultCollegeId && formData.collegeId !== defaultCollegeId) {
      setFormData((prev) => ({ ...prev, collegeId: defaultCollegeId }));
    }
  }, [defaultCollegeId, formData.collegeId]);

  // Sync collegeName when colleges prop updates (important for async load in Trainer mode)
  useEffect(() => {
    if (colleges && colleges.length > 0 && formData.collegeId) {
      const matchingCollege = colleges.find((c) => c.id === formData.collegeId);
      if (matchingCollege && formData.collegeName !== matchingCollege.name) {
        setFormData((prev) => ({ ...prev, collegeName: matchingCollege.name }));
      }
    }
  }, [colleges, formData.collegeId, formData.collegeName]);

  // Filter Trainers based on Domain (Step 2) OR Search
  // If searching, ignore domain filter. If not searching, use domain filter.
  useEffect(() => {
    if (step === 2) {
      let filtered = trainers;

      if (trainerSearch.trim()) {
        const searchLower = trainerSearch.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.specialisation?.toLowerCase().includes(searchLower),
        );
      } else if (formData.domain) {
        filtered = filtered.filter(
          (t) =>
            t.domain?.toLowerCase().includes(formData.domain.toLowerCase()) ||
            t.specialisation
              ?.toLowerCase()
              .includes(formData.domain.toLowerCase()),
        );
      }
      setFilteredTrainers(filtered);
    }
  }, [formData.domain, step, trainers, trainerSearch]);

  // Handlers
  const handleCollegeSelect = (collegeId) => {
    // If project code was selected but user changes college manually, clear project code
    if (selectedProjectCode && collegeId !== formData.collegeId) {
      setSelectedProjectCode("");
      setFormData((prev) => ({ ...prev, projectCode: "" }));
    }

    setFormData((prev) => ({
      ...prev,
      collegeId,
      course: "",
      branch: "",
      year: "",
      batch: "", // Reset dependents
    }));
  };

  const handleProjectCodeSelect = (codeString) => {
    const code = projectCodes.find((c) => c.code === codeString);
    if (!code) return;

    setSelectedProjectCode(codeString);

    // Auto-fill fields from project code
    // If collegeId is present in code (matched), use it. Else keep current or clear.

    setFormData((prev) => ({
      ...prev,
      projectCode: codeString,
      collegeId: code.collegeId || prev.collegeId,
      collegeName: code.collegeName || prev.collegeName,
      course: code.course || prev.course,
      year: code.year || prev.year,
      academicYear: code.academicYear || prev.academicYear,
      // Reset dependent fields that are NOT in project code
      branch: "",
      batch: "",
    }));
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return (
          formData.projectCode &&
          formData.collegeId &&
          formData.academicYear &&
          formData.course &&
          formData.branch &&
          formData.year &&
          formData.batch
        );
      case 2:
        return (
          formData.topic &&
          formData.assignedTrainer &&
          formData.sessionDate &&
          formData.sessionTime
        );
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let sessionQuestions = [...(formData.questions || [])];

      // Template Logic
      if (formData.templateId) {
        const selectedTemplate = templates.find(
          (t) => t.id === formData.templateId,
        );
        if (selectedTemplate && selectedTemplate.sections) {
          const templateQuestions = selectedTemplate.sections.flatMap(
            (section) =>
              (section.questions || []).map((q) => ({
                ...q,
                id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${q.id || "new"}`,
              })),
          );
          sessionQuestions = [...sessionQuestions, ...templateQuestions];
        }
      }

      const payload = {
        ...formData,
        questions: sessionQuestions,
        updatedAt: new Date().toISOString(),
      };

      if (session?.id) {
        await updateSession(session.id, payload);
        toast.success("Session updated successfully");
      } else {
        await createSession(payload);
        toast.success("Session created successfully");
      }
      // Reset submitting state BEFORE calling onSuccess to ensure clean state
      // This prevents race conditions when the parent closes the dialog
      setIsSubmitting(false);
      onSuccess?.();
    } catch (error) {
      console.error("Session save failed:", error);
      toast.error("Failed to save session");
      setIsSubmitting(false);
    }
  };

  // Render Step 1
  const renderStep1 = () => {
    // New Structure: Course -> Year -> Department -> Batch
    const courses = academicOptions?.courses
      ? Object.keys(academicOptions.courses)
      : [];
    const currentCourseData = formData.course
      ? academicOptions?.courses[formData.course]
      : null;

    // Years are now under Course
    const years = currentCourseData?.years
      ? Object.keys(currentCourseData.years)
      : [];
    const currentYearData =
      formData.year && currentCourseData?.years
        ? currentCourseData.years[formData.year]
        : null;

    // Departments are now under Year
    const departments = currentYearData?.departments
      ? Object.keys(currentYearData.departments)
      : [];
    const currentDeptData =
      formData.branch && currentYearData?.departments
        ? currentYearData.departments[formData.branch]
        : null;

    // Batches are under Department
    const batches = currentDeptData?.batches || [];

    return (
      <div className="space-y-4 py-2">
        {/* Project Code Selection (Required) */}
        <div className="space-y-2">
          <Label>Project Code *</Label>
          <Select
            value={selectedProjectCode}
            onValueChange={handleProjectCodeSelect}
            disabled={!projectCodes.length}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Project Code" />
            </SelectTrigger>
            <SelectContent>
              {projectCodes
                .filter((code) => code.collegeId)
                .map((code) => (
                  <SelectItem key={code.id} value={code.code}>
                    {code.code}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Project code is required. It will auto-fill College, Course, Year
            and Academic Year.
          </p>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label>College *</Label>
          <Input
            value={
              formData.collegeName ||
              colleges.find((c) => c.id === formData.collegeId)?.name ||
              (selectedProjectCode
                ? "Loading College..."
                : "Select a project code first")
            }
            disabled
            className="bg-muted text-muted-foreground opacity-100"
          />
        </div>

        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Input
              value={formData.academicYear}
              onChange={(e) =>
                setFormData({ ...formData, academicYear: e.target.value })
              }
              placeholder="2025-26"
              disabled={true} // Always disabled - set via project code
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select
                value={formData.course}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    course: v,
                    year: "", // Reset Year
                    branch: "", // Reset Branch
                    batch: "", // Reset Batch
                  })
                }
                disabled={true} // Always disabled - set via project code
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year *</Label>
              <Select
                value={formData.year}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    year: v,
                    branch: "", // Reset Branch
                    batch: "", // Reset Batch
                  })
                }
                disabled={true} // Always disabled - set via project code
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Branch/Dept *</Label>
              <Select
                value={formData.branch}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    branch: v,
                    batch: "", // Reset Batch
                  })
                }
                disabled={!formData.year}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Batch *</Label>
              <Select
                value={formData.batch}
                onValueChange={(v) => setFormData({ ...formData, batch: v })}
                disabled={!formData.branch}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Step 2
  const renderStep2 = () => {
    return (
      <div className="space-y-6 py-2">
        <div className="space-y-3">
          <Label className="text-base font-semibold">Trainer Selection</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Domain (Filter)</Label>
              <Select
                value={formData.domain}
                onValueChange={(v) => setFormData({ ...formData, domain: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Domain" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topic *</Label>
              <Input
                value={formData.topic}
                onChange={(e) =>
                  setFormData({ ...formData, topic: e.target.value })
                }
                placeholder="Topic Name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Trainer *</Label>
            <Popover
              open={trainerPopoverOpen}
              onOpenChange={setTrainerPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={trainerPopoverOpen}
                  className="w-full justify-between"
                >
                  {formData.assignedTrainer
                    ? formData.assignedTrainer.name
                    : "Select trainer..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <div className="p-2 border-b">
                  <div className="flex items-center px-2 py-1 border rounded-md bg-transparent">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      className="flex h-6 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Search trainer..."
                      value={trainerSearch}
                      onChange={(e) => setTrainerSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {filteredTrainers.length === 0 ? (
                    <p className="p-4 text-sm text-center text-muted-foreground">
                      No trainer found.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredTrainers.map((t) => (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${formData.assignedTrainer?.id === t.id ? "bg-accent" : ""}`}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              assignedTrainer: { id: t.id, name: t.name },
                            });
                            setTrainerPopoverOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t.specialisation}
                            </span>
                          </div>
                          {formData.assignedTrainer?.id === t.id && (
                            <Check className="h-4 w-4" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="border-t my-2" />
        <div className="space-y-3">
          <Label className="text-base font-semibold">Session Logistics</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.sessionDate}
                onChange={(e) =>
                  setFormData({ ...formData, sessionDate: e.target.value })
                }
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                className="cursor-pointer block"
              />
            </div>
            <div className="space-y-2">
              <Label>Session Time *</Label>
              <Select
                value={formData.sessionTime}
                onValueChange={(v) =>
                  setFormData({ ...formData, sessionTime: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning">Morning</SelectItem>
                  <SelectItem value="Afternoon">Afternoon</SelectItem>
                  <SelectItem value="Evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration (Hours)</Label>
              <Select
                value={String(formData.sessionDuration / 60 || 1)}
                onValueChange={(v) =>
                  setFormData({ ...formData, sessionDuration: Number(v) * 60 })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Duration" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h} Hour{h > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto-Close (Hours)</Label>
              <Input
                type="number"
                value={formData.ttl}
                onChange={(e) =>
                  setFormData({ ...formData, ttl: e.target.value })
                }
                placeholder="720"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="border-t my-2" />

        <div className="space-y-3">
          <Label className="text-base font-semibold">Feedback Template</Label>
          <div className="space-y-2">
            <Label>Select Template</Label>
            <Select
              value={formData.templateId}
              onValueChange={(v) => setFormData({ ...formData, templateId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a feedback template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecting a template will automatically populate the feedback
              questions for this session.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {step === 1 ? renderStep1() : renderStep2()}

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}

        {step < 2 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!isStepValid()}
            className="gradient-hero text-primary-foreground"
          >
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isStepValid() || isSubmitting}
              className="gradient-hero text-primary-foreground"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {session ? "Save Changes" : "Create Session"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionWizard;
