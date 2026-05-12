import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, AlertCircle, Clock, ExternalLink, RefreshCw, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/00w14n789dtf2ul3nB8k803";
const STRIPE_PORTAL_LINK = "https://billing.stripe.com/p/login/5kQdR99ghdtf4Ct1ft8k800";

interface BillingStatus {
  subscribed: boolean;
  lookupEmail?: string;
  customer: { id: string; email: string | null; name: string | null } | null;
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
    planName: string;
    amount: number | null;
    currency: string | null;
    interval: string | null;
    paymentMethod: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    } | null;
  } | null;
}

function formatAmount(amount: number | null, currency: string | null) {
  if (!amount || !currency) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25" },
    trialing: { label: "Trial", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25" },
    past_due: { label: "Past Due", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25" },
    canceled: { label: "Canceled", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25" },
    incomplete: { label: "Incomplete", className: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/25" },
  };
  const style = map[status] || { label: status, className: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${style.className}`}>
      {style.label}
    </Badge>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  if (user?.role !== "admin") {
    return <Redirect to="/" />;
  }

  const { data: billing, isLoading, refetch } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
    onError: () => {
      window.open(STRIPE_PORTAL_LINK, "_blank", "noopener,noreferrer");
    },
  });

  const sub = billing?.subscription;
  const isActive = billing?.subscribed;
  const displayEmail = billing?.customer?.email || user?.email || user?.username;

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-7">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]" data-testid="text-billing-title">
              Billing
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Manage your PWE Portal subscription and payment details
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg mt-1"
            onClick={() => refetch()}
            title="Refresh"
            data-testid="button-refresh-billing"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>


        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Subscription status card */}
            <Card className="border-border/50 overflow-hidden">
              <div className={`px-6 py-4 border-b border-border/40 ${isActive ? "bg-emerald-50/60 dark:bg-emerald-500/5" : "bg-slate-50/60 dark:bg-slate-800/30"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-slate-100 dark:bg-slate-700/40"}`}>
                      {isActive
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        : <AlertCircle className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {isActive ? sub?.planName || "PWE Portal Subscription" : "No active subscription"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isActive
                          ? `Billed ${sub?.interval}ly · ${displayEmail}`
                          : "Subscribe to unlock full portal access"
                        }
                      </p>
                    </div>
                  </div>
                  {sub?.status && <StatusBadge status={sub.status} />}
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                {isActive && sub ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {sub.amount != null && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Amount</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatAmount(sub.amount, sub.currency)}
                            <span className="text-xs font-normal text-muted-foreground ml-1">/ {sub.interval}</span>
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Next Renewal</p>
                        <p className="mt-1 text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                      {sub.cancelAtPeriodEnd && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Note</p>
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">Cancels at period end</p>
                        </div>
                      )}
                    </div>

                    {sub.paymentMethod && (
                      <>
                        <Separator className="opacity-50" />
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-12 items-center justify-center rounded-md border border-border/60 bg-muted/40">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {sub.paymentMethod.brand} ···· {sub.paymentMethod.last4}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Expires {sub.paymentMethod.expMonth}/{sub.paymentMethod.expYear}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <Separator className="opacity-50" />

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="rounded-lg shadow-sm"
                        onClick={() => portalMutation.mutate()}
                        disabled={portalMutation.isPending}
                        data-testid="button-manage-billing"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        {portalMutation.isPending ? "Opening..." : "Manage Billing"}
                      </Button>
                      <p className="self-center text-xs text-muted-foreground">
                        Update payment method, view invoices, or cancel subscription
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No subscription found for{" "}
                      <span className="font-medium text-foreground">{activeEmail || user?.email || user?.username}</span>.
                      {" "}Use the lookup above if you subscribed with a different email, or click Subscribe Now to get started.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        asChild
                        data-testid="button-subscribe"
                      >
                        <a href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer">
                          <Zap className="mr-2 h-4 w-4" />
                          Subscribe Now
                          <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => portalMutation.mutate()}
                        disabled={portalMutation.isPending}
                        data-testid="button-manage-billing-unsubscribed"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        {portalMutation.isPending ? "Opening..." : "Manage Billing"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Account info card */}
            {billing?.customer && (
              <Card className="border-border/50 px-6 py-5 space-y-3">
                <h2 className="text-[15px] font-semibold flex items-center gap-2.5">
                  <span className="inline-block w-1 h-5 rounded-full bg-primary" />
                  Billing Account
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Email</p>
                    <p className="mt-1 font-medium">{billing.customer.email || "—"}</p>
                  </div>
                  {billing.customer.name && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Name</p>
                      <p className="mt-1 font-medium">{billing.customer.name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Customer ID</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{billing.customer.id}</p>
                  </div>
                </div>
              </Card>
            )}

          </>
        )}
      </div>
    </div>
  );
}
