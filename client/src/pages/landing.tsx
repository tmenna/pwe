import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, AlertCircle, ArrowRight, Heart } from "lucide-react";
import pweLogo from "@assets/pwe-large-logo_1772038246752.jpg";

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
      <div className="absolute inset-0 bg-white dark:bg-gray-950" />
      <div className="absolute top-0 left-0 right-0 h-[45%] bg-[#66DAB5] dark:bg-[#66DAB5]/90" />
      <div className="absolute top-[45%] left-0 right-0 h-8 bg-gradient-to-b from-[#66DAB5] to-transparent dark:from-[#66DAB5]/90 dark:to-transparent" />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="absolute -inset-3 rounded-full bg-white/20 blur-lg" />
            <img
              src={pweLogo}
              alt="Partners with Ethiopia"
              className="relative h-24 w-24 rounded-2xl bg-white object-cover shadow-xl ring-4 ring-white/80 dark:ring-white/20"
              data-testid="img-landing-logo"
            />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-sm sm:text-[30px]" data-testid="text-landing-title">
            Child Sponsorship
          </h1>
          <h2 className="mt-0.5 text-lg font-semibold text-white/85 sm:text-xl" data-testid="text-landing-subtitle">
            Records Portal
          </h2>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-px w-10 bg-white/30" />
            <Heart className="h-3.5 w-3.5 text-white/70" />
            <div className="h-px w-10 bg-white/30" />
          </div>
          <p className="mt-2.5 text-[13px] font-medium text-white/75 max-w-[300px] italic">
            From Poverty to Possibility
          </p>
        </div>

        <Card className="border-0 shadow-2xl bg-white dark:bg-gray-900">
          <CardContent className="px-7 py-7 sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66DAB5]/12">
                <Lock className="h-4 w-4 text-[#4ec9a0]" />
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
                  className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4"
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
                  className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-lg text-[15px] font-medium shadow-md hover:shadow-lg transition-all bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
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
