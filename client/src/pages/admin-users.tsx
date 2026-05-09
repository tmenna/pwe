import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Pencil, Trash2, UserCog, AlertCircle, Building2,
  Shield, Eye, Heart, Users, Baby, MessageSquare, Search, X, Check,
  KeyRound, Copy, CheckCheck, Mail, MailX, SendHorizonal, Download, MapPin, BookOpen,
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
  streetAddress1: string | null;
  streetAddress2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  sponsoredPrograms: string | null;
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
  organizationId: number | null;
};

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  case_worker: "Case Worker",
  sponsor: "Sponsor",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25",
  case_worker: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
  sponsor: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/25",
};

const roleIcons: Record<string, React.ElementType> = {
  admin: Shield,
  case_worker: Users,
  sponsor: Heart,
};

const rolePermissionDesc: Record<string, string> = {
  admin: "Full access — all children, settings, and user management",
  case_worker: "Can create and edit children, documents, and comments",
  sponsor: "Read-only portal for their assigned children; can comment if enabled",
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
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  sponsoredPrograms: string[];
};

type CreateForm = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  sponsorChildIds: number[];
  sponsorCommentingMap: Record<number, boolean>;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  sponsoredPrograms: string[];
};

const emptyCreate: CreateForm = {
  username: "", password: "", firstName: "", lastName: "",
  role: "case_worker", organizationId: "", sponsorChildIds: [], sponsorCommentingMap: {},
  streetAddress1: "", streetAddress2: "", city: "", state: "", zipCode: "", country: "", sponsoredPrograms: [],
};

