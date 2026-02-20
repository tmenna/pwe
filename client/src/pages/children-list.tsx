import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Plus, Search, Users, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "./dashboard";
import type { Child } from "@shared/schema";

export default function ChildrenList() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  const filtered = children?.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.childId.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-children-title">Children</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage all child profiles and records
            </p>
          </div>
          <Button asChild data-testid="button-add-child-list">
            <Link href="/children/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </Link>
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-children"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="exited">Exited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-24 w-full" />
              </Card>
            ))}
          </div>
        ) : !filtered?.length ? (
          <Card className="flex flex-col items-center justify-center p-16 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-2 text-lg font-semibold">No children found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Add your first child to get started"}
            </p>
            {!search && statusFilter === "all" && (
              <Button asChild>
                <Link href="/children/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Child
                </Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((child) => (
              <Link key={child.id} href={`/children/${child.id}`}>
                <Card className="p-5 hover-elevate cursor-pointer" data-testid={`card-child-list-${child.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="overflow-hidden">
                          <p className="truncate font-medium">{child.fullName}</p>
                          <p className="text-xs text-muted-foreground">{child.childId}</p>
                        </div>
                        <StatusBadge status={child.status} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>Age {child.age}</span>
                    <span className="capitalize">{child.gender}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {child.location}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{child.programEnrollment}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
