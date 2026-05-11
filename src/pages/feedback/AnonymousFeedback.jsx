import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useParams, useLocation } from "react-router-dom";
import { getSessionById } from "@/services/superadmin/sessionService";
import { addResponse } from "@/services/superadmin/responseService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react";
import Loader from "@/components/ui/Loader";

// Generate a unique device ID for localStorage tracking
const getDeviceId = () => {
  const key = "feedback_device_id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
};

export const AnonymousFeedback = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlPhaseId = queryParams.get("ph");
  const urlVersion = queryParams.get("v");

  const [session, setSession] = useState(null);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [error, setError] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState(null);
  const [selectedTrainerName, setSelectedTrainerName] = useState("");

  // Helper: get trainers from session (backward compat)
  const getTrainers = (s) =>
    s?.assignedTrainers ||
    (s?.assignedTrainer ? [s.assignedTrainer] : []);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setIsLoading(true);
      const sessionData = await getSessionById(sessionId);

      if (!sessionData) {
        setError("Session not found");
        setIsLoading(false);
        retError("Session closed. This feedback phase has ended.");
        setIsClosed(true);
        setIsLoading(false);
        return;
      }

      // Phase Validation: Ensure link matches active phase
      if (urlPhaseId && sessionData.phaseId && urlPhaseId !== sessionData.phaseId) {
        setError("This feedback link is for an older phase. Please use the current QR code.");
        setIsClosed(true);
        setIsLoading(false);
        return;
      } else if (!urlPhaseId && urlVersion && Number(urlVersion) !== (sessionData.reactivationCount || 0)) {
         setError("This feedback link has expired. Please use the current QR code.");
         setIsClosed(true);
         setIsLoading(false);
         return;
      }

      // Check if session has expired manually set date
      if (
        sessionData.expiresAt &&
        new Date(sessionData.expiresAt) < new Date()
      ) {
        setIsClosed(true);
        setIsLoading(false);
        return;
      }

      setSession(sessionData);
      // Auto-select trainer if only one
      const trainers = sessionData.assignedTrainers ||
        (sessionData.assignedTrainer ? [sessionData.assignedTrainer] : []);
      if (trainers.length === 1) {
        setSelectedTrainerId(trainers[0].id);
        setSelectedTrainerName(trainers[0].name);
      }
      checkPreviousSubmission(sessionData);
    } catch (err) {
      console.error("Error loading session:", err);
      setError("Failed to load feedback form");
    } finally {
      setIsLoading(false);
    }
  };

  const checkPreviousSubmission = (currentSession) => {
    // [MODIFIED] Students can now submit multiple times in the same phase.
    // We disable the hard block by not setting isSubmitted=true based on localStorage.
    return;
  };

  const handleRatingChange = (index, rating) => {
    setResponses((prev) => ({
      ...prev,
      [index]: { ...prev[index], value: parseInt(rating), type: "rating" },
    }));
  };

  const handleTextChange = (index, value, type = "text") => {
    setResponses((prev) => ({
      ...prev,
      [index]: { ...prev[index], value, type },
    }));
  };

  const handleMcqChange = (index, option) => {
    setResponses((prev) => ({
      ...prev,
      [index]: { ...prev[index], value: option, type: "mcq" },
    }));
  };

  const handleMultiselectChange = (index, option) => {
    setResponses((prev) => {
      const current = Array.isArray(prev[index]?.value)
        ? [...prev[index].value]
        : [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return {
        ...prev,
        [index]: { ...prev[index], value: updated, type: "multiselect" },
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const questions = session.questions || [];

      // Validate required questions
      const requiredQuestions = questions
        .map((q, idx) => ({ ...q, idx }))
        .filter((q) => q.required);
      for (const q of requiredQuestions) {
        const val = responses[q.idx]?.value;
        if (!val || (Array.isArray(val) && val.length === 0)) {
          setError("Please answer all required questions");
          setIsSubmitting(false);
          return;
        }
      }

      // Validate trainer selection if multiple trainers
      const sessionTrainers = getTrainers(session);
      if (sessionTrainers.length > 1 && !selectedTrainerId) {
        setError("Please select the trainer you are providing feedback for");
        setIsSubmitting(false);
        return;
      }

      // Format answers array
      const answers = questions
        .map((q, index) => ({
          questionId: q.id,
          value: responses[index]?.value || null,
          type: responses[index]?.type || q.type || "rating",
        }))
        .filter((a) => a.value !== null);

      // Submit to Firebase subcollection
      const version = session.reactivationCount || 0;
      const phaseId = session.phaseId || null;
      await addResponse(sessionId, {
        deviceId: getDeviceId(),
        answers,
        version,
        phaseId,
        selectedTrainerId: selectedTrainerId || getTrainers(session)?.[0]?.id || null,
        selectedTrainerName: selectedTrainerName || getTrainers(session)?.[0]?.name || null,
      });

      // Mark as submitted in localStorage (for history/UX, not blocking anymore)
      localStorage.setItem(
        `feedback_submitted_${sessionId}_ph_${phaseId || version}_${Date.now()}`,
        JSON.stringify({
          submittedAt: new Date().toISOString(),
          deviceId: getDeviceId(),
        }),
      );

      setIsSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (isLoading) {
    return <Loader />;
  }

  // Session Closed State
  if (isClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Session Closed</h2>
              <p className="text-muted-foreground">
                This feedback session is no longer accepting responses.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error State
  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Unable to Load Form
              </h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already Submitted State
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-4">
                Your feedback has been submitted successfully.
              </p>
              <p className="text-sm text-muted-foreground">
                Your response helps improve the quality of training.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = session?.questions || [];

  const handleSeedData = async () => {
    if (!session || !session.questions) return;

    setIsSubmitting(true);
    try {
      const promises = [];
      const feedbacksToGenerate = 10;

      const comments = [
        "Great session!",
        "Very informative.",
        "Trainer was knowledgeable.",
        "Could be better.",
        "Pace was too fast.",
        "Excellent examples.",
        "Good interaction.",
        "Need more practicals.",
        "Satisfied.",
        "Average.",
      ];

      for (let i = 0; i < feedbacksToGenerate; i++) {
        const answers = session.questions.map((q) => {
          let value;
          const type = q.type || "rating";

          if (type === "rating") {
            // Weighted random to favor 4s and 5s slightly for realism
            const rand = Math.random();
            if (rand > 0.6) value = 5;
            else if (rand > 0.3) value = 4;
            else if (rand > 0.15) value = 3;
            else value = Math.floor(Math.random() * 2) + 1; // 1 or 2
          } else if (type === "mcq" && q.options) {
            value = q.options[Math.floor(Math.random() * q.options.length)];
          } else if (type === "multiselect" && q.options) {
            // Pick a random subset (at least 1)
            const shuffled = [...q.options].sort(() => 0.5 - Math.random());
            const count = Math.floor(Math.random() * shuffled.length) + 1;
            value = shuffled.slice(0, count);
          } else if (type === "topicslearned") {
            const sessionTopics = [
              "React Hooks",
              "State Management",
              "Prop Drilling",
              "Vite Setup",
              "CSS Modules",
              "Tailwind Flow",
              "Deployment",
            ];
            const count = Math.floor(Math.random() * 3) + 2;
            value = [...sessionTopics]
              .sort(() => 0.5 - Math.random())
              .slice(0, count)
              .join(", ");
          } else if (type === "futureSession") {
            const suggestions = [
              "Advanced React patterns",
              "System Design deep dive",
              "Microservices architecture",
              "Security best practices",
              "Performance optimization",
              "Automated testing",
              "CI/CD workflows",
              "Cloud native development",
            ];
            value = suggestions[Math.floor(Math.random() * suggestions.length)];
          } else {
            value = comments[Math.floor(Math.random() * comments.length)];
          }

          return {
            questionId: q.id,
            value,
            type,
          };
        });

        const deviceId = `seed_${Date.now()}_${i}`;
        const sessionTrainers = getTrainers(session);
        const randomTrainer = sessionTrainers[Math.floor(Math.random() * sessionTrainers.length)];

        // Add minimal delay to avoid write contention triggers if any
        promises.push(addResponse(sessionId, {
          deviceId,
          answers,
          selectedTrainerId: randomTrainer?.id || null,
          selectedTrainerName: randomTrainer?.name || null,
        }));
      }

      await Promise.all(promises);
      toast.success(`Seeded ${feedbacksToGenerate} responses!`);
    } catch (err) {
      console.error("Seeding failed:", err);
      toast.error("Seeding failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!session || !session.questions) return;
    setIsSubmitting(true);
    try {
      const promises = [];
      const countToSubmit = 50;

      for (let i = 1; i <= countToSubmit; i++) {
        // Determine star rating based on sequence (approx 10 of each rating)
        const ratingValue = Math.ceil(i / 10); // 1-10: 1, 11-20: 2, etc.

        const answers = session.questions.map((q) => {
          let value;
          const type = q.type || q.responseType || "rating";

          if (type === "rating" || q.responseType === "rating" || q.responseType === "both") {
            value = ratingValue > 5 ? 5 : ratingValue;
          } else if (type === "mcq" && q.options) {
            value = q.options[Math.floor(Math.random() * q.options.length)];
          } else if (type === "multiselect" && q.options) {
            const shuffled = [...q.options].sort(() => 0.5 - Math.random());
            value = shuffled.slice(0, Math.floor(Math.random() * 2) + 1);
          } else if (type === "futureSession") {
            value = `Future skills suggestion ${i}: Advanced AI workflows, LLM prompt design, production ML`;
          } else if (type === "topicslearned") {
            value = `Topics learned ${i}: model training, evaluation metrics, deployment pipelines`;
          } else {
            // "text" type or "any other feedback"
            value = `Additional feedback ${i}: session was highly informative and well paced`;
          }

          return {
            questionId: q.id,
            value,
            type,
          };
        });

        const deviceId = `bulk_${Date.now()}_${i}`;
        const version = session.reactivationCount || 0;
        const sessionTrainers = getTrainers(session);
        const randomTrainer = sessionTrainers[Math.floor(Math.random() * sessionTrainers.length)];
        promises.push(addResponse(sessionId, {
          deviceId,
          answers,
          version,
          selectedTrainerId: randomTrainer?.id || null,
          selectedTrainerName: randomTrainer?.name || null,
        }));
      }

      await Promise.all(promises);
      toast.success(`Successfully submitted ${countToSubmit} sequential responses!`);
      setIsSubmitted(true);
    } catch (err) {
      console.error("Bulk submission failed:", err);
      toast.error("Bulk submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-background to-purple-50 dark:from-background dark:via-background dark:to-background">
      {/* Bulk Submitter Button (hidden for production) */}
      {false && (
        <Button
          className="fixed bottom-4 right-4 z-50 bg-orange-600 hover:bg-orange-700 shadow-lg text-white font-bold"
          onClick={handleBulkSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "DEBUG: Submit 50 Responses"}
        </Button>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-primary shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
          <img
            src="/logo.png"
            alt="Gryphon Academy"
            className="h-12 md:h-16 w-auto object-contain"
          />
        </div>
      </nav>

      <div className="max-w-lg mx-auto py-6 px-4">
        {/* Session Info Card */}
        <Card className="mb-5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg leading-snug">
              {session?.topic}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5 text-sm">
              <div className="flex">
                <span className="text-muted-foreground w-20 flex-shrink-0">
                  College
                </span>
                <span className="font-medium">{session?.collegeName}</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-20 flex-shrink-0">
                  Trainer
                </span>
                <span className="font-medium">
                  {getTrainers(session).length > 1
                    ? getTrainers(session).map(t => t.name).join(", ")
                    : getTrainers(session)?.[0]?.name || "Not specified"}
                  {session?.domain && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {session?.domain}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-20 flex-shrink-0">
                  Batch
                </span>
                <span className="font-medium">{session?.batch}</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-20 flex-shrink-0">
                  Course
                </span>
                <span className="font-medium">{session?.course}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trainer Selector (only if multiple trainers) */}
        {getTrainers(session).length > 1 && (
          <Card className="mb-5 shadow-sm border-primary/20">
            <CardContent className="pt-6">
              <Label className="text-base font-medium mb-3 block">
                Which trainer are you providing feedback for? <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={selectedTrainerId || ""}
                onValueChange={(value) => {
                  setSelectedTrainerId(value);
                  const trainer = getTrainers(session).find(t => t.id === value);
                  setSelectedTrainerName(trainer?.name || "");
                }}
                className="space-y-2"
              >
                {getTrainers(session).map((trainer) => (
                  <label
                    key={trainer.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedTrainerId === trainer.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={trainer.id} />
                    <span className="font-medium">{trainer.name}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Required Fields Notice */}
        <p className="text-sm text-muted-foreground mb-6 flex items-center gap-1">
          <span className="text-destructive">*</span> Indicates required
          question
        </p>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-6">
            {questions.map((question, index) => (
              <Card key={question.id || index}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <Label className="text-base font-medium">
                        {index + 1}. {question.text || question.question}
                        {question.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                    </div>

                    {/* Rating Type */}
                    {(question.type === "rating" ||
                      question.responseType === "rating" ||
                      question.responseType === "both") && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Rate from 1 (Poor) to 5 (Excellent)
                        </p>
                        <RadioGroup
                          value={responses[index]?.value?.toString() || ""}
                          onValueChange={(value) =>
                            handleRatingChange(index, value)
                          }
                          className="flex gap-2"
                        >
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <label
                              key={rating}
                              className="cursor-pointer transition-transform hover:scale-110 p-1"
                            >
                              <RadioGroupItem
                                value={rating.toString()}
                                className="sr-only"
                              />
                              <Star
                                className={`h-8 w-8 transition-colors ${
                                  (responses[index]?.value || 0) >= rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground hover:text-yellow-200"
                                }`}
                              />
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {/* MCQ Type */}
                    {question.type === "mcq" && question.options && (
                      <div className="space-y-2">
                        <RadioGroup
                          value={responses[index]?.value || ""}
                          onValueChange={(value) =>
                            handleMcqChange(index, value)
                          }
                          className="space-y-2"
                        >
                          {question.options.map((option, optIndex) => (
                            <label
                              key={optIndex}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                responses[index]?.value === option
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <RadioGroupItem value={option} />
                              <span>{option}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {/* Multi-Select Type */}
                    {question.type === "multiselect" && question.options && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Select all that apply
                        </p>
                        {question.options.map((option, optIndex) => {
                          const selected =
                            Array.isArray(responses[index]?.value) &&
                            responses[index].value.includes(option);
                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() =>
                                handleMultiselectChange(index, option)
                              }
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all text-left ${
                                selected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div
                                className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                                  selected
                                    ? "border-primary bg-primary text-white"
                                    : "border-muted-foreground"
                                }`}
                              >
                                {selected && (
                                  <span className="text-[10px] leading-none">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Text Type */}
                    {(question.type === "text" ||
                      question.responseType === "text" ||
                      question.responseType === "both") && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Share your thoughts..."
                          value={responses[index]?.value || ""}
                          onChange={(e) =>
                            handleTextChange(
                              index,
                              e.target.value,
                              question.type || "text",
                            )
                          }
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Future Session Type */}
                    {question.type === "futureSession" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="What topics or skills would you like covered in future sessions?"
                          value={responses[index]?.value || ""}
                          onChange={(e) =>
                            handleTextChange(index, e.target.value, "futureSession")
                          }
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Topics Learned Type */}
                    {question.type === "topicslearned" && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Please list the topics covered today, separated by
                          commas (e.g. React Hooks, State, Effects)
                        </p>
                        <Textarea
                          placeholder="e.g. Topic 1, Topic 2, Topic 3"
                          value={responses[index]?.value || ""}
                          onChange={(e) =>
                            handleTextChange(index, e.target.value, "topicslearned")
                          }
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-center">
            <Button
              type="submit"
              size="lg"
              className="w-full max-w-md gradient-hero text-primary-foreground"
              disabled={isSubmitting || questions.length === 0}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </div>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Your response is completely anonymous
          </p>
        </form>
      </div>
    </div>
  );
};
