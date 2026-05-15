import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, AlertCircle, CheckCircle2, Smartphone, KeyRound, Copy, Check } from "lucide-react";
import pweLogo from "@assets/pwe-large-logo_1772038246752.jpg";

export default function TotpSetupPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"loading" | "scan" | "verify" | "done">("loading");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/2fa/generate", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to generate QR code");
          setStep("scan");
          return;
        }
        const data = await res.json();
        setQrCodeDataUrl(data.qrCodeDataUrl);
        setSecret(data.secret);
        setUsername(data.username);
        setStep("scan");
      } catch {
        setError("Failed to connect to server. Please refresh and try again.");
        setStep("scan");
      }
    })();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Verification failed");
        return;
      }
      setStep("done");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }, 1200);
    } catch {
      setError("Failed to verify. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Two-Factor Authentication
          </h1>
          <h2 className="mt-0.5 text-lg font-semibold text-white/85 sm:text-xl">
            Secure your account
          </h2>
        </div>

        <Card className="border-0 shadow-2xl bg-white dark:bg-gray-900">
          <CardContent className="px-7 py-7 sm:px-8 sm:py-8">
            {step === "loading" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#66DAB5] border-t-transparent" />
                <p className="text-sm text-muted-foreground">Setting up your authenticator…</p>
              </div>
            )}

            {step === "scan" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66DAB5]/12">
                    <Smartphone className="h-4 w-4 text-[#4ec9a0]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">Scan QR Code</h3>
                    <p className="text-xs text-muted-foreground">Use Google Authenticator or any TOTP app</p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-destructive/8 p-3.5 text-sm text-destructive border border-destructive/10">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {qrCodeDataUrl && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/50 bg-white p-4 flex items-center justify-center">
                      <img src={qrCodeDataUrl} alt="QR Code" className="h-48 w-48" data-testid="img-totp-qr" />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Can't scan? Enter this key manually:</p>
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                        <code className="flex-1 text-xs font-mono tracking-widest text-foreground break-all" data-testid="text-totp-secret">
                          {secret}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-copy-secret"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 p-3.5 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                      <p className="font-medium">Setup instructions:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-blue-700/80 dark:text-blue-400/80">
                        <li>Open <strong>Google Authenticator</strong> on your phone</li>
                        <li>Tap the <strong>+</strong> button and choose "Scan QR code"</li>
                        <li>Scan the code above or enter the key manually</li>
                        <li>Enter the 6-digit code from the app below</li>
                      </ol>
                    </div>

                    <Button
                      className="w-full h-11 rounded-lg text-[15px] font-medium bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
                      onClick={() => { setStep("verify"); setError(""); }}
                      data-testid="button-proceed-to-verify"
                    >
                      I've scanned the QR code →
                    </Button>
                  </div>
                )}
              </div>
            )}

            {step === "verify" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66DAB5]/12">
                    <KeyRound className="h-4 w-4 text-[#4ec9a0]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">Confirm your code</h3>
                    <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-destructive/8 p-3.5 text-sm text-destructive border border-destructive/10" data-testid="text-totp-error">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">6-Digit Code</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9 ]*"
                      maxLength={7}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="000 000"
                      autoFocus
                      required
                      className="h-14 rounded-lg text-center text-2xl font-mono tracking-[0.4em] border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                      data-testid="input-totp-code"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg text-[15px] font-medium shadow-md bg-[#66DAB5] hover:bg-[#55c9a4] text-white"
                    disabled={loading}
                    data-testid="button-verify-totp-setup"
                  >
                    {loading ? "Verifying…" : "Enable Two-Factor Authentication"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => { setStep("scan"); setError(""); }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to QR code
                </button>
              </div>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">2FA Enabled!</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Signing you in…</p>
                </div>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#66DAB5] border-t-transparent" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            <span>Secure Access</span>
          </div>
        </div>
      </div>
    </div>
  );
}
