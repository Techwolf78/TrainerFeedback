import React, { useState, useMemo } from 'react';
import { useSuperAdminData } from '@/contexts/SuperAdminDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose
} from '@/components/ui/modal';
import { 
  Loader2, 
  Trash2, 
  RefreshCw, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertCircle,
  FileJson,
  Copy,
  Plus,
  Pencil,
  CopyPlus,
  ArrowRight
} from 'lucide-react';
import { parseProjectCode, matchCollege } from '@/services/superadmin/projectCodeService';
import ProjectCodeFormModal from './ProjectCodeFormModal';

const ProjectCodesTab = () => {
  const { 
    projectCodes, 
    colleges, 
    addProjectCodes, 
    deleteProjectCode, 
    createProjectCode,
    updateProjectCode,
    createCollege,
    rerunMatching,
    loading 
  } = useSuperAdminData();

  const [importedCodes, setImportedCodes] = useState([]); // [NEW] Stores parsed JSON array
  const [fileName, setFileName] = useState(''); // [NEW] Stores filename
  const [error, setError] = useState(''); // [NEW] Stores validation error
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false); // [NEW] Toggle modal
  
  // Manual Form State
  const [formConfig, setFormConfig] = useState({
    open: false,
    mode: 'create',
    initialData: null
  });

  // Computed Preview for Import
  const importPreview = useMemo(() => {
    if (!importedCodes.length) return [];
    
    return importedCodes.map(item => {
      let parsed;
      let isDuplicate = false;
      let rawCode = '';

      if (typeof item === 'string') {
          // Should not happen with strict validation, but safe fallback
          rawCode = item;
          parsed = parseProjectCode(item);
      } else {
          // Object input
          rawCode = item["Project Code"] || item.code || '';
          // Create a "parsed" structure from metadata if available
          if (item["Project Code"]) {
              parsed = {
                  rawCode,
                  status: 'parsed',
                  collegeCode: item["College Code"],
                  // These are just for preview matching logic
              };
          } else {
             parsed = parseProjectCode(rawCode);
          }
      }

      // Check for duplicate in DB
      isDuplicate = projectCodes.some(pc => pc.code === rawCode);
      
      const matched = matchCollege(parsed, colleges);
  
      return { 
          ...matched, 
          isDuplicate,
          // Pass original item through for processing
          originalItem: item,
          rawCode
      };
    });
  }, [importedCodes, colleges, projectCodes]);

  const validCount = importPreview.filter(p => p.status === 'parsed').length;
  const matchedCount = importPreview.filter(p => p.matchStatus === 'matched').length;
  const newCount = importPreview.filter(p => !p.isDuplicate).length;

  // Filtered List
  const filteredCodes = useMemo(() => {
    if (!searchQuery) return projectCodes;
    const lower = searchQuery.toLowerCase();
    return projectCodes.filter(pc => 
      pc.code?.toLowerCase().includes(lower) || 
      pc.collegeName?.toLowerCase().includes(lower) ||
      pc.collegeCode?.toLowerCase().includes(lower) ||
      pc.course?.toLowerCase().includes(lower)
    );
  }, [projectCodes, searchQuery]);

  // Handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!Array.isArray(json)) {
          throw new Error("File must contain a JSON array");
        }
        
        // Strict Validation: Must be array of objects with "Project Code"
        const validItems = json.filter(item => {
            return typeof item === 'object' && item !== null && item["Project Code"];
        });

        if (validItems.length === 0) {
            // Check if it was the old simple string array format to give specific error
            if (json.some(i => typeof i === 'string')) {
                throw new Error("Invalid format: Arrays of strings are no longer supported. Please use the exported JSON object format.");
            }
            throw new Error("No valid project code objects found. Each item must have a 'Project Code' field.");
        }

        if (validItems.length !== json.length) {
             // Optional: warning that some items were skipped? For now let's just use valid ones.
        }

        setImportedCodes(validItems);
      } catch (err) {
        setError(err.message || "Invalid JSON file");
        setImportedCodes([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview.length) return;
    
    setIsImporting(true);
    try {
      // Only import non-duplicates
      // Pass the ORIGINAL items (objects) so service can extract metadata
      const itemsToImport = importPreview
          .filter(p => !p.isDuplicate)
          .map(p => p.originalItem);
      
      if (itemsToImport.length === 0) {
        setImportedCodes([]);
        setFileName('');
        setShowImportModal(false);
        return;
      }

      await addProjectCodes(itemsToImport);
      setImportedCodes([]); // Clear on success
      setFileName('');
      setShowImportModal(false); // Close modal
    } catch (error) {
      // Toast handled in context
    } finally {
      setIsImporting(false);
    }
  };

  const handleRerunMatching = async () => {
    setIsRerunning(true);
    try {
      await rerunMatching();
    } finally {
      setIsRerunning(false);
    }
  };

  const handleOpenCreate = () => {
    setFormConfig({ open: true, mode: 'create', initialData: null });
  };

  const handleOpenEdit = (pc) => {
    setFormConfig({ open: true, mode: 'edit', initialData: pc });
  };

  const handleOpenDuplicate = (pc) => {
    setFormConfig({ open: true, mode: 'duplicate', initialData: pc });
  };

  const handleFormSubmit = async (data) => {
    if (formConfig.mode === 'edit') {
      await updateProjectCode(formConfig.initialData.id, data);
    } else {
      await createProjectCode(data);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this project code?")) {
        await deleteProjectCode(id);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      
      {/* Header & Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search project codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
            />
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredCodes.length} Codes
        </div>
        <Button 
            variant="outline" 
            onClick={handleRerunMatching} 
            disabled={isRerunning || loading.projectCodes}
        >
            {isRerunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Rerun Matching
        </Button>
        <Button onClick={() => setShowImportModal(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Import JSON
        </Button>
        <Button onClick={handleOpenCreate} className="gradient-hero">
            <Plus className="mr-2 h-4 w-4" /> Add Project Code
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden flex-1 bg-card">
            <div className="h-full overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary/50 backdrop-blur-sm z-10">
                        <TableRow>
                            <TableHead>Project Code</TableHead>
                            <TableHead>College</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Metadata</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCodes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No project codes found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCodes.map((pc) => (
                                <TableRow key={pc.id}>
                                    <TableCell className="font-mono text-xs font-medium">
                                        {pc.code}
                                    </TableCell>
                                    <TableCell>
                                        {pc.collegeId ? (
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                                                     {pc.collegeName}
                                                </Badge>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <AlertCircle className="h-3 w-3 text-orange-400" />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-orange-600/80">Unmatched</span>
                                                    {pc.collegeName && <span className="text-[10px] text-muted-foreground">{pc.collegeName}</span>}
                                                </div>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{pc.course}</div>
                                        <div className="text-xs text-muted-foreground">{pc.year}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-[10px]">Type: {pc.type}</Badge>
                                        <Badge variant="secondary" className="text-[10px] ml-1">{pc.academicYear}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleOpenEdit(pc)}
                                                className="h-8 w-8 text-slate-600 hover:text-primary hover:bg-primary/5"
                                                title="Edit"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleOpenDuplicate(pc)}
                                                className="h-8 w-8 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                                                title="Duplicate"
                                            >
                                                <CopyPlus className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDelete(pc.id)}
                                                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/5"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
      </div>

      {/* Import Modal */}
      <Modal open={showImportModal} onOpenChange={setShowImportModal} className="p-4">
        <ModalHeader>
           <ModalTitle>Bulk Import Project Codes</ModalTitle>
           <ModalDescription>Ask IT Dept for the project codes from Sync to import them here.</ModalDescription>
           <ModalClose onClose={() => setShowImportModal(false)} />
        </ModalHeader>

        <div className="p-4 space-y-4">
            <div className="flex flex-col gap-2">
                <Input 
                    type="file" 
                    accept=".json" 
                    onChange={handleFileChange}
                    className="cursor-pointer"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                {!error && !fileName && (
                    <p className="text-xs text-muted-foreground">
                        Format: <code>{`[ {S.no,
        Name,
        College Code,
        Course,
        Year,
        Training Type,
        Passing Year,
        Project Code
    }]`}</code>
                    </p>
                )}
            </div>

            {importPreview.length > 0 && (
                <div className="border rounded-md p-3 bg-muted/50 text-xs space-y-2 max-h-[200px] overflow-y-auto">
                    <div className="flex justify-between font-medium">
                        <span>Preview: {importPreview.length} codes</span>
                        <div className="flex gap-3">
                            <span className={matchedCount === importPreview.length ? "text-green-600" : "text-orange-600"}>
                                {matchedCount} Matched
                            </span>
                             {importPreview.length - newCount > 0 && (
                                <span className="text-red-600">
                                    {importPreview.length - newCount} Duplicates
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        {importPreview.slice(0, 10).map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                                {p.isDuplicate ? (
                                    <div className="flex items-center gap-1 text-destructive min-w-[80px]">
                                        <Copy className="h-3 w-3" />
                                        <span className="text-[10px] uppercase font-bold">Exists</span>
                                    </div>
                                ) : p.matchStatus === 'matched' ? 
                                    <CheckCircle className="h-3 w-3 text-green-500" /> : 
                                    <AlertCircle className="h-3 w-3 text-orange-500" />
                                }
                                <span className={`truncate flex-1 ${p.isDuplicate ? 'text-muted-foreground line-through' : ''}`}>
                                    {p.rawCode}
                                </span>
                                {p.collegeName && !p.isDuplicate && <span className="text-muted-foreground font-mono">{p.collegeName}</span>}
                            </div>
                        ))}
                        {importPreview.length > 10 && (
                            <div className="text-center text-muted-foreground pt-1">
                                + {importPreview.length - 10} more
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        <ModalFooter>
             <Button variant="ghost" onClick={() => setShowImportModal(false)} disabled={isImporting}>Cancel</Button>
            <Button 
                onClick={handleImport} 
                disabled={!newCount || isImporting}
                className="gradient-hero"
            >
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import {newCount > 0 && `(${newCount})`}
            </Button>
        </ModalFooter>
      </Modal>

      {/* Manual Entry Form */}
      <ProjectCodeFormModal 
        open={formConfig.open}
        onOpenChange={(open) => setFormConfig(prev => ({ ...prev, open }))}
        mode={formConfig.mode}
        initialData={formConfig.initialData}
        onSubmit={handleFormSubmit}
        colleges={colleges}
        onCreateCollege={createCollege}
      />
    </div>
  );
};

export default ProjectCodesTab;
