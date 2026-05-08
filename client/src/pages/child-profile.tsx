import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft, Edit, Upload, Plus, FileText, Image, StickyNote,
  GraduationCap, Calendar, User, MapPin, BookOpen, Clock, Trash2, Camera, Check, X, Pencil,
  Milestone, MessageSquare, RefreshCw, Heart, Mail, Send, MoreHorizontal, Building2, MessageCircle,
  ThumbsUp, CornerDownRight, Reply, Archive, ArchiveRestore,
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
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { StatusBadge } from "./dashboard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Child, Document, TimelineEntry, Message, Organization } from "@shared/schema";

type SafeUser = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

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
          className="min-h-[60px] text-sm rounded-lg border-border/60"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          data-testid={`${testIdPrefix}-input`}
        />
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={handleSave} disabled={saving} data-testid={`${testIdPrefix}-save`}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => { setEditing(false); setText(value); }} data-testid={`${testIdPrefix}-cancel`}>
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
          className="inline-flex h-5 w-5 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted group-hover/desc:opacity-100"
          onClick={() => { setText(value); setEditing(true); }}
          data-testid={`${testIdPrefix}-edit`}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </span>
  );
}

const timelineColors: Record<string, { bg: string; icon: string }> = {
  milestone: { bg: "bg-emerald-500/10", icon: "text-emerald-600" },
  document: { bg: "bg-blue-500/10", icon: "text-blue-500" },
  status_change: { bg: "bg-amber-500/10", icon: "text-amber-500" },
  note: { bg: "bg-violet-500/10", icon: "text-violet-500" },
  manual: { bg: "bg-slate-500/10", icon: "text-slate-500" },
};

