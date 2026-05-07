import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import type { Child, Organization } from "@shared/schema";

type SafeUser = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

const childFormSchema = z.object({
  childId: z.string().min(1, "Child ID is required"),
  fullName: z.string().min(1, "Full name is required"),
  age: z.coerce.number().min(0, "Age must be 0 or greater").max(25, "Age must be 25 or less"),
  gender: z.string().min(1, "Gender is required"),
  location: z.string().min(1, "Location is required"),
  programEnrollment: z.string().optional().default(""),
  assignedSponsors: z.string().optional(),
  isSponsored: z.boolean().default(false),
  assignedCaseWorker: z.string().min(1, "Case worker is required"),
  status: z.string().min(1, "Status is required"),
  description: z.string().optional(),
  organizationId: z.coerce.number().optional().nullable(),
  sponsorUserId: z.string().optional().nullable(),
});

type ChildFormValues = z.infer<typeof childFormSchema>;

export default function ChildForm() {
  const [, navigate] = useLocation();
  const [isEdit, params] = useRoute("/children/:id/edit");
  const childDbId = params?.id;
  const { toast } = useToast();
  const { user } = useAuth();

  if (user?.role === "sponsor") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center border-border/50">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">Access Restricted</h2>
          <p className="mb-4 text-sm text-muted-foreground">Sponsors cannot create or edit child records.</p>
          <Button variant="outline" className="rounded-lg" onClick={() => navigate("/children")}>Back to Children</Button>
        </Card>
      </div>
    );
  }
  const queryClient = useQueryClient();

  const { data: existingChild, isLoading: loadingChild } = useQuery<Child>({
    queryKey: ["/api/children", childDbId],
    enabled: !!isEdit && !!childDbId,
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: allUsers } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  const sponsorUsers = allUsers?.filter((u) => u.role === "sponsor") || [];

  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      childId: "",
      fullName: "",
      age: 0,
      gender: "",
      location: "",
      programEnrollment: "",
      assignedSponsors: "",
      isSponsored: false,
      assignedCaseWorker: "",
      status: "active",
      description: "",
      organizationId: null,
      sponsorUserId: null,
    },
    values: existingChild
      ? {
          childId: existingChild.childId,
          fullName: existingChild.fullName,
          age: existingChild.age,
          gender: existingChild.gender,
          location: existingChild.location,
          programEnrollment: existingChild.programEnrollment,
          assignedSponsors: existingChild.assignedSponsors || "",
          isSponsored: existingChild.isSponsored ?? false,
          assignedCaseWorker: existingChild.assignedCaseWorker,
          status: existingChild.status,
          description: existingChild.description || "",
          organizationId: existingChild.organizationId ?? null,
          sponsorUserId: existingChild.sponsorUserId ?? null,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: async (values: ChildFormValues) => {
      if (isEdit && childDbId) {
        return apiRequest("PATCH", `/api/children/${childDbId}`, values);
      }
      return apiRequest("POST", "/api/children", values);
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({ title: isEdit ? "Child updated" : "Child created", description: `${form.getValues("fullName")} has been saved.` });
      navigate(`/children/${data.id || childDbId}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: ChildFormValues) => mutation.mutate(values);

  if (isEdit && loadingChild) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8 border-border/50">
            <div className="animate-pulse space-y-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-11 rounded-lg bg-muted" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-5 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate(isEdit ? `/children/${childDbId}` : "/children")} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="mb-6 text-2xl font-bold tracking-tight" data-testid="text-form-title">
          {isEdit ? "Edit Child" : "Add New Child"}
        </h1>

        <Card className="p-7 border-border/50">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField control={form.control} name="childId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Child ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CHD-001" className="h-11 rounded-lg border-border/60" {...field} data-testid="input-child-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" className="h-11 rounded-lg border-border/60" {...field} data-testid="input-full-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Age</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={25} className="h-11 rounded-lg border-border/60" {...field} data-testid="input-age" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-gender">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-status">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="exited">Exited</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="h-px bg-border/40" />

              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-location">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Dale">Dale</SelectItem>
                      <SelectItem value="Shanto">Shanto</SelectItem>
                      <SelectItem value="Boricha">Boricha</SelectItem>
                      <SelectItem value="Addis Ababa">Addis Ababa</SelectItem>
                      <SelectItem value="Hawassa">Hawassa</SelectItem>
                      <SelectItem value="Gillo Bisare">Gillo Bisare</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="h-px bg-border/40" />

              <FormField control={form.control} name="assignedSponsors" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Assigned Sponsor(s)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" className="h-11 rounded-lg border-border/60" {...field} data-testid="input-sponsors" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="isSponsored" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                  <div>
                    <FormLabel className="text-sm font-medium">Sponsored Status</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">Mark this child as currently sponsored</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-sponsored" />
                  </FormControl>
                </FormItem>
              )} />

              {user?.role === "admin" && (
                <FormField control={form.control} name="sponsorUserId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Assigned Sponsor Account</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-sponsor-user">
                          <SelectValue placeholder="No sponsor account assigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No sponsor account</SelectItem>
                        {sponsorUsers.map((su) => (
                          <SelectItem key={su.id} value={su.id}>
                            {su.firstName && su.lastName ? `${su.firstName} ${su.lastName}` : su.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {sponsorUsers.length > 0
                        ? "Link a sponsor user account so they can view this child and send messages"
                        : "No sponsor accounts exist yet. Create one in User Management first."}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="assignedCaseWorker" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Assigned Case Worker</FormLabel>
                  <FormControl>
                    <Input placeholder="Case worker name" className="h-11 rounded-lg border-border/60" {...field} data-testid="input-case-worker" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="organizationId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Program Enrollment</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      if (val === "none") {
                        field.onChange(null);
                        form.setValue("programEnrollment", "");
                      } else {
                        field.onChange(parseInt(val));
                        const org = organizations?.find((o) => o.id === parseInt(val));
                        if (org) form.setValue("programEnrollment", org.name);
                      }
                    }}
                    value={field.value ? String(field.value) : "none"}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-lg border-border/60" data-testid="select-organization">
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Program</SelectItem>
                      {(organizations || []).map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Brief background or notes about this child" className="rounded-lg border-border/60 min-h-[100px]" {...field} data-testid="input-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-3">
                <Button type="button" variant="outline" className="rounded-lg h-11 px-5" onClick={() => navigate(isEdit ? `/children/${childDbId}` : "/children")} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" className={`rounded-lg h-11 px-6 shadow-sm ${!isEdit ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`} disabled={mutation.isPending} data-testid="button-submit-child">
                  {mutation.isPending ? "Saving..." : isEdit ? "Update Child" : "Create Child"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
