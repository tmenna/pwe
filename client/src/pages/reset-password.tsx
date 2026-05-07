import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import pweLogo from "@assets/pwe-large-logo_1772038246752.jpg";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
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
            />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-sm sm:text-[30px]">
            Child Sponsorship
          </h1>
          <h2 className="mt-0.5 text-lg font-semibold text-white/85 sm:text-xl">
            Records Portal
          </h2>
        </div>

        <Card className="border-0 shadow-2xl bg-white dark:bg-gray-900">
          <CardContent className="px-7 py-7 sm:px-8 sm:py-8">
            {!token ? (
              <div className="text-center space-y-4">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Invalid Reset Link</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This password reset link is missing a token. Please request a new reset link from the login page.
                  </p>
                </div>
                <Button
                  className="w-full h-11 rounded-lg bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
                  onClick={() => setLocation("/")}
                >
                  Back to Login
                </Button>
              </div>
            ) : success ? (
              <div className="text-center space-y-4">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Password Reset Successfully</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your password has been updated. You can now sign in with your new password.
                  </p>
                </div>
                <Button
                  className="w-full h-11 rounded-lg bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
                  onClick={() => setLocation("/")}
                  data-testid="button-back-to-login"
                >
                  Sign In
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66DAB5]/12">
                    <Lock className="h-4 w-4 text-[#4ec9a0]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">Set New Password</h3>
                    <p className="text-xs text-muted-foreground">Choose a strong password to secure your account</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-destructive/8 p-3.5 text-sm text-destructive border border-destructive/10">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        autoFocus
                        className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 pr-10"
                        data-testid="input-new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Confirm Password</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                      className="h-11 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4"
                      data-testid="input-confirm-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg text-[15px] font-medium shadow-md hover:shadow-lg transition-all bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
                    disabled={isLoading}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setLocation("/")}
                    className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to login
                  </button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
