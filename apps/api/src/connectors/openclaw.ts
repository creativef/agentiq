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
    // Security: Always require a valid secret match if one exists
    const provided = headers["x-webhook-secret"] || headers["x-openclaw-signature"];
    if (!secret) return false; // Reject if no secret configured
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

    // Security: Allow http only for localhost; enforce https for external
    const urlObj = new URL(baseUrl);
    const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === '::1';
    if (!isLocalhost && urlObj.protocol !== 'https:') {
      console.error(`OpenClaw discovery blocked: Non-HTTPS URL ${baseUrl} rejected for security.`);
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    try {
      const res = await fetch(`${urlObj.origin}/api/agents`, { signal: controller.signal });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.agents || []).map((a: any) => ({
        id: a.id, name: a.name, role: a.role, status: a.status,
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') console.warn(`OpenClaw discovery timed out for ${baseUrl}`);
      else console.error(`OpenClaw discovery failed: ${error.message}`);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async autoConfigure(config: Record<string, string>): Promise<AutoConfigResult> {
    // Security: Generate a strong random secret
    const buffer = crypto.randomBytes(32);
    const webhookSecret = buffer.toString('base64url');
    const webhookUrl = `/api/connectors/openclaw/webhook`;
    return { 
      webhookUrl, 
      webhookSecret, 
      message: `Add this to your OpenClaw config:\n\nwebhook_url: ${config.apiUrl}${webhookUrl}\nwebhook_secret: ${webhookSecret}` 
    };
  },
};
