import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, AlertCircle, Clock, ExternalLink, RefreshCw, Zap, ChevronDown, Search, Mail, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/00w14n789dtf2ul3nB8k803";
const STRIPE_PORTAL_LINK = "https://billing.stripe.com/p/login/5kQdR99ghdtf4Ct1ft8k800";

interface BillingStatus {
  subscribed: boolean;
  stripeMode?: "live" | "test" | "unknown";
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

type SafeUser = { id: string; username: string; firstName: string | null; lastName: string | null; email: string | null; role: string; };

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
  const isSuperAdmin = user?.role === "superadmin";
  const isAdminOrSuper = user?.role === "admin" || isSuperAdmin;

  const [lookupUserId, setLookupUserId] = useState<string>("__self__");
  const [customEmail, setCustomEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  if (!isAdminOrSuper) {
    return <Redirect to="/" />;
  }

  const { data: adminUsers } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    enabled: isSuperAdmin,
  });

  const adminAccounts = adminUsers?.filter((u) => ["admin", "superadmin"].includes(u.role)) ?? [];

  const lookupUser = lookupUserId === "__self__"
    ? null
    : adminAccounts.find((u) => u.id === lookupUserId);

  const profileEmail = lookupUser?.email || lookupUser?.username || undefined;
  // searchEmail wins over profile email if superadmin typed one manually
  const lookupEmail = searchEmail || profileEmail;
  const isViewingOther = isSuperAdmin && (lookupUserId !== "__self__" || !!searchEmail);

  const billingUrl = lookupEmail
    ? `/api/billing/status?email=${encodeURIComponent(lookupEmail)}`
    : "/api/billing/status";

  const { data: billing, isLoading, refetch } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status", lookupEmail ?? "self"],
    queryFn: async () => {
      const res = await fetch(billingUrl, { credentials: "include" });
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
  const displayEmail = billing?.customer?.email || (isViewingOther ? lookupEmail : user?.email || user?.username);

  const getLookupLabel = () => {
    if (!isSuperAdmin || lookupUserId === "__self__") return null;
    if (!lookupUser) return null;
    const name = lookupUser.firstName && lookupUser.lastName
      ? `${lookupUser.firstName} ${lookupUser.lastName}`
      : lookupUser.username;
    return name;
  };

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
              {isSuperAdmin
                ? "View subscription status for any admin account"
                : "Manage your PWE Portal subscription and payment details"}
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

        {/* Superadmin: account selector */}
        {isSuperAdmin && (
          <Card className="border-border/50 px-6 py-5 space-y-4">
            <h2 className="text-[15px] font-semibold flex items-center gap-2.5">
              <span className="inline-block w-1 h-5 rounded-full bg-primary" />
              Look Up Account
            </h2>
            <p className="text-xs text-muted-foreground">
              Select an admin account or enter any email address to search Stripe directly. You cannot manage their billing — only view the status.
            </p>

            <Select
              value={lookupUserId}
              onValueChange={(v) => { setLookupUserId(v); setCustomEmail(""); setSearchEmail(""); }}
            >
              <SelectTrigger className="h-11 rounded-lg border-border/60 max-w-sm" data-testid="select-billing-user">
                <SelectValue placeholder="Select an account..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__self__">My account ({user?.email || user?.username})</SelectItem>
                {adminAccounts
                  .filter((u) => u.id !== user?.id)
                  .map((u) => {
                    const name = u.firstName && u.lastName
                      ? `${u.firstName} ${u.lastName}`
                      : u.username;
                    return (
                      <SelectItem key={u.id} value={u.id}>
                        {name} ({u.email || u.username})
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Or search by the exact email used during Stripe checkout:
              </p>
              <div className="flex gap-2 max-w-sm">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setSearchEmail(customEmail.trim()); setLookupUserId("__self__"); } }}
                    placeholder="customer@example.com"
                    className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60"
                    data-testid="input-billing-email-search"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg px-4 shrink-0"
                  onClick={() => { setSearchEmail(customEmail.trim()); setLookupUserId("__self__"); }}
                  disabled={!customEmail.trim()}
                  data-testid="button-billing-email-search"
                >
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Search
                </Button>
                {searchEmail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 rounded-lg px-3 shrink-0 text-muted-foreground"
                    onClick={() => { setSearchEmail(""); setCustomEmail(""); }}
                    data-testid="button-billing-clear-search"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {searchEmail && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Searching Stripe for: <strong>{searchEmail}</strong>
                </p>
              )}
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Test-mode warning */}
            {billing?.stripeMode === "test" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10 px-4 py-3 text-sm text-orange-800 dark:text-orange-300">
                <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Stripe is in Test Mode</p>
                  <p className="mt-0.5 text-xs text-orange-700/80 dark:text-orange-400/80">
                    This environment is connected to Stripe's test data — it cannot see live subscriptions made through the real payment link. To view live billing, check from the <strong>deployed production app</strong> instead of this preview environment.
                  </p>
                </div>
              </div>
            )}

            {/* Viewing other account notice */}
            {isViewingOther && getLookupLabel() && (
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <Search className="h-4 w-4 shrink-0" />
                Viewing subscription status for <span className="font-semibold">{getLookupLabel()}</span>. You cannot manage their billing.
              </div>
            )}

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
                          : isViewingOther
                            ? `No subscription found for ${displayEmail}`
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

                    {!isViewingOther && (
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
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No subscription found for{" "}
                      <span className="font-medium text-foreground">{displayEmail || (isViewingOther ? lookupEmail : user?.email || user?.username)}</span>.
                      {!isViewingOther && " Click Subscribe Now to get started."}
                    </p>
                    {!isViewingOther && (
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
                    )}
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
