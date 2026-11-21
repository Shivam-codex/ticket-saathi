import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useI18n } from "@/lib/i18n";
import { normaliseIndianPhone } from "@/lib/validation";
import { TurnstileField } from "@/components/security/TurnstileField";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PassOn" },
      { name: "description", content: "Sign in to PassOn with your mobile number or Google account." },
      { property: "og:title", content: "Sign in — PassOn" },
      { property: "og:description", content: "Sign in with mobile OTP or Google." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const turnstileConfigured = !!import.meta.env["VITE_TURNSTILE_SITE_KEY"];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/settings", replace: true }); });
  }, [navigate]);

  const sendOtp = async () => {
    const e164 = normaliseIndianPhone(phone);
    if (!e164) { toast.error("Enter a valid 10-digit Indian mobile number"); return; }
    if (turnstileConfigured && !captchaToken) { toast.error("Please complete the security check"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: captchaToken ? { captchaToken } : {} });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSentTo(e164); toast.success("OTP sent");
  };
  const verify = async () => {
    if (!sentTo || otp.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: otp, type: "sms" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/settings", replace: true });
  };
  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/settings", replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border bg-card p-7">
        <h1 className="text-2xl font-extrabold">{t("auth.title")}</h1>
        {!sentTo ? (
          <div className="mt-6 space-y-3">
            <Label htmlFor="phone">{t("auth.phone")}</Label>
            <div className="flex gap-2">
              <span className="grid h-11 place-items-center rounded-md border bg-muted px-3 text-sm">+91</span>
              <Input id="phone" inputMode="numeric" autoComplete="tel-national" className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
            </div>
            <TurnstileField action="signup" onToken={setCaptchaToken} />
            <Button className="h-11 w-full" disabled={busy || (turnstileConfigured && !captchaToken)} onClick={sendOtp}>{t("auth.sendOtp")}</Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <Label>{t("auth.otp")} · {sentTo}</Label>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>{[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
            </InputOTP>
            <Button className="h-11 w-full" disabled={busy || otp.length !== 6} onClick={verify}>{t("auth.verify")}</Button>
            <button className="text-sm text-muted-foreground underline" onClick={() => { setSentTo(null); setOtp(""); }}>Change number</button>
          </div>
        )}
        <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />{t("auth.or")}<span className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" className="h-11 w-full gap-2.5" onClick={google}><GoogleG />{t("auth.google")}</Button>
        <p className="mt-6 text-xs text-muted-foreground">By continuing you agree to our Terms of Use and Privacy Policy. We'll ask for your consent choices next.</p>
      </div>
    </div>
  );
}
