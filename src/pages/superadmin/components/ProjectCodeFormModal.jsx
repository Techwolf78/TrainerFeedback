import React, { useState, useEffect, useMemo } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalTitle, 
  ModalDescription, 
  ModalFooter, 
  ModalClose 
} from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Search, 
  Plus, 
  AlertCircle,
  CheckCircle2,
  Building2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COURSES = ['ENGG', 'MBA', 'MCA', 'MSC', 'CLDP', 'BBA', 'B.Tech', 'B.E.'];
const YEARS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];
const TRAINING_TYPES = ['OT', 'TP'];
const PASSING_YEARS = (() => {
  const years = [];
  const currentYear = new Date().getFullYear();
  // Start from currentYear - 1 to currentYear + 5
  for (let i = -1; i <= 5; i++) {
    const year = currentYear + i;
    years.push(`${year}-${year + 1}`);
  }
  return years;
})();

const ProjectCodeFormModal = ({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialData = null, 
  mode = 'create', // 'create', 'edit', 'duplicate'
  colleges = [],
  onCreateCollege
}) => {
  const [formData, setFormData] = useState({
    code: '',
    collegeId: '',
    collegeName: '',
    collegeCode: '',
    course: '',
    year: '',
    type: '',
    academicYear: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef(null);
  const [isAddingCollege, setIsAddingCollege] = useState(false);
  const [newCollege, setNewCollege] = useState({ name: '', code: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCollege, setIsCreatingCollege] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        code: mode === 'duplicate' ? '' : (initialData.code || ''),
        collegeId: initialData.collegeId || '',
        collegeName: initialData.collegeName || '',
        collegeCode: initialData.collegeCode || '',
        course: initialData.course || '',
        year: initialData.year || '',
        type: initialData.type || '',
        academicYear: initialData.academicYear || ''
      });
    } else {
      setFormData({
        code: '',
        collegeId: '',
        collegeName: '',
        collegeCode: '',
        course: '',
        year: '',
        type: '',
        academicYear: ''
      });
    }
    setSearchQuery('');
    setIsAddingCollege(false);
    setNewCollege({ name: '', code: '' });
  }, [initialData, mode, open]);

  // Focus persistence for search input
  useEffect(() => {
    if (searchInputRef.current && open) {
      searchInputRef.current.focus();
    }
  }, [searchQuery, open]);

  const filteredColleges = useMemo(() => {
    if (!searchQuery) return colleges;
    const lower = searchQuery.toLowerCase();
    return colleges.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      c.code.toLowerCase().includes(lower)
    );
  }, [colleges, searchQuery]);

  const handleCollegeSelect = (collegeId) => {
    if (collegeId === 'add_new') {
      setIsAddingCollege(true);
      return;
    }
    const college = colleges.find(c => c.id === collegeId);
    if (college) {
      setFormData(prev => ({
        ...prev,
        collegeId: college.id,
        collegeName: college.name,
        collegeCode: college.code
      }));
    }
  };

  const handleCreateCollege = async () => {
    if (!newCollege.name || !newCollege.code) {
      toast.error("Please enter both college name and code");
      return;
    }
    setIsCreatingCollege(true);
    try {
      const created = await onCreateCollege({
        name: newCollege.name.trim(),
        code: newCollege.code.trim().toUpperCase()
      });
      if (created) {
        setFormData(prev => ({
          ...prev,
          collegeId: created.id,
          collegeName: created.name,
          collegeCode: created.code
        }));
        setIsAddingCollege(false);
        setNewCollege({ name: '', code: '' });
      }
    } catch (error) {
      // toast handled in context
    } finally {
      setIsCreatingCollege(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.code || !formData.collegeId || !formData.course || !formData.year || !formData.type || !formData.academicYear) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Prefix warning
    const prefix = formData.code.split('/')[0]?.toUpperCase();
    if (prefix && prefix !== formData.collegeCode.toUpperCase()) {
      const confirmProceed = window.confirm(`Warning: The project code prefix "${prefix}" does not match the selected college code "${formData.collegeCode}". Continue anyway?`);
      if (!confirmProceed) return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      // toast handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'edit' ? 'Edit Project Code' : mode === 'duplicate' ? 'Duplicate Project Code' : 'Add Project Code';

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-[550px] p-8">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalDescription>
            Enter the project code and details exactly as provided by the external system.
          </ModalDescription>
          <ModalClose onClose={() => onOpenChange(false)} />
        </ModalHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Project Code */}
          <div className="space-y-2">
            <Label htmlFor="code" className="flex justify-between">
              Project Code <span className="text-destructive">*</span>
            </Label>
            <Input 
              id="code"
              placeholder="e.g. ICCS/MSC/1st/TP/25-27"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              required
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Enter exactly as provided. Do not include spaces unless present in the source.
            </p>
          </div>

          {/* College Selection */}
          <div className="space-y-2">
            <Label>College <span className="text-destructive">*</span></Label>
            {!isAddingCollege ? (
              <Select value={formData.collegeId} onValueChange={handleCollegeSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a college" />
                </SelectTrigger>
                <SelectContent>
                  <div 
                    className="p-2 sticky top-0 bg-white z-10 border-b"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center px-2 py-1 bg-muted rounded-md">
                      <Search className="h-3.5 w-3.5 text-muted-foreground mr-2" />
                      <input 
                        ref={searchInputRef}
                        className="bg-transparent border-none outline-none text-xs w-full py-1"
                        placeholder="Search colleges..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === ' ') e.stopPropagation();
                        }}
                        autoFocus
                      />
                    </div>
                  </div>
                  <SelectItem value="add_new" className="text-primary font-medium">
                    <div className="flex items-center">
                      <Plus className="h-3 w-3 mr-2" />
                      Add New College
                    </div>
                  </SelectItem>
                  {filteredColleges.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{c.code}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-3 relative animate-in fade-in slide-in-from-top-2 duration-200">
                <button 
                  type="button"
                  onClick={() => setIsAddingCollege(false)}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">New College Details</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">College Name</Label>
                    <Input 
                      placeholder="e.g. SIT"
                      className="h-8 text-xs"
                      value={newCollege.name}
                      onChange={(e) => setNewCollege(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">College Code</Label>
                    <Input 
                      placeholder="e.g. SIT"
                      className="h-8 text-xs uppercase"
                      value={newCollege.code}
                      onChange={(e) => setNewCollege(prev => ({ ...prev, code: e.target.value }))}
                    />
                  </div>
                </div>
                <Button 
                  type="button" 
                  size="sm" 
                  className="w-full h-8 text-xs"
                  onClick={handleCreateCollege}
                  disabled={isCreatingCollege}
                >
                  {isCreatingCollege ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                  Save College
                </Button>
              </div>
            )}
            {formData.collegeId && !isAddingCollege && (
              <div className="flex items-center gap-2 mt-1 px-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-[10px] font-medium text-green-600">Selected: {formData.collegeName} ({formData.collegeCode})</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Course */}
            <div className="space-y-2">
              <Label>Course <span className="text-destructive">*</span></Label>
              <Select 
                value={COURSES.includes(formData.course) ? formData.course : 'custom'} 
                onValueChange={(v) => {
                  if (v !== 'custom') setFormData(prev => ({ ...prev, course: v }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Course" />
                </SelectTrigger>
                <SelectContent>
                  {COURSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {(!COURSES.includes(formData.course) || formData.course === 'custom') && (
                <Input 
                  placeholder="Enter custom course"
                  className="mt-2 h-8 text-xs"
                  value={formData.course === 'custom' ? '' : formData.course}
                  onChange={(e) => setFormData(prev => ({ ...prev, course: e.target.value.toUpperCase() }))}
                />
              )}
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label>Year <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.year} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, year: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Training Type */}
            <div className="space-y-2">
              <Label>Training Type <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Passing Year */}
            <div className="space-y-2">
              <Label>Passing Year <span className="text-destructive">*</span></Label>
              <Select 
                value={formData.academicYear} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, academicYear: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {PASSING_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>

        <ModalFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="gradient-hero"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                Saving...
              </>
            ) : (
              mode === 'edit' ? 'Update Code' : 'Save Project Code'
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ProjectCodeFormModal;
