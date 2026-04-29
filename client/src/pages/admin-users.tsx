import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Pencil, Trash2, UserCog, AlertCircle, Building2,
  Shield, Eye, Heart, Users, Baby, MessageSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Organization } from "@shared/schema";

type SafeUser = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  organizationId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ChildSummary = {
  id: number;
  childId: string;
  fullName: string;
  status: string;
  sponsorUserId: string | null;
  sponsorCanComment: boolean | null;
};

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  case_worker: "Case Worker",
  read_only: "Read Only",
  sponsor: "Sponsor",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25",
  case_worker: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
  read_only: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/25",
  sponsor: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/25",
};

const roleIcons: Record<string, React.ElementType> = {
  admin: Shield,
  case_worker: Users,
  read_only: Eye,
  sponsor: Heart,
};

const rolePermissionDesc: Record<string, string> = {
  admin: "Full access — all children, settings, and user management",
  case_worker: "Can create and edit children, documents, and messages",
  read_only: "View-only access to assigned children",
  sponsor: "View-only portal for their assigned child",
};

const emptyCreate = {
  username: "", password: "", firstName: "", lastName: "",
  role: "case_worker", organizationId: "", sponsorChildId: "",
};
const emptyEdit = {
  username: "", firstName: "", lastName: "", role: "case_worker",
  password: "", organizationId: "", sponsorChildId: "", sponsorCanComment: false,
};

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null);
  const [form, setForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState(emptyEdit);

  const { data: users, isLoading } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });

  const { data: organizations } = useQuery<Organization[]>({ queryKey: ["/api/organizations"] });

  const { data: children } = useQuery<ChildSummary[]>({ queryKey: ["/api/children"] });

  const getAssignedChild = (userId: string) =>
    children?.find((c) => c.sponsorUserId === userId) ?? null;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", {
        username: form.username,
        password: form.password,
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        email: form.username || null,
        role: form.role,
        organizationId: form.organizationId ? parseInt(form.organizationId) : null,
      });
      const newUser = await res.json();
      if (form.role === "sponsor" && form.sponsorChildId) {
        await apiRequest("POST", `/api/users/${newUser.id}/assign-child`, {
          childId: parseInt(form.sponsorChildId),
        });
      }
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({ title: "User created", description: `${form.username} has been added.` });
      setCreateOpen(false);
      setForm(emptyCreate);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        username: editForm.username,
        firstName: editForm.firstName || null,
        lastName: editForm.lastName || null,
        email: editForm.username || null,
        role: editForm.role,
        organizationId: editForm.organizationId ? parseInt(editForm.organizationId) : null,
      };
      if (editForm.password) body.password = editForm.password;
      await apiRequest("PATCH", `/api/users/${editUser!.id}`, body);

      if (editForm.role === "sponsor") {
        const currentChild = getAssignedChild(editUser!.id);
        const newChildId = editForm.sponsorChildId ? parseInt(editForm.sponsorChildId) : null;
        const currentChildId = currentChild?.id ?? null;
        if (newChildId !== currentChildId) {
          await apiRequest("POST", `/api/users/${editUser!.id}/assign-child`, { childId: newChildId });
        }
        // Update sponsorCanComment on the assigned child (current or new)
        const targetChildId = newChildId ?? currentChildId;
        if (targetChildId !== null) {
          const prevCanComment = currentChild?.sponsorCanComment ?? false;
          if (editForm.sponsorCanComment !== prevCanComment || newChildId !== currentChildId) {
            await apiRequest("PATCH", `/api/children/${targetChildId}`, {
              sponsorCanComment: editForm.sponsorCanComment,
            });
          }
        }
      } else {
        const currentChild = getAssignedChild(editUser!.id);
        if (currentChild) {
          await apiRequest("POST", `/api/users/${editUser!.id}/assign-child`, { childId: null });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({ title: "User updated" });
      setEditUser(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/users/${deleteUser!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({ title: "User deleted" });
      setDeleteUser(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (u: SafeUser) => {
    const assignedChild = children?.find((c) => c.sponsorUserId === u.id);
    setEditUser(u);
    setEditForm({
      username: u.username,
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      role: u.role,
      password: "",
      organizationId: u.organizationId ? String(u.organizationId) : "",
      sponsorChildId: assignedChild ? String(assignedChild.id) : "",
      sponsorCanComment: assignedChild?.sponsorCanComment ?? false,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-5 sm:p-8">
        <Skeleton className="mb-6 h-8 w-48 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10">
              <UserCog className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">User Management</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage portal accounts, roles, and child assignments</p>
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-lg shadow-sm h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setCreateOpen(true)}
            data-testid="button-add-user"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* User list */}
        <div className="space-y-3">
          {users?.map((u) => {
            const RoleIcon = roleIcons[u.role] || Shield;
            const assignedChild = getAssignedChild(u.id);
            const assignedOrg = u.organizationId ? organizations?.find((o) => o.id === u.organizationId) : null;
            const displayName = u.firstName || u.lastName
              ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
              : null;

            return (
              <Card key={u.id} className="border-border/50 transition-all duration-150 hover:shadow-sm" data-testid={`card-user-${u.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Avatar initials */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${roleBadgeColors[u.role]?.split(" ").slice(0, 2).join(" ") || "bg-muted text-muted-foreground"}`}>
                        {(u.firstName?.[0] || u.username?.[0] || "?").toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[15px]" data-testid={`text-username-${u.id}`}>
                            {displayName || u.username}
                          </span>
                          <Badge
                            variant="outline"
                            className={`${roleBadgeColors[u.role] || ""} text-xs font-medium flex items-center gap-1`}
                            data-testid={`badge-role-${u.id}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {roleLabels[u.role] || u.role}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mt-0.5" data-testid={`text-user-email-${u.id}`}>
                          {u.username}
                        </p>

                        {/* Access/permissions summary */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {u.role === "sponsor" && (
                            assignedChild ? (
                              <>
                                <div className="flex items-center gap-1.5 rounded-md bg-pink-50 dark:bg-pink-500/10 border border-pink-200/60 dark:border-pink-500/20 px-2.5 py-1" data-testid={`badge-assigned-child-${u.id}`}>
                                  <Baby className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                                  <span className="text-xs font-medium text-pink-700 dark:text-pink-300">
                                    {assignedChild.fullName}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] px-1 h-4 capitalize border-pink-200/60 text-pink-600">
                                    {assignedChild.status}
                                  </Badge>
                                </div>
                                <div
                                  className={`flex items-center gap-1 rounded-md border px-2 py-1 ${assignedChild.sponsorCanComment ? "bg-emerald-50 border-emerald-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/20" : "bg-muted/40 border-border/40"}`}
                                  data-testid={`badge-commenting-${u.id}`}
                                >
                                  <MessageSquare className={`h-3 w-3 ${assignedChild.sponsorCanComment ? "text-emerald-600" : "text-muted-foreground/50"}`} />
                                  <span className={`text-[11px] font-medium ${assignedChild.sponsorCanComment ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/60"}`}>
                                    {assignedChild.sponsorCanComment ? "Commenting on" : "Commenting off"}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic" data-testid={`text-no-child-${u.id}`}>
                                No child assigned yet
                              </span>
                            )
                          )}
                          {u.role !== "sponsor" && assignedOrg && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25 text-xs font-medium" data-testid={`badge-org-${u.id}`}>
                              <Building2 className="mr-1 h-3 w-3" />
                              {assignedOrg.name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground/60">
                            {u.role === "sponsor" && assignedChild
                              ? "View-only access to assigned child's profile"
                              : rolePermissionDesc[u.role]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg gap-1.5 text-sm"
                        onClick={() => openEdit(u)}
                        data-testid={`button-edit-${u.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-destructive/8 hover:text-destructive"
                        onClick={() => setDeleteUser(u)}
                        data-testid={`button-delete-${u.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {users?.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <UserCog className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p>No users yet. Add one to get started.</p>
            </div>
          )}
        </div>

        {/* ── Create dialog ─────────────────────────── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                Create New User
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="space-y-5 pt-1"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium">Username (Email Address)</Label>
                <Input
                  type="email"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  placeholder="user@example.com"
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-new-username"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-new-password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">First Name</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="h-11 rounded-lg border-border/60"
                    data-testid="input-new-firstname"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="h-11 rounded-lg border-border/60"
                    data-testid="input-new-lastname"
                  />
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Role */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v, organizationId: v === "sponsor" ? "" : f.organizationId, sponsorChildId: v !== "sponsor" ? "" : f.sponsorChildId }))}
                >
                  <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="case_worker">Case Worker</SelectItem>
                    <SelectItem value="read_only">Read Only</SelectItem>
                    <SelectItem value="sponsor">Sponsor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{rolePermissionDesc[form.role]}</p>
              </div>

              {/* Organization — for non-sponsor, non-admin */}
              {form.role !== "sponsor" && form.role !== "admin" && organizations && organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Organization <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select
                    value={form.organizationId || "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-new-organization">
                      <SelectValue placeholder="No organization assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No organization (sees all children)</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Child assignment — for sponsor */}
              {form.role === "sponsor" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Baby className="h-3.5 w-3.5 text-pink-500" />
                    Assigned Child Profile
                  </Label>
                  <Select
                    value={form.sponsorChildId || "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, sponsorChildId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-new-sponsor-child">
                      <SelectValue placeholder="No child assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No child assigned yet</SelectItem>
                      {children?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.fullName} — {c.childId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The sponsor will only be able to view this child's profile and progress.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  type="submit"
                  className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={createMutation.isPending}
                  data-testid="button-confirm-create-user"
                >
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Edit dialog ───────────────────────────── */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit User
              </DialogTitle>
              {editUser && (
                <p className="text-sm text-muted-foreground mt-1">{editUser.username}</p>
              )}
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
              className="space-y-5 pt-1"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium">Username (Email Address)</Label>
                <Input
                  type="email"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-edit-username"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">First Name</Label>
                  <Input
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="h-11 rounded-lg border-border/60"
                    data-testid="input-edit-firstname"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Name</Label>
                  <Input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="h-11 rounded-lg border-border/60"
                    data-testid="input-edit-lastname"
                  />
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Role */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({
                    ...f,
                    role: v,
                    organizationId: v === "sponsor" || v === "admin" ? "" : f.organizationId,
                    sponsorChildId: v !== "sponsor" ? "" : f.sponsorChildId,
                  }))}
                >
                  <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="case_worker">Case Worker</SelectItem>
                    <SelectItem value="read_only">Read Only</SelectItem>
                    <SelectItem value="sponsor">Sponsor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{rolePermissionDesc[editForm.role]}</p>
              </div>

              {/* Organization — for non-sponsor, non-admin */}
              {editForm.role !== "sponsor" && editForm.role !== "admin" && organizations && organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Organization <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Select
                    value={editForm.organizationId || "none"}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, organizationId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-edit-organization">
                      <SelectValue placeholder="No organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No organization (sees all children)</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Child assignment — for sponsor */}
              {editForm.role === "sponsor" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Baby className="h-3.5 w-3.5 text-pink-500" />
                    Assigned Child Profile
                  </Label>
                  <Select
                    value={editForm.sponsorChildId || "none"}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, sponsorChildId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-edit-sponsor-child">
                      <SelectValue placeholder="No child assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Remove child assignment</SelectItem>
                      {children?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.fullName} — {c.childId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The sponsor will only be able to view this child's profile and progress.
                  </p>

                  {/* Sponsor commenting toggle */}
                  {editForm.sponsorChildId && (
                    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3 mt-1">
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium leading-none">Allow sponsor commenting</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {editForm.sponsorCanComment
                              ? "Sponsor can send messages from their portal"
                              : "Sponsor cannot send messages right now"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.sponsorCanComment}
                        onCheckedChange={(v) => setEditForm((f) => ({ ...f, sponsorCanComment: v }))}
                        data-testid="switch-sponsor-can-comment"
                      />
                    </div>
                  )}
                </div>
              )}

              <Separator className="opacity-50" />

              {/* Password reset */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></Label>
                <Input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-edit-password"
                />
              </div>

              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button
                  type="submit"
                  className="rounded-lg shadow-sm"
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-edit-user"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete dialog ─────────────────────────── */}
        <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm leading-relaxed">
                  Are you sure you want to delete <strong>{deleteUser?.username}</strong>? This action cannot be undone.
                </p>
                {deleteUser?.role === "sponsor" && getAssignedChild(deleteUser.id) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Their child assignment ({getAssignedChild(deleteUser.id)?.fullName}) will also be cleared.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setDeleteUser(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-lg shadow-sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-user"
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
