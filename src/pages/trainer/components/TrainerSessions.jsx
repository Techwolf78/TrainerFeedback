import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from '@/components/ui/modal';
import { 
  Share2,
  BarChart3,
  Pencil,
  PlayCircle,
  Loader2,
  MoreHorizontal,
  Power,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import { FiCheckSquare } from "react-icons/fi";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import SessionAnalytics from '@/pages/superadmin/components/SessionAnalytics';
import { ShareSessionModal } from '@/components/shared/ShareSessionModal';

const TrainerSessions = ({ sessions, loading, onEdit, onRefresh, projectCodes = [] }) => {
  const { user } = useAuth();
  
  // UI State
  const [selectedSession, setSelectedSession] = useState(null); // For Analytics

  // Filters State
  const [filters, setFilters] = useState({
    collegeId: 'all',
    course: 'all',
    year: 'all',
    department: 'all',
    batch: 'all',
    domain: 'all',
    topic: '',
    projectCode: 'all'
  });
  
  // Export State
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [sessionToExport, setSessionToExport] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Share Session Modal
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sessionToShare, setSessionToShare] = useState(null);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.collegeId !== 'all') count++;
    if (filters.course !== 'all') count++;
    if (filters.year !== 'all') count++;
    if (filters.department !== 'all') count++;
    if (filters.batch !== 'all') count++;
    if (filters.domain !== 'all') count++;
    if (filters.projectCode !== 'all') count++;
    return count;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      collegeId: 'all',
      course: 'all',
      year: 'all',
      department: 'all',
      batch: 'all',
      domain: 'all',
      topic: '',
      projectCode: 'all'
    });
  };

  // Session Stats
  const sessionStats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter(s => s.status === 'active').length;
    const inactive = sessions.filter(s => s.status === 'inactive').length;
    return { total, active, inactive };
  }, [sessions]);

  // Derived Filter Options (Cascading)
  const filterOptions = useMemo(() => {
    // 1. Colleges
    const map = new Map();
    sessions.forEach(s => {
      if (s.collegeId && s.collegeName) map.set(s.collegeId, s.collegeName);
    });
    const colleges = Array.from(map, ([id, name]) => ({ id, name }));

    // 2. Courses (Dependent on College)
    let courseSessions = sessions;
    if (filters.collegeId !== 'all') {
        courseSessions = courseSessions.filter(s => s.collegeId === filters.collegeId);
    }
    const courses = [...new Set(courseSessions.map(s => s.course).filter(Boolean))].sort();

    // 3. Years (Dependent on College AND Course)
    let yearSessions = courseSessions;
    if (filters.course !== 'all') {
        yearSessions = yearSessions.filter(s => s.course === filters.course);
    }
    const years = [...new Set(yearSessions.map(s => s.year).filter(Boolean))].sort();

    // 4. Departments (Dependent on College AND Course AND Year)
    let deptSessions = yearSessions;
    if (filters.year !== 'all') {
        deptSessions = deptSessions.filter(s => s.year === filters.year);
    }
    const departments = [...new Set(deptSessions.map(s => s.branch || s.department).filter(Boolean))].sort();

    // 5. Batches (Dependent on College AND Course AND Year AND Dept)
    let batchSessions = deptSessions;
    if (filters.department !== 'all') {
        batchSessions = batchSessions.filter(s => (s.branch || s.department) === filters.department);
    }
    const batches = [...new Set(batchSessions.map(s => s.batch).filter(Boolean))].sort();

    // Domains (Dependent on College) - Keep independent of academic hierarchy for now? 
    // Usually domains cross-cut. Let's filter by only College to keep it simple but relevant.
    const domains = [...new Set(courseSessions.map(s => s.domain).filter(Boolean))].sort();

    // Project Codes (Dependent on College)
    const projectCodes = [...new Set(courseSessions.map(s => s.projectCode).filter(Boolean))].sort();

    return { colleges, courses, years, departments, batches, domains, projectCodes };
  }, [sessions, filters.collegeId, filters.course, filters.year, filters.department]);

  // Filter Logic
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Dropdown filters
      if (filters.collegeId !== 'all' && session.collegeId !== filters.collegeId) return false;
      if (filters.course !== 'all' && session.course !== filters.course) return false;
      if (filters.year !== 'all' && session.year !== filters.year) return false;
      if (filters.department !== 'all' && (session.branch || session.department) !== filters.department) return false;
      if (filters.batch !== 'all' && session.batch !== filters.batch) return false;
      
      if (filters.domain !== 'all' && session.domain !== filters.domain) return false;
      if (filters.projectCode !== 'all' && session.projectCode !== filters.projectCode) return false;
      // Topic search
      if (filters.topic && !session.topic.toLowerCase().includes(filters.topic.toLowerCase())) return false;

      return true;
    }).sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));
  }, [sessions, filters]);

  // Actions
  const openShareModal = (session) => {
    setSessionToShare(session);
    setShareDialogOpen(true);
  };



  const handleExportResponses = (session) => {
    setSessionToExport(session);
    setExportDialogOpen(true);
  };

  const confirmExport = async () => {
    const session = sessionToExport;
    if (!session) return;

    try {
      const stats = session.compiledStats;
      if (!stats) {
        toast.error('No compiled stats available');
        return;
      }

      toast.loading('Generating Excel report...');

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Gryphon Academy';
      workbook.created = new Date();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Field', key: 'field', width: 25 },
        { header: 'Value', key: 'value', width: 40 }
      ];
      summarySheet.addRows([
        { field: 'Session Topic', value: session.topic },
        { field: 'Course', value: session.course },
        { field: 'Batch', value: session.batch },
        { field: 'Session Date', value: session.sessionDate },
        { field: 'Total Responses', value: stats.totalResponses },
        { field: 'Average Rating', value: stats.avgRating }
      ]);
      
      // Rating Distribution Sheet
      const ratingSheet = workbook.addWorksheet('Rating Distribution');
      ratingSheet.columns = [
        { header: 'Rating', key: 'rating', width: 15 },
        { header: 'Count', key: 'count', width: 15 }
      ];
      Object.entries(stats.ratingDistribution || {}).forEach(([rating, count]) => {
        ratingSheet.addRow({ rating: `${rating} Star`, count: count });
      });

      // Comments Sheet
      const commentsSheet = workbook.addWorksheet('Comments');
      commentsSheet.columns = [
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Comment', key: 'comment', width: 60 },
        { header: 'Avg Rating', key: 'avgRating', width: 15 }
      ];
      (stats.topComments || []).forEach(c => commentsSheet.addRow({ category: 'Top Rated', comment: c.text, avgRating: c.avgRating }));
      (stats.avgComments || []).forEach(c => commentsSheet.addRow({ category: 'Average', comment: c.text, avgRating: c.avgRating }));
      (stats.leastRatedComments || []).forEach(c => commentsSheet.addRow({ category: 'Least Rated', comment: c.text, avgRating: c.avgRating }));

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `feedback_${session.topic.replace(/[^a-z0-9]/gi, '_')}_${session.sessionDate}.xlsx`);

      toast.dismiss();
      toast.success('Excel report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.dismiss();
      toast.error('Failed to export report');
    } finally {
      setExportDialogOpen(false);
      setSessionToExport(null);
    }
  };

  if (selectedSession) {
    return <SessionAnalytics session={selectedSession} onBack={() => setSelectedSession(null)} />;
  }

  return (
    <div className="space-y-6">
      
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="flex items-center gap-4 p-4 bg-card border rounded-xl shadow-sm">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">{sessionStats.total}</p>
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 p-4 bg-card border rounded-xl shadow-sm">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">{sessionStats.active}</p>
            <p className="text-sm text-muted-foreground">Active Sessions</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 p-4 bg-card border rounded-xl shadow-sm">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <FiCheckSquare className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">{sessionStats.inactive}</p>
            <p className="text-sm text-muted-foreground">Completed Sessions</p>
          </div>
        </div>
      </div>

      <ShareSessionModal
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        session={sessionToShare}
      />

      {/* Filters Bar - Mobile (Collapsible) */}
      <div className="block sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant={filtersOpen ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 h-5 w-5 rounded-full bg-primary-foreground text-primary text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <div className="flex-1">
            <Input
              placeholder="Search topic..."
              value={filters.topic}
              onChange={e => setFilters({ ...filters, topic: e.target.value })}
              className="h-9"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Collapsible Panel content for Mobile */}
        {filtersOpen && (
          <div className="bg-muted/20 p-3 rounded-lg border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
             <div className="space-y-3">
                <Select value={filters.collegeId} onValueChange={v => setFilters({ ...filters, collegeId: v, course: 'all', year: 'all', department: 'all', batch: 'all' })}>
                  <SelectTrigger><SelectValue placeholder="All Colleges" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Colleges</SelectItem>
                    {filterOptions.colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filters.course} onValueChange={v => setFilters({ ...filters, course: v, year: 'all', department: 'all', batch: 'all' })}>
                  <SelectTrigger><SelectValue placeholder="All Courses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {filterOptions.courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filters.year} onValueChange={v => setFilters({ ...filters, year: v, department: 'all', batch: 'all' })} disabled={filters.course === 'all'}>
                  <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {filterOptions.years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filters.department} onValueChange={v => setFilters({ ...filters, department: v, batch: 'all' })} disabled={filters.year === 'all'}>
                  <SelectTrigger><SelectValue placeholder="All Depts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depts</SelectItem>
                    {filterOptions.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filters.batch} onValueChange={v => setFilters({ ...filters, batch: v })} disabled={filters.department === 'all'}>
                  <SelectTrigger><SelectValue placeholder="All Batches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {filterOptions.batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                <Select value={filters.domain} onValueChange={v => setFilters({ ...filters, domain: v })}>
                  <SelectTrigger><SelectValue placeholder="All Domains" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    {filterOptions.domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filters.projectCode} onValueChange={v => setFilters({ ...filters, projectCode: v })}>
                  <SelectTrigger><SelectValue placeholder="All Project Codes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Project Codes</SelectItem>
                    {filterOptions.projectCodes.map(pc => <SelectItem key={pc} value={pc}>{pc}</SelectItem>)}
                  </SelectContent>
                </Select>
             </div>
          </div>
        )}
      </div>

      {/* Filters Bar - Desktop (Always Visible Grid) */}
      <div className="hidden sm:block bg-muted/20 p-4 rounded-lg border space-y-4">
        {/* Row 1: Academic Filters */}
        <div className="grid grid-cols-5 gap-3">
             <Select value={filters.collegeId} onValueChange={v => setFilters({ ...filters, collegeId: v, course: 'all', year: 'all', department: 'all', batch: 'all' })}>
            <SelectTrigger><SelectValue placeholder="All Colleges" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Colleges</SelectItem>
                {filterOptions.colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
            </Select>

            <Select value={filters.course} onValueChange={v => setFilters({ ...filters, course: v, year: 'all', department: 'all', batch: 'all' })}>
            <SelectTrigger><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {filterOptions.courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
            </Select>

            <Select value={filters.year} onValueChange={v => setFilters({ ...filters, year: v, department: 'all', batch: 'all' })} disabled={filters.course === 'all'}>
            <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {filterOptions.years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
            </Select>

             <Select value={filters.department} onValueChange={v => setFilters({ ...filters, department: v, batch: 'all' })} disabled={filters.year === 'all'}>
            <SelectTrigger><SelectValue placeholder="All Depts" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {filterOptions.departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
            </Select>

             <Select value={filters.batch} onValueChange={v => setFilters({ ...filters, batch: v })} disabled={filters.department === 'all'}>
            <SelectTrigger><SelectValue placeholder="All Batches" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {filterOptions.batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
            </Select>
        </div>

        {/* Row 2: Other Filters & Search */}
        <div className="grid grid-cols-3 gap-3">
             <Select value={filters.domain} onValueChange={v => setFilters({ ...filters, domain: v })}>
            <SelectTrigger><SelectValue placeholder="All Domains" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {filterOptions.domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
            </Select>

            <Select value={filters.projectCode} onValueChange={v => setFilters({ ...filters, projectCode: v })}>
                <SelectTrigger><SelectValue placeholder="All Project Codes" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Project Codes</SelectItem>
                    {filterOptions.projectCodes.map(pc => <SelectItem key={pc} value={pc}>{pc}</SelectItem>)}
                </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                placeholder="Search Topic..."
                value={filters.topic}
                onChange={e => setFilters({ ...filters, topic: e.target.value })}
                className="flex-1"
              />
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset Filters">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
        </div>
      </div>

      {/* Mobile Card View (Visible only on mobile) */}
      <div className="block sm:hidden space-y-4">
        {loading ? (
             <div className="h-24 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filteredSessions.length === 0 ? (
             <div className="text-center p-8 text-muted-foreground">No sessions found.</div>
        ) : (
             filteredSessions.map((session) => (
              <div key={session.id} className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-foreground">{session.topic}</h3>
                    <p className="text-xs text-muted-foreground">{session.domain}</p>
                  </div>
                   <Badge variant="outline" className={cn("capitalize", session.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200")}>
                      {session.status === 'active' ? 'Current Phase Open' : 'Phase Closed'}
                   </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                   <p>{session.course} • {session.branch}</p>
                   <p>Year {session.year} • Batch {session.batch}</p>
                   <p className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" /> 
                      {session.sessionDate ? format(new Date(session.sessionDate), 'MMM d, yyyy') : '-'}
                   </p>
                </div>

                <div className="pt-3 border-t flex items-center justify-between gap-2">
                   <Button variant="outline" size="sm" className="flex-1" onClick={() => openShareModal(session)}>
                      <Share2 className="h-3.5 w-3.5 mr-1" /> Share
                   </Button>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedSession(session)}>
                          <BarChart3 className="mr-2 h-4 w-4" /> View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportResponses(session)}>
                          <Download className="mr-2 h-4 w-4" /> Export Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>
              </div>
             ))
        )}
      </div>

      {/* Desktop Table View (Hidden on mobile) */}
      <div className="hidden sm:block border rounded-lg overflow-x-auto bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic / Domain</TableHead>
              <TableHead>Course / Batch</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredSessions.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No sessions found.</TableCell></TableRow>
            ) : (
              filteredSessions.map((session) => (
                <TableRow key={session.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="font-medium text-foreground">{session.topic}</div>
                    <div className="text-xs text-muted-foreground">{session.domain}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{session.course} - {session.branch}</div>
                    <div className="text-xs text-muted-foreground">Year {session.year} • Batch {session.batch}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{session.sessionDate ? format(new Date(session.sessionDate), 'MMM d, yyyy') : '-'}</div>
                    <div className="text-xs text-muted-foreground">{session.sessionTime}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={cn("capitalize font-medium w-fit", 
                        session.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200")}>
                        {session.status === 'active' ? 'Current Phase Open' : 'Phase Closed'}
                      </Badge>
                      {session.status === 'active' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium px-1">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          {session.responseCount || 0} responses
                        </div>
                      )}
                      {session.status === 'inactive' && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          {session.compiledStats?.totalResponses || 0} total
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openShareModal(session)}>
                          <Share2 className="mr-2 h-4 w-4" /> Share Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedSession(session)}>
                          <BarChart3 className="mr-2 h-4 w-4" /> View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportResponses(session)}>
                          <Download className="mr-2 h-4 w-4" /> Export to Excel
                        </DropdownMenuItem>
                        
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Export Confirmation Dialog */}
      <Modal open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <div className="p-6">
          <ModalHeader>
             <ModalTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Feedback Report
            </ModalTitle>
            <ModalDescription className="space-y-2 mt-2">
              <p>You are about to export feedback data for:</p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium text-foreground">{sessionToExport?.topic}</p>
                <p>{sessionToExport?.course} • {sessionToExport?.sessionDate}</p>
              </div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-lg mt-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  This report contains <strong>{sessionToExport?.compiledStats?.totalResponses || 0}</strong> responses.
                </p>
              </div>
            </ModalDescription>
          </ModalHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmExport} className="gradient-hero text-primary-foreground">
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default TrainerSessions;
