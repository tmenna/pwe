import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, AlertCircle, ArrowRight, Heart } from "lucide-react";
import pweLogo from "@assets/pwc_logo_1771579613297.jpg";

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

function useRecaptcha() {
  const { data } = useQuery<{ siteKey: string }>({
    queryKey: ["/api/config/recaptcha"],
  });

  const siteKey = data?.siteKey || "";

  useEffect(() => {
    if (!siteKey) return;
    if (document.querySelector(`script[src*="recaptcha"]`)) return;

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);
  }, [siteKey]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!siteKey || !window.grecaptcha) return null;
    return new Promise((resolve) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(siteKey, { action: "login" });
          resolve(token);
        } catch {
          resolve(null);
        }
      });
    });
  }, [siteKey]);

  return { siteKey, getToken };
}

export default function LandingPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const { siteKey, getToken } = useRecaptcha();

  const loginMutation = useMutation({
    mutationFn: async () => {
      let recaptchaToken: string | null = null;
      if (siteKey) {
        recaptchaToken = await getToken();
      }
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, recaptchaToken }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-background to-emerald-50/40 dark:from-blue-950/20 dark:via-background dark:to-emerald-950/10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/[0.03] blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.03] blur-3xl" />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute -inset-3 rounded-2xl bg-primary/[0.06] blur-xl" />
            <img
              src={pweLogo}
              alt="Partners with Ethiopia"
              className="relative h-20 w-20 rounded-2xl object-cover shadow-lg ring-1 ring-white/50 dark:ring-white/10"
              data-testid="img-landing-logo"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]" data-testid="text-landing-title">
            Child Sponsorship
          </h1>
          <h2 className="mt-1 text-lg font-semibold text-primary sm:text-xl" data-testid="text-landing-subtitle">
            Records Portal
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-px w-8 bg-border" />
            <Heart className="h-3.5 w-3.5 text-emerald-500" />
            <div className="h-px w-8 bg-border" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-[300px]">
            Partners with Ethiopia — Empowering children through sponsorship
          </p>
        </div>

        <Card className="border-border/40 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardContent className="px-7 py-7 sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold" data-testid="text-login-title">Welcome back</h3>
                <p className="text-xs text-muted-foreground">Sign in to access the portal</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {loginMutation.isError && (
                <div className="flex items-center gap-2.5 rounded-xl bg-destructive/8 p-3.5 text-sm text-destructive border border-destructive/10" data-testid="text-login-error">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{loginMutation.error?.message}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  autoFocus
                  className="h-11 rounded-lg border-border/60 bg-background px-4"
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-11 rounded-lg border-border/60 bg-background px-4"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-lg text-[15px] font-medium shadow-md hover:shadow-lg transition-shadow"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Signing in..." : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-2.5">
          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              <span>Secure Access</span>
            </div>
            <span className="text-border/60">&middot;</span>
            <span>Contact your admin for access</span>
          </div>
          {siteKey && (
            <p className="text-center text-[10px] text-muted-foreground/40">
              Protected by reCAPTCHA
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
