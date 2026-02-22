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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import type { Child } from "@shared/schema";

const childFormSchema = z.object({
  childId: z.string().min(1, "Child ID is required"),
  fullName: z.string().min(1, "Full name is required"),
  age: z.coerce.number().min(0, "Age must be 0 or greater").max(25, "Age must be 25 or less"),
  gender: z.string().min(1, "Gender is required"),
  location: z.string().min(1, "Location is required"),
  programEnrollment: z.string().min(1, "Program enrollment is required"),
  assignedSponsors: z.string().optional(),
  assignedCaseWorker: z.string().min(1, "Case worker is required"),
  status: z.string().min(1, "Status is required"),
  description: z.string().optional(),
});

type ChildFormValues = z.infer<typeof childFormSchema>;

export default function ChildForm() {
  const [, navigate] = useLocation();
  const [isEdit, params] = useRoute("/children/:id/edit");
  const childDbId = params?.id;
  const { toast } = useToast();
  const { user } = useAuth();

  if (user?.role === "read_only") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="mb-2 text-lg font-semibold">Access Restricted</h2>
          <p className="mb-4 text-sm text-muted-foreground">Read-only users cannot create or edit child records.</p>
          <Button variant="outline" onClick={() => navigate("/children")}>Back to Children</Button>
        </Card>
      </div>
    );
  }
  const queryClient = useQueryClient();

  const { data: existingChild, isLoading: loadingChild } = useQuery<Child>({
    queryKey: ["/api/children", childDbId],
    enabled: !!isEdit && !!childDbId,
  });

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
      assignedCaseWorker: "",
      status: "active",
      description: "",
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
          assignedCaseWorker: existingChild.assignedCaseWorker,
          status: existingChild.status,
          description: existingChild.description || "",
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
          <Card className="p-8">
            <div className="animate-pulse space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(isEdit ? `/children/${childDbId}` : "/children")} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl" data-testid="text-form-title">
          {isEdit ? "Edit Child" : "Add New Child"}
        </h1>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField control={form.control} name="childId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Child ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CHD-001" {...field} data-testid="input-child-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} data-testid="input-full-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={25} {...field} data-testid="input-age" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-gender">
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
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
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

              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Region / City" {...field} data-testid="input-location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="programEnrollment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Enrollment</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Primary School, Accelerated Learning" {...field} data-testid="input-program" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="assignedSponsors" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Sponsor(s)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} data-testid="input-sponsors" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="assignedCaseWorker" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Case Worker</FormLabel>
                  <FormControl>
                    <Input placeholder="Case worker name" {...field} data-testid="input-case-worker" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Brief background or notes about this child" {...field} data-testid="input-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(isEdit ? `/children/${childDbId}` : "/children")} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-child">
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
