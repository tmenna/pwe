import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, UserCog, AlertCircle, Building2 } from "lucide-react";
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

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  case_worker: "Case Worker",
  read_only: "Read Only",
  sponsor: "Sponsor",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  case_worker: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
  read_only: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/25",
  sponsor: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/25",
};

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "case_worker",
    organizationId: "",
  });

  const [editForm, setEditForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "case_worker",
    password: "",
    organizationId: "",
  });

  const { data: users, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

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
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created", description: `${form.username} has been added.` });
      setCreateOpen(false);
      setForm({ username: "", password: "", firstName: "", lastName: "", email: "", role: "case_worker", organizationId: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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
      const res = await apiRequest("PATCH", `/api/users/${editUser!.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
      setEditUser(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/users/${deleteUser!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
      setDeleteUser(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (u: SafeUser) => {
    setEditUser(u);
    setEditForm({
      username: u.username,
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email || "",
      role: u.role,
      password: "",
      organizationId: u.organizationId ? String(u.organizationId) : "",
    });
  };

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">User Management</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage portal accounts and roles</p>
            </div>
          </div>
          <Button size="sm" className="rounded-lg shadow-sm h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)} data-testid="button-add-user">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <div className="space-y-3">
          {users?.map((u) => (
            <Card key={u.id} className="border-border/50 transition-all duration-150 hover:shadow-sm" data-testid={`card-user-${u.id}`}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium" data-testid={`text-username-${u.id}`}>{u.username}</span>
                    <Badge variant="outline" className={`${roleBadgeColors[u.role] || ""} text-xs font-medium`} data-testid={`badge-role-${u.id}`}>
                      {roleLabels[u.role] || u.role}
                    </Badge>
                    {u.organizationId && organizations && (() => {
                      const org = organizations.find((o) => o.id === u.organizationId);
                      return org ? (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25 text-xs font-medium" data-testid={`badge-org-${u.id}`}>
                          <Building2 className="mr-1 h-3 w-3" />
                          {org.name}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    {u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "—"}
                    {u.email && ` · ${u.email}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => openEdit(u)} data-testid={`button-edit-${u.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-destructive/8 hover:text-destructive" onClick={() => setDeleteUser(u)} data-testid={`button-delete-${u.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {users?.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No users found.</p>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-5 pt-2"
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
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v, organizationId: v === "sponsor" ? "" : f.organizationId }))}>
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
                {form.role === "sponsor" && (
                  <p className="text-xs text-muted-foreground">Sponsors can only view their assigned children and send messages</p>
                )}
              </div>
              {form.role !== "sponsor" && organizations && organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Organization</Label>
                  <Select value={form.organizationId} onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v === "none" ? "" : v }))}>
                    <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-new-organization">
                      <SelectValue placeholder="No organization assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No organization assigned</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Non-admin users will only see children in their assigned organization</p>
                </div>
              )}
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createMutation.isPending} data-testid="button-confirm-create-user">
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit User: {editUser?.username}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="space-y-5 pt-2"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium">Username (Email Address)</Label>
                <Input
                  type="email"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  placeholder="user@example.com"
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
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v, organizationId: v === "sponsor" ? "" : f.organizationId }))}>
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
                {editForm.role === "sponsor" && (
                  <p className="text-xs text-muted-foreground">Sponsors can only view their assigned children and send messages</p>
                )}
              </div>
              {editForm.role !== "sponsor" && organizations && organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Organization</Label>
                  <Select value={editForm.organizationId || "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, organizationId: v === "none" ? "" : v }))}>
                    <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-edit-organization">
                      <SelectValue placeholder="No organization assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No organization assigned</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Non-admin users will only see children in their assigned organization</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">New Password (leave blank to keep current)</Label>
                <Input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to keep current"
                  className="h-11 rounded-lg border-border/60"
                  data-testid="input-edit-password"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button type="submit" className="rounded-lg shadow-sm" disabled={updateMutation.isPending} data-testid="button-confirm-edit-user">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <AlertCircle className="h-4.5 w-4.5 text-destructive" />
              </div>
              <p className="text-sm leading-relaxed">
                Are you sure you want to delete <strong>{deleteUser?.username}</strong>? This action cannot be undone.
              </p>
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
