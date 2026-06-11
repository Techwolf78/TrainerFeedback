import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getAllTickets,
  updateTicketStatus,
  deleteTicket,
  isTicketOverdue,
  getTicketAgeDays,
} from "@/services/superadmin/ticketService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Loader from "@/components/ui/Loader";
import {
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Search,
  MessageSquarePlus,
  X,
  Bug,
  Megaphone,
  Lightbulb,
  HelpCircle,
  Filter,
  RefreshCw,
  RotateCcw,
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
import { Textarea } from "@/components/ui/textarea";

const CATEGORY_CONFIG = {
  bug: { label: "Bug Report", icon: Bug },
  complaint: { label: "Complaint", icon: Megaphone },
  feature: { label: "Feature Request", icon: Lightbulb },
  other: { label: "Other", icon: HelpCircle },
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const TicketsTab = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();

  // Get values from URL or fallback to default
  const searchQuery = searchParams.get("q") || "";
  const filters = {
    status: searchParams.get("status") || "all",
    category: searchParams.get("category") || "all",
    priority: searchParams.get("priority") || "all",
  };

  const setSearchQuery = (val) => {
    const params = new URLSearchParams(searchParams);
    if (val) {
      params.set("q", val);
    } else {
      params.delete("q");
    }
    setSearchParams(params, { replace: true });
  };

  const setFilters = (newFilters) => {
    const params = new URLSearchParams(searchParams);
    const nextFilters = typeof newFilters === "function" ? newFilters(filters) : newFilters;

    if (nextFilters.status && nextFilters.status !== "all") {
      params.set("status", nextFilters.status);
    } else {
      params.delete("status");
    }

    if (nextFilters.category && nextFilters.category !== "all") {
      params.set("category", nextFilters.category);
    } else {
      params.delete("category");
    }

    if (nextFilters.priority && nextFilters.priority !== "all") {
      params.set("priority", nextFilters.priority);
    } else {
      params.delete("priority");
    }

    setSearchParams(params, { replace: true });
  };

  // Modal State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFilters = () => {
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllTickets();
      setTickets(data);
    } catch (error) {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const openStatusModal = (ticket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setResolutionNotes(ticket.adminNotes || "");
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;

    // Validation: Admin notes are mandatory when changing status
    if (!resolutionNotes.trim()) {
      toast.error("Admin notes/comments are required to update status");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTicketStatus(
        selectedTicket.id,
        newStatus,
        resolutionNotes.trim(),
      );
      toast.success("Ticket status updated successfully");
      setIsStatusModalOpen(false);
      await loadTickets();
    } catch (error) {
      toast.error("Failed to update ticket status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ticketId) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await deleteTicket(ticketId);
      toast.success("Ticket deleted");
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch (error) {
      toast.error("Failed to delete ticket");
    }
  };

  // Sort: overdue first, then by creation date
  const sortedTickets = [...tickets].sort((a, b) => {
    const aOverdue = isTicketOverdue(a);
    const bOverdue = isTicketOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return 0;
  });

  const filteredTickets = sortedTickets.filter((t) => {
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.category !== "all" && t.category !== filters.category)
      return false;
    if (filters.priority !== "all" && t.priority !== filters.priority)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSubject = t.subject?.toLowerCase().includes(q);
      const matchName = t.raisedBy?.name?.toLowerCase().includes(q);
      const matchEmail = t.raisedBy?.email?.toLowerCase().includes(q);
      if (!matchSubject && !matchName && !matchEmail) return false;
    }
    return true;
  });

  const overdueCount = tickets.filter((t) => isTicketOverdue(t)).length;
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in-progress",
  ).length;
  const resolvedCount = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed",
  ).length;

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return <Loader fullScreen={false} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Stats Cards — Neutral, non-interactive */}

      {/* Filter Bar — Dashboard style */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={resetFilters}
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Subject, name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters({ ...filters, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select
                value={filters.category}
                onValueChange={(v) => setFilters({ ...filters, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select
                value={filters.priority}
                onValueChange={(v) => setFilters({ ...filters, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result Count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={loadTickets}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-card rounded-xl border border-dashed">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Ticket className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {searchQuery || filters.status !== "all" || filters.category !== "all" || filters.priority !== "all"
              ? "No matching tickets found"
              : "No tickets raised yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">
            {searchQuery || filters.status !== "all" || filters.category !== "all" || filters.priority !== "all"
              ? "We couldn't find any tickets that match your current search or filter configuration. Try resetting them."
              : "There are currently no support request tickets or bug reports raised in the system."}
          </p>
          {(searchQuery || filters.status !== "all" || filters.category !== "all" || filters.priority !== "all") && (
            <Button
              onClick={resetFilters}
              variant="outline"
              className="gap-2"
              size="sm"
            >
              <RotateCcw className="h-4 w-4" /> Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map((ticket) => {
            const overdue = isTicketOverdue(ticket);
            const ageDays = getTicketAgeDays(ticket);
            const catConfig =
              CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.other;
            const CatIcon = catConfig.icon;

            return (
              <div
                key={ticket.id}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-sm hover:border-primary/30"
                onClick={() => openStatusModal(ticket)}
              >
                {/* Category Icon */}
                <div className="h-9 w-9 rounded-lg border bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <CatIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Subject + Meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-foreground truncate">
                      {ticket.subject}
                    </p>
                    {overdue && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 gap-1 flex-shrink-0 border-red-300 text-red-600"
                      >
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{ticket.raisedBy?.name || "Unknown"}</span>
                    <span>•</span>
                    <span className="capitalize">
                      {ticket.raisedBy?.role || "—"}
                    </span>
                    <span>•</span>
                    <span>{formatDate(ticket.createdAt)}</span>
                    <span>•</span>
                    <span>{ageDays}d ago</span>
                  </div>
                </div>

                {/* Priority */}
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 capitalize"
                >
                  {ticket.priority || "—"}
                </Badge>

                {/* Status */}
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 capitalize"
                >
                  {STATUS_OPTIONS.find((s) => s.value === ticket.status)
                    ?.label || ticket.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket Detail + Status Update Modal */}
      <Modal
        open={isStatusModalOpen}
        onOpenChange={setIsStatusModalOpen}
        className="sm:max-w-2xl p-3"
      >
        <ModalContent>
          <ModalClose onClose={() => setIsStatusModalOpen(false)} />
          {selectedTicket &&
            (() => {
              const catConfig =
                CATEGORY_CONFIG[selectedTicket.category] ||
                CATEGORY_CONFIG.other;
              const CatIcon = catConfig.icon;
              const ageDays = getTicketAgeDays(selectedTicket);
              return (
                <>
                  <ModalHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg border bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <CatIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <ModalTitle className="truncate">
                          {selectedTicket.subject}
                        </ModalTitle>
                        <ModalDescription>
                          {selectedTicket.raisedBy?.name} •{" "}
                          {selectedTicket.raisedBy?.role} •{" "}
                          {formatDate(selectedTicket.createdAt)}
                        </ModalDescription>
                      </div>
                    </div>
                  </ModalHeader>

                  <div className="px-6 pb-6 space-y-5">
                    {/* Description */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Description
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 rounded-lg border p-3">
                        {selectedTicket.description ||
                          "No description provided."}
                      </p>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Email
                        </p>
                        <p className="text-sm truncate">
                          {selectedTicket.raisedBy?.email || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Priority
                        </p>
                        <p className="text-sm capitalize font-medium">
                          {selectedTicket.priority || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Age
                        </p>
                        <p className="text-sm font-medium">
                          {ageDays} day{ageDays !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Current Status
                        </p>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 capitalize mt-0.5"
                        >
                          {STATUS_OPTIONS.find(
                            (s) => s.value === selectedTicket.status,
                          )?.label || selectedTicket.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Existing Admin Notes */}
                    {selectedTicket.adminNotes && (
                      <div className="bg-muted/30 p-3 rounded-lg border">
                        <p className="text-xs font-semibold text-foreground mb-1">
                          Previous Admin Comments:
                        </p>
                        <p className="text-sm text-muted-foreground italic">
                          "{selectedTicket.adminNotes}"
                        </p>
                      </div>
                    )}

                    <hr className="border-border" />

                    {/* Update Status Section */}
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-foreground">
                        Update Status
                      </p>

                      <div className="space-y-2">
                        <Label>New Status</Label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Admin Comments{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          placeholder="Explain the resolution or reason for status change..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          These comments will be visible to the user who raised
                          the ticket.
                        </p>
                      </div>
                    </div>
                  </div>

                  <ModalFooter className="px-6 pb-6 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                      onClick={() => {
                        handleDelete(selectedTicket.id);
                        setIsStatusModalOpen(false);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsStatusModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateStatus}
                      disabled={isSubmitting}
                    >
                      {isSubmitting && (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Update Status
                    </Button>
                  </ModalFooter>
                </>
              );
            })()}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default TicketsTab;
