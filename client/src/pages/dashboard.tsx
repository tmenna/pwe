import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, UserCheck, Pause, Plus, Building2, MessageSquare, Heart } from "lucide-react";
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

export default function Dashboard() {
  const { user } = useAuth();
  const canEdit = user?.role !== "read_only";
  const isAdmin = user?.role === "admin";
  const userOrgId = user?.organizationId;
  const [orgFilter, setOrgFilter] = useState<string>(userOrgId ? String(userOrgId) : "all");

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

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
          {isAdmin && organizations && organizations.length > 0 && (
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-full sm:w-[280px] h-10 rounded-lg border-border/60" data-testid="select-org-filter">
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
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            <StatCard
              label="Total Children"
              value={stats?.totalChildren || 0}
              icon={Users}
              accentColor="bg-blue-500"
              iconBg="bg-blue-50 dark:bg-blue-500/10"
              iconColor="text-blue-600 dark:text-blue-400"
              valueTint="text-blue-700 dark:text-blue-300"
              testId="stat-total"
              href="/children?status=all"
            />
            <StatCard
              label="Active"
              value={stats?.active || 0}
              icon={UserCheck}
              accentColor="bg-emerald-500"
              iconBg="bg-emerald-50 dark:bg-emerald-500/10"
              iconColor="text-emerald-600 dark:text-emerald-400"
              valueTint="text-emerald-700 dark:text-emerald-300"
              testId="stat-active"
              href="/children?status=active"
            />
            <StatCard
              label="Paused"
              value={stats?.paused || 0}
              icon={Pause}
              accentColor="bg-amber-500"
              iconBg="bg-amber-50 dark:bg-amber-500/10"
              iconColor="text-amber-600 dark:text-amber-400"
              valueTint="text-amber-700 dark:text-amber-300"
              testId="stat-paused"
              href="/children?status=paused"
            />
            <StatCard
              label="Sponsored"
              value={stats?.sponsored || 0}
              icon={Heart}
              accentColor="bg-pink-500"
              iconBg="bg-pink-50 dark:bg-pink-500/10"
              iconColor="text-pink-600 dark:text-pink-400"
              valueTint="text-pink-700 dark:text-pink-300"
              testId="stat-sponsored"
              href="/children?sponsored=sponsored"
            />
          </div>
        )}

        {(user?.role === "admin" || user?.role === "case_worker") && pendingMessages && pendingMessages.length > 0 && (
          <Card className="mt-6 border-border/50 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2.5" data-testid="text-pending-messages">
                <span className="inline-block w-1 h-5 rounded-full bg-amber-500" />
                Pending Messages ({pendingMessages.length})
              </h2>
            </div>
            <div className="space-y-2">
              {pendingMessages.slice(0, 5).map((msg) => (
                <Link key={msg.id} href={`/children/${msg.childId}`}>
                  <div className="flex items-start gap-3 rounded-xl p-3 transition-all duration-150 hover:bg-primary/[0.04] border border-transparent hover:border-primary/10" data-testid={`pending-msg-${msg.id}`}>
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
