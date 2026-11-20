import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Moon, Search, Sun, Ticket, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGS, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/auth";

export function SearchBar({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); navigate({ to: "/events", search: { q: q.trim() || undefined } }); };
  return (
    <form onSubmit={submit} role="search" className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} aria-label={t("nav.search")} className="h-11 rounded-full bg-card pl-10" />
    </form>
  );
}

export function SiteHeader() {
  const { t, setLang, lang } = useI18n();
  const { theme, toggle } = useTheme();
  const { user } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold" aria-label="PassOn home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ticket text-primary-foreground shadow-ticket"><Ticket className="h-5 w-5" /></span>
          PassOn
        </Link>
        <SearchBar className="hidden flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Language"><Globe className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LANGS.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className={lang === l.code ? "font-bold" : ""}>{l.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          {user ? (
            <Button asChild variant="outline" className="hidden sm:inline-flex"><Link to="/settings">{t("nav.account")}</Link></Button>
          ) : (
            <Button asChild className="hidden sm:inline-flex"><Link to="/auth">{t("auth.signin")}</Link></Button>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBar /></div>
    </header>
  );
}
