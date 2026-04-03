import type { ConnectorDef, NormalizedEvent } from "./index";

export const hermesConnector: ConnectorDef = {
  platform: "hermes",
  displayName: "Hermes",
  description: "Hermes agent platform for autonomous AI agents",
  icon: "⚡",

  validateWebhook(raw: any, headers: Record<string, string>, secret: string): boolean {
    const provided = headers["x-webhook-secret"] || headers["x-hermes-signature"];
    if (!secret) return true; // no secret configured, allow all
    return provided === secret;
  },

  normalizeEvent(raw: any): NormalizedEvent {
    return {
      type: raw.type ?? raw.event_type ?? "hermes_event",
      payload: raw.data ?? raw.payload ?? {},
      agentId: raw.agent_id ?? raw.agentId ?? null,
      sourceId: raw.id ?? raw.event_id ?? null,
    };
  },

  configFields: [
    { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "From Hermes settings", required: true },
    { key: "apiUrl", label: "Hermes API URL", type: "url", placeholder: "http://localhost:5173" },
  ],
};
