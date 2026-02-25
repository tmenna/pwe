import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, FileText, Clock, UserCheck, UserX, Pause, Plus, ArrowRight, MapPin, Milestone, MessageSquare, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { Child, TimelineEntry } from "@shared/schema";

interface Stats {
  totalChildren: number;
  active: number;
  paused: number;
  exited: number;
  totalDocuments: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentColor,
  iconBg,
  iconColor,
  valueTint,
  testId,
  href,
}: {
  label: string;
  value: number | string;
  icon: any;
  accentColor: string;
  iconBg: string;
  iconColor: string;
  valueTint: string;
  testId: string;
  href?: string;
}) {
  const content = (
    <Card className={`relative overflow-hidden transition-all duration-200 border-border/50 ${href ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
      <div className="p-5 sm:p-6 pl-5 sm:pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`mt-2.5 text-3xl font-bold tracking-tight ${valueTint}`} data-testid={testId}>{value}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href} data-testid={`link-${testId}`}>{content}</Link>;
  }
  return content;
}

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

const timelineDotColors: Record<string, string> = {
  milestone: "bg-emerald-500/12",
  document: "bg-blue-500/12",
  status_change: "bg-amber-500/12",
  note: "bg-violet-500/12",
  manual: "bg-slate-500/12",
};

const timelineIconColors: Record<string, string> = {
  milestone: "text-emerald-600",
  document: "text-blue-500",
  status_change: "text-amber-500",
  note: "text-violet-500",
  manual: "text-slate-500",
};

export default function Dashboard() {
  const { user } = useAuth();
  const canEdit = user?.role !== "read_only";
  const [locationFilter, setLocationFilter] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: allChildren, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  const { data: recentTimeline, isLoading: timelineLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["/api/timeline/recent"],
  });

  const locations = useMemo(() => {
    if (!allChildren) return [];
    const locSet = new Set<string>();
    allChildren.forEach((c) => locSet.add(c.location));
    return Array.from(locSet).sort();
  }, [allChildren]);

  const filteredChildren = useMemo(() => {
    if (!allChildren) return [];
    if (locationFilter === "all") return allChildren;
    return allChildren.filter((c) => c.location === locationFilter);
  }, [allChildren, locationFilter]);

  const filteredChildIds = useMemo(() => {
    return new Set(filteredChildren.map((c) => c.id));
  }, [filteredChildren]);

  const filteredTimeline = useMemo(() => {
    if (!recentTimeline || locationFilter === "all") return recentTimeline;
    return recentTimeline.filter((e) => filteredChildIds.has(e.childId));
  }, [recentTimeline, locationFilter, filteredChildIds]);

  const filteredStats = useMemo(() => {
    if (locationFilter === "all") return stats;
    return {
      totalChildren: filteredChildren.length,
      active: filteredChildren.filter((c) => c.status === "active").length,
      paused: filteredChildren.filter((c) => c.status === "paused").length,
      exited: filteredChildren.filter((c) => c.status === "exited").length,
      totalDocuments: stats?.totalDocuments || 0,
    };
  }, [stats, filteredChildren, locationFilter]);

  const locationParam = locationFilter !== "all" ? `&location=${encodeURIComponent(locationFilter)}` : "";

  function getTimelineIcon(entryType: string) {
    switch (entryType) {
      case "milestone": return Milestone;
      case "document": return FileText;
      case "status_change": return RefreshCw;
      case "note": return MessageSquare;
      default: return Clock;
    }
  }

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]" data-testid="text-dashboard-title">Dashboard</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Overview of all child sponsorship records</p>
            </div>
            {canEdit && (
              <Button asChild size="sm" className="rounded-lg shadow-sm h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-add-child">
                <Link href="/children/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Child
                </Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[280px] h-10 rounded-lg border-border/60" data-testid="select-location-filter">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
            <StatCard
              label="Total Children"
              value={filteredStats?.totalChildren || 0}
              icon={Users}
              accentColor="bg-blue-500"
              iconBg="bg-blue-50 dark:bg-blue-500/10"
              iconColor="text-blue-600 dark:text-blue-400"
              valueTint="text-blue-700 dark:text-blue-300"
              testId="stat-total"
              href={`/children?status=all${locationParam}`}
            />
            <StatCard
              label="Active"
              value={filteredStats?.active || 0}
              icon={UserCheck}
              accentColor="bg-emerald-500"
              iconBg="bg-emerald-50 dark:bg-emerald-500/10"
              iconColor="text-emerald-600 dark:text-emerald-400"
              valueTint="text-emerald-700 dark:text-emerald-300"
              testId="stat-active"
              href={`/children?status=active${locationParam}`}
            />
            <StatCard
              label="Paused"
              value={filteredStats?.paused || 0}
              icon={Pause}
              accentColor="bg-amber-500"
              iconBg="bg-amber-50 dark:bg-amber-500/10"
              iconColor="text-amber-600 dark:text-amber-400"
              valueTint="text-amber-700 dark:text-amber-300"
              testId="stat-paused"
              href={`/children?status=paused${locationParam}`}
            />
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5" data-testid="text-recent-children">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                {locationFilter === "all" ? "Recent Children" : `Children in ${locationFilter}`}
              </h2>
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link href={`/children${locationParam ? `?status=all${locationParam}` : ""}`} data-testid="link-view-all-children">
                  View All <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {childrenLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !filteredChildren?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {locationFilter === "all" ? "No children added yet" : `No children in ${locationFilter}`}
                </p>
                {canEdit && locationFilter === "all" && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-lg" asChild>
                    <Link href="/children/new">Add your first child</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredChildren.slice(0, 5).map((child) => (
                  <Link key={child.id} href={`/children/${child.id}`}>
                    <div className="flex items-center gap-3 rounded-xl p-3 transition-all duration-150 hover:bg-primary/[0.04] border border-transparent hover:border-primary/10" data-testid={`card-child-${child.id}`}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-sm font-semibold text-primary">
                        {child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{child.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground mt-0.5">{child.childId} · {child.location}</p>
                      </div>
                      <StatusBadge status={child.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-border/50 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5" data-testid="text-recent-activity">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                Recent Activity
              </h2>
            </div>
            {timelineLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !filteredTimeline?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {locationFilter === "all" ? "No activity recorded yet" : `No activity for ${locationFilter}`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTimeline.slice(0, 6).map((entry) => {
                  const EntryIcon = getTimelineIcon(entry.entryType);
                  const dotBg = timelineDotColors[entry.entryType] || "bg-slate-500/12";
                  const iconColor = timelineIconColors[entry.entryType] || "text-slate-400";
                  return (
                    <div key={entry.id} className="flex gap-3 py-1" data-testid={`timeline-entry-${entry.id}`}>
                      <div className="mt-0.5 flex flex-col items-center">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${dotBg}`}>
                          <EntryIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                        </div>
                        <div className="mt-1.5 w-px flex-1 bg-border/60" />
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-sm font-medium">{entry.title}</p>
                        {entry.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{entry.description}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
