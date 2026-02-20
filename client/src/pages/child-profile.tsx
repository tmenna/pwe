import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft, Edit, Upload, Plus, FileText, Image, StickyNote,
  GraduationCap, Calendar, User, MapPin, BookOpen, Clock, Trash2, Camera, Check, X, Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "./dashboard";
import type { Child, Document, TimelineEntry } from "@shared/schema";

function DocumentIcon({ type }: { type: string }) {
  switch (type) {
    case "education": return <GraduationCap className="h-4 w-4" />;
    case "case_notes": return <StickyNote className="h-4 w-4" />;
    case "photos": return <Image className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function InlineEditableText({
  value,
  onSave,
  canEdit,
  placeholder,
  testIdPrefix,
}: {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  canEdit: boolean;
  placeholder?: string;
  testIdPrefix: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-1 flex items-start gap-2">
        <Textarea
          className="min-h-[60px] text-sm"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          data-testid={`${testIdPrefix}-input`}
        />
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={saving} data-testid={`${testIdPrefix}-save`}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(false); setText(value); }} data-testid={`${testIdPrefix}-cancel`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <span className="group/desc inline-flex items-center gap-1">
      <span className="text-sm text-muted-foreground">{value || <span className="italic">{placeholder || "No description"}</span>}</span>
      {canEdit && (
        <button
          className="inline-flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover/desc:opacity-100"
          onClick={() => { setText(value); setEditing(true); }}
          data-testid={`${testIdPrefix}-edit`}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </span>
  );
}

function TimelineIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    milestone: "bg-emerald-500",
    document: "bg-primary",
    status_change: "bg-amber-500",
    note: "bg-violet-500",
    manual: "bg-muted-foreground",
  };
  return <div className={`h-2.5 w-2.5 rounded-full ${colors[type] || "bg-primary"}`} />;
}

function UploadDocumentDialog({ childId, onClose }: { childId: number; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file || !docType) throw new Error("File and document type are required");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);
      formData.append("description", description);
      const res = await fetch(`/api/children/${childId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", String(childId), "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children", String(childId), "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline/recent"] });
      toast({ title: "Document uploaded", description: "The document has been added to this child's profile." });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Document Type</Label>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="mt-1.5" data-testid="select-doc-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="education">Education</SelectItem>
            <SelectItem value="report_cards">Report Cards</SelectItem>
            <SelectItem value="attendance">Attendance Records</SelectItem>
            <SelectItem value="case_notes">Case Notes</SelectItem>
            <SelectItem value="social_worker_notes">Social Worker Notes</SelectItem>
            <SelectItem value="follow_up_reports">Follow-up Reports</SelectItem>
            <SelectItem value="photos">Photos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>File</Label>
        <Input
          type="file"
          className="mt-1.5"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-file-upload"
        />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea
          className="mt-1.5"
          placeholder="Brief description of the document"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="input-doc-description"
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-upload">Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !file || !docType} data-testid="button-confirm-upload">
          {mutation.isPending ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </div>
  );
}

function AddTimelineDialog({ childId, onClose }: { childId: number; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState("milestone");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/children/${childId}/timeline`, { title, description, entryType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", String(childId), "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline/recent"] });
      toast({ title: "Timeline entry added" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Entry Type</Label>
        <Select value={entryType} onValueChange={setEntryType}>
          <SelectTrigger className="mt-1.5" data-testid="select-timeline-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="milestone">Milestone</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="status_change">Status Change</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Title</Label>
        <Input className="mt-1.5" placeholder="e.g. Completed literacy milestone" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-timeline-title" />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea className="mt-1.5" placeholder="Additional details" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-timeline-description" />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title} data-testid="button-confirm-timeline">
          {mutation.isPending ? "Adding..." : "Add Entry"}
        </Button>
      </div>
    </div>
  );
}

function InlineDescription({ child, canEdit }: { child: Child; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(child.description || "");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/children/${child.id}`, { description: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", String(child.id)] });
      toast({ title: "Description updated" });
      setEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (editing) {
    return (
      <div className="mt-4">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a description for this child..."
          data-testid="input-inline-description"
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-description">
            <Check className="mr-1 h-3 w-3" />
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(child.description || ""); }} data-testid="button-cancel-description">
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Description</Label>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditing(true)} data-testid="button-edit-description">
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="text-child-description">
        {child.description || <span className="italic">No description added yet</span>}
      </p>
    </div>
  );
}

export default function ChildProfile() {
  const [, params] = useRoute("/children/:id");
  const [, navigate] = useLocation();
  const childId = params?.id;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const canEdit = user?.role !== "read_only";

  const { data: child, isLoading } = useQuery<Child>({
    queryKey: ["/api/children", childId],
    enabled: !!childId,
  });

  const { data: documents, isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["/api/children", childId, "documents"],
    enabled: !!childId,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["/api/children", childId, "timeline"],
    enabled: !!childId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      return apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/children/${childId}/photo`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId] });
      toast({ title: "Photo updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Photo upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) photoMutation.mutate(file);
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <User className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Child not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/children")}>
          Back to Children
        </Button>
      </div>
    );
  }

  const initials = child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2);

  const infoItems = [
    { icon: Calendar, label: "Age", value: `${child.age} years old` },
    { icon: User, label: "Gender", value: child.gender },
    { icon: MapPin, label: "Location", value: child.location },
    { icon: BookOpen, label: "Program", value: child.programEnrollment },
    { icon: User, label: "Case Worker", value: child.assignedCaseWorker },
    { icon: User, label: "Sponsor(s)", value: child.assignedSponsors || "None assigned" },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/children")} data-testid="button-back-profile">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Children
        </Button>

        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="group relative">
                <Avatar className="h-12 w-12 sm:h-16 sm:w-16" data-testid="img-child-photo">
                  <AvatarImage src={child.photoUrl || undefined} alt={child.fullName} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                {canEdit && (
                  <button
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => photoInputRef.current?.click()}
                    data-testid="button-upload-photo"
                  >
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  data-testid="input-photo-upload"
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-bold" data-testid="text-child-name">{child.fullName}</h1>
                  <StatusBadge status={child.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground" data-testid="text-child-id">ID: {child.childId}</p>
              </div>
            </div>
            {canEdit && (
              <Button variant="outline" asChild data-testid="button-edit-child">
                <Link href={`/children/${child.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
          </div>

          <InlineDescription child={child} canEdit={canEdit} />

          <Separator className="my-5" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium capitalize">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Tabs defaultValue="documents" className="mt-6">
          <TabsList data-testid="tabs-profile">
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              <Clock className="mr-2 h-4 w-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold">Documents</h2>
              {canEdit && (
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-upload-document">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                    </DialogHeader>
                    <UploadDocumentDialog childId={child.id} onClose={() => setUploadOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {docsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !documents?.length ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setUploadOpen(true)}>
                  Upload First Document
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <Card key={doc.id} className="flex items-center gap-4 p-4" data-testid={`doc-item-${doc.id}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <DocumentIcon type={doc.documentType} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">{doc.fileName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="border-0 bg-muted capitalize text-xs">{doc.documentType.replace("_", " ")}</Badge>
                        <span>&middot; {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}</span>
                        <span>&middot; by {doc.uploadedBy}</span>
                      </div>
                      <div className="mt-1">
                        <InlineEditableText
                          value={doc.description || ""}
                          canEdit={canEdit}
                          placeholder="Add description..."
                          testIdPrefix={`doc-desc-${doc.id}`}
                          onSave={async (newDesc) => {
                            await apiRequest("PATCH", `/api/documents/${doc.id}`, { description: newDesc });
                            queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "documents"] });
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-view-doc-${doc.id}`}>
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                      {canEdit && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-doc-${doc.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                You're about to remove <strong>{doc.fileName}</strong>. This action cannot be undone. Are you sure you'd like to proceed?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid={`button-cancel-delete-${doc.id}`}>Keep it</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(doc.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid={`button-confirm-delete-${doc.id}`}
                              >
                                Yes, delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold">Progress Timeline</h2>
              {canEdit && (
                <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-timeline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Timeline Entry</DialogTitle>
                    </DialogHeader>
                    <AddTimelineDialog childId={child.id} onClose={() => setTimelineOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {timelineLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !timeline?.length ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No timeline entries yet</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setTimelineOpen(true)}>
                  Add First Entry
                </Button>
              </Card>
            ) : (
              <div className="space-y-1">
                {timeline.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4" data-testid={`timeline-item-${entry.id}`}>
                    <div className="flex flex-col items-center pt-2">
                      <TimelineIcon type={entry.entryType} />
                      {index < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                    </div>
                    <Card className="mb-3 flex-1 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{entry.title}</p>
                          <div className="mt-1">
                            <InlineEditableText
                              value={entry.description || ""}
                              canEdit={canEdit}
                              placeholder="Add description..."
                              testIdPrefix={`timeline-desc-${entry.id}`}
                              onSave={async (newDesc) => {
                                await apiRequest("PATCH", `/api/timeline/${entry.id}`, { description: newDesc });
                                queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "timeline"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/timeline/recent"] });
                              }}
                            />
                          </div>
                        </div>
                        <Badge variant="outline" className="border-0 bg-muted capitalize text-xs">
                          {entry.entryType.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
                        <span>by {entry.createdBy}</span>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
