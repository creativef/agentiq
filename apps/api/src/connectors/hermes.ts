// Hermes connector — built-in, requires ZERO user config
import type { ConnectorDef, NormalizedEvent } from "./index";

export const hermesConnector: ConnectorDef = {
  platform: "hermes",
  displayName: "Hermes",
  description: "Built-in Hermes agent integration. No setup required.",
  icon: "⚡",
  requiresSetup: false,
  configFields: [],

  validateWebhook(raw: any, headers: Record<string, string>, secret: string): boolean {
    return true; // Hermes is trusted by default
  },

  normalizeEvent(raw: any): NormalizedEvent {
    return {
      type: raw.type ?? raw.event_type ?? "hermes_event",
      payload: raw.data ?? raw.payload ?? {},
      agentId: raw.agent_id ?? raw.agentId ?? raw.agent ?? null,
      sourceId: raw.id ?? raw.event_id ?? null,
    };
  },
};
