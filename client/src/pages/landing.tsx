import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, AlertCircle, ArrowRight } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <img
            src={pweLogo}
            alt="Partners with Ethiopia"
            className="mx-auto mb-5 h-20 w-auto rounded-xl shadow-md"
            data-testid="img-landing-logo"
          />
          <p className="text-sm text-muted-foreground" data-testid="text-landing-subtitle">Child Sponsorship Records Portal</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-2 pt-7 px-7">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold" data-testid="text-login-title">Sign In</h2>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">Enter your credentials to access the portal</p>
          </CardHeader>
          <CardContent className="px-7 pb-7 pt-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              {loginMutation.isError && (
                <div className="flex items-center gap-2.5 rounded-lg bg-destructive/8 p-3.5 text-sm text-destructive" data-testid="text-login-error">
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
                className="w-full h-11 rounded-lg text-[15px] font-medium shadow-sm"
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

        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              <span>Secure Access</span>
            </div>
            <span className="text-border">&middot;</span>
            <span>Contact your admin for access</span>
          </div>
          {siteKey && (
            <p className="text-center text-[10px] text-muted-foreground/50">
              Protected by reCAPTCHA
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
