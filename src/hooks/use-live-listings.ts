import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Subscribes to listing changes (optionally for one event) and calls onChange, debounced. */
export function useLiveListings(onChange: () => void, eventId?: string) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`listings-${eventId ?? "all"}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings", ...(eventId ? { filter: `event_id=eq.${eventId}` } : {}) }, () => {
        clearTimeout(t);
        t = setTimeout(() => cb.current(), 400);
      })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
  }, [eventId]);
}
