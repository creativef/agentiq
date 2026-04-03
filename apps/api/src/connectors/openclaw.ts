// OpenClaw connector — requires only instance URL
import type { ConnectorDef, NormalizedEvent, DiscoveredAgent, AutoConfigResult } from "./index";

export const openclawConnector: ConnectorDef = {
  platform: "openclaw",
  displayName: "OpenClaw",
  description: "Connect your OpenClaw instance to sync agents and events.",
  icon: "🔗",
  requiresSetup: true,
  configFields: [
    { key: "apiUrl", label: "OpenClaw Instance URL", type: "url", placeholder: "http://localhost:3001", required: true },
  ],

  validateWebhook(raw: any, headers: Record<string, string>, secret: string): boolean {
    const provided = headers["x-webhook-secret"] || headers["x-openclaw-signature"];
    if (!secret) return true; // Allow if no secret configured
    return provided === secret;
  },

  normalizeEvent(raw: any): NormalizedEvent {
    return {
      type: raw.type ?? raw.event_type ?? "unknown",
      payload: raw.data ?? raw.payload ?? {},
      agentId: raw.agent_id ?? raw.agentId ?? null,
      sourceId: raw.id ?? raw.sourceId ?? null,
    };
  },

  async discoverAgents(config: Record<string, string>): Promise<DiscoveredAgent[]> {
    const baseUrl = config.apiUrl || "http://localhost:3001";
    try {
      const res = await fetch(`${baseUrl}/api/agents`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.agents || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
      }));
    } catch {
      return [];
    }
  },

  async autoConfigure(config: Record<string, string>): Promise<AutoConfigResult> {
    // This returns the webhook URL + secret the user needs to paste into their OpenClaw config
    const webhookSecret = crypto.randomUUID();
    const webhookUrl = `/api/connectors/openclaw/webhook`;
    return { webhookUrl, webhookSecret, message: `Add this to your OpenClaw config:\n\nwebhook_url: ${config.apiUrl}${webhookUrl}\nwebhook_secret: ${webhookSecret}` };
  },
};
