import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Building2, MessageSquare, ArrowRight, Users, Heart, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { Organization, Message } from "@shared/schema";

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
  const canEdit = user?.role !== "read_only";
  const isAdmin = user?.role === "admin";
  const userOrgId = user?.organizationId;
  const [orgFilter, setOrgFilter] = useState<string>(userOrgId ? String(userOrgId) : "all");
  const [chartAnimated, setChartAnimated] = useState(false);

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

  const { data: pendingMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages/pending"],
    enabled: user?.role === "admin" || user?.role === "case_worker",
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
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* ── Pending Messages ────────────────────────────────────── */}
        {(user?.role === "admin" || user?.role === "case_worker") && pendingMessages && pendingMessages.length > 0 && (
          <Card className="rounded-2xl border-border/40 shadow-sm bg-white dark:bg-card p-7 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5" data-testid="text-pending-messages">
                <span className="inline-block w-1 h-5 rounded-full bg-amber-500" />
                Pending Messages ({pendingMessages.length})
              </h2>
            </div>
            <div className="space-y-1">
              {pendingMessages.slice(0, 5).map((msg) => (
                <Link key={msg.id} href={`/children/${msg.childId}`}>
                  <div className="flex items-start gap-3 rounded-xl p-3 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent hover:border-border/40" data-testid={`pending-msg-${msg.id}`}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">From {msg.senderName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{msg.content}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 text-[10px]">
                      Pending
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
