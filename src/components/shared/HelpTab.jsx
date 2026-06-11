import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createTicket,
  getTicketsByUser,
} from "@/services/superadmin/ticketService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send,
  Bug,
  Megaphone,
  Lightbulb,
  HelpCircle,
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";

const CATEGORY_OPTIONS = [
  {
    value: "bug",
    label: "Bug Report",
    icon: Bug,
    description: "Something is broken or not working",
  },
  {
    value: "complaint",
    label: "Complaint",
    icon: Megaphone,
    description: "Raise a concern or dissatisfaction",
  },
  {
    value: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Suggest a new feature or improvement",
  },
  {
    value: "other",
    label: "Other",
    icon: HelpCircle,
    description: "General inquiry or other issue",
  },
];

const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    value: "high",
    label: "High",
    color: "bg-red-100 text-red-700 border-red-200",
  },
];

const STATUS_CONFIG = {
  open: {
    label: "Open",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
  },
  "in-progress": {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: Loader2,
  },
  resolved: {
    label: "Resolved",
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: CheckCircle2,
  },
};

const HelpTab = () => {
  const { user } = useAuth();
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (user?.uid) loadMyTickets();
  }, [user]);

  const loadMyTickets = async () => {
    setLoading(true);
    try {
      const data = await getTicketsByUser(user.uid);
      setMyTickets(data);
    } catch (error) {
      toast.error("Failed to load your tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !category || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      await createTicket({
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
        raisedBy: {
          uid: user.uid,
          name: user.name || "Unknown",
          email: user.email || "",
          role: user.role || "unknown",
        },
      });
      toast.success("Ticket submitted successfully!");
      // Reset form
      setSubject("");
      setCategory("");
      setPriority("medium");
      setDescription("");
      setIsTicketModalOpen(false); // Close modal
      // Reload tickets
      await loadMyTickets();
    } catch (error) {
      toast.error("Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      {/* My Tickets Section */}
      <div
        data-tour="help-tickets"
        className="rounded-xl border bg-white shadow-sm"
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Ticket className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                My Tickets
              </h3>
              <p className="text-sm text-muted-foreground">
                Track the status of your submitted tickets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">
              {myTickets.length} ticket{myTickets.length !== 1 ? "s" : ""}
            </Badge>
            <Button
              onClick={() => setIsTicketModalOpen(true)}
              className="gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" /> Create Ticket
            </Button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : myTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed rounded-xl bg-slate-50/50">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Ticket className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                No tickets raised yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-5">
                Need help or found a bug? Raise a ticket and our support team will resolve it.
              </p>
              <Button
                onClick={() => setIsTicketModalOpen(true)}
                className="gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" /> Raise Support Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {myTickets.map((ticket) => {
                const statusConf =
                  STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const StatusIcon = statusConf.icon;
                return (
                  <div
                    key={ticket.id}
                    className="rounded-lg border hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <StatusIcon
                        className={`h-4 w-4 flex-shrink-0 ${
                          ticket.status === "resolved"
                            ? "text-green-600"
                            : ticket.status === "in-progress"
                              ? "text-blue-600 animate-spin"
                              : ticket.status === "closed"
                                ? "text-gray-500"
                                : "text-yellow-600"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(ticket.createdAt)} • {ticket.category}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 ${statusConf.color}`}
                      >
                        {statusConf.label}
                      </Badge>
                    </div>
                    {ticket.adminNotes && (
                      <div className="border-t bg-muted/10 px-4 py-2.5 text-center">
                        <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                          Admin Response
                        </p>
                        <p className="text-sm text-foreground italic">
                          "{ticket.adminNotes}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Raise a Ticket Modal */}
      <Modal
        open={isTicketModalOpen}
        onOpenChange={setIsTicketModalOpen}
        className="sm:max-w-2xl p-3"
      >
        <ModalContent>
          <ModalClose onClose={() => setIsTicketModalOpen(false)} />
          <ModalHeader>
            <ModalTitle>Raise a Ticket</ModalTitle>
            <ModalDescription>
              Report a bug, request a feature, or raise a complaint
            </ModalDescription>
          </ModalHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                maxLength={120}
              />
            </div>

            {/* Category Selection - Visual Cards */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCategory(opt.value)}
                      className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-sm ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-muted/30 hover:border-muted-foreground/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon
                          className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <p
                          className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                        >
                          {opt.label}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Priority
              </label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                      priority === opt.value
                        ? `${opt.color} border-current shadow-sm`
                        : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue in detail. Include steps to reproduce if it's a bug."
                rows={4}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white resize-none"
              />
            </div>

            <ModalFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTicketModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="gap-2 px-6"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default HelpTab;
