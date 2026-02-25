import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, AlertCircle, ArrowRight } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950 px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={pweLogo}
            alt="Partners with Ethiopia"
            className="h-20 w-20 rounded-xl object-cover mb-5"
            data-testid="img-landing-logo"
          />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100" data-testid="text-landing-title">
            Child Sponsorship
          </h1>
          <h2 className="mt-1 text-base font-medium text-gray-500 dark:text-gray-400" data-testid="text-landing-subtitle">
            Records Portal
          </h2>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 italic">
            From Poverty to Possibility
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-7 sm:p-8 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
              <Lock className="h-4 w-4 text-gray-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100" data-testid="text-login-title">Sign in</h3>
              <p className="text-xs text-gray-400">Enter your credentials</p>
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
                  className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 focus:border-[#66DAB5] focus:ring-[#66DAB5]/20"
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
                  className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 focus:border-[#66DAB5] focus:ring-[#66DAB5]/20"
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
        </div>

        <div className="mt-8 flex flex-col items-center gap-2.5">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              <span>Secure Access</span>
            </div>
            <span className="text-gray-200 dark:text-gray-700">&middot;</span>
            <span>Contact your admin for access</span>
          </div>
          {siteKey && (
            <p className="text-center text-[10px] text-gray-300 dark:text-gray-600">
              Protected by reCAPTCHA
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
