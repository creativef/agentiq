// Connector Registry — platform-agnostic connector framework
// Each platform (Hermes, OpenClaw, etc.) implements this interface.
// Adding a new platform = add one file + register it. Zero route changes.

export interface ConnectorDef {
  platform: string;
  displayName: string;
  description: string;
  icon: string;
  normalizeEvent: (raw: any) => NormalizedEvent;
  validateWebhook: (raw: any, headers: Record<string, string>, secret: string) => boolean;
  configFields: ConfigField[];
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

// ============================================================
// REGISTER CONNECTORS HERE
// To add a new platform: implement ConnectorDef, then add it below.
// ============================================================

import { hermesConnector } from "./hermes";
import { openclawConnector } from "./openclaw";

export const connectorRegistry: Record<string, ConnectorDef> = {
  hermes: hermesConnector,
  openclaw: openclawConnector,
};

export function listAvailablePlatforms() {
  return Object.values(connectorRegistry).map((c) => ({
    platform: c.platform,
    displayName: c.displayName,
    description: c.description,
    icon: c.icon,
    configFields: c.configFields,
  }));
}

export function getConnector(platform: string): ConnectorDef | undefined {
  return connectorRegistry[platform];
}
