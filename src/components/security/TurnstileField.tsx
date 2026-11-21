import { Turnstile } from "@marsidev/react-turnstile";
import { useI18n } from "@/lib/i18n";

export function TurnstileField({ action, onToken }: { action: "signup" | "listing"; onToken: (token: string | undefined) => void }) {
  const { t } = useI18n();
  const siteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;
  if (!siteKey) {
    return <p className="text-xs text-muted-foreground" data-testid={`turnstile-${action}-unconfigured`}>{t("security.unconfigured")}</p>;
  }
  return (
    <div className="min-h-16" data-testid={`turnstile-${action}`}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={onToken}
        onError={() => onToken(undefined)}
        onExpire={() => onToken(undefined)}
        options={{ action, theme: "auto" }}
      />
    </div>
  );
}
