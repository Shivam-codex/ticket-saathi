export type MarketplaceEvent = "listing_created" | "checkout_started" | "payment_success" | "dispute_opened";
type EventProperties = Record<string, string | number | boolean | null>;

let posthogPromise: Promise<import("posthog-js").PostHog> | null = null;

function posthogConfig() {
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"] as string | undefined;
  const region = (import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] as string | undefined) ?? "eu";
  return token ? { token, apiHost: region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com" } : null;
}

async function getPostHog() {
  const config = posthogConfig();
  if (!config) return null;
  posthogPromise ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(config.token, { api_host: config.apiHost, capture_pageview: false, capture_pageleave: false, autocapture: false });
    return posthog;
  });
  return posthogPromise;
}

export function trackMarketplaceEvent(event: MarketplaceEvent, properties: EventProperties = {}) {
  void getPostHog().then((client) => client?.capture(event, properties)).catch(() => undefined);
}

export function initialiseBrowserObservability() {
  const dsn = import.meta.env["VITE_LOVABLE_CONNECTOR_SENTRY_DSN"] as string | undefined;
  if (dsn) {
    void import("@sentry/react").then((Sentry) => Sentry.init({ dsn, environment: import.meta.env.MODE })).catch(() => undefined);
  }
  void getPostHog().catch(() => undefined);
}

export function captureBrowserException(error: unknown) {
  const dsn = import.meta.env["VITE_LOVABLE_CONNECTOR_SENTRY_DSN"] as string | undefined;
  if (!dsn) return;
  void import("@sentry/react").then((Sentry) => Sentry.captureException(error)).catch(() => undefined);
}
