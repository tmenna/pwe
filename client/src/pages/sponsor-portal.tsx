import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart, FileText, Image, StickyNote, GraduationCap, Clock, MessageSquare,
  Milestone, RefreshCw, MapPin, BookOpen, User, Calendar, Send, Mail,
  CheckCheck, Eye, Inbox, MessageCircleOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Child, Document, TimelineEntry, Message } from "@shared/schema";

function DocumentIcon({ type }: { type: string }) {
  switch (type) {
    case "education": return <GraduationCap className="h-4 w-4" />;
    case "case_notes": return <StickyNote className="h-4 w-4" />;
    case "photos": return <Image className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

const docTypeLabels: Record<string, string> = {
  education: "Education",
  report_cards: "Report Cards",
  attendance: "Attendance",
  case_notes: "Case Notes",
  social_worker_notes: "Social Worker Notes",
  follow_up_reports: "Follow-up Report",
  photos: "Photos",
};

const docTypeColors: Record<string, string> = {
  education: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-300",
  report_cards: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-500/10 dark:text-violet-300",
  attendance: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300",
  case_notes: "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-300",
  social_worker_notes: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-300",
  follow_up_reports: "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-500/10 dark:text-orange-300",
  photos: "bg-pink-50 text-pink-700 border-pink-200/60 dark:bg-pink-500/10 dark:text-pink-300",
};

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
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color.bg}`}>
      <Icon className={`h-3.5 w-3.5 ${color.icon}`} />
    </div>
  );
}

function SendMessageDialog({ childId, sponsorName, onClose }: { childId: number; sponsorName: string; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);
  const qClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/children/${childId}/messages`, {
      senderName: sponsorName,
      senderRole: "sponsor",
      content,
    }),
    onSuccess: () => {
      qClient.invalidateQueries({ queryKey: ["/api/children", String(childId), "messages"] });
      toast({ title: "Message sent", description: "Your message has been sent to the care team." });
      setContent("");
      setOpen(false);
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-lg shadow-sm bg-pink-600 hover:bg-pink-700 text-white h-9 px-4 text-sm" data-testid="button-send-message">
          <Send className="mr-2 h-3.5 w-3.5" />
          Send a Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-pink-500" />
            Send a Message
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Your message will be delivered to the PWE care team and associated with your sponsored child's record.
          </p>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Message</Label>
            <Textarea
              className="min-h-[120px] rounded-lg border-border/60 resize-none"
              placeholder="Write your message here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              data-testid="input-message-content"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)} data-testid="button-cancel-message">Cancel</Button>
            <Button
              className="rounded-lg shadow-sm bg-pink-600 hover:bg-pink-700 text-white"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !content.trim()}
              data-testid="button-confirm-send"
            >
              {mutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChildPortal({ child }: { child: Child }) {
  const childId = child.id;
  const { user } = useAuth();
  const sponsorName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.username || "Sponsor";

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["/api/children", String(childId), "timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/children/${childId}/timeline`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
  });

  const { data: documents, isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["/api/children", String(childId), "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/children/${childId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/children", String(childId), "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/children/${childId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
  });

  const latestMilestone = timeline?.find((e) => e.entryType === "milestone");
  const latestDocument = documents?.[0];
  const photoUrl = child.photoUrl?.startsWith("/objects") ? child.photoUrl : child.photoUrl ? `/objects/${child.photoUrl}` : null;
  const sponsorPhotoUrl = child.sponsorPhotoUrl?.startsWith("/objects") ? child.sponsorPhotoUrl : child.sponsorPhotoUrl ? `/objects/${child.sponsorPhotoUrl}` : null;

  const infoItems = [
    { icon: User, label: "Age", value: child.age ? `${child.age} years old` : "—" },
    { icon: BookOpen, label: "Program", value: child.programEnrollment || "—" },
    { icon: MapPin, label: "Location", value: child.location || "—" },
    { icon: Calendar, label: "Gender", value: child.gender ? (child.gender.charAt(0).toUpperCase() + child.gender.slice(1)) : "—" },
  ];

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Welcome Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]" data-testid="text-sponsor-welcome">
              Welcome, {user?.firstName || sponsorName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here is the latest update from <span className="font-medium text-foreground">{child.fullName}</span>
            </p>
          </div>
          {child.sponsorCanComment ? (
            <SendMessageDialog childId={childId} sponsorName={sponsorName} onClose={() => {}} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground" data-testid="text-commenting-disabled">
              <Mail className="h-4 w-4 shrink-0" />
              Commenting not currently enabled
            </div>
          )}
        </div>

        {/* Child Hero Card */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500" />
          <div className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Child Photo */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-2 ring-border/30 shadow-md">
                  {photoUrl ? <AvatarImage src={photoUrl} alt={child.fullName} className="object-cover" /> : null}
                  <AvatarFallback className="text-2xl font-semibold bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300">
                    {child.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 text-xs font-medium capitalize"
                  data-testid="badge-child-status"
                >
                  {child.status}
                </Badge>
              </div>

              {/* Child Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight" data-testid="text-child-name">{child.fullName}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{child.childId}</p>
                  </div>
                  {sponsorPhotoUrl && (
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Your Photo</span>
                      <Avatar className="h-12 w-12 ring-2 ring-pink-200/60 dark:ring-pink-500/20">
                        <AvatarImage src={sponsorPhotoUrl} alt="Sponsor photo" className="object-cover" />
                        <AvatarFallback className="bg-pink-50 text-pink-600 text-xs"><Heart className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {infoItems.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">{label}</p>
                        <p className="text-sm font-medium text-foreground truncate" data-testid={`info-${label.toLowerCase()}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {child.description && (
                  <>
                    <Separator className="my-4" />
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-child-description">{child.description}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Milestone className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest Milestone</p>
            </div>
            {timelineLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : latestMilestone ? (
              <div>
                <p className="text-sm font-medium leading-snug" data-testid="text-latest-milestone">{latestMilestone.title}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{latestMilestone.description}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No milestones yet</p>
            )}
          </Card>

          <Card className="border-border/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest Document</p>
            </div>
            {docsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : latestDocument ? (
              <div>
                <p className="text-sm font-medium leading-snug" data-testid="text-latest-doc">{latestDocument.fileName}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">{docTypeLabels[latestDocument.documentType] || latestDocument.documentType}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No documents yet</p>
            )}
          </Card>

          <Card className="border-border/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10">
                <Heart className="h-3.5 w-3.5 text-pink-500" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sponsorship</p>
            </div>
            <div>
              <p className="text-sm font-medium" data-testid="text-sponsorship-status">Active Sponsor</p>
              {child.assignedSponsors && (
                <p className="mt-1 text-xs text-muted-foreground">{child.assignedSponsors}</p>
              )}
            </div>
          </Card>
        </div>

        {/* Tabs: Progress / Documents / Messages */}
        <Tabs defaultValue="progress" className="space-y-4">
          <TabsList className="rounded-lg border border-border/50 bg-muted/40 p-1 h-auto gap-1">
            <TabsTrigger value="progress" className="rounded-md text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-1.5" data-testid="tab-progress">
              <Milestone className="mr-2 h-3.5 w-3.5" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-md text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-1.5" data-testid="tab-documents">
              <FileText className="mr-2 h-3.5 w-3.5" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-md text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-1.5" data-testid="tab-messages">
              <Mail className="mr-2 h-3.5 w-3.5" />
              Messages
            </TabsTrigger>
          </TabsList>

          {/* Progress Tab */}
          <TabsContent value="progress">
            <Card className="border-border/50">
              <div className="p-6">
                <h3 className="text-[15px] font-semibold flex items-center gap-2.5 mb-5">
                  <span className="inline-block w-1 h-5 rounded-full bg-emerald-500" />
                  Progress &amp; Updates
                </h3>
                {timelineLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : !timeline?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                      <Milestone className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No progress entries yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Updates will appear here as the care team adds them</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {timeline.map((entry, idx) => (
                      <div key={entry.id}>
                        <div className="flex items-start gap-3 py-3" data-testid={`timeline-entry-${entry.id}`}>
                          <TimelineIcon type={entry.entryType} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <p className="text-sm font-medium leading-snug">{entry.title}</p>
                              <p className="text-[11px] text-muted-foreground shrink-0">
                                {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                            {entry.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                            )}
                            <p className="mt-1 text-[11px] text-muted-foreground/60">By {entry.createdBy}</p>
                          </div>
                        </div>
                        {idx < timeline.length - 1 && <Separator className="opacity-50" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="border-border/50">
              <div className="p-6">
                <h3 className="text-[15px] font-semibold flex items-center gap-2.5 mb-5">
                  <span className="inline-block w-1 h-5 rounded-full bg-blue-500" />
                  Documents &amp; Reports
                </h3>
                {docsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !documents?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No documents available</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Reports and documents will be shared here by the care team</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-border/50 p-4 transition-all duration-150 hover:bg-muted/40 hover:border-border/80 group"
                        data-testid={`document-item-${doc.id}`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${docTypeColors[doc.documentType] || "bg-slate-50 text-slate-600 border-slate-200/60"}`}>
                          <DocumentIcon type={doc.documentType} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{doc.fileName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-[18px] ${docTypeColors[doc.documentType] || ""}`}>
                              {docTypeLabels[doc.documentType] || doc.documentType}
                            </Badge>
                            {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground shrink-0">
                          {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card className="border-border/50">
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h3 className="text-[15px] font-semibold flex items-center gap-2.5">
                    <span className="inline-block w-1 h-5 rounded-full bg-pink-500" />
                    Messages
                  </h3>
                  {child.sponsorCanComment ? (
                    <SendMessageDialog childId={childId} sponsorName={sponsorName} onClose={() => {}} />
                  ) : (
                    <span className="text-xs text-muted-foreground italic" data-testid="text-tab-commenting-disabled">
                      Commenting not enabled
                    </span>
                  )}
                </div>
                {messagesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : !messages?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                      <Inbox className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Use the button above to send your first message to the care team</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isSponsor = msg.senderRole === "sponsor";
                      const statusIcons: Record<string, any> = {
                        pending: Clock,
                        delivered: Eye,
                        read: CheckCheck,
                      };
                      const StatusIcon = statusIcons[msg.status] || Clock;
                      const statusColors: Record<string, string> = {
                        pending: "text-amber-500",
                        delivered: "text-blue-500",
                        read: "text-emerald-500",
                      };
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-xl border p-4 ${isSponsor ? "border-pink-200/60 bg-pink-50/40 dark:bg-pink-500/5 dark:border-pink-500/20" : "border-blue-200/60 bg-blue-50/40 dark:bg-blue-500/5 dark:border-blue-500/20"}`}
                          data-testid={`message-item-${msg.id}`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${isSponsor ? "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"}`}>
                                {msg.senderName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium leading-none">{msg.senderName}</p>
                                <Badge
                                  variant="outline"
                                  className={`mt-1 text-[10px] px-1.5 py-0 h-[16px] ${isSponsor ? "bg-pink-50 text-pink-700 border-pink-200/60 dark:bg-pink-500/15 dark:text-pink-300" : "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/15 dark:text-blue-300"}`}
                                >
                                  {isSponsor ? "Sponsor" : "Care Team"}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusIcon className={`h-3.5 w-3.5 ${statusColors[msg.status]}`} />
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-foreground leading-relaxed">{msg.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SponsorPortal() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-5 sm:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!children || children.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 dark:bg-pink-500/10 mx-auto mb-4">
            <Heart className="h-7 w-7 text-pink-400" />
          </div>
          <h2 className="text-lg font-semibold" data-testid="text-no-children">No Sponsored Children Assigned</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You haven't been linked to a sponsored child yet. Please contact the PWE care team for assistance.
          </p>
        </div>
      </div>
    );
  }

  const activeChildId = selectedChildId ?? children[0].id;
  const activeChild = children.find((c) => c.id === activeChildId) ?? children[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Child picker (only shown if multiple children) */}
      {children.length > 1 && (
        <div className="border-b border-border/50 bg-muted/20 px-5 sm:px-8 py-3">
          <div className="mx-auto max-w-4xl flex items-center gap-3 flex-wrap">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Your sponsored children:</p>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all border ${
                  c.id === activeChildId
                    ? "bg-background border-border shadow-sm text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                data-testid={`button-child-picker-${c.id}`}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] bg-pink-100 text-pink-700">{c.fullName[0]}</AvatarFallback>
                </Avatar>
                {c.fullName}
              </button>
            ))}
          </div>
        </div>
      )}
      <ChildPortal child={activeChild} />
    </div>
  );
}
