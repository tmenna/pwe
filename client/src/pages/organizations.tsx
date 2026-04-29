import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, AlertCircle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Organization } from "@shared/schema";

export default function Organizations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);

  const [form, setForm] = useState({ name: "", description: "" });
  const [editForm, setEditForm] = useState({ name: "", description: "" });

  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations", {
        name: form.name,
        description: form.description || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization created", description: `${form.name} has been added.` });
      setCreateOpen(false);
      setForm({ name: "", description: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/organizations/${editOrg!.id}`, {
        name: editForm.name,
        description: editForm.description || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization updated" });
      setEditOrg(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/organizations/${deleteOrg!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization deleted" });
      setDeleteOrg(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (org: Organization) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      description: org.description || "",
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center border-border/50">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">Only administrators can manage organizations.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-5 sm:p-8">
        <Skeleton className="mb-6 h-8 w-48 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10">
              <Building2 className="h-5 w-5 text-orange-500 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-organizations-title">Organizations</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage partner organizations and group assignments</p>
            </div>
          </div>
          <Button size="sm" className="rounded-lg shadow-sm h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)} data-testid="button-add-organization">
            <Plus className="mr-2 h-4 w-4" />
            Add Organization
          </Button>
        </div>

        <div className="space-y-3">
          {organizations?.map((org) => (
            <Card key={org.id} className="border-border/50 transition-all duration-150 hover:shadow-sm" data-testid={`card-organization-${org.id}`}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10">
                    <Building2 className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" data-testid={`text-org-name-${org.id}`}>{org.name}</span>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25 text-xs font-medium">
                        ID: {org.id}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground truncate" data-testid={`text-org-description-${org.id}`}>
                      {org.description || <span className="italic">No description</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Created {org.createdAt ? new Date(org.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-4">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => openEdit(org)} data-testid={`button-edit-org-${org.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-destructive/8 hover:text-destructive" onClick={() => setDeleteOrg(org)} data-testid={`button-delete-org-${org.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {organizations?.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-16 text-center border-border/50" data-testid="text-no-organizations">
              <Building2 className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="mb-1.5 text-base font-semibold">No organizations yet</h3>
              <p className="text-sm text-muted-foreground mb-5">Create your first organization to group children and assign staff.</p>
              <Button size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Organization
              </Button>
            </Card>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-5 pt-2"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Organization name"
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-new-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="rounded-lg border-border/60"
                  data-testid="input-new-org-description"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createMutation.isPending} data-testid="button-confirm-create-org">
                  {createMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit Organization: {editOrg?.name}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="space-y-5 pt-2"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Organization name"
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-edit-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="rounded-lg border-border/60"
                  data-testid="input-edit-org-description"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setEditOrg(null)}>Cancel</Button>
                <Button type="submit" className="rounded-lg shadow-sm" disabled={updateMutation.isPending} data-testid="button-confirm-edit-org">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteOrg} onOpenChange={(open) => !open && setDeleteOrg(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Organization</DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <AlertCircle className="h-4.5 w-4.5 text-destructive" />
              </div>
              <p className="text-sm leading-relaxed">
                Are you sure you want to delete <strong>{deleteOrg?.name}</strong>? Children assigned to this organization will become unassigned. This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setDeleteOrg(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-lg shadow-sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-org"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
