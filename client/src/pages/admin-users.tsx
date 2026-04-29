import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sponsor: "View-only portal for their assigned children",
};

type EditForm = {
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  password: string;
  organizationId: string;
  sponsorChildIds: number[];
  sponsorCommentingMap: Record<number, boolean>;
};

type CreateForm = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  sponsorChildIds: number[];
};

const emptyCreate: CreateForm = {
  username: "", password: "", firstName: "", lastName: "",
  role: "case_worker", organizationId: "", sponsorChildIds: [],
};

const emptyEdit: EditForm = {
  username: "", firstName: "", lastName: "", role: "case_worker",
  password: "", organizationId: "", sponsorChildIds: [], sponsorCommentingMap: {},
};

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null);
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [editForm, setEditForm] = useState<EditForm>(emptyEdit);

  const { data: users, isLoading } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const { data: organizations } = useQuery<Organization[]>({ queryKey: ["/api/organizations"] });
  const { data: children } = useQuery<ChildSummary[]>({ queryKey: ["/api/children"] });

  const getAssignedChildren = (userId: string): ChildSummary[] =>
    children?.filter((c) => c.sponsorUserId === userId) ?? [];

  const toggleSponsorChild = (childId: number, checked: boolean, setter: (fn: (prev: EditForm) => EditForm) => void) => {
    setter((f) => {
      const ids = checked
        ? [...f.sponsorChildIds.filter((id) => id !== childId), childId]
        : f.sponsorChildIds.filter((id) => id !== childId);
      const map = { ...f.sponsorCommentingMap };
      if (!checked) delete map[childId];
      return { ...f, sponsorChildIds: ids, sponsorCommentingMap: map };
    });
  };

  const toggleCommenting = (childId: number, value: boolean, setter: (fn: (prev: EditForm) => EditForm) => void) => {
    setter((f) => ({ ...f, sponsorCommentingMap: { ...f.sponsorCommentingMap, [childId]: value } }));
  };

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

      if (form.role === "sponsor" && form.sponsorChildIds.length > 0) {
        await apiRequest("POST", `/api/users/${newUser.id}/assign-child`, {
          childIds: form.sponsorChildIds,
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
        // Reconcile child assignments
        await apiRequest("POST", `/api/users/${editUser!.id}/assign-child`, {
          childIds: editForm.sponsorChildIds,
        });
        // Update sponsorCanComment for each assigned child
        const prevChildren = getAssignedChildren(editUser!.id);
        for (const childId of editForm.sponsorChildIds) {
          const prev = prevChildren.find((c) => c.id === childId);
          const newCanComment = editForm.sponsorCommentingMap[childId] ?? false;
          if (newCanComment !== (prev?.sponsorCanComment ?? false) || !prev) {
            await apiRequest("PATCH", `/api/children/${childId}`, { sponsorCanComment: newCanComment });
          }
        }
      } else {
        // Switching away from sponsor — remove all child assignments
        const prevChildren = getAssignedChildren(editUser!.id);
        if (prevChildren.length > 0) {
          await apiRequest("POST", `/api/users/${editUser!.id}/assign-child`, { childIds: [] });
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
    const assignedChildren = getAssignedChildren(u.id);
    const commentingMap: Record<number, boolean> = {};
    for (const c of assignedChildren) {
      commentingMap[c.id] = c.sponsorCanComment ?? false;
    }
    setEditUser(u);
    setEditForm({
      username: u.username,
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      role: u.role,
      password: "",
      organizationId: u.organizationId ? String(u.organizationId) : "",
      sponsorChildIds: assignedChildren.map((c) => c.id),
      sponsorCommentingMap: commentingMap,
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
            const assignedChildren = getAssignedChildren(u.id);
            const assignedOrg = u.organizationId ? organizations?.find((o) => o.id === u.organizationId) : null;
            const displayName = u.firstName || u.lastName
              ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
              : null;

            return (
              <Card key={u.id} className="border-border/50 transition-all duration-150 hover:shadow-sm" data-testid={`card-user-${u.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
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

                        {/* Access summary */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {u.role === "sponsor" && (
                            assignedChildren.length > 0 ? (
                              <>
                                {assignedChildren.map((ac) => (
                                  <div
                                    key={ac.id}
                                    className="flex items-center gap-1.5 rounded-md bg-pink-50 dark:bg-pink-500/10 border border-pink-200/60 dark:border-pink-500/20 px-2.5 py-1"
                                    data-testid={`badge-assigned-child-${u.id}-${ac.id}`}
                                  >
                                    <Baby className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                                    <span className="text-xs font-medium text-pink-700 dark:text-pink-300">
                                      {ac.fullName}
                                    </span>
                                    <div
                                      className={`flex items-center gap-0.5 ${ac.sponsorCanComment ? "text-emerald-600" : "text-muted-foreground/40"}`}
                                      title={ac.sponsorCanComment ? "Commenting enabled" : "Commenting disabled"}
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic" data-testid={`text-no-child-${u.id}`}>
                                No children assigned yet
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
                            {u.role === "sponsor" && assignedChildren.length > 0
                              ? `View-only access to ${assignedChildren.length} child profile${assignedChildren.length > 1 ? "s" : ""}`
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
          <DialogContent className="sm:max-w-[520px]">
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v, organizationId: v === "sponsor" ? "" : f.organizationId, sponsorChildIds: v !== "sponsor" ? [] : f.sponsorChildIds }))}
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

              {form.role === "sponsor" && (
                <SponsorChildPicker
                  children_={children || []}
                  selectedIds={form.sponsorChildIds}
                  onToggle={(id, checked) => setForm((f) => ({
                    ...f,
                    sponsorChildIds: checked
                      ? [...f.sponsorChildIds.filter((x) => x !== id), id]
                      : f.sponsorChildIds.filter((x) => x !== id),
                  }))}
                />
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
          <DialogContent className="sm:max-w-[520px]">
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({
                    ...f,
                    role: v,
                    organizationId: v === "sponsor" || v === "admin" ? "" : f.organizationId,
                    sponsorChildIds: v !== "sponsor" ? [] : f.sponsorChildIds,
                    sponsorCommentingMap: v !== "sponsor" ? {} : f.sponsorCommentingMap,
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

              {editForm.role === "sponsor" && (
                <SponsorChildPicker
                  children_={children || []}
                  selectedIds={editForm.sponsorChildIds}
                  commentingMap={editForm.sponsorCommentingMap}
                  onToggle={(id, checked) => toggleSponsorChild(id, checked, setEditForm)}
                  onToggleCommenting={(id, v) => toggleCommenting(id, v, setEditForm)}
                  showCommentingToggles
                />
              )}

              <Separator className="opacity-50" />

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
                {deleteUser && getAssignedChildren(deleteUser.id).length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Their child assignment{getAssignedChildren(deleteUser.id).length > 1 ? "s" : ""} ({getAssignedChildren(deleteUser.id).map((c) => c.fullName).join(", ")}) will also be cleared.
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

// ── Reusable sponsor child picker component ──────────────────────────────────
function SponsorChildPicker({
  children_,
  selectedIds,
  commentingMap = {},
  onToggle,
  onToggleCommenting,
  showCommentingToggles = false,
}: {
  children_: ChildSummary[];
  selectedIds: number[];
  commentingMap?: Record<number, boolean>;
  onToggle: (id: number, checked: boolean) => void;
  onToggleCommenting?: (id: number, value: boolean) => void;
  showCommentingToggles?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        <Baby className="h-3.5 w-3.5 text-pink-500" />
        Assigned Child Profiles
        {selectedIds.length > 0 && (
          <Badge variant="outline" className="ml-1 bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/25 text-xs">
            {selectedIds.length} selected
          </Badge>
        )}
      </Label>
      <p className="text-xs text-muted-foreground -mt-0.5">
        The sponsor will only be able to view the profiles of selected children.
      </p>
      <ScrollArea className="h-52 rounded-lg border border-border/60 bg-muted/20">
        <div className="p-2 space-y-1">
          {children_.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 italic">No child profiles exist yet</p>
          ) : children_.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            const canComment = commentingMap[c.id] ?? false;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isSelected ? "bg-pink-50 dark:bg-pink-500/10" : "hover:bg-muted/50"}`}
              >
                <Checkbox
                  id={`child-${c.id}`}
                  checked={isSelected}
                  onCheckedChange={(v) => onToggle(c.id, !!v)}
                  className="border-border/60 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                  data-testid={`checkbox-child-${c.id}`}
                />
                <label
                  htmlFor={`child-${c.id}`}
                  className="flex-1 min-w-0 cursor-pointer select-none"
                >
                  <p className="text-sm font-medium leading-none truncate">{c.fullName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.childId} · <span className="capitalize">{c.status}</span></p>
                </label>
                {showCommentingToggles && isSelected && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <MessageSquare className={`h-3.5 w-3.5 ${canComment ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                    <Switch
                      checked={canComment}
                      onCheckedChange={(v) => onToggleCommenting?.(c.id, v)}
                      className="scale-90"
                      data-testid={`switch-commenting-${c.id}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      {showCommentingToggles && selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Toggle the message icon to allow or block commenting per child.
        </p>
      )}
    </div>
  );
}