function TimelineIcon({ type }: { type: string }) {
  const color = timelineColors[type] || timelineColors.manual;
  const icons: Record<string, any> = {
    milestone: Milestone,
    document: FileText,
    status_change: RefreshCw,
    note: MessageSquare,
    manual: Clock,
  };
  const Icon = icons[type] || Clock;
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color.bg}`}>
      <Icon className={`h-3.5 w-3.5 ${color.icon}`} />
    </div>
  );
}

function UploadDocumentDialog({ childId, onClose, photoOnly }: { childId: number; onClose: () => void; photoOnly?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(photoOnly ? "photos" : "");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file || !docType) return;
    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Failed to upload file to storage");

      const docRes = await fetch(`/api/children/${childId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath, fileName: file.name, documentType: docType, description }),
      });
      if (!docRes.ok) throw new Error(await docRes.text());

      queryClient.invalidateQueries({ queryKey: ["/api/children", String(childId), "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children", String(childId), "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline/recent"] });
      toast({ title: "Document uploaded", description: "The document has been added to this child's profile." });
      onClose();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {!photoOnly && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Document Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-doc-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="report_cards">Report Cards</SelectItem>
              <SelectItem value="attendance">Attendance Records</SelectItem>
              <SelectItem value="case_notes">Case Notes</SelectItem>
              <SelectItem value="social_worker_notes">Social Worker Notes</SelectItem>
              <SelectItem value="follow_up_reports">Follow-up Reports</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-sm font-medium">File</Label>
        <Input
          type="file"
          className="rounded-lg border-border/60"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-file-upload"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Description (optional)</Label>
        <Textarea
          className="rounded-lg border-border/60"
          placeholder="Brief description of the document"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="input-doc-description"
        />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" className="rounded-lg" onClick={onClose} data-testid="button-cancel-upload">Cancel</Button>
        <Button className="rounded-lg shadow-sm" onClick={handleUpload} disabled={uploading || !file || !docType} data-testid="button-confirm-upload">
          {uploading ? "Uploading..." : "Upload"}
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
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Entry Type</Label>
        <Select value={entryType} onValueChange={setEntryType}>
          <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-timeline-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="milestone">Milestone</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="status_change">Status Change</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Title</Label>
        <Input className="h-11 rounded-lg border-border/60" placeholder="e.g. Completed literacy milestone" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-timeline-title" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Description (optional)</Label>
        <Textarea className="rounded-lg border-border/60" placeholder="Additional details" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-timeline-description" />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" className="rounded-lg" onClick={onClose}>Cancel</Button>
        <Button className="rounded-lg shadow-sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !title} data-testid="button-confirm-timeline">
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
      <div className="mt-5">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Textarea
          className="mt-1.5 rounded-lg border-border/60"
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a description for this child..."
          data-testid="input-inline-description"
        />
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" className="rounded-lg shadow-sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-description">
            <Check className="mr-1.5 h-3 w-3" />
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => { setEditing(false); setValue(child.description || ""); }} data-testid="button-cancel-description">
            <X className="mr-1.5 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Description</Label>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md" onClick={() => setEditing(true)} data-testid="button-edit-description">
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
  const [uploadPhotoOpen, setUploadPhotoOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const sponsorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [lastCommentVisit, setLastCommentVisit] = useState<number>(() => {
    const stored = localStorage.getItem(`comments-visited-${childId}`);
    return stored ? parseInt(stored, 10) : 0;
  });
  const canEdit = user?.role !== "sponsor";

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

  const { data: messagesData, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/children", childId, "messages"],
    enabled: !!childId,
  });
  const unreadCommentCount = messagesData
    ? messagesData.filter(m => !m.parentId && new Date(m.createdAt).getTime() > lastCommentVisit).length
    : 0;

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: allUsers } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/children/${childId}/archive`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({ title: "Profile archived", description: "This profile has been moved to the archive. It will remain there until an admin removes it." });
    },
    onError: (error: Error) => toast({ title: "Archive failed", description: error.message, variant: "destructive" }),
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/children/${childId}/unarchive`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children/archived"] });
      toast({ title: "Profile restored", description: "The profile has been restored to active children." });
    },
    onError: (error: Error) => toast({ title: "Restore failed", description: error.message, variant: "destructive" }),
  });

  const deleteChildMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/children/${childId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children/archived"] });
      toast({ title: "Profile deleted", description: `${child?.fullName}'s profile has been permanently deleted.` });
      navigate("/children");
    },
    onError: (error: Error) => toast({ title: "Delete failed", description: error.message, variant: "destructive" }),
  });

  const toggleSponsorCommentMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", `/api/children/${childId}`, { sponsorCanComment: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId] });
      toast({ title: "Sponsor commenting updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
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
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Failed to upload photo to storage");

      const res = await fetch(`/api/children/${childId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath }),
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

  const sponsorPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Failed to upload sponsor photo");

      const res = await fetch(`/api/children/${childId}/sponsor-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId] });
      toast({ title: "Sponsor photo updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Sponsor photo upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "messages"] });
      toast({ title: "Comment deleted" });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ id, type, action }: { id: number; type: "like" | "love"; action: "react" | "unreact" }) => {
      return apiRequest("POST", `/api/messages/${id}/react`, { type, action });
    },
    onMutate: ({ id, type, action }) => {
      const key = `${type}-${id}`;
      const otherType = type === "like" ? "love" : "like";
      const otherKey = `${otherType}-${id}`;
      setMyReactions(prev => {
        const next = new Set(prev);
        if (action === "unreact") {
          next.delete(key);
        } else {
          next.add(key);
          next.delete(otherKey);
        }
        return next;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "messages"] });
    },
  });

  const handleReact = (id: number, type: "like" | "love") => {
    const key = `${type}-${id}`;
    const otherType = type === "like" ? "love" : "like";
    const otherKey = `${otherType}-${id}`;
    const isActive = myReactions.has(key);
    const otherIsActive = myReactions.has(otherKey);
    if (isActive) {
      reactMutation.mutate({ id, type, action: "unreact" });
    } else {
      if (otherIsActive) {
        apiRequest("POST", `/api/messages/${id}/react`, { type: otherType, action: "unreact" }).catch(() => {});
      }
      reactMutation.mutate({ id, type, action: "react" });
    }
  };

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, content }: { parentId: number; content: string }) => {
      return apiRequest("POST", `/api/messages/${parentId}/reply`, { childId: Number(childId), content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "messages"] });
      setReplyingTo(null);
      setReplyContent("");
      toast({ title: "Reply posted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to post reply", description: error.message, variant: "destructive" });
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) photoMutation.mutate(file);
  };

  const handleSponsorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sponsorPhotoMutation.mutate(file);
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Card className="p-6 border-border/50"><Skeleton className="h-40 w-full rounded-lg" /></Card>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <User className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold">Child not found</h2>
        <Button variant="outline" className="mt-4 rounded-lg" onClick={() => navigate("/children")}>
          Back to Children
        </Button>
      </div>
    );
  }

  const initials = child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2);

  const orgObject = child.organizationId && organizations
    ? organizations.find((o) => o.id === child.organizationId) || null
    : null;
  const orgName = orgObject ? orgObject.name : "Not assigned";

  const assignedSponsorUser = child.sponsorUserId && allUsers
    ? allUsers.find((u) => u.id === child.sponsorUserId)
    : null;
  const assignedSponsorName = assignedSponsorUser
    ? (assignedSponsorUser.firstName && assignedSponsorUser.lastName
        ? `${assignedSponsorUser.firstName} ${assignedSponsorUser.lastName}`
        : assignedSponsorUser.username)
    : (child.sponsorUserId ? "Assigned" : "Not linked");

  const dobDisplay = child.dateOfBirth
    ? new Date(child.dateOfBirth + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

  const infoItems = [
    { icon: Calendar, label: "Date of Birth", value: dobDisplay || `${child.age} years old`, subValue: dobDisplay ? `${child.age} yrs old` : undefined },
    { icon: User, label: "Gender", value: child.gender },
    { icon: MapPin, label: "Location", value: child.location },
    { icon: BookOpen, label: "Program", value: child.programEnrollment },
    { icon: User, label: "Case Worker", value: child.assignedCaseWorker },
    { icon: User, label: "Sponsor(s)", value: child.assignedSponsors || "None assigned" },
    { icon: Heart, label: "Sponsor", value: assignedSponsorName, color: child.sponsorUserId ? "text-pink-600 dark:text-pink-400" : "text-muted-foreground" },
    { icon: Heart, label: "Sponsored", value: child.isSponsored ? "Yes" : "No", color: child.isSponsored ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground" },
  ];

  const archivedAt = child.archivedAt ? new Date(child.archivedAt as unknown as string) : null;

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-5 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/children")} data-testid="button-back-profile">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Children
        </Button>

        {/* Archived banner */}
        {child.archivedAt && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 dark:bg-amber-500/8 dark:border-amber-500/20 px-4 py-3" data-testid="banner-archived">
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">This profile is archived</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Archived on {archivedAt!.toLocaleDateString()} · Only an admin can permanently delete this profile
                </p>
              </div>
            </div>
            {user?.role === "admin" && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg h-8 gap-1.5 border-amber-300 bg-white dark:bg-transparent hover:bg-amber-50 text-amber-700 dark:text-amber-300"
                onClick={() => unarchiveMutation.mutate()}
                disabled={unarchiveMutation.isPending}
                data-testid="button-restore-profile"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                {unarchiveMutation.isPending ? "Restoring..." : "Restore Profile"}
              </Button>
            )}
          </div>
        )}

        <Card className="p-5 sm:p-7 border-border/50">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="flex gap-4">
                <div className="group relative flex flex-col items-center">
                  <div
                    className="relative h-[120px] w-[120px] sm:h-[140px] sm:w-[140px] rounded-xl border-2 border-border/40 overflow-hidden bg-primary/8 flex items-center justify-center shrink-0"
                    data-testid="img-child-photo"
                  >
                    {child.photoUrl ? (
                      <img src={child.photoUrl} alt={child.fullName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-primary">{initials}</span>
                    )}
                    {canEdit && (
                      <button
                        className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => photoInputRef.current?.click()}
                        data-testid="button-upload-photo"
                      >
                        <Camera className="h-6 w-6 text-white" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    data-testid="input-photo-upload"
                  />
                  <p className="mt-1.5 text-center text-[11px] font-medium text-muted-foreground">Child Photo</p>
                </div>
                <div className="group relative flex flex-col items-center">
                  <div
                    className="relative h-[120px] w-[120px] sm:h-[140px] sm:w-[140px] rounded-xl border-2 border-rose-200/50 dark:border-rose-500/20 overflow-hidden bg-rose-500/8 flex items-center justify-center shrink-0"
                    data-testid="img-sponsor-photo"
                  >
                    {child.sponsorPhotoUrl ? (
                      <img src={child.sponsorPhotoUrl} alt="Sponsor" className="h-full w-full object-cover" />
                    ) : (
                      <Heart className="h-8 w-8 text-rose-500" />
                    )}
                    {canEdit && (
                      <button
                        className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => sponsorPhotoInputRef.current?.click()}
                        data-testid="button-upload-sponsor-photo"
                      >
                        <Camera className="h-6 w-6 text-white" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={sponsorPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSponsorPhotoChange}
                    data-testid="input-sponsor-photo-upload"
                  />
                  <p className="mt-1.5 text-center text-[11px] font-medium text-muted-foreground">Sponsor Photo</p>
                </div>
              </div>
              <div className="pt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight" data-testid="text-child-name">{child.fullName}</h1>
                  <StatusBadge status={child.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground" data-testid="text-child-id">ID: {child.childId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && !child.archivedAt && (
                <Button variant="outline" className="rounded-lg" asChild data-testid="button-edit-child">
                  <Link href={`/children/${child.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
              {user?.role === "admin" && !child.archivedAt && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-lg gap-1.5 text-muted-foreground hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/8"
                      data-testid="button-archive-child"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-amber-500" />
                        Archive Profile
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{child.fullName}</strong>'s profile will be moved to the archive and hidden from the active list. It will stay there indefinitely until an admin permanently deletes or restores it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                        onClick={() => archiveMutation.mutate()}
                        data-testid="button-confirm-archive"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Profile
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {user?.role === "admin" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-lg gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5"
                      disabled={deleteChildMutation.isPending}
                      data-testid="button-delete-child"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-destructive" />
                        Permanently Delete Profile
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{child.fullName}</strong>'s entire profile — including all documents, photos, timeline entries, and comments. This action <strong>cannot be undone</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
                        onClick={() => deleteChildMutation.mutate()}
                        data-testid="button-confirm-delete-child"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleteChildMutation.isPending ? "Deleting..." : "Delete Permanently"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <InlineDescription child={child} canEdit={canEdit} />

          <Separator className="my-6 opacity-50" />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {infoItems.map((item) => {
              let iconBg = "bg-muted/70";
              let iconColor = "text-muted-foreground";
              if (item.label === "Sponsored" && child.isSponsored) {
                iconBg = "bg-pink-50 dark:bg-pink-500/10";
                iconColor = "text-pink-500";
              } else if (item.label === "Organization" && child.organizationId) {
                iconBg = "bg-orange-50 dark:bg-orange-500/10";
                iconColor = "text-orange-500";
              }
              return (
                <div key={item.label} className="flex items-start gap-3" data-testid={`info-${item.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                    <item.icon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-sm font-medium capitalize mt-0.5 ${"color" in item && item.color ? item.color : ""}`}>{item.value}</p>
                    {"subValue" in item && item.subValue && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.subValue}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Organization summary */}
          {orgObject && (
            <>
              <Separator className="my-6 opacity-50" />
              <div className="flex items-start gap-4 rounded-xl border border-orange-100 dark:border-orange-500/20 bg-orange-50/60 dark:bg-orange-500/6 px-5 py-4" data-testid="section-org-summary">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-500/15">
                  <Building2 className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500/80 dark:text-orange-400/70 mb-0.5">
                    Program
                  </p>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-200" data-testid="text-org-summary-name">
                    {orgObject.name}
                  </p>
                  {orgObject.description && (
                    <p className="mt-1 text-sm text-orange-800/70 dark:text-orange-300/70 leading-relaxed line-clamp-2" data-testid="text-org-summary-description">
                      {orgObject.description}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>

        <Tabs defaultValue="documents" className="mt-7" onValueChange={(v) => {
            if (v === "messages") {
              const now = Date.now();
              localStorage.setItem(`comments-visited-${childId}`, String(now));
              setLastCommentVisit(now);
            }
          }}>
          <TabsList className="rounded-lg" data-testid="tabs-profile">
            <TabsTrigger value="documents" className="rounded-md" data-testid="tab-documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="photos" className="rounded-md" data-testid="tab-photos">
              <Image className="mr-2 h-4 w-4" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-md" data-testid="tab-messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Comments
              {unreadCommentCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold min-w-[16px] h-4 px-1 leading-none" data-testid="badge-unread-comments">
                  {unreadCommentCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-md" data-testid="tab-timeline">
              <Clock className="mr-2 h-4 w-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                Documents
              </h2>
              {canEdit && (
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-lg shadow-sm" data-testid="button-upload-document">
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
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : !documents?.filter(d => d.documentType !== "photos").length ? (
              <Card className="flex flex-col items-center justify-center p-14 text-center border-border/50">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => setUploadOpen(true)}>
                    Upload First Document
                  </Button>
                )}
              </Card>
            ) : (
              <div className="space-y-2.5">
                {documents.filter(d => d.documentType !== "photos").map((doc) => (
                  <Card key={doc.id} className="flex items-center gap-4 p-4 border-border/50 transition-all duration-150 hover:shadow-sm" data-testid={`doc-item-${doc.id}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <DocumentIcon type={doc.documentType} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">{doc.fileName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="outline" className="border-border/60 capitalize text-xs rounded-md">{doc.documentType.replace("_", " ")}</Badge>
                        <span>· {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}</span>
                        <span>· by {doc.uploadedBy}</span>
                      </div>
                      <div className="mt-1.5">
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
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" asChild>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-view-doc-${doc.id}`}>
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                      {canEdit && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-destructive/8 hover:text-destructive" data-testid={`button-delete-doc-${doc.id}`}>
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
                              <AlertDialogCancel className="rounded-lg" data-testid={`button-cancel-delete-${doc.id}`}>Keep it</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(doc.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
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

          <TabsContent value="photos" className="mt-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                Photos
              </h2>
              {canEdit && (
                <Dialog open={uploadPhotoOpen} onOpenChange={setUploadPhotoOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-lg shadow-sm" data-testid="button-upload-photo-doc">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Photo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Photo</DialogTitle>
                    </DialogHeader>
                    <UploadDocumentDialog childId={child.id} onClose={() => setUploadPhotoOpen(false)} photoOnly />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {docsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
              </div>
            ) : !documents?.filter(d => d.documentType === "photos").length ? (
              <Card className="flex flex-col items-center justify-center p-14 text-center border-border/50">
                <Image className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No photos uploaded yet</p>
                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => setUploadPhotoOpen(true)}>
                    Upload First Photo
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.filter(d => d.documentType === "photos").map((doc) => (
                  <Card key={doc.id} className="overflow-hidden border-border/50 hover:shadow-md transition-shadow duration-150" data-testid={`photo-item-${doc.id}`}>
                    {/* Image */}
                    <div className="group relative aspect-video bg-muted/30">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                        <img
                          src={doc.fileUrl}
                          alt={doc.description || doc.fileName}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                            (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "flex";
                          }}
                        />
                        <div className="hidden h-full w-full items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      </a>
                      {/* Date overlay at bottom */}
                      {doc.uploadedAt && (
                        <div className="absolute bottom-0 inset-x-0 px-2.5 py-2 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow">
                            Update {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/\//g, "-")}
                          </span>
                        </div>
                      )}

                      {canEdit && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-black/40 hover:bg-destructive text-white" data-testid={`button-delete-photo-${doc.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove <strong>{doc.fileName}</strong>. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-lg">Keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(doc.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
                                  data-testid={`button-confirm-delete-photo-${doc.id}`}
                                >
                                  Yes, delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>

                    {/* Metadata + description */}
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">Uploaded by {doc.uploadedBy}</span>
                      </div>
                      <div className="border-t border-border/40 pt-2.5">
                        <InlineEditableText
                          value={doc.description || ""}
                          canEdit={canEdit}
                          placeholder="Add a description…"
                          testIdPrefix={`photo-desc-${doc.id}`}
                          onSave={async (newDesc) => {
                            await apiRequest("PATCH", `/api/documents/${doc.id}`, { description: newDesc });
                            queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "documents"] });
                          }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                Progress Timeline
              </h2>
              {canEdit && (
                <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-lg shadow-sm" data-testid="button-add-timeline">
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
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : !timeline?.length ? (
              <Card className="flex flex-col items-center justify-center p-14 text-center border-border/50">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No timeline entries yet</p>
                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => setTimelineOpen(true)}>
                    Add First Entry
                  </Button>
                )}
              </Card>
            ) : (
              <div className="space-y-1.5">
                {timeline.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4" data-testid={`timeline-item-${entry.id}`}>
                    <div className="flex flex-col items-center pt-2">
                      <TimelineIcon type={entry.entryType} />
                      {index < timeline.length - 1 && <div className="mt-1.5 w-px flex-1 bg-border/50" />}
                    </div>
                    <Card className="mb-2 flex-1 p-4 border-border/50 transition-all duration-150 hover:shadow-sm">
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
                        <Badge variant="outline" className="border-border/60 capitalize text-xs rounded-md">
                          {entry.entryType.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
                        <span>by {entry.createdBy}</span>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="messages" className="mt-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-[15px] font-semibold flex items-center gap-2.5">
                  <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                  Messages
                </h2>
                {user?.role === "admin" && (
                  <div className="flex items-center gap-2.5 ml-3.5 mt-1">
                    <Switch
                      id="sponsor-comment-toggle"
                      checked={!!child.sponsorCanComment}
                      onCheckedChange={(val) => toggleSponsorCommentMutation.mutate(val)}
                      disabled={toggleSponsorCommentMutation.isPending}
                      data-testid="switch-sponsor-can-comment"
                    />
                    <label htmlFor="sponsor-comment-toggle" className="flex items-center gap-1.5 cursor-pointer">
                      <MessageCircle className={`h-3.5 w-3.5 ${child.sponsorCanComment ? "text-emerald-600" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${child.sponsorCanComment ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        Sponsor commenting {child.sponsorCanComment ? "enabled" : "disabled"}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {messagesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : !messagesData?.filter(m => !m.parentId).length ? (
              <Card className="flex flex-col items-center justify-center p-14 text-center border-border/50">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">No sponsor comments yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {child.sponsorCanComment
                    ? "The sponsor can post comments from their portal."
                    : "Enable sponsor commenting above to allow the sponsor to post here."}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {messagesData.filter(m => !m.parentId).map((msg) => {
                  const replies = messagesData.filter(r => r.parentId === msg.id);
                  const roleColor = msg.senderRole === "sponsor" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400";
                  const rxn = (msg.reactions as { like: number; love: number } | null) ?? { like: 0, love: 0 };
                  const hasLiked = myReactions.has(`like-${msg.id}`);
                  const hasLoved = myReactions.has(`love-${msg.id}`);

                  return (
                    <div key={msg.id} className="space-y-2">
                      <Card className="p-4 border-border/50 transition-all duration-150 hover:shadow-sm" data-testid={`message-item-${msg.id}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium" data-testid={`text-sender-${msg.id}`}>{msg.senderName}</span>
                              <Badge variant="secondary" className={`text-xs rounded-md ${roleColor}`} data-testid={`badge-role-${msg.id}`}>
                                {msg.senderRole === "sponsor" ? "Sponsor" : "Care Team"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-foreground/80" data-testid={`text-message-content-${msg.id}`}>{msg.content}</p>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                            </p>
                            {/* Reaction + Reply bar */}
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleReact(msg.id, "like")}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${hasLiked ? "border-[#3072DC] bg-[#3072DC]/10 text-[#3072DC] font-medium" : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-blue-50 hover:border-blue-200 hover:text-[#3072DC]"}`}
                                data-testid={`button-like-${msg.id}`}
                              >
                                <ThumbsUp className={`h-3 w-3 ${hasLiked ? "fill-[#3072DC]" : ""}`} />
                                {rxn.like > 0 && <span>{rxn.like}</span>}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReact(msg.id, "love")}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${hasLoved ? "border-[#E14B8E] bg-[#E14B8E]/10 text-[#E14B8E] font-medium" : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-rose-50 hover:border-rose-200 hover:text-[#E14B8E]"}`}
                                data-testid={`button-love-${msg.id}`}
                              >
                                <Heart className={`h-3 w-3 ${hasLoved ? "fill-[#E14B8E]" : ""}`} />
                                {rxn.love > 0 && <span>{rxn.love}</span>}
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => { setReplyingTo(replyingTo === msg.id ? null : msg.id); setReplyContent(""); }}
                                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors"
                                  data-testid={`button-reply-${msg.id}`}
                                >
                                  <Reply className="h-3 w-3" />
                                  Reply {replies.length > 0 && `· ${replies.length}`}
                                </button>
                              )}
                            </div>
                          </div>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-message-actions-${msg.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteMessageMutation.mutate(msg.id)} data-testid={`button-delete-message-${msg.id}`}>
                                  Delete Comment
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </Card>

                      {/* Replies */}
                      {replies.length > 0 && (
                        <div className="ml-6 space-y-2">
                          {replies.map((reply) => {
                            const replyRoleColor = reply.senderRole === "sponsor" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400";
                            const replyRxn = (reply.reactions as { like: number; love: number } | null) ?? { like: 0, love: 0 };
                            const replyHasLiked = myReactions.has(`like-${reply.id}`);
                            const replyHasLoved = myReactions.has(`love-${reply.id}`);
                            return (
                              <div key={reply.id} className="flex gap-2">
                                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/40 mt-3 shrink-0" />
                                <Card className="flex-1 p-3 border-border/40 bg-muted/20" data-testid={`reply-item-${reply.id}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-xs font-semibold">{reply.senderName}</span>
                                        <Badge variant="secondary" className={`text-[10px] rounded-md px-1.5 ${replyRoleColor}`}>{reply.senderRole === "sponsor" ? "Sponsor" : "Care Team"}</Badge>
                                      </div>
                                      <p className="mt-1 text-xs text-foreground/80">{reply.content}</p>
                                      <p className="mt-1 text-[10px] text-muted-foreground">
                                        {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                                      </p>
                                      <div className="mt-2 flex items-center gap-1.5">
                                        <button type="button" onClick={() => handleReact(reply.id, "like")} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${replyHasLiked ? "border-[#3072DC] bg-[#3072DC]/10 text-[#3072DC] font-medium" : "border-border/60 bg-background text-muted-foreground hover:bg-blue-50 hover:text-[#3072DC]"}`} data-testid={`button-like-reply-${reply.id}`}>
                                          <ThumbsUp className={`h-2.5 w-2.5 ${replyHasLiked ? "fill-[#3072DC]" : ""}`} />{replyRxn.like > 0 && replyRxn.like}
                                        </button>
                                        <button type="button" onClick={() => handleReact(reply.id, "love")} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${replyHasLoved ? "border-[#E14B8E] bg-[#E14B8E]/10 text-[#E14B8E] font-medium" : "border-border/60 bg-background text-muted-foreground hover:bg-rose-50 hover:text-[#E14B8E]"}`} data-testid={`button-love-reply-${reply.id}`}>
                                          <Heart className={`h-2.5 w-2.5 ${replyHasLoved ? "fill-[#E14B8E]" : ""}`} />{replyRxn.love > 0 && replyRxn.love}
                                        </button>
                                      </div>
                                    </div>
                                    {canEdit && (
                                      <button type="button" onClick={() => deleteMessageMutation.mutate(reply.id)} className="text-muted-foreground hover:text-destructive" data-testid={`button-delete-reply-${reply.id}`}>
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </Card>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Inline reply input */}
                      {replyingTo === msg.id && (
                        <div className="ml-6 flex gap-2">
                          <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/40 mt-2.5 shrink-0" />
                          <div className="flex-1 flex gap-2 items-end">
                            <Textarea
                              rows={2}
                              placeholder="Write a reply…"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              className="rounded-lg border-border/60 text-sm resize-none flex-1"
                              data-testid={`input-reply-${msg.id}`}
                            />
                            <div className="flex flex-col gap-1.5">
                              <Button
                                size="sm"
                                className="rounded-lg h-8"
                                disabled={!replyContent.trim() || replyMutation.isPending}
                                onClick={() => replyMutation.mutate({ parentId: msg.id, content: replyContent })}
                                data-testid={`button-submit-reply-${msg.id}`}
                              >
                                {replyMutation.isPending ? "…" : <Send className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => setReplyingTo(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
