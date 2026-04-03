// Connector Registry — platform-agnostic connector framework
// Each platform (Hermes, OpenClaw, etc.) implements this interface.
// Adding a new platform = add one file + register it here. Zero route changes.

export interface ConnectorDef {
  platform: string;
  displayName: string;
  description: string;
  icon: string;
  // Does this connector need any user config at all?
  requiresSetup: boolean;
  // What fields does the user need to provide? (empty for built-in platforms)
  configFields: ConfigField[];
  // Normalize raw webhook payload into our canonical event format
  normalizeEvent: (raw: any) => NormalizedEvent;
  // Validate incoming webhook auth
  validateWebhook: (raw: any, headers: Record<string, string>, secret: string) => boolean;
  // Optional: poll the platform to discover agents
  discoverAgents?: (config: Record<string, string>) => Promise<DiscoveredAgent[]>;
  // Optional: auto-configure connection (e.g. register webhook on remote platform)
  autoConfigure?: (config: Record<string, string>) => Promise<AutoConfigResult>;
}

export interface NormalizedEvent {
  type: string;
  payload: Record<string, any>;
  agentId?: string | null;
  sourceId?: string | null;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number";
  placeholder?: string;
  required?: boolean;
}

export interface DiscoveredAgent {
  id: string;
  name: string;
  role?: string;
  status?: string;
}

export interface AutoConfigResult {
  webhookUrl: string;
  webhookSecret: string;
  message?: string;
}

// ============================================================
// REGISTER CONNECTORS
// ============================================================

import { hermesConnector } from "./hermes";
import { openclawConnector } from "./openclaw";

export const connectorRegistry: Record<string, ConnectorDef> = {
  hermes: hermesConnector,
  openclaw: openclawConnector,
};

export function listAvailablePlatforms() {
  return Object.values(connectorRegistry).map((c) => {
    const { normalizeEvent, validateWebhook, discoverAgents, autoConfigure, ...publicFields } = c;
    return publicFields;
  });
}

export function getConnector(platform: string): ConnectorDef | undefined {
  return connectorRegistry[platform];
}

export function isPlatformBuiltIn(platform: string): boolean {
  const conn = connectorRegistry[platform];
  return conn ? !conn.requiresSetup : false;
}
