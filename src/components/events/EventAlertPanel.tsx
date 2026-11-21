import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { joinWaitlist, setEventFollow } from "@/functions/trust.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export function EventAlertPanel({ eventId }: { eventId: string }) {
  const { t } = useI18n(); const follow = useServerFn(setEventFollow); const waitlist = useServerFn(joinWaitlist);
  const [signedIn,setSignedIn] = useState(false); const [price,setPrice] = useState(""); const [quantity,setQuantity] = useState(1);
  useEffect(() => { void supabase.auth.getSession().then(({data}) => setSignedIn(!!data.session)); },[]);
  const money = () => Math.round(Number(price) * 100);
  const saveFollow = async () => { try { await follow({data:{event_id:eventId,max_price_paise:price?money():null}}); toast.success(t("alerts.saved")); } catch { toast.error(t("alerts.signIn")); } };
  const saveWaitlist = async () => { try { await waitlist({data:{event_id:eventId,max_price_paise:money(),quantity}}); toast.success(t("waitlist.saved")); } catch { toast.error(t("alerts.signIn")); } };
  if (!signedIn) return <section className="mt-5 rounded-2xl border bg-card p-5"><p className="font-semibold">{t("alerts.title")}</p><Button asChild variant="outline" className="mt-3"><Link to="/auth">{t("alerts.signIn")}</Link></Button></section>;
  return <section className="mt-5 grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2"><div><h2 className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-primary" />{t("alerts.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("alerts.d")}</p><Button variant="outline" className="mt-3" onClick={saveFollow}>{t("alerts.follow")}</Button></div><div><h2 className="flex items-center gap-2 font-bold"><ListPlus className="h-4 w-4 text-primary" />{t("waitlist.title")}</h2><div className="mt-3 grid grid-cols-2 gap-2"><div><Label htmlFor="alert-price">{t("alerts.maxPrice")}</Label><Input id="alert-price" type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="1000" /></div><div><Label htmlFor="alert-qty">{t("buy.quantity")}</Label><select id="alert-qty" className="h-9 w-full rounded-md border bg-background px-3" value={quantity} onChange={e => setQuantity(Number(e.target.value))}>{[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></div></div><Button className="mt-3" disabled={!price || Number(price)<=0} onClick={saveWaitlist}>{t("waitlist.join")}</Button></div></section>;
}
