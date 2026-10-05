import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { getSessionById } from "@/services/superadmin/sessionService";
import SessionAnalytics from "@/pages/superadmin/components/SessionAnalytics";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const SessionResponses = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialTrainer = searchParams.get("trainer") || location.state?.selectedTrainerName || null;

  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const data = await getSessionById(sessionId);
        if (isMounted) {
          setSession(data);
        }
      } catch (err) {
        console.error("Error loading session:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadSession();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleGoBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2.5">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading session analytics & responses...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-xs m-4 max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-slate-800">Session Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          Could not locate session record with ID:{" "}
          <span className="font-mono text-slate-700 font-semibold">{sessionId}</span>
        </p>
        <Button onClick={handleGoBack} variant="outline" className="mt-4 gap-1.5 text-xs font-medium">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <SessionAnalytics
      session={session}
      onBack={handleGoBack}
      initialTrainer={initialTrainer}
    />
  );
};

export default SessionResponses;