const emptyEdit: EditForm = {
  username: "", firstName: "", lastName: "", role: "case_worker",
  password: "", organizationId: "", sponsorChildIds: [], sponsorCommentingMap: {},
  streetAddress1: "", streetAddress2: "", city: "", state: "", zipCode: "", country: "", sponsoredPrograms: [],
};

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null);
  const [resetUser, setResetUser] = useState<SafeUser | null>(null);
  const [resetResult, setResetResult] = useState<{ newPassword: string; emailSent: boolean; emailError?: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [exportPending, setExportPending] = useState(false);

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/test-email", {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Test email sent", description: `Check ${data.email} for a delivery confirmation.` });
    },
    onError: (err: Error) => {
      toast({ title: "Email delivery failed", description: err.message, variant: "destructive" });
    },
  });
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
        streetAddress1: form.streetAddress1 || null,
        streetAddress2: form.streetAddress2 || null,
        city: form.city || null,
        state: form.state || null,
        zipCode: form.zipCode || null,
        country: form.country || null,
        sponsoredPrograms: form.sponsoredPrograms.length > 0 ? form.sponsoredPrograms.join(",") : null,
      });
      const newUser = await res.json();

      if (form.role === "sponsor" && form.sponsorChildIds.length > 0) {
        await apiRequest("POST", `/api/users/${newUser.id}/assign-child`, {
          childIds: form.sponsorChildIds,
        });
        for (const childId of form.sponsorChildIds) {
          const canComment = form.sponsorCommentingMap[childId] ?? false;
          if (canComment) {
            await apiRequest("PATCH", `/api/children/${childId}`, { sponsorCanComment: true });
          }
        }
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
        streetAddress1: editForm.streetAddress1 || null,
        streetAddress2: editForm.streetAddress2 || null,
        city: editForm.city || null,
        state: editForm.state || null,
        zipCode: editForm.zipCode || null,
        country: editForm.country || null,
        sponsoredPrograms: editForm.sponsoredPrograms.length > 0 ? editForm.sponsoredPrograms.join(",") : null,
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

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${resetUser!.id}/reset-password`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setResetUser(null);
      setResetResult(data);
      setCopied(false);
    },
    onError: (err: Error) => toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  const copyPassword = () => {
    if (resetResult?.newPassword) {
      navigator.clipboard.writeText(resetResult.newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      streetAddress1: u.streetAddress1 || "",
      streetAddress2: u.streetAddress2 || "",
      city: u.city || "",
      state: u.state || "",
      zipCode: u.zipCode || "",
      country: u.country || "",
      sponsoredPrograms: u.sponsoredPrograms ? u.sponsoredPrograms.split(",").map((s) => s.trim()).filter(Boolean) : [],
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-9 px-3 text-muted-foreground border-border/60"
              onClick={() => testEmailMutation.mutate()}
              disabled={testEmailMutation.isPending}
              title="Send a test email to verify delivery is working"
              data-testid="button-test-email"
            >
              <SendHorizonal className="mr-1.5 h-3.5 w-3.5" />
              {testEmailMutation.isPending ? "Sending..." : "Test Email"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-9 px-3 border-border/60"
              onClick={() => setExportOpen(true)}
              data-testid="button-export-sponsors"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export Sponsors
            </Button>
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
                        className="h-9 w-9 rounded-lg hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10"
                        onClick={() => setResetUser(u)}
                        title="Reset password"
                        data-testid={`button-reset-password-${u.id}`}
                      >
                        <KeyRound className="h-4 w-4" />
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
          <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[90vh]">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                Create New User
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="overflow-y-auto flex-1 space-y-5 pt-1 pr-1">
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

              {form.role === "sponsor" && (
                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Address
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Street Address Line 1</Label>
                    <Input
                      value={form.streetAddress1}
                      onChange={(e) => setForm((f) => ({ ...f, streetAddress1: e.target.value }))}
                      placeholder="e.g. 123 Main Street"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-new-street1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Street Address Line 2 <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      value={form.streetAddress2}
                      onChange={(e) => setForm((f) => ({ ...f, streetAddress2: e.target.value }))}
                      placeholder="e.g. Apt 4B, Suite 100"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-new-street2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="e.g. Nashville"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-new-city"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">State / Province</Label>
                      <Input
                        value={form.state}
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="e.g. Tennessee"
                        className="h-11 rounded-lg border-border/60"
                        data-testid="input-new-state"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">ZIP / Postal Code</Label>
                      <Input
                        value={form.zipCode}
                        onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))}
                        placeholder="e.g. 37201"
                        className="h-11 rounded-lg border-border/60"
                        data-testid="input-new-zipcode"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Country</Label>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="e.g. United States"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-new-country"
                    />
                  </div>
                </div>
              )}

              <Separator className="opacity-50" />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v, organizationId: v === "admin" ? "" : f.organizationId, sponsorChildIds: v !== "sponsor" ? [] : f.sponsorChildIds, sponsorCommentingMap: v !== "sponsor" ? {} : f.sponsorCommentingMap }))}
                >
                  <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="case_worker">Case Worker</SelectItem>
                    <SelectItem value="sponsor">Sponsor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{rolePermissionDesc[form.role]}</p>
              </div>

              {form.role === "sponsor" && organizations && organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-pink-500" />
                    Select a Program
                  </Label>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/30" data-testid="programs-checkbox-list-new">
                    {organizations.map((org) => {
                      const checked = form.sponsoredPrograms.includes(org.name);
                      return (
                        <label
                          key={org.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? "bg-pink-50/60 dark:bg-pink-500/10" : "hover:bg-muted/30"}`}
                          data-testid={`checkbox-program-new-${org.id}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                sponsoredPrograms: v
                                  ? [...f.sponsoredPrograms.filter((p) => p !== org.name), org.name]
                                  : f.sponsoredPrograms.filter((p) => p !== org.name),
                              }))
                            }
                            className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                          />
                          <span className="text-sm font-medium">{org.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {form.sponsoredPrograms.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {form.sponsoredPrograms.length} program{form.sponsoredPrograms.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}

              {form.role === "case_worker" && organizations && organizations.length > 0 && (
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
                  children_={(children || [])}
                  selectedIds={form.sponsorChildIds}
                  commentingMap={form.sponsorCommentingMap}
                  onToggle={(id, checked) => setForm((f) => {
                    const ids = checked
                      ? [...f.sponsorChildIds.filter((x) => x !== id), id]
                      : f.sponsorChildIds.filter((x) => x !== id);
                    const map = { ...f.sponsorCommentingMap };
                    if (!checked) delete map[id];
                    return { ...f, sponsorChildIds: ids, sponsorCommentingMap: map };
                  })}
                  onToggleCommenting={(id, v) => setForm((f) => ({
                    ...f,
                    sponsorCommentingMap: { ...f.sponsorCommentingMap, [id]: v },
                  }))}
                  showCommentingToggles
                />
              )}
              </div>{/* end scrollable area */}

              <DialogFooter className="shrink-0 border-t pt-4 mt-2">
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
          <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[90vh]">
            <DialogHeader className="shrink-0">
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
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="overflow-y-auto flex-1 space-y-5 pt-1 pr-1">
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

              {editForm.role === "sponsor" && (
                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Address
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Street Address Line 1</Label>
                    <Input
                      value={editForm.streetAddress1}
                      onChange={(e) => setEditForm((f) => ({ ...f, streetAddress1: e.target.value }))}
                      placeholder="e.g. 123 Main Street"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-edit-street1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Street Address Line 2 <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      value={editForm.streetAddress2}
                      onChange={(e) => setEditForm((f) => ({ ...f, streetAddress2: e.target.value }))}
                      placeholder="e.g. Apt 4B, Suite 100"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-edit-street2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">City</Label>
                    <Input
                      value={editForm.city}
                      onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="e.g. Nashville"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-edit-city"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">State / Province</Label>
                      <Input
                        value={editForm.state}
                        onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="e.g. Tennessee"
                        className="h-11 rounded-lg border-border/60"
                        data-testid="input-edit-state"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">ZIP / Postal Code</Label>
                      <Input
                        value={editForm.zipCode}
                        onChange={(e) => setEditForm((f) => ({ ...f, zipCode: e.target.value }))}
                        placeholder="e.g. 37201"
                        className="h-11 rounded-lg border-border/60"
                        data-testid="input-edit-zipcode"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Country</Label>
                    <Input
                      value={editForm.country}
                      onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="e.g. United States"
                      className="h-11 rounded-lg border-border/60"
                      data-testid="input-edit-country"
                    />
                  </div>
                </div>
              )}

              <Separator className="opacity-50" />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({
                    ...f,
                    role: v,
                    organizationId: v === "admin" ? "" : f.organizationId,
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
                    <SelectItem value="sponsor">Sponsor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{rolePermissionDesc[editForm.role]}</p>
              </div>

              {editForm.role === "sponsor" && organizations && organizations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-pink-500" />
                    Select a Program
                  </Label>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/30" data-testid="programs-checkbox-list-edit">
                    {organizations.map((org) => {
                      const checked = editForm.sponsoredPrograms.includes(org.name);
                      return (
                        <label
                          key={org.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? "bg-pink-50/60 dark:bg-pink-500/10" : "hover:bg-muted/30"}`}
                          data-testid={`checkbox-program-edit-${org.id}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setEditForm((f) => ({
                                ...f,
                                sponsoredPrograms: v
                                  ? [...f.sponsoredPrograms.filter((p) => p !== org.name), org.name]
                                  : f.sponsoredPrograms.filter((p) => p !== org.name),
                              }))
                            }
                            className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                          />
                          <span className="text-sm font-medium">{org.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {editForm.sponsoredPrograms.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {editForm.sponsoredPrograms.length} program{editForm.sponsoredPrograms.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}

              {editForm.role === "case_worker" && organizations && organizations.length > 0 && (
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
                  children_={(children || [])}
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
              </div>{/* end scrollable area */}

              <DialogFooter className="shrink-0 border-t pt-4 mt-2">
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

        {/* ── Reset Password confirm dialog ─────────── */}
        <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-500" />
                Reset Password
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                <KeyRound className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm leading-relaxed">
                  Generate a new random password for <strong>{resetUser?.username}</strong>?
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The current password will be replaced immediately and the new password will be
                  {(resetUser?.email || resetUser?.username?.includes("@"))
                    ? ` emailed automatically to ${resetUser?.email || resetUser?.username}.`
                    : " shown on screen — no email address on file for this user."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setResetUser(null)} data-testid="button-cancel-reset">
                Cancel
              </Button>
              <Button
                className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                onClick={() => resetPasswordMutation.mutate()}
                disabled={resetPasswordMutation.isPending}
                data-testid="button-confirm-reset"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reset Password result dialog ───────────── */}
        <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                Password Reset Successfully
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Always show the generated password for copying */}
              <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">New Password</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-lg font-mono font-semibold tracking-widest select-all" data-testid="text-new-password">
                    {resetResult?.newPassword}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg shrink-0"
                    onClick={copyPassword}
                    data-testid="button-copy-password"
                  >
                    {copied
                      ? <><CheckCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />Copied</>
                      : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>
                    }
                  </Button>
                </div>
              </div>

              {/* Email delivery status */}
              <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm ${resetResult?.emailSent ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                {resetResult?.emailSent ? (
                  <><Mail className="h-4 w-4 shrink-0 mt-0.5" /><span>Password also emailed to <strong>{resetResult.email}</strong></span></>
                ) : resetResult?.emailError ? (
                  <><MailX className="h-4 w-4 shrink-0 mt-0.5" /><span>Email failed — <strong>{resetResult.emailError}</strong>. Share the password above manually.</span></>
                ) : (
                  <><MailX className="h-4 w-4 shrink-0 mt-0.5" /><span>No email sent — no email address on file for this user</span></>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button className="rounded-lg" onClick={() => setResetResult(null)} data-testid="button-close-reset-result">
                Done
              </Button>
            </DialogFooter>
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

        {/* ── Export Sponsors dialog ────────────────── */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Export Sponsors
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Download a spreadsheet of all sponsors including their address and assigned children's profile data.
              </p>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "xlsx" | "csv")}>
                  <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-export-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV (.csv)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-lg" onClick={() => setExportOpen(false)}>Cancel</Button>
              <Button
                className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={exportPending}
                data-testid="button-confirm-export-sponsors"
                onClick={async () => {
                  setExportPending(true);
                  try {
                    const res = await fetch("/api/export/sponsors", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ format: exportFormat }),
                    });
                    if (!res.ok) throw new Error("Export failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `sponsors-export.${exportFormat}`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setExportOpen(false);
                  } catch (err: any) {
                    toast({ title: "Export failed", description: err.message, variant: "destructive" });
                  } finally {
                    setExportPending(false);
                  }
                }}
              >
                {exportPending ? "Exporting..." : "Download"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}

// ── Reusable sponsor child picker with search ────────────────────────────────
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
  const [query, setQuery] = useState("");

  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const q = normalise(query);

  // Selected children always shown first, then alphabetical
  const sorted = [...children_].sort((a, b) => {
    const aSelected = selectedIds.includes(a.id);
    const bSelected = selectedIds.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.fullName.localeCompare(b.fullName);
  });

  const visible = q
    ? sorted.filter(
        (c) =>
          normalise(c.fullName).includes(q) ||
          normalise(c.status).includes(q)
      )
    : sorted;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Baby className="h-3.5 w-3.5 text-pink-500" />
          Assigned Child
          {selectedIds.length > 0 && (
            <Badge
              variant="outline"
              className="ml-1 bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/25 text-xs"
            >
              {selectedIds.length} selected
            </Badge>
          )}
        </Label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => selectedIds.forEach((id) => onToggle(id, false))}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            data-testid="button-clear-children"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground -mt-0.5">
        Search to filter, then click a row or use <strong>Select all</strong> to assign in bulk.
      </p>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or child ID…"
          className="h-9 pl-8 pr-8 rounded-lg border-border/60 text-sm"
          data-testid="input-child-search"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Bulk-select bar — shown whenever there are visible results */}
      {visible.length > 0 && (() => {
        const allVisibleSelected = visible.every((c) => selectedIds.includes(c.id));
        const someVisibleSelected = !allVisibleSelected && visible.some((c) => selectedIds.includes(c.id));
        return (
          <div className="flex items-center justify-between px-1 -mt-0.5">
            <button
              type="button"
              onClick={() => {
                if (allVisibleSelected) {
                  visible.forEach((c) => onToggle(c.id, false));
                } else {
                  visible.forEach((c) => {
                    if (!selectedIds.includes(c.id)) onToggle(c.id, true);
                  });
                }
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              data-testid="button-select-all-visible"
            >
              {allVisibleSelected ? (
                <>
                  <X className="h-3 w-3" />
                  Deselect {query.trim() ? `${visible.length} shown` : "all"}
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  Select {query.trim() ? `all ${visible.length} shown` : "all"}
                </>
              )}
            </button>
            {someVisibleSelected && (
              <span className="text-[11px] text-muted-foreground">
                {visible.filter((c) => selectedIds.includes(c.id)).length} of {visible.length} shown selected
              </span>
            )}
          </div>
        );
      })()}

      {/* Commenting: all-toggle bar — shown when editing and children are selected */}
      {showCommentingToggles && selectedIds.length > 0 && (() => {
        const allOn = selectedIds.every((id) => commentingMap[id] === true);
        const someOn = !allOn && selectedIds.some((id) => commentingMap[id] === true);
        return (
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${allOn ? "text-emerald-500" : someOn ? "text-amber-500" : "text-muted-foreground/50"}`} />
              <div>
                <p className="text-xs font-medium leading-none">
                  Allow commenting — all selected
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {allOn ? "On for all" : someOn ? "Mixed — use individual toggles below" : "Off for all"}
                </p>
              </div>
            </div>
            <Switch
              checked={allOn}
              onCheckedChange={(v) => selectedIds.forEach((id) => onToggleCommenting?.(id, v))}
              className="scale-90"
              data-testid="switch-commenting-all"
            />
          </div>
        );
      })()}

      {/* List */}
      <ScrollArea className="h-52 rounded-lg border border-border/60 bg-muted/20">
        <div className="p-2 space-y-0.5">
          {children_.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 italic">
              No child profiles exist yet
            </p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <Search className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                No children match <strong>"{query}"</strong>
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-primary hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            visible.map((c) => {
              const isSelected = selectedIds.includes(c.id);
              const canComment = commentingMap[c.id] ?? false;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-pink-50 dark:bg-pink-500/10"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => onToggle(c.id, !isSelected)}
                >
                  {/* Custom checkbox indicator — no internal Radix state */}
                  <div
                    className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-pink-500 border-pink-500"
                        : "border-border/70 bg-background"
                    }`}
                    data-testid={`checkbox-child-${c.id}`}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0 select-none">
                    <p className="text-sm font-medium leading-none truncate">{c.fullName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="capitalize">{c.status}</span>
                    </p>
                  </div>
                  {showCommentingToggles && isSelected && (
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageSquare
                        className={`h-3.5 w-3.5 ${canComment ? "text-emerald-500" : "text-muted-foreground/40"}`}
                      />
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
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer hints */}
      <div className="flex items-center justify-end">
        <p className="text-xs text-muted-foreground">
          {visible.length} of {children_.length} shown
        </p>
      </div>
    </div>
  );
}
