import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { auth } from "@/services/firebase";
import { getAllColleges } from "@/services/superadmin/collegeService";
import { getAllTrainers } from "@/services/superadmin/trainerService";
import {
  getAllSessions,
  subscribeToSessions,
} from "@/services/superadmin/sessionService";
import { getAllTemplates } from "@/services/superadmin/templateService";
import { getAllSystemUsers } from "@/services/superadmin/userService";
import {
  getAllProjectCodes,
  addProjectCodes as addProjectCodesService,
  deleteProjectCode as deleteProjectCodeService,
  rerunCollegeMatching as rerunCollegeMatchingService,
} from "@/services/superadmin/projectCodeService";
import { toast } from "sonner";
import { getAcademicConfig } from "@/services/superadmin/academicService";

const SuperAdminDataContext = createContext(null);

export const SuperAdminDataProvider = ({ children }) => {
  // Shared data state
  const [colleges, setColleges] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [academicConfigs, setAcademicConfigs] = useState({}); // { [collegeId]: config }

  // Refs to always access the latest state values (fixes stale closure bug)
  const collegesRef = useRef(colleges);
  const trainersRef = useRef(trainers);
  const sessionsRef = useRef(sessions);
  const templatesRef = useRef(templates);
  const adminsRef = useRef(admins);
  const projectCodesRef = useRef(projectCodes);
  const academicConfigsRef = useRef(academicConfigs);

  // Keep refs in sync with state
  useEffect(() => {
    collegesRef.current = colleges;
  }, [colleges]);
  useEffect(() => {
    trainersRef.current = trainers;
  }, [trainers]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);
  useEffect(() => {
    adminsRef.current = admins;
  }, [admins]);
  useEffect(() => {
    projectCodesRef.current = projectCodes;
  }, [projectCodes]);
  useEffect(() => {
    academicConfigsRef.current = academicConfigs;
  }, [academicConfigs]);

  // Loading states
  const [loading, setLoading] = useState({
    colleges: false,
    trainers: false,
    sessions: false,
    templates: false,
    admins: false,
    projectCodes: false,
    initial: true,
  });

  // Track what's been loaded
  const [loaded, setLoaded] = useState({
    colleges: false,
    trainers: false,
    sessions: false,
    templates: false,
    admins: false,
    projectCodes: false,
  });

  // Load colleges (with optional force refresh)
  const loadColleges = useCallback(
    async (force = false) => {
      // Use ref to get latest value, avoiding stale closure bug
      if (loaded.colleges && !force) return collegesRef.current;

      setLoading((prev) => ({ ...prev, colleges: true }));
      try {
        const data = await getAllColleges();
        setColleges(data);
        setLoaded((prev) => ({ ...prev, colleges: true }));
        return data;
      } catch (error) {
        console.error("Failed to load colleges:", error);
        toast.error("Failed to load colleges");
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, colleges: false }));
      }
    },
    [loaded.colleges],
  );

  // Load trainers (with optional force refresh)
  const loadTrainers = useCallback(
    async (force = false) => {
      // Use ref to get latest value, avoiding stale closure bug
      if (loaded.trainers && !force) return trainersRef.current;

      setLoading((prev) => ({ ...prev, trainers: true }));
      try {
        const result = await getAllTrainers(1000); // Get all trainers
        const data = result.trainers || [];
        setTrainers(data);
        setLoaded((prev) => ({ ...prev, trainers: true }));
        return data;
      } catch (error) {
        console.error("Failed to load trainers:", error);
        toast.error("Failed to load trainers");
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, trainers: false }));
      }
    },
    [loaded.trainers],
  );

  // Load templates (with optional force refresh)
  const loadTemplates = useCallback(
    async (force = false) => {
      // Use ref to get latest value, avoiding stale closure bug
      if (loaded.templates && !force) return templatesRef.current;

      setLoading((prev) => ({ ...prev, templates: true }));
      try {
        const data = await getAllTemplates();
        setTemplates(data);
        setLoaded((prev) => ({ ...prev, templates: true }));
        return data;
      } catch (error) {
        console.error("Failed to load templates:", error);
        toast.error("Failed to load templates");
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, templates: false }));
      }
    },
    [loaded.templates],
  );

  // Load admins (with optional force refresh)
  const loadAdmins = useCallback(
    async (force = false) => {
      // Use ref to get latest value, avoiding stale closure bug
      if (loaded.admins && !force) return adminsRef.current;

      setLoading((prev) => ({ ...prev, admins: true }));
      try {
        const data = await getAllSystemUsers();
        setAdmins(data);
        setLoaded((prev) => ({ ...prev, admins: true }));
        return data;
      } catch (error) {
        console.error("Failed to load admins:", error);
        toast.error("Failed to load admins");
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, admins: false }));
      }
    },
    [loaded.admins],
  );

  // Load project codes (with optional force refresh)
  const loadProjectCodes = useCallback(
    async (force = false) => {
      // Use ref to get latest value, avoiding stale closure bug
      if (loaded.projectCodes && !force) return projectCodesRef.current;

      setLoading((prev) => ({ ...prev, projectCodes: true }));
      try {
        const data = await getAllProjectCodes();
        setProjectCodes(data);
        setLoaded((prev) => ({ ...prev, projectCodes: true }));
        return data;
      } catch (error) {
        console.error("Failed to load project codes:", error);
        toast.error("Failed to load project codes");
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, projectCodes: false }));
      }
    },
    [loaded.projectCodes],
  );

  // Add project codes
  const addProjectCodes = useCallback(async (rawCodes) => {
    setLoading((prev) => ({ ...prev, projectCodes: true }));
    try {
      // Pass current colleges for matching
      const result = await addProjectCodesService(
        rawCodes,
        collegesRef.current,
      );

      // Reload to get new data
      const newData = await getAllProjectCodes();
      setProjectCodes(newData);

      toast.success(
        `Added ${result.added} codes, skipped ${result.skipped} duplicates`,
      );
      return result;
    } catch (error) {
      console.error("Failed to add project codes:", error);
      toast.error("Failed to add project codes");
      throw error;
    } finally {
      setLoading((prev) => ({ ...prev, projectCodes: false }));
    }
  }, []);

  // Delete project code
  const deleteProjectCode = useCallback(async (id) => {
    try {
      await deleteProjectCodeService(id);
      setProjectCodes((prev) => prev.filter((c) => c.id !== id));
      toast.success("Project code deleted");
    } catch (error) {
      console.error("Failed to delete project code:", error);
      toast.error("Failed to delete project code");
      throw error;
    }
  }, []);

  // Rerun matching
  const rerunMatching = useCallback(async () => {
    setLoading((prev) => ({ ...prev, projectCodes: true }));
    try {
      const count = await rerunCollegeMatchingService(collegesRef.current);
      if (count > 0) {
        toast.success(`Updated ${count} project codes with college matches`);
        // Reload data
        const newData = await getAllProjectCodes();
        setProjectCodes(newData);
      } else {
        toast.info("No new matches found");
      }
      return count;
    } catch (error) {
      console.error("Failed to rerun matching:", error);
      toast.error("Failed to rerun matching");
      throw error;
    } finally {
      setLoading((prev) => ({ ...prev, projectCodes: false }));
    }
  }, []);

  // Load sessions (manual load, subscription handles real-time)
  const loadSessions = useCallback(
    async (force = false) => {
      // Use ref to get latest value, avoiding stale closure bug
      if (loaded.sessions && !force) return sessionsRef.current;

      setLoading((prev) => ({ ...prev, sessions: true }));
      try {
        const data = await getAllSessions();
        setSessions(data);
        setLoaded((prev) => ({ ...prev, sessions: true }));
        return data;
      } catch (error) {
        console.error("Failed to load sessions:", error);
        toast.error("Failed to load sessions");
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, sessions: false }));
      }
    },
    [loaded.sessions],
  );

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setLoading((prev) => ({ ...prev, initial: true }));
    await Promise.all([
      loadColleges(true),
      loadTrainers(true),
      loadSessions(true),
      loadTemplates(true),
      loadAdmins(true),
      loadProjectCodes(true),
    ]);
    setLoading((prev) => ({ ...prev, initial: false }));
  }, [loadColleges, loadTrainers, loadSessions, loadTemplates, loadAdmins]);

  // Initial load and session subscription
  useEffect(() => {
    let cancelled = false;

    const initializeData = async () => {
      // Skip if no authenticated user (prevents post-logout errors)
      if (!auth.currentUser) {
        setLoading((prev) => ({ ...prev, initial: false }));
        return;
      }

      await Promise.all([
        loadColleges(),
        loadTrainers(),
        loadTemplates(),
        loadAdmins(),
        loadProjectCodes(),
      ]);

      if (!cancelled) {
        setLoading((prev) => ({ ...prev, initial: false }));
      }
    };

    initializeData();

    // Subscribe to real-time session updates only if authenticated
    let unsubscribe;
    if (auth.currentUser) {
      unsubscribe = subscribeToSessions((updatedSessions) => {
        if (!cancelled) {
          setSessions(updatedSessions);
          setLoaded((prev) => ({ ...prev, sessions: true }));
        }
      });
    }

    return () => {
      cancelled = true;
      unsubscribe && unsubscribe();
    };
  }, []); // Only run once on mount

  const updateTrainersList = useCallback((updater) => {
    if (typeof updater === "function") {
      setTrainers(updater);
    } else {
      setTrainers(updater);
    }
  }, []);

  const updateTemplatesList = useCallback((updater) => {
    if (typeof updater === "function") {
      setTemplates(updater);
    } else {
      setTemplates(updater);
    }
  }, []);

  const updateCollegesList = useCallback((updater) => {
    if (typeof updater === "function") {
      setColleges(updater);
    } else {
      setColleges(updater);
    }
  }, []);

  // Load academic config for a specific college
  const loadAcademicConfig = useCallback(async (collegeId, force = false) => {
    if (!collegeId) return null;

    // Check cache first
    if (!force && academicConfigsRef.current[collegeId]) {
      return academicConfigsRef.current[collegeId];
    }

    // Set simple loading state?
    // Since we don't have per-college loading in the main state object,
    // we'll rely on the specific component to show loading spinners,
    // but the unexpected 'loading' state update here might be overkill or tricky.
    // Let's just do the fetch.
    try {
      const data = await getAcademicConfig(collegeId);
      const config = data || { courses: {} };

      setAcademicConfigs((prev) => ({
        ...prev,
        [collegeId]: config,
      }));

      return config;
    } catch (error) {
      console.error("Failed to load academic config:", error);
      toast.error("Failed to load academic config");
      return { courses: {} };
    }
  }, []);

  const updateAcademicConfig = useCallback((collegeId, newConfig) => {
    setAcademicConfigs((prev) => ({
      ...prev,
      [collegeId]: newConfig,
    }));
  }, []);

  const updateAdminsList = useCallback((updater) => {
    if (typeof updater === "function") {
      setAdmins(updater);
    } else {
      setAdmins(updater);
    }
  }, []);

  const value = {
    // Data
    colleges,
    trainers,
    sessions,
    templates,
    admins,
    projectCodes,

    // Loading states
    loading,
    isInitialLoading: loading.initial,

    // Load functions (with caching)
    loadColleges,
    loadTrainers,
    loadSessions,
    loadTemplates,
    loadAdmins,
    loadProjectCodes,
    loadAcademicConfig,
    refreshAll,

    // Project Code Actions
    addProjectCodes,
    deleteProjectCode,
    rerunMatching,

    // Update functions (for local state updates)
    updateTrainersList,
    updateTemplatesList,
    updateCollegesList,
    updateAdminsList,
    updateAcademicConfig,
    setSessions,
  };

  return (
    <SuperAdminDataContext.Provider value={value}>
      {children}
    </SuperAdminDataContext.Provider>
  );
};

export const useSuperAdminData = () => {
  const context = useContext(SuperAdminDataContext);
  if (!context) {
    throw new Error(
      "useSuperAdminData must be used within a SuperAdminDataProvider",
    );
  }
  return context;
};

export default SuperAdminDataContext;
