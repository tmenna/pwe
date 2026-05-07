import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, AlertCircle, ArrowRight, Heart, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
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
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const queryClient = useQueryClient();
  const { siteKey, getToken } = useRecaptcha();

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request failed");
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

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

            {!showForgot ? (
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotEmail(username); }}
                      className="text-xs text-[#4ec9a0] hover:text-[#3ab88f] transition-colors font-medium"
                      data-testid="button-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </div>
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
            ) : (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66DAB5]/12">
                    <Mail className="h-4 w-4 text-[#4ec9a0]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">Reset your password</h3>
                    <p className="text-xs text-muted-foreground">We'll send a reset link to your email</p>
                  </div>
                </div>

                {forgotSent ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 p-4">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Temporary password sent</p>
                        <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                          If that username has an email on file, a temporary password has been sent. Use it to sign in, then change your password from your profile settings.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                      className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-back-to-login"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    {forgotError && (
                      <div className="flex items-center gap-2.5 rounded-xl bg-destructive/8 p-3.5 text-sm text-destructive border border-destructive/10">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{forgotError}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Username or Email</Label>
                      <Input
                        type="text"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Enter your username or email"
                        required
                        autoFocus
                        className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4"
                        data-testid="input-forgot-email"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-lg text-[15px] font-medium shadow-md hover:shadow-lg transition-all bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
                      disabled={forgotLoading}
                      data-testid="button-send-reset-link"
                    >
                      {forgotLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(false); setForgotError(""); }}
                      className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to login
                    </button>
                  </form>
                )}
              </div>
            )}
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
