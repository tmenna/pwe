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
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/70 via-background to-amber-50/30 dark:from-green-950/15 dark:via-background dark:to-amber-950/10" />
      <div className="absolute top-0 left-1/3 w-[700px] h-[700px] rounded-full bg-green-600/[0.04] blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-400/[0.04] blur-3xl" />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-rose-700/[0.02] blur-3xl" />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute -inset-4 rounded-2xl bg-green-600/[0.06] blur-xl" />
            <img
              src={pweLogo}
              alt="Partners with Ethiopia"
              className="relative h-[88px] w-[88px] rounded-2xl object-cover shadow-lg ring-1 ring-green-700/10 dark:ring-green-400/10"
              data-testid="img-landing-logo"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-green-800 dark:text-green-200 sm:text-[28px]" data-testid="text-landing-title">
            Child Sponsorship
          </h1>
          <h2 className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400 sm:text-xl" data-testid="text-landing-subtitle">
            Records Portal
          </h2>
          <div className="mt-3.5 flex items-center gap-2.5">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-amber-400/50" />
            <Heart className="h-3.5 w-3.5 text-rose-600/70" />
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-amber-400/50" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-muted-foreground max-w-[300px] italic">
            Partners with Ethiopia — From Poverty to Possibility
          </p>
        </div>

        <Card className="border-green-700/8 dark:border-green-400/8 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardContent className="px-7 py-7 sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600/10 dark:bg-green-500/10">
                <Lock className="h-4 w-4 text-green-700 dark:text-green-400" />
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
                className="w-full h-11 rounded-lg text-[15px] font-medium shadow-md hover:shadow-lg transition-shadow bg-green-700 hover:bg-green-800 text-white dark:bg-green-600 dark:hover:bg-green-700"
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
