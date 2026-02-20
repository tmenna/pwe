import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, FileText, Clock, UserCheck, UserX, Pause, Plus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  testId,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
  testId: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold" data-testid={testId}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    exited: "bg-red-500/10 text-red-700 dark:text-red-400",
  };
  return (
    <Badge variant="outline" className={`${variants[status] || ""} border-0 capitalize`}>
      {status}
    </Badge>
  );
}

export { StatusBadge };

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: children, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  const { data: recentTimeline, isLoading: timelineLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["/api/timeline/recent"],
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Overview of all child sponsorship records</p>
          </div>
          <Button asChild data-testid="button-add-child">
            <Link href="/children/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </Link>
          </Button>
        </div>

        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Children" value={stats?.totalChildren || 0} icon={Users} color="bg-primary/10 text-primary" testId="stat-total" />
            <StatCard label="Active" value={stats?.active || 0} icon={UserCheck} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" testId="stat-active" />
            <StatCard label="Paused" value={stats?.paused || 0} icon={Pause} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" testId="stat-paused" />
            <StatCard label="Documents" value={stats?.totalDocuments || 0} icon={FileText} color="bg-violet-500/10 text-violet-600 dark:text-violet-400" testId="stat-documents" />
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold" data-testid="text-recent-children">Recent Children</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/children" data-testid="link-view-all-children">
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
            ) : !children?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No children added yet</p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/children/new">Add your first child</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {children.slice(0, 5).map((child) => (
                  <Link key={child.id} href={`/children/${child.id}`}>
                    <div className="flex items-center gap-3 rounded-md p-3 hover-elevate" data-testid={`card-child-${child.id}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{child.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{child.childId} &middot; {child.location}</p>
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
              <h2 className="font-semibold" data-testid="text-recent-activity">Recent Activity</h2>
            </div>
            {timelineLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !recentTimeline?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTimeline.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="flex gap-3" data-testid={`timeline-entry-${entry.id}`}>
                    <div className="mt-1.5 flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <div className="mt-1 w-px flex-1 bg-border" />
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-sm font-medium">{entry.title}</p>
                      {entry.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{entry.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
