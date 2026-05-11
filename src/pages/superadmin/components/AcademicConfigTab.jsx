import React, { useState, useEffect } from "react";
import {
  Save,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  BookOpen,
  Calendar,
  Users,
  AlertCircle,
  Edit,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { saveAcademicConfig } from "@/services/superadmin/academicService";
import { useSuperAdminData } from "@/contexts/SuperAdminDataContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper Component for adding items
const Adder = ({
  placeholder,
  onAdd,
  size = "default",
  minimal = false,
  buttonLabel = null,
}) => {
  const [val, setVal] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (val.trim()) {
      onAdd(val);
      setVal("");
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") {
      setVal("");
      setIsAdding(false);
    }
  };

  const height =
    size === "xs" ? "h-6 text-xs" : size === "sm" ? "h-8 text-sm" : "h-10";
  const width = minimal ? "w-20" : "w-48";

  if (buttonLabel && !isAdding) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="gap-1"
      >
        <Plus className="h-3 w-3" />
        {buttonLabel}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${height} ${width} bg-background/50`}
        autoFocus={buttonLabel ? true : false}
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={handleAdd}
        className={`${height} w-${size === "xs" ? "6" : "8"}`}
        disabled={!val.trim()}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};

const AcademicConfigTab = ({ colleges }) => {
  const { loadAcademicConfig, updateAcademicConfig } = useSuperAdminData();
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [config, setConfig] = useState({ courses: {} });
  const [loading, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState({});
  const [collegeSearchQuery, setCollegeSearchQuery] = useState("");
  const [collegeDropdownOpen, setCollegeDropdownOpen] = useState(false);
  const collegeDropdownRef = React.useRef(null);

  // Edit modal state - replaces browser prompts with professional modal
  const [editModal, setEditModal] = useState({
    open: false,
    type: "", // 'course', 'department', 'batch'
    currentValue: "",
    newValue: "",
    // Context for the edit operation
    courseName: "",
    deptName: "",
    year: "",
    batch: "",
  });

  // Open edit modal for different types
  const openEditModal = (type, currentValue, context = {}) => {
    setEditModal({
      open: true,
      type,
      currentValue,
      newValue: currentValue,
      ...context,
    });
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModal({
      open: false,
      type: "",
      currentValue: "",
      newValue: "",
      courseName: "",
      deptName: "",
      year: "",
      batch: "",
    });
  };

  // Handle edit modal save
  const handleEditSave = () => {
    const { type, currentValue, newValue, courseName, deptName, year, batch } =
      editModal;

    if (!newValue.trim() || newValue === currentValue) {
      closeEditModal();
      return;
    }

    switch (type) {
      case "course":
        renameCourse(currentValue, newValue);
        break;
      case "department":
        renameDept(courseName, year, currentValue, newValue);
        break;
      case "batch":
        renameBatch(courseName, year, deptName, batch, newValue);
        break;
    }

    closeEditModal();
  };

  // Load Config when college changes
  useEffect(() => {
    if (selectedCollegeId) {
      loadConfig(selectedCollegeId);
    } else {
      setConfig({ courses: {} });
      setExpandedCourses({});
    }
  }, [selectedCollegeId]);

  // Auto-select first college on mount
  useEffect(() => {
    if (colleges.length > 0 && !selectedCollegeId) {
      setSelectedCollegeId(colleges[0].id);
    }
  }, [colleges]);

  const filteredColleges = colleges.filter((c) => {
    const search = collegeSearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      (c.code && c.code.toLowerCase().includes(search))
    );
  });

  // Close college dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (collegeDropdownRef.current && !collegeDropdownRef.current.contains(e.target)) {
        setCollegeDropdownOpen(false);
      }
    };
    if (collegeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [collegeDropdownOpen]);

  const loadConfig = async (collegeId) => {
    setLoading(true);
    try {
      // Use context to load (checks cache first)
      const data = await loadAcademicConfig(collegeId);
      setConfig(data || { courses: {} });
      // Expand all courses by default
      if (data?.courses) {
        const expanded = {};
        Object.keys(data.courses).forEach((course) => {
          expanded[course] = true;
        });
        setExpandedCourses(expanded);
      }
    } catch (error) {
      toast.error("Failed to load config");
      setConfig({ courses: {} });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCollegeId) return;
    setLoading(true);
    try {
      await saveAcademicConfig(selectedCollegeId, config);
      // Update context cache with new config
      updateAcademicConfig(selectedCollegeId, config);
      toast.success("Configuration saved successfully");
      setConfigModalOpen(false);
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD Handlers ---

  // Course: Level 1
  const addCourse = (name) => {
    if (!name.trim()) return;
    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [name]: { years: {} },
      },
    }));
    setExpandedCourses((prev) => ({ ...prev, [name]: true }));
  };

  const removeCourse = (courseName) => {
    const newCourses = { ...config.courses };
    delete newCourses[courseName];
    setConfig({ ...config, courses: newCourses });
  };

  // Year: Level 2 (Under Course)
  const addYear = (courseName, year) => {
    if (!year.trim()) return;
    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: { departments: {} },
          },
        },
      },
    }));
  };

  const removeYear = (courseName, year) => {
    const newYears = { ...config.courses[courseName].years };
    delete newYears[year];
    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: newYears,
        },
      },
    }));
  };

  // Department: Level 3 (Under Year)
  const addDept = (courseName, year, deptName) => {
    if (!deptName.trim()) return;
    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: {
              ...prev.courses[courseName].years[year],
              departments: {
                ...prev.courses[courseName].years[year].departments,
                [deptName]: { batches: [] },
              },
            },
          },
        },
      },
    }));
  };

  const removeDept = (courseName, year, deptName) => {
    const newDepts = { ...config.courses[courseName].years[year].departments };
    delete newDepts[deptName];
    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: {
              ...prev.courses[courseName].years[year],
              departments: newDepts,
            },
          },
        },
      },
    }));
  };

  // Batch: Level 4 (Under Department)
  const addBatch = (courseName, year, deptName, batch) => {
    if (!batch.trim()) return;
    const currentBatches =
      config.courses[courseName].years[year].departments[deptName].batches ||
      [];
    if (currentBatches.includes(batch)) return;

    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: {
              ...prev.courses[courseName].years[year],
              departments: {
                ...prev.courses[courseName].years[year].departments,
                [deptName]: {
                  ...prev.courses[courseName].years[year].departments[deptName],
                  batches: [...currentBatches, batch],
                },
              },
            },
          },
        },
      },
    }));
  };

  const removeBatch = (courseName, year, deptName, batch) => {
    const currentBatches =
      config.courses[courseName].years[year].departments[deptName].batches ||
      [];
    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: {
              ...prev.courses[courseName].years[year],
              departments: {
                ...prev.courses[courseName].years[year].departments,
                [deptName]: {
                  ...prev.courses[courseName].years[year].departments[deptName],
                  batches: currentBatches.filter((b) => b !== batch),
                },
              },
            },
          },
        },
      },
    }));
  };

  // --- Rename Handlers ---

  // --- Rename Handlers ---

  const renameCourse = (oldName, newName) => {
    if (!newName.trim() || newName === oldName) return;
    if (config.courses[newName]) {
      toast.error("A course with this name already exists");
      return;
    }
    const newCourses = {};
    Object.entries(config.courses).forEach(([key, value]) => {
      if (key === oldName) {
        newCourses[newName] = value;
      } else {
        newCourses[key] = value;
      }
    });
    setConfig({ ...config, courses: newCourses });
    // Update expanded state
    setExpandedCourses((prev) => {
      const newExpanded = { ...prev };
      newExpanded[newName] = newExpanded[oldName];
      delete newExpanded[oldName];
      return newExpanded;
    });
    // Update selected years
    setSelectedYears((prev) => {
      const newYears = { ...prev };
      newYears[newName] = newYears[oldName];
      delete newYears[oldName];
      return newYears;
    });
  };

  // Renaming Department (now nested under Year)
  const renameDept = (courseName, year, oldName, newName) => {
    if (!newName.trim() || newName === oldName) return;
    if (config.courses[courseName].years[year].departments[newName]) {
      toast.error("A department with this name already exists");
      return;
    }

    const departments = config.courses[courseName].years[year].departments;
    const newDepts = {};
    Object.entries(departments).forEach(([key, value]) => {
      if (key === oldName) {
        newDepts[newName] = value;
      } else {
        newDepts[key] = value;
      }
    });

    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: {
              ...prev.courses[courseName].years[year],
              departments: newDepts,
            },
          },
        },
      },
    }));
  };

  // Renaming Batch (now nested under Dept)
  const renameBatch = (courseName, year, deptName, oldBatch, newBatch) => {
    if (!newBatch.trim() || newBatch === oldBatch) return;
    const currentBatches =
      config.courses[courseName].years[year].departments[deptName].batches ||
      [];
    if (currentBatches.includes(newBatch)) {
      toast.error("A batch with this name already exists");
      return;
    }
    const newBatches = currentBatches.map((b) =>
      b === oldBatch ? newBatch : b,
    );

    setConfig((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [courseName]: {
          ...prev.courses[courseName],
          years: {
            ...prev.courses[courseName].years,
            [year]: {
              ...prev.courses[courseName].years[year],
              departments: {
                ...prev.courses[courseName].years[year].departments,
                [deptName]: {
                  ...prev.courses[courseName].years[year].departments[deptName],
                  batches: newBatches,
                },
              },
            },
          },
        },
      },
    }));
  };

  const toggleCourseExpand = (courseName) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseName]: !prev[courseName],
    }));
  };

  // Read-only view of the structure
  const renderReadOnlyView = () => {
    const courses = config.courses || {};
    if (Object.keys(courses).length === 0) {
      return (
        <div className="text-muted-foreground text-center py-8">
          No academic structure configured yet. Click "Configure Structure" to
          start.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(courses).map(([courseName, courseData]) => (
          <div key={courseName} className="border-l-4 border-primary pl-4">
            {/* Course Header */}
            <div
              className="flex items-center gap-2 cursor-pointer py-2"
              onClick={() => toggleCourseExpand(courseName)}
            >
              {expandedCourses[courseName] ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-primary" />
              )}
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg text-primary">
                {courseName}
              </span>
            </div>

            {/* Years (Level 2) */}
            {expandedCourses[courseName] &&
              Object.entries(courseData.years || {}).map(([year, yearData]) => (
                <div
                  key={year}
                  className="ml-6 border-l-2 border-muted pl-4 py-2"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      Year {year}
                    </span>
                  </div>

                  {/* Departments (Level 3) - displayed side by side */}
                  <div className="flex flex-wrap gap-4 ml-4">
                    {Object.entries(yearData.departments || {}).map(
                      ([deptName, deptData]) => (
                        <div
                          key={deptName}
                          className="bg-secondary/20 rounded-lg p-3 border border-border/50 min-w-[150px]"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span className="font-medium">{deptName}</span>
                          </div>

                          {/* Batches (Level 4) */}
                          <div className="flex flex-wrap gap-1">
                            {(deptData.batches || []).map((batch) => (
                              <span
                                key={batch}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-secondary/30 border rounded"
                              >
                                <Users className="h-3 w-3" />
                                {batch}
                              </span>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  };

  // State for tracking selected year tab per course+department
  const [selectedYears, setSelectedYears] = useState({});

  // Get all unique years for a course
  const getYearsForCourse = (courseData) => {
    return Object.keys(courseData.years || {}).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
  };

  // Get stats for a course
  const getCourseStats = (courseData) => {
    const years = getYearsForCourse(courseData);
    let deptCount = 0;
    Object.values(courseData.years || {}).forEach((y) => {
      deptCount += Object.keys(y.departments || {}).length;
    });
    return { yearCount: years.length, deptCount };
  };

  // Editable tree view for the modal - matches reference design
  const renderEditableTree = () => {
    return (
      <div className="space-y-4">
        {/* Header with Add Course button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1e3a5f]">
            Academic Structure Tree
          </h2>
        </div>

        {/* Course Cards */}
        <div className="space-y-6">
          {Object.entries(config.courses || {}).map(
            ([courseName, courseData]) => {
              const stats = getCourseStats(courseData);
              const years = getYearsForCourse(courseData);
              const selectedYear =
                selectedYears[courseName] || years[0] || null;

              return (
                <div
                  key={courseName}
                  className="border rounded-xl bg-card shadow-sm overflow-hidden"
                >
                  {/* Course Header */}
                  <div className="p-4 border-b bg-secondary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleCourseExpand(courseName)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedCourses[courseName] ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-amber-700" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-[#1e3a5f]">
                            {courseName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {stats.yearCount} Years • {stats.deptCount}{" "}
                            Departments
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            openEditModal("course", courseName, { courseName })
                          }
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit course name"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Year Tabs */}
                    {expandedCourses[courseName] && years.length > 0 && (
                      <div className="flex mt-4 border-b w-full overflow-x-auto">
                        {years.map((year) => (
                          <div key={year} className="relative group">
                            <button
                              onClick={() =>
                                setSelectedYears((prev) => ({
                                  ...prev,
                                  [courseName]: year,
                                }))
                              }
                              className={`px-6 py-2 text-sm font-medium transition-colors ${
                                selectedYear === year
                                  ? "text-white bg-[#1e3a5f] rounded-t-lg"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                              }`}
                            >
                              Year {year}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Course Content */}
                  {expandedCourses[courseName] && selectedYear && (
                    <div className="p-4">
                      {/* Year Header & Actions */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold">
                            {selectedYear}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">
                              Year {selectedYear}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {
                                Object.keys(
                                  courseData.years[selectedYear]?.departments ||
                                    {},
                                ).length
                              }{" "}
                              Departments
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Adder
                            placeholder="Department (e.g. CSE)"
                            onAdd={(val) => {
                              addDept(courseName, selectedYear, val);
                            }}
                            buttonLabel="Add Department"
                          />
                        </div>
                      </div>

                      {/* Department Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(
                          courseData.years[selectedYear]?.departments || {},
                        ).map(([deptName, deptData]) => {
                          const batches = deptData.batches || [];

                          return (
                            <div
                              key={deptName}
                              className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                            >
                              {/* Department Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-[#1e3a5f]" />
                                  <h5 className="font-semibold text-[#1e3a5f]">
                                    {deptName}
                                  </h5>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      openEditModal("department", deptName, {
                                        courseName,
                                        year: selectedYear,
                                      })
                                    }
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    title="Edit department name"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      removeDept(
                                        courseName,
                                        selectedYear,
                                        deptName,
                                      )
                                    }
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    title="Delete department"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Batches Section */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    Batches ({batches.length})
                                  </span>
                                </div>

                                <div className="bg-secondary/10 rounded-lg p-3 border border-border/50">
                                  <div className="flex flex-wrap gap-2">
                                    {batches.map((batch) => (
                                      <div
                                        key={batch}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-background border rounded-md text-sm group"
                                      >
                                        <span className="font-medium">
                                          {batch}
                                        </span>
                                        <button
                                          onClick={() =>
                                            openEditModal("batch", batch, {
                                              courseName,
                                              deptName,
                                              year: selectedYear,
                                              batch,
                                            })
                                          }
                                          className="text-muted-foreground hover:text-foreground"
                                          title="Edit batch name"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            removeBatch(
                                              courseName,
                                              selectedYear,
                                              deptName,
                                              batch,
                                            )
                                          }
                                          className="text-muted-foreground hover:text-destructive"
                                          title="Delete batch"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-border/50">
                                    <Adder
                                      placeholder="Batch name (e.g. A)"
                                      onAdd={(val) =>
                                        addBatch(
                                          courseName,
                                          selectedYear,
                                          deptName,
                                          val,
                                        )
                                      }
                                      size="xs"
                                      buttonLabel="Add Batch"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty state if no departments */}
                        {Object.keys(
                          courseData.years[selectedYear]?.departments || {},
                        ).length === 0 && (
                          <div className="col-span-full text-center py-6 border-2 border-dashed rounded-lg bg-muted/20">
                            <p className="text-sm text-muted-foreground mb-2">
                              No departments in Year {selectedYear} yet.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* College Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select College</CardTitle>
          <CardDescription>Choose the college to configure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="relative max-w-md" ref={collegeDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setCollegeDropdownOpen((prev) => !prev);
                  setCollegeSearchQuery("");
                }}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <span className={selectedCollegeId ? "text-foreground" : "text-muted-foreground"}>
                  {selectedCollegeId
                    ? (() => {
                        const c = colleges.find((col) => col.id === selectedCollegeId);
                        return c ? `${c.name}${c.code ? ` (${c.code})` : ""}` : "Select a college...";
                      })()
                    : "Select a college..."}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>

              {collegeDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                  <div className="p-2 border-b border-slate-100">
                    <div className="flex items-center px-2 py-1.5 bg-slate-100 rounded-md">
                      <Search className="h-3.5 w-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder="Search colleges..."
                        className="bg-transparent border-none outline-none text-xs w-full text-slate-700"
                        value={collegeSearchQuery}
                        onChange={(e) => setCollegeSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto py-1">
                    {filteredColleges.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No colleges found
                      </div>
                    ) : (
                      filteredColleges.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCollegeId(c.id);
                            setCollegeDropdownOpen(false);
                            setCollegeSearchQuery("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${
                            selectedCollegeId === c.id ? "bg-primary/5 text-primary font-medium" : "text-foreground"
                          }`}
                        >
                          {c.name}
                          {c.code ? (
                            <span className="ml-1 text-muted-foreground">({c.code})</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedCollegeId && (
              <Button
                onClick={() => setConfigModalOpen(true)}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Edit className="h-4 w-4" />
                Configure Structure
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Read-only View of Current Structure */}
      {selectedCollegeId && (
        <Card>
          <CardHeader>
            <CardTitle>Current Academic Structure</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground text-center py-8">
                Loading configuration...
              </div>
            ) : (
              renderReadOnlyView()
            )}
          </CardContent>
        </Card>
      )}

      {!selectedCollegeId && (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed">
          <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No College Selected</h3>
          <p>
            Please select a college above to view and edit its academic
            configuration.
          </p>
        </div>
      )}

      {/* Configure Structure Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Academic Configuration</DialogTitle>
            <DialogDescription>
              Configure the academic structure: Course - Department - Year -
              Batch
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">{renderEditableTree()}</div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfigModalOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name Modal - replaces browser prompts */}
      <Dialog
        open={editModal.open}
        onOpenChange={(open) => !open && closeEditModal()}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editModal.type === "course" && "Edit Course Name"}
              {editModal.type === "department" && "Edit Department Name"}
              {editModal.type === "batch" && "Edit Batch Name"}
            </DialogTitle>
            <DialogDescription>
              Enter the new name below. This will update all references.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editModal.newValue}
              onChange={(e) =>
                setEditModal((prev) => ({ ...prev, newValue: e.target.value }))
              }
              placeholder={`Enter new ${editModal.type} name`}
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") closeEditModal();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={
                !editModal.newValue.trim() ||
                editModal.newValue === editModal.currentValue
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademicConfigTab;
