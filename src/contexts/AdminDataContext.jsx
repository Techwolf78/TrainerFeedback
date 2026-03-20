import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { auth } from "@/services/firebase";
import {
  collegesApi,
  sessionsApi,
  usersApi,
  feedbackApi,
} from "@/lib/dataService";
import { getAllSessions, subscribeToSessions, subscribeToCollegeSessions } from "@/services/superadmin/sessionService";
import { getCollegeById } from "@/services/superadmin/collegeService";
import { getAllTrainers } from "@/services/superadmin/trainerService";
import { collection, query, where, orderBy, onSnapshot, collectionGroup } from "firebase/firestore";
import { db } from "@/services/firebase";
import { toast } from "sonner";

const AdminDataContext = createContext(null);

export const AdminDataProvider = ({ children }) => {
  const { user } = useAuth();

  // Data state
  const [college, setCollege] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [feedback, setFeedback] = useState([]);

  // Loading states
  const [loading, setLoading] = useState({
    college: false,
    sessions: false,
    trainers: false,
    feedback: false,
    initial: true,
  });

  // Track what's been loaded
  const [loaded, setLoaded] = useState({
    college: false,
    sessions: false,
    trainers: false,
    feedback: false,
  });

  // Refs to access current values inside stable callbacks without adding them as deps
  const loadedRef = useRef(loaded);
  const collegeRef = useRef(college);
  const sessionsRef = useRef(sessions);
  const trainersRef = useRef(trainers);
  const feedbackRef = useRef(feedback);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);
  useEffect(() => {
    collegeRef.current = college;
  }, [college]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  useEffect(() => {
    trainersRef.current = trainers;
  }, [trainers]);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  // [NEW] Real-time session subscription for Admin (filtered by collegeId)
  useEffect(() => {
    if (!user?.collegeId) return;

    setLoading(prev => ({ ...prev, sessions: true }));
    
    // We use the new optimized subscribeToCollegeSessions to filter at query level
    const unsubscribe = subscribeToCollegeSessions(user.collegeId, (collegeSessions) => {
      setSessions(collegeSessions);
      setLoaded(prev => ({ ...prev, sessions: true }));
      setLoading(prev => ({ ...prev, sessions: false }));
    });

    return () => unsubscribe();
  }, [user?.collegeId]);

  // [NEW] Real-time Feedback subscription for Admin
  useEffect(() => {
    if (!user?.collegeId) return;

    setLoading(prev => ({ ...prev, feedback: true }));

    // Use a Collection Group query to find all responses for sessions belonging to this college
    // Since we store sessionId on responses, and responses are sub-collections,
    // we query all response collections where collegeId matches.
    const feedbackQuery = query(
      collectionGroup(db, "responses"),
      where("collegeId", "==", user.collegeId),
      orderBy("submittedAt", "desc")
    );

    const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
      const allFeedback = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFeedback(allFeedback);
      setLoaded(prev => ({ ...prev, feedback: true }));
      setLoading(prev => ({ ...prev, feedback: false }));
    });

    return () => unsubscribe();
  }, [user?.collegeId]);

  // Load college details
  const loadCollege = useCallback(
    async (force = false) => {
      if (!user?.collegeId) return null;
      if (loadedRef.current.college && !force) return collegeRef.current;

      setLoading((prev) => ({ ...prev, college: true }));
      try {
        try {
          const data = await getCollegeById(user.collegeId);
          setCollege(data);
        } catch (err) {
          console.warn("Firestore college fetch failed, using legacy:", err);
          const data = collegesApi.getById(user.collegeId);
          setCollege(data);
        }
        setLoaded((prev) => ({ ...prev, college: true }));
      } catch (error) {
        console.error("Failed to load college:", error);
        toast.error("Failed to load college info");
      } finally {
        setLoading((prev) => ({ ...prev, college: false }));
      }
    },
    [user?.collegeId],
  );

  // Load sessions
  const loadSessions = useCallback(
    async (force = false) => {
      if (!user?.collegeId) return [];
      if (loadedRef.current.sessions && !force) return sessionsRef.current;

      setLoading((prev) => ({ ...prev, sessions: true }));
      try {
        const data = await getAllSessions(user.collegeId);
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
    [user?.collegeId],
  );

  // Load trainers
  const loadTrainers = useCallback(async (force = false) => {
    if (loadedRef.current.trainers && !force) return trainersRef.current;

    setLoading((prev) => ({ ...prev, trainers: true }));
    try {
      const { trainers: allTrainers } = await getAllTrainers(1000);
      setTrainers(allTrainers);
      setLoaded((prev) => ({ ...prev, trainers: true }));
      return allTrainers;
    } catch (error) {
      console.error("Failed to load trainers:", error);
      toast.error("Failed to load trainers");
      return [];
    } finally {
      setLoading((prev) => ({ ...prev, trainers: false }));
    }
  }, []);

  // Load feedback (Using legacy for now as feedback service migration might be partial)
  const loadFeedback = useCallback(async (force = false) => {
    if (loadedRef.current.feedback && !force) return feedbackRef.current;

    setLoading((prev) => ({ ...prev, feedback: true }));
    try {
      const allFeedback = feedbackApi.getAll();
      setFeedback(allFeedback);
      setLoaded((prev) => ({ ...prev, feedback: true }));
      return allFeedback;
    } catch (error) {
      console.error("Failed to load feedback:", error);
      return [];
    } finally {
      setLoading((prev) => ({ ...prev, feedback: false }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading((prev) => ({ ...prev, initial: true }));
    await loadCollege(true);
    if (loadedRef.current.sessions) await loadSessions(true);
    if (loadedRef.current.trainers) await loadTrainers(true);
    setLoading((prev) => ({ ...prev, initial: false }));
  }, [loadCollege, loadSessions, loadTrainers]);

  // Initial load - ONLY College Info + Cache
  // Depends on user?.collegeId (primitive) so it only re-runs on actual college change
  useEffect(() => {
    let cancelled = false;

    if (user?.collegeId && auth.currentUser) {
      const init = async () => {
        await loadCollege();
        if (!cancelled) {
          setLoading((prev) => ({ ...prev, initial: false }));
        }
      };
      init();
    } else if (user) {
      // User exists but has no collegeId — clear loading to avoid permanent spinner
      setLoading((prev) => ({ ...prev, initial: false }));
    }

    return () => {
      cancelled = true;
    };
  }, [user?.collegeId, loadCollege]);

  const value = {
    college,
    sessions,
    trainers,
    feedback,
    loading,
    isInitialLoading: loading.initial,
    refreshAll,
    loadSessions,
    loadTrainers,
  };

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
};

export const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }
  return context;
};

export default AdminDataContext;
