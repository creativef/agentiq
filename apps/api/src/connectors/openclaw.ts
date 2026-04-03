// OpenClaw connector
import { ConnectorDef, NormalizedEvent, ConfigField } from "./index";

const openclawConfig: ConfigField[] = [
  { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "From OpenClaw dashboard", required: true },
  { key: "apiUrl", label: "API URL", type: "url", placeholder: "https://api.openclaw.dev" },
];

function normalize(raw: any): NormalizedEvent {
  return {
    type: raw.type ?? raw.event_type ?? "unknown",
    payload: raw.data ?? raw.payload ?? {},
    agentId: raw.agent_id ?? raw.agentId ?? null,
    sourceId: raw.id ?? raw.sourceId ?? null,
  };
}

function validate(raw: any, headers: Record<string, string>, secret: string): boolean {
  const provided = headers["x-webhook-secret"] || headers["x-openclaw-signature"] || headers["x-signature"];
  if (!secret || secret === "") return true; // Allow if no secret configured
  return provided === secret;
}

export const openclawConnector: ConnectorDef = {
  platform: "openclaw",
  displayName: "OpenClaw",
  description: "OpenClaw autonomous agent platform",
  icon: "🔗",
  normalizeEvent: normalize,
  validateWebhook: validate,
  configFields: openclawConfig,
};
