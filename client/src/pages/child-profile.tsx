import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft, Edit, Upload, Plus, FileText, Image, StickyNote,
  GraduationCap, Calendar, User, MapPin, BookOpen, Clock, Trash2, Camera, Check, X, Pencil,
  Milestone, MessageSquare, RefreshCw, Heart, Mail, Send, MoreHorizontal, Building2, MessageCircle,
  ThumbsUp, CornerDownRight, Reply,
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

function UploadDocumentDialog({ childId, onClose }: { childId: number; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
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
            <SelectItem value="photos">Photos</SelectItem>
          </SelectContent>
        </Select>
      </div>
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

function SendMessageDialog({
  onSend,
  isPending,
  onClose,
}: {
  onSend: (data: { senderName: string; senderRole: string; content: string }) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [senderName, setSenderName] = useState("");
  const [senderRole, setSenderRole] = useState("sponsor");
  const [content, setContent] = useState("");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sender Name</Label>
        <Input
          className="h-11 rounded-lg border-border/60"
          placeholder="Enter sender name"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          data-testid="input-sender-name"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sender Role</Label>
        <Select value={senderRole} onValueChange={setSenderRole}>
          <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-sender-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sponsor">Sponsor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Comment</Label>
        <Textarea
          className="rounded-lg border-border/60"
          placeholder="Write your comment..."
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          data-testid="input-message-content"
        />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" className="rounded-lg" onClick={onClose} data-testid="button-cancel-message">Cancel</Button>
        <Button
          className="rounded-lg shadow-sm"
          onClick={() => onSend({ senderName, senderRole, content })}
          disabled={isPending || !senderName || !content}
          data-testid="button-confirm-message"
        >
          {isPending ? "Posting..." : "Post Comment"}
        </Button>
      </div>
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
  const sponsorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
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

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: allUsers } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
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

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { senderName: string; senderRole: string; content: string }) => {
      return apiRequest("POST", `/api/children/${childId}/messages`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "messages"] });
      toast({ title: "Message sent" });
      setMessageOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const updateMessageMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/messages/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "messages"] });
      toast({ title: "Message status updated" });
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
    mutationFn: async ({ id, type }: { id: number; type: "like" | "love" }) => {
      return apiRequest("POST", `/api/messages/${id}/react`, { type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/children", childId, "messages"] });
    },
  });

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

  const orgName = child.organizationId && organizations
    ? organizations.find((o) => o.id === child.organizationId)?.name || "Unknown"
    : "Not assigned";

  const assignedSponsorUser = child.sponsorUserId && allUsers
    ? allUsers.find((u) => u.id === child.sponsorUserId)
    : null;
  const assignedSponsorName = assignedSponsorUser
    ? (assignedSponsorUser.firstName && assignedSponsorUser.lastName
        ? `${assignedSponsorUser.firstName} ${assignedSponsorUser.lastName}`
        : assignedSponsorUser.username)
    : (child.sponsorUserId ? "Assigned" : "Not linked");

  const infoItems = [
    { icon: Calendar, label: "Age", value: `${child.age} years old` },
    { icon: User, label: "Gender", value: child.gender },
    { icon: MapPin, label: "Location", value: child.location },
    { icon: BookOpen, label: "Program", value: child.programEnrollment },
    { icon: User, label: "Case Worker", value: child.assignedCaseWorker },
    { icon: User, label: "Sponsor(s)", value: child.assignedSponsors || "None assigned" },
    { icon: Heart, label: "Sponsor Account", value: assignedSponsorName, color: child.sponsorUserId ? "text-pink-600 dark:text-pink-400" : "text-muted-foreground" },
    { icon: Heart, label: "Sponsored", value: child.isSponsored ? "Yes" : "No", color: child.isSponsored ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground" },
    { icon: Building2, label: "Organization", value: orgName, color: child.organizationId ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground" },
  ];

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-5 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/children")} data-testid="button-back-profile">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Children
        </Button>

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
            {canEdit && (
              <Button variant="outline" className="rounded-lg shrink-0" asChild data-testid="button-edit-child">
                <Link href={`/children/${child.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
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
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Tabs defaultValue="documents" className="mt-7">
          <TabsList className="rounded-lg" data-testid="tabs-profile">
            <TabsTrigger value="documents" className="rounded-md" data-testid="tab-documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-md" data-testid="tab-timeline">
              <Clock className="mr-2 h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-md" data-testid="tab-messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Comments
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
            ) : !documents?.length ? (
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
                {documents.map((doc) => (
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
              {canEdit && (
                <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-lg shadow-sm" data-testid="button-send-message">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Leave a Comment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Leave a Comment</DialogTitle>
                    </DialogHeader>
                    <SendMessageDialog
                      onSend={(data) => sendMessageMutation.mutate(data)}
                      isPending={sendMessageMutation.isPending}
                      onClose={() => setMessageOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {messagesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : !messagesData?.filter(m => !m.parentId).length ? (
              <Card className="flex flex-col items-center justify-center p-14 text-center border-border/50">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No comments yet</p>
                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => setMessageOpen(true)} data-testid="button-send-first-message">
                    Leave First Comment
                  </Button>
                )}
              </Card>
            ) : (
              <div className="space-y-3">
                {messagesData.filter(m => !m.parentId).map((msg) => {
                  const replies = messagesData.filter(r => r.parentId === msg.id);
                  const roleColor = msg.senderRole === "sponsor" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400";
                  const statusColors: Record<string, string> = {
                    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    delivered: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                    read: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  };
                  const statusColor = statusColors[msg.status] || statusColors.pending;
                  const rxn = (msg.reactions as { like: number; love: number } | null) ?? { like: 0, love: 0 };

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
                              <Badge variant="secondary" className={`text-xs rounded-md ${statusColor}`} data-testid={`badge-status-${msg.id}`}>
                                {msg.status}
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
                                onClick={() => reactMutation.mutate({ id: msg.id, type: "like" })}
                                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 px-2.5 py-1 text-xs text-muted-foreground transition-colors"
                                data-testid={`button-like-${msg.id}`}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                {rxn.like > 0 && <span>{rxn.like}</span>}
                              </button>
                              <button
                                type="button"
                                onClick={() => reactMutation.mutate({ id: msg.id, type: "love" })}
                                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 px-2.5 py-1 text-xs text-muted-foreground transition-colors"
                                data-testid={`button-love-${msg.id}`}
                              >
                                <Heart className="h-3 w-3" />
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
                                {msg.status !== "delivered" && (
                                  <DropdownMenuItem onClick={() => updateMessageMutation.mutate({ id: msg.id, status: "delivered" })} data-testid={`button-mark-delivered-${msg.id}`}>
                                    Mark as Delivered
                                  </DropdownMenuItem>
                                )}
                                {msg.status !== "read" && (
                                  <DropdownMenuItem onClick={() => updateMessageMutation.mutate({ id: msg.id, status: "read" })} data-testid={`button-mark-read-${msg.id}`}>
                                    Mark as Read
                                  </DropdownMenuItem>
                                )}
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
                                        <button type="button" onClick={() => reactMutation.mutate({ id: reply.id, type: "like" })} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors" data-testid={`button-like-reply-${reply.id}`}>
                                          <ThumbsUp className="h-2.5 w-2.5" />{replyRxn.like > 0 && replyRxn.like}
                                        </button>
                                        <button type="button" onClick={() => reactMutation.mutate({ id: reply.id, type: "love" })} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors" data-testid={`button-love-reply-${reply.id}`}>
                                          <Heart className="h-2.5 w-2.5" />{replyRxn.love > 0 && replyRxn.love}
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
