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
  color,
  bgColor,
  testId,
  href,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
  bgColor: string;
  testId: string;
  href?: string;
}) {
  const content = (
    <Card className={`relative overflow-hidden p-4 sm:p-5 transition-all duration-200 ${href ? "cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5" : ""}`}>
      <div className={`absolute inset-0 ${bgColor} opacity-[0.04]`} />
      <div className="relative flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground/80 uppercase tracking-wide sm:text-sm">{label}</p>
          <p className="mt-1.5 text-2xl font-bold sm:text-3xl" data-testid={testId}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 ${color}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
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
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    exited: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`${variants[status] || ""} capitalize font-medium text-xs px-2.5`}>
      {status}
    </Badge>
  );
}

export { StatusBadge };

const timelineDotColors: Record<string, string> = {
  milestone: "bg-primary",
  document: "bg-blue-500",
  status_change: "bg-amber-500",
  note: "bg-violet-500",
  manual: "bg-slate-500",
};

const timelineIconColors: Record<string, string> = {
  milestone: "text-primary",
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
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 space-y-4 sm:mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold sm:text-2xl" data-testid="text-dashboard-title">Dashboard</h1>
              <p className="mt-1 text-xs text-foreground/60 sm:text-sm">Overview of all child sponsorship records</p>
            </div>
            {canEdit && (
              <Button asChild size="sm" data-testid="button-add-child">
                <Link href="/children/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Child
                </Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-location-filter">
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
              <Card key={i} className="p-5">
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label="Total Children" value={filteredStats?.totalChildren || 0} icon={Users} color="bg-primary/15 text-primary" bgColor="bg-primary" testId="stat-total" href={`/children?status=all${locationParam}`} />
            <StatCard label="Active" value={filteredStats?.active || 0} icon={UserCheck} color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" bgColor="bg-emerald-500" testId="stat-active" href={`/children?status=active${locationParam}`} />
            <StatCard label="Paused" value={filteredStats?.paused || 0} icon={Pause} color="bg-amber-500/15 text-amber-600 dark:text-amber-400" bgColor="bg-amber-500" testId="stat-paused" href={`/children?status=paused${locationParam}`} />
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold flex items-center gap-2" data-testid="text-recent-children">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                {locationFilter === "all" ? "Recent Children" : `Children in ${locationFilter}`}
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/children${locationParam ? `?status=all${locationParam}` : ""}`} data-testid="link-view-all-children">
                  View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {childrenLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !filteredChildren?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {locationFilter === "all" ? "No children added yet" : `No children in ${locationFilter}`}
                </p>
                {canEdit && locationFilter === "all" && (
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href="/children/new">Add your first child</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredChildren.slice(0, 5).map((child) => (
                  <Link key={child.id} href={`/children/${child.id}`}>
                    <div className="flex items-center gap-3 rounded-lg p-3 transition-all duration-150 hover:bg-primary/5 hover:shadow-sm border border-transparent hover:border-primary/15" data-testid={`card-child-${child.id}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{child.fullName}</p>
                        <p className="truncate text-xs text-foreground/50">{child.childId} &middot; {child.location}</p>
                      </div>
                      <StatusBadge status={child.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold flex items-center gap-2" data-testid="text-recent-activity">
                <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                Recent Activity
              </h2>
            </div>
            {timelineLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !filteredTimeline?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {locationFilter === "all" ? "No activity recorded yet" : `No activity for ${locationFilter}`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTimeline.slice(0, 6).map((entry) => {
                  const EntryIcon = getTimelineIcon(entry.entryType);
                  const dotColor = timelineDotColors[entry.entryType] || "bg-slate-400";
                  const iconColor = timelineIconColors[entry.entryType] || "text-slate-400";
                  return (
                    <div key={entry.id} className="flex gap-3" data-testid={`timeline-entry-${entry.id}`}>
                      <div className="mt-0.5 flex flex-col items-center">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full ${dotColor}/15`}>
                          <EntryIcon className={`h-3 w-3 ${iconColor}`} />
                        </div>
                        <div className="mt-1 w-px flex-1 bg-border" />
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-sm font-medium">{entry.title}</p>
                        {entry.description && (
                          <p className="mt-0.5 text-xs text-foreground/50 line-clamp-1">{entry.description}</p>
                        )}
                        <p className="mt-1 text-xs text-foreground/45">
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
