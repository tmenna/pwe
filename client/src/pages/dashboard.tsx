import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Building2, ArrowRight, Users, Heart, TrendingUp, Newspaper, Upload, X, Trash2, Settings2, CheckSquare, Square, FileText, Calendar, User, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Organization, Newsletter } from "@shared/schema";

interface Stats {
  totalChildren: number;
  active: number;
  paused: number;
  exited: number;
  totalDocuments: number;
  sponsored: number;
  nonSponsored: number;
}

/* ─── Count-up hook ──────────────────────────────────────────────── */
function useCountUp(target: number, enabled = true, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, enabled, duration]);
  return value;
}

/* ─── Animated donut chart ───────────────────────────────────────── */
interface DonutSegment { value: number; color: string; label: string; }

function DonutChart({
  segments,
  total,
  size = 180,
  strokeWidth = 20,
  animated = false,
}: {
  segments: DonutSegment[];
  total: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  // Start each segment rotated to -90 (top = 12 o'clock) + cumulative previous angles
  let cumulativeDeg = -90;

  return (
    <svg width={size} height={size} className="shrink-0">
      {/* Background track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-100 dark:text-slate-800"
      />
      {total > 0 && segments.map((seg, i) => {
        const fraction = seg.value / total;
        const len = animated ? fraction * C : 0;
        const rotateDeg = cumulativeDeg;
        cumulativeDeg += fraction * 360;
        if (seg.value === 0) return null;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${len} ${C}`}
            strokeLinecap="butt"
            transform={`rotate(${rotateDeg}, ${cx}, ${cy})`}
            style={{ transition: 'stroke-dasharray 0.85s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        );
      })}
    </svg>
  );
}

/* ─── Animated progress ring ─────────────────────────────────────── */
function ProgressRing({
  value,
  total,
  size = 160,
  strokeWidth = 16,
  color = "#ec4899",
  animated = false,
}: {
  value: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  animated?: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const fraction = total > 0 ? value / total : 0;
  const len = animated ? fraction * C : 0;
  const pct = Math.round(fraction * 100);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-100 dark:text-slate-800" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${len} ${C}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>{pct}%</span>
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Sponsored</span>
      </div>
    </div>
  );
}

/* ─── Newsletter management dialog ──────────────────────────────── */
function NewsletterManageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: newsletters, isLoading } = useQuery<Newsletter[]>({
    queryKey: ["/api/newsletters"],
  });

  const allIds = (newsletters ?? []).map((n) => n.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", "/api/newsletters/bulk", { ids: Array.from(selected) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: `${selected.size} newsletter${selected.size !== 1 ? "s" : ""} deleted` });
      setSelected(new Set());
      setConfirmOpen(false);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const singleDeleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/newsletters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({ title: "Newsletter deleted" });
      setSelected((prev) => { const next = new Set(prev); next.delete(singleDeleteMutation.variables as number); return next; });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const formatSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: string | Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected(new Set()); onOpenChange(v); }}>
        <DialogContent className="rounded-xl max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-violet-500" />
              Manage Newsletters
            </DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          <div className="shrink-0 flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-select-all-newsletters"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              {someSelected && (
                <span className="text-xs text-muted-foreground">
                  ({selected.size} selected)
                </span>
              )}
            </div>
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 rounded-lg text-xs gap-1.5"
                onClick={() => setConfirmOpen(true)}
                data-testid="button-delete-selected-newsletters"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selected.size} selected
              </Button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 py-1">
            {isLoading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : !newsletters?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Newspaper className="h-9 w-9 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No newsletters yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Upload a newsletter to see it here</p>
              </div>
            ) : (
              newsletters.map((nl) => (
                <div
                  key={nl.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
                    selected.has(nl.id)
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/40 hover:border-border/70 hover:bg-muted/30"
                  }`}
                  onClick={() => toggleOne(nl.id)}
                  data-testid={`newsletter-manage-row-${nl.id}`}
                >
                  <Checkbox
                    checked={selected.has(nl.id)}
                    onCheckedChange={() => toggleOne(nl.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                    data-testid={`checkbox-newsletter-${nl.id}`}
                  />
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                    <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{nl.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {nl.uploadedBy}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(nl.createdAt)}
                      </span>
                      {nl.targetProgram && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-violet-200/70 text-violet-700 dark:text-violet-400">
                          {nl.targetProgram}
                        </Badge>
                      )}
                      {nl.fileSize && (
                        <span className="text-xs text-muted-foreground/60">{formatSize(nl.fileSize)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={nl.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      title="Open file"
                      data-testid={`link-newsletter-open-${nl.id}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => singleDeleteMutation.mutate(nl.id)}
                      disabled={singleDeleteMutation.isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete"
                      data-testid={`button-delete-newsletter-${nl.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground mr-auto">
              {newsletters?.length ?? 0} newsletter{(newsletters?.length ?? 0) !== 1 ? "s" : ""} total
            </p>
            <Button variant="outline" className="rounded-lg" onClick={() => { setSelected(new Set()); onOpenChange(false); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} newsletter{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected newsletter{selected.size !== 1 ? "s" : ""} and their files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white"
              onClick={() => bulkDeleteMutation.mutate()}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Newsletter upload dialog ───────────────────────────────────── */
function NewsletterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [targetProgram, setTargetProgram] = useState("__all__");

  const { data: organizations } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/organizations"],
  });

  const reset = () => {
    setTitle("");
    setFile(null);
    setUploading(false);
    setTargetProgram("__all__");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const slotRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!slotRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await slotRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("File upload failed");

      const saveRes = await fetch("/api/newsletters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath,
          fileName: file.name,
          title: title.trim(),
          contentType: file.type,
          fileSize: file.size,
          targetProgram: targetProgram === "__all__" ? null : targetProgram,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save newsletter");

      await queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      const programLabel = targetProgram === "__all__" ? "all sponsors" : `sponsors in "${targetProgram}"`;
      toast({ title: "Newsletter uploaded", description: `"${title.trim()}" is now visible to ${programLabel}.` });
      handleClose(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const programOptions = [
    { value: "__all__", label: "All Programs", sub: "Every sponsor sees this newsletter" },
    ...(organizations ?? []).map((o) => ({ value: o.name, label: o.name, sub: `Only sponsors in ${o.name}` })),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-violet-500" />
            Upload Newsletter
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nl-title-dash" className="text-sm font-medium">Title</Label>
            <Input
              id="nl-title-dash"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring 2026 Newsletter"
              className="h-10 rounded-lg border-border/60"
              data-testid="input-newsletter-title-dash"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Send to</Label>
            <div className="grid gap-2">
              {programOptions.map((opt) => {
                const active = targetProgram === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetProgram(opt.value)}
                    data-testid={`button-nl-program-dash-${opt.value}`}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                      active
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10 dark:border-violet-500/40"
                        : "border-border/60 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-violet-500 bg-violet-500" : "border-muted-foreground/30"}`}>
                      {active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className={`text-sm font-medium leading-none ${active ? "text-violet-700 dark:text-violet-300" : ""}`}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">File</Label>
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/30 p-6 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="drop-zone-newsletter-dash"
            >
              {file ? (
                <div className="flex items-center gap-2 text-sm">
                  <Newspaper className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="font-medium truncate max-w-[220px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">Click to select a file<br /><span className="text-xs">PDF, Word, or any document</span></p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} data-testid="input-newsletter-file-dash" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => handleClose(false)}>Cancel</Button>
          <Button
            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            data-testid="button-upload-newsletter-dash"
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Status badge (exported for child-profile) ──────────────────── */
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
    paused: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
    exited: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25",
  };
  return (
    <Badge variant="outline" className={`${variants[status] || ""} capitalize font-medium text-xs px-2.5 py-0.5`}>
      {status}
    </Badge>
  );
}

export { StatusBadge };

/* ─── Dashboard ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const canEdit = user?.role !== "sponsor";
  const isAdmin = user?.role === "admin";
  const userOrgId = user?.organizationId;
  const [orgFilter, setOrgFilter] = useState<string>(userOrgId ? String(userOrgId) : "all");
  const [chartAnimated, setChartAnimated] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [newsletterManageOpen, setNewsletterManageOpen] = useState(false);

  const { data: organizations } = useQuery<Organization[]>({ queryKey: ["/api/organizations"] });

  const orgQueryParam = orgFilter !== "all" ? `?organizationId=${orgFilter}` : "";

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats", orgFilter],
    queryFn: async () => {
      const res = await fetch(`/api/stats${orgQueryParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Trigger chart animation after data loads
  useEffect(() => {
    if (!statsLoading && stats) {
      const t = setTimeout(() => setChartAnimated(true), 80);
      return () => clearTimeout(t);
    }
  }, [statsLoading, stats]);

  const total = stats?.totalChildren || 0;
  const active = stats?.active || 0;
  const sponsored = stats?.sponsored || 0;
  const paused = stats?.paused || 0;
  const inactive = stats?.exited || 0;
  const activeNonSponsored = Math.max(0, active - sponsored);
  const canSponsor = total - sponsored;

  // Count-up values (only after stats load)
  const totalCount = useCountUp(total, chartAnimated);
  const activeCount = useCountUp(active, chartAnimated);
  const sponsoredCount = useCountUp(sponsored, chartAnimated);
  const pausedCount = useCountUp(paused, chartAnimated);
  const inactiveCount = useCountUp(inactive, chartAnimated);

  const donutSegments: DonutSegment[] = [
    { value: activeNonSponsored, color: "#10b981", label: "Active" },
    { value: sponsored,          color: "#ec4899", label: "Sponsored" },
    { value: paused,             color: "#f59e0b", label: "Paused" },
    { value: inactive,           color: "#cbd5e1", label: "Inactive" },
  ];

  const metricRows = [
    { label: "Active",    count: activeCount,    raw: active,    color: "#10b981", dot: "bg-emerald-400", href: "/children?status=active", testId: "stat-active" },
    { label: "Sponsored", count: sponsoredCount, raw: sponsored, color: "#ec4899", dot: "bg-pink-400",    href: "/children?sponsored=sponsored", testId: "stat-sponsored" },
    { label: "Paused",    count: pausedCount,    raw: paused,    color: "#f59e0b", dot: "bg-amber-400",   href: "/children?status=paused", testId: "stat-paused" },
    { label: "Inactive",  count: inactiveCount,  raw: inactive,  color: "#94a3b8", dot: "bg-slate-300",   href: "/children?status=exited", testId: "stat-inactive" },
  ];

  return (
    <div className="flex-1 overflow-auto bg-slate-50/60 dark:bg-transparent">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10 space-y-8">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Welcome back, <span className="text-foreground font-semibold">{user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.username}</span>
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-none" data-testid="text-dashboard-title">
              Dashboard
            </h1>
            <p className="mt-2.5 text-base text-muted-foreground">Overview of child sponsorship records</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && organizations && organizations.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger className="w-[200px] h-10 rounded-xl border-border/60 bg-background" data-testid="select-org-filter">
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl h-10 px-4 border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 hover:border-violet-300 dark:border-violet-500/30 dark:text-violet-400 dark:hover:bg-violet-500/10"
                  onClick={() => setNewsletterOpen(true)}
                  data-testid="button-newsletter-dashboard"
                >
                  <Newspaper className="mr-2 h-4 w-4" />
                  Newsletter
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl h-10 px-4 border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 hover:border-violet-300 dark:border-violet-500/30 dark:text-violet-400 dark:hover:bg-violet-500/10"
                  onClick={() => setNewsletterManageOpen(true)}
                  data-testid="button-newsletter-manage"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage
                </Button>
              </div>
            )}
            {canEdit && (
              <Button asChild className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 dark:shadow-none font-medium" data-testid="button-add-child">
                <Link href="/children/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Child
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ── Two overview cards ──────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} className="rounded-2xl border-border/40 shadow-sm p-8">
                <Skeleton className="h-7 w-48 mb-6" />
                <div className="flex gap-8 items-center">
                  <Skeleton className="h-44 w-44 rounded-full shrink-0" />
                  <div className="flex-1 space-y-4">
                    {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-9 w-full" />)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">

            {/* ── Children Overview ─────────────────────────────── */}
            <Card className="rounded-2xl border-border/40 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white dark:bg-card overflow-hidden">
              <div className="p-7 sm:p-8">
                <div className="flex items-center gap-2.5 mb-7">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-[17px] font-semibold tracking-tight">Children Overview</h2>
                </div>

                <div className="flex items-center gap-7 sm:gap-10">
                  {/* Donut chart */}
                  <div className="relative shrink-0">
                    <DonutChart segments={donutSegments} total={total} animated={chartAnimated} size={172} strokeWidth={19} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-4xl font-bold tracking-tight" data-testid="stat-total">{totalCount}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Total</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {metricRows.map((row) => (
                      <Link key={row.label} href={row.href} data-testid={`link-${row.testId}`}>
                        <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${row.dot}`} />
                          <span className="flex-1 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{row.label}</span>
                          <span className="text-2xl font-bold tracking-tight" data-testid={row.testId}>{row.count}</span>
                          <span className="text-xs text-muted-foreground w-9 text-right tabular-nums">
                            {total > 0 ? `${Math.round((row.raw / total) * 100)}%` : "0%"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-between border-t border-border/40 pt-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                    {total} registered {total === 1 ? "child" : "children"}
                  </p>
                  <Link href="/children" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-2">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Card>

            {/* ── Sponsorship Overview ──────────────────────────── */}
            <Card className="rounded-2xl border-border/40 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white dark:bg-card overflow-hidden">
              <div className="p-7 sm:p-8">
                <div className="flex items-center gap-2.5 mb-7">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-500/10">
                    <Heart className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                  </div>
                  <h2 className="text-[17px] font-semibold tracking-tight">Sponsorship Overview</h2>
                </div>

                <div className="flex items-center gap-7 sm:gap-10">
                  {/* Progress ring */}
                  <ProgressRing value={sponsored} total={total} size={172} strokeWidth={19} color="#ec4899" animated={chartAnimated} />

                  {/* Stats column */}
                  <div className="flex-1 space-y-5 min-w-0">
                    <div className="rounded-xl bg-pink-50 dark:bg-pink-500/8 border border-pink-100 dark:border-pink-500/15 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-pink-500/80 dark:text-pink-400/80 mb-1.5">Sponsored Children</p>
                      <p className="text-5xl font-bold text-pink-600 dark:text-pink-400 tracking-tight leading-none" data-testid="stat-sponsored-count">{sponsoredCount}</p>
                    </div>

                    {canSponsor > 0 ? (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-100 dark:border-emerald-500/15 p-4">
                        <div className="flex items-start gap-2.5">
                          <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400 leading-snug">
                              Great progress!
                            </p>
                            <p className="text-[12px] text-emerald-600/80 dark:text-emerald-500/80 mt-0.5 leading-snug">
                              {canSponsor} more {canSponsor === 1 ? "child" : "children"} can be sponsored
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : total > 0 ? (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-100 dark:border-emerald-500/15 p-4">
                        <div className="flex items-start gap-2.5">
                          <Heart className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400 leading-snug">
                            All children are sponsored!
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-between border-t border-border/40 pt-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-pink-400" />
                    {stats?.nonSponsored || 0} unsponsored
                  </p>
                  <Link href="/children?sponsored=sponsored" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-2">
                    View sponsored <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        )}

      </div>
      <NewsletterDialog open={newsletterOpen} onOpenChange={setNewsletterOpen} />
      <NewsletterManageDialog open={newsletterManageOpen} onOpenChange={setNewsletterManageOpen} />
    </div>
  );
}
